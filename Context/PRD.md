# Real-Time Distributed Lost & Found Tracker (RDLFT)
## Product Requirement Document

| Field | Value |
|---|---|
| **Author** | Jed Fetalino |
| **Document Version** | 2.0 |
| **Target Sprint** | 1–2 Day AI-Assisted Build |
| **Target Deployment** | June 2026 |
| **Course Context** | Parallel Computing & Distributed Systems |
| **Demo Nodes** | 2 Department Nodes + 1 Central Hub |
| **Demo Environment** | Single laptop (Docker) or multi-machine via LAN/hotspot |

---

## 1. Executive Summary & Objectives

### 1.1 Problem Statement

Institutional lost and found operations are siloed by department. Staff manually manage separate spreadsheets or paper logs, creating friction when an item found in one building needs to be matched against a report from another. A standard centralized web application solves the discovery problem but introduces a critical single point of failure: when the network or server goes down, the entire system stops.

### 1.2 Solution Overview

The Real-Time Distributed Lost & Found Tracker (RDLFT) is a fault-tolerant, horizontally scalable distributed system designed to eliminate both problems. Each department operates an autonomous node with its own local database. Nodes synchronize with a Central Hub via bi-directional WebSocket channels, converging toward an eventually consistent global view of all items across the campus.

### 1.3 Course Concept Mapping

This project directly demonstrates three core topics from Parallel Computing & Distributed Systems:

| Course Concept | How RDLFT Demonstrates It | Where to See It in the Demo |
|---|---|---|
| **WebSockets / Message Passing** | Full-duplex channels replace HTTP polling; nodes emit and receive item events in real time | Log an item on Node A — watch it appear on Node B within ~100ms |
| **Fault Tolerance & Offline Recovery** | Nodes buffer writes locally when disconnected; re-sync queue flushes on reconnect | Kill the hub container — Node A still accepts submissions. Restart hub — queue drains automatically |
| **Horizontal Scalability / Containerization** | Each node is a self-contained Docker image; new departments join by setting two env vars and running one command | Show `docker compose up` scaling from 1 to 2 nodes with zero code changes |

---

## 2. System Architecture & Topology

### 2.1 Hub-and-Spoke Distributed Model

The system uses a Hub-and-Spoke topology. Each Department Node is fully autonomous — it can log and read items without any network connection to the hub. The hub acts as a broadcast relay and global persistence layer, not a gatekeeper. This distinction is critical: removing the hub degrades functionality (global view is lost) but does not halt local operations.

```
+------------------------------------------------------------------+
|                        DOCKER NETWORK                            |
|                                                                  |
|  +----------------------+       +----------------------+         |
|  |   Node: CCS          |       |   Node: COE          |         |
|  |  React + SQLite + WS |       |  React + SQLite + WS |         |
|  +----------+-----------+       +----------+-----------+         |
|             ^   bi-directional WebSockets  ^                     |
|             |                              |                     |
|             v                              v                     |
|  +----------+------------------------------+-----------+         |
|  |               CENTRAL SERVER HUB                   |         |
|  |          Node.js / Express + SQLite + ws            |         |
|  +-----------------------------------------------------+         |
+------------------------------------------------------------------+
```

### 2.2 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend UI** | React + TypeScript + Vite + Tailwind CSS | Fast hot-reload dev; typed props prevent runtime bugs |
| **Backend / WS Engine** | Node.js + Express + `ws` (native) | Lightweight; handles thousands of concurrent sockets without heavy framework overhead |
| **Data Tier** | SQLite (per node + hub) | Zero-config file-based DB; one file per container; trivially portable |
| **Orchestration** | Docker + Docker Compose | Encapsulates full environment; single command boot; scales by copying a service block |
| **Node Identity** | `.env` per container | `DEPT_NAME` + `SERVER_WS_URL` + `DEPT_SECRET`; zero code changes to onboard a new department |

---

## 3. Distributed System Features (Course-Aligned)

### 3.1 Real-Time Message Passing via WebSockets

