import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Monitor from '../Monitor'

const mockFetchHubHealth = vi.fn()
const mockFetchNodes = vi.fn()
const mockForceSync = vi.fn()
const mockDisconnectNode = vi.fn()

vi.mock('../../hooks/useAdminApi', () => ({
  fetchHubHealth: (...args: unknown[]) => mockFetchHubHealth(...args),
  fetchNodes: (...args: unknown[]) => mockFetchNodes(...args),
  forceSync: (...args: unknown[]) => mockForceSync(...args),
  disconnectNode: (...args: unknown[]) => mockDisconnectNode(...args),
}))

function createMockHealth(overrides: Record<string, unknown> = {}) {
  return { uptime: 86400, nodeCount: 2, ...overrides }
}

function createMockNode(overrides: Record<string, unknown> = {}) {
  return {
    socketId: 'abc123def456',
    deptName: 'Security',
    connectedAt: '2026-06-09T10:00:00.000Z',
    ...overrides,
  }
}

describe('Monitor Page', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders page title', () => {
    mockFetchHubHealth.mockReturnValue(new Promise(() => {}))
    mockFetchNodes.mockReturnValue(new Promise(() => {}))
    render(<Monitor />)
    expect(screen.getByText('Monitor')).toBeInTheDocument()
  })

  it('renders error state when API fails', async () => {
    mockFetchHubHealth.mockRejectedValue(new Error('Network error'))
    mockFetchNodes.mockRejectedValue(new Error('Network error'))
    render(<Monitor />)
    await waitFor(() => { expect(screen.getByText(/network error/i)).toBeInTheDocument() })
  })

  it('renders empty state when no nodes', async () => {
    mockFetchHubHealth.mockResolvedValue(createMockHealth({ nodeCount: 0 }))
    mockFetchNodes.mockResolvedValue([])
    render(<Monitor />)
    await waitFor(() => { expect(screen.getByText(/no nodes connected/i)).toBeInTheDocument() })
  })

  it('renders connected nodes', async () => {
    const nodes = [
      createMockNode({ socketId: 's1', deptName: 'Security' }),
      createMockNode({ socketId: 's2', deptName: 'Engineering' }),
    ]
    mockFetchHubHealth.mockResolvedValue(createMockHealth({ nodeCount: 2 }))
    mockFetchNodes.mockResolvedValue(nodes)
    render(<Monitor />)
    await waitFor(() => {
      expect(screen.getByText('Security')).toBeInTheDocument()
      expect(screen.getByText('Engineering')).toBeInTheDocument()
    })
  })

  it('shows retry and recovers', async () => {
    mockFetchHubHealth.mockRejectedValue(new Error('Server down'))
    mockFetchNodes.mockRejectedValue(new Error('Server down'))
    render(<Monitor />)
    await waitFor(() => { expect(screen.getByText(/retry/i)).toBeInTheDocument() })

    mockFetchHubHealth.mockResolvedValue(createMockHealth())
    mockFetchNodes.mockResolvedValue([])
    await userEvent.click(screen.getByText(/retry/i))
    await waitFor(() => { expect(screen.queryByText(/server down/i)).not.toBeInTheDocument() })
  })

  it('has action buttons for nodes', async () => {
    mockFetchHubHealth.mockResolvedValue(createMockHealth())
    mockFetchNodes.mockResolvedValue([createMockNode()])
    mockForceSync.mockResolvedValue({ success: true })
    mockDisconnectNode.mockResolvedValue({ success: true })
    render(<Monitor />)
    await waitFor(() => { expect(screen.getByText('Security')).toBeInTheDocument() })
    expect(screen.getByTitle(/force.*sync/i)).toBeInTheDocument()
    expect(screen.getByTitle(/disconnect/i)).toBeInTheDocument()
  })
})
