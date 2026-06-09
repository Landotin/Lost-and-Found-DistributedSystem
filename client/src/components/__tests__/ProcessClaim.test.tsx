import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProcessClaim from '../ProcessClaim';
import type { Item } from '../../types';

const mockFoundItems: Item[] = [
  {
    id: 'item-1',
    item_name: 'Wallet',
    category: 'Accessories',
    department_origin: 'CCS',
    status: 'found',
    synced: 1,
    created_at: '2026-06-01T10:00:00Z',
    surrendered_by: 'person-1',
    surrenderedByPerson: {
      id: 'person-1',
      full_name: 'Juan Dela Cruz',
      mobile: '+639123456789',
    },
  },
  {
    id: 'item-2',
    item_name: 'Phone',
    category: 'Electronics',
    department_origin: 'COE',
    status: 'found',
    synced: 1,
    created_at: '2026-06-02T11:00:00Z',
    surrendered_by: 'person-2',
    surrenderedByPerson: {
      id: 'person-2',
      full_name: 'Maria Santos',
      mobile: '+639987654321',
    },
  },
  {
    id: 'item-3',
    item_name: 'Laptop',
    category: 'Electronics',
    department_origin: 'CCS',
    status: 'lost', // Should not appear in dropdown
    synced: 1,
    created_at: '2026-06-03T12:00:00Z',
  },
  {
    id: 'item-4',
    item_name: 'Tablet',
    category: 'Electronics',
    department_origin: 'CCS',
    status: 'claimed', // Should not appear in dropdown
    synced: 1,
    created_at: '2026-06-04T12:00:00Z',
  },
];

