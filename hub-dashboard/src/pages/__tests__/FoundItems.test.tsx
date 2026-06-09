import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FoundItems from '../FoundItems'

const mockFetchAllItems = vi.fn()
vi.mock('../../hooks/useAdminApi', () => ({
  fetchAllItems: (...args: unknown[]) => mockFetchAllItems(...args),
}))

function createItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    item_name: 'Wallet',
    description: 'Black leather wallet',
    status: 'found',
    department_origin: 'Security',
    lost_location: null,
    found_location: 'Main Gate',
    surrendered_by: null,
    claimed_by: null,
    created_at: '2026-06-09T10:00:00.000Z',
    updated_at: '2026-06-09T10:00:00.000Z',
    surrenderer_full_name: 'John Finder',
    surrenderer_mobile: '09170000001',
    surrenderer_id_type: 'SSS',
    surrenderer_id_number: 'SSS-001',
    claimant_full_name: null,
    claimant_mobile: null,
    claimant_id_type: null,
    claimant_id_number: null,
    ...overrides,
  }
}

describe('Found Items Page', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders page title', () => {
    mockFetchAllItems.mockReturnValue(new Promise(() => {}))
    render(<FoundItems />)
    expect(screen.getByText('Found Items')).toBeInTheDocument()
  })

  it('renders error state', async () => {
    mockFetchAllItems.mockRejectedValue(new Error('API failure'))
    render(<FoundItems />)
    await waitFor(() => { expect(screen.getByText(/api failure/i)).toBeInTheDocument() })
  })

  it('renders empty state when no items exist', async () => {
    mockFetchAllItems.mockResolvedValue([])
    render(<FoundItems />)
    await waitFor(() => { expect(screen.getByText(/no items tracked/i)).toBeInTheDocument() })
  })

  it('renders empty state when no items match status', async () => {
    mockFetchAllItems.mockResolvedValue([
      createItem({ id: 1, item_name: 'Lost Item', status: 'lost' }),
      createItem({ id: 2, item_name: 'Claimed Item', status: 'claimed' }),
    ])
    render(<FoundItems />)
    await waitFor(() => { expect(screen.getByText(/no found items reported/i)).toBeInTheDocument() })
  })

  it('renders only found items', async () => {
    mockFetchAllItems.mockResolvedValue([
      createItem({ id: 1, item_name: 'Found Wallet', status: 'found' }),
      createItem({ id: 2, item_name: 'Lost Phone', status: 'lost' }),
    ])
    render(<FoundItems />)
    await waitFor(() => {
      expect(screen.getByText('Found Wallet')).toBeInTheDocument()
      expect(screen.queryByText('Lost Phone')).not.toBeInTheDocument()
    })
  })

  it('filters by search query', async () => {
    mockFetchAllItems.mockResolvedValue([
      createItem({ id: 1, item_name: 'Wallet', status: 'found' }),
      createItem({ id: 2, item_name: 'Keys', status: 'found' }),
    ])
    render(<FoundItems />)
    await waitFor(() => { expect(screen.getByText('Wallet')).toBeInTheDocument() })

    const searchInput = screen.getByPlaceholderText(/search/i)
    await userEvent.type(searchInput, 'Keys')
    expect(screen.queryByText('Wallet')).not.toBeInTheDocument()
    expect(screen.getByText('Keys')).toBeInTheDocument()
  })

  it('opens and closes detail modal', async () => {
    mockFetchAllItems.mockResolvedValue([
      createItem({ id: 3, item_name: 'Found Item', status: 'found' }),
    ])
    render(<FoundItems />)
    await waitFor(() => { expect(screen.getByText('Found Item')).toBeInTheDocument() })

    await userEvent.click(screen.getByText(/view/i))
    await waitFor(() => { expect(screen.getByText(/found item #3 detail/i)).toBeInTheDocument() })

    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    await waitFor(() => { expect(screen.queryByText(/found item #3 detail/i)).not.toBeInTheDocument() })
  })
})
