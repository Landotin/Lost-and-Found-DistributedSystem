# Task Contract: Node Frontend UI Implementation (`Context/tasks/worker_node_client.md`)

Your objective is to implement the Department Node frontend UI for Phase 3: Global Ledger.

## 📁 Target Files
- `client/src/App.tsx`
- `client/src/components/GlobalLedger.tsx` [NEW]
- `client/src/components/__tests__/GlobalLedger.test.tsx` [NEW]
- `client/src/App.test.tsx` (or other tests to keep green)

## 📋 Requirements

### 1. Navigation & Polling (`client/src/App.tsx`)
- Add a `'ledger'` tab to the navigation header.
- The tabs should now be: `Global Ledger` (default active tab), `Log Item`, and `Pending Sync`.
- Set up polling for the items list:
  ```typescript
  const { data: items, loading: itemsLoading, error: itemsError } = usePolling<Item[]>(fetchItems, 5000);
  ```
- Render the `GlobalLedger` component in the ledger tab, passing the `items`, `itemsLoading`, and `itemsError` props, along with the current department name (retrieved from `statusData?.deptName` or similar).

### 2. Search & Filter Table (`client/src/components/GlobalLedger.tsx`)
- Implement search input: filter items by name (case-insensitive).
- Implement filter dropdowns:
  - Status filter: options are `All`, `lost`, `found`, `claimed`.
  - Department filter: options are `All` and all distinct departments dynamically extracted from `items` (e.g. `items.map(i => i.department_origin)`).
- Render a table showing:
  - Item name
  - Category
  - Origin Department
  - Status (using beautiful badge styles that correspond to the status)
  - Date logged
- Add loading state (show spinner/loading text) and error state handling.

### 3. Detailed View Modal
- Tapping/clicking an item row should open a modal displaying all item details.
- Show: Item name, description, category, origin department, status, date logged, and updated time.
- Display `surrendered_by` (if status is `found` or `claimed`) and `claimed_by` (if status is `claimed`) details:
  - If the item's `department_origin` matches the current department node's name: display the person's `full_name`, `mobile` number, and optional `id_type` and `id_number`.
  - If they do NOT match: display the person's `full_name` but mask their phone number and ID details (e.g. show `"[REDACTED]"` or `"- Confidential -"`).

## 🧪 Testing Requirement
- Write unit tests for `GlobalLedger.test.tsx` verifying:
  - Items render properly in the list.
  - Search input works.
  - Category/Department dropdown filters work.
  - PII details are correctly shown or masked in the modal depending on the department name comparison.
- Verify all client unit tests pass.
