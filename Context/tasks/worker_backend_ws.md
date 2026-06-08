# Task Contract: WebSocket Connection Manager & HELLO Protocol (`worker_backend_ws`)

## Scope
Implement the **WebSocket Connection Manager** for the RDLFT Phase 1 Hub Server Core — handles connection tracking, HELLO protocol validation, and NODE_LIST broadcasting.

## Files to Create (ONLY these files)

1. `src/connection-manager.ts` — Connection registry, HELLO validation, NODE_LIST broadcast
2. `src/connection-manager.test.ts` — Vitest unit tests (TDD: write BEFORE implementation)

## Prerequisites
- This module imports `ws` (WebSocket) from the `ws` package (v8.x)
- A `ws.Server` instance is passed in from the caller (created in `index.ts` — you do NOT create it)
- No dependency on `database.ts` — this is a pure WebSocket layer

## Requirements

### 3.1 Type Definitions (`src/connection-manager.ts`)

Define and export strict TypeScript interfaces:

```ts
interface ConnectedNode {
  socketId: string;          // unique ID for this WS connection
  deptName: string;          // from HELLO payload
  connectedAt: string;       // ISO 8601 timestamp
  socket: WebSocket;         // the live ws connection object
}

interface HelloPayload {
  dept_name: string;
  dept_secret: string;
}

interface NodeListPayload {
  nodes: Array<{ dept_name: string; socket_id: string; connected_at: string }>;
  count: number;
}

interface WsMessage {
  event: string;
  payload?: unknown;
}
```

### 3.2 Connection Manager (`src/connection-manager.ts`)

- Export `class ConnectionManager` with:
  - `constructor(wss: WebSocketServer, validSecret: string)`
  - Private `nodes: Map<string, ConnectedNode>` storing connections by socketId
  - `getConnectedNodes(): ConnectedNode[]`
  - `getNodeCount(): number`
  - `registerNode(socket: WebSocket, deptName: string): ConnectedNode` — adds to map, returns node
  - `removeNode(socketId: string): void` — removes from map
  - `broadcastNodeList(): void` — sends `NODE_LIST` event to ALL connected sockets (excluding dead sockets)

### 3.3 HELLO Protocol Handler (`src/connection-manager.ts`)

- Export `function handleConnection(wss: WebSocketServer, manager: ConnectionManager, validSecret: string): void`
- Attach listener to `wss.on('connection', (socket, req) => { ... })`:
  - Set a 5-second timeout for the first message — if no message received, close with code 4002
  - On first message, parse JSON:
    - If `event !== "HELLO"`: close with code 4002, message "Expected HELLO as first message"
    - If `payload.dept_secret !== validSecret`: close with code 4001, message "Invalid department secret"
    - If `!payload.dept_name` or empty string: close with code 4001, message "Department name required"
    - On valid HELLO: call `manager.registerNode(socket, payload.dept_name)`, then `manager.broadcastNodeList()`
  - On socket close: call `manager.removeNode(socketId)`, then `manager.broadcastNodeList()`
  - On socket error: call `manager.removeNode(socketId)`, then `manager.broadcastNodeList()`

### 3.4 NODE_LIST Broadcast Format

```json
{
  "event": "NODE_LIST",
  "payload": {
    "nodes": [
      { "dept_name": "College of Computer Studies", "socket_id": "abc123", "connected_at": "2026-06-08T..." }
    ],
    "count": 1
  }
}
```

### 3.5 Tests (`src/connection-manager.test.ts`) — TDD MANDATE

Write these tests BEFORE implementing `connection-manager.ts`:

1. `ConnectionManager` starts with zero connected nodes
2. `registerNode()` adds a node and returns the ConnectedNode with correct fields
3. `removeNode()` removes a node; `getConnectedNodes()` no longer includes it
4. `getNodeCount()` returns correct count after add/remove
5. `broadcastNodeList()` sends `NODE_LIST` event with correct payload structure to all connected sockets
6. `handleConnection()` registers node on valid HELLO message
7. `handleConnection()` rejects connection with code 4001 on invalid secret
8. `handleConnection()` rejects connection with code 4001 on missing dept_name
9. `handleConnection()` rejects connection with code 4002 on non-HELLO first message
10. On socket close, node is removed and NODE_LIST is broadcast

Use `ws` package's `WebSocketServer` and `WebSocket` from the actual library. For testing, create a real `WebSocketServer` on a random port and connect test clients.

### Quality Gates
- `npx vitest run` must pass with exit code 0
- `npx tsc --noEmit` must pass with zero errors
- All WebSocket messages use `{ event, payload }` envelope format

## Forbidden
- Do NOT modify `src/index.ts`, `src/database.ts`, or any file outside this contract
- Do NOT use `any` types
- Do NOT use Socket.IO or any WebSocket library other than `ws`
- Do NOT write placeholder/stub implementations
