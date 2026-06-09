# Project Memory & State (`MEMORY.md`)

This file tracks the historical context, architectural decisions, completed milestones, and current task stack for the Real-Time Distributed Lost & Found Tracker (RDLFT).

---

## 0. Active Session Status

*   **Task Compile**: Phase 5 Hub Backend complete — Admin REST APIs, Admin WebSocket support, and comprehensive tests.
*   **Current Task**: Phase 5: Hub Admin Backend — Complete.
*   **Completed Tasks**:
    *   `[x]` Phase 4 complete — both backend and frontend. Code review identified 5 findings — all fixed.
    *   `[x]` Phase 5: Added `adminAuth` Express middleware checking `x-admin-secret` header against `ADMIN_SECRET`.
    *   `[x]` Phase 5: Implemented `GET /api/admin/nodes` returning connected node list (socketId, deptName, connectedAt).
    *   `[x]` Phase 5: Implemented `POST /api/admin/nodes/:id/disconnect` to force-disconnect a node.
    *   `[x]` Phase 5: Implemented `POST /api/admin/nodes/:id/sync` to trigger SYNC_DUMP to a specific node.
    *   `[x]` Phase 5: Implemented `GET /api/admin/items` returning all items with full joined person PII (unredacted).
    *   `[x]` Phase 5: Implemented `GET /api/admin/analytics` returning items-by-department, claim rate, total items.
    *   `[x]` Phase 5: Added admin WebSocket support — `HELLO` with `{ type: 'ADMIN', secret }` registers into separate `adminNodes` map, skips node registration.
    *   `[x]` Phase 5: `broadcastToOthers` sends exact unredacted copy of every event to all connected admin sockets.
    *   `[x]` Phase 5: Added `getNode()`, `disconnectNode()`, `addAdminNode()`, `removeAdminNode()`, `getAdminNodeCount()` to ConnectionManager.
    *   `[x]` Phase 5: Added `getAllItemsWithPII()` and `getAnalytics()` to database module.
    *   `[x]` Phase 5: 80 passing tests (up from 52) — 5 test files all green.
    *   `[x]` Phase 5: All existing integration tests (PII redaction, SYNC_DUMP, ITEM_BROADCAST) continue to pass.
*   **Pending Tasks**: None.

---

## 1. Architectural Decisions (ADR)

### ADR 001: Local-First Autonomy with SQLite
*   **Context**: Department nodes must remain fully functional if partitioned from the Central Hub.
*   **Decision**: Use an embedded SQLite database inside each container. Writes are stored locally with a `synced` boolean flag.
*   **Consequence**: Low operational overhead and zero database hosting setup, ensuring a seamless single-laptop Docker Compose demo.

### ADR 002: Native WebSockets (`ws`) over Socket.IO
*   **Context**: High reliability and clear connection lifecycle control are critical for demonstrating fault tolerance.
*   **Decision**: Use Node's standard `ws` package for server and standard WebSockets in the browser/node client.
*   **Consequence**: Minimal footprint, precise control over the reconnect flow, and easy integration with SQLite offline queues.

### ADR 003: Last-Write-Wins (LWW) Sync Conflict Resolution
*   **Context**: Simultaneous or delayed updates during partition reconnects must converge cleanly.
*   **Decision**: Compare incoming items by `updated_at` timestamps. The record with the latest timestamp becomes the authoritative state.
*   **Consequence**: Avoids complex CRDT integration while meeting PRD constraints for a 1-2 day sprint.

---

## 2. Project Progress & Milestones

### Phase 0: Setup & Architecture Configuration
*   [x] Establish PRD (v2.0)
*   [x] Set up Agent Coding Environment Files (`AGENTS.md`, `MEMORY.md`, `Context/ERROR.md`)

