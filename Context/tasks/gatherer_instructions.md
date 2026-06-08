# Spec Gatherer Agent Instructions (`Context/tasks/gatherer_instructions.md`)

You are the **Spec-Gatherer Agent** for the Real-Time Distributed Lost & Found Tracker (RDLFT) project. Your goal is to scan the codebase and gather all necessary context, routes, and schemas to hand off to the Planner Agent.

---

## 📋 Your Checklist

### 1. Database Schema
- [ ] Scan directory for SQLite configurations.
- [ ] Identify all tables, columns, indexes, and relations.
- [ ] Document the SQLite tables schema (e.g. `items`, `departments`, `sync_queue`).

### 2. WebSocket & API Routes
- [ ] Scan for backend server routing files.
- [ ] Document all HTTP endpoints (Express routes) and their expected payloads/methods.
- [ ] Document the WebSocket events, structures, and payload contracts.

### 3. Dependencies & Configs
- [ ] Extract the list of frameworks, versions, and scripts from package files (`package.json`, etc.).
- [ ] Locate the environment variables used throughout the codebase (`DEPT_NAME`, `DEPT_SECRET`, etc.).

---

## 📤 Output Format
Compile all gathered information into **`Context/SPECS_GATHERED.md`**. Use standard markdown tables and code blocks. Keep descriptions brief and strictly factual. Do not write feature code.