Instead of HTTP polling, the system uses full-duplex WebSocket channels. When a node logs a new item, it immediately emits a structured event to the hub. The hub persists the item and broadcasts it to all other active connections in parallel — demonstrating true async message passing between distributed processes.

```json
{
  "event": "ITEM_BROADCAST",
  "payload": {
    "id": "uuidv4-...",
    "item_name": "Hydro Flask Water Bottle",
    "description": "Black, 32oz, scratched base",
    "department_origin": "College of Computer Studies",
    "status": "found",
    "surrendered_by": { "name": "Juan Dela Cruz", "mobile": "+639171234567" },
    "created_at": "2026-06-08T08:58:16.000Z"
  }
}
```

> **Privacy note:** PII (mobile number, ID details) is included in the hub-to-node channel but excluded from cross-node broadcasts. The claiming department must request person details from the origin node directly.

### 3.2 Fault Tolerance & Offline Recovery (3-State Model)

This is the primary distributed systems showcase. The node operates across three states:

| State | Condition | Behavior |
|---|---|---|
| **Online** | WebSocket heartbeat succeeds | All writes are immediately mirrored to the hub. Items arrive from other nodes in real time. |
| **Offline Partition** | Heartbeat fails; WS connection drops | Node continues accepting submissions locally. Writes stored in SQLite with `synced = 0`. UI shows red LED indicator. |
| **Re-connection** | WS reconnects to hub | Node flushes its local queue (all `synced = 0` records) to the hub in insertion-timestamp order. Hub broadcasts each item to the network. Conflict resolution: Last-Write-Wins on `updated_at` timestamp. |

> **Demo script:** Kill the hub container mid-session. Log two items on Node A. Restart the hub. Within seconds, both items appear on Node B — demonstrating eventual consistency.

### 3.3 Horizontal Scalability via Containerization

Every department node is an identical Docker image parameterized entirely by environment variables. Onboarding a new department requires no code changes — only a new service block in `docker-compose.yml` or a `docker run` command with two variables set.

```yaml
# Adding a third department node — no code changes required
dept_college_of_nursing:
  image: rdlft-node:latest
  ports:
    - '5003:3000'
  environment:
    - DEPT_NAME=College of Nursing
    - SERVER_WS_URL=ws://central_server:5000
    - DEPT_SECRET=shared-campus-secret
```

The hub's WebSocket server registers each new connection dynamically — no server restart or config reload required.

---

## 4. Functional Requirements

### 4.1 Department Node — UI Screens

| Screen | Key Elements |
|---|---|
| **Login / Auth** | Department ID field + DEPT_SECRET key. Validates against hub on connect. |
| **Main Dashboard** | Tab bar: Global Ledger \| Log Item \| Process Claim. Connection LED (green/red). Node count badge. |
| **Global Ledger** | Real-time table of all items from all nodes. Filter by dept / status. Search by name. Tap row to open Item Detail. |
| **Log Item Form** | Item Name\*, Category\*, Status (lost/found)\*, Description. Surrenderer section: Full Name\*, Mobile Number\* (E.164 format), ID Type, ID Number. |
| **Process Claim** | Search by item ID or name. Claimant section: Full Name\*, Mobile Number\*, ID Type, ID Number, optional photo ID note. \[Mark as Claimed\] button. |
| **Item Detail** | Full item record. Surrendered By (name only — mobile shown only to origin dept admin). Status badge. \[Process Claim\] if status = found. |
| **Offline Banner** | Prominent amber banner when disconnected. Shows queue depth (N items pending sync). |

### 4.2 Central Hub — Admin Dashboard Screens

| Screen | Key Elements |
|---|---|
| **Node Monitor** | Live list of connected nodes: dept name, socket ID, IP, last ping, items logged today. Force re-sync and disconnect controls per node. |
| **Global Ledger** | Full read-only item table across all nodes. Claimant + surrenderer details visible to hub admin. Export CSV. |
| **Message Log** | Live WebSocket event stream. Event type, source node, payload preview, timestamp in ms. Scroll / pause toggle. |
| **Analytics** | Items by department (bar chart). Claim rate %. Avg time-to-claim. Offline event count. Sync queue depth. |
| **Item Detail** | Full record: item metadata, surrendered by (full PII), claimed by (full PII), origin dept, claimed dept, timeline. |