### Phase 1: Hub Server Core (Complete — 2026-06-08)
*   [x] Initialize Node.js Express server with CORS + JSON middleware
*   [x] Configure WebSocket Server broker (`ws`) sharing HTTP port
*   [x] Create Hub SQLite database schema (`persons` + `items` tables)
*   [x] Enable WAL mode and foreign key enforcement
*   [x] Implement `HELLO` protocol validation (secret check, timeout, reject codes)
*   [x] Implement `NODE_LIST` broadcast on connect/disconnect/timeout
*   [x] Implement HEARTBEAT/ACK mechanism with configurable timeouts
*   [x] Health endpoint (`GET /health`) returning uptime + node count
*   [x] Graceful shutdown on SIGTERM/SIGINT
*   [x] 33 passing Vitest tests, strict TypeScript, code-reviewed
*   [x] Bugfix: Handle post-HELLO messages and wire WS ACK events to HeartbeatManager (resolves ERR-004)

**Files delivered:**
- `server/src/index.ts` — Express entry point, server lifecycle
- `server/src/database.ts` — SQLite init, schema, type definitions
- `server/src/connection-manager.ts` — Connection registry, HELLO handler, NODE_LIST broadcast
- `server/src/heartbeat.ts` — HeartbeatManager (EventEmitter), ping/ACK timeout detection

**Known subagent issue (ERR-003):** The `Agent` tool cannot spawn subagents because `effortLevel` injects `reasoning_effort` into API calls, which DeepSeek's endpoint rejects. Workaround: spawn workers via `claude -p --bare` (fresh session, no effortLevel inheritance). All agent model defs use `deepseek-v4-flash` (worker/spec-gatherer/code-reviewer) or `deepseek-v4-pro[1m]` (planner) — do NOT change to Anthropic models.

### Phase 2: Department Node Frontend & Local DB (Complete — 2026-06-08)
*   [x] Client server bootstrap (`client/server/package.json`, `tsconfig.json`, `src/index.ts`)
*   [x] Local SQLite database with persons + items CRUD
*   [x] WebSocket client with heartbeat/reconnect/sync queue (`WsClientManager`)
*   [x] Express API routes (status, persons, items, pending sync)
*   [x] Shared TypeScript types (`src/types.ts`)
*   [x] API hooks (`src/hooks/useApi.ts`, `usePolling.ts`)
*   [x] Form validation utilities (`src/utils/validation.ts`)
*   [x] ConnectionStatus LED indicator (green/amber/red) + offline banner with pending count
*   [x] LogItemForm with surrenderer section (conditional on status=found)
*   [x] PendingSync component with loading/empty/error/item states
*   [x] App shell with tab navigation (Log Item | Pending Sync)
*   [x] Vite dev proxy (`/api` → `localhost:3001`)
*   [x] 78 passing tests (69 frontend + 9 server), code-reviewed

**Files delivered:**
- `client/server/src/index.ts` — Express entry with WS client, API routes, graceful shutdown
- `client/server/src/index.test.ts` — 9 integration tests
- `client/server/src/database.ts`, `ws-client.ts`, `routes.ts` — pre-existing
- `client/src/types.ts` — Person, Item, ItemStatus, API response types
- `client/src/hooks/useApi.ts`, `usePolling.ts` — data fetching hooks
- `client/src/utils/validation.ts` — mobile number + required field validation
- `client/src/components/ConnectionStatus.tsx` — LED + offline banner
- `client/src/components/LogItemForm.tsx` — item submission form with surrenderer
- `client/src/components/PendingSync.tsx` — offline queue viewer
- `client/src/App.tsx` — tab navigation shell

### Phase 3: Global Ledger (Complete — 2026-06-08)
*   [x] Real-time item table on node fetching from `GET /api/items`
*   [x] Filter by department / status
*   [x] Search by item name
*   [x] SYNC_DUMP on connect (hub → node)

### Phase 4: Claims Processing (Complete — 2026-06-09)
*   [x] Strict state machine validation (`lost → found → claimed`) in `PATCH /items/:id/status`
*   [x] Mobile number normalization (`09...` → `+639...`) on person creation
*   [x] 6 new backend integration tests for state transitions (84 total backend tests passing)
*   [x] Frontend Process Claim component with item search/dropdown and claimant form
*   [x] Global Ledger integration — [Process Claim] button on found item details
*   [x] App navigation — Process Claim tab with preselection support
*   [x] 136 frontend tests passing (12 test files)

