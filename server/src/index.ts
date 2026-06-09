import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import { initDatabase, getSyncDumpForNode, savePerson, saveItem, getAllItemsWithPII, getAnalytics, db } from './database.js';
import { ConnectionManager, handleConnection } from './connection-manager.js';
import { HeartbeatManager } from './heartbeat.js';
import { fileURLToPath } from 'url';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

let server: http.Server | null = null;
let wss: WebSocketServer | null = null;
let manager: ConnectionManager | null = null;
let heartbeatManager: HeartbeatManager | null = null;
let startTime = Date.now();

// Health endpoint (defined once at module level)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: (Date.now() - startTime) / 1000,
    nodeCount: manager ? manager.getNodeCount() : 0,
  });
});

// ---------------------------------------------------------------------------
// Admin REST API — all routes protected by x-admin-secret header
// ---------------------------------------------------------------------------

function adminAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    res.status(500).json({ error: 'ADMIN_SECRET not configured on server' });
    return;
  }
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== adminSecret) {
    res.status(401).json({ error: 'Unauthorized: invalid or missing admin secret' });
    return;
  }
  next();
}

// GET /api/admin/nodes — list connected department nodes
app.get('/api/admin/nodes', adminAuth, (_req, res) => {
  const nodes = manager!.getConnectedNodes().map(n => ({
    socketId: n.socketId,
    deptName: n.deptName,
    connectedAt: n.connectedAt,
  }));
  res.json(nodes);
});

// POST /api/admin/nodes/:id/disconnect — force-disconnect a department node
app.post('/api/admin/nodes/:id/disconnect', adminAuth, (req, res) => {
  const { id } = req.params;
  const disconnected = manager!.disconnectNode(id);
  if (disconnected) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Node not found' });
  }
});

// POST /api/admin/nodes/:id/sync — trigger a SYNC_DUMP to a specific node
app.post('/api/admin/nodes/:id/sync', adminAuth, async (req, res) => {
  const { id } = req.params;
  const node = manager!.getNode(id);
  if (!node) {
    res.status(404).json({ error: 'Node not found' });
    return;
  }
  try {
    const items = await getSyncDumpForNode(node.deptName);
    if (node.socket.readyState === 1 /* WebSocket.OPEN */) {
      node.socket.send(JSON.stringify({
        event: 'SYNC_DUMP',
        payload: { items },
      }));
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Node socket is not open' });
    }
  } catch (err) {
    console.error('Failed to send SYNC_DUMP:', err);
    res.status(500).json({ error: 'Failed to send SYNC_DUMP' });
  }
});

