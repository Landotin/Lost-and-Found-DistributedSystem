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