---

## 3. Current Focus & Next Steps
1.  Phase 5 complete — 80 hub tests passing.
2.  End-to-end verification of admin APIs and admin WebSocket.
3.  Next phase (Phase 6) TBD — potentially frontend admin dashboard or client/node admin integrations.

---

## 4. Session Logs

### Session: 2026-06-08 (Beginner's Guide Verification & Code Review Cleanup)
*   **Verification**: Executed Scenarios A, B, C, and D from `beginners-guide.md` strictly using `curl` and `sqlite3`:
    *   *Scenario A*: Logged item online, verified dynamic connection socket registration and immediate sync (`synced = 1`).
    *   *Scenario B*: Terminated Hub server, logged item, verified local cache creation (`synced = 0`) and pending queue counting.
    *   *Scenario C*: Relaunched Hub server, verified automatic websocket reconnect and immediate sync flush.
    *   *Scenario D*: Simualted database write lock during partition, triggered submission error, verified that retry correctly reused the existing person ID (`Jane Smith` registered only once in DB) and successfully logged the item on release.
*   **Code Review Cleanups**: Checked and applied the 10 code review recommendations:
    *   Statically imported `App` in `App.test.tsx` and added explicit `afterEach(cleanup)` implementation to prevent leaks.
    *   Swapped heading assertion in `App.test.tsx` to `getByRole('heading', { name: /Lost & Found Tracker/i })`.
    *   Extracted `getTabClassName` in `App.tsx` to eliminate active tab style duplication.
    *   Decoupled `ConnectionStatus.tsx` by replacing the `pendingData` response object dependency with a clean `pendingCount` scalar prop.
    *   Deleted 4 orphaned boilerplate assets (`hero.png`, `react.svg`, `vite.svg`, `icons.svg`).
    *   All 78 unit/integration tests successfully run and pass.

### Session: 2026-06-08 (PII Privacy & WebSocket Broadcast Redaction)
*   **Problem**: In the previous integration, PII details (mobile, id_type, id_number) were leaked to unrelated department nodes during real-time `ITEM_BROADCAST` and `STATUS_UPDATE` broadcasts.
*   **Decision**: Implemented dynamic PII redaction inside the Hub's `ConnectionManager.broadcastToOthers`. The Hub checks if the recipient node's department name matches the item's `department_origin`. If they do not match, the Hub automatically redacts the PII details of `surrendered_by` and `claimed_by` before sending the payload.
*   **Fixes**: Merged existing database record fields in the Hub's `STATUS_UPDATE` handler to avoid overwriting item details (like `item_name`) with NULL when status updates are processed.
*   **Tests**: Added 2 new integration tests to `integration.test.ts` verifying that `ITEM_BROADCAST` and `STATUS_UPDATE` properly redact PII for unrelated department nodes. All 52 Hub server tests and 24 Node server tests compile and pass.

### Session: 2026-06-09 (Fixing SYNC_DUMP Foreign Key SQLite Constraints & Redaction Guards)
*   **Problem**: During node connection, receiving a `SYNC_DUMP` from the hub produced a foreign key constraint violation (`SQLITE_CONSTRAINT: FOREIGN KEY constraint failed`). This was due to items referencing surrenderer/claimant persons whose records were not yet created, or because the payload contained flat fields instead of nested person objects.
*   **Decision**: 
    1. Reconstruct nested `Person` objects from incoming item flat-fields (e.g. `surrenderer_full_name`, `claimant_mobile`) and persist them into the node's local database before inserting/updating the item.
    2. Guard `saveOrUpdatePerson` against overwriting valid local PII details (mobile, id_type, id_number) with `[REDACTED]` values received from sync broadcasts.
