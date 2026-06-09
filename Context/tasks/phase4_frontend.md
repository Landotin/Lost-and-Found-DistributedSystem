# Phase 4: Frontend Claims UI & Validation (Task A)

## Assigned Worktree
You are assigned to the frontend worktree. Before starting, ensure your terminal is running inside the frontend worktree path: `../rdlft-phase4-frontend`.
If you are starting from a fresh prompt, `cd ../rdlft-phase4-frontend` to access your assigned worktree.

## Context
You are implementing the frontend portion of Phase 4 (Claims Processing) for the Real-Time Distributed Lost & Found Tracker (RDLFT). The backend logic is being handled by another agent in a separate worktree (`rdlft-phase4-backend`).

## Core Directives
Please complete the following frontend tasks independently. You do not need to worry about backend logic beyond consuming the existing `useApi` hooks. Focus heavily on testing your code; ensure you run `npm run test` inside `client` and `client/server` if necessary.

### 1. Refactor Mobile Number Validation (`client/src/utils/validation.ts`)
- Update `validateMobile` to accept Philippine numbers starting with `09` (e.g., `09171234567`) in addition to the standard E.164 `+639` format.
- Add a utility function `formatMobileToE164(mobile: string): string` that safely converts `09...` to `+639...` before sending payloads to the backend API.
- Update `client/src/utils/validation.test.ts` to cover these new cases.

### 2. Process Claim Component (`client/src/components/ProcessClaim.tsx`)
- Create a new React component. It should accept an optional `preselectedItemId` prop.
- Include a search/dropdown input to find items by ID or name (filtered so that only items with `status === 'found'` are selectable).
- When an item is selected, display the Claimant form containing:
  - Full Name (required)
  - Mobile Number (required, format to E.164 on submit)
  - ID Type (optional)
  - ID Number (optional)
- **Submission Workflow**:
  1. Call the `createPerson` API (via `useApi.ts`) with the claimant details.
  2. Call the `updateItemStatus` API for the item, passing `status: 'claimed'` and `claimed_by: person_id`.
- Implement proper loading states and success/error feedback.

### 3. App Navigation (`client/src/App.tsx`)
- Add a new tab `Process Claim` in the navigation header, alongside `Log Item`.
- Introduce state for `processClaimItemId: string | null`.
- When the `Process Claim` tab is active, render `<ProcessClaim preselectedItemId={processClaimItemId} />`.

### 4. Global Ledger Integration (`client/src/components/GlobalLedger.tsx`)
- Update the `DetailModal` component.
- The `GlobalLedger` should accept a new prop: `onProcessClaim?: (itemId: string) => void`. Pass it down to `DetailModal`.
- In `DetailModal`, check `if (item.status === 'found')`. If true, render a `[Process Claim]` button.
- Clicking the button should invoke the callback, closing the modal, switching the active tab in `App.tsx` to `Process Claim`, and setting `processClaimItemId`.

### 5. Testing
- Write integration tests for `ProcessClaim.tsx` in `client/src/components/__tests__/`.
- Update `App.test.tsx` and `GlobalLedger.test.tsx` as needed.
- Ensure all frontend tests pass smoothly.

### 6. Automated Code Review
Once you have completed all tasks and tests pass, you must automatically invoke a Code Reviewer agent before concluding your work.
Run the following command using your bash tool:
`claude -p "Review the uncommitted git diff in this worktree for compliance with AGENTS.md, performance, and best practices. If there are issues, list them clearly. If the code is perfect, reply with 'LGTM'." --bare`

Read the output of the reviewer. If there are actionable issues, fix them and re-run the reviewer. Once the reviewer replies with 'LGTM', you may commit your changes and finish the task.
