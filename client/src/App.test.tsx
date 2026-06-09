import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';

// Mock global fetch with URL-aware responses for polling hooks
function mockFetch(url: string) {
  if (url === '/api/status') {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        deptName: 'Test Dept',
        connected: true,
        status: 'connected',
        nodeCount: 2,
        nodes: [
          { dept_name: 'CCS', socket_id: 's1', connected_at: new Date().toISOString() },
          { dept_name: 'COE', socket_id: 's2', connected_at: new Date().toISOString() },
        ],
      }),
    });
  }
  if (url === '/api/pending') {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ count: 0, items: [] }),
    });
  }
  if (url === '/api/items') {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    });
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  });
}

describe('App Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn().mockImplementation(mockFetch);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders app title', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /Lost & Found Tracker/i })).toBeInTheDocument();
  });

  it('renders tab navigation with seven tabs', () => {
    render(<App />);
    expect(screen.getByRole('tab', { name: /global ledger/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /lost items/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /found items/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /claimed items/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /log item/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /process claim/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /pending sync/i })).toBeInTheDocument();
  });

  it('defaults to Global Ledger tab (aria-selected="true")', () => {
    render(<App />);
    const ledgerTab = screen.getByRole('tab', { name: /global ledger/i });
    expect(ledgerTab).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to Lost Items tab when clicked', async () => {
    render(<App />);

    const lostTab = screen.getByRole('tab', { name: /lost items/i });
    await userEvent.click(lostTab);

    await waitFor(() => {
      expect(screen.getByText(/No items found/i)).toBeInTheDocument();
    });
  });

  it('switches to Found Items tab when clicked', async () => {
    render(<App />);

    const foundTab = screen.getByRole('tab', { name: /found items/i });
    await userEvent.click(foundTab);

    await waitFor(() => {
      expect(screen.getByText(/No items found/i)).toBeInTheDocument();
    });
  });

  it('switches to Claimed Items tab when clicked', async () => {
    render(<App />);

    const claimedTab = screen.getByRole('tab', { name: /claimed items/i });
    await userEvent.click(claimedTab);

    // Since items mock returns empty array, ClaimedItems shows "no items" state
    await waitFor(() => {
      expect(screen.getByText(/No items found/i)).toBeInTheDocument();
    });
  });

  it('switches to Process Claim tab when clicked', async () => {
    render(<App />);

    const claimTab = screen.getByRole('tab', { name: /process claim/i });
    await userEvent.click(claimTab);

    // Since items mock returns empty array, ProcessClaim shows empty state
    await waitFor(() => {
      expect(screen.getByText(/no found items available/i)).toBeInTheDocument();
    });
  });
});
