import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import {
  ConnectionManager,
  handleConnection,
  type ConnectedNode,
} from './connection-manager.js';
import http from 'node:http';

const VALID_SECRET = 'test-hub-secret';

function getPort(): Promise<number> {
  return new Promise((resolve) => {
    const s = http.createServer();
    s.listen(0, () => {
      const addr = s.address() as { port: number };
      resolve(addr.port);
      s.close();
    });
  });
}

function createClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
}

function receiveMessage(ws: WebSocket, timeoutMs = 5000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Message timeout')), timeoutMs);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
  });
}

describe('ConnectionManager', () => {
  let manager: ConnectionManager;
  const mockWss = {} as WebSocketServer;
  const mockSecret = 'test-secret';

  beforeEach(() => {
    manager = new ConnectionManager(mockWss, mockSecret);
  });

  it('starts with zero connected nodes', () => {
    expect(manager.getNodeCount()).toBe(0);
    expect(manager.getConnectedNodes()).toEqual([]);
  });

  it('registerNode() adds a node and returns ConnectedNode', () => {
    const mockSocket = { on: () => {}, readyState: 1 } as unknown as WebSocket;
    const node = manager.registerNode(mockSocket, 'College of CCS');
    expect(node.deptName).toBe('College of CCS');
    expect(node.socketId).toBeDefined();
    expect(node.socketId.length).toBeGreaterThan(0);
    expect(node.connectedAt).toBeDefined();
    expect(node.socket).toBe(mockSocket);
    expect(manager.getNodeCount()).toBe(1);
  });

  it('removeNode() removes a node', () => {
    const mockSocket = { on: () => {}, readyState: 1 } as unknown as WebSocket;
    const node = manager.registerNode(mockSocket, 'College of COE');
    expect(manager.getNodeCount()).toBe(1);
    manager.removeNode(node.socketId);
    expect(manager.getNodeCount()).toBe(0);
    expect(manager.getConnectedNodes()).toEqual([]);
  });

  it('getNodeCount() returns correct count after add/remove', () => {
    const s1 = { on: () => {}, readyState: 1 } as unknown as WebSocket;
    const s2 = { on: () => {}, readyState: 1 } as unknown as WebSocket;
    const s3 = { on: () => {}, readyState: 1 } as unknown as WebSocket;

    const n1 = manager.registerNode(s1, 'Dept A');
    expect(manager.getNodeCount()).toBe(1);
    manager.registerNode(s2, 'Dept B');
    expect(manager.getNodeCount()).toBe(2);
    manager.registerNode(s3, 'Dept C');
    expect(manager.getNodeCount()).toBe(3);
    manager.removeNode(n1.socketId);
    expect(manager.getNodeCount()).toBe(2);
  });

  it('broadcastNodeList() sends NODE_LIST to all with valid readyState', () => {
    const sent: string[] = [];
    const s1 = {
      on: () => {},
      readyState: 1,
      send: (data: string) => sent.push(data),
    } as unknown as WebSocket;
    const s2 = {
      on: () => {},
      readyState: 1,
      send: (data: string) => sent.push(data),
    } as unknown as WebSocket;

    manager.registerNode(s1, 'Dept A');
    manager.registerNode(s2, 'Dept B');
    manager.broadcastNodeList();

    expect(sent.length).toBe(2);
    for (const msg of sent) {
      const parsed = JSON.parse(msg);
      expect(parsed.event).toBe('NODE_LIST');
      expect(parsed.payload.nodes).toHaveLength(2);
      expect(parsed.payload.count).toBe(2);
      expect(parsed.payload.nodes[0]).toHaveProperty('dept_name');
      expect(parsed.payload.nodes[0]).toHaveProperty('socket_id');
      expect(parsed.payload.nodes[0]).toHaveProperty('connected_at');
    }
  });
});

describe('handleConnection — HELLO protocol', () => {
  let wss: WebSocketServer;
  let manager: ConnectionManager;
  let httpServer: http.Server;
  let port: number;

  beforeEach(async () => {
    port = await getPort();
    httpServer = http.createServer();
    wss = new WebSocketServer({ server: httpServer });
    manager = new ConnectionManager(wss, VALID_SECRET);
    await new Promise<void>((resolve) => httpServer.listen(port, resolve));
    handleConnection(wss, manager, VALID_SECRET);
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      wss.close(() => {
        httpServer.close(() => resolve());
      });
    });
  });

  it('accepts valid HELLO message and registers node', async () => {
    const ws = await createClient(port);
    ws.send(JSON.stringify({
      event: 'HELLO',
      payload: { dept_name: 'CCS', dept_secret: VALID_SECRET },
    }));
    const msg = await receiveMessage(ws) as { event: string; payload: unknown };
    expect(msg.event).toBe('NODE_LIST');
    expect(manager.getNodeCount()).toBe(1);
    ws.close();
  });

  it('rejects with code 4001 on invalid secret', async () => {
    const ws = await createClient(port);
    const closePromise = new Promise<number>((resolve) => {
      ws.on('close', (code) => resolve(code));
    });
    ws.send(JSON.stringify({
      event: 'HELLO',
      payload: { dept_name: 'CCS', dept_secret: 'wrong-secret' },
    }));
    const code = await closePromise;
    expect(code).toBe(4001);
  });

  it('rejects with code 4001 on missing dept_name', async () => {
    const ws = await createClient(port);
    const closePromise = new Promise<number>((resolve) => {
      ws.on('close', (code) => resolve(code));
    });
    ws.send(JSON.stringify({
      event: 'HELLO',
      payload: { dept_name: '', dept_secret: VALID_SECRET },
    }));
    const code = await closePromise;
    expect(code).toBe(4001);
  });

  it('rejects with code 4002 on non-HELLO first message', async () => {
    const ws = await createClient(port);
    const closePromise = new Promise<number>((resolve) => {
      ws.on('close', (code) => resolve(code));
    });
    ws.send(JSON.stringify({
      event: 'ITEM_BROADCAST',
      payload: { item_name: 'Test' },
    }));
    const code = await closePromise;
    expect(code).toBe(4002);
  });

  it('removes node and broadcasts NODE_LIST on socket close', async () => {
    const ws = await createClient(port);
    ws.send(JSON.stringify({
      event: 'HELLO',
      payload: { dept_name: 'CCS', dept_secret: VALID_SECRET },
    }));
    await receiveMessage(ws);
    expect(manager.getNodeCount()).toBe(1);
    ws.close();
    await new Promise(r => setTimeout(r, 100));
    expect(manager.getNodeCount()).toBe(0);
  });
});
