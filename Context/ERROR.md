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

### ERR-003: Subagent API Model Compatibility Failure (Resolved with Workaround)
*   **Component**: Agent Orchestration / Claude Code API
*   **Symptom**: All subagent spawns (worker, spec-gatherer) fail immediately with HTTP 400: `thinking options type cannot be disabled when reasoning_effort is set`. Occurs when the main session uses Opus 4.8 with high effort and the agent definition YAML specifies `model: deepseek-v4-flash`.
*   **Root Cause**: The deepseek model does not support the `reasoning_effort` parameter being set (or unset) in the same way as Anthropic models. The main session's high-effort setting conflicts with the agent's model configuration.
*   **Resolution (Workaround)**: Manually implemented all Phase 1 code inline rather than via subagent spawning. For future phases, either: (a) change agent model to `sonnet` or `haiku` in `.claude/agents/*.md`, or (b) run workers in separate terminal sessions with independent model settings via `claude -p --model sonnet`.
*   **Status**: Resolved (workaround applied). Permanent fix deferred to agent config review before Phase 2.
*   **Date**: 2026-06-08