*   **Fixes**: 
    - Updated `handleIncomingItem` and `handleIncomingStatusUpdate` in node's `database.ts` to reconstruct person models and guard PII updates.
    - Updated `routes.ts` in node's `client-server` to automatically set `synced = 1` locally upon successful real-time `STATUS_UPDATE` broadcasts.
*   **Tests**: Created Vitest test cases in `database.test.ts` for flat-field reconstruction and `[REDACTED]` guard validation. Verified all 26 node tests and 103 frontend tests successfully pass. Tried multiple offline-online sync scenarios using local curl queries and confirmed convergence.

### Session: 2026-06-09 (Phase 3 Full Verification — curl Testing, Bug Discovery, and Heartbeat Fix)
*   **Scope**: Comprehensive manual `curl`-based verification of every Phase 3 feature and edge case across a live 3-server deployment (Hub on :5000, Security node on :3001, Engineering node on :3002).
*   **Tests Executed**: 133 manual curl tests across 7 categories:
    1.  **Hub Health & Node Status** (3 tests): Hub `/health` returns uptime + nodeCount; node `/api/status` returns connection state + peer count.
    2.  **Person CRUD** (7 tests): Create with full PII, create minimal (mobile only), get by ID, 404 for unknown person, validation of missing `full_name`/`mobile`/empty body.
    3.  **Item Creation & Global Ledger** (10 tests): Create `found` with surrenderer, `found` without surrenderer, `lost` item, GET all items (Global Ledger), GET item detail with `surrenderedByPerson` inline, 404 for unknown item, validation of missing `item_name`/`status`, invalid status, empty body.
    4.  **Status Update / Claim Flow** (5 tests): Claim with claimant, claim without `claimed_by` (rejected), invalid status value (rejected), non-existent item (404), double-claim (idempotent).
    5.  **PII Redaction for Cross-Dept Sync** (8 tests): Alice Smith's full PII visible on Security (origin dept), `[REDACTED]` on Engineering; Bob Jones's PII redacted on Engineering after STATUS_UPDATE; SYNC_DUMP correctly redacts cross-dept PII; ITEM_BROADCAST real-time item creation propagates to Engineering with `[REDACTED]` PII; `[REDACTED]` guard in `saveOrUpdatePerson` prevents overwriting real PII on subsequent sync events; hub DB retains raw PII.
    6.  **Sync Queue & Offline Behavior** (7 tests): Online items get `synced=1`, pending queue is empty; kill hub, Security node status to `disconnected`/`connecting`; create items offline → `synced=0`, pending queue has 2 items; restart hub, nodes reconnect with bidirectional ACK; pending queue drains to 0; offline items arrive in hub DB; items propagate to Engineering.
    7.  **Error Handling & Edge Cases** (15 tests): SQL injection in item_name, SQL injection in person full_name, XSS `<script>` in description, non-JSON body, wrong Content-Type, 10KB item name, Unicode/emoji in fields, proto pollution attempt, `GET /nonexistent` returns 404, POST array instead of object, null/empty string fields, bool instead of string fields, DB integrity check (all tables intact after injection attempts).
*   **Bugs Found & Fixed**:
    - **ERR-008**: `markItemSynced` called without being imported in `client/server/src/routes.ts`. Claim endpoint returned 500 despite succeeding in DB. Fixed by adding `markItemSynced` to the import list.
    - **ERR-009**: Bidirectional heartbeat ACK missing. Hub sent `HEARTBEAT` pings but nodes had no handler → nodes didn't ACK → hub timed out after 2 misses (~25s). Nodes sent `HEARTBEAT` pings but hub had no handler → hub silently ignored → nodes timed out. Result: both nodes disconnected/reconnected every ~25s, STATUS_UPDATE broadcasts never reached Engineering. Fixed by: (1) adding `HEARTBEAT: () => { this.send('ACK', {}); }` in `ws-client.ts` event handlers, (2) adding a `HEARTBEAT → ACK` response handler in `server/src/index.ts` message router.
*   **Verification**: All 78 automated tests pass (52 hub + 26 client). Connections stable at 218s+ uptime with no reconnects. PII redaction confirmed correct: Security retains real PII, Engineering sees `[REDACTED]` for all cross-dept data. Offline→online sync flush works end-to-end.

