import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, handleIncomingItem, handleIncomingStatusUpdate } from './database.js';
import { WsClientManager } from './ws-client.js';
import { createApiRouter } from './routes.js';

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.type === 'entity.too.large') {
    res.status(413).json({ error: 'Payload too large — image must be under 5MB' });
    return;
  }
  next(err);
});

let server: http.Server | null = null;
let wsManager: WsClientManager | null = null;

// ---------------------------------------------------------------------------
// startServer — create HTTP server, init DB, connect WS, listen
// ---------------------------------------------------------------------------

export async function startServer(): Promise<http.Server> {
  const PORT = parseInt(process.env.PORT || '3001', 10);
  const DEPT_NAME = process.env.DEPT_NAME || 'UnknownDept';
  const DEPT_SECRET = process.env.DEPT_SECRET;
  const SERVER_WS_URL = process.env.SERVER_WS_URL || 'ws://localhost:5000';

  if (!DEPT_SECRET) {
    throw new Error('DEPT_SECRET environment variable is required');
  }

  // 1. Initialize the local SQLite database
  await initDatabase();

  // 2. Create HTTP server from the Express app
  server = http.createServer(app);

  // 3. Create WebSocket client manager
  wsManager = new WsClientManager(DEPT_NAME, DEPT_SECRET, SERVER_WS_URL);

  // 4. Mount API routes
  app.use('/api', createApiRouter(wsManager, DEPT_NAME));

  // 5. In production (NODE_ENV=production), serve the Vite build
  if (process.env.NODE_ENV === 'production') {
    const staticDir = path.resolve(__dirname, '..', '..', 'dist');
    app.use(express.static(staticDir));
    // SPA fallback — serve index.html for any non-API route
    app.get('*', (_req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  // 6. Wire 'authenticated' event to flush the sync queue
  wsManager.on('authenticated', () => {
    console.log('[Server] Authenticated with hub — flushing sync queue');
    wsManager?.flushSyncQueue();
  });

  // 7. Wire incoming events from the hub to local database handlers
  wsManager.on('sync_dump', async (payload: any) => {
    const items: any[] = payload?.items ?? [];
    console.log(`[Server] Received SYNC_DUMP with ${items.length} item(s)`);
    for (const item of items) {
      try {
        await handleIncomingItem(item);
      } catch (err) {
        console.error('[Server] Error handling sync_dump item:', err);
      }
    }
  });

  wsManager.on('item_broadcast', async (payload: any) => {
    try {
      await handleIncomingItem(payload);
    } catch (err) {
      console.error('[Server] Error handling item_broadcast:', err);
    }
  });

  wsManager.on('status_update', async (payload: any) => {
    try {
      await handleIncomingStatusUpdate(payload);
    } catch (err) {
      console.error('[Server] Error handling status_update:', err);
    }
  });

  // 8. Connect to the hub server
  wsManager.connect();

  // 9. Listen on the configured port
  return new Promise<http.Server>((resolve, reject) => {
    server!.listen(PORT, () => {
      console.log(`[Server] Client server listening on port ${PORT}`);
      resolve(server!);
    });
    server!.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// stopServer — graceful shutdown
// ---------------------------------------------------------------------------

export async function stopServer(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (wsManager) {
      wsManager.disconnect();
      wsManager = null;
    }

    if (server) {
      server.close(() => {
        server = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// ---------------------------------------------------------------------------
// Direct execution (e.g., `tsx src/index.ts`)
// ---------------------------------------------------------------------------

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  startServer().catch((err: Error) => {
    console.error('[Server] Failed to start:', err.message);
    process.exit(1);
  });
}

// ---------------------------------------------------------------------------
// Graceful shutdown signal handlers
// ---------------------------------------------------------------------------

process.on('SIGTERM', async () => {
  await stopServer();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await stopServer();
  process.exit(0);
});
