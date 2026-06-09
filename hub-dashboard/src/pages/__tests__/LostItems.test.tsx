import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LostItems from '../LostItems'

const mockFetchAllItems = vi.fn()
vi.mock('../../hooks/useAdminApi', () => ({
  fetchAllItems: (...args: unknown[]) => mockFetchAllItems(...args),
}))

function createItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    item_name: 'Laptop',
    description: 'Dell XPS 15',
    status: 'lost',
    department_origin: 'Security',
    lost_location: null,
    found_location: null,
    surrendered_by: null,
    claimed_by: null,
    created_at: '2026-06-09T10:00:00.000Z',
    updated_at: '2026-06-09T10:00:00.000Z',
    surrenderer_full_name: null,
    surrenderer_mobile: null,
    surrenderer_id_type: null,
    surrenderer_id_number: null,
    claimant_full_name: null,
    claimant_mobile: null,
    claimant_id_type: null,
    claimant_id_number: null,
    ...overrides,
  }
}

describe('Lost Items Page', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders page title', () => {
    mockFetchAllItems.mockReturnValue(new Promise(() => {}))
    render(<LostItems />)
    expect(screen.getByText('Lost Items')).toBeInTheDocument()
  })

  it('renders error state', async () => {
    mockFetchAllItems.mockRejectedValue(new Error('API failure'))
    render(<LostItems />)
    await waitFor(() => { expect(screen.getByText(/api failure/i)).toBeInTheDocument() })
  })

  it('renders empty state when no items exist', async () => {
    mockFetchAllItems.mockResolvedValue([])
    render(<LostItems />)
    await waitFor(() => { expect(screen.getByText(/no items tracked/i)).toBeInTheDocument() })
  })

  it('renders empty state when no items match status', async () => {
    mockFetchAllItems.mockResolvedValue([
      createItem({ id: 1, item_name: 'Found Item', status: 'found' }),
      createItem({ id: 2, item_name: 'Claimed Item', status: 'claimed' }),
    ])
    render(<LostItems />)
    await waitFor(() => { expect(screen.getByText(/no lost items reported/i)).toBeInTheDocument() })
  })

  it('renders only lost items', async () => {
    mockFetchAllItems.mockResolvedValue([
      createItem({ id: 1, item_name: 'Lost Phone', status: 'lost' }),
      createItem({ id: 2, item_name: 'Found Wallet', status: 'found' }),
    ])
    render(<LostItems />)
    await waitFor(() => {
      expect(screen.getByText('Lost Phone')).toBeInTheDocument()
      expect(screen.queryByText('Found Wallet')).not.toBeInTheDocument()
    })
  })

  it('filters by search query', async () => {
    mockFetchAllItems.mockResolvedValue([
      createItem({ id: 1, item_name: 'Phone', status: 'lost' }),
      createItem({ id: 2, item_name: 'Wallet', status: 'lost' }),
    ])
    render(<LostItems />)
    await waitFor(() => { expect(screen.getByText('Phone')).toBeInTheDocument() })

    const searchInput = screen.getByPlaceholderText(/search/i)
    await userEvent.type(searchInput, 'Wallet')
    expect(screen.queryByText('Phone')).not.toBeInTheDocument()
    expect(screen.getByText('Wallet')).toBeInTheDocument()
  })

  it('opens and closes detail modal', async () => {
    mockFetchAllItems.mockResolvedValue([
      createItem({ id: 5, item_name: 'Missing Laptop', status: 'lost' }),
    ])
    render(<LostItems />)
    await waitFor(() => { expect(screen.getByText('Missing Laptop')).toBeInTheDocument() })

    await userEvent.click(screen.getByText(/view/i))
    await waitFor(() => { expect(screen.getByText(/lost item #5 detail/i)).toBeInTheDocument() })

    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    await waitFor(() => { expect(screen.queryByText(/lost item #5 detail/i)).not.toBeInTheDocument() })
  })
})
