# Task Contract: Heartbeat Manager (`worker_backend_heartbeat`)

## Scope
Implement the **HEARTBEAT/ACK mechanism** for the RDLFT Phase 1 Hub Server Core — the hub sends pings to each connected node every 15 seconds and detects stale connections.

## Files to Create (ONLY these files)

1. `src/heartbeat.ts` — Heartbeat manager class with ping/pong timing
2. `src/heartbeat.test.ts` — Vitest unit tests (TDD: write BEFORE implementation)

## Prerequisites
- Uses the `ws` package's `WebSocket` type
- This module does NOT import from `connection-manager.ts` or `database.ts`
- It receives the connection manager's node list externally and operates on WebSocket objects directly

## Requirements

### 4.1 Type Definitions (`src/heartbeat.ts`)

```ts
interface HeartbeatConfig {
  intervalMs: number;      // ping interval (default: 15000)
  ackTimeoutMs: number;    // time to wait for ACK (default: 5000)
  maxMissedAcks: number;   // consecutive missed ACKs before disconnect (default: 2)
}

interface NodeHeartbeat {
  socketId: string;
  lastPingSent: number;    // timestamp ms
  missedAcks: number;      // consecutive missed ACK count
  socket: WebSocket;
}
```

### 4.2 Heartbeat Manager (`src/heartbeat.ts`)

- Export `class HeartbeatManager` with:
  - `constructor(config?: Partial<HeartbeatConfig>)` — applies defaults
  - Private `heartbeats: Map<string, NodeHeartbeat>`
  - `addNode(socketId: string, socket: WebSocket): void` — begin tracking
  - `removeNode(socketId: string): void` — stop tracking
  - `start(): void` — begin the interval timer that sends `HEARTBEAT` pings to all tracked sockets
  - `stop(): void` — clear the interval timer, clean up
  - `handleAck(socketId: string): void` — reset missedAcks to 0 for this node
  - Private `checkTimeouts(): void` — inspect all nodes; increment missedAcks for any that haven't ACKed within `ackTimeoutMs`; emit `'node_timeout'` event for nodes exceeding `maxMissedAcks`
- Extend `EventEmitter` (or use a callback) for the `'node_timeout'` event
  - Emit `{ socketId: string }` when a node has exceeded max missed ACKs

### 4.3 Heartbeat Protocol

- Hub sends to node:
  ```json
  { "event": "HEARTBEAT", "payload": { "timestamp": 1717800000000 } }
  ```
- Node responds:
  ```json
  { "event": "ACK", "payload": { "timestamp": 1717800000000 } }
  ```
- Hub records the ACK receipt time and resets the missed counter

### 4.4 Tests (`src/heartbeat.test.ts`) — TDD MANDATE

Write these tests BEFORE implementing `heartbeat.ts`:

1. `HeartbeatManager` initializes with default config (15s interval, 5s ACK timeout, max 2 missed)
2. `HeartbeatManager` accepts custom config overrides
3. `addNode()` starts tracking a socket
4. `removeNode()` stops tracking and removes from Map
5. `start()` begins sending HEARTBEAT pings at the configured interval
6. `stop()` halts the interval, no more pings sent
7. `handleAck()` resets missedAcks to zero for the given node
8. After `ackTimeoutMs` without ACK, missedAcks increments
9. After `maxMissedAcks` consecutive misses, `'node_timeout'` event fires
10. ACK received after 1 missed ping resets the counter (doesn't fire timeout)

Use fake timers (`vi.useFakeTimers()`) to control time-dependent behavior in tests. Use a mock WebSocket that records sent messages rather than a real connection.

### Quality Gates
- `npx vitest run` must pass with exit code 0
- `npx tsc --noEmit` must pass with zero errors
- All heartbeat messages use `{ event, payload }` envelope format

## Forbidden
- Do NOT modify `src/index.ts`, `src/database.ts`, `src/connection-manager.ts`, or any file outside this contract
- Do NOT use `any` types
- Do NOT use `setInterval` without a cleanup mechanism (always provide `stop()`)
- Do NOT write placeholder/stub implementations
