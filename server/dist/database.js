import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';
// ---------------------------------------------------------------------------
// Database singleton
// ---------------------------------------------------------------------------
export let db;
// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------
export async function initDatabase(dbPath) {
    const resolvedPath = dbPath ?? path.join(path.resolve('data'), 'hub.db');
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
