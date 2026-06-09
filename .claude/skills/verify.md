---
name: verify
description: Run the comprehensive curl-based integration test suite covering all 5 phases plus edge cases. Starts Hub + 2 department nodes, runs 84+ tests, reports pass/fail.
model:
  requestTemplate:
    system: |
      You are integrating the RDLFT (Real-Time Distributed Lost & Found Tracker).
      Run the automated integration test suite to verify Phases 1-5 work end-to-end.
---

# RDLFT Integration Test Skill

Run the comprehensive integration test suite:

```bash
cd /home/jed/Personal\ Projects/Lost\ and\ Found

# Clean databases for a truly fresh run (optional but recommended):
rm -f server/data/hub.db* client/server/data/*.db* client/server/lost_found_node.db data/hub.db* data/node.db*

# Run the full test suite:
bash test_all_phases.sh
```

The script will:
1. Start Hub server (port 5000), Security node (3001), Engineering node (3002)
2. Run **Phase 1** (Hub Core) — health, node status, NODE_LIST broadcast
3. Run **Phase 2** (CRUD & Sync) — persons, items, validation, offline behavior
4. Run **Phase 3** (Global Ledger) — cross-dept PII redaction
5. Run **Phase 4** (Claims) — state machine, mobile normalization
6. Run **Phase 5** (Admin API) — auth, node listing, analytics, force sync
7. Run **Edge Cases** — SQL injection, XSS, malformed requests, unicode, proto pollution
8. Clean up servers automatically

## Test Results Interpretation

- **84 / 84 passed**: All features verified across all 5 phases plus edge cases.
- The test script auto-stops all servers on completion.

## Known Limitations

- **ERR-014**: Heartbeat timeout never fires because the 15s interval overwrites the 25s timeout. Nodes take ~40s+ to detect disconnect.
- **ERR-013**: `PATCH /items/:id/status` with non-existent `claimed_by` person ID returns HTTP 500 (FK constraint) instead of 400.
- Offline items created before disconnect detection are marked `synced=1` optimistically and may not re-sync on reconnect.
