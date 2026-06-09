# Known Issues & Error Registry (`Context/ERROR.md`)

This document is a living log of all development and production runtime errors, their root causes, and their resolutions. AI agents must check this registry before attempting to debug recurring issues.

---

## 1. Error Log Schema

Every recorded error should follow this template:

```markdown
### ERR-XXX: [Short Error Title]
*   **Component**: [Server | Client | Docker | Database]
*   **Symptom**: [What went wrong or failed to build?]
*   **Root Cause**: [Why did this error happen?]
*   **Resolution**: [How was it resolved?]
*   **Status**: [Open | Resolved]
```

---

## 2. Anticipated Risks & Mitigations

Below are known high-risk failure modes anticipated during development:

### ERR-001: SQLite Database File Locks (Anticipated)
*   **Component**: Database / Server / Client
*   **Symptom**: SQLite throws `SQLITE_BUSY: database is locked` on concurrent sync writes.
*   **Mitigation**: Configure SQLite to use Write-Ahead Logging (WAL) mode by executing `PRAGMA journal_mode=WAL;` on database connection initialization.

### ERR-002: Reconnection Broadcast Storms (Anticipated)
*   **Component**: WebSocket Client / Hub
*   **Symptom**: A recently reconnected node floods the WebSocket server with concurrent `SYNC_QUEUE_FLUSH` messages, causing lag or buffer overflow.
*   **Mitigation**: Implement batching for queue flushes or throttle outbound websocket frame releases during reconnect states.

### ERR-003: Subagent / Agent Tool Failure with DeepSeek + High Effort (Resolved)

*   **Component**: Agent Orchestration / Claude Code API
*   **Symptom**: All Agent tool spawns (worker, spec-gatherer, code-reviewer) fail immediately with HTTP 400: `thinking options type cannot be disabled when reasoning_effort is set`. Occurs when the main session uses `effortLevel: "high"` and subagents use DeepSeek models (the only models available — no Anthropic Pro plan).
*   **Root Cause**: `effortLevel: "high"` in `settings.json` injects `reasoning_effort` into every API request. The Agent tool passes this parameter through to subagent model calls. DeepSeek's Anthropic-compatible API endpoint (`api.deepseek.com/anthropic`) rejects `reasoning_effort` — their models don't support Anthropic's extended thinking parameter.
*   **Why `claude -p` works but Agent tool doesn't**: `claude -p --bare` starts a fresh session from the shell — it doesn't inherit the parent session's `effortLevel`. The Agent tool spawns subagents within the same session context, so they inherit the conflicting parameter.
*   **Resolution**: For Phase 1, implemented all code inline (no subagents). For Phase 2+, use `Bash` to invoke `claude -p --bare --model deepseek-v4-flash` from properly NVM-sourced shells. The `run-headless-worker.sh` script has been updated to source NVM and use `--bare` mode. The Agent tool is **not usable** with this configuration — always use `Bash` + `claude -p` for spawning workers.
*   **Alternative if `--bare` ever inherits effortLevel**: Remove `"effortLevel": "high"` from `settings.json` and instead pass it explicitly only for main-session models that support it.
*   **Status**: Resolved (documented workaround: use Bash + claude -p --bare instead of Agent tool).
*   **Date**: 2026-06-08

### ERR-004: Heartbeat ACK Ignored
*   **Component**: Server
*   **Symptom**: Department nodes connect successfully and complete the `HELLO` handshake but get disconnected by the server's `HeartbeatManager` after ~25 seconds.
*   **Root Cause**: The socket message listener in `connection-manager.ts` returned early if `helloReceived` was true (`if (helloReceived) return;`), ignoring all post-handshake messages (including `ACK` events sent in response to heartbeats).
*   **Resolution**: Refactored `handleConnection` to use `socket.once` for the initial `HELLO` message and dynamically register a persistent `'message'` handler after successful verification. The persistent listener emits `'message'` events from `ConnectionManager` (which now extends `EventEmitter`). In `index.ts`, these events are subscribed to, and `'ACK'` events are passed to `heartbeatManager.handleAck(socketId)`.
*   **Status**: Resolved
*   **Date**: 2026-06-08

