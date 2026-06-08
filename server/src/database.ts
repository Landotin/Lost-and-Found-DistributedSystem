import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Type Definitions
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
  description?: string;
  category?: string;
  department_origin: string;
  status: ItemStatus;
  surrendered_by?: string;
  claimed_by?: string;
  claimed_at?: string;
  synced?: number;
  updated_at?: string;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Database singleton
// ---------------------------------------------------------------------------

export let db: Database<sqlite3.Database, sqlite3.Statement>;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export async function initDatabase(
  dbPath?: string
): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
  const resolvedPath = dbPath ?? path.join(path.resolve('data'), 'hub.db');
  const dataDir = path.dirname(resolvedPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const database = await open({
    filename: resolvedPath,
    driver: sqlite3.Database,
  });

  // Enable WAL mode
  await database.exec('PRAGMA journal_mode=WAL;');

  // Create tables
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
