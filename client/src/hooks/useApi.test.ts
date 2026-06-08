import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchStatus,
  fetchItems,
  createPerson,
  createItem,
  updateItemStatus,
  fetchPendingSync,
} from './useApi';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchStatus', () => {
  it('calls GET /api/status and returns StatusResponse', async () => {
    const expected = { deptName: 'DOST', connected: true, status: 'connected', nodeCount: 1, nodes: [] };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(expected) });

    const result = await fetchStatus();
    expect(mockFetch).toHaveBeenCalledWith('/api/status', { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    expect(result).toEqual(expected);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(fetchStatus()).rejects.toThrow();
  });
});

describe('fetchItems', () => {
  it('calls GET /api/items and returns Item array', async () => {
    const expected = [{ id: '1', item_name: 'Wallet', department_origin: 'DOST', status: 'lost', synced: 0 }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(expected) });

    const result = await fetchItems();
    expect(mockFetch).toHaveBeenCalledWith('/api/items', { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    expect(result).toEqual(expected);
  });
});

describe('createPerson', () => {
  it('calls POST /api/persons with payload and returns Person', async () => {
    const payload = { full_name: 'John Doe', mobile: '+639123456789' };
    const expected = { id: 'p1', full_name: 'John Doe', mobile: '+639123456789' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(expected) });

    const result = await createPerson(payload);
    expect(mockFetch).toHaveBeenCalledWith('/api/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(result).toEqual(expected);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });
    await expect(createPerson({ full_name: '', mobile: '' })).rejects.toThrow();
  });
});

describe('createItem', () => {
  it('calls POST /api/items with payload and returns Item', async () => {
    const payload = { item_name: 'Wallet', status: 'lost' as const };
    const expected = { id: 'i1', item_name: 'Wallet', department_origin: 'DOST', status: 'lost', synced: 0 };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(expected) });

    const result = await createItem(payload);
    expect(mockFetch).toHaveBeenCalledWith('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(result).toEqual(expected);
  });
});

describe('updateItemStatus', () => {
  it('calls PATCH /api/items/:id/status with status and claimed_by', async () => {
    const expected = { id: 'i1', item_name: 'Wallet', department_origin: 'DOST', status: 'claimed', synced: 0 };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(expected) });

    const result = await updateItemStatus('i1', 'claimed', 'p1');
    expect(mockFetch).toHaveBeenCalledWith('/api/items/i1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'claimed', claimed_by: 'p1' }),
    });
    expect(result).toEqual(expected);
  });

  it('can call updateItemStatus without claimed_by', async () => {
    const expected = { id: 'i1', item_name: 'Wallet', department_origin: 'DOST', status: 'found', synced: 0 };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(expected) });

    const result = await updateItemStatus('i1', 'found');
    expect(mockFetch).toHaveBeenCalledWith('/api/items/i1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'found' }),
    });
    expect(result).toEqual(expected);
  });
});

describe('fetchPendingSync', () => {
  it('calls GET /api/pending and returns PendingSyncResponse', async () => {
    const expected = { count: 0, items: [] };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(expected) });

    const result = await fetchPendingSync();
    expect(mockFetch).toHaveBeenCalledWith('/api/pending', { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    expect(result).toEqual(expected);
  });
});
