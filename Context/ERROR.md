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
