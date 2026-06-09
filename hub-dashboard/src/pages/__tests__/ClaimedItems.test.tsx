import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ClaimedItems from '../ClaimedItems'

const mockFetchAllItems = vi.fn()
vi.mock('../../hooks/useAdminApi', () => ({
  fetchAllItems: (...args: unknown[]) => mockFetchAllItems(...args),
}))

function createItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    item_name: 'Laptop',
    description: 'Dell XPS 15',
    status: 'claimed',
    department_origin: 'Security',
    lost_location: null,
    found_location: 'Main Gate',
    surrendered_by: null,
    claimed_by: null,
    created_at: '2026-06-09T10:00:00.000Z',
    updated_at: '2026-06-10T14:00:00.000Z',
    surrenderer_full_name: 'John Finder',
    surrenderer_mobile: '09170000001',
    surrenderer_id_type: 'SSS',
    surrenderer_id_number: 'SSS-001',
    claimant_full_name: 'Jane Claimant',
    claimant_mobile: '09170000002',
    claimant_id_type: 'Driver License',
    claimant_id_number: 'DL-002',
    ...overrides,
  }
}

describe('Claimed Items Page', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders page title', () => {
    mockFetchAllItems.mockReturnValue(new Promise(() => {}))
    render(<ClaimedItems />)
    expect(screen.getByText('Claimed Items')).toBeInTheDocument()
  })

  it('renders error state', async () => {
    mockFetchAllItems.mockRejectedValue(new Error('API failure'))
    render(<ClaimedItems />)
    await waitFor(() => { expect(screen.getByText(/api failure/i)).toBeInTheDocument() })
  })

  it('renders empty state when no items exist', async () => {
    mockFetchAllItems.mockResolvedValue([])
    render(<ClaimedItems />)
    await waitFor(() => { expect(screen.getByText(/no items tracked/i)).toBeInTheDocument() })
  })

  it('renders empty state when no items match status', async () => {
    mockFetchAllItems.mockResolvedValue([
      createItem({ id: 1, item_name: 'Lost Item', status: 'lost' }),
      createItem({ id: 2, item_name: 'Found Item', status: 'found' }),
    ])
    render(<ClaimedItems />)
    await waitFor(() => { expect(screen.getByText(/no claimed items/i)).toBeInTheDocument() })
  })

  it('renders only claimed items', async () => {
    mockFetchAllItems.mockResolvedValue([
      createItem({ id: 1, item_name: 'Claimed Laptop', status: 'claimed' }),
      createItem({ id: 2, item_name: 'Lost Phone', status: 'lost' }),
    ])
    render(<ClaimedItems />)
    await waitFor(() => {
      expect(screen.getByText('Claimed Laptop')).toBeInTheDocument()
      expect(screen.queryByText('Lost Phone')).not.toBeInTheDocument()
    })
  })

  it('filters by search query', async () => {
    mockFetchAllItems.mockResolvedValue([
      createItem({ id: 1, item_name: 'Laptop', status: 'claimed' }),
      createItem({ id: 2, item_name: 'Phone', status: 'claimed' }),
    ])
    render(<ClaimedItems />)
    await waitFor(() => { expect(screen.getByText('Laptop')).toBeInTheDocument() })

    const searchInput = screen.getByPlaceholderText(/search/i)
    await userEvent.type(searchInput, 'Phone')
    expect(screen.queryByText('Laptop')).not.toBeInTheDocument()
    expect(screen.getByText('Phone')).toBeInTheDocument()
  })

  it('shows claimant and surrenderer info in detail modal', async () => {
    mockFetchAllItems.mockResolvedValue([
      createItem({ id: 7, item_name: 'Claimed Item', status: 'claimed' }),
    ])
    render(<ClaimedItems />)
    await waitFor(() => { expect(screen.getByText('Claimed Item')).toBeInTheDocument() })

    await userEvent.click(screen.getByText(/view/i))
    await waitFor(() => { expect(screen.getByText(/claimed item #7 detail/i)).toBeInTheDocument() })

    // Verify both surrenderer and claimant sections appear
    expect(screen.getAllByText('John Finder').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Jane Claimant').length).toBeGreaterThanOrEqual(1)
  })

  it('opens and closes detail modal', async () => {
    mockFetchAllItems.mockResolvedValue([
      createItem({ id: 1, item_name: 'Done', status: 'claimed' }),
    ])
    render(<ClaimedItems />)
    await waitFor(() => { expect(screen.getByText('Done')).toBeInTheDocument() })

    await userEvent.click(screen.getByText(/view/i))
    await waitFor(() => { expect(screen.getByText(/claimed item #1 detail/i)).toBeInTheDocument() })

    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    await waitFor(() => { expect(screen.queryByText(/claimed item #1 detail/i)).not.toBeInTheDocument() })
  })
})