---

## 5. Data Schema & Protocols

### 5.1 SQLite Schema

Runs identically on every node and the hub.

```sql
CREATE TABLE persons (
    id          TEXT PRIMARY KEY,           -- uuidv4
    full_name   TEXT NOT NULL,
    mobile      TEXT NOT NULL,              -- E.164 format: +639XXXXXXXXX
    id_type     TEXT,                       -- 'student_id' | 'employee_id' | 'visitor'
    id_number   TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE items (
    id                  TEXT PRIMARY KEY,
    item_name           TEXT NOT NULL,
    description         TEXT,
    category            TEXT,
    department_origin   TEXT NOT NULL,
    status              TEXT CHECK(status IN ('lost','found','claimed')) NOT NULL,
    surrendered_by      TEXT REFERENCES persons(id),
    claimed_by          TEXT REFERENCES persons(id),
    claimed_at          TIMESTAMP,
    synced              BOOLEAN DEFAULT 0,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- for LWW conflict resolution
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

> **Status state machine:** `lost` → item reported missing | `found` → item surrendered to a department | `claimed` → item retrieved by rightful owner. Transitions allowed: `lost→found`, `found→claimed`. Records are never deleted — the ledger is append-only and fully auditable.

### 5.2 WebSocket Event Protocol

| Event | Direction | Description |
|---|---|---|
| `HELLO` | Node → Hub | Sent on connect. Carries `DEPT_NAME` and `DEPT_SECRET` for validation. |
| `SYNC_DUMP` | Hub → Node | Sent after `HELLO`. Full snapshot of all existing items so new node is not empty. |
| `ITEM_BROADCAST` | Node → Hub → All Nodes | New item logged. PII stripped from cross-node payload. |
| `STATUS_UPDATE` | Node → Hub → All Nodes | Item status changed (e.g. `found → claimed`). Carries `updated_at` for LWW. |
| `SYNC_QUEUE_FLUSH` | Node → Hub | Sent on reconnect. Batch of all `synced=0` records in timestamp order. |
| `NODE_LIST` | Hub → Node | List of currently connected nodes. Refreshed on any connect/disconnect. |
| `HEARTBEAT / ACK` | Bidirectional | Ping/pong every 15s. Failure triggers offline mode on the node side. |

---

## 6. Execution & Deployment

### 6.1 Docker Compose — Single Laptop (Primary Demo Setup)

```yaml
version: '3.8'

services:
  central_server:
    build: ./server
    ports: ['5000:5000']
    volumes: [server_db:/app/data]
    environment:
      - ADMIN_SECRET=hub-admin-secret

  dept_ccs:
    build: ./client
    ports: ['5001:3000']
    environment:
      - DEPT_NAME=College of Computer Studies
      - SERVER_WS_URL=ws://central_server:5000
      - DEPT_SECRET=shared-campus-secret

  dept_coe:
    build: ./client
    ports: ['5002:3000']
    environment:
      - DEPT_NAME=College of Engineering
      - SERVER_WS_URL=ws://central_server:5000
      - DEPT_SECRET=shared-campus-secret

volumes:
  server_db:
```

### 6.2 Multi-Machine Setup (LAN or Hotspot)

1. Connect all machines to the same network (campus LAN or mobile hotspot).
2. On Laptop 1 (server): run `docker compose up central_server` only.
3. Get the server IP: `ipconfig` (Windows) or `ifconfig` (Linux/macOS).
4. On Laptop 2+: set `SERVER_WS_URL=ws://[LAPTOP_1_IP]:5000` in `.env` and run the client service.
5. Each machine opens its node dashboard on `localhost:3000` (or mapped port).

> **Hotspot tip:** University networks often block peer-to-peer LAN traffic between devices. Use a mobile phone hotspot to create a clean isolated network for the demo. This also makes for a compelling live demonstration of nodes joining dynamically.

### 6.3 Scaling — How New Nodes Join

