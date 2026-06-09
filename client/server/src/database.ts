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
  const resolvedPath = dbPath ?? process.env.DB_PATH ?? path.join(path.resolve('data'), 'node.db');
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

/**
 * Insert or update a person. If the person already exists, do NOT overwrite
 * a valid (non-"[REDACTED]") mobile number with "[REDACTED]".
 */
export async function saveOrUpdatePerson(person: Person): Promise<void> {
  const existing = await getPersonById(person.id);

  if (!existing) {
    // Insert new person
    await db.run(
      `INSERT INTO persons (id, full_name, mobile, id_type, id_number)
       VALUES (?, ?, ?, ?, ?)`,
      [person.id, person.full_name, person.mobile, person.id_type ?? null, person.id_number ?? null]
    );
    return;
  }

  // Update existing person — guard against overwriting a valid mobile/id_type/id_number with "[REDACTED]"
  const mobile =
    person.mobile === '[REDACTED]' && existing.mobile !== '[REDACTED]'
      ? existing.mobile
      : person.mobile;

  const id_type =
    person.id_type === '[REDACTED]' && existing.id_type !== '[REDACTED]'
      ? existing.id_type
      : person.id_type;

  const id_number =
    person.id_number === '[REDACTED]' && existing.id_number !== '[REDACTED]'
      ? existing.id_number
      : person.id_number;

  await db.run(
    `UPDATE persons
        SET full_name = ?,
            mobile    = ?,
            id_type   = ?,
            id_number = ?
      WHERE id = ?`,
    [person.full_name, mobile, id_type ?? null, id_number ?? null, person.id]
  );
}

// ---------------------------------------------------------------------------
// Item CRUD
// ---------------------------------------------------------------------------

export async function createItem(item: Item): Promise<void> {
  await db.run(
    `INSERT INTO items (id, item_name, description, category, department_origin, status,
                        surrendered_by, synced, updated_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.item_name,
      item.description ?? null,
      item.category ?? null,
      item.department_origin,
      item.status,
      item.surrendered_by ?? null,
      item.synced,
      item.updated_at ?? new Date().toISOString(),
      item.created_at ?? new Date().toISOString(),
    ]
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

// ---------------------------------------------------------------------------
// Hub Incoming Handlers (LWW-based)
// ---------------------------------------------------------------------------

/**
 * Process an incoming item from the Hub (from SYNC_DUMP or ITEM_BROADCAST).
 * Saves the associated person first, then upserts the item using Last-Write-Wins
 * resolution based on updated_at. Sets synced = 1.
 *
 * The surrendered_by field may be a string (person ID) or a full Person object.
 * If it's a full Person object, we extract and save the person separately.
 */
export async function handleIncomingItem(payload: {
  id: string;
  item_name: string;
  description?: string | null;
  category?: string | null;
  department_origin: string;
  status: string;
  surrendered_by?: string | Person | null;
  claimed_by?: string | Person | null;
  claimed_at?: string | null;
  updated_at?: string;
  created_at?: string;
  person?: Person;
}): Promise<void> {
  // 1. Save the associated person first if provided
  //    Handle both explicit `person` field and `surrendered_by` as a Person object
  let surrendererPerson: Person | undefined = payload.person;

  if (!surrendererPerson && payload.surrendered_by && typeof payload.surrendered_by === 'object') {
    surrendererPerson = payload.surrendered_by as Person;
  }

  // Support flat fields from SYNC_DUMP (where surrendered_by is a string ID but flat fields are on payload)
  if (!surrendererPerson && payload.surrendered_by && typeof payload.surrendered_by === 'string' && (payload as any).surrenderer_full_name) {
    surrendererPerson = {
      id: payload.surrendered_by,
      full_name: (payload as any).surrenderer_full_name,
      mobile: (payload as any).surrenderer_mobile ?? '',
      id_type: (payload as any).surrenderer_id_type ?? undefined,
      id_number: (payload as any).surrenderer_id_number ?? undefined,
    };
  }

  if (surrendererPerson) {
    await saveOrUpdatePerson(surrendererPerson);
  }

  // Handle claimant person if provided as an object or flat fields from SYNC_DUMP
  let claimantPerson: Person | undefined;
  if (payload.claimed_by && typeof payload.claimed_by === 'object') {
    claimantPerson = payload.claimed_by as Person;
  } else if (payload.claimed_by && typeof payload.claimed_by === 'string' && (payload as any).claimant_full_name) {
    claimantPerson = {
      id: payload.claimed_by,
      full_name: (payload as any).claimant_full_name,
      mobile: (payload as any).claimant_mobile ?? '',
      id_type: (payload as any).claimant_id_type ?? undefined,
      id_number: (payload as any).claimant_id_number ?? undefined,
    };
  }

  if (claimantPerson) {
    await saveOrUpdatePerson(claimantPerson);
  }

  // Normalize surrendered_by to a string (person ID) for database storage
  const surrenderedById: string | null =
    payload.surrendered_by && typeof payload.surrendered_by === 'object'
      ? (payload.surrendered_by as Person).id
      : (payload.surrendered_by as string | null) ?? null;

  // Normalize claimed_by to a string (person ID) for database storage
  const claimedById: string | null =
    payload.claimed_by && typeof payload.claimed_by === 'object'
      ? (payload.claimed_by as Person).id
      : (payload.claimed_by as string | null) ?? null;

  // 2. Check if the item already exists (for LWW comparison)
  const existing = await getItemById(payload.id);

  const incomingUpdatedAt = payload.updated_at
    ? new Date(payload.updated_at).getTime()
    : 0;

  const existingUpdatedAt = existing?.updated_at
    ? new Date(existing.updated_at).getTime()
    : 0;

  // If existing data is newer, skip the update (LWW: newer wins)
  if (existing && incomingUpdatedAt <= existingUpdatedAt) {
    return;
  }

  // 3. Upsert the item with synced = 1
  if (existing) {
    await db.run(
      `UPDATE items
          SET item_name         = ?,
              description       = ?,
              category          = ?,
              department_origin = ?,
              status            = ?,
              surrendered_by    = ?,
              claimed_by        = ?,
              claimed_at        = ?,
              synced            = 1,
              updated_at        = ?
        WHERE id = ?`,
      [
        payload.item_name,
        payload.description ?? null,
        payload.category ?? null,
        payload.department_origin,
        payload.status,
        surrenderedById,
        claimedById,
        payload.claimed_at ?? null,
        payload.updated_at ?? new Date().toISOString(),
        payload.id,
      ]
    );
  } else {
    await db.run(
      `INSERT INTO items
        (id, item_name, description, category, department_origin, status,
         surrendered_by, claimed_by, claimed_at, synced, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        payload.id,
        payload.item_name,
        payload.description ?? null,
        payload.category ?? null,
        payload.department_origin,
        payload.status,
        surrenderedById,
        claimedById,
        payload.claimed_at ?? null,
        payload.updated_at ?? new Date().toISOString(),
        payload.created_at ?? new Date().toISOString(),
      ]
    );
  }
}

