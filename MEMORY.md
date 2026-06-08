# Project Memory & State (`MEMORY.md`)

This file tracks the historical context, architectural decisions, completed milestones, and current task stack for the Real-Time Distributed Lost & Found Tracker (RDLFT).

---

## 0. Active Session Status

*   **Task Compile**: Configuration of agentic coding environment files (`AGENTS.md`, `MEMORY.md`, `Context/ERROR.md`) and establishing local documentation references (`Context/docs/best-practices.md`) for Express, WebSockets (`ws`), and SQLite.
*   **Current Task**: None (Phase 1 complete). Ready for Phase 2: Department Node Frontend.
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
    *   `[x]` **Phase 1: Hub Server Core** — Express + ws server, SQLite schema (persons + items), HELLO protocol with secret validation, NODE_LIST broadcast, HEARTBEAT/ACK mechanism, graceful shutdown. 32 Vitest tests, TypeScript strict mode clean. (Commit range: `a369f1f..b8c786e`)
*   **Pending Tasks**:
    *   `[ ]` Phase 2: Department Node Frontend & Local DB (React + Vite scaffold, local SQLite, Log Item form, offline queue UI, connection LED)

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
*   [x] 32 passing Vitest tests, strict TypeScript, code-reviewed

**Files delivered:**
- `server/src/index.ts` — Express entry point, server lifecycle
- `server/src/database.ts` — SQLite init, schema, type definitions
- `server/src/connection-manager.ts` — Connection registry, HELLO handler, NODE_LIST broadcast
- `server/src/heartbeat.ts` — HeartbeatManager (EventEmitter), ping/ACK timeout detection

**Known subagent issue (ERR-003):** The `Agent` tool cannot spawn subagents because `effortLevel: "high"` in settings.json injects `reasoning_effort` into API calls, which DeepSeek's endpoint rejects. `claude -p --bare` from Bash works correctly (fresh session, no effortLevel inheritance). All agent model defs use `deepseek-v4-flash` (worker/spec-gatherer/code-reviewer) or `deepseek-v4-pro[1m]` (planner) — these are correct and must NOT be changed to Anthropic models. For Phase 2+, spawn workers via `Bash` + `run-headless-worker.sh` (now fixed with NVM sourcing).

### Phase 2: Department Node Frontend & Local DB (Pending)
*   [ ] Bootstrap React + TypeScript + Vite + Tailwind client app
*   [ ] Configure local SQLite connection/mock logic (or client-side SQLite file runner)
*   [ ] Build Log Item and Offline Queue UI
*   [ ] Set up Connection State indicator (LED banner)

### Phase 3: Sync & Event Handling (Pending)
*   [ ] Implement reconnection queue-flush routine on client
*   [ ] Configure Hub `SYNC_DUMP` handshake
*   [ ] Test event broadcast propagation (`ITEM_BROADCAST`)

### Phase 4: Claims Processing (Pending)
*   [ ] Build Process Claim screen
*   [ ] Implement status transition checks (`lost -> found -> claimed`)
*   [ ] Sync claimed state across nodes

---

## 3. Current Focus & Next Steps
1.  Initialize the server repository directory structure (`server/` and `client/`).
2.  Set up dependencies (Express, ws, sqlite3, cors, dotenv for server; Vite, tailwind, lucide-react for client).
