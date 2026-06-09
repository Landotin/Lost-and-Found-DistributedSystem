import { test, expect } from '@playwright/test';
import {
  startServers,
  stopServers,
  restartHub,
  waitForNodeConnected,
  waitForNodeDisconnected,
  waitForPendingCount,
} from '../helpers/servers.js';
import type { TestServers } from '../helpers/servers.js';
import path from 'path';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const projectRoot = path.resolve(import.meta.dirname ?? __dirname, '..', '..');

test.describe('Offline & Eventual Consistency', () => {
  let servers: TestServers;

  test.beforeAll(async () => {
    servers = await startServers({ projectRoot });
  });

  test.afterAll(async () => {
    await stopServers(servers);
  });

  test('offline partition: item saves locally and syncs on reconnect', async ({ browser }) => {
    // =====================================================================
    // Phase 1: Establish baseline — verify online connection
    // =====================================================================
    const pageA = await browser.newPage();
    await pageA.goto(servers.nodeAUrl);
    await expect(pageA.getByRole('heading', { name: /Lost & Found Tracker — Security/i })).toBeVisible();

    // Wait for the connection state to load and show "Connected"
    await expect(pageA.getByText(/Connected/i)).toBeVisible({ timeout: 10_000 });

    // =====================================================================
    // Phase 2: Kill the hub — simulate network partition
    // =====================================================================
    console.log('[E2E] Killing hub to simulate network partition...');
    try { servers.hub.kill('SIGTERM'); } catch { /* ok */ }
    await new Promise((r) => setTimeout(r, 1000));
    try { servers.hub.kill('SIGKILL'); } catch { /* ok */ }

    // Wait for Node A to detect disconnection
    await waitForNodeDisconnected(servers.nodeAUrl, 15_000);
    console.log('[E2E] Node A is disconnected from hub');

    // The UI should reflect the disconnection (within polling interval)
    // The ConnectionStatus component shows "Disconnected" with red LED
    // and an amber offline banner appears
    await expect(pageA.getByText(/Disconnected/i)).toBeVisible({ timeout: 10_000 });

    // =====================================================================
    // Phase 3: Submit an item while offline
    // =====================================================================
    // Navigate to "Log Item" tab
    await pageA.getByRole('tab', { name: /log item/i }).click();

    // Fill in the item details
    await pageA.fill('#item-name', 'Offline E2E — Keys');
    await pageA.selectOption('#category', 'Accessories');
    await pageA.click('input[value="found"]');
    await pageA.fill('#full-name', 'Pedro Penduko');
    await pageA.fill('#mobile', '09991234567');

    // Submit the form
    const submitButton = pageA.locator('button[type="submit"]', { hasText: 'Log Item' });
    await submitButton.click();

    // The API should succeed (HTTP 201, saved with synced=0)
    await expect(pageA.getByText(/item logged successfully/i)).toBeVisible({ timeout: 10_000 });

    // =====================================================================
    // Phase 4: Verify the item appears in Pending Sync
    // =====================================================================
    // Navigate to "Pending Sync" tab
    await pageA.getByRole('tab', { name: /pending sync/i }).click();

    // The pending sync count badge should show at least 1
    // And the item "Offline E2E — Keys" should appear in the pending list
    await expect(pageA.getByText('Offline E2E — Keys')).toBeVisible({ timeout: 10_000 });

    // The pending sync count badge should be visible
    const pendingBadge = pageA.locator('span:has-text("1")');
    await expect(pendingBadge).toBeVisible();

    // =====================================================================
    // Phase 5: Restart the hub and wait for eventual consistency
    // =====================================================================
    console.log('[E2E] Restarting hub...');
    await restartHub(servers);
    console.log('[E2E] Hub is back up');

    // Wait for Node A to reconnect to the hub
    await waitForNodeConnected(servers.nodeAUrl, 30_000);
    console.log('[E2E] Node A reconnected to hub');

    // When Node A reconnects, it should automatically flush the sync queue.
    // Wait for the pending count to reach 0 (items synced to hub)
    await waitForPendingCount(servers.nodeAUrl, 0, 30_000);
    console.log('[E2E] Node A sync queue flushed');

    // The UI should show "All synced — no pending items"
    await expect(pageA.getByText(/all synced/i)).toBeVisible({ timeout: 10_000 });

    // =====================================================================
    // Phase 6: Verify the item arrived on Node B (Eventual Consistency)
    // =====================================================================
    const pageB = await browser.newPage();
    await pageB.goto(servers.nodeBUrl);
    await expect(pageB.getByRole('heading', { name: /Lost & Found Tracker — Engineering/i })).toBeVisible();

    // Wait for the item to appear on Node B's Global Ledger
    await expect(pageB.getByText('Offline E2E — Keys')).toBeVisible({ timeout: 20_000 });

    // Verify item details are correct
    await expect(pageB.getByText('Accessories')).toBeVisible();
    await expect(pageB.getByRole('cell', { name: 'Security' })).toBeVisible();
    // Verify the item row contains a "found" status badge
    const itemRow = pageB.getByRole('row').filter({ hasText: 'Offline E2E — Keys' });
    await expect(itemRow.locator('span')).toContainText('found');

    // =====================================================================
    // Cleanup
    // =====================================================================
    await pageA.close();
    await pageB.close();
  });
});
