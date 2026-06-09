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

// ---------------------------------------------------------------------------
// savePerson – Insert or ignore the person into the persons table
// ---------------------------------------------------------------------------

export async function savePerson(person: Person): Promise<void> {
  await db.run(
    `INSERT OR IGNORE INTO persons (id, full_name, mobile, id_type, id_number, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    person.id,
    person.full_name,
    person.mobile ?? null,
    person.id_type ?? null,
    person.id_number ?? null,
    person.created_at ?? new Date().toISOString(),
  );
}

// ---------------------------------------------------------------------------
// saveItem – Upsert with LWW (last-writer-wins) conflict resolution
// ---------------------------------------------------------------------------

export async function saveItem(item: Item): Promise<void> {
  // First check if the item already exists
  const existing = await db.get<{ updated_at: string; created_at: string }>(
    'SELECT updated_at, created_at FROM items WHERE id = ?',
    item.id,
  );

  if (existing) {
    // Determine timestamps for LWW comparison
    const incomingTs = item.updated_at ?? item.created_at ?? '';
    const existingTs = existing.updated_at ?? existing.created_at ?? '';

    // Only update if incoming timestamp is strictly newer
    if (incomingTs > existingTs) {
      await db.run(
        `UPDATE items SET
           item_name = ?,
           description = ?,
           category = ?,
           department_origin = ?,
           status = ?,
           surrendered_by = ?,
           claimed_by = ?,
           claimed_at = ?,
           synced = ?,
           updated_at = ?,
           created_at = ?
         WHERE id = ?`,
        item.item_name,
        item.description ?? null,
        item.category ?? null,
        item.department_origin,
        item.status,
        item.surrendered_by ?? null,
        item.claimed_by ?? null,
        item.claimed_at ?? null,
        item.synced ?? null,
        item.updated_at ?? new Date().toISOString(),
        item.created_at ?? null,
        item.id,
      );
    }
    // If incoming is older or equal, do nothing (existing wins)
  } else {
    // Insert new item
    await db.run(
      `INSERT INTO items (id, item_name, description, category, department_origin, status, surrendered_by, claimed_by, claimed_at, synced, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.id,
      item.item_name,
      item.description ?? null,
      item.category ?? null,
      item.department_origin,
      item.status,
      item.surrendered_by ?? null,
      item.claimed_by ?? null,
      item.claimed_at ?? null,
      item.synced ?? null,
      item.updated_at ?? new Date().toISOString(),
      item.created_at ?? new Date().toISOString(),
    );
  }
}

// ---------------------------------------------------------------------------
// SyncDumpItem – Shape returned by getSyncDumpForNode
// ---------------------------------------------------------------------------

export interface SyncDumpItem {
  id: string;
  item_name: string;
  description: string | null;
  category: string | null;
  department_origin: string;
  status: string;
  surrendered_by: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  synced: number | null;
  updated_at: string | null;
  created_at: string | null;
  // Surrenderer details
  surrenderer_full_name: string | null;
  surrenderer_mobile: string | null;
  surrenderer_id_type: string | null;
  surrenderer_id_number: string | null;
  // Claimant details
  claimant_full_name: string | null;
  claimant_mobile: string | null;
  claimant_id_type: string | null;
  claimant_id_number: string | null;
}

// ---------------------------------------------------------------------------
// getSyncDumpForNode – Fetch all items with person details, redacting PII
// ---------------------------------------------------------------------------

export async function getSyncDumpForNode(deptName: string): Promise<SyncDumpItem[]> {
  const rows = await db.all<SyncDumpItem[]>(
    `SELECT
       i.id,
       i.item_name,
       i.description,
       i.category,
       i.department_origin,
       i.status,
       i.surrendered_by,
       i.claimed_by,
       i.claimed_at,
       i.synced,
       i.updated_at,
       i.created_at,
       s.full_name AS surrenderer_full_name,
       s.mobile     AS surrenderer_mobile,
       s.id_type    AS surrenderer_id_type,
       s.id_number  AS surrenderer_id_number,
       c.full_name  AS claimant_full_name,
       c.mobile     AS claimant_mobile,
       c.id_type    AS claimant_id_type,
       c.id_number  AS claimant_id_number
     FROM items i
     LEFT JOIN persons s ON s.id = i.surrendered_by
     LEFT JOIN persons c ON c.id = i.claimed_by
     ORDER BY i.created_at ASC`,
  );

  // Redact PII for items that don't originate from the requesting department
  for (const row of rows) {
    if (row.department_origin !== deptName) {
      row.surrenderer_mobile = '[REDACTED]';
      row.surrenderer_id_type = '[REDACTED]';
      row.surrenderer_id_number = '[REDACTED]';
      row.claimant_mobile = '[REDACTED]';
      row.claimant_id_type = '[REDACTED]';
      row.claimant_id_number = '[REDACTED]';
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// getAllItemsWithPII – Fetch all items with full (unredacted) person details.
// Used by the admin REST API for complete visibility.
// ---------------------------------------------------------------------------

export async function getAllItemsWithPII(): Promise<any[]> {
  const rows = await db.all(
    `SELECT
       i.*,
       s.full_name AS surrenderer_full_name,
       s.mobile    AS surrenderer_mobile,
       s.id_type   AS surrenderer_id_type,
       s.id_number AS surrenderer_id_number,
       c.full_name AS claimant_full_name,
       c.mobile    AS claimant_mobile,
       c.id_type   AS claimant_id_type,
       c.id_number AS claimant_id_number
     FROM items i
     LEFT JOIN persons s ON s.id = i.surrendered_by
     LEFT JOIN persons c ON c.id = i.claimed_by
     ORDER BY i.created_at ASC`
  );
  return rows;
}

// ---------------------------------------------------------------------------
// getAnalytics – Aggregated stats for the admin dashboard.
// Returns items-by-department counts, claim rate, and total item count.
// ---------------------------------------------------------------------------

export interface AnalyticsResult {
  itemsByDepartment: Record<string, number>;
  claimRate: number;
  totalItems: number;
  totalFound: number;
  totalClaimed: number;
  totalLost: number;
}

export async function getAnalytics(): Promise<AnalyticsResult> {
  const totalRow = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM items');
  const totalItems = totalRow?.count ?? 0;

  const itemsByDept = await db.all<{ department_origin: string; count: number }[]>(
    'SELECT department_origin, COUNT(*) as count FROM items GROUP BY department_origin ORDER BY department_origin ASC'
  );

  const itemsByDepartment: Record<string, number> = {};
  for (const row of itemsByDept) {
    itemsByDepartment[row.department_origin] = row.count;
  }

  const lostRow = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM items WHERE status = 'lost'");
  const foundRow = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM items WHERE status = 'found'");
  const claimedRow = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM items WHERE status = 'claimed'");

  const totalLost = lostRow?.count ?? 0;
  const totalFound = foundRow?.count ?? 0;
  const totalClaimed = claimedRow?.count ?? 0;
  const denominator = totalFound + totalClaimed;
  const claimRate = denominator > 0 ? totalClaimed / denominator : 0;

  return { itemsByDepartment, claimRate, totalItems, totalFound, totalClaimed, totalLost };
}
