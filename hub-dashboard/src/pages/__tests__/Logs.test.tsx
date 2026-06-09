import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Logs from '../Logs'
import type { WsEvent, WsState } from '../../hooks/useAdminWs'

const mockUseAdminWs = vi.fn()
vi.mock('../../hooks/useAdminWs', () => ({
  useAdminWs: (...args: unknown[]) => mockUseAdminWs(...args),
}))

// We need to export the types for the mock
export type { WsEvent, WsState }

describe('Logs Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAdminWs.mockReturnValue({ state: 'disconnected' as WsState })
  })

  it('renders page title', () => {
    render(<Logs />)
    expect(screen.getByText('Event Logs')).toBeInTheDocument()
  })

  it('shows waiting message when no events', () => {
    render(<Logs />)
    expect(screen.getByText(/waiting for events/i)).toBeInTheDocument()
  })

  it('shows connection status indicator', () => {
    mockUseAdminWs.mockReturnValue({ state: 'connected' as WsState })
    render(<Logs />)
    expect(screen.getByText('connected')).toBeInTheDocument()
  })

  it('shows disconnected state', () => {
    mockUseAdminWs.mockReturnValue({ state: 'disconnected' as WsState })
    render(<Logs />)
    expect(screen.getByText('disconnected')).toBeInTheDocument()
  })

  it('shows connecting state', () => {
    mockUseAdminWs.mockReturnValue({ state: 'connecting' as WsState })
    render(<Logs />)
    expect(screen.getByText('connecting')).toBeInTheDocument()
  })

  it('has Pause, Clear buttons when not paused', () => {
    mockUseAdminWs.mockReturnValue({ state: 'connected' as WsState })
    render(<Logs />)
    expect(screen.getByText(/pause/i)).toBeInTheDocument()
    expect(screen.getByText(/clear/i)).toBeInTheDocument()
  })

  it('toggles to Resume button when paused', async () => {
    mockUseAdminWs.mockReturnValue({ state: 'connected' as WsState })
    render(<Logs />)

    await userEvent.click(screen.getByText(/pause/i))

    expect(screen.getByText(/resume/i)).toBeInTheDocument()
    expect(screen.queryByText(/pause/i)).not.toBeInTheDocument()
  })

  it('clears events when Clear is clicked', async () => {
    mockUseAdminWs.mockReturnValue({ state: 'connected' as WsState })
    render(<Logs />)

    // Pause to avoid auto-scroll issues
    await userEvent.click(screen.getByText(/pause/i))

    // Now clear
    await userEvent.click(screen.getByText(/clear/i))

    // Should show waiting message again
    expect(screen.getByText(/waiting for events/i)).toBeInTheDocument()
  })

  it('returns to Pause after Resume', async () => {
    mockUseAdminWs.mockReturnValue({ state: 'connected' as WsState })
    render(<Logs />)

    await userEvent.click(screen.getByText(/pause/i))
    expect(screen.getByText(/resume/i)).toBeInTheDocument()

    await userEvent.click(screen.getByText(/resume/i))
    expect(screen.getByText(/pause/i)).toBeInTheDocument()
  })
})