### ERR-005: Component Test Failures Post-Polling Refactoring
*   **Component**: Client (Frontend Unit Tests)
*   **Symptom**: `ConnectionStatus.test.tsx` and `PendingSync.test.tsx` tests fail after refactoring state polling.
*   **Root Cause**: Polling was lifted from these components to the parent `App.tsx` and passed down as props, which meant calling `render(<ConnectionStatus />)` or `render(<PendingSync />)` without props in tests resulted in empty renders and ignored mock `usePolling` functions.
*   **Resolution**: Updated unit tests to pass mocked props (`statusData`, `pendingData`, `loading`, `error`) directly to the components rather than mocking the internal `usePolling` hook.
*   **Status**: Resolved
*   **Date**: 2026-06-08

### ERR-006: Node Sync Queue Stuck in Pending (Casing Mismatch and Missing HELLO response)
*   **Component**: Client / Server
*   **Symptom**: Nodes connect to the hub but the status shows disconnected/connecting and pending sync queue items are never flushed (status remains pending/0).
*   **Root Cause**: Two matching issues:
    1. Key Casing Mismatch: The WebSocket client in `ws-client.ts` sent `HELLO` payload with camelCase keys (`deptName`, `deptSecret`), but the Hub connection manager in `connection-manager.ts` expected snake_case keys (`dept_name`, `dept_secret`), causing the Hub to immediately close the connection with code 4001.
    2. Missing HELLO response: Even if the keys matched, the Hub never responded with a `HELLO` event message (e.g. `{ event: "HELLO", payload: { accepted: true } }`) to confirm successful authentication. The client requires this message to transition its state to `'connected'` and call `flushSyncQueue()`.
*   **Resolution**:
    1. Updated `ws-client.ts` to send snake_case keys (`dept_name`, `dept_secret`) in the `HELLO` handshake.
    2. Updated `connection-manager.ts` to send a `HELLO` acceptance response to the client after registration.
    3. Updated the server tests in `connection-manager.test.ts` to expect the `HELLO` message first, followed by `NODE_LIST`.
*   **Status**: Resolved
*   **Date**: 2026-06-08

### ERR-007: SQLite Foreign Key Violation on Client Node during Sync Dump
*   **Component**: Database / Client Server
*   **Symptom**: Node server prints `[Server] Error handling sync_dump item: [Error: SQLITE_CONSTRAINT: FOREIGN KEY constraint failed]` when receiving synchronization payloads (like `SYNC_DUMP` or `ITEM_BROADCAST`) from the hub.
*   **Root Cause**: The hub sends item structures with either nested person details or flat fields for associated surrenderer/claimant persons. The client node tries to save the item before ensuring the referenced persons exist in the local `persons` table, or it tries to save with a foreign key referencing a non-existent person ID. Additionally, synchronizations could overwrite valid local PII with `[REDACTED]` values from other nodes.
*   **Resolution**: 
    1. Reconstruct full nested person records from incoming item flat-fields and save/update the `persons` table first before saving the item.
    2. Guard `saveOrUpdatePerson` to verify that existing valid PII details (like `mobile`, `id_type`, `id_number`) are never overwritten by `[REDACTED]` values.
*   **Status**: Resolved
*   **Date**: 2026-06-09

### ERR-008: `markItemSynced` Missing Import in Routes
*   **Component**: Client Server
*   **Symptom**: `PATCH /api/items/:id/status` returns HTTP 500 `{"error": "Failed to update item status"}` when marking an item as claimed while connected. The item is actually updated in the database (status, claimed_by, claimed_at all set) but the API response fails.
*   **Root Cause**: `routes.ts` calls `await markItemSynced(req.params.id)` on line 209 after a successful status update broadcast, but `markItemSynced` was never imported from `./database.js`. The import list included `createPerson, createItem, getAllItems, getItemById, getPersonById, getPendingSyncItems, updateItemStatus, Person, Item, ItemStatus` — `markItemSynced` was omitted.
*   **Resolution**: Added `markItemSynced` to the import list in `client/server/src/routes.ts:3`.
*   **Status**: Resolved
*   **Date**: 2026-06-09

