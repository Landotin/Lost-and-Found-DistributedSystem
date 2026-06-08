# Phase 2 Code Review: Department Node & Local DB

This code review analyzes the implementation of Phase 2 (Department Node Frontend & Local DB) of the Real-Time Distributed Lost & Found Tracker (RDLFT). It focuses on architectural integrity, reliability of distributed state synchronization, edge cases, and code quality.

---

## 1. Synchronization Reliability & Fault Tolerance (Critical)

### 1.1 Fire-and-Forget Sync Status Updates
*   **Location**: `client/server/src/routes.ts` (POST `/api/items`) & `client/server/src/ws-client.ts` (`flushSyncQueue()`)
*   **Symptom**: Items are marked as synced (`synced = 1`) immediately after the WebSocket client sends the payload, without waiting for verification from the Hub.
*   **Root Cause**:
    *   In `routes.ts` (POST `/items`):
        ```typescript
        const item: Item = {
          ...,
          synced: isConnected ? 1 : 0
        };
        await createItem(item);
        if (isConnected) {
          wsManager.send('ITEM_BROADCAST', ...);
        }
        ```
    *   In `ws-client.ts` (`flushSyncQueue`):
        ```typescript
        this.send('SYNC_QUEUE_FLUSH', { items: batch });
        for (const item of pending) {
          await markItemSynced(item.id);
        }
        ```
*   **Risk**: If a network interruption occurs *during* the WebSocket write, or if the Hub server experiences a database failure/validation error, the Node will permanently believe these records are synced. They will never be re-sent, leading to silent synchronization loss and permanent inconsistency in the global ledger.
*   **Recommendation**:
    *   Keep local items at `synced = 0` when sent.
    *   Implement a two-way handshake where the Hub replies with a `SYNC_ACK` or `ITEM_ACK` carrying the successfully persisted item IDs.
    *   The Node should only mark items as `synced = 1` in the database upon receipt of this acknowledgement.

---

## 2. Frontend Bugs & Edge Cases

### 2.1 Duplicate Person Records on Form Submission Retry
*   **Location**: `client/src/components/LogItemForm.tsx` (`performSubmit()`)
*   **Symptom**: Clicking "Retry" after a submission error creates duplicate person records.
*   **Root Cause**:
    *   Logging a found item requires two sequential HTTP requests: `POST /api/persons` followed by `POST /api/items`.
    *   If the first call (`/api/persons`) succeeds but the second call (`/api/items`) fails (due to a database lock, client network drop, or server crash), the form status transitions to `error` and shows a "Retry" button.
    *   Clicking "Retry" invokes `performSubmit()` again. Since the form state is not checked, it attempts to recreate the person record. This results in duplicate/orphan person entries with different UUIDs in the database.
*   **Recommendation**:
    *   Cache the successfully created `person.id` in a React state or ref (e.g., `lastCreatedPersonId`).
    *   Before calling `POST /api/persons`, check if `lastCreatedPersonId` is already set. If so, bypass the person creation API call and use the cached ID for the item submission.
    *   Clear this cached ID only when the entire form submission succeeds and is reset.

### 2.2 Unsafe Hook Dependency in `usePolling`
*   **Location**: `client/src/hooks/usePolling.ts`
*   **Symptom**: Potential infinite re-render cycles or interval registration loops if the fetcher changes.
*   **Root Cause**:
    ```typescript
    useEffect(() => {
      ...
      const interval = setInterval(fetchData, intervalMs);
      return () => {
        clearInterval(interval);
      };
    }, [fetcher, intervalMs]);
    ```
    *   If a developer passes an inline lambda function to `usePolling` (e.g., `usePolling(() => fetchStatus(), 5000)`), a new function reference is created on every render.
    *   This forces the `useEffect` to tear down and register a new interval on every render frame, degrading performance and breaking the polling timing.
*   **Recommendation**:
    *   Use a mutable `useRef` to store the latest version of `fetcher`.
    *   Update the ref on every render:
        ```typescript
        const fetcherRef = useRef(fetcher);
        useEffect(() => {
          fetcherRef.current = fetcher;
        }, [fetcher]);
        ```
    *   Remove `fetcher` from the `useEffect` dependency array, running `fetcherRef.current()` inside the polling execution.

---

## 3. Code Maintainability & Cleanliness

### 3.1 Raw Fetch Calls in `LogItemForm.tsx`
*   **Location**: `client/src/components/LogItemForm.tsx`
*   **Symptom**: Raw `fetch()` calls bypass the centralized API wrappers in `useApi.ts`.
*   **Root Cause**:
    *   `LogItemForm.tsx` executes raw fetch calls to `/api/persons` and `/api/items` instead of reusing `createPerson()` and `createItem()` from `client/src/hooks/useApi.ts`.
*   **Recommendation**:
    *   Import and use `createPerson` and `createItem` from `useApi.ts` to enforce DRY (Don't Repeat Yourself) principles and centralize endpoint path management.

### 3.2 Dynamic Department Name Fetching
*   **Location**: `client/src/App.tsx`
*   **Symptom**: Header hardcodes or pulls department name from static client-side environment variables (`import.meta.env.VITE_DEPT_NAME`).
*   **Root Cause**:
    *   The node's actual identity (`DEPT_NAME`) is owned by the node's local server environment variables.
    *   The frontend can fetch this dynamically from `GET /api/status` (which returns `{ deptName, ... }`).
*   **Recommendation**:
    *   In `App.tsx`, read the department name returned from the status query instead of relying on build-time `VITE_DEPT_NAME` configuration. This ensures the UI automatically aligns with the server's runtime environment configuration.

---

## 4. Architectural Completeness

### 4.1 Hub Server Message Router
*   **Location**: `server/src/index.ts`
*   **Status**: Currently, the Hub server connection manager forwards all post-handshake messages to `ConnectionManager` event handlers, but `index.ts` only wires up the `ACK` message handler:
    ```typescript
    manager.on('message', ({ socketId, message }: { socketId: string; message: any }) => {
      if (message.event === 'ACK') {
        if (heartbeatManager) {
          heartbeatManager.handleAck(socketId);
        }
      }
    });
    ```
*   **Next Steps (Phase 3 & 4)**:
    *   The hub must be extended to listen for `ITEM_BROADCAST`, `STATUS_UPDATE`, and `SYNC_QUEUE_FLUSH`.
    *   It should persist these items to the hub's SQLite database and relay them to all other connected node sockets (stripping PII details where appropriate as mandated by `AGENTS.md`).
