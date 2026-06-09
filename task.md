# Phase 5 Hub Frontend Views Tasks

Goal: Implement the 4 core Admin Dashboard screens.

## Context
Please read `AGENTS.md` and `MEMORY.md` in the root directory for full project context, architectural decisions, and agent guidelines.

## Tasks

1. **Node Monitor (`hub-dashboard/src/pages/Monitor.tsx`)**:
   - Fetch nodes from `/api/admin/nodes` via `useAdminApi`.
   - Render a table displaying `deptName`, `socketId`, `connectedAt`.
   - Add action buttons on each row for "Force Sync" (`POST /api/admin/nodes/:id/sync`) and "Disconnect" (`POST /api/admin/nodes/:id/disconnect`).
2. **Global Ledger (`hub-dashboard/src/pages/Ledger.tsx`)**:
   - Fetch items from `/api/admin/items` via `useAdminApi` and render a data table showing full PII details.
   - Implement an "Export CSV" button that converts the JSON data to CSV and triggers a download.
   - Create an Item Detail modal for full record viewing.
3. **Message Log (`hub-dashboard/src/pages/Logs.tsx`)**:
   - Implement a terminal-like scrolling list of WebSocket events.
   - Connect using the `useAdminWs` hook. When an event arrives, append it to a list and auto-scroll to bottom.
   - Add "Pause Logging", "Resume", and "Clear" toggle buttons.
4. **Analytics (`hub-dashboard/src/pages/Analytics.tsx`)**:
   - Fetch data from `/api/admin/analytics`.
   - Render a Recharts bar chart showing Items by Department.
   - Render KPI cards for Claim Rate (%) and total system items.
5. **Testing & Completion**:
   - Ensure all TypeScript checks pass (`npm run build`).
   - Run linter.
   - Ensure you follow `AGENTS.md` strictly (no `any`, Tailwind styling, clean components).
   - Report back a summary of your changes.
