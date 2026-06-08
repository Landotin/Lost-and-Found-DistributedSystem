import { render, screen, cleanup } from '@testing-library/react';
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

  it('renders tab navigation with both tabs', () => {
    render(<App />);
    expect(screen.getByRole('tab', { name: /log item/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /pending sync/i })).toBeInTheDocument();
  });

  it('defaults to Log Item tab (aria-selected="true")', () => {
    render(<App />);
    const logItemTab = screen.getByRole('tab', { name: /log item/i });
    expect(logItemTab).toHaveAttribute('aria-selected', 'true');
  });
});
