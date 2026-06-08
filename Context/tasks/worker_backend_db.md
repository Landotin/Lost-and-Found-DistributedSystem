# Task Contract: Database Module (`worker_backend_db`)

## Scope
Implement the **Hub SQLite Database Layer** for the RDLFT Phase 1 Hub Server Core.

## Files to Create (ONLY these files)

1. `src/database.ts` — SQLite initialization, schema creation, async query helper
2. `src/database.test.ts` — Vitest unit tests (TDD: write BEFORE implementation)

## Requirements

### 2.1 SQLite Initialization (`src/database.ts`)

- Export `async function initDatabase(): Promise<Database>` 
- Open/create SQLite database file at `data/hub.db` (create `data/` directory if missing)
- Execute `PRAGMA journal_mode=WAL;` on connection open
- Create the following tables using `CREATE TABLE IF NOT EXISTS`:

```sql
CREATE TABLE IF NOT EXISTS persons (
    id          TEXT PRIMARY KEY,
    full_name   TEXT NOT NULL,
    mobile      TEXT NOT NULL,
    id_type     TEXT,
    id_number   TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
```

- Export `const db` (the initialized database instance)
- All queries MUST use parameterized statements (no string concatenation)
- Use the `sqlite` package (async API: `Database.open()`, `db.exec()`, `db.run()`, `db.get()`, `db.all()`)

### 2.2 Type Definitions

- Define and export TypeScript interfaces for `Person` and `Item` matching the schema columns
- Use strict typing — no `any`

### 2.3 Tests (`src/database.test.ts`) — TDD MANDATE

Write these tests BEFORE implementing `database.ts`:

1. `initDatabase()` creates the `data/hub.db` file on first run
2. `initDatabase()` creates the `persons` table with correct columns
3. `initDatabase()` creates the `items` table with correct columns and CHECK constraint
4. `PRAGMA journal_mode` is set to `wal` after init
5. Calling `initDatabase()` twice does not throw (idempotent — `IF NOT EXISTS`)
6. `items` table enforces CHECK constraint on `status` column (rejects invalid status values)

### Quality Gates
- `npx vitest run` must pass with exit code 0
- `npx tsc --noEmit` must pass with zero errors
- All SQL queries are parameterized (no string interpolation)

## Forbidden
- Do NOT modify `src/index.ts`, `src/index.test.ts`, or any file outside this contract
- Do NOT use `any` types
- Do NOT write placeholder/stub implementations — every function must be complete
