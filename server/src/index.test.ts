import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import { WebSocket } from 'ws';

// Mock the dependent modules BEFORE importing the module under test
vi.mock('./database.js', () => {
  const mockGetAllItems = vi.fn().mockResolvedValue([]);
  const mockGetAnalytics = vi.fn().mockResolvedValue({
    itemsByDepartment: {},
    claimRate: 0,
    totalItems: 0,
    totalFound: 0,
    totalClaimed: 0,
    totalLost: 0,
  });
  return {
    initDatabase: vi.fn().mockResolvedValue({
      exec: vi.fn(),
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(),
      close: vi.fn(),
    }),
    db: {
      exec: vi.fn(),
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn().mockResolvedValue([]),
    },
    getSyncDumpForNode: vi.fn().mockResolvedValue([]),
    savePerson: vi.fn().mockResolvedValue(undefined),
    saveItem: vi.fn().mockResolvedValue(undefined),
    getAllItemsWithPII: mockGetAllItems,
    getAnalytics: mockGetAnalytics,
  };
});

vi.mock('./connection-manager.js', () => {
  class MockConnectionManager {
    getConnectedNodes = vi.fn().mockReturnValue([]);
    getNodeCount = vi.fn().mockReturnValue(0);
    registerNode = vi.fn();
    removeNode = vi.fn();
    broadcastNodeList = vi.fn();
    on = vi.fn();
    addAdminNode = vi.fn().mockReturnValue('mock-admin-id');
    removeAdminNode = vi.fn();
    getAdminNodeCount = vi.fn().mockReturnValue(0);
    disconnectNode = vi.fn().mockReturnValue(true);
    getNode = vi.fn().mockReturnValue({
      socketId: 'mock-node-id',
      deptName: 'Test Department',
      connectedAt: '2025-01-01T00:00:00.000Z',
      socket: { readyState: 1, send: vi.fn() },
    });
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

  // ---------------------------------------------------------------------------
  // Admin API Tests (inside same describe block to share server lifecycle)
  // ---------------------------------------------------------------------------

  describe('Admin REST API', () => {
    // --- Auth Middleware ---

    it('GET /api/admin/nodes returns 401 without x-admin-secret header', async () => {
      const res = await fetch(`http://localhost:${port}/api/admin/nodes`);
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toContain('Unauthorized');
    });

    it('GET /api/admin/nodes returns 401 with wrong admin secret', async () => {
      const res = await fetch(`http://localhost:${port}/api/admin/nodes`, {
        headers: { 'x-admin-secret': 'wrong-secret' },
      });
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toContain('Unauthorized');
    });

    it('GET /api/admin/nodes returns node list with valid auth', async () => {
      const res = await fetch(`http://localhost:${port}/api/admin/nodes`, {
        headers: { 'x-admin-secret': 'test-admin-secret' },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any[];
      expect(Array.isArray(body)).toBe(true);
    });

    it('POST /api/admin/nodes/:id/disconnect requires auth', async () => {
      const res = await fetch(`http://localhost:${port}/api/admin/nodes/some-id/disconnect`, {
        method: 'POST',
      });
      expect(res.status).toBe(401);
    });

    it('POST /api/admin/nodes/:id/disconnect succeeds with auth', async () => {
      const res = await fetch(`http://localhost:${port}/api/admin/nodes/mock-node-id/disconnect`, {
        method: 'POST',
        headers: { 'x-admin-secret': 'test-admin-secret' },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean };
      expect(body.success).toBe(true);
    });

    // --- POST /api/admin/nodes/:id/sync ---

    it('POST /api/admin/nodes/:id/sync requires auth', async () => {
      const res = await fetch(`http://localhost:${port}/api/admin/nodes/some-id/sync`, {
        method: 'POST',
      });
      expect(res.status).toBe(401);
    });

    // --- GET /api/admin/items ---

    it('GET /api/admin/items requires auth', async () => {
      const res = await fetch(`http://localhost:${port}/api/admin/items`);
      expect(res.status).toBe(401);
    });

    it('GET /api/admin/items returns items list with auth', async () => {
      const { getAllItemsWithPII } = await import('./database.js');
      vi.mocked(getAllItemsWithPII).mockResolvedValueOnce([
        {
          id: 'item-1',
          item_name: 'Test Item',
          status: 'found',
          department_origin: 'CCS',
          surrenderer_full_name: 'Alice',
          surrenderer_mobile: '09170000001',
        },
      ]);
      const res = await fetch(`http://localhost:${port}/api/admin/items`, {
        headers: { 'x-admin-secret': 'test-admin-secret' },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any[];
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].item_name).toBe('Test Item');
    });

    // --- GET /api/admin/analytics ---

    it('GET /api/admin/analytics requires auth', async () => {
      const res = await fetch(`http://localhost:${port}/api/admin/analytics`);
      expect(res.status).toBe(401);
    });

    it('GET /api/admin/analytics returns analytics with auth', async () => {
      const { getAnalytics } = await import('./database.js');
      vi.mocked(getAnalytics).mockResolvedValueOnce({
        itemsByDepartment: { CCS: 5, COE: 3 },
        claimRate: 0.25,
        totalItems: 8,
        totalFound: 4,
        totalClaimed: 1,
        totalLost: 3,
      });
      const res = await fetch(`http://localhost:${port}/api/admin/analytics`, {
        headers: { 'x-admin-secret': 'test-admin-secret' },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body).toHaveProperty('itemsByDepartment');
      expect(body).toHaveProperty('claimRate');
      expect(body).toHaveProperty('totalItems');
      expect(body).toHaveProperty('totalLost');
      expect(body.totalItems).toBe(8);
    });
  });
});
