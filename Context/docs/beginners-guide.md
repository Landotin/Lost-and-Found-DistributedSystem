# Real-Time Distributed Lost & Found Tracker (RDLFT) — Beginner's Guide & Manual Verification Tutorial

Welcome to the **RDLFT** project! This guide explains how the system operates, how to start all services locally, and how to verify its offline synchronization and fault-tolerant behaviors.

---

## 1. System Overview

RDLFT is a local-first, distributed system. It allows different physical departments (like Security or Admissions) to log lost & found items. Even if the Central Hub goes down or the network fails, staff can still record items locally. The system caches these records and automatically synchronizes them when the connection is restored.

### Key Components

*   **Central Hub (`server/`)**: A WebSocket server that maintains the active connection list and acts as a central ledger. It broadcasts status updates and shares new items across department nodes.
*   **Department Node Server (`client/server/`)**: A local Express app running inside each department. It manages a local SQLite database and maintains a persistent WebSocket client connecting to the Central Hub.
*   **Node Frontend Client (`client/`)**: A React user interface that queries the local Node server. It includes a connection badge (LED indicator) and an offline warning banner.

---

## 2. Startup Instructions

To make local development easy, `.env` files have been automatically created in the `server/` and `client/server/` directories containing standard development secret values.

To run and test the system locally, you need three separate terminals:

### Terminal 1: Start the Central Hub
```bash
cd "/home/jed/Personal Projects/Lost and Found/server"
npm run dev
```
*   **Port**: `http://localhost:5000` (WebSocket on `ws://localhost:5000`)

### Terminal 2: Start the Local Department Node Server
```bash
cd "/home/jed/Personal Projects/Lost and Found/client/server"
npm run dev
```
*   **Port**: `http://localhost:3001`
*   Upon startup, the local node reads the database configuration and connects to the Central Hub, completing the `HELLO` handshake.