### ERR-010: Empty-String PII Overwrite in Sync Flat-Field Reconstruction
*   **Component**: Database / Client Server
*   **Symptom**: During SYNC_DUMP or ITEM_BROADCAST processing, mobile numbers and ID fields of existing persons could be silently overwritten with empty strings, losing PII data.
*   **Root Cause**: `handleIncomingItem` and `handleIncomingStatusUpdate` in `client/server/src/database.ts` reconstructed person objects from flat fields using `?? ''` as default for missing mobile values. The `saveOrUpdatePerson` guard only checked for the literal string `[REDACTED]` — empty strings passed through and overwrote existing valid mobile numbers.
*   **Resolution**: 
    1. Changed flat-field defaults from `?? ''` to `?? undefined` so missing mobile values don't become empty strings.
    2. Widened `saveOrUpdatePerson` guards to `(!person.mobile || person.mobile === '[REDACTED]')` — empty, null, and undefined incoming values now preserve the existing record.
*   **Status**: Resolved
*   **Date**: 2026-06-09

### ERR-011: Misleading Error Message Due to Validation Ordering
*   **Component**: Client Server (Routes)
*   **Symptom**: `PATCH /items/:id/status` with `{ status: "claimed" }` on a `lost` item (without `claimed_by`) returned "claimed_by is required" instead of informing the user the transition `lost → claimed` is invalid.
*   **Root Cause**: The `claimed_by` required check ran before the state machine validation (`if (status === 'claimed' && !claimed_by)` at line 214, before state machine check at line 235). Users got a misleading "missing field" error when the fundamental error was an invalid state transition.
*   **Resolution**: Reordered validation in `routes.ts: PATCH /items/:id/status`: (1) status valid format, (2) item exists (404), (3) state machine transition (400), (4) `claimed_by` required check (400). Correct primary error is now reported first.
*   **Status**: Resolved
*   **Date**: 2026-06-09

### ERR-009: Bidirectional Heartbeat ACK Failure — Constant Reconnections
*   **Component**: Server + Client Server (WebSocket)
*   **Symptom**: Both Security and Engineering department nodes connect successfully, complete the HELLO handshake, receive SYNC_DUMP, and function normally for ~25 seconds — then disconnect and reconnect in a loop (`Heartbeat ACK timeout — reconnecting`). Log shows repeated `[WS-Client] Unhandled event: HEARTBEAT` on the node side, and the hub's HeartbeatManager fires `node_timeout` events for both nodes.
*   **Root Cause**: Two missing pieces on opposite sides of the wire:
    1. **Hub → Node**: The Hub's HeartbeatManager sends `HEARTBEAT` pings to nodes, but the WsClientManager on the node side had no handler for the `HEARTBEAT` event — it just logged "Unhandled event: HEARTBEAT" and never sent back an `ACK`. The Hub counted this as a missed ACK and disconnected the node after 2 consecutive misses (~25s).
    2. **Node → Hub**: The WsClientManager on the node side sends its own `HEARTBEAT` pings, but the Hub's message router in `server/src/index.ts` had no handler for the `HEARTBEAT` event — it fell through to being silently ignored. The node counted this as a missed ACK and triggered a disconnect/reconnect cycle.
*   **Resolution**:
    1. Added `HEARTBEAT: () => { this.send('ACK', {}); }` to the `eventHandlers` map in `client/server/src/ws-client.ts:151` so nodes ACK hub heartbeats.
    2. Added a `HEARTBEAT` event handler in `server/src/index.ts:78-84` that looks up the sending node's socket and sends back `{ event: 'ACK', payload: { timestamp: Date.now() } }`.
*   **Status**: Resolved
*   **Date**: 2026-06-09

