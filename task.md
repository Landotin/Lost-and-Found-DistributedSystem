# Phase 5 Hub Backend Tasks

Goal: Implement Admin REST APIs and Admin WebSocket events in the Central Hub (`server` directory).

## Context
Please read `AGENTS.md` and `MEMORY.md` in the root directory for full project context, architectural decisions, and agent guidelines.

## Tasks

1. **API Authorization**: Add an Express middleware in `server/src/index.ts` to validate the `x-admin-secret` header against `process.env.ADMIN_SECRET` for all `/api/admin/*` routes.
2. **Admin Endpoints**: Implement the following REST APIs in `server/src/index.ts`:
   - `GET /api/admin/nodes`: Return list of connected nodes (socketId, deptName, connectedAt) using a new method `getConnectedNodes()` on `ConnectionManager`.
   - `POST /api/admin/nodes/:id/disconnect`: Close a specific node's socket using `ConnectionManager`.
   - `POST /api/admin/nodes/:id/sync`: Trigger a `SYNC_DUMP` to a specific node (fetch all items from DB and send).
   - `GET /api/admin/items`: Fetch all items from SQLite, joining the `persons` table for full `surrendered_by` and `claimed_by` PII.
   - `GET /api/admin/analytics`: Return aggregated stats: items by department, claim rate (claimed / (found + claimed)), and total items.
3. **Admin WebSocket**: 
   - Update `ConnectionManager.handleConnection` in `server/src/connection-manager.ts` to accept `HELLO` with `{ payload: { type: 'ADMIN', secret: '<ADMIN_SECRET>' } }`. Admin connections should skip standard node registration and instead be added to an `adminNodes` map/set.
   - Modify `broadcastToOthers` in `ConnectionManager` to also send an exact, unredacted copy of every event (e.g. `ITEM_BROADCAST`, `STATUS_UPDATE`) to all connected Admin sockets for the Message Log feature.
4. **Testing**: Write unit/integration tests for these new endpoints and WebSocket behaviors in `server/src/index.test.ts` or a new test file. Ensure all existing tests still pass (`npm test`).
5. **Completion**: Keep iterating until all tests pass and the code strictly adheres to `AGENTS.md`. Report back a summary of changes.
