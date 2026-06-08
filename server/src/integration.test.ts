import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { initDatabase, savePerson, saveItem, getSyncDumpForNode, db } from './database.js';
import { ConnectionManager, handleConnection } from './connection-manager.js';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DIR = path.resolve('data');
const TEST_DB_PATH = path.join(TEST_DIR, 'integration-test-hub.db');
const ADMIN_SECRET = 'integration-test-secret';

function cleanupDb() {
  try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ok */ }
  try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch { /* ok */ }
  try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch { /* ok */ }
}

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

function sendMessage(ws: WebSocket, event: string, payload: unknown): void {
  ws.send(JSON.stringify({ event, payload }));
}

function receiveMessage(ws: WebSocket, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Message timeout')), timeoutMs);
    ws.once('message', (data) => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(data.toString()));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

describe('Hub Integration Tests', () => {
  let httpServer: http.Server;
  let wss: WebSocketServer;
  let manager: ConnectionManager;
  let port: number;

  beforeAll(async () => {
    cleanupDb();
    await initDatabase(TEST_DB_PATH);

    port = await getPort();
    httpServer = http.createServer();
    wss = new WebSocketServer({ server: httpServer });
    manager = new ConnectionManager(wss, ADMIN_SECRET);
    await new Promise<void>((resolve) => httpServer.listen(port, resolve));
    handleConnection(wss, manager, ADMIN_SECRET);

    // Send SYNC_DUMP to newly registered node
    manager.on('registered', async ({ socketId, deptName, socket }: any) => {
      try {
        const items = await getSyncDumpForNode(deptName);
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            event: 'SYNC_DUMP',
            payload: { items },
          }));
        }
      } catch (err) {
        console.error('Failed to send SYNC_DUMP:', err);
      }
    });

    // Wire up event handling (simulating index.ts logic)
    manager.on('message', async ({ socketId, message }: any) => {
      if (message.event === 'ITEM_BROADCAST') {
        const payload = message.payload as any;
        try {
          if (payload.surrendered_by?.id) {
            await savePerson(payload.surrendered_by);
          }
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
          manager.broadcastToOthers(socketId, 'ITEM_BROADCAST', payload);
        } catch (err) {
          console.error('Failed to handle ITEM_BROADCAST:', err);
        }
      }

      if (message.event === 'STATUS_UPDATE') {
        const payload = message.payload as any;
        try {
          if (payload.claimed_by?.id) {
            await savePerson(payload.claimed_by);
          }
          const existingItem = await db.get<any>(
            'SELECT * FROM items WHERE id = ?',
            [payload.id]
          );
          if (existingItem) {
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
            manager.broadcastToOthers(
              socketId,
              'STATUS_UPDATE',
              payload,
              existingItem.department_origin
            );
          }
        } catch (err) {
          console.error('Failed to handle STATUS_UPDATE:', err);
        }
      }
    });
  });

  afterAll(async () => {
    wss.close();
    httpServer.close();
    if (db) await db.close().catch(() => {});
    cleanupDb();
  });

  it(
    'SYNC_DUMP sending: receives item data after HELLO',
    async () => {
      // Pre-populate the database with an item
      await savePerson({
        id: 'int-person-1',
        full_name: 'Integration Surrenderer',
        mobile: '09170000999',
        id_type: 'SSS',
        id_number: 'SSS-999',
      });
      await saveItem({
        id: 'int-item-1',
        item_name: 'Integration Item',
        description: 'Test item for sync',
        department_origin: 'CCS',
        status: 'lost',
        surrendered_by: 'int-person-1',
      });

      const ws = await createClient(port);
      sendMessage(ws, 'HELLO', { dept_name: 'CCS', dept_secret: ADMIN_SECRET });

      // Collect all response messages until we get SYNC_DUMP
      const messages: any[] = [];
      const collectUntilSyncDump = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout waiting for SYNC_DUMP')), 8000);
        ws.on('message', (data) => {
          try {
            const parsed = JSON.parse(data.toString());
            messages.push(parsed);
            if (parsed.event === 'SYNC_DUMP') {
              clearTimeout(timer);
              resolve();
            }
          } catch { /* ignore */ }
        });
      });

      await collectUntilSyncDump;

      const helloReply = messages.find((m) => m.event === 'HELLO');
      const syncDump = messages.find((m) => m.event === 'SYNC_DUMP');

      expect(helloReply).toBeDefined();
      expect(helloReply.payload.accepted).toBe(true);

      expect(syncDump).toBeDefined();
      expect(syncDump.payload.items).toBeDefined();
      expect(Array.isArray(syncDump.payload.items)).toBe(true);

      const ourItem = syncDump.payload.items.find((i: any) => i.id === 'int-item-1');
      expect(ourItem).toBeDefined();
      expect(ourItem.item_name).toBe('Integration Item');

      ws.close();
    },
    15000,
  );

  it(
    'SYNC_DUMP: PII is redacted for items from other departments',
    async () => {
      // Add an item from COE
      await saveItem({
        id: 'int-item-coe',
        item_name: 'COE Item',
        department_origin: 'COE',
        status: 'found',
        surrendered_by: 'int-person-1',
      });

      const ws = await createClient(port);
      sendMessage(ws, 'HELLO', { dept_name: 'CCS', dept_secret: ADMIN_SECRET });

      const messages: any[] = [];
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout')), 8000);
        ws.on('message', (data) => {
          try {
            const parsed = JSON.parse(data.toString());
            messages.push(parsed);
            if (parsed.event === 'SYNC_DUMP') {
              clearTimeout(timer);
              resolve();
            }
          } catch { /* ignore */ }
        });
      });

      const syncDump = messages.find((m) => m.event === 'SYNC_DUMP');

      const coeItem = syncDump.payload.items.find((i: any) => i.id === 'int-item-coe');
      expect(coeItem).toBeDefined();
      expect(coeItem.surrenderer_mobile).toBe('[REDACTED]');
      expect(coeItem.surrenderer_id_type).toBe('[REDACTED]');
      expect(coeItem.surrenderer_id_number).toBe('[REDACTED]');

      // CCS item should still have PII
      const ccsItem = syncDump.payload.items.find((i: any) => i.id === 'int-item-1');
      expect(ccsItem.surrenderer_mobile).toBe('09170000999');

      ws.close();
    },
    15000,
  );

  it(
    'ITEM_BROADCAST: broadcasts item to other connected nodes',
    async () => {
      const ws1 = await createClient(port);
      sendMessage(ws1, 'HELLO', { dept_name: 'CCS', dept_secret: ADMIN_SECRET });
      // Wait for HELLO + NODE_LIST + SYNC_DUMP
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout ws1 setup')), 8000);
        let count = 0;
        ws1.on('message', () => {
          count++;
          if (count >= 3) {
            clearTimeout(timer);
            resolve();
          }
        });
      });

      const ws2 = await createClient(port);
      sendMessage(ws2, 'HELLO', { dept_name: 'COE', dept_secret: ADMIN_SECRET });
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout ws2 setup')), 8000);
        let count = 0;
        ws2.on('message', () => {
          count++;
          if (count >= 3) {
            clearTimeout(timer);
            resolve();
          }
        });
      });

      // ws1 broadcasts an item — ws2 should receive it
      const ws2MessagePromise = new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout broadcast')), 5000);
        ws2.on('message', (data) => {
          clearTimeout(timer);
          try {
            resolve(JSON.parse(data.toString()));
          } catch {
            reject(new Error('Invalid JSON'));
          }
        });
      });

      sendMessage(ws1, 'ITEM_BROADCAST', {
        id: 'int-broadcast-1',
        item_name: 'Broadcast Item',
        department_origin: 'CCS',
        status: 'lost',
      });

      const ws2Msg = await ws2MessagePromise;
      expect(ws2Msg.event).toBe('ITEM_BROADCAST');
      expect(ws2Msg.payload.item_name).toBe('Broadcast Item');

      ws1.close();
      ws2.close();
    },
    30000,
  );

  it(
    'ITEM_BROADCAST: saves item to database',
    async () => {
      const ws = await createClient(port);
      sendMessage(ws, 'HELLO', { dept_name: 'COE', dept_secret: ADMIN_SECRET });
      // Wait for setup messages
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout ws setup')), 8000);
        let count = 0;
        ws.on('message', () => {
          count++;
          if (count >= 3) {
            clearTimeout(timer);
            resolve();
          }
        });
      });

      sendMessage(ws, 'ITEM_BROADCAST', {
        id: 'int-save-check-1',
        item_name: 'Save Check Item',
        department_origin: 'COE',
        status: 'found',
      });

      // Give it a moment to process
      await new Promise((r) => setTimeout(r, 500));

      const row = await db.get('SELECT * FROM items WHERE id = ?', 'int-save-check-1');
      expect(row).toBeDefined();
      expect(row!.item_name).toBe('Save Check Item');

      ws.close();
    },
    15000,
  );

  it(
    'ITEM_BROADCAST: PII is redacted for unrelated department nodes',
    async () => {
      const ws1 = await createClient(port);
      sendMessage(ws1, 'HELLO', { dept_name: 'CCS', dept_secret: ADMIN_SECRET });
      // Wait for setup
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout ws1 setup')), 8000);
        let count = 0;
        ws1.on('message', () => {
          count++;
          if (count >= 3) {
            clearTimeout(timer);
            resolve();
          }
        });
      });

      const ws2 = await createClient(port);
      sendMessage(ws2, 'HELLO', { dept_name: 'COE', dept_secret: ADMIN_SECRET });
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout ws2 setup')), 8000);
        let count = 0;
        ws2.on('message', () => {
          count++;
          if (count >= 3) {
            clearTimeout(timer);
            resolve();
          }
        });
      });

      const ws2MessagePromise = new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout broadcast')), 5000);
        ws2.on('message', (data) => {
          clearTimeout(timer);
          try {
            resolve(JSON.parse(data.toString()));
          } catch {
            reject(new Error('Invalid JSON'));
          }
        });
      });

      // ws1 (CCS) broadcasts item with full surrenderer details
      sendMessage(ws1, 'ITEM_BROADCAST', {
        id: 'int-broadcast-pii-1',
        item_name: 'PII Item',
        department_origin: 'CCS',
        status: 'found',
        surrendered_by: {
          id: 'int-person-pii',
          full_name: 'Secret Person',
          mobile: '0917-PII-SEC',
          id_type: 'Passport',
          id_number: 'PP12345',
        },
      });

      const ws2Msg = await ws2MessagePromise;
      expect(ws2Msg.event).toBe('ITEM_BROADCAST');
      // ws2 is COE (unrelated to CCS), so PII must be redacted
      expect(ws2Msg.payload.surrendered_by.mobile).toBe('[REDACTED]');
      expect(ws2Msg.payload.surrendered_by.id_type).toBe('[REDACTED]');
      expect(ws2Msg.payload.surrendered_by.id_number).toBe('[REDACTED]');
      expect(ws2Msg.payload.surrendered_by.full_name).toBe('Secret Person');

      ws1.close();
      ws2.close();
    },
    30000,
  );

  it(
    'STATUS_UPDATE: PII is redacted for unrelated department nodes',
    async () => {
      // First save an item under CCS department
      await saveItem({
        id: 'int-status-pii-item',
        item_name: 'Status PII Item',
        department_origin: 'CCS',
        status: 'found',
      });

      const ws1 = await createClient(port);
      sendMessage(ws1, 'HELLO', { dept_name: 'CCS', dept_secret: ADMIN_SECRET });
      await new Promise<void>((r) => setTimeout(r, 500)); // let it settle

      const ws2 = await createClient(port);
      sendMessage(ws2, 'HELLO', { dept_name: 'COE', dept_secret: ADMIN_SECRET });
      await new Promise<void>((r) => setTimeout(r, 500)); // let it settle

      const ws2MessagePromise = new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout broadcast')), 5000);
        ws2.on('message', (data) => {
          try {
            const parsed = JSON.parse(data.toString());
            if (parsed.event === 'STATUS_UPDATE') {
              clearTimeout(timer);
              resolve(parsed);
            }
          } catch { /* ignore */ }
        });
      });

      // ws1 (CCS) sends status update with full claimant details
      sendMessage(ws1, 'STATUS_UPDATE', {
        id: 'int-status-pii-item',
        status: 'claimed',
        claimed_by: {
          id: 'int-claimant-pii',
          full_name: 'Claimant Person',
          mobile: '0917-CLAIM-SEC',
          id_type: 'SSS',
          id_number: 'SSS-888',
        },
      });

      const ws2Msg = await ws2MessagePromise;
      expect(ws2Msg.event).toBe('STATUS_UPDATE');
      // ws2 is COE (unrelated to CCS), so PII must be redacted
      expect(ws2Msg.payload.claimed_by.mobile).toBe('[REDACTED]');
      expect(ws2Msg.payload.claimed_by.id_type).toBe('[REDACTED]');
      expect(ws2Msg.payload.claimed_by.id_number).toBe('[REDACTED]');

      ws1.close();
      ws2.close();
    },
    30000,
  );
});
