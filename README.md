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
    *   **Security Node (Dept A)** on `http://localhost:3001`
    *   **Engineering Node (Dept B)** on `http://localhost:3002`
    *   **Hub Admin Dashboard** on `http://localhost:5005`
*   Cleans up all background processes automatically when you press `Ctrl+C`.

Logs are written to: `hub.log`, `security.log`, `engineering.log`, and `dashboard.log` in the root directory.

### 2. Run via Docker Compose (Alternative)

If you have Docker and Docker Compose installed:

```bash
# Start containerized services
docker compose up --build -d
```

---

## Horizontal Scaling (Using Two Laptops)

To demonstrate horizontal scaling across physical machines, distribute the services across two laptops connected to the same local network:

### 1. Host the Hub on Laptop A
1. Get the local IP address of **Laptop A**:
   ```bash
   hostname -I | awk '{print $1}'
   # Let's assume this returns: 192.168.1.100
   ```
2. Allow incoming traffic on port 5000:
   ```bash
   sudo ufw allow 5000/tcp
   ```
3. Run the Central Hub:
   ```bash
   cd server
   PORT=5000 ADMIN_SECRET=e2e-test-secret DB_PATH=../data/hub.db npx tsx src/index.ts
   ```

### 2. Host Department Nodes on Laptop B
Run the client/server backends on **Laptop B**, directing them to point to Laptop A's IP address:

*   **Security Node (Port 3001)**:
    ```bash
    cd client/server
    PORT=3001 DEPT_NAME="Security" DEPT_SECRET=e2e-test-secret SERVER_WS_URL=ws://192.168.1.100:5000 NODE_ENV=production DB_PATH=../../data/security.db npx tsx src/index.ts
    ```
*   **Engineering Node (Port 3002)**:
    ```bash
    cd client/server
    PORT=3002 DEPT_NAME="Engineering" DEPT_SECRET=e2e-test-secret SERVER_WS_URL=ws://192.168.1.100:5000 NODE_ENV=production DB_PATH=../../data/engineering.db npx tsx src/index.ts
    ```

### 3. Run the Admin Dashboard (Either Laptop)
```bash
cd hub-dashboard
VITE_HUB_API_URL="http://192.168.1.100:5000" VITE_HUB_WS_URL="ws://192.168.1.100:5000" VITE_ADMIN_SECRET="e2e-test-secret" npm run dev -- --port 5005 --host
```

Now you can access the UIs from Laptop B (`http://localhost:3001` and `http://localhost:3002`) and watch changes propagate across the local network to Laptop A in real time.

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