### Session: 2026-06-09 (Phase 4 Frontend — Claims UI & Validation)
*   **Scope**: Implemented the frontend Claims Processing UI for Phase 4 in the `rdlft-phase4-frontend` worktree.
*   **Mobile Validation Refactor**: Updated `validateMobile` to accept both `+639...` and Philippine `09...` formats. Added `formatMobileToE164()` utility to convert `09...` to `+639...` before API submission. 26 validation tests all passing.
*   **ProcessClaim Component**: Created new component with:
    *   Search/dropdown to find found items by name or ID (filters out non-found items).
    *   Claimant form (Full Name, Mobile, ID Type, ID Number) with validation.
    *   Two-step submission: `createPerson` → `updateItemStatus` with E.164 mobile conversion.
    *   Full state coverage: loading, empty (no found items), error (API failure), success, and preselected item auto-routing.
    *   Back button to return to item selection.
    *   15 integration tests all passing.
*   **Global Ledger Integration**: Added `onProcessClaim` prop to `GlobalLedger` and `DetailModal`. Renders `[Process Claim]` button for items with `status === 'found'`. Button triggers callback passing the item ID, then closes modal. 22 GlobalLedger tests (including 5 new Process Claim button tests) all passing.
*   **App Navigation**: Added "Process Claim" tab alongside existing tabs. Introduced `processClaimItemId` state for tab switching with preselection. Tab click clears preselection; Global Ledger callback sets it. 4 App tests all passing.
*   **Files created/modified**:
    - `client/src/utils/validation.ts` — `validateMobile` accepts `09...`, new `formatMobileToE164`
    - `client/src/utils/validation.test.ts` — 26 tests for both formats + conversion
    - `client/src/components/ProcessClaim.tsx` — new Process Claim component
    - `client/src/components/__tests__/ProcessClaim.test.tsx` — 15 integration tests
    - `client/src/components/GlobalLedger.tsx` — `onProcessClaim` prop, button in modal
    - `client/src/components/__tests__/GlobalLedger.test.tsx` — 5 new Process Claim button tests
    - `client/src/App.tsx` — new "Process Claim" tab, state for preselected item ID
    - `client/src/App.test.tsx` — updated for 4 tabs, tab click test
*   **Test Results**: All 136 frontend tests pass across 12 test files.

### Session: 2026-06-09 (Phase 4 Backend — State Machine & Mobile Validation)
*   **Scope**: Implemented backend validation logic for Phase 4 Claims Processing in the `rdlft-phase4-backend` worktree.
*   **State Machine Validation**: Added strict transition enforcement in `client/server/src/routes.ts` — `PATCH /items/:id/status` now validates:
    *   `lost → found` ✓
    *   `found → claimed` ✓
    *   All other transitions (including `lost → claimed`, `claimed → any`, reversions) return **HTTP 400** with descriptive error messages. `claimed` is treated as a terminal state.
*   **Mobile Number Normalization**: Added `normalizeMobile()` to convert Philippine `09...` prefixes to E.164 `+639...` format, applied in `POST /persons`.
*   **Tests**: Wrote 6 new integration tests covering all valid and invalid transitions. All 84 tests pass (32 client/server + 52 hub server).
*   **Files modified**:
    - `client/server/src/routes.ts` — state machine transition table, `normalizeMobile` helper
    - `client/server/src/index.test.ts` — 6 new state transition tests

