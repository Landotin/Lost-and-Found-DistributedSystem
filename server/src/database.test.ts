import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDatabase, type Person, type Item } from './database.js';
import fs from 'node:fs';
import path from 'node:path';
import type { Database } from 'sqlite';

const TEST_DIR = path.resolve('data');
const TEST_DB_PATH = path.join(TEST_DIR, 'test-hub.db');

function cleanup() {
  try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ok */ }
  try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch { /* ok */ }
  try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch { /* ok */ }
}

describe('Database Module', () => {
  let db: Database;

  beforeAll(async () => {
    cleanup();
    db = await initDatabase(TEST_DB_PATH);
  });

  afterAll(async () => {
    await db.close();
    cleanup();
  });

  it('creates the database file on first run', () => {
    expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
  });

  it('creates the persons table with correct columns', async () => {
    const columns = await db.all<{ name: string; type: string }[]>(
      "SELECT name, type FROM pragma_table_info('persons') ORDER BY cid"
    );
    const colMap = Object.fromEntries(columns.map(c => [c.name, c.type]));
    expect(colMap.id).toBeDefined();
    expect(colMap.full_name).toBeDefined();
    expect(colMap.mobile).toBeDefined();
    expect(colMap.id_type).toBeDefined();
    expect(colMap.id_number).toBeDefined();
    expect(colMap.created_at).toBeDefined();
  });

  it('creates the items table with correct columns', async () => {
    const columns = await db.all<{ name: string; type: string }[]>(
      "SELECT name, type FROM pragma_table_info('items') ORDER BY cid"
    );
    const colMap = Object.fromEntries(columns.map(c => [c.name, c.type]));
    expect(colMap.id).toBeDefined();
    expect(colMap.item_name).toBeDefined();
    expect(colMap.description).toBeDefined();
    expect(colMap.category).toBeDefined();
    expect(colMap.department_origin).toBeDefined();
    expect(colMap.status).toBeDefined();
    expect(colMap.surrendered_by).toBeDefined();
    expect(colMap.claimed_by).toBeDefined();
    expect(colMap.claimed_at).toBeDefined();
    expect(colMap.synced).toBeDefined();
    expect(colMap.updated_at).toBeDefined();
    expect(colMap.created_at).toBeDefined();
  });

  it('sets journal_mode to wal', async () => {
    const row = await db.get<{ journal_mode: string }>('PRAGMA journal_mode');
    expect(row?.journal_mode).toBe('wal');
  });

  it('is idempotent when called twice', async () => {
    await expect(initDatabase(TEST_DB_PATH)).resolves.toBeDefined();
  });

  it('rejects invalid status values via CHECK constraint', async () => {
    await expect(
      db.run(
        `INSERT INTO items (id, item_name, description, category, department_origin, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        'test-id-check', 'Test Item', null, null, 'TestDept', 'deleted'
      )
    ).rejects.toThrow();
  });

  it('enforces foreign key constraints on surrendered_by', async () => {
    // Insert with a non-existent person reference — must be rejected
    await expect(
      db.run(
        `INSERT INTO items (id, item_name, description, category, department_origin, status, surrendered_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        'test-fk-1', 'Test FK Item', null, null, 'TestDept', 'found', 'nonexistent-person-id'
      )
    ).rejects.toThrow();
  });
});

describe('savePerson', () => {
  let db: Database;

  beforeAll(async () => {
    db = await initDatabase(TEST_DB_PATH);
  });

  afterAll(async () => {
    await db.close();
    cleanup();
  });

  it('inserts a new person', async () => {
    const { savePerson } = await import('./database.js');
    const person: Person = {
      id: 'saveperson-test-1',
      full_name: 'Alice',
      mobile: '09170000001',
      id_type: 'SSS',
      id_number: 'SSS-001',
    };
    await savePerson(person);

    const row = await db.get('SELECT * FROM persons WHERE id = ?', 'saveperson-test-1');
    expect(row).toBeDefined();
    expect(row!.full_name).toBe('Alice');
    expect(row!.mobile).toBe('09170000001');
  });

  it('ignores duplicate id (INSERT OR IGNORE)', async () => {
    const { savePerson } = await import('./database.js');
    const person: Person = {
      id: 'saveperson-test-dup',
      full_name: 'Bob',
      mobile: '09170000002',
    };
    await savePerson(person);

    // Attempt to insert same id again with different name
    const duplicate: Person = {
      id: 'saveperson-test-dup',
      full_name: 'Bob Updated',
      mobile: '09170000003',
    };
    await savePerson(duplicate);

    const row = await db.get('SELECT * FROM persons WHERE id = ?', 'saveperson-test-dup');
    expect(row).toBeDefined();
    // Should still be the original (INSERT OR IGNORE)
    expect(row!.full_name).toBe('Bob');
    expect(row!.mobile).toBe('09170000002');
  });
});

describe('saveItem', () => {
  let db: Database;

  beforeAll(async () => {
    db = await initDatabase(TEST_DB_PATH);
    // Insert a person for FK references
    await db.run(
      "INSERT INTO persons (id, full_name, mobile) VALUES ('saveitem-person', 'Charlie', '09170000010')"
    );
  });

  afterAll(async () => {
    await db.close();
    cleanup();
  });

  it('inserts a new item', async () => {
    const { saveItem } = await import('./database.js');
    const item: Item = {
      id: 'saveitem-test-1',
      item_name: 'Laptop',
      description: 'Dell XPS',
      category: 'Electronics',
      department_origin: 'CCS',
      status: 'found',
    };
    await saveItem(item);

    const row = await db.get('SELECT * FROM items WHERE id = ?', 'saveitem-test-1');
    expect(row).toBeDefined();
    expect(row!.item_name).toBe('Laptop');
    expect(row!.department_origin).toBe('CCS');
  });

  it('updates item when incoming updated_at is newer', async () => {
    const { saveItem } = await import('./database.js');
    const itemId = 'saveitem-lww-newer';

    // Insert first version
    await saveItem({
      id: itemId,
      item_name: 'Phone',
      description: 'Old description',
      department_origin: 'CCS',
      status: 'lost',
      updated_at: '2025-01-01T00:00:00Z',
    });

    // Update with newer timestamp
    await saveItem({
      id: itemId,
      item_name: 'Phone',
      description: 'Updated description',
      department_origin: 'CCS',
      status: 'found',
      updated_at: '2025-06-01T00:00:00Z',
    });

    const row = await db.get('SELECT * FROM items WHERE id = ?', itemId);
    expect(row!.description).toBe('Updated description');
    expect(row!.status).toBe('found');
  });

  it('does NOT update item when incoming updated_at is older (LWW)', async () => {
    const { saveItem } = await import('./database.js');
    const itemId = 'saveitem-lww-older';

    // Insert first version with newer timestamp
    await saveItem({
      id: itemId,
      item_name: 'Tablet',
      description: 'Original description',
      department_origin: 'COE',
      status: 'lost',
      updated_at: '2025-06-01T00:00:00Z',
    });

    // Try to update with older timestamp
    await saveItem({
      id: itemId,
      item_name: 'Tablet',
      description: 'Stale update',
      department_origin: 'COE',
      status: 'claimed',
      updated_at: '2025-01-01T00:00:00Z',
    });

    const row = await db.get('SELECT * FROM items WHERE id = ?', itemId);
    // Should retain the original (newer timestamp)
    expect(row!.description).toBe('Original description');
    expect(row!.status).toBe('lost');
  });

  it('uses created_at as fallback when updated_at is missing', async () => {
    const { saveItem } = await import('./database.js');
    const itemId = 'saveitem-fallback';

    // Insert without updated_at
    await saveItem({
      id: itemId,
      item_name: 'Monitor',
      department_origin: 'COE',
      status: 'found',
      created_at: '2025-06-01T00:00:00Z',
    });

    // Try to update with older created_at (and no updated_at)
    await saveItem({
      id: itemId,
      item_name: 'Monitor Updated',
      department_origin: 'COE',
      status: 'claimed',
      created_at: '2025-01-01T00:00:00Z',
    });

    const row = await db.get('SELECT * FROM items WHERE id = ?', itemId);
    expect(row!.item_name).toBe('Monitor'); // original wins
  });

  it('inserts item with surrendered_by reference', async () => {
    const { saveItem } = await import('./database.js');
    const item: Item = {
      id: 'saveitem-with-surrenderer',
      item_name: 'Wallet',
      department_origin: 'CCS',
      status: 'found',
      surrendered_by: 'saveitem-person',
    };
    await saveItem(item);

    const row = await db.get('SELECT * FROM items WHERE id = ?', 'saveitem-with-surrenderer');
    expect(row!.surrendered_by).toBe('saveitem-person');
  });
});

describe('getSyncDumpForNode', () => {
  let db: Database;

  beforeAll(async () => {
    db = await initDatabase(TEST_DB_PATH);
    // Insert test persons
    await db.run(
      "INSERT OR IGNORE INTO persons (id, full_name, mobile, id_type, id_number) VALUES ('sync-person-1', 'Surrenderer One', '09170000100', 'SSS', 'SSS-100')"
    );
    await db.run(
      "INSERT OR IGNORE INTO persons (id, full_name, mobile, id_type, id_number) VALUES ('sync-person-2', 'Claimant Two', '09170000200', 'UMID', 'UMID-200')"
    );
    // Insert items from different departments
    await db.run(
      `INSERT OR REPLACE INTO items (id, item_name, department_origin, status, surrendered_by, claimed_by)
       VALUES ('sync-item-1', 'Item from CCS', 'CCS', 'lost', 'sync-person-1', NULL)`
    );
    await db.run(
      `INSERT OR REPLACE INTO items (id, item_name, department_origin, status, surrendered_by, claimed_by)
       VALUES ('sync-item-2', 'Item from COE', 'COE', 'found', 'sync-person-1', 'sync-person-2')`
    );
  });

  afterAll(async () => {
    await db.close();
    cleanup();
  });

  it('returns all items for the requesting department with full PII', async () => {
    const { getSyncDumpForNode } = await import('./database.js');
    const dump = await getSyncDumpForNode('CCS');

    const ccsItem = dump.find((i: any) => i.id === 'sync-item-1');
    expect(ccsItem).toBeDefined();
    expect(ccsItem.item_name).toBe('Item from CCS');

    // PII should NOT be redacted for CCS-originated item
    expect(ccsItem.surrenderer_mobile).toBe('09170000100');
    expect(ccsItem.surrenderer_id_type).toBe('SSS');
    expect(ccsItem.surrenderer_id_number).toBe('SSS-100');
  });

  it('redacts PII for items from other departments', async () => {
    const { getSyncDumpForNode } = await import('./database.js');
    const dump = await getSyncDumpForNode('CCS');

    const coeItem = dump.find((i: any) => i.id === 'sync-item-2');
    expect(coeItem).toBeDefined();

    // PII should be redacted since item originates from COE, not CCS
    expect(coeItem.surrenderer_mobile).toBe('[REDACTED]');
    expect(coeItem.surrenderer_id_type).toBe('[REDACTED]');
    expect(coeItem.surrenderer_id_number).toBe('[REDACTED]');
    expect(coeItem.claimant_mobile).toBe('[REDACTED]');
    expect(coeItem.claimant_id_type).toBe('[REDACTED]');
    expect(coeItem.claimant_id_number).toBe('[REDACTED]');
  });

  it('includes item details regardless of redaction status', async () => {
    const { getSyncDumpForNode } = await import('./database.js');
    const dump = await getSyncDumpForNode('CCS');

    expect(dump.length).toBeGreaterThanOrEqual(2);
    const itemNames = dump.map((i: any) => i.item_name);
    expect(itemNames).toContain('Item from CCS');
    expect(itemNames).toContain('Item from COE');
  });
});
