# Phase 5 Hub Frontend Setup Tasks

Goal: Scaffold the Hub Dashboard React application and shared utilities.

## Context
Please read `AGENTS.md` and `MEMORY.md` in the root directory for full project context, architectural decisions, and agent guidelines.

## Tasks

1. **Vite Initialization**: Create a new Vite React TS project at `hub-dashboard/` within this worktree. Use `npx create-vite@latest hub-dashboard --template react-ts`.
2. **Dependencies**: Inside `hub-dashboard/`, run `npm install` and install `tailwindcss`, `react-router-dom`, `recharts`, `lucide-react`, and `date-fns`. Set up Tailwind CSS following standard Vite configurations.
3. **Routing & Shell Layout**:
   - In `hub-dashboard/src/App.tsx`, implement a Sidebar navigation layout using `react-router-dom`.
   - Create empty placeholder components for the 4 routes: `/monitor`, `/ledger`, `/logs`, `/analytics`.
4. **API & WS Hooks**:
   - Create `hub-dashboard/src/hooks/useAdminApi.ts` hook for fetching data with the `x-admin-secret` header. Use a `HUB_API_URL` constant or env var (defaulting to `http://localhost:5000/api`).
   - Create `hub-dashboard/src/hooks/useAdminWs.ts` hook to connect to the hub via WebSocket with `{ event: 'HELLO', payload: { type: 'ADMIN', secret: '<secret>' } }` for real-time events.
5. **Docker Compose Integration**: Add a `hub_dashboard` service to `docker-compose.yml` in the project root, building from `./hub-dashboard` and exposing port `5005`.
6. **Completion**: Ensure no linting/TypeScript errors and everything builds successfully (`npm run build`). Report back a summary of changes.