### Session: 2026-06-09 (Phase 5 Hub Backend — Admin REST APIs & WebSocket)
*   **Scope**: Implemented Admin REST APIs and Admin WebSocket support in the Central Hub (`server` directory).
*   **API Authorization**: Added `adminAuth` Express middleware that checks the `x-admin-secret` header against `process.env.ADMIN_SECRET` for all `/api/admin/*` routes.
*   **Admin REST Endpoints** (all in `server/src/index.ts`):
    - `GET /api/admin/nodes` — returns list of connected nodes with `socketId`, `deptName`, `connectedAt`.
    - `POST /api/admin/nodes/:id/disconnect` — force-disconnects a node socket with code 1000.
    - `POST /api/admin/nodes/:id/sync` — triggers a complete `SYNC_DUMP` to the targeted node.
    - `GET /api/admin/items` — fetches all items with full unredacted PII via `LEFT JOIN` on `persons`.
    - `GET /api/admin/analytics` — returns `itemsByDepartment`, `claimRate` (`claimed / (found + claimed)`), `totalItems`, `totalFound`, `totalClaimed`.
*   **Admin WebSocket** (in `server/src/connection-manager.ts`):
    - `handleConnection` now accepts `HELLO` with `{ payload: { type: 'ADMIN', secret: '...' } }`.
    - Admin sockets are tracked in a separate `adminNodes` Map (not registered as regular nodes).
    - `broadcastToOthers` sends exact unredacted copies of every event (`ITEM_BROADCAST`, `STATUS_UPDATE`, etc.) to all connected admin sockets.
    - Cleanup on close/error handles both admin and regular node sockets.
*   **New ConnectionManager methods**: `getNode()`, `disconnectNode()`, `addAdminNode()`, `removeAdminNode()`, `getAdminNodeCount()`.
*   **New database functions**: `getAllItemsWithPII()` (unredacted JOIN query), `getAnalytics()` (aggregated stats).
*   **Test Results**: All 80 tests pass across 5 test files (up from 52 before Phase 5). Existing integration tests for PII redaction, SYNC_DUMP, ITEM_BROADCAST, and STATUS_UPDATE continue to pass.
*   **Scope**: Addressed all 5 findings from high-effort code review across 7 review angles.
*   **Finding 1 (HIGH) — claimed_by check before state machine**: `PATCH /items/:id/status` validated `claimed_by` required before checking state transitions, producing misleading errors (e.g., "claimed_by is required" instead of "Cannot transition from lost to claimed"). **Fix**: Moved state machine check before `claimed_by` validation.
*   **Finding 2 (HIGH) — Empty-string PII overwrite in sync paths**: `handleIncomingItem` and `handleIncomingStatusUpdate` in `database.ts` defaulted missing mobile to `""` in flat-field reconstruction. The `saveOrUpdatePerson` guard only protected against `"[REDACTED]"` — empty strings silently overwrote real PII. **Fix**: Changed defaults from `?? ''` to `?? undefined`, and widened `saveOrUpdatePerson` guard to `(!person.mobile || person.mobile === '[REDACTED]')`.
*   **Finding 3 (MEDIUM) — Same-status transitions rejected**: Setting status to the current value returned `400` because `VALID_TRANSITIONS` didn't include identity transitions. **Fix**: Added `same→same` entries — `'lost': ['lost', 'found']`, `'found': ['found', 'claimed']`, `'claimed': ['claimed']`.
*   **Finding 4 (MEDIUM) — normalizeMobile not in sync paths**: `normalizeMobile` was only applied in `POST /persons`, not in SYNC_DUMP/ITEM_BROADCAST flat-field reconstruction. **Fix**: Moved `normalizeMobile` to `database.ts`, exported it, and applied in all 3 flat-field person reconstruction sites.
*   **Finding 5 (LOW) — VALID_TRANSITIONS per-request**: The map was allocated inside each request handler. **Fix**: Extracted to module-level constant.
*   **Files modified**:
    - `client/server/src/database.ts` — `saveOrUpdatePerson` guard widened, `normalizeMobile` added + exported, flat-field defaults changed to `undefined`, `normalizeMobile` applied in sync paths
    - `client/server/src/routes.ts` — validation reordered, identity transitions added, duplicate `normalizeMobile` replaced with import, `VALID_TRANSITIONS` made module-level
    - `client/server/src/index.test.ts` — test assertions updated for new error messages
*   **Test Results**: All 193 tests pass (32 client/server + 52 hub server + 109 frontend).