describe('ProcessClaim', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('item selection phase', () => {
    it('renders search input for finding items', () => {
      render(<ProcessClaim items={mockFoundItems} />);

      expect(screen.getByPlaceholderText(/search items/i)).toBeInTheDocument();
    });

    it('shows only found items in the dropdown', () => {
      render(<ProcessClaim items={mockFoundItems} />);

      expect(screen.getByText('Wallet')).toBeInTheDocument();
      expect(screen.getByText('Phone')).toBeInTheDocument();
      expect(screen.queryByText('Laptop')).not.toBeInTheDocument();
      expect(screen.queryByText('Tablet')).not.toBeInTheDocument();
    });

    it('filters items by name as user types', async () => {
      render(<ProcessClaim items={mockFoundItems} />);

      const searchInput = screen.getByPlaceholderText(/search items/i);
      await userEvent.type(searchInput, 'wallet');

      expect(screen.getByText('Wallet')).toBeInTheDocument();
      expect(screen.queryByText('Phone')).not.toBeInTheDocument();
    });

    it('shows no items found message when search matches nothing', async () => {
      render(<ProcessClaim items={mockFoundItems} />);

      const searchInput = screen.getByPlaceholderText(/search items/i);
      await userEvent.type(searchInput, 'zzzzz');

      expect(screen.getByText(/no found items match/i)).toBeInTheDocument();
    });

    it('shows empty state when items list is empty', () => {
      render(<ProcessClaim items={[]} />);

      expect(screen.getByText(/no found items available/i)).toBeInTheDocument();
    });

    it('shows empty state when items is null', () => {
      render(<ProcessClaim items={null} />);

      expect(screen.getByText(/loading items/i)).toBeInTheDocument();
    });
  });

  describe('claimant form phase', () => {
    it('shows claimant form after selecting an item', async () => {
      render(<ProcessClaim items={mockFoundItems} />);

      await userEvent.click(screen.getByText('Wallet'));

      expect(screen.getByText(/claimant information/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/mobile number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/id type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/id number/i)).toBeInTheDocument();
    });

    it('displays selected item name in the form header', async () => {
      render(<ProcessClaim items={mockFoundItems} />);

      await userEvent.click(screen.getByText('Wallet'));

      expect(screen.getByText(/claiming: wallet/i)).toBeInTheDocument();
    });

    it('shows back button to return to item selection', async () => {
      render(<ProcessClaim items={mockFoundItems} />);

      await userEvent.click(screen.getByText('Wallet'));
      const backButton = screen.getByRole('button', { name: /back/i });
      expect(backButton).toBeInTheDocument();

      await userEvent.click(backButton);
      expect(screen.getByPlaceholderText(/search items/i)).toBeInTheDocument();
    });
  });

  describe('preselected item', () => {
    it('auto-selects item when preselectedItemId is provided', () => {
      render(<ProcessClaim items={mockFoundItems} preselectedItemId="item-1" />);

      expect(screen.getByText(/claiming: wallet/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });

    it('shows error when preselectedItemId is not found', () => {
      render(<ProcessClaim items={mockFoundItems} preselectedItemId="nonexistent" />);

      expect(screen.getByText(/item not found/i)).toBeInTheDocument();
    });
  });

  describe('submission', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('shows validation errors when required fields are empty', async () => {
      render(<ProcessClaim items={mockFoundItems} />);

      await userEvent.click(screen.getByText('Wallet'));
      await userEvent.click(screen.getByRole('button', { name: /submit claim/i }));

      expect(screen.getByText(/full name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/mobile number is required/i)).toBeInTheDocument();
    });

    it('successfully creates person and claims item', async () => {
      // Mock createPerson response
      const mockPerson = { id: 'claimant-1', full_name: 'Alice Smith', mobile: '+639171234567' };
      // Mock updateItemStatus response
      const mockItem = { ...mockFoundItems[0], status: 'claimed', claimed_by: 'claimant-1' };

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockPerson) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockItem) });
      vi.stubGlobal('fetch', fetchMock);

      const onClaimProcessed = vi.fn();
      render(<ProcessClaim items={mockFoundItems} onClaimProcessed={onClaimProcessed} />);

      // Select item
      await userEvent.click(screen.getByText('Wallet'));

      // Fill in claimant form
      await userEvent.type(screen.getByLabelText(/full name/i), 'Alice Smith');
      await userEvent.type(screen.getByLabelText(/mobile number/i), '09171234567');

      // Submit
      await userEvent.click(screen.getByRole('button', { name: /submit claim/i }));

      await waitFor(() => {
        expect(screen.getByText(/claim successful/i)).toBeInTheDocument();
      });

      // Verify the API calls
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // First call: create person (09171234567 converts to +639171234567)
      const firstCallBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(firstCallBody.full_name).toBe('Alice Smith');
      expect(firstCallBody.mobile).toBe('+639171234567');

      // Second call: update item status
      const secondCallUrl = fetchMock.mock.calls[1][0];
      const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(secondCallUrl).toContain('/api/items/item-1/status');
      expect(secondCallBody.status).toBe('claimed');
      expect(secondCallBody.claimed_by).toBe('claimant-1');

      // Callback should be invoked
      expect(onClaimProcessed).toHaveBeenCalled();
    });

    it('converts 09 mobile to E.164 before submitting', async () => {
      const mockPerson = { id: 'claimant-2', full_name: 'Bob Jones', mobile: '+639171234567' };
      const mockItem = { ...mockFoundItems[0], status: 'claimed', claimed_by: 'claimant-2' };

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockPerson) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockItem) });
      vi.stubGlobal('fetch', fetchMock);

      render(<ProcessClaim items={mockFoundItems} />);

      await userEvent.click(screen.getByText('Wallet'));
      await userEvent.type(screen.getByLabelText(/full name/i), 'Bob Jones');
      await userEvent.type(screen.getByLabelText(/mobile number/i), '09171234567');
      await userEvent.click(screen.getByRole('button', { name: /submit claim/i }));

      await waitFor(() => {
        const firstCallBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(firstCallBody.mobile).toBe('+639171234567');
      });
    });

    it('handles API error during person creation', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      render(<ProcessClaim items={mockFoundItems} />);

      await userEvent.click(screen.getByText('Wallet'));
      await userEvent.type(screen.getByLabelText(/full name/i), 'Alice Smith');
      await userEvent.type(screen.getByLabelText(/mobile number/i), '09171234567');
      await userEvent.click(screen.getByRole('button', { name: /submit claim/i }));

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });
  });
});
