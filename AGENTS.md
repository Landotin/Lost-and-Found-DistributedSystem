# AI Agent Developer Guide (`AGENTS.md`)

Welcome! You are pair-programming with Jed Fetalino on the **Real-Time Distributed Lost & Found Tracker (RDLFT)**. This guide outlines the project's technical rules, stack requirements, coding conventions, and agent boundaries.

---

## 1. Project Context & Stack

RDLFT is a fault-tolerant, horizontally scalable distributed system showcasing parallel and distributed systems concepts.

*   **Frontend**: React + TypeScript + Vite + Tailwind CSS
*   **Backend**: Node.js + Express + native `ws` WebSocket library
*   **Database**: SQLite (embedded in both backend and individual nodes)
*   **Deployment/Orchestration**: Docker + Docker Compose

---

## 2. Agent Principles & Core Guidelines

As the developer agent, you must strictly adhere to the following rules:

### A. Architectural Integrity
1.  **Hub-and-Spoke Autonomy**: Do not write code that assumes the Central Hub is always online. Nodes must run fully offline, writing to a local SQLite database and marking transactions as `synced = 0`.
2.  **LWW Conflict Resolution**: Ensure all item schema updates include an `updated_at` timestamp. Conflict resolution on synchronization uses Last-Write-Wins (LWW).
3.  **Strict WebSocket Protocol**: Keep the WebSocket event structure simple and strict as defined in `Context/PRD.md`. Do not introduce bloated custom libraries. Use standard event format:
    ```json
    { "event": "EVENT_NAME", "payload": { ... } }
    ```
4.  **PII Privacy**: Strip PII (like phone numbers) from broadcasts sent to unrelated department nodes. Hub-to-origin-node and hub-to-admin transmissions can preserve PII.

### B. Coding Standards
*   **TypeScript**: Write strictly-typed TypeScript. Avoid using `any` or `unknown` unless absolutely necessary. Define clear interfaces for WebSocket events and SQLite entities.
*   **SQLite Operations**: Use clean, async/await parameterized SQL queries to prevent injection attacks and ensure database performance. Always handle connection locks gracefully.
*   **Tailwind CSS**: Build beautiful, responsive interfaces using Tailwind CSS. Follow modern design standards (dark modes, state-indicating LED badges, alerts).
*   **No Placeholders**: Never write boilerplate/placeholder UI comments. Every form field and connection status badge must be fully functional.
*   **Readability & Maintainability**: Prioritize clean, self-documenting code over cleverness. Use highly descriptive variable and function names, follow single-responsibility principles (small, modular functions), and write meaningful comments for non-obvious code paths. Avoid over-engineering or deeply nested structures to keep the codebase easy for humans and other agents to audit.
*   **Test-Driven Development (TDD)**: Follow a strict test-driven workflow. Write unit and integration tests *before* writing the corresponding business logic or components. All code modifications must be verified by running the test suite to ensure correctness and prevent regressions.

### C. Workspace & Git Hygiene
*   **Git Branches**: Ensure code is committed in logical chunks.
*   **No Hardcoded Secrets**: Use environment variables (`DEPT_NAME`, `SERVER_WS_URL`, `DEPT_SECRET`) for all configuration details. Do not commit secrets.

---

## 3. Operational Workflow

For any development task, follow the lifecycle below:
1.  **Read and Align**: Check `AGENTS.md` (this file), `MEMORY.md`, and `Context/PRD.md` before making changes.
2.  **Verify & Log Errors**: Practice TDD. Write failing tests first, implement the code to pass the tests, and run automated checks to verify correctness. Log any compile-time or runtime errors into `Context/ERROR.md`. Once an error is resolved, update its entry in the registry to `Status: Resolved`, documenting the exact root cause and resolution. Reference the error ID (e.g., `ERR-001`) in code comments to clarify complex logic or workarounds.
3.  **Run Integration Tests**: After implementing features or fixing bugs, run the comprehensive curl integration test suite to verify end-to-end behavior:
    ```bash
    # Clean start (optional — removes old database files):
    rm -f server/data/hub.db* client/server/data/*.db* data/hub.db* data/node.db*
    # Run all 84+ tests:
    bash test_all_phases.sh
    ```
    Or use the `/verify` slash command to invoke the skill which runs the same suite.
    The script auto-starts Hub (port 5000), Security (3001), and Engineering (3002) nodes, runs all Phase 1-5 tests plus edge cases, and reports pass/fail counts. Address any failures before considering the task complete.
