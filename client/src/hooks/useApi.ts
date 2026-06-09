import type { StatusResponse, Item, Person, CreatePersonPayload, CreateItemPayload, ItemStatus, PendingSyncResponse } from '../types';

const BASE_URL = '';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export function fetchStatus(): Promise<StatusResponse> {
  return request<StatusResponse>('/api/status', { method: 'GET' });
}

export function fetchItems(): Promise<Item[]> {
  return request<Item[]>('/api/items', { method: 'GET' });
}

export function createPerson(data: CreatePersonPayload): Promise<Person> {
  return request<Person>('/api/persons', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function createItem(data: CreateItemPayload): Promise<Item> {
  return request<Item>('/api/items', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateItemStatus(id: string, status: ItemStatus, claimed_by?: string, surrendered_by?: string): Promise<Item> {
  return request<Item>(`/api/items/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      ...(claimed_by !== undefined ? { claimed_by } : {}),
      ...(surrendered_by !== undefined ? { surrendered_by } : {}),
    }),
  });
}

export function fetchPendingSync(): Promise<PendingSyncResponse> {
  return request<PendingSyncResponse>('/api/pending', { method: 'GET' });
}