// GET /api/admin/items — fetch all items with full (unredacted) PII
app.get('/api/admin/items', adminAuth, async (_req, res) => {
  try {
    const items = await getAllItemsWithPII();
    res.json(items);
  } catch (err) {
    console.error('Failed to fetch items:', err);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// GET /api/admin/analytics — aggregated stats
app.get('/api/admin/analytics', adminAuth, async (_req, res) => {
  try {
    const analytics = await getAnalytics();
    res.json(analytics);
  } catch (err) {
    console.error('Failed to fetch analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export async function startServer(): Promise<http.Server> {
  const PORT = parseInt(process.env.PORT || '5000', 10);
  const ADMIN_SECRET = process.env.ADMIN_SECRET;

  if (!ADMIN_SECRET) {
    throw new Error('ADMIN_SECRET environment variable is required');
  }

  // Reset start time for uptime calculations
  startTime = Date.now();

  // 1. Initialize database
  await initDatabase();

  // 2. Create HTTP server
  server = http.createServer(app);

  // 3. Create WebSocket server attached to HTTP server
  wss = new WebSocketServer({ server });

  // 4. Create ConnectionManager
  manager = new ConnectionManager(wss, ADMIN_SECRET);

  // 5. Handle WebSocket connections (HELLO protocol)
  handleConnection(wss, manager, ADMIN_SECRET);

  // 6. Create HeartbeatManager
  heartbeatManager = new HeartbeatManager();

  // 7. Wire heartbeat timeout to remove node from connection manager
  heartbeatManager.on('node_timeout', ({ socketId }: { socketId: string }) => {
    if (manager) {
      manager.removeNode(socketId);
      manager.broadcastNodeList();
    }
  });

  // Wire message events from connection manager to heartbeat manager
  manager.on('message', async ({ socketId, message }: { socketId: string; message: any }) => {
    if (message.event === 'ACK') {
      if (heartbeatManager) {
        heartbeatManager.handleAck(socketId);
      }
      return;
    }

    // Respond to node heartbeats with ACK so the node doesn't timeout
    if (message.event === 'HEARTBEAT') {
      const nodes = manager.getConnectedNodes();
      const node = nodes.find(n => n.socketId === socketId);
      if (node && node.socket.readyState === 1 /* WebSocket.OPEN */) {
        node.socket.send(JSON.stringify({ event: 'ACK', payload: { timestamp: Date.now() } }));
      }
      return;
    }

    // Handle ITEM_BROADCAST: save item and person, broadcast to others
    if (message.event === 'ITEM_BROADCAST') {
      const payload = message.payload as any;
      try {
        // Save surrenderer if provided
        if (payload.surrendered_by?.id) {
          await savePerson(payload.surrendered_by);
        }
        // Save item
        await saveItem({
          id: payload.id,
          item_name: payload.item_name,
          description: payload.description,
          category: payload.category,
          department_origin: payload.department_origin,
          status: payload.status,
          surrendered_by: payload.surrendered_by?.id ?? null,
          claimed_by: payload.claimed_by?.id ?? null,
          claimed_at: payload.claimed_at ?? null,
          updated_at: payload.updated_at ?? null,
          created_at: payload.created_at ?? null,
        });
        // Broadcast to other nodes
        if (manager) {
          manager.broadcastToOthers(socketId, 'ITEM_BROADCAST', payload);
        }
      } catch (err) {
        console.error('Failed to handle ITEM_BROADCAST:', err);
      }
      return;
    }

    // Handle STATUS_UPDATE: save item status and claimant, broadcast to others
    if (message.event === 'STATUS_UPDATE') {
      const payload = message.payload as any;
      try {
        // Save claimant if provided
        if (payload.claimed_by?.id) {
          await savePerson(payload.claimed_by);
        }

        // Fetch existing item to preserve fields and get origin department
        const existingItem = await db.get<any>(
          'SELECT * FROM items WHERE id = ?',
          [payload.id]
        );

        if (existingItem) {
          // Update the item's status and claimant details
          await saveItem({
            id: payload.id,
            item_name: existingItem.item_name,
            description: existingItem.description,
            category: existingItem.category,
            department_origin: existingItem.department_origin,
            status: payload.status,
            surrendered_by: existingItem.surrendered_by,
            claimed_by: payload.claimed_by?.id ?? null,
            claimed_at: payload.claimed_at ?? new Date().toISOString(),
            updated_at: payload.updated_at ?? new Date().toISOString(),
            created_at: existingItem.created_at,
          });

          // Broadcast to other nodes
          if (manager) {
            manager.broadcastToOthers(
              socketId,
              'STATUS_UPDATE',
              payload,
              existingItem.department_origin
            );
          }
        }
      } catch (err) {
        console.error('Failed to handle STATUS_UPDATE:', err);
      }
      return;
    }

    // Handle SYNC_QUEUE_FLUSH: save batch of items and broadcast each to others
    if (message.event === 'SYNC_QUEUE_FLUSH') {
      const payload = message.payload as any;
      const items: any[] = payload?.items ?? [];
      for (const item of items) {
        try {
          if (item.surrendered_by?.id) {
            await savePerson(item.surrendered_by);
          }
          if (item.claimed_by?.id) {
            await savePerson(item.claimed_by);
          }
          await saveItem({
            id: item.id,
            item_name: item.item_name,
            description: item.description,
            category: item.category,
            department_origin: item.department_origin,
            status: item.status,
            surrendered_by: item.surrendered_by?.id ?? null,
            claimed_by: item.claimed_by?.id ?? null,
            claimed_at: item.claimed_at ?? null,
            updated_at: item.updated_at ?? null,
            created_at: item.created_at ?? null,
          });
          if (manager) {
            manager.broadcastToOthers(socketId, 'ITEM_BROADCAST', item);
          }
        } catch (err) {
          console.error('Failed to handle SYNC_QUEUE_FLUSH item:', err);
        }
      }
      return;
    }
  });

  // 8. Wire connection events to heartbeat (addNode on connect, removeNode on disconnect)
  const origRegisterNode = manager.registerNode.bind(manager);
  manager.registerNode = (socket, deptName) => {
    const node = origRegisterNode(socket, deptName);
    if (heartbeatManager) {
      heartbeatManager.addNode(node.socketId, socket);
    }
    return node;
  };

  const origRemoveNode = manager.removeNode.bind(manager);
  manager.removeNode = (socketId) => {
    origRemoveNode(socketId);
    if (heartbeatManager) {
      heartbeatManager.removeNode(socketId);
    }
  };

  // 9. Send SYNC_DUMP to newly registered node
  manager.on('registered', async ({ socketId, deptName, socket }: { socketId: string; deptName: string; socket: any }) => {
    try {
      const items = await getSyncDumpForNode(deptName);
      if (socket.readyState === 1) { // WebSocket.OPEN
        socket.send(JSON.stringify({
          event: 'SYNC_DUMP',
          payload: { items },
        }));
      }
    } catch (err) {
      console.error('Failed to send SYNC_DUMP:', err);
    }
  });

  // 10. Start heartbeat pings
  heartbeatManager.start();

  // 11. Listen on PORT
  return new Promise<http.Server>((resolve, reject) => {
    server!.listen(PORT, () => {
      console.log(`Hub server listening on port ${PORT}`);
      resolve(server!);
    });
    server!.on('error', reject);
  });
}

export async function stopServer(): Promise<void> {
  return new Promise<void>((resolve) => {
    heartbeatManager?.stop();

    if (wss) {
      for (const ws of wss.clients) {
        ws.close(1001);
      }
    }

    if (server) {
      server.close(() => {
        server = null;
        wss = null;
        manager = null;
        heartbeatManager = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// Main entry when run directly
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  startServer().catch((err: Error) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  await stopServer();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await stopServer();
  process.exit(0);
});