New department nodes are entirely self-provisioning. No server restart, no config reload, and no code change is required on the hub when a new node joins.

| Step | Action | Notes |
|---|---|---|
| 1 | `docker pull rdlft-node:latest` (or `git clone` + build) | No code access needed in production mode |
| 2 | Create `.env` with `DEPT_NAME`, `SERVER_WS_URL`, `DEPT_SECRET` | Only 3 variables required — all behavior is parameterized |
| 3 | `docker run` (or `docker compose up`) | Container starts; WS connects to hub automatically |
| 4 | Hub sends `SYNC_DUMP` | Node receives all existing items and seeds its local SQLite |
| 5 | Node is fully operational | Can log items, view global ledger, and process claims immediately |

---

## 7. Build Feasibility — 1 to 2 Day Sprint

### 7.1 Scope Decisions for Feasibility

The following decisions make this achievable in 1–2 days with AI assistance while keeping all course concepts demonstrable:

- SQLite over PostgreSQL — zero config, zero setup time, trivially embedded in Docker
- `ws` (native) over Socket.IO — smaller surface area, easier to reason about for the report
- 2 nodes only for demo — sufficient to prove all distributed concepts without multiplying UI work
- No image uploads — photo ID is noted as text only
- LWW conflict resolution — simple and defensible for the course context; no CRDT complexity needed
- Shared `DEPT_SECRET` — basic auth sufficient for a prototype; OAuth is out of scope

### 7.2 Suggested Build Order

| Phase | Tasks | Est. Time |
|---|---|---|
| **Phase 1 — Hub Core** | Express server + ws broker + SQLite schema + `ITEM_BROADCAST` relay + `HEARTBEAT` | 3–4 hrs |
| **Phase 2 — Node Core** | React UI scaffold + WS client + Log Item form + persons table write + offline queue + LED indicator | 4–5 hrs |
| **Phase 3 — Global Ledger** | Real-time item table on node + `SYNC_DUMP` on connect + filter/search | 2–3 hrs |
| **Phase 4 — Claim Flow** | Process Claim screen + `STATUS_UPDATE` event + `claimed_by` write + item detail view | 2–3 hrs |
| **Phase 5 — Hub Dashboard** | Node monitor + message log + global ledger (read-only) | 2–3 hrs |
| **Phase 6 — Docker & Polish** | Dockerfiles + `docker-compose.yml` + offline banner + demo script dry run | 1–2 hrs |

Total estimated build time with AI pair programming: **14–20 hours**, comfortably within a 2-day sprint.

> **Tip:** Phases 1–3 alone give you a working demo of all three course concepts. If time is tight, stop there and add the claim flow second.

### 7.3 Demo Script (for Panel Presentation)

1. Open hub dashboard and both node dashboards side by side (3 browser tabs).
2. On Node A (CCS): log a found item — enter item details + surrenderer name and mobile.
3. Show item appearing on Node B (COE) and hub in real time. Point to the WebSocket message log.
4. Kill the hub container (`docker stop rdlft_central_server_1`). Show red LED on both nodes.
5. On Node A: log a second item. Show it saves locally. Node B sees nothing yet.
6. Restart the hub. Show queue flush — both items appear on Node B. Narrate eventual consistency.
7. On Node B: process a claim on the first item. Enter claimant details. Show status updating to `claimed` across all views.
8. Run `docker compose up` with a third node config. Show it joins and receives `SYNC_DUMP` — instantly showing all prior items.

---

## 8. Known Constraints & Mitigations

| Constraint | Mitigation |
|---|---|
| No real authentication | `DEPT_SECRET` shared key on WS handshake is sufficient for demo scope. Note in report as future work. |
| SQLite not suitable for high write concurrency | Acceptable for campus-scale usage. Note in report; PostgreSQL is the production path. |
| LWW may discard legitimate updates in edge cases | Document the trade-off in report. Sufficient for eventual consistency demonstration. |
| PII (mobile numbers) in transit | Excluded from cross-node broadcast payloads. Noted as a privacy design decision. |
| No automated tests | Manual demo script covers all core paths. Unit tests are future work. |

---

