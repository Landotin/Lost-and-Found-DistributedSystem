import { useMemo } from 'react'
import type { ItemDetail } from './useAdminApi'

export type ItemStatus = 'lost' | 'found' | 'claimed' | 'all'

/**
 * Two-stage item filtering: first by status, then by search query.
 *
 * Stage 1 filters `items` to those matching `status` (skipped when status is 'all').
 * Stage 2 further narrows by case-insensitive matching of `searchQuery` against
 * the item name, department, surrenderer name, and claimant name.
 */
export function useItemFilter(
  items: ItemDetail[] | null,
  status: ItemStatus,
  searchQuery: string,
): { statusFiltered: ItemDetail[]; searched: ItemDetail[] } {
  const statusFiltered = useMemo(() => {
    if (!items) return []
    if (status === 'all') return items
    return items.filter((item) => item.status === status)
  }, [items, status])

  const searched = useMemo(() => {
    if (!searchQuery.trim()) return statusFiltered
    const q = searchQuery.trim().toLowerCase()
    return statusFiltered.filter((item) => {
      return (
        item.item_name.toLowerCase().includes(q) ||
        item.department_origin.toLowerCase().includes(q) ||
        String(item.id).includes(q) ||
        (item.surrenderer_full_name?.toLowerCase().includes(q) ?? false) ||
        (item.claimant_full_name?.toLowerCase().includes(q) ?? false) ||
        (item.reporter_full_name?.toLowerCase().includes(q) ?? false) ||
        item.status.toLowerCase().includes(q)
      )
    })
  }, [statusFiltered, searchQuery])

  return { statusFiltered, searched }
}
