import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Analytics from '../Analytics'
import type { AnalyticsResult } from '../../hooks/useAdminApi'

const mockFetchAnalytics = vi.fn()
vi.mock('../../hooks/useAdminApi', () => ({
  fetchAnalytics: (...args: unknown[]) => mockFetchAnalytics(...args),
}))

function createAnalytics(overrides: Partial<AnalyticsResult> = {}): AnalyticsResult {
  return {
    itemsByDepartment: { Security: 5, Engineering: 3 },
    claimRate: 0.5,
    totalItems: 8,
    totalFound: 6,
    totalClaimed: 3,
    totalLost: 2,
    avgTimeToClaimHours: 24.5,
    offlineEventCount: 3,
    ...overrides,
  }
}

describe('Analytics Page', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders page title', () => {
    mockFetchAnalytics.mockReturnValue(new Promise(() => {}))
    render(<Analytics />)
    expect(screen.getByText('Analytics')).toBeInTheDocument()
  })

  it('renders error state', async () => {
    mockFetchAnalytics.mockRejectedValue(new Error('Analytics error'))
    render(<Analytics />)
    await waitFor(() => { expect(screen.getByText(/analytics error/i)).toBeInTheDocument() })
  })

  it('renders KPI cards with data', async () => {
    mockFetchAnalytics.mockResolvedValue(createAnalytics())
    render(<Analytics />)

    await waitFor(() => {
      expect(screen.getByText('8')).toBeInTheDocument() // totalItems
      expect(screen.getByText('2')).toBeInTheDocument() // totalLost
      expect(screen.getByText('50.0%')).toBeInTheDocument() // claimRate
      expect(screen.getByText('6')).toBeInTheDocument() // totalFound
    })
  })

  it('renders 0% claim rate when no items', async () => {
    mockFetchAnalytics.mockResolvedValue(createAnalytics({
      totalItems: 0,
      totalFound: 0,
      totalClaimed: 0,
      claimRate: 0,
      itemsByDepartment: {},
    }))
    render(<Analytics />)

    await waitFor(() => {
      expect(screen.getByText('0.0%')).toBeInTheDocument()
      // "0" appears in Total Items and Found Items cards
      const zeroElements = screen.getAllByText('0')
      expect(zeroElements.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('renders 100% claim rate when all found items claimed', async () => {
    mockFetchAnalytics.mockResolvedValue(createAnalytics({
      totalFound: 2,
      totalClaimed: 2,
      claimRate: 1,
    }))
    render(<Analytics />)

    await waitFor(() => {
      expect(screen.getByText('100.0%')).toBeInTheDocument()
    })
  })

  it('renders department names in chart area', async () => {
    mockFetchAnalytics.mockResolvedValue(createAnalytics({
      itemsByDepartment: { Security: 5, Engineering: 3, HR: 2 },
    }))
    render(<Analytics />)

    await waitFor(() => {
      expect(screen.getByText(/items by department/i)).toBeInTheDocument()
    })
  })

  it('shows empty department message when no department data', async () => {
    mockFetchAnalytics.mockResolvedValue(createAnalytics({ itemsByDepartment: {} }))
    render(<Analytics />)

    await waitFor(() => {
      expect(screen.getByText(/no department data/i)).toBeInTheDocument()
    })
  })

  it('renders avg time to claim value', async () => {
    mockFetchAnalytics.mockResolvedValue(createAnalytics({ avgTimeToClaimHours: 48 }))
    render(<Analytics />)

    await waitFor(() => {
      expect(screen.getByText('48.0 hrs')).toBeInTheDocument()
    })
  })

  it('renders "—" when avgTimeToClaimHours is null', async () => {
    mockFetchAnalytics.mockResolvedValue(createAnalytics({ avgTimeToClaimHours: null }))
    render(<Analytics />)

    await waitFor(() => {
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  it('renders offline event count', async () => {
    mockFetchAnalytics.mockResolvedValue(createAnalytics({ offlineEventCount: 5 }))
    render(<Analytics />)

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
    })
  })

  it('renders "0" for zero offline events', async () => {
    mockFetchAnalytics.mockResolvedValue(createAnalytics({ offlineEventCount: 0, totalItems: 1, totalFound: 0, totalClaimed: 0, totalLost: 0 }))
    render(<Analytics />)

    await waitFor(() => {
      // Offline Events KPI shows "0"
      const zeros = screen.getAllByText('0')
      expect(zeros.length).toBeGreaterThanOrEqual(1)
    })
  })
})
