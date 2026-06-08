import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import { initDatabase, getSyncDumpForNode, savePerson, saveItem } from './database.js';
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
        // Update the item's status and claimant details
        await saveItem({
          id: payload.id,
          item_name: payload.item_name,
          description: payload.description,
          category: payload.category,
          department_origin: payload.department_origin,
          status: payload.status,
          claimed_by: payload.claimed_by?.id ?? null,
          claimed_at: payload.claimed_at ?? null,
          updated_at: payload.updated_at ?? null,
          created_at: payload.created_at ?? null,
        });
        // Broadcast to other nodes
        if (manager) {
          manager.broadcastToOthers(socketId, 'STATUS_UPDATE', payload);
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
