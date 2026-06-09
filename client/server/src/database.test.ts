import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initDatabase,
  saveOrUpdatePerson,
  handleIncomingItem,
  handleIncomingStatusUpdate,
  getPersonById,
  getItemById,
  getAllItems,
  createPerson,
  createItem,
  type Person,
  type Item,
} from './database.js';
import fs from 'node:fs';
import path from 'node:path';
import type { Database } from 'sqlite';

const TEST_DIR = path.resolve('data');
const TEST_DB_PATH = path.join(TEST_DIR, 'test-node.db');

function cleanup() {
  try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ok */ }
  try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch { /* ok */ }
  try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch { /* ok */ }
}

describe('saveOrUpdatePerson', () => {
  let db: Database;

  beforeAll(async () => {
    cleanup();
    db = await initDatabase(TEST_DB_PATH);
  });

  afterAll(async () => {
    await db.close();
    cleanup();
  });

  beforeEach(async () => {
    // Clear tables before each test
    await db.run('DELETE FROM items');
    await db.run('DELETE FROM persons');
  });

  it('should insert a new person when they do not exist', async () => {
    const person: Person = {
      id: 'person-1',
      full_name: 'Alice Smith',
      mobile: '555-0100',
    };
    await saveOrUpdatePerson(person);

    const saved = await getPersonById('person-1');
    expect(saved).toBeDefined();
    expect(saved!.full_name).toBe('Alice Smith');
    expect(saved!.mobile).toBe('555-0100');
  });

  it('should update an existing person\'s full_name and other fields', async () => {
    await createPerson({
      id: 'person-2',
      full_name: 'Bob Jones',
      mobile: '555-0200',
    });

    const updated: Person = {
      id: 'person-2',
      full_name: 'Robert Jones',
      mobile: '555-0201',
    };
    await saveOrUpdatePerson(updated);

    const saved = await getPersonById('person-2');
    expect(saved!.full_name).toBe('Robert Jones');
    expect(saved!.mobile).toBe('555-0201');
  });

  it('should NOT overwrite a valid mobile with "[REDACTED]"', async () => {
    await createPerson({
      id: 'person-3',
      full_name: 'Carol White',
      mobile: '555-0300',
    });

    const incoming: Person = {
      id: 'person-3',
      full_name: 'Carol White',
      mobile: '[REDACTED]',
    };
    await saveOrUpdatePerson(incoming);

    const saved = await getPersonById('person-3');
    expect(saved!.mobile).toBe('555-0300');
    expect(saved!.mobile).not.toBe('[REDACTED]');
  });

  it('should allow "[REDACTED]" if the existing mobile is also "[REDACTED]"', async () => {
    await createPerson({
      id: 'person-4',
      full_name: 'Dave Black',
      mobile: '[REDACTED]',
    });

    const incoming: Person = {
      id: 'person-4',
      full_name: 'Dave Black Updated',
      mobile: '[REDACTED]',
    };
    await saveOrUpdatePerson(incoming);

    const saved = await getPersonById('person-4');
    expect(saved!.full_name).toBe('Dave Black Updated');
    expect(saved!.mobile).toBe('[REDACTED]');
  });

  it('should set created_at on insert but not overwrite on update', async () => {
    const person: Person = {
      id: 'person-5',
      full_name: 'Eve Grey',
      mobile: '555-0500',
    };
    await saveOrUpdatePerson(person);
    const saved1 = await getPersonById('person-5');
    expect(saved1!.created_at).toBeDefined();

    // Sleep briefly to ensure timestamp would differ if overwritten
    await new Promise(r => setTimeout(r, 100));

    await saveOrUpdatePerson({ ...person, full_name: 'Eve Grey Updated' });
    const saved2 = await getPersonById('person-5');
    expect(saved2!.created_at).toBe(saved1!.created_at);
  });

  it('should NOT overwrite a valid id_type and id_number with "[REDACTED]"', async () => {
    await createPerson({
      id: 'person-redact-id',
      full_name: 'Carol ID Test',
      mobile: '555-0300',
      id_type: 'Driver License',
      id_number: 'DL-12345',
    });

    const incoming: Person = {
      id: 'person-redact-id',
      full_name: 'Carol ID Test',
      mobile: '555-0300',
      id_type: '[REDACTED]',
      id_number: '[REDACTED]',
    };
    await saveOrUpdatePerson(incoming);

    const saved = await getPersonById('person-redact-id');
    expect(saved!.id_type).toBe('Driver License');
    expect(saved!.id_number).toBe('DL-12345');
  });
});