/**
 * Process an incoming status update from the Hub.
 * Updates the item's status, claimed_by, claimed_at, and updated_at using LWW.
 * Sets synced = 1.
 *
 * The claimed_by field may be a string (person ID) or a full Person object.
 * If it's a full Person object, we extract and save the person first.
 */
export async function handleIncomingStatusUpdate(payload: {
  id: string;
  status: string;
  claimed_by?: string | Person | null;
  updated_at?: string;
}): Promise<void> {
  // 1. Save the claimant person if provided as a full Person object or flat details
  let claimantPerson: Person | undefined;
  if (payload.claimed_by && typeof payload.claimed_by === 'object') {
    claimantPerson = payload.claimed_by as Person;
  } else if (payload.claimed_by && typeof payload.claimed_by === 'string' && (payload as any).claimant_full_name) {
    claimantPerson = {
      id: payload.claimed_by,
      full_name: (payload as any).claimant_full_name,
      mobile: (payload as any).claimant_mobile ?? '',
      id_type: (payload as any).claimant_id_type ?? undefined,
      id_number: (payload as any).claimant_id_number ?? undefined,
    };
  }

  if (claimantPerson) {
    await saveOrUpdatePerson(claimantPerson);
  }

  // Normalize claimed_by to a string (person ID) for database storage
  const claimedById: string | null =
    payload.claimed_by && typeof payload.claimed_by === 'object'
      ? (payload.claimed_by as Person).id
      : (payload.claimed_by as string | null) ?? null;

  // 2. Check if the item exists (for LWW comparison)
  const existing = await getItemById(payload.id);
  if (!existing) {
    // Item doesn't exist locally — status update has nothing to act on
    return;
  }

  const incomingUpdatedAt = payload.updated_at
    ? new Date(payload.updated_at).getTime()
    : 0;

  const existingUpdatedAt = existing.updated_at
    ? new Date(existing.updated_at).getTime()
    : 0;

  // If existing data is newer, skip the update (LWW: newer wins)
  if (incomingUpdatedAt <= existingUpdatedAt) {
    return;
  }

  // 3. Apply the status update
  const claimedAt = payload.status === 'claimed'
    ? (payload.updated_at ?? new Date().toISOString())
    : null;

  await db.run(
    `UPDATE items
        SET status      = ?,
            claimed_by  = ?,
            claimed_at  = ?,
            synced      = 1,
            updated_at  = ?
      WHERE id = ?`,
    [
      payload.status,
      claimedById,
      claimedAt,
      payload.updated_at ?? new Date().toISOString(),
      payload.id,
    ]
  );
}
