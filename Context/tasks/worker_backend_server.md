# Task Contract: Express Server Entry Point & Integration (`worker_backend_server`)

## Scope
Implement the **Express HTTP server entry point** and **top-level integration** for the RDLFT Phase 1 Hub Server Core. This wires together the Express app, `ws` WebSocket server, database initialization, connection manager, and heartbeat manager.

## Files to Create/Replace (ONLY these files)

1. `src/index.ts` — REPLACE the boilerplate. Main entry point: Express + ws server + full startup sequence
2. `src/index.test.ts` — REPLACE the boilerplate. Integration tests (TDD: write BEFORE implementation)

## Prerequisites
- This module imports from `database.ts`, `connection-manager.ts`, and `heartbeat.ts`
- Those files may not exist yet — DEFINE the interfaces you expect in your tests using mocks/stubs
- Your implementation should import from the actual modules, which will exist after merge

## Requirements

### 5.1 Environment Configuration (`src/index.ts`)

- Use `dotenv/config` to load `.env`
- Read and validate:
  - `PORT`: HTTP listen port (default `5000`)
  - `ADMIN_SECRET`: used as `validSecret` for HELLO validation (REQUIRED — exit with error if missing)
- Do NOT hardcode any secrets

### 5.2 Express Application (`src/index.ts`)

- Create Express app
- Apply middleware: `cors()`, `express.json()`
- Implement endpoint:
  - `GET /health` → returns `{ status: "ok", uptime: <seconds>, nodeCount: <number> }`
- Track `startTime` (Date.now() at server start) for uptime calculation

### 5.3 Server Startup Sequence (`src/index.ts`)

Export `async function startServer(): Promise<http.Server>` that executes:

```
1. await initDatabase()                          // from database.ts
2. Create http.createServer(app)                 // native Node HTTP server
3. Create new WebSocketServer({ server })         // attach ws to HTTP server
4. Create new ConnectionManager(wss, ADMIN_SECRET)
5. Call handleConnection(wss, manager, ADMIN_SECRET)
6. Create new HeartbeatManager()
7. Wire heartbeatManager.on('node_timeout') to connectionManager.removeNode()
8. Wire connection events to heartbeat (addNode on connect, removeNode on disconnect)
9. Listen on PORT
10. Log: "Hub server listening on port {PORT}"
```

### 5.4 Graceful Shutdown (`src/index.ts`)

- Handle `SIGTERM` and `SIGINT`:
  - Stop heartbeat manager
  - Close all WebSocket connections with code 1001
  - Close HTTP server
  - Exit process with code 0

### 5.5 Main Entry

- When this file is run directly (`node src/index.ts`), call `startServer()`
- When imported (e.g., in tests), export `startServer` and `stopServer` for lifecycle control

### 5.6 Tests (`src/index.test.ts`) — TDD MANDATE

Write these tests BEFORE implementing `index.ts`. Use mocks for `database.ts`, `connection-manager.ts`, and `heartbeat.ts`:

1. `GET /health` returns 200 with `{ status: "ok" }` and numeric `uptime`
2. `GET /health` returns `nodeCount` matching connected nodes
3. Server starts on configured `PORT` (test with port 0 for random available port)
4. Server accepts WebSocket connections at the same HTTP port
5. Startup fails if `ADMIN_SECRET` is not set (process.env empty)
6. `startServer()` initializes database on startup
7. `startServer()` creates WebSocket server attached to HTTP server
8. On `SIGTERM`, server performs graceful shutdown
9. Uptime increases over time (wait 100ms, uptime >= 0.1)

### Test Strategy: Mocking

Since `database.ts`, `connection-manager.ts`, and `heartbeat.ts` are being built in parallel, your tests must mock these imports. Example approach:

```ts
vi.mock('./database.js', () => ({
  initDatabase: vi.fn().mockResolvedValue(undefined),
  db: { exec: vi.fn(), run: vi.fn(), get: vi.fn(), all: vi.fn() },
}));

vi.mock('./connection-manager.js', () => ({
  ConnectionManager: vi.fn().mockImplementation(() => ({
    getConnectedNodes: vi.fn().mockReturnValue([]),
    getNodeCount: vi.fn().mockReturnValue(0),
    registerNode: vi.fn(),
    removeNode: vi.fn(),
    broadcastNodeList: vi.fn(),
  })),
  handleConnection: vi.fn(),
}));

vi.mock('./heartbeat.js', () => ({
  HeartbeatManager: vi.fn().mockImplementation(() => ({
    addNode: vi.fn(),
    removeNode: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    on: vi.fn(),
  })),
}));
```

### Quality Gates
- `npx vitest run` must pass with exit code 0
- `npx tsc --noEmit` must pass with zero errors
- Server starts and accepts HTTP requests

## Forbidden
- Do NOT create `src/database.ts`, `src/connection-manager.ts`, or `src/heartbeat.ts` — those belong to other workers
- Do NOT use `any` types
- Do NOT hardcode secrets or port numbers
- Do NOT write placeholder/stub implementations — the server must actually start and respond
