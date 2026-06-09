import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LogItemForm from '../LogItemForm';
import type { Item } from '../../types';

describe('LogItemForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all form fields (item name, category, status toggle, description)', () => {
    render(<LogItemForm />);

    expect(screen.getByLabelText(/item name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /lost/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /found/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it('shows surrenderer section when status toggled to "Found"', async () => {
    render(<LogItemForm />);

    await userEvent.click(screen.getByRole('radio', { name: /found/i }));

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mobile/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/id type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/id number/i)).toBeInTheDocument();
  });

  it('shows correct contact section heading based on status', async () => {
    render(<LogItemForm />);

    // Default is lost, should show "Your Contact Information"
    expect(screen.getByText(/your contact information/i)).toBeInTheDocument();
    expect(screen.queryByText(/surrenderer details/i)).not.toBeInTheDocument();

    // Toggle to found, should show "Surrenderer Details"
    await userEvent.click(screen.getByRole('radio', { name: /found/i }));
    expect(screen.getByText(/surrenderer details/i)).toBeInTheDocument();
    expect(screen.queryByText(/your contact information/i)).not.toBeInTheDocument();

    // Toggle back to lost, should show contact info again
    await userEvent.click(screen.getByRole('radio', { name: /lost/i }));
    expect(screen.getByText(/your contact information/i)).toBeInTheDocument();
    expect(screen.queryByText(/surrenderer details/i)).not.toBeInTheDocument();
  });

  it('shows validation errors on empty submit', async () => {
    render(<LogItemForm />);

    await userEvent.click(screen.getByRole('button', { name: /log item/i }));

    expect(screen.getByText(/item name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/category is required/i)).toBeInTheDocument();
  });

  it('submits successfully and creates person + item', async () => {
    const mockItem: Item = {
      id: 'item-1',
      item_name: 'Laptop',
      status: 'lost',
      category: 'Electronics',
      department_origin: '',
      synced: 0,
    };

    // Mock handles multiple fetch calls: person creation, item creation, and smart matching
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/api/persons')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'person-1', full_name: 'John', mobile: '+639171111111' }) });
      }
      if (url.includes('/api/items/matches')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ matches: [] }) });
      }
      if (url.includes('/api/items')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockItem) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const onItemCreated = vi.fn();
    render(<LogItemForm onItemCreated={onItemCreated} />);

    await userEvent.type(screen.getByLabelText(/item name/i), 'Laptop');
    await userEvent.selectOptions(screen.getByLabelText(/category/i), 'Electronics');

    // Fill in contact info (required for lost items)
    const nameInputs = screen.getAllByLabelText(/full name/i);
    await userEvent.type(nameInputs[0], 'John');
    await userEvent.type(screen.getByLabelText(/mobile/i), '+639171111111');

    await userEvent.click(screen.getByRole('button', { name: /log item/i }));

    await waitFor(() => {
      expect(onItemCreated).toHaveBeenCalledWith(mockItem);
    });
  });

  it('handles API error gracefully', async () => {
    // Mock handles multiple fetch calls
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/api/persons')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'person-1', full_name: 'John', mobile: '+639171111111' }) });
      }
      if (url.includes('/api/items/matches')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ matches: [] }) });
      }
      // Item creation fails
      return Promise.reject(new Error('Network error'));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<LogItemForm />);

    await userEvent.type(screen.getByLabelText(/item name/i), 'Laptop');
    await userEvent.selectOptions(screen.getByLabelText(/category/i), 'Electronics');

    // Fill in contact info (required for lost items)
    const nameInputs = screen.getAllByLabelText(/full name/i);
    await userEvent.type(nameInputs[0], 'John');
    await userEvent.type(screen.getByLabelText(/mobile/i), '+639171111111');

    await userEvent.click(screen.getByRole('button', { name: /log item/i }));

    await waitFor(() => {
      expect(screen.getByText(/saved offline/i)).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Smart Matching — suggestion banner
  // -----------------------------------------------------------------------

  it('shows lost-item suggestion when logging found with matching name', async () => {
    const matchResponse = {
      matches: [
        {
          id: 'match-lost-1',
          item_name: 'Water Bottle',
          status: 'lost',
          department_origin: 'CCS',
          synced: 1,
        },
      ],
    };

    // Mock fetch: match endpoint returns matches, other endpoints return empty ok
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/api/items/matches')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(matchResponse),
        });
      }
      // Default: empty ok response for other calls
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<LogItemForm />);

    // Select "Found" status
    await userEvent.click(screen.getByRole('radio', { name: /found/i }));

    // Type a matching item name (>2 chars)
    await userEvent.type(screen.getByLabelText(/item name/i), 'Water');

    // Wait for the 300ms debounce to complete and banner to appear
    await waitFor(
      () => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // The heading inside the alert should contain "reported lost"
    expect(screen.getByText(/this item was reported lost/i)).toBeInTheDocument();
    expect(screen.getByText(/Water Bottle/i)).toBeInTheDocument();
    expect(screen.getByText(/CCS/i)).toBeInTheDocument();
    // Mark as Found button should be present
    expect(screen.getByRole('button', { name: /mark as found/i })).toBeInTheDocument();
  });

  it('dismisses suggestion when dismiss is clicked', async () => {
    const matchResponse = {
      matches: [
        {
          id: 'match-lost-2',
          item_name: 'Phone',
          status: 'lost',
          department_origin: 'COE',
          synced: 1,
        },
      ],
    };

    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/api/items/matches')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(matchResponse),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<LogItemForm />);

    await userEvent.click(screen.getByRole('radio', { name: /found/i }));
    await userEvent.type(screen.getByLabelText(/item name/i), 'Phone');

    // Wait for banner to appear
    await waitFor(
      () => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // Click dismiss
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    // Banner should be gone
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows found-item suggestion when logging lost with matching name', async () => {
    const matchResponse = {
      matches: [
        {
          id: 'match-found-1',
          item_name: 'Laptop Bag',
          status: 'found',
          department_origin: 'Engineering',
          synced: 1,
          surrenderedByPerson: { id: 'p1', full_name: 'Finder', mobile: '+639171234567' },
        },
      ],
    };

    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/api/items/matches')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(matchResponse),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<LogItemForm />);

    // Status defaults to 'lost', type a matching name
    await userEvent.type(screen.getByLabelText(/item name/i), 'Laptop');

    await waitFor(
      () => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    expect(screen.getByText(/this item was already found/i)).toBeInTheDocument();

    expect(screen.getByText(/Laptop Bag/i)).toBeInTheDocument();
    expect(screen.getByText(/Engineering/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /claim instead/i })).toBeInTheDocument();
  });

  it('Mark as Found button calls onNavigate with lost-items tab', async () => {
    const matchResponse = {
      matches: [
        {
          id: 'match-lost-3',
          item_name: 'Wallet',
          status: 'lost',
          department_origin: 'CCS',
          synced: 1,
        },
      ],
    };

    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/api/items/matches')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(matchResponse),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const onNavigate = vi.fn();
    render(<LogItemForm onNavigate={onNavigate} />);

    await userEvent.click(screen.getByRole('radio', { name: /found/i }));
    await userEvent.type(screen.getByLabelText(/item name/i), 'Wallet');

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /mark as found/i })).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    await userEvent.click(screen.getByRole('button', { name: /mark as found/i }));

    expect(onNavigate).toHaveBeenCalledWith('lost-items', 'match-lost-3');
  });

  it('Claim Instead button calls onNavigate with claim tab', async () => {
    const matchResponse = {
      matches: [
        {
          id: 'match-found-2',
          item_name: 'Backpack',
          status: 'found',
          department_origin: 'COE',
          synced: 1,
        },
      ],
    };

    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/api/items/matches')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(matchResponse),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const onNavigate = vi.fn();
    render(<LogItemForm onNavigate={onNavigate} />);

    await userEvent.type(screen.getByLabelText(/item name/i), 'Backpack');

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /claim instead/i })).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    await userEvent.click(screen.getByRole('button', { name: /claim instead/i }));

    expect(onNavigate).toHaveBeenCalledWith('claim', 'match-found-2');
  });
});
