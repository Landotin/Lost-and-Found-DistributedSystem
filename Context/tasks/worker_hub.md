# Task Contract: Hub Backend Implementation (`Context/tasks/worker_hub.md`)

Your objective is to implement the Central Hub backend logic for Phase 3: Global Ledger.

## 📁 Target Files
- `server/src/database.ts`
- `server/src/connection-manager.ts`
- `server/src/index.ts`
- `server/src/index.test.ts` (or add new tests)

## 📋 Requirements

### 1. Database Helpers (`server/src/database.ts`)
- Implement `savePerson(person)`: Insert or ignore the person into the `persons` table.
- Implement `saveItem(item)`: Upsert the item. Check if the item exists. If it does, compare the incoming `updated_at` (or `created_at` fallback) with the existing database `updated_at`. Only update if the incoming timestamp is newer.
- Implement `getSyncDumpForNode(deptName)`: Fetch all items and their corresponding surrenderer and claimant details from the database. Redact the phone numbers (`mobile`) and ID details (`id_type`, `id_number`) to `"[REDACTED]"` if the item does not originate from the requesting department (`item.department_origin !== deptName`).

### 2. Connection Manager & Broadcasting (`server/src/connection-manager.ts`)
- Implement `broadcastToOthers(senderSocketId, event, payload)`: Send the WebSocket message to all connected department nodes except the one identified by `senderSocketId`.

### 3. Event Handling & Synchronization (`server/src/index.ts`)
- Handle the `HELLO` handshake acceptance: Immediately query `getSyncDumpForNode(deptName)` and send a `SYNC_DUMP` event to the connecting socket:
  ```json
  { "event": "SYNC_DUMP", "payload": { "items": [...] } }
  ```
- Handle `ITEM_BROADCAST`: Save the item and person details (if provided in `surrendered_by` object) using the DB helpers, and broadcast the redacted item details to all other nodes.
- Handle `STATUS_UPDATE`: Save the item's new status and claimant details (if provided in `claimed_by` object) using the DB helpers, and broadcast the status update to all other nodes.
- Handle `SYNC_QUEUE_FLUSH`: Iterate over the batch of items, save each one using `saveItem` and `savePerson` (with LWW resolution), and broadcast them to other nodes.

## 🧪 Testing Requirement
- Write integration tests verifying `SYNC_DUMP` sending, LWW conflict resolution, and PII redaction rules on the Hub server.
- All server tests must pass.
