export interface Person {
  id: string;
  full_name: string;
  mobile: string;
  id_type?: string;
  id_number?: string;
  created_at?: string;
}

export type ItemStatus = 'lost' | 'found' | 'claimed';

export interface Item {
  id: string;
  item_name: string;
  description?: string;
  category?: string;
  department_origin: string;
  status: ItemStatus;
  surrendered_by?: string;
  claimed_by?: string;
  claimed_at?: string;
  synced: number;
  updated_at?: string;
  created_at?: string;
}

export interface StatusResponse {
  deptName: string;
  connected: boolean;
  status: 'connected' | 'disconnected' | 'connecting';
  nodeCount: number;
  nodes: Array<{
    dept_name: string;
    socket_id: string;
    connected_at: string;
  }>;
}

export interface PendingSyncResponse {
  count: number;
  items: Item[];
}

export interface CreatePersonPayload {
  full_name: string;
  mobile: string;
  id_type?: string;
  id_number?: string;
}

export interface CreateItemPayload {
  item_name: string;
  description?: string;
  category?: string;
  status: 'lost' | 'found';
  surrendered_by?: string;
}
