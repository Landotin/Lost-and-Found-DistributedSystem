import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import { initDatabase } from './database.js';
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

  // 9. Start heartbeat pings
  heartbeatManager.start();

  // 10. Listen on PORT
  return new Promise<http.Server>((resolve, reject) => {
    server!.listen(PORT, () => {
      // 10. Log
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
