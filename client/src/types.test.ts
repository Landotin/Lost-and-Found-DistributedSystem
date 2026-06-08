import { describe, it, expect } from 'vitest';
import type {
  Person,
  ItemStatus,
  Item,
  StatusResponse,
  PendingSyncResponse,
  CreatePersonPayload,
  CreateItemPayload,
} from './types';

describe('types', () => {
  it('Person type can be instantiated with required fields', () => {
    const person: Person = {
      id: '123',
      full_name: 'John Doe',
      mobile: '+639123456789',
    };
    expect(person.id).toBe('123');
    expect(person.full_name).toBe('John Doe');
    expect(person.mobile).toBe('+639123456789');
  });

  it('Person type can include optional fields', () => {
    const person: Person = {
      id: '456',
      full_name: 'Jane Doe',
      mobile: '+639987654321',
      id_type: 'driver_license',
      id_number: 'DL-12345',
      created_at: '2026-01-01T00:00:00Z',
    };
    expect(person.id_type).toBe('driver_license');
    expect(person.id_number).toBe('DL-12345');
  });

  it('ItemStatus is a union of lost, found, claimed', () => {
    const lost: ItemStatus = 'lost';
    const found: ItemStatus = 'found';
    const claimed: ItemStatus = 'claimed';
    expect(lost).toBe('lost');
    expect(found).toBe('found');
    expect(claimed).toBe('claimed');
  });

  it('Item type can be instantiated with required fields', () => {
    const item: Item = {
      id: 'item-1',
      item_name: 'Wallet',
      department_origin: 'DOST',
      status: 'lost',
      synced: 0,
    };
    expect(item.item_name).toBe('Wallet');
    expect(item.status).toBe('lost');
  });

  it('Item type can include optional fields', () => {
    const item: Item = {
      id: 'item-2',
      item_name: 'Phone',
      department_origin: 'DOST',
      status: 'claimed',
      synced: 1,
      description: 'Black iPhone',
      category: 'electronics',
      surrendered_by: 'person-1',
      claimed_by: 'person-2',
      claimed_at: '2026-06-01T00:00:00Z',
      updated_at: '2026-06-01T00:00:00Z',
      created_at: '2026-05-01T00:00:00Z',
    };
    expect(item.description).toBe('Black iPhone');
    expect(item.category).toBe('electronics');
  });

  it('StatusResponse type structure is correct', () => {
    const status: StatusResponse = {
      deptName: 'DOST',
      connected: true,
      status: 'connected',
      nodeCount: 2,
      nodes: [
        {
          dept_name: 'DOST',
          socket_id: 'socket-1',
          connected_at: '2026-06-01T00:00:00Z',
        },
      ],
    };
    expect(status.connected).toBe(true);
    expect(status.nodes).toHaveLength(1);
  });

  it('StatusResponse status can be disconnected or connecting', () => {
    const disconnected: StatusResponse = {
      deptName: 'DOST',
      connected: false,
      status: 'disconnected',
      nodeCount: 0,
      nodes: [],
    };
    expect(disconnected.status).toBe('disconnected');

    const connecting: StatusResponse = {
      deptName: 'DOST',
      connected: false,
      status: 'connecting',
      nodeCount: 0,
      nodes: [],
    };
    expect(connecting.status).toBe('connecting');
  });

  it('PendingSyncResponse type structure is correct', () => {
    const pending: PendingSyncResponse = {
      count: 1,
      items: [
        {
          id: 'item-1',
          item_name: 'Wallet',
          department_origin: 'DOST',
          status: 'lost',
          synced: 0,
        },
      ],
    };
    expect(pending.count).toBe(1);
    expect(pending.items).toHaveLength(1);
  });

  it('CreatePersonPayload type can be instantiated', () => {
    const payload: CreatePersonPayload = {
      full_name: 'John Doe',
      mobile: '+639123456789',
    };
    expect(payload.full_name).toBe('John Doe');
  });

  it('CreatePersonPayload can include optional id fields', () => {
    const payload: CreatePersonPayload = {
      full_name: 'Jane Doe',
      mobile: '+639987654321',
      id_type: 'passport',
      id_number: 'P-12345',
    };
    expect(payload.id_type).toBe('passport');
  });

  it('CreateItemPayload type can be instantiated', () => {
    const payload: CreateItemPayload = {
      item_name: 'Wallet',
      status: 'lost',
    };
    expect(payload.item_name).toBe('Wallet');
    expect(payload.status).toBe('lost');
  });

  it('CreateItemPayload can use found status and include optional fields', () => {
    const payload: CreateItemPayload = {
      item_name: 'Phone',
      description: 'Black iPhone',
      category: 'electronics',
      status: 'found',
      surrendered_by: 'person-1',
    };
    expect(payload.status).toBe('found');
    expect(payload.surrendered_by).toBe('person-1');
  });
});
