# Task Contract: Node Server Backend Implementation (`Context/tasks/worker_node_server.md`)

Your objective is to implement the Department Node local server backend logic for Phase 3: Global Ledger.

## 📁 Target Files
- `client/server/src/database.ts`
- `client/server/src/ws-client.ts`
- `client/server/src/routes.ts`
- `client/server/src/index.ts`
- `client/server/src/index.test.ts` (or add new tests)

## 📋 Requirements

### 1. Local Database LWW Helpers (`client/server/src/database.ts`)
- Implement `saveOrUpdatePerson(person)`: Insert the person into `persons` table. If the person already exists, update their details. Ensure you do NOT overwrite a valid, existing `mobile` phone number with `"[REDACTED]"`.
- Implement `handleIncomingItem(item)`: Process incoming items from the Hub (from `SYNC_DUMP` or `ITEM_BROADCAST`). Save the associated person first. Then upsert the item using Last-Write-Wins (LWW) resolution based on the `updated_at` timestamp. Set `synced = 1` for the upserted item since it is coming from the Hub.
- Implement `handleIncomingStatusUpdate(payload)`: Process incoming status updates from the Hub. Update the item's status, `claimed_by` reference, `claimed_at`, and `updated_at` using LWW. Set `synced = 1`.

### 2. Full Person Payloads & ws-client updates (`client/server/src/ws-client.ts`, `client/server/src/routes.ts`)
- Update `WsClientManager.flushSyncQueue()`: For each pending item, fetch the associated surrenderer person details from the local database and include the full person object in the `surrendered_by` payload rather than just the ID.
- Update `client/server/src/routes.ts`:
  - When sending `ITEM_BROADCAST` via API `POST /api/items`, retrieve the full surrenderer person details and include the person object in `surrendered_by`.
  - When sending `STATUS_UPDATE` via API `PATCH /api/items/:id/status`, retrieve the claimant details and include the person object in `claimed_by`.

### 3. Register Event Listeners (`client/server/src/index.ts`)
- Register event handlers on `wsManager` for the following:
  - `sync_dump`: Loop over items and apply `handleIncomingItem`.
  - `item_broadcast`: Process the broadcasted item via `handleIncomingItem`.
  - `status_update`: Process the status update via `handleIncomingStatusUpdate`.

## 🧪 Testing Requirement
- Write unit/integration tests to verify that `sync_dump`, `item_broadcast`, and `status_update` update the local database correctly without overwriting valid data with redacted placeholders.
- All client-server tests must pass.
