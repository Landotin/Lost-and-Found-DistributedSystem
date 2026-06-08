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