4.  **Maintain Memory**: Update `MEMORY.md` at the end of each session or task to keep track of decisions, state, and next steps. Specifically, ensure `MEMORY.md` tracks:
    *   **Append-Only History**: Always append new architectural decisions (ADRs) or session progress logs rather than overwriting historical memory, retaining a clean audit trail of project changes.
    *   **Task Compile**: A high-level compilation/summary of the work executed.
    *   **Completed Tasks**: Tasks successfully finished in the current run (marked with `[x]`).
    *   **Current Task**: The task currently in progress or active (marked with `[/]`).
    *   **Pending Tasks**: Remaining tasks to be done (marked with `[ ]`).

---

## 4. Documentation & OpenSrc Guidelines

To ensure the agent adheres to the latest framework features and best practices:
1.  **OpenSrc Integration**: If you need to inspect the source code, type definitions, or exact behavior of an npm package (e.g., `ws`, `express`, `sqlite3`), run:
    ```bash
    npx opensrc <package_name>
    ```
    And use the returned path to examine the actual package code or documentation in its cached location (usually under `~/.opensrc/`).
2.  **Documentation Store**: If any specific framework guides, API references, or best practices are fetched or created, save them under `Context/docs/` (e.g., `Context/docs/websocket-best-practices.md`) so all future agent runs read and strictly follow them.
3.  **Best Practices Compliance**:
    *   **React**: Use functional components, hooks (`useState`, `useEffect`), and strictly typed TypeScript interfaces.
    *   **ws**: Handle WebSocket close events, heartbeats (pings/pongs), and buffer serialization/deserialization safely.
    *   **SQLite**: Use async wrapper libraries (like `sqlite` / `sqlite3`) and always use parameterized queries to prevent SQL injection.

---

## 5. Item Lifecycle & Status Transitions

Items follow a strict state machine: `lost → found → claimed`. The `claimed` state is terminal.

### Extended "Mark as Found" Flow (Phase 7+)

Lost items can now be **marked as found** with surrenderer (finder) information attached to the same record:

- **`PATCH /items/:id/status`** accepts an optional `surrendered_by` (person ID) when the target status is `'found'`.
- **`STATUS_UPDATE`** WebSocket event carries optional `surrenderer` person data (full `Person` object) alongside the existing `claimant` data.
- The hub's STATUS_UPDATE handler (`server/src/index.ts`) saves the surrenderer person and updates `surrendered_by` on the item.
- The node's `handleIncomingStatusUpdate()` (`client/server/src/database.ts`) saves the surrenderer person with the `[REDACTED]` guard and updates the item via LWW.
- Frontend: LostItems DetailModal shows a "Mark as Found" button → surrenderer form → creates person + patches item.

**STATUS_UPDATE payload format:**
```typescript
{
  id: string;
  status: string;
  claimed_by?: Person | null;       // full person object (for 'claimed' transitions)
  surrenderer?: Person | null;      // full person object (for 'found' transitions)
  updated_at?: string;
}
```

### Phase 2 — Smart Matching (LogItemForm) ✓ Complete

When logging an item, the system should check for existing opposite-direction records and suggest the correct action:

- Logging a **found** item → search existing `lost` items for name match → suggest "This matches a lost report — mark it as found instead"
- Logging a **lost** item → search existing `found` items for name match → suggest "This was already found — claim it instead"
- Suggestions are non-blocking banners — user can dismiss and proceed normally
- Cross-tab routing: "Mark as Found" switch to LostItems, "Claim Instead" switch to ProcessClaim


