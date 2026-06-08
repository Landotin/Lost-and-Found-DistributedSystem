import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Type Definitions (mirrors server/src/database.ts)
// ---------------------------------------------------------------------------

export interface Person {
  id: string;
  full_name: string;
  mobile: string;
  id_type?: string;
  id_number?: string;
  created_at?: string;
}

export type ItemStatus = 'lost' | 'found' | 'claimed';

export interface Item {
  id: string;
  item_name: string;
  description?: string | null;
  category?: string | null;
  department_origin: string;
  status: ItemStatus;
  surrendered_by?: string | null;
  claimed_by?: string | null;
  claimed_at?: string | null;
  synced: number;       // 0 = pending sync, 1 = synced to hub
  updated_at?: string;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Database singleton
// ---------------------------------------------------------------------------

export let db: Database<sqlite3.Database, sqlite3.Statement>;

// ---------------------------------------------------------------------------
// Initialization — same schema as hub + synced flag
// ---------------------------------------------------------------------------

export async function initDatabase(
  dbPath?: string
): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
  const resolvedPath = dbPath ?? path.join(path.resolve('data'), 'node.db');
  const dataDir = path.dirname(resolvedPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const database = await open({
    filename: resolvedPath,
    driver: sqlite3.Database,
  });

  // Enable WAL mode for concurrent access
  await database.exec('PRAGMA journal_mode=WAL;');

  // Enforce foreign key constraints
  await database.exec('PRAGMA foreign_keys = ON;');

  // Create tables (same schema as hub — items includes synced flag)
  await database.exec(`
    CREATE TABLE IF NOT EXISTS persons (
      id          TEXT PRIMARY KEY,
      full_name   TEXT NOT NULL,
      mobile      TEXT NOT NULL,
      id_type     TEXT,
      id_number   TEXT,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await database.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id                  TEXT PRIMARY KEY,
      item_name           TEXT NOT NULL,
      description         TEXT,
      category            TEXT,
      department_origin   TEXT NOT NULL,
      status              TEXT CHECK(status IN ('lost','found','claimed')) NOT NULL,
      surrendered_by      TEXT REFERENCES persons(id),
      claimed_by          TEXT REFERENCES persons(id),
      claimed_at          TIMESTAMP,
      synced              BOOLEAN DEFAULT 0,
      updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db = database;
  return database;
}

// ---------------------------------------------------------------------------
// Person CRUD
// ---------------------------------------------------------------------------

export async function createPerson(person: Person): Promise<void> {
  await db.run(
    `INSERT INTO persons (id, full_name, mobile, id_type, id_number)
     VALUES (?, ?, ?, ?, ?)`,
    [person.id, person.full_name, person.mobile, person.id_type ?? null, person.id_number ?? null]
  );
}

export async function getPersonById(id: string): Promise<Person | undefined> {
  return db.get<Person>('SELECT * FROM persons WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Item CRUD
// ---------------------------------------------------------------------------

export async function createItem(item: Item): Promise<void> {
  await db.run(
    `INSERT INTO items (id, item_name, description, category, department_origin, status, surrendered_by, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [item.id, item.item_name, item.description ?? null, item.category ?? null,
     item.department_origin, item.status, item.surrendered_by ?? null, item.synced]
  );
}

export async function getAllItems(): Promise<Item[]> {
  return db.all<Item[]>('SELECT * FROM items ORDER BY created_at DESC');
}

export async function getItemById(id: string): Promise<Item | undefined> {
  return db.get<Item>('SELECT * FROM items WHERE id = ?', [id]);
}

export async function getPendingSyncItems(): Promise<Item[]> {
  return db.all<Item[]>('SELECT * FROM items WHERE synced = 0 ORDER BY created_at ASC');
}

export async function markItemSynced(id: string): Promise<void> {
  await db.run('UPDATE items SET synced = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
}

export async function updateItemStatus(
  id: string,
  status: ItemStatus,
  claimedBy?: string
): Promise<void> {
  const claimedAt = status === 'claimed' ? new Date().toISOString() : null;
  await db.run(
    `UPDATE items SET status = ?, claimed_by = ?, claimed_at = ?,
     synced = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, claimedBy ?? null, claimedAt, id]
  );
}
