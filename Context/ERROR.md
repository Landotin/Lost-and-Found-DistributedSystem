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