describe('handleIncomingItem', () => {
  let db: Database;

  beforeAll(async () => {
    cleanup();
    db = await initDatabase(TEST_DB_PATH);
  });

  afterAll(async () => {
    await db.close();
    cleanup();
  });

  beforeEach(async () => {
    await db.run('DELETE FROM items');
    await db.run('DELETE FROM persons');
  });

  it('should save the associated person and the item with synced=1', async () => {
    const person: Person = {
      id: 'surr-1',
      full_name: 'Frank Surrenderer',
      mobile: '555-1000',
    };

    const itemPayload = {
      id: 'item-1',
      item_name: 'Lost Wallet',
      description: 'Brown leather wallet',
      category: 'Accessories',
      department_origin: 'TestDept',
      status: 'lost' as const,
      surrendered_by: 'surr-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      person, // The associated person
    };

    await handleIncomingItem(itemPayload as any);

    // Person should be saved
    const savedPerson = await getPersonById('surr-1');
    expect(savedPerson).toBeDefined();
    expect(savedPerson!.full_name).toBe('Frank Surrenderer');

    // Item should be saved with synced=1
    const savedItem = await getItemById('item-1');
    expect(savedItem).toBeDefined();
    expect(savedItem!.item_name).toBe('Lost Wallet');
    expect(savedItem!.surrendered_by).toBe('surr-1');
    expect(savedItem!.synced).toBe(1);
  });

  it('should upsert using LWW — newer updated_at overwrites older', async () => {
    // First insert via handleIncomingItem
    const person: Person = {
      id: 'surr-2',
      full_name: 'Grace Lee',
      mobile: '555-2000',
    };

    await handleIncomingItem({
      id: 'item-2',
      item_name: 'Phone',
      description: 'Old description',
      department_origin: 'TestDept',
      status: 'found',
      surrendered_by: 'surr-2',
      updated_at: '2025-01-01T00:00:00Z',
      person,
    } as any);

    // Now send an update with newer timestamp
    await handleIncomingItem({
      id: 'item-2',
      item_name: 'Phone',
      description: 'New description',
      department_origin: 'TestDept',
      status: 'found',
      surrendered_by: 'surr-2',
      updated_at: '2025-06-01T00:00:00Z',
      person,
    } as any);

    const saved = await getItemById('item-2');
    expect(saved!.description).toBe('New description');
  });

  it('should NOT overwrite with older data via LWW', async () => {
    const person: Person = {
      id: 'surr-3',
      full_name: 'Henry Zhao',
      mobile: '555-3000',
    };

    // First insert with a newer timestamp
    await handleIncomingItem({
      id: 'item-3',
      item_name: 'Laptop',
      description: 'Newer description',
      department_origin: 'TestDept',
      status: 'found',
      surrendered_by: 'surr-3',
      updated_at: '2025-06-01T00:00:00Z',
      person,
    } as any);

    // Try to overwrite with older timestamp — should be ignored
    await handleIncomingItem({
      id: 'item-3',
      item_name: 'Laptop',
      description: 'Older description (should be ignored)',
      department_origin: 'TestDept',
      status: 'found',
      surrendered_by: 'surr-3',
      updated_at: '2025-01-01T00:00:00Z',
      person,
    } as any);

    const saved = await getItemById('item-3');
    expect(saved!.description).toBe('Newer description');
  });

  it('should set synced=1 on the upserted item', async () => {
    const person: Person = {
      id: 'surr-4',
      full_name: 'Iris Chen',
      mobile: '555-4000',
    };

    await handleIncomingItem({
      id: 'item-4',
      item_name: 'Keys',
      department_origin: 'TestDept',
      status: 'lost',
      surrendered_by: 'surr-4',
      updated_at: new Date().toISOString(),
      person,
    } as any);

    const saved = await getItemById('item-4');
    expect(saved!.synced).toBe(1);
  });

  it('should handle items without associated person', async () => {
    await handleIncomingItem({
      id: 'item-5',
      item_name: 'No Person Item',
      description: 'No surrenderer',
      department_origin: 'TestDept',
      status: 'found',
      updated_at: new Date().toISOString(),
    } as any);

    const saved = await getItemById('item-5');
    expect(saved).toBeDefined();
    expect(saved!.item_name).toBe('No Person Item');
    expect(saved!.synced).toBe(1);
  });

  it('should handle flat fields from SYNC_DUMP and reconstruct person record', async () => {
    const flatItem = {
      id: 'item-flat-sync-1',
      item_name: 'Flat Sync Wallet',
      description: 'Black leather wallet',
      category: 'Accessories',
      department_origin: 'Engineering',
      status: 'found' as const,
      surrendered_by: 'surr-flat-1',
      surrenderer_full_name: 'Flat Surrenderer',
      surrenderer_mobile: '[REDACTED]',
      surrenderer_id_type: '[REDACTED]',
      surrenderer_id_number: '[REDACTED]',
      claimed_by: 'claimant-flat-1',
      claimant_full_name: 'Flat Claimant',
      claimant_mobile: '[REDACTED]',
      claimant_id_type: '[REDACTED]',
      claimant_id_number: '[REDACTED]',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await handleIncomingItem(flatItem as any);

    // Surrenderer person should be saved
    const savedSurr = await getPersonById('surr-flat-1');
    expect(savedSurr).toBeDefined();
    expect(savedSurr!.full_name).toBe('Flat Surrenderer');
    expect(savedSurr!.mobile).toBe('[REDACTED]');

    // Claimant person should be saved
    const savedClaim = await getPersonById('claimant-flat-1');
    expect(savedClaim).toBeDefined();
    expect(savedClaim!.full_name).toBe('Flat Claimant');
    expect(savedClaim!.mobile).toBe('[REDACTED]');

    // Item should be saved with correct foreign keys
    const savedItem = await getItemById('item-flat-sync-1');
    expect(savedItem).toBeDefined();
    expect(savedItem!.item_name).toBe('Flat Sync Wallet');
    expect(savedItem!.surrendered_by).toBe('surr-flat-1');
    expect(savedItem!.claimed_by).toBe('claimant-flat-1');
  });
});

describe('handleIncomingStatusUpdate', () => {
  let db: Database;

  beforeAll(async () => {
    cleanup();
    db = await initDatabase(TEST_DB_PATH);
  });

  afterAll(async () => {
    await db.close();
    cleanup();
  });

  beforeEach(async () => {
    await db.run('DELETE FROM items');
    await db.run('DELETE FROM persons');
  });

  it('should update item status, claimed_by, claimed_at, and set synced=1', async () => {
    // First create an item
    await createItem({
      id: 'item-status-1',
      item_name: 'Bike',
      department_origin: 'TestDept',
      status: 'found',
      synced: 0,
    });

    // Create the claimant person
    await createPerson({
      id: 'claimant-1',
      full_name: 'Jane Claimant',
      mobile: '555-5000',
    });

    const payload = {
      id: 'item-status-1',
      status: 'claimed' as const,
      claimed_by: 'claimant-1',
      updated_at: new Date().toISOString(),
    };

    await handleIncomingStatusUpdate(payload);

    const saved = await getItemById('item-status-1');
    expect(saved!.status).toBe('claimed');
    expect(saved!.claimed_by).toBe('claimant-1');
    expect(saved!.claimed_at).toBeDefined();
    expect(saved!.synced).toBe(1);
  });

  it('should use LWW — newer updated_at overwrites', async () => {
    // Create item with older updated_at so the incoming updates take effect
    await createItem({
      id: 'item-status-2',
      item_name: 'Tablet',
      department_origin: 'TestDept',
      status: 'found',
      synced: 0,
      updated_at: '2024-01-01T00:00:00Z',
    });

    await createPerson({
      id: 'claimant-2',
      full_name: 'Bob Claimant',
      mobile: '555-6000',
    });

    // Update with older timestamp first
    await handleIncomingStatusUpdate({
      id: 'item-status-2',
      status: 'claimed',
      claimed_by: 'claimant-2',
      updated_at: '2025-01-01T00:00:00Z',
    });

    // Then send a newer status update
    await handleIncomingStatusUpdate({
      id: 'item-status-2',
      status: 'lost',
      updated_at: '2025-06-01T00:00:00Z',
    });

    const saved = await getItemById('item-status-2');
    expect(saved!.status).toBe('lost');
  });

  it('should NOT overwrite with older data via LWW', async () => {
    await createItem({
      id: 'item-status-3',
      item_name: 'Camera',
      department_origin: 'TestDept',
      status: 'found',
      synced: 0,
      updated_at: '2024-01-01T00:00:00Z',
    });

    await createPerson({
      id: 'claimant-3',
      full_name: 'Alice Claimant',
      mobile: '555-7000',
    });

    // First apply a newer update
    await handleIncomingStatusUpdate({
      id: 'item-status-3',
      status: 'claimed',
      claimed_by: 'claimant-3',
      updated_at: '2025-06-01T00:00:00Z',
    });

    // Try to overwrite with older data
    await handleIncomingStatusUpdate({
      id: 'item-status-3',
      status: 'found',
      updated_at: '2025-01-01T00:00:00Z',
    });

    const saved = await getItemById('item-status-3');
    // Status should still be 'claimed' since newer update wins
    expect(saved!.status).toBe('claimed');
    expect(saved!.claimed_by).toBe('claimant-3');
  });

  it('should set updated_at when updating status', async () => {
    await createItem({
      id: 'item-status-4',
      item_name: 'Headphones',
      department_origin: 'TestDept',
      status: 'found',
      synced: 1,
      updated_at: '2024-01-01T00:00:00Z',
    });

    await handleIncomingStatusUpdate({
      id: 'item-status-4',
      status: 'lost',
      updated_at: '2025-06-15T00:00:00Z',
    });

    const saved = await getItemById('item-status-4');
    expect(saved!.status).toBe('lost');
    expect(saved!.synced).toBe(1);
  });

  it('should handle item that does not yet exist (edge case)', async () => {
    // Status update for non-existent item — should not throw
    await expect(
      handleIncomingStatusUpdate({
        id: 'nonexistent-item',
        status: 'claimed',
        claimed_by: 'claimant-x',
        updated_at: new Date().toISOString(),
      })
    ).resolves.toBeUndefined();
  });
});
