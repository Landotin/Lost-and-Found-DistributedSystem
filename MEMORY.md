# Project Memory & State (`MEMORY.md`)

This file tracks the historical context, architectural decisions, completed milestones, and current task stack for the Real-Time Distributed Lost & Found Tracker (RDLFT).

---

## 0. Active Session Status

*   **Task Compile**: Phase 2 bug fixes & refactoring complete. Consolidated API status polling to parent App.tsx, resolved form retry duplicate person bug, refactored usePolling to be ref-safe, and passed all 69 frontend unit tests.
*   **Current Task**: Ready for Phase 3: Global Ledger.
*   **Completed Tasks**:
    *   `[x]` Reviewed and corrected custom agent configurations in `.claude/agents/` (corrected tool names to standard Claude Code conventions and moved `code-reviewer.md` to `agents/` directory).
    *   `[x]` PRD alignment checks.
    *   `[x]` Created instructions layer (`AGENTS.md`) with TDD rules, coding standards, readability guidelines, OpenSrc settings, append-only memory rules, and error-resolution workflows.
    *   `[x]` Created error registry (`Context/ERROR.md`) with template schemas.
    *   `[x]` Created documentation reference (`Context/docs/best-practices.md`) outlining ws/Express port sharing, SQLite WAL, React state hooks, Tailwind LED styling, and Docker orchestration.
    *   `[x]` Created multi-agent workflow guide (`Context/docs/multi-agent-workflow.md`) defining Spec Gatherer -> Planner -> Worker worktree allocation.
    *   `[x]` Created Claude Code setup instructions (`Context/docs/claude-code-setup.md`) detailing environment variables for Gemini Pro, Deepseek Pro, and Deepseek Flash integration.
    *   `[x]` Created root `.gitignore` to prevent secret leaks, local databases, and temporary agent scripts from being committed.
    *   `[x]` Created Spec Gatherer instructions file (`Context/tasks/gatherer_instructions.md`) to bootstrap context collection.
    *   `[x]` Phase 1: Bootstrapped backend (`server/`) and frontend (`client/`) workspaces, configured TypeScript, Tailwind CSS v4, and integrated Vitest for TDD execution.
    *   `[x]` **Phase 1: Hub Server Core** — Express + ws server, SQLite schema (persons + items), HELLO protocol with secret validation, NODE_LIST broadcast, HEARTBEAT/ACK mechanism, graceful shutdown. 33 Vitest tests, strict TypeScript clean.
    *   `[x]` **Phase 2: Department Node Frontend & Local DB** — Multi-agent pipeline with spec-gatherers (frontend/client-server/hub) → 5 parallel workers → code-reviewer. See detailed breakdown below.
    *   `[x]` **Phase 2 Code Review** — Performed architectural review, identified data duplication bugs in form retries, fire-and-forget sync vulnerabilities, and React hook dependency issues.
    *   `[x]` **Phase 2 Bug Fixes & Refactoring** — Resolved form retry duplication, refactored usePolling dependencies, consolidated API status/pending polling to App.tsx to eliminate duplicate network queries, updated and verified all 69 unit tests.
*   **Pending Tasks**:
    *   `[ ]` Phase 3: Global Ledger — Real-time item table on node + SYNC_DUMP on connect + filter/search

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

### Phase 3: Global Ledger (Pending)
*   [ ] Real-time item table on node fetching from `GET /api/items`
*   [ ] Filter by department / status
*   [ ] Search by item name
*   [ ] SYNC_DUMP on connect (hub → node)

### Phase 4: Claims Processing (Pending)
*   [ ] Build Process Claim screen
*   [ ] Implement status transition checks (`lost -> found -> claimed`)
*   [ ] Sync claimed state across nodes

---

## 3. Current Focus & Next Steps
1.  Phase 3: Global Ledger — real-time item table with filter/search on node.
2.  Integrate SYNC_DUMP handshake (hub seeds new node with full state).
3.  Test ITEM_BROADCAST propagation between nodes.

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
