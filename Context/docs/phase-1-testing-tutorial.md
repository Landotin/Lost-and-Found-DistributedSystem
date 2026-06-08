# Phase 1 Testing Tutorial — Hub Server Core

This guide lets you manually test every Phase 1 feature: Express health check, WebSocket connections, HELLO protocol, NODE_LIST broadcasts, and HEARTBEAT/ACK pings.

---

## Prerequisites

```bash
cd "/home/jed/Personal Projects/Lost and Found/server"
```

Make sure deps are installed (already done, but just in case):
```bash
npm install
```

---

## Test 1: Automated Test Suite (Quick Sanity)

```bash
npm test
```

You should see:
```
Test Files  4 passed (4)
     Tests  33 passed (33)
```

If any fail, stop here and investigate before proceeding.

---

## Test 2: Start the Hub Server

```bash
ADMIN_SECRET=my-secret PORT=5000 npx tsx src/index.ts
```

Expected output:
```
Hub server listening on port 5000
```

**In another terminal**, verify the health endpoint:

```bash
curl -s http://localhost:5000/health | python3 -m json.tool
```

Expected:
```json
{
    "status": "ok",
    "uptime": <seconds>,
    "nodeCount": 0
}
```

Run it again after a few seconds — `uptime` should have increased. Run it a third time to confirm.

---

## Test 3: WebSocket HELLO Protocol — Valid Connection

Install `wscat` if you don't have it:
```bash
npm install -g wscat
```

**In a new terminal**, connect to the hub:
```bash
wscat -c ws://localhost:5000
```

Once connected, send a valid HELLO:
```json
{"event":"HELLO","payload":{"dept_name":"College of CCS","dept_secret":"my-secret"}}
```

Expected: You receive a `NODE_LIST` broadcast back:
```json
{"event":"NODE_LIST","payload":{"nodes":[{"dept_name":"College of CCS","socket_id":"...","connected_at":"..."}],"count":1}}
```

While this node is connected, check health again:
```bash
curl -s http://localhost:5000/health | python3 -m json.tool
# nodeCount should now be 1
```

---

## Test 4: HELLO Protocol — Invalid Secret (Rejection)

Open another `wscat`:
```bash
wscat -c ws://localhost:5000
```

Send a HELLO with the wrong secret:
```json
{"event":"HELLO","payload":{"dept_name":"Intruder","dept_secret":"wrong-secret"}}
```

Expected: Connection closes immediately with code **4001**. `wscat` will show `Disconnected (code: 4001)`.

---

## Test 5: HELLO Protocol — Wrong First Message (Rejection)

Open another `wscat`:
```bash
wscat -c ws://localhost:5000
```

Send something other than HELLO first:
```json
{"event":"ITEM_BROADCAST","payload":{"item_name":"Test"}}
```

Expected: Connection closes with code **4002**.

---

## Test 6: NODE_LIST on Connect/Disconnect

1. Keep one `wscat` connected (the valid CCS node from Test 3).
2. Open a second `wscat`, send valid HELLO (different dept name):

```bash
wscat -c ws://localhost:5000
```
```json
{"event":"HELLO","payload":{"dept_name":"College of Engineering","dept_secret":"my-secret"}}
```

3. Both terminals should receive a `NODE_LIST` with `count: 2` showing both departments.
4. Now press `Ctrl+C` on the second terminal (COE). 
5. The first terminal (CCS) should receive a new `NODE_LIST` with `count: 1` — proving disconnect broadcasts work.

---

## Test 7: HEARTBEAT/ACK Pings

With a `wscat` connected (valid HELLO sent), wait 15 seconds. You should receive a HEARTBEAT ping:

```json
{"event":"HEARTBEAT","payload":{"timestamp":1717800000000}}
```

The hub expects an ACK response. Send one back:
```json
{"event":"ACK","payload":{"timestamp":1717800000000}}
```

If you do NOT send ACKs for ~35 seconds (2 missed pings + timeout), the hub will mark your node as timed out and broadcast `NODE_LIST` to remaining nodes with your node removed.

---

## Test 8: TypeScript Compilation

```bash
npx tsc --noEmit
```

Should produce no output (no errors).

---

## Test 9: Full Clean Run

Stop the server (`Ctrl+C` in its terminal). Observe the graceful shutdown message:

```
Hub server stopped
```

Then run everything fresh:

```bash
# Terminal 1: Server
ADMIN_SECRET=demo-secret PORT=5000 npx tsx src/index.ts

# Terminal 2: Health check
curl http://localhost:5000/health

# Terminal 2: Connect node
wscat -c ws://localhost:5000
# Send: {"event":"HELLO","payload":{"dept_name":"Demo Dept","dept_secret":"demo-secret"}}

# Terminal 3: Verify node count
curl http://localhost:5000/health
# Expected: {"status":"ok","uptime":...,"nodeCount":1}
```

---

## Summary: What You Just Verified

| Feature | How Tested |
|---------|-----------|
| Express HTTP server | `GET /health` returns JSON |
| WebSocket server | `wscat` connects successfully |
| HELLO validation (valid) | Registered node, received `NODE_LIST` |
| HELLO rejection (bad secret) | Closed with code 4001 |
| HELLO rejection (wrong event) | Closed with code 4002 |
| NODE_LIST on connect | Both terminals saw updated list |
| NODE_LIST on disconnect | Remaining terminal saw updated list |
| HEARTBEAT pings | Received ping after 15s |
| ACK handling | Counter reset on ACK receipt |
| Node timeout detection | Node removed after 2 missed ACKs |
| Graceful shutdown | Clean exit on Ctrl+C |
| Type safety | `tsc --noEmit` passes |
| Test suite | 33/33 Vitest tests pass |

If you hit any issues, check `Context/ERROR.md` for known problems and workarounds.
