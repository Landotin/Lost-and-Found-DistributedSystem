const HUB_API_URL = import.meta.env.VITE_HUB_API_URL ?? 'http://localhost:5000/api'
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET ?? ''

async function adminRequest<T>(
  endpoint: string,
  options?: RequestInit & { adminSecret?: string },
): Promise<T> {
  const secret = options?.adminSecret ?? ADMIN_SECRET
  const { adminSecret: _, ...fetchOptions } = options ?? {}

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

  return response.json()
}

/** Fetch hub health info (uptime, node count). */
export function fetchHubHealth(): Promise<{ uptime: number; nodeCount: number }> {
  return adminRequest<{ uptime: number; nodeCount: number }>('/health', { method: 'GET' })
}

/** Fetch all items in the global ledger. */
export function fetchAllItems(): Promise<unknown[]> {
  return adminRequest<unknown[]>('/items', { method: 'GET' })
}

/** Fetch the list of connected nodes. */
export function fetchNodes(): Promise<unknown[]> {
  return adminRequest<unknown[]>('/nodes', { method: 'GET' })
}
