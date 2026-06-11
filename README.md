# Real-Time Distributed Lost & Found Tracker (RDLFT)

RDLFT is a fault-tolerant, horizontally scalable distributed system showcasing parallel and distributed systems concepts. It tracks lost and found items across independent departments in real-time.

## System Architecture

The ecosystem consists of three major components:
1.  **Central Hub Server (`/server`)**: A centralized coordination backend managing global transactions, synchronization dumps, and admin monitoring controls.
2.  **Department Nodes (`/client` + `/client/server`)**: Autonomous nodes running a local SQLite database, allowing full offline operation. When connected via WebSockets, they sync real-time item additions and claims back to the Hub and other nodes.
3.  **Hub Admin Dashboard (`/hub-dashboard`)**: A premium React dashboard for system administrators to monitor nodes, force database syncs, disconnect problematic nodes, and view unredacted item logs (PII is redacted across cross-department broadcasts for privacy).

---

## Getting Started (Local Development)

The easiest way to run the entire ecosystem locally on a single machine is using the custom `start_local.sh` runner script. It automates dependency installation, builds frontend assets, resolves port conflicts, and starts all services concurrently.

### 1. Run via Local Script (No Docker required)

```bash
# Make the script executable
chmod +x start_local.sh

# Start all servers
./start_local.sh
```

**What this script does:**
*   Checks for and terminates any process blocking port 5000, 3001, 3002, or 5005.
*   Installs dependencies (`npm install`) across all projects if `node_modules` is missing.
*   Builds the Department Node React frontend.
*   Concurrently starts:
    *   **Central Hub** on `http://localhost:5000`
    *   **College of Computer Studies Node (Dept A)** on `http://localhost:3001`
    *   **Engineering Node (Dept B)** on `http://localhost:3002`
    *   **Hub Admin Dashboard** on `http://localhost:5005`
*   Cleans up all background processes automatically when you press `Ctrl+C`.

Logs are written to: `hub.log`, `ccs.log`, `engineering.log`, and `dashboard.log` in the root directory.

### 2. Run via Docker Compose (Alternative)

If you have Docker and Docker Compose installed:

```bash
# Start containerized services
docker compose up --build -d
```

---

## Horizontal Scaling (Using Two Laptops)

To demonstrate horizontal scaling across physical machines, you can distribute the services across two laptops connected to the same local network. 

### Step 1: Network & Firewall Prep (On Both Laptops)
1. Ensure both laptops are connected to the same Wi-Fi network or router.
2. Get the local IP address of **Laptop A** (which will host the Central Hub):
   ```bash
   hostname -I | awk '{print $1}'
   # Let's assume this returns: 192.168.1.100
   ```
3. Open ports **5000** (Hub) and **5005** (Dashboard) on **Laptop A**'s firewall to allow Laptop B to connect:
   ```bash
   sudo ufw allow 5000/tcp
   sudo ufw allow 5005/tcp
   ```

---

### Option A: Bare-Metal Setup (No Docker)

#### 1. On Laptop A (Hub & Dashboard)
Run the Central Hub server and the Admin Dashboard.
*   **Central Hub**:
    ```bash
    cd server
    PORT=5000 ADMIN_SECRET=e2e-test-secret DB_PATH=../data/hub.db npx tsx src/index.ts
    ```
*   **Admin Dashboard** (Open another terminal):
    ```bash
    cd hub-dashboard
    VITE_HUB_API_URL="http://192.168.1.100:5000" VITE_HUB_WS_URL="ws://192.168.1.100:5000" VITE_ADMIN_SECRET="e2e-test-secret" npm run dev -- --port 5005 --host
    ```

#### 2. On Laptop B (Department Nodes)
Point the node backends to Laptop A's IP address:
*   **College of Computer Studies Node (Port 3001)**:
    ```bash
    cd client/server
    PORT=3001 DEPT_NAME="College of Computer Studies" DEPT_SECRET=e2e-test-secret SERVER_WS_URL=ws://192.168.1.100:5000 NODE_ENV=production DB_PATH=../../data/ccs.db npx tsx src/index.ts
    ```
*   **Engineering Node (Port 3002)** (Open another terminal):
    ```bash
    cd client/server
    PORT=3002 DEPT_NAME="Engineering" DEPT_SECRET=e2e-test-secret SERVER_WS_URL=ws://192.168.1.100:5000 NODE_ENV=production DB_PATH=../../data/engineering.db npx tsx src/index.ts
    ```

---

### Option B: Docker Compose Setup

#### 1. On Laptop A (Hub & Dashboard)
Build and run only the `hub` and `hub_dashboard` containers. We must pass Laptop A's IP address as build arguments so that the compiled React bundle on Laptop A knows how to contact the Hub API.
```bash
# Start containerized Hub and Dashboard
VITE_HUB_API_URL="http://192.168.1.100:5000" \
VITE_HUB_WS_URL="ws://192.168.1.100:5000" \
ADMIN_SECRET="e2e-test-secret" \
sudo -E docker compose up --build -d hub hub_dashboard
```
*   **Dashboard URL**: `http://localhost:5005` (from either laptop, or `http://192.168.1.100:5005`).

#### 2. On Laptop B (Department Nodes)
Clone/copy the workspace to Laptop B, then build and run the department nodes containerized. We use the `--no-deps` flag to start the nodes without starting a local Hub container on Laptop B.
```bash
# Start containerized CCS & COE nodes pointing to Laptop A's Hub
SERVER_WS_URL="ws://192.168.1.100:5000" \
ADMIN_SECRET="e2e-test-secret" \
sudo -E docker compose up --build -d --no-deps dept_ccs dept_coe
```
*   **College of Computer Studies Node**: Accessible at `http://localhost:5001` on Laptop B.
*   **Engineering Node**: Accessible at `http://localhost:5002` on Laptop B.


---

## Running Verification Tests

The project includes an integration test suite validating:
*   Real-time event broadcasting
*   Last-Write-Wins (LWW) conflict resolution
*   Offline queue buffering and eventual consistency
*   Heartbeat ping-pong timeouts
*   PII redaction validation

To run the curl integration tests:
```bash
./test_all_phases.sh
```

To run Playwright End-to-End browser tests:
```bash
cd e2e
npm install
npx playwright test
```

---

## Design System & Rules
Development rules, conflict resolution specifications (LWW), and technical boundaries are defined in [AGENTS.md](AGENTS.md).
Project history and tracking are in [MEMORY.md](MEMORY.md).
Resolved errors and debugging reports are in [Context/ERROR.md](Context/ERROR.md).
