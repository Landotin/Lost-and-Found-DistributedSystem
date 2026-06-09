// ---------------------------------------------------------------------------
// Types for the Admin Dashboard API
// ---------------------------------------------------------------------------

/** A connected department node. */
export interface NodeInfo {
  socketId: string
  deptName: string
  connectedAt: string
}

/** A tracked item with full (unredacted) PII, as returned by `/api/admin/items`. */
export interface ItemDetail {
  id: number
  item_name: string
  description: string | null
  status: 'lost' | 'found' | 'claimed'
  department_origin: string
  lost_location: string | null
  found_location: string | null
  surrendered_by: number | null
  claimed_by: number | null
  created_at: string
  updated_at: string
  surrenderer_full_name: string | null
  surrenderer_mobile: string | null
  surrenderer_id_type: string | null
  surrenderer_id_number: string | null
  claimant_full_name: string | null
  claimant_mobile: string | null
  claimant_id_type: string | null
  claimant_id_number: string | null
}

/** Aggregated analytics data. */
export interface AnalyticsResult {
  itemsByDepartment: Record<string, number>
  claimRate: number
  totalItems: number
  totalFound: number
  totalClaimed: number
}

/** Hub health info. */
export interface HubHealth {
  uptime: number
  nodeCount: number
}

// ---------------------------------------------------------------------------
// API Client
// ---------------------------------------------------------------------------

const HUB_API_URL = import.meta.env.VITE_HUB_API_URL ?? 'http://localhost:5000'
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET ?? ''

async function adminRequest<T>(
  endpoint: string,
  options?: RequestInit & { adminSecret?: string },
): Promise<T> {
  const { adminSecret: explicitSecret, ...fetchOptions } = options ?? {}
  const secret = explicitSecret ?? ADMIN_SECRET

  const response = await fetch(`${HUB_API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': secret,
    },
    ...fetchOptions,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status}: ${response.statusText}${body ? ` — ${body}` : ''}`)
  }

  return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Admin API Functions
// ---------------------------------------------------------------------------

/** Fetch hub health info (uptime, node count). */
export function fetchHubHealth(): Promise<HubHealth> {
  return adminRequest<HubHealth>('/api/health', { method: 'GET' })
}

/** Fetch all items with full unredacted PII. */
export function fetchAllItems(): Promise<ItemDetail[]> {
  return adminRequest<ItemDetail[]>('/api/admin/items', { method: 'GET' })
}

/** Fetch the list of connected department nodes. */
export function fetchNodes(): Promise<NodeInfo[]> {
  return adminRequest<NodeInfo[]>('/api/admin/nodes', { method: 'GET' })
}

/** Force a SYNC_DUMP to a specific node by its socketId. */
export function forceSync(nodeId: string): Promise<{ success: boolean }> {
  return adminRequest<{ success: boolean }>(`/api/admin/nodes/${encodeURIComponent(nodeId)}/sync`, { method: 'POST' })
}

/** Disconnect a node by its socketId. */
export function disconnectNode(nodeId: string): Promise<{ success: boolean }> {
  return adminRequest<{ success: boolean }>(`/api/admin/nodes/${encodeURIComponent(nodeId)}/disconnect`, { method: 'POST' })
}

/** Fetch analytics data. */
export function fetchAnalytics(): Promise<AnalyticsResult> {
  return adminRequest<AnalyticsResult>('/api/admin/analytics', { method: 'GET' })
}
