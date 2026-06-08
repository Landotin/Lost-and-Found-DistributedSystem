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

  it('hides surrenderer section when status toggled to "Lost"', async () => {
    render(<LogItemForm />);

    await userEvent.click(screen.getByRole('radio', { name: /found/i }));
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /lost/i }));
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
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

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockItem),
    }));

    const onItemCreated = vi.fn();
    render(<LogItemForm onItemCreated={onItemCreated} />);

    await userEvent.type(screen.getByLabelText(/item name/i), 'Laptop');
    await userEvent.selectOptions(screen.getByLabelText(/category/i), 'Electronics');
    await userEvent.click(screen.getByRole('button', { name: /log item/i }));

    await waitFor(() => {
      expect(onItemCreated).toHaveBeenCalledWith(mockItem);
    });
  });

  it('handles API error gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    render(<LogItemForm />);

    await userEvent.type(screen.getByLabelText(/item name/i), 'Laptop');
    await userEvent.selectOptions(screen.getByLabelText(/category/i), 'Electronics');
    await userEvent.click(screen.getByRole('button', { name: /log item/i }));

    await waitFor(() => {
      expect(screen.getByText(/saved offline/i)).toBeInTheDocument();
    });
  });
});
