import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';

// ---------------------------------------------------------------------------
// Mocks — only mock external deps, use real routes.ts
// ---------------------------------------------------------------------------

vi.mock('./database.js', () => ({
  initDatabase: vi.fn().mockResolvedValue({
    exec: vi.fn(),
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn().mockResolvedValue([]),
    close: vi.fn(),
  }),
  db: {
    exec: vi.fn(),
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn().mockResolvedValue([]),
  },
  getAllItems: vi.fn().mockResolvedValue([]),
  getPendingSyncItems: vi.fn().mockResolvedValue([]),
  getItemById: vi.fn().mockResolvedValue(undefined),
  getPersonById: vi.fn().mockResolvedValue(undefined),
  createPerson: vi.fn().mockResolvedValue(undefined),
  createItem: vi.fn().mockResolvedValue(undefined),
  updateItemStatus: vi.fn().mockResolvedValue(undefined),
  markItemSynced: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./ws-client.js', () => {
  const { EventEmitter } = require('events');
  class MockWsClientManager extends EventEmitter {
    connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
    nodeList: Array<{ socketId: string; deptName: string }> = [];
    connect = vi.fn();
    disconnect = vi.fn();
    send = vi.fn().mockReturnValue(true);
    flushSyncQueue = vi.fn().mockResolvedValue(undefined);
  }
  return { WsClientManager: MockWsClientManager };
});

// ---------------------------------------------------------------------------
// Module under test (routes.js NOT mocked — runs real implementation)
// ---------------------------------------------------------------------------

import { startServer, stopServer } from './index.js';

let server: http.Server;
let port: number;

describe('Client Server — Entry Point', () => {
  beforeAll(async () => {
    process.env.DEPT_NAME = 'TestDept';
    process.env.DEPT_SECRET = 'test-secret';
    process.env.SERVER_WS_URL = 'ws://localhost:9999';
    process.env.PORT = '0';

    server = await startServer();
    const addr = server.address() as { port: number };
    port = addr.port;
  });

  afterAll(async () => {
    await stopServer();
    delete process.env.DEPT_NAME;
    delete process.env.DEPT_SECRET;
    delete process.env.SERVER_WS_URL;
    delete process.env.PORT;
  });

  // -----------------------------------------------------------------------
  // Server startup / lifecycle
  // -----------------------------------------------------------------------

  it('should start on a random port when PORT=0', () => {
    expect(port).toBeGreaterThan(0);
  });

  it('should call initDatabase on startup', async () => {
    const { initDatabase } = await import('./database.js');
    expect(initDatabase).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // API routes — exercise Express endpoints through real routes.ts
  // -----------------------------------------------------------------------

  it('GET /api/status returns 200 with department info', async () => {
    const res = await fetch(`http://localhost:${port}/api/status`);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('deptName', 'TestDept');
    expect(body).toHaveProperty('connected');
    expect(body).toHaveProperty('status');
  });

  it('GET /api/items returns 200 with items array', async () => {
    const res = await fetch(`http://localhost:${port}/api/items`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('GET /api/pending returns 200 with pending sync info', async () => {
    const res = await fetch(`http://localhost:${port}/api/pending`);
    expect(res.status).toBe(200);
    const body = await res.json() as { count: number; items: unknown[] };
    expect(body).toHaveProperty('count');
    expect(body).toHaveProperty('items');
  });

  it('POST /api/items returns 400 when item_name is missing', async () => {
    const res = await fetch(`http://localhost:${port}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'lost' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body).toHaveProperty('error');
  });

  it('POST /api/items returns 400 when status is invalid', async () => {
    const res = await fetch(`http://localhost:${port}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name: 'Wallet', status: 'invalid' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body).toHaveProperty('error');
  });

  // -----------------------------------------------------------------------
  // Lifecycle guards
  // -----------------------------------------------------------------------

  it('should fail to start when DEPT_SECRET is not set', async () => {
    const origSecret = process.env.DEPT_SECRET;
    delete process.env.DEPT_SECRET;
    await expect(startServer()).rejects.toThrow('DEPT_SECRET');
    process.env.DEPT_SECRET = origSecret;
  });

  // -----------------------------------------------------------------------
  // Shutdown
  // -----------------------------------------------------------------------

  it('stopServer shuts down without error', async () => {
    await expect(stopServer()).resolves.toBeUndefined();
  });
});
