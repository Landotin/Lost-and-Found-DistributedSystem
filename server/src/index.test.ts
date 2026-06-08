import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import { WebSocket } from 'ws';

// Mock the dependent modules BEFORE importing the module under test
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
}));

vi.mock('./connection-manager.js', () => {
  class MockConnectionManager {
    getConnectedNodes = vi.fn().mockReturnValue([]);
    getNodeCount = vi.fn().mockReturnValue(0);
    registerNode = vi.fn();
    removeNode = vi.fn();
    broadcastNodeList = vi.fn();
    on = vi.fn();
  }
  return {
    ConnectionManager: MockConnectionManager,
    handleConnection: vi.fn(),
  };
});

vi.mock('./heartbeat.js', () => {
  class MockHeartbeatManager {
    addNode = vi.fn();
    removeNode = vi.fn();
    start = vi.fn();
    stop = vi.fn();
    on = vi.fn();
  }
  return {
    HeartbeatManager: MockHeartbeatManager,
  };
});

import { startServer, stopServer } from './index.js';

let server: http.Server;
let port: number;

describe('Express Server Entry Point', () => {
  beforeAll(async () => {
    process.env.ADMIN_SECRET = 'test-admin-secret';
    process.env.PORT = '0';
    server = await startServer();
    const addr = server.address() as { port: number };
    port = addr.port;
  });

  afterAll(async () => {
    await stopServer();
  });

  it('GET /health returns 200 with status ok', async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; uptime: number; nodeCount: number };
    expect(body.status).toBe('ok');
  });

  it('GET /health returns numeric uptime', async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    const body = await res.json() as { status: string; uptime: number };
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('GET /health returns nodeCount', async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    const body = await res.json() as { status: string; nodeCount: number };
    expect(body).toHaveProperty('nodeCount');
    expect(typeof body.nodeCount).toBe('number');
  });

  it('server starts on configured PORT', () => {
    expect(port).toBeGreaterThan(0);
  });

  it('server accepts WebSocket connections at the same HTTP port', async () => {
    const ws = await new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
      setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
    });
    expect(ws.readyState).toBe(1);
    ws.close();
  });

  it('startup fails if ADMIN_SECRET is not set', async () => {
    const originalSecret = process.env.ADMIN_SECRET;
    delete process.env.ADMIN_SECRET;
    await expect(startServer()).rejects.toThrow();
    process.env.ADMIN_SECRET = originalSecret;
  });

  it('uptime increases over time', async () => {
    const res1 = await fetch(`http://localhost:${port}/health`);
    const body1 = await res1.json() as { uptime: number };
    await new Promise(r => setTimeout(r, 200));
    const res2 = await fetch(`http://localhost:${port}/health`);
    const body2 = await res2.json() as { uptime: number };
    expect(body2.uptime - body1.uptime).toBeGreaterThanOrEqual(0.1);
  });
});
