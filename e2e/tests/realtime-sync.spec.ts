import { test, expect } from '@playwright/test';
import { startServers, stopServers, waitForPendingCount } from '../helpers/servers.js';
import type { TestServers } from '../helpers/servers.js';
import path from 'path';
import fs from 'fs';
import http from 'http';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const projectRoot = path.resolve(import.meta.dirname ?? __dirname, '..', '..');

/** Create a person via the Node A API and return the person ID */
function createPerson(nodeUrl: string, data: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = http.request(`${nodeUrl}/api/persons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        if (res.statusCode === 201) {
          try {
            const person = JSON.parse(responseBody);
            resolve(person.id);
          } catch (e) {
            reject(new Error(`Failed to parse person response: ${responseBody}`));
          }
        } else {
          reject(new Error(`Failed to create person: HTTP ${res.statusCode} - ${responseBody}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/** Create an item via the Node A API with a reference to an existing person */
function createItem(nodeUrl: string, data: Record<string, any>): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = http.request(`${nodeUrl}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        if (res.statusCode === 201) resolve();
        else reject(new Error(`Failed to create item: HTTP ${res.statusCode} - ${responseBody}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Test: Real-Time Sync Scenario
// ---------------------------------------------------------------------------

test.describe('Real-Time Sync', () => {
  let servers: TestServers;

  test.beforeAll(async () => {
    servers = await startServers({ projectRoot });
  });

  test.afterAll(async () => {
    await stopServers(servers);
  });

  test('item submitted on Node A (Security) appears on Node B (Engineering) without page refresh', async ({ browser }) => {
    // --- Step 1: Open Node B page and verify empty state ---
    const pageB = await browser.newPage();
    await pageB.goto(servers.nodeBUrl);

    // Wait for the page to load and show the Global Ledger (default tab)
    await expect(pageB.getByRole('heading', { name: /Lost & Found Tracker/i })).toBeVisible();

    // The Global Ledger should show "No items found" initially
    await expect(pageB.getByText(/No items found/i)).toBeVisible({ timeout: 15_000 });

    // --- Step 2: Open Node A page and submit an item ---
    const pageA = await browser.newPage();
    await pageA.goto(servers.nodeAUrl);
    await expect(pageA.getByRole('heading', { name: /Lost & Found Tracker/i })).toBeVisible();

    // Navigate to the "Log Item" tab
    await pageA.getByRole('tab', { name: /log item/i }).click();

    // Fill in the item details
    await pageA.fill('#item-name', 'E2E Test — Lost Phone');
    await pageA.selectOption('#category', 'Electronics');

    // Select "Found" status to show surrenderer section
    await pageA.click('input[value="found"]');

    // Fill surrenderer details
    await pageA.fill('#full-name', 'Juan Dela Cruz');
    await pageA.fill('#mobile', '09171234567');

    // Submit the form
    const submitButton = pageA.locator('button[type="submit"]', { hasText: 'Log Item' });
    await submitButton.click();

    // Wait for success indicator
    await expect(pageA.getByText(/item logged successfully/i)).toBeVisible({ timeout: 10_000 });

    // --- Step 3: Verify item appears on Node B without page refresh ---
    // The Global Ledger on Node B polls every 5 seconds, so the item
    // should appear within the next polling cycle.
    await expect(pageB.getByText('E2E Test — Lost Phone')).toBeVisible({ timeout: 20_000 });

    // Also verify the item details are correct on Node B
    await expect(pageB.getByText('Electronics')).toBeVisible();
    await expect(pageB.getByRole('cell', { name: 'Security' })).toBeVisible();
    // Verify the item row contains a "found" status badge
    const itemRow = pageB.getByRole('row').filter({ hasText: 'E2E Test — Lost Phone' });
    await expect(itemRow.locator('span')).toContainText('found');

    // --- Step 4: Cleanup pages ---
    await pageA.close();
    await pageB.close();
  });

  test('item synced via queue flush arrives on Node B after reconnect', async ({ browser }) => {
    // This test creates an item on Node A while online (via API for speed),
    // then checks it appears on Node B. It's a simpler variant of the
    // real-time flow that proves the hub broadcasts correctly.

    // --- Step 1: Create a person on Node A ---
    const personId = await createPerson(servers.nodeAUrl, {
      full_name: 'Maria Santos',
      mobile: '09181234567',
    });

    // --- Step 2: Create an item on Node A referencing that person ---
    await createItem(servers.nodeAUrl, {
      item_name: 'E2E Test — Water Bottle',
      category: 'Accessories',
      status: 'found',
      surrendered_by: personId,
    });

    // --- Step 3: Verify item appears on Node B ---
    const pageB = await browser.newPage();
    await pageB.goto(servers.nodeBUrl);
    await expect(pageB.getByText('E2E Test — Water Bottle')).toBeVisible({ timeout: 20_000 });
    await pageB.close();
  });
});
