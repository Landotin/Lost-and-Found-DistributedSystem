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
  reported_by?: string | null;
  claimed_at?: string | null;
  synced: number;       // 0 = pending sync, 1 = synced to hub
  updated_at?: string;
  created_at?: string;
  image_data?: string | null;
  surrenderedByPerson?: Person | null;
  claimedByPerson?: Person | null;
  reportedByPerson?: Person | null;
}

// ---------------------------------------------------------------------------
// Mobile Number Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a Philippine mobile number to E.164 format (+639XXXXXXXXX).
 * Handles common prefixes:
 *   - "09171234567" (11 digits, starts with 09) → "+639171234567"
 *   - "639171234567" (12 digits, no +)         → "+639171234567"
 *   - "+639171234567" (already E.164)           → unchanged
 * Falls back to the original string if it doesn't match any known pattern.
 */
export function normalizeMobile(mobile: string): string {
  // Strip non-digit characters (keep + sign)
  const cleaned = mobile.replace(/[^\d+]/g, '');

  // Starts with "09" and is 11 digits → convert to +639
  if (/^09\d{9}$/.test(cleaned)) {
    return `+639${cleaned.slice(2)}`;
  }

  // Starts with "639" and is 12 digits (no +) → add +
  if (/^639\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // Already E.164 +639...
  if (/^\+639\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  // Unknown format — pass through as-is
  return mobile;
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
      reported_by         TEXT REFERENCES persons(id),
      claimed_at          TIMESTAMP,
      synced              BOOLEAN DEFAULT 0,
      updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      image_data          TEXT
    );
  `);

  // Migration: add columns that may not exist in older databases
  const tableInfo = await database.all<Array<{ name: string }>>('PRAGMA table_info(items)');
  const existingColumns = tableInfo.map(c => c.name);

  if (!existingColumns.includes('reported_by')) {
    await database.exec('ALTER TABLE items ADD COLUMN reported_by TEXT REFERENCES persons(id);');
  }
  if (!existingColumns.includes('image_data')) {
    await database.exec('ALTER TABLE items ADD COLUMN image_data TEXT;');
  }

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

  // Update existing person — guard against overwriting a valid mobile/id_type/id_number with "[REDACTED]" or empty values
  const mobile =
    (!person.mobile || person.mobile === '[REDACTED]') && existing.mobile
      ? existing.mobile
      : person.mobile;

  const id_type =
    (!person.id_type || person.id_type === '[REDACTED]') && existing.id_type
      ? existing.id_type
      : person.id_type;

  const id_number =
    (!person.id_number || person.id_number === '[REDACTED]') && existing.id_number
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
                        surrendered_by, claimed_by, reported_by, synced, updated_at, created_at, image_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.item_name,
      item.description ?? null,
      item.category ?? null,
      item.department_origin,
      item.status,
      item.surrendered_by ?? null,
      item.claimed_by ?? null,
      item.reported_by ?? null,
      item.synced,
      item.updated_at ?? new Date().toISOString(),
      item.created_at ?? new Date().toISOString(),
      item.image_data ?? null,
    ]
  );
}

export async function getAllItems(): Promise<Item[]> {
  const rows = await db.all<any[]>(`
    SELECT
      i.*,
      s.full_name AS s_full_name,
      s.mobile AS s_mobile,
      s.id_type AS s_id_type,
      s.id_number AS s_id_number,
      c.full_name AS c_full_name,
      c.mobile AS c_mobile,
      c.id_type AS c_id_type,
      c.id_number AS c_id_number,
      r.full_name AS r_full_name,
      r.mobile AS r_mobile,
      r.id_type AS r_id_type,
      r.id_number AS r_id_number
    FROM items i
    LEFT JOIN persons s ON i.surrendered_by = s.id
    LEFT JOIN persons c ON i.claimed_by = c.id
    LEFT JOIN persons r ON i.reported_by = r.id
    ORDER BY i.created_at DESC
  `);

  return rows.map((row) => {
    const item: Item = {
      id: row.id,
      item_name: row.item_name,
      description: row.description,
      category: row.category,
      department_origin: row.department_origin,
      status: row.status,
      surrendered_by: row.surrendered_by,
      claimed_by: row.claimed_by,
      reported_by: row.reported_by,
      claimed_at: row.claimed_at,
      synced: row.synced,
      updated_at: row.updated_at,
      created_at: row.created_at,
      image_data: row.image_data ?? null,
    };

    if (row.surrendered_by) {
      item.surrenderedByPerson = {
        id: row.surrendered_by,
        full_name: row.s_full_name,
        mobile: row.s_mobile,
        id_type: row.s_id_type ?? undefined,
        id_number: row.s_id_number ?? undefined,
      };
    } else {
      item.surrenderedByPerson = null;
    }

    if (row.claimed_by) {
      item.claimedByPerson = {
        id: row.claimed_by,
        full_name: row.c_full_name,
        mobile: row.c_mobile,
        id_type: row.c_id_type ?? undefined,
        id_number: row.c_id_number ?? undefined,
      };
    } else {
      item.claimedByPerson = null;
    }

    if (row.reported_by) {
      item.reportedByPerson = {
        id: row.reported_by,
        full_name: row.r_full_name,
        mobile: row.r_mobile,
        id_type: row.r_id_type ?? undefined,
        id_number: row.r_id_number ?? undefined,
      };
    } else {
      item.reportedByPerson = null;
    }

    return item;
  });
}

export async function getItemById(id: string): Promise<Item | undefined> {
  return db.get<Item>('SELECT * FROM items WHERE id = ?', [id]);
}

/**
 * Find items with the opposite status that match the given query string.
 * Uses SQL LIKE for case-insensitive fuzzy matching on item_name.
 * Returns items with joined surrenderer and claimant person data.
 *
 * @param q - Search query (min 2 chars for meaningful results)
 * @param oppositeStatus - The status to search for (e.g., 'lost' when user is logging 'found')
 */
export async function findMatchingItems(
  q: string,
  oppositeStatus: ItemStatus
): Promise<Item[]> {
  const pattern = `%${q}%`;
  const rows = await db.all<any[]>(`
    SELECT
      i.*,
      s.full_name AS s_full_name,
      s.mobile AS s_mobile,
      s.id_type AS s_id_type,
      s.id_number AS s_id_number,
      c.full_name AS c_full_name,
      c.mobile AS c_mobile,
      c.id_type AS c_id_type,
      c.id_number AS c_id_number,
      r.full_name AS r_full_name,
      r.mobile AS r_mobile,
      r.id_type AS r_id_type,
      r.id_number AS r_id_number
    FROM items i
    LEFT JOIN persons s ON i.surrendered_by = s.id
    LEFT JOIN persons c ON i.claimed_by = c.id
    LEFT JOIN persons r ON i.reported_by = r.id
    WHERE i.status = ? AND i.item_name LIKE ?
    ORDER BY i.created_at DESC
  `, [oppositeStatus, pattern]);

  return rows.map((row) => {
    const item: Item = {
      id: row.id,
      item_name: row.item_name,
      description: row.description,
      category: row.category,
      department_origin: row.department_origin,
      status: row.status,
      surrendered_by: row.surrendered_by,
      claimed_by: row.claimed_by,
      reported_by: row.reported_by,
      claimed_at: row.claimed_at,
      synced: row.synced,
      updated_at: row.updated_at,
      created_at: row.created_at,
      image_data: row.image_data ?? null,
    };

    if (row.surrendered_by) {
      item.surrenderedByPerson = {
        id: row.surrendered_by,
        full_name: row.s_full_name,
        mobile: row.s_mobile,
        id_type: row.s_id_type ?? undefined,
        id_number: row.s_id_number ?? undefined,
      };
    } else {
      item.surrenderedByPerson = null;
    }

    if (row.claimed_by) {
      item.claimedByPerson = {
        id: row.claimed_by,
        full_name: row.c_full_name,
        mobile: row.c_mobile,
        id_type: row.c_id_type ?? undefined,
        id_number: row.c_id_number ?? undefined,
      };
    } else {
      item.claimedByPerson = null;
    }

    if (row.reported_by) {
      item.reportedByPerson = {
        id: row.reported_by,
        full_name: row.r_full_name,
        mobile: row.r_mobile,
        id_type: row.r_id_type ?? undefined,
        id_number: row.r_id_number ?? undefined,
      };
    } else {
      item.reportedByPerson = null;
    }

    return item;
  });
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
  claimedBy?: string,
  surrenderedBy?: string
): Promise<void> {
  const claimedAt = status === 'claimed' ? new Date().toISOString() : null;
  const setClauses: string[] = [];
  const params: any[] = [];

  setClauses.push('status = ?');
  params.push(status);

  setClauses.push('claimed_by = ?');
  params.push(claimedBy ?? null);

  setClauses.push('claimed_at = ?');
  params.push(claimedAt);

  if (surrenderedBy && status === 'found') {
    setClauses.push('surrendered_by = ?');
    params.push(surrenderedBy);
  }

  setClauses.push('synced = 0');
  setClauses.push("updated_at = CURRENT_TIMESTAMP");

  params.push(id);

  await db.run(
    `UPDATE items SET ${setClauses.join(', ')} WHERE id = ?`,
    params
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
  reported_by?: string | Person | null;
  claimed_at?: string | null;
  updated_at?: string;
  created_at?: string;
  image_data?: string | null;
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
      mobile: (payload as any).surrenderer_mobile ? normalizeMobile((payload as any).surrenderer_mobile) : '',
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
      mobile: (payload as any).claimant_mobile ? normalizeMobile((payload as any).claimant_mobile) : '',
      id_type: (payload as any).claimant_id_type ?? undefined,
      id_number: (payload as any).claimant_id_number ?? undefined,
    };
  }

  if (claimantPerson) {
    await saveOrUpdatePerson(claimantPerson);
  }

  // Handle reporter person if provided as an object or flat fields from SYNC_DUMP
  let reporterPerson: Person | undefined;
  if (payload.reported_by && typeof payload.reported_by === 'object') {
    reporterPerson = payload.reported_by as Person;
  } else if (payload.reported_by && typeof payload.reported_by === 'string' && (payload as any).reporter_full_name) {
    reporterPerson = {
      id: payload.reported_by,
      full_name: (payload as any).reporter_full_name,
      mobile: (payload as any).reporter_mobile ? normalizeMobile((payload as any).reporter_mobile) : '',
      id_type: (payload as any).reporter_id_type ?? undefined,
      id_number: (payload as any).reporter_id_number ?? undefined,
    };
  }

  if (reporterPerson) {
    await saveOrUpdatePerson(reporterPerson);
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

  // Normalize reported_by to a string (person ID) for database storage
  const reportedById: string | null =
    payload.reported_by && typeof payload.reported_by === 'object'
      ? (payload.reported_by as Person).id
      : (payload.reported_by as string | null) ?? null;

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
              reported_by       = ?,
              claimed_at        = ?,
              image_data        = ?,
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
        reportedById,
        payload.claimed_at ?? null,
        payload.image_data ?? null,
        payload.updated_at ?? new Date().toISOString(),
        payload.id,
      ]
    );
  } else {
    await db.run(
      `INSERT INTO items
        (id, item_name, description, category, department_origin, status,
         surrendered_by, claimed_by, reported_by, claimed_at, image_data, synced, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        payload.id,
        payload.item_name,
        payload.description ?? null,
        payload.category ?? null,
        payload.department_origin,
        payload.status,
        surrenderedById,
        claimedById,
        reportedById,
        payload.claimed_at ?? null,
        payload.image_data ?? null,
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
  surrendered_by?: string | Person | null;
  reported_by?: string | Person | null;
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
      mobile: (payload as any).claimant_mobile ? normalizeMobile((payload as any).claimant_mobile) : '',
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

  // 2. Save the surrenderer person if provided as a full Person object
  let surrendererPerson: Person | undefined;
  if (payload.surrendered_by && typeof payload.surrendered_by === 'object') {
    surrendererPerson = payload.surrendered_by as Person;
  } else if (payload.surrendered_by && typeof payload.surrendered_by === 'string' && (payload as any).surrenderer_full_name) {
    surrendererPerson = {
      id: payload.surrendered_by,
      full_name: (payload as any).surrenderer_full_name,
      mobile: (payload as any).surrenderer_mobile ? normalizeMobile((payload as any).surrenderer_mobile) : '',
      id_type: (payload as any).surrenderer_id_type ?? undefined,
      id_number: (payload as any).surrenderer_id_number ?? undefined,
    };
  }

  if (surrendererPerson) {
    await saveOrUpdatePerson(surrendererPerson);
  }

  // Normalize surrendered_by to a string (person ID) for database storage
  const surrenderedById: string | null =
    payload.surrendered_by && typeof payload.surrendered_by === 'object'
      ? (payload.surrendered_by as Person).id
      : (payload.surrendered_by as string | null) ?? null;

  // 3. Save the reporter person if provided
  let reporterPerson: Person | undefined;
  if (payload.reported_by && typeof payload.reported_by === 'object') {
    reporterPerson = payload.reported_by as Person;
  } else if (payload.reported_by && typeof payload.reported_by === 'string' && (payload as any).reporter_full_name) {
    reporterPerson = {
      id: payload.reported_by,
      full_name: (payload as any).reporter_full_name,
      mobile: (payload as any).reporter_mobile ? normalizeMobile((payload as any).reporter_mobile) : '',
      id_type: (payload as any).reporter_id_type ?? undefined,
      id_number: (payload as any).reporter_id_number ?? undefined,
    };
  }

  if (reporterPerson) {
    await saveOrUpdatePerson(reporterPerson);
  }

  // Normalize reported_by to a string (person ID) for database storage
  const reportedById: string | null =
    payload.reported_by && typeof payload.reported_by === 'object'
      ? (payload.reported_by as Person).id
      : (payload.reported_by as string | null) ?? null;

  // 4. Check if the item exists (for LWW comparison)
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

  // 5. Apply the status update
  const claimedAt = payload.status === 'claimed'
    ? (payload.updated_at ?? new Date().toISOString())
    : null;

  const setClauses: string[] = [];
  const params: any[] = [];

  setClauses.push('status = ?');
  params.push(payload.status);

  setClauses.push('claimed_by = ?');
  params.push(claimedById);

  setClauses.push('claimed_at = ?');
  params.push(claimedAt);

  if (surrenderedById) {
    setClauses.push('surrendered_by = ?');
    params.push(surrenderedById);
  }

  setClauses.push('synced = 1');
  setClauses.push('updated_at = ?');
  params.push(payload.updated_at ?? new Date().toISOString());

  params.push(payload.id);

  await db.run(
    `UPDATE items SET ${setClauses.join(', ')} WHERE id = ?`,
    params
  );
}