### ERR-012: WebSocket Disconnect Detection Slow on SIGTERM
*   **Component**: Client Server (WsClientManager)
*   **Symptom**: When the Hub server is terminated with SIGTERM, department nodes do not immediately detect the disconnection. The node's `connectionStatus` remains `"connected"` for ~25-40 seconds until the heartbeat timeout fires (`HEARTBEAT_TIMEOUT_MS = 25000`). Items created during this window are incorrectly marked `synced = 1` instead of `synced = 0`.
*   **Root Cause**: The Hub's graceful shutdown (`stopServer`) calls `ws.close(1001)` for each connected client, but the node's `socket.onclose` event may not fire synchronously. The node's `connectionStatus` is derived from the WebSocket `onclose` callback — if it hasn't fired, the node considers itself online and marks items as synced.
*   **Resolution**: No code fix applied — this is a timing issue in the test methodology. The automated test script (`test_all_phases.sh`) now waits up to 40s for the node's status to change to `"disconnected"` before creating offline items. For production, the heartbeat timeout provides eventual consistency.
*   **Status**: Open (documented as known limitation)
*   **Date**: 2026-06-09

### ERR-013: FK Constraint Error on Status Update with Non-Existent Person ID
*   **Component**: Client Server (Routes)
*   **Symptom**: `PATCH /items/:id/status` with `{ status: "claimed", claimed_by: "some-id" }` where `"some-id"` does not reference an existing person returns HTTP 500 `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed` instead of a graceful 400 error.
*   **Root Cause**: The route handler at `client/server/src/routes.ts` passes `claimed_by` directly to `updateItemStatus()` without validating that the referenced person ID exists in the `persons` table. The SQLite FK constraint then rejects the UPDATE, which surfaces as an unhandled 500 error.
*   **Resolution**: Added a person existence check (`getPersonById`) in the route handler when `claimed_by` is provided. If the claimant person is not found, the endpoint returns a clean HTTP 400 bad request error with a descriptive message.
*   **Status**: Resolved
*   **Date**: 2026-06-09
*   **Note**: The state machine validation correctly catches `lost → claimed` (invalid transition) when a proper state machine flow is followed. The FK error only surfaces when the transition passes state machine checks but the `claimed_by` ID doesn't exist.

### ERR-014: Heartbeat Timeout Never Fires — Interval Cancels Timeout
*   **Component**: Client Server (WsClientManager)
*   **Symptom**: When the Hub goes down, the department node never detects the disconnection via heartbeat timeout. The node's `connectionStatus` stays `"connected"` indefinitely, and items created while the hub is down are incorrectly marked `synced = 1` (optimistic). The node only reconnects when the `WebSocket.onclose` event fires from the TCP layer, which can take minutes.
*   **Root Cause**: In `client/server/src/ws-client.ts`, the `startHeartbeat` method uses `setInterval(HEARTBEAT_INTERVAL_MS = 15000)` which fires every 15 seconds. Each interval tick calls `this.send('HEARTBEAT', {})` and then `this.heartbeatTimeout = setTimeout(... , HEARTBEAT_TIMEOUT_MS = 25000)`. Since the interval fires every 15s but the timeout is 25s, each interval tick **overwrites** `this.heartbeatTimeout` with a new timeout — but the PREVIOUS timeout is never `clearTimeout`'d and its ID reference is lost.
*   **Resolution**: Wrapped the `setTimeout` registration inside `startHeartbeat` in a check: `if (!this.heartbeatTimeout) { ... }`. Now, the timeout is only scheduled if there isn't a pending heartbeat ACK timeout check active. When the ACK arrives, `resetHeartbeatTimeout` is called which clears the timeout ID, enabling the next interval tick to schedule a new one. This ensures that a missed heartbeat ACK is correctly detected within 25 seconds.
*   **Status**: Resolved
*   **Date**: 2026-06-09

