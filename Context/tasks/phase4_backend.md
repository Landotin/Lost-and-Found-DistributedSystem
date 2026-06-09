# Phase 4: Backend Status Transitions (Task B)

## Assigned Worktree
You are assigned to the backend worktree. Before starting, ensure your terminal is running inside the backend worktree path: `../rdlft-phase4-backend`.
If you are starting from a fresh prompt, `cd ../rdlft-phase4-backend` to access your assigned worktree.

## Context
You are implementing the backend validation logic for Phase 4 (Claims Processing) of the Real-Time Distributed Lost & Found Tracker (RDLFT). The frontend UI is being built concurrently by another agent in a separate worktree (`rdlft-phase4-frontend`).

## Core Directives
Please complete the following backend tasks. Focus strictly on API logic and state enforcement. Practice TDD, and ensure you run your tests in `client/server` and `server`.

### 1. Strict State Machine Validation (`client/server/src/routes.ts`)
- Update the `PATCH /items/:id/status` endpoint to strictly enforce the allowed state transitions:
  - `lost -> found`
  - `found -> claimed`
- Disallow any invalid transitions, for example:
  - `lost -> claimed` directly
  - `claimed -> found` or `claimed -> lost` (items cannot revert once claimed)
- If an incoming transition request is invalid based on the current item state, intercept it before writing to the database and return an `HTTP 400 Bad Request` with a descriptive JSON error message.

### 2. Backend Mobile Number Consistency (Optional but recommended)
- If there is any backend mobile number formatting/validation logic inside `routes.ts` or `database.ts` when creating persons, ensure it handles the `09...` Philippine prefix safely (e.g., converting to `+639...` or verifying it matches standard E.164 lengths).

### 3. Verification & Testing (`client/server/src/index.test.ts` or `routes.test.ts`)
- Write new unit and integration tests to verify the state transitions.
- Prove that sending a `status: 'claimed'` update for a `lost` item explicitly fails with a `400 Bad Request`.
- Prove that sending a `status: 'claimed'` update for a `found` item succeeds (`200 OK`) and accurately updates the local SQLite database.
- Ensure all backend test suites pass locally.

### 4. Automated Code Review
Once you have completed all tasks and tests pass, you must automatically invoke a Code Reviewer agent before concluding your work.
Run the following command using your bash tool:
`claude -p "Review the uncommitted git diff in this worktree for compliance with AGENTS.md, secure state transitions, and best practices. If there are issues, list them clearly. If the code is perfect, reply with 'LGTM'." --bare`

Read the output of the reviewer. If there are actionable issues, fix them and re-run the reviewer. Once the reviewer replies with 'LGTM', you may commit your changes and finish the task.