### Terminal 3: Start the Frontend React Client
```bash
cd "/home/jed/Personal Projects/Lost and Found/client"
npm run dev
```
*   **Port**: `http://localhost:5173`
*   Open a browser to [http://localhost:5173](http://localhost:5173).


---

## 3. Step-by-Step Manual Verification Scenarios

### Scenario A: Online Sync Verification
1.  Verify the Central Hub, Node Server, and React client are all running.
2.  Open [http://localhost:5173](http://localhost:5173).
3.  Check the top-right indicator: It should display a **Green LED** and say `Connected (1 node)`.
4.  Fill out the **Log Item** form:
    *   **Item Name**: `iPhone 13`
    *   **Category**: `Electronics`
    *   **Status**: `Lost`
    *   **Description**: `Blue phone with cracked screen protector`
5.  Submit the form. It should show a checkmark and state `Logged successfully`.
6.  Query the local SQLite database to confirm the item is registered and marked as synced (`synced = 1`):
    ```bash
    sqlite3 "/home/jed/Personal Projects/Lost and Found/client/server/data/node.db" "SELECT item_name, status, synced FROM items;"
    ```
    *Expected output*:
    `iPhone 13|lost|1`

---

### Scenario B: Offline Sync Verification (Simulating network partitioning)
1.  With the React client open, go to **Terminal 1** (Central Hub) and stop the server (`Ctrl + C`).
2.  Observe the React client header:
    *   The LED indicator should turn **Red** and show `Disconnected`.
    *   An amber banner will appear: `⚠️ Working Offline — 0 items pending sync`.
3.  Fill out the **Log Item** form for a found item:
    *   **Item Name**: `Leather Wallet`
    *   **Category**: `Personal Effects`
    *   **Status**: `Found`
    *   **Description**: `Brown wallet containing cash and a driver's license`
    *   **Surrenderer Full Name**: `John Doe`
    *   **Surrenderer Mobile**: `+639171234567`
4.  Submit the form. Because the Hub is offline, the React client will log the item locally. The amber banner will update to: `⚠️ Working Offline — 1 item pending sync`.
5.  Go to the **Pending Sync** tab. You should see the `Leather Wallet` listed with a `synced` status of `0`.
6.  Query the database to verify the unsynced entry:
    ```bash
    sqlite3 "/home/jed/Personal Projects/Lost and Found/client/server/data/node.db" "SELECT item_name, status, synced FROM items;"
    ```
    *Expected output*:
    `iPhone 13|lost|1`
    `Leather Wallet|found|0`

---

### Scenario C: Reconnection & Queue Recovery
1.  Go back to **Terminal 1** (Central Hub) and restart the server:
    ```bash
    npm run dev
    ```
2.  Observe the React client. Within a few seconds, the Node's WebSocket client will reconnect.
3.  The LED indicator will change to **Green** (`Connected`).
4.  The offline banner and the `Leather Wallet` row in the **Pending Sync** tab will disappear.
5.  Query the database to verify that the item's synced status was automatically updated:
    ```bash
    sqlite3 "/home/jed/Personal Projects/Lost and Found/client/server/data/node.db" "SELECT item_name, status, synced FROM items;"
    ```
    *Expected output*:
    `iPhone 13|lost|1`
    `Leather Wallet|found|1`

---

### Scenario D: Form Submission Retry & Person Record Integrity
This test verifies the fix preventing duplicate person records on form retry.
1.  Disconnect the Hub server (`Ctrl + C`).
2.  Fill out the **Log Item** form for a found item:
    *   **Item Name**: `Keys`
    *   **Category**: `Keys`
    *   **Status**: `Found`
    *   **Surrenderer Full Name**: `Jane Smith`
    *   **Surrenderer Mobile**: `+639179876543`
3.  To trigger a submission error at the item creation stage, open another terminal and temporarily rename the local node database to lock SQLite writes, or simulate a 500 error from the local server's `/api/items` endpoint.
4.  Submit the form. The form should fail, displaying an error status and a "Retry" button.
5.  Restore SQLite or the server back to normal operation.
6.  Click **Retry**.
7.  Check the database: Only *one* person record for `Jane Smith` should exist.
    ```bash
    sqlite3 "/home/jed/Personal Projects/Lost and Found/client/server/data/node.db" "SELECT full_name FROM persons;"
    ```
    *Expected output*:
    `John Doe`
    `Jane Smith` *(Verify it is not listed twice)*

---

### Scenario E: PII Privacy, Dynamic Redaction, and Multi-Node Broadcasts
This scenario verifies that sensitive PII (mobile, ID type, ID number) is dynamically redacted when an item or status update is broadcast to unrelated department nodes, while remaining fully visible on the originating node and the Central Hub.

#### Step 1: Start the Central Hub
Ensure the Hub is running on port 5000:
```bash
cd "/home/jed/Personal Projects/Lost and Found/server"
npm run dev
```

#### Step 2: Start Node 1 (Security) on Port 3001
Run the Security node with a dedicated database `data/security.db`:
```bash
cd "/home/jed/Personal Projects/Lost and Found/client/server"
PORT=3001 DEPT_NAME=Security DB_PATH=data/security.db DEPT_SECRET=DEPT_SECRET npm run dev
```

#### Step 3: Start Node 2 (Library) on Port 3002
In a new terminal window, run the Library node with a separate database `data/library.db` and port 3002:
```bash
cd "/home/jed/Personal Projects/Lost and Found/client/server"
PORT=3002 DEPT_NAME=Library DB_PATH=data/library.db DEPT_SECRET=DEPT_SECRET npm run dev
```

#### Step 4: Register a Person at Node 1 (Security)
Send a POST request to create the surrenderer person on the Security node:
```bash
curl -X POST http://localhost:3001/api/persons \
  -H "Content-Type: application/json" \
  -d '{"full_name": "Alice Miller", "mobile": "+639155554321", "id_type": "Passport", "id_number": "P9876543A"}'
```
*Expected response*:
```json
{
  "id": "SOME_PERSON_UUID",
  "full_name": "Alice Miller",
  "mobile": "+639155554321",
  "id_type": "Passport",
  "id_number": "P9876543A"
}
```
*(Copy the generated `id` UUID from the response to use as `surrendered_by` in the next step).*

#### Step 5: Log a Found Item at Node 1 (Security)
Create the item on the Security node using the `id` from the previous response:
```bash
curl -X POST http://localhost:3001/api/items \
  -H "Content-Type: application/json" \
  -d '{"item_name": "Gold Ring", "category": "Jewelry", "status": "found", "surrendered_by": "SOME_PERSON_UUID"}'
```
*Expected response*:
```json
{
  "id": "SOME_ITEM_UUID",
  "item_name": "Gold Ring",
  "description": null,
  "category": "Jewelry",
  "department_origin": "Security",
  "status": "found",
  "surrendered_by": "SOME_PERSON_UUID",
  "synced": 1
}
```
*(Copy the generated item `id` UUID to use in the following steps).*

#### Step 6: Verify PII Retention on Node 1 (Security)
Query the Security node for the item's details. It should display Alice Miller's full PII because Security is the item's origin department:
```bash
curl http://localhost:3001/api/items/SOME_ITEM_UUID
```
*Expected output contains*:
```json
"surrenderedByPerson": {
  "id": "SOME_PERSON_UUID",
  "full_name": "Alice Miller",
  "mobile": "+639155554321",
  "id_type": "Passport",
  "id_number": "P9876543A"
}
```

#### Step 7: Verify PII Redaction on Node 2 (Library)
Query the Library node for the same item. The item will have propagated via the Central Hub, but since Library is an unrelated department, the PII details must be redacted:
```bash
curl http://localhost:3002/api/items/SOME_ITEM_UUID
```
*Expected output contains*:
```json
"surrenderedByPerson": {
  "id": "SOME_PERSON_UUID",
  "full_name": "Alice Miller",
  "mobile": "[REDACTED]",
  "id_type": "[REDACTED]",
  "id_number": "[REDACTED]"
}
```

#### Step 8: Verify Claim Status Update and Redaction
Create a claimant person at Node 2 (Library):
```bash
curl -X POST http://localhost:3002/api/persons \
  -H "Content-Type: application/json" \
  -d '{"full_name": "Bob Jones", "mobile": "+639169998888", "id_type": "Driver License", "id_number": "DL-12345"}'
```
*(Copy the generated claimant `id` UUID, e.g., `CLAIMANT_UUID`).*

Now, mark the item as claimed via the Library node:
```bash
curl -X PATCH http://localhost:3002/api/items/SOME_ITEM_UUID/status \
  -H "Content-Type: application/json" \
  -d '{"status": "claimed", "claimed_by": "CLAIMANT_UUID"}'
```

Query the Security node (Node 1) to verify that the status update propagated, but Bob Jones' claimant PII details are redacted:
```bash
curl http://localhost:3001/api/items/SOME_ITEM_UUID
```
*Expected output contains*:
```json
"claimedByPerson": {
  "id": "CLAIMANT_UUID",
  "full_name": "Bob Jones",
  "mobile": "[REDACTED]",
  "id_type": "[REDACTED]",
  "id_number": "[REDACTED]"
}
```

