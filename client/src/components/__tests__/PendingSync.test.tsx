import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PendingSync from '../PendingSync';
import type { PendingSyncResponse } from '../../types';

const mockItems: PendingSyncResponse = {
  count: 2,
  items: [
    {
      id: 'item-1',
      item_name: 'Laptop',
      status: 'lost',
      department_origin: 'Test Dept',
      synced: 0,
      created_at: '2026-06-08T10:00:00Z',
    },
    {
      id: 'item-2',
      item_name: 'Wallet',
      status: 'found',
      department_origin: 'Test Dept',
      synced: 0,
      created_at: '2026-06-08T11:00:00Z',
    },
  ],
};

describe('PendingSync', () => {
  it('shows loading skeleton state with pulsing bars', () => {
    const { container } = render(
      <PendingSync
        pendingData={null}
        loading={true}
        error={null}
      />
    );

    // Header text should appear immediately
    expect(screen.getByText(/Pending Sync/)).toBeInTheDocument();

    // Should render skeleton rows with animate-pulse
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no pending items', () => {
    render(
      <PendingSync
        pendingData={{ count: 0, items: [] }}
        loading={false}
        error={null}
      />
    );

    // The paragraph contains both the emoji and the text
    expect(screen.getByText(/✅ All synced/)).toBeInTheDocument();
    expect(screen.getByText(/no pending items/)).toBeInTheDocument();
  });

  it('shows error state with retry button', () => {
    render(
      <PendingSync
        pendingData={null}
        loading={false}
        error="Failed to fetch"
      />
    );

    expect(screen.getByText(/Failed to load pending items/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders table with pending items', () => {
    render(
      <PendingSync
        pendingData={mockItems}
        loading={false}
        error={null}
      />
    );

    // Header includes the count in a separate span; match via accessible name
    const heading = screen.getByRole('heading', { name: /Pending Sync/ });
    expect(heading).toBeInTheDocument();
    // Count badge is rendered as a child of the heading
    expect(heading.querySelector('span')).toHaveTextContent('2');

    // Table headers
    expect(screen.getByText(/Item Name/)).toBeInTheDocument();
    expect(screen.getByText(/Status/)).toBeInTheDocument();
    expect(screen.getByText(/Created At/)).toBeInTheDocument();

    // Item data rows
    expect(screen.getByText('Laptop')).toBeInTheDocument();
    expect(screen.getByText('Wallet')).toBeInTheDocument();

    // Status badges
    expect(screen.getByText('lost')).toBeInTheDocument();
    expect(screen.getByText('found')).toBeInTheDocument();
  });
});