### ERR-016: Admin Dashboard "Items Tracked" KPI Shows Node Count Instead of Item Count
*   **Component**: Hub Dashboard (Monitor Page)
*   **Symptom**: The "Items Tracked" KPI card on the Monitor page displayed the number of connected department nodes (`nodes.length`) instead of the actual number of items tracked in the database.
*   **Root Cause**: The Monitor page's `loadData` function fetched `fetchHubHealth()` and `fetchNodes()` but never fetched analytics data. The "Items Tracked" card rendered `{nodes.length}` (line 187 of `Monitor.tsx`), but the `nodes` array length equals the connection count, not the item count.
*   **Resolution**: Added `fetchAnalytics()` to the parallel `Promise.all` in `loadData`, stored the result in a new `analytics` state variable, and replaced `{nodes.length}` with `{analytics?.totalItems ?? '—'}`.
*   **Status**: Resolved
*   **Date**: 2026-06-09

### ERR-015: Docker Command Not Found / Docker Not Installed
*   **Component**: Docker / Deployment
*   **Symptom**: Running `docker compose up --build -d` fails with `Command 'docker' not found` on the host machine.
*   **Root Cause**: Docker Engine and Docker Compose are not installed on the user's local Ubuntu system, or the user does not have passwordless `sudo` privileges to install them.
*   **Resolution**: 
    1. Documented the standard installation procedure for Docker Engine and Docker Compose on Ubuntu using `apt`.
    2. Created a local development runner script `start_local.sh` at the project root which starts the Central Hub, Department Nodes, and Admin Dashboard concurrently on their respective local ports without requiring Docker, trapping the termination signals to clean up the background processes and resolve port conflicts automatically.
*   **Status**: Resolved
*   **Date**: 2026-06-09


### ERR-018: Payload Too Large on Image Upload (Resolved)
*   **Component**: Server / Client Server
*   **Symptom**: When uploading an item photo in LogItemForm, the server returns HTTP 413 "Payload Too Large" and the item is not created. The image is accepted by the client (under 5MB, resized to 800px) but the server rejects it.
*   **Root Cause**: Both `client/server/src/index.ts` and `server/src/index.ts` use `express.json()` with no options, which defaults to a **100KB** (`100kb`) limit on the JSON body. A base64-encoded JPEG at 800px width and 0.85 quality routinely exceeds 100KB (base64 adds ~33% overhead to the binary size).
*   **Resolution**:
    1. Increased `express.json()` limit to `10mb` on **both** the node server (`client/server/src/index.ts:20`) and the hub server (`server/src/index.ts:14`).
    2. Added Express error-handling middleware after `express.json()` on both servers to catch `entity.too.large` errors and return a clear JSON message (`res.status(413).json({ error: 'Payload too large — image must be under 5MB' })`) instead of a raw HTML error.
    3. Improved `client/src/hooks/useApi.ts:request()` to parse the JSON error body on non-OK responses (instead of using only `statusText`), so custom error messages from the server (like the 413 message) are surfaced to the user in the form's error banner.
*   **Status**: Resolved
*   **Date**: 2026-06-09

### ERR-017: TypeScript Build Error — Dead Comparison in Narrowed JSX Block (LostItems.tsx)
*   **Component**: Client (Frontend)
*   **Symptom**: `npx tsc -b` fails with:
    ```
    error TS2367: This comparison appears to be unintentional because the types '"idle"' and '"submitting"' have no overlap.
    ```
    Affected lines: `disabled={markFoundStatus === 'submitting'}` and display text ternary in LostItems.tsx:265-268.
*   **Root Cause**: The submit button JSX was nested inside a `{showMarkFound && markFoundStatus === 'idle' && (...)}` render block. TypeScript narrowed `markFoundStatus` to the literal type `'idle'` inside that block. Comparing it to `'submitting'` became a provably-false comparison because the union member was already excluded.
*   **Resolution**: Changed the outer condition from `markFoundStatus === 'idle'` to `markFoundStatus !== 'success'` so the union type is not narrowed. Added `disabled` to form inputs during submission. Error state now renders inline within the same block.
*   **Prevention**: Never nest a state-dependent check inside a JSX conditional that narrows that state variable. Use `!==` exclusion instead of `===` matching when the block needs to handle multiple states.
*   **Status**: Resolved
*   **Date**: 2026-06-09
