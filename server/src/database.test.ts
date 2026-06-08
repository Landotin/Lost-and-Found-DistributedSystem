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
