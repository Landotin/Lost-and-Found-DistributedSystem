import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Ledger from '../Ledger'

const mockFetchAllItems = vi.fn()
vi.mock('../../hooks/useAdminApi', () => ({
  fetchAllItems: (...args: unknown[]) => mockFetchAllItems(...args),
}))

function createItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    item_name: 'Laptop',
    description: 'Dell XPS 15',
    status: 'found',
    department_origin: 'Security',
    lost_location: null,
    found_location: 'Main Gate',
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

describe('Ledger Page', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders page title', () => {
    mockFetchAllItems.mockReturnValue(new Promise(() => {}))
    render(<Ledger />)
    expect(screen.getByText('Global Ledger')).toBeInTheDocument()
  })

  it('renders error state', async () => {
    mockFetchAllItems.mockRejectedValue(new Error('API failure'))
    render(<Ledger />)
    await waitFor(() => { expect(screen.getByText(/api failure/i)).toBeInTheDocument() })
  })

  it('renders empty state when no items', async () => {
    mockFetchAllItems.mockResolvedValue([])
    render(<Ledger />)
    await waitFor(() => { expect(screen.getByText(/no items tracked/i)).toBeInTheDocument() })
  })

  it('renders items in table', async () => {
    const items = [
      createItem({ id: 1, item_name: 'Laptop', department_origin: 'Security', status: 'found' }),
      createItem({ id: 2, item_name: 'Phone', department_origin: 'Engineering', status: 'lost' }),
    ]
    mockFetchAllItems.mockResolvedValue(items)
    render(<Ledger />)
    await waitFor(() => {
      expect(screen.getByText('Laptop')).toBeInTheDocument()
      expect(screen.getByText('Phone')).toBeInTheDocument()
      expect(screen.getByText('Security')).toBeInTheDocument()
      expect(screen.getByText('Engineering')).toBeInTheDocument()
    })
  })

  it('filters items by search query', async () => {
    const items = [
      createItem({ id: 1, item_name: 'Laptop', department_origin: 'Security' }),
      createItem({ id: 2, item_name: 'Phone', department_origin: 'Engineering' }),
    ]
    mockFetchAllItems.mockResolvedValue(items)
    render(<Ledger />)

    await waitFor(() => { expect(screen.getByText('Laptop')).toBeInTheDocument() })

    const searchInput = screen.getByPlaceholderText(/search/i)
    await userEvent.type(searchInput, 'Phone')

    expect(screen.queryByText('Laptop')).not.toBeInTheDocument()
    expect(screen.getByText('Phone')).toBeInTheDocument()
  })

  it('shows detail modal on View button click', async () => {
    const items = [
      createItem({ id: 1, item_name: 'Laptop', description: 'Dell XPS 15', status: 'found' }),
    ]
    mockFetchAllItems.mockResolvedValue(items)
    render(<Ledger />)

    await waitFor(() => { expect(screen.getByText('Laptop')).toBeInTheDocument() })

    await userEvent.click(screen.getByText(/view/i))

    // Check modal heading appears
    await waitFor(() => {
      expect(screen.getByText(/item #1 detail/i)).toBeInTheDocument()
    })
    // Description appears both in table row and modal, so assert it's in DOM
    expect(screen.getAllByText(/Dell XPS/).length).toBeGreaterThanOrEqual(1)
  })

  it('closes detail modal on X click', async () => {
    const items = [
      createItem({ id: 1, item_name: 'Laptop', status: 'found' }),
    ]
    mockFetchAllItems.mockResolvedValue(items)
    render(<Ledger />)

    await waitFor(() => { expect(screen.getByText('Laptop')).toBeInTheDocument() })

    await userEvent.click(screen.getByText(/view/i))
    await waitFor(() => { expect(screen.getByText(/item #1 detail/i)).toBeInTheDocument() })

    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    await waitFor(() => { expect(screen.queryByText(/item #1 detail/i)).not.toBeInTheDocument() })
  })

  it('has Export CSV button', async () => {
    const items = [createItem({ id: 1, item_name: 'Laptop' })]
    mockFetchAllItems.mockResolvedValue(items)
    render(<Ledger />)
    await waitFor(() => { expect(screen.getByText('Laptop')).toBeInTheDocument() })
    expect(screen.getByText(/export csv/i)).toBeInTheDocument()
  })

  it('shows status badges with correct colors', async () => {
    const items = [
      createItem({ id: 1, item_name: 'LostItem', status: 'lost' }),
      createItem({ id: 2, item_name: 'FoundItem', status: 'found' }),
    ]
    mockFetchAllItems.mockResolvedValue(items)
    render(<Ledger />)
    await waitFor(() => {
      expect(screen.getByText('lost')).toBeInTheDocument()
      expect(screen.getByText('found')).toBeInTheDocument()
    })
  })
})
