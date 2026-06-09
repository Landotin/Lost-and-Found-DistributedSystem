import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import GlobalLedger from '../GlobalLedger';
import type { Item } from '../../types';

const mockItems: Item[] = [
  {
    id: '1',
    item_name: 'Laptop',
    category: 'Electronics',
    department_origin: 'CCS',
    status: 'lost',
    synced: 1,
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
  },
  {
    id: '2',
    item_name: 'Wallet',
    category: 'Accessories',
    department_origin: 'COE',
    status: 'found',
    synced: 1,
    created_at: '2026-06-02T11:00:00Z',
    updated_at: '2026-06-02T11:00:00Z',
    surrendered_by: 'person-1',
    surrenderedByPerson: {
      id: 'person-1',
      full_name: 'Juan Dela Cruz',
      mobile: '+639123456789',
      id_type: 'student_id',
      id_number: '2020-0001',
    },
  },
  {
    id: '3',
    item_name: 'Phone',
    category: 'Electronics',
    department_origin: 'CCS',
    status: 'claimed',
    synced: 1,
    created_at: '2026-06-03T12:00:00Z',
    updated_at: '2026-06-03T14:00:00Z',
    surrendered_by: 'person-2',
    surrenderedByPerson: {
      id: 'person-2',
      full_name: 'Maria Santos',
      mobile: '+639987654321',
      id_type: 'employee_id',
      id_number: 'EMP-001',
    },
    claimed_by: 'person-3',
    claimedByPerson: {
      id: 'person-3',
      full_name: 'Pedro Reyes',
      mobile: '+639555666777',
    },
  },
];

describe('GlobalLedger', () => {
  afterEach(() => {
    cleanup();
  });

  describe('loading state', () => {
    it('shows loading indicator when loading is true', () => {
      render(
        <GlobalLedger
          items={null}
          loading={true}
          error={null}
          deptName="Test Dept"
        />
      );
      expect(screen.getByText(/Loading/)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when error is provided', () => {
      render(
        <GlobalLedger
          items={null}
          loading={false}
          error="Failed to fetch items"
          deptName="Test Dept"
        />
      );
      expect(screen.getByText(/Failed to fetch items/)).toBeInTheDocument();
    });
  });

  describe('items rendering', () => {
    it('renders all items in the table', () => {
      render(
        <GlobalLedger
          items={mockItems}
          loading={false}
          error={null}
          deptName="Test Dept"
        />
      );

      expect(screen.getByText('Laptop')).toBeInTheDocument();
      expect(screen.getByText('Wallet')).toBeInTheDocument();
      expect(screen.getByText('Phone')).toBeInTheDocument();
    });

    it('renders all items in card-style rows', () => {
      render(
        <GlobalLedger
          items={mockItems}
          loading={false}
          error={null}
          deptName="Test Dept"
        />
      );

      // Each item name should appear once (no table headers like before)
      expect(screen.getByText('Laptop')).toBeInTheDocument();
      expect(screen.getByText('Wallet')).toBeInTheDocument();
      expect(screen.getByText('Phone')).toBeInTheDocument();

      // Category text should appear per item
      expect(screen.getByText('Accessories')).toBeInTheDocument();
    });

    it('renders status badges with appropriate styling', () => {
      render(
        <GlobalLedger
          items={mockItems}
          loading={false}
          error={null}
          deptName="Test Dept"
        />
      );

      // Status badges should still render in card rows
      const lostBadge = screen.getByText('lost');
      expect(lostBadge).toBeInTheDocument();
      expect(lostBadge.tagName).toBe('SPAN');

      const claimedBadge = screen.getByText('claimed');
      expect(claimedBadge).toBeInTheDocument();
      expect(claimedBadge.tagName).toBe('SPAN');
    });

    it('shows summary text with total item count', () => {
      render(
        <GlobalLedger
          items={mockItems}
          loading={false}
          error={null}
          deptName="Test Dept"
        />
      );

      expect(screen.getByText(/Showing 3 of 3 items/i)).toBeInTheDocument();
    });

    it('shows department origin in each card', () => {
      render(
        <GlobalLedger
          items={mockItems}
          loading={false}
          error={null}
          deptName="Test Dept"
        />
      );

      // Department tags should be visible (appear in both filter dropdown and cards)
      const ccsElements = screen.getAllByText('CCS');
      expect(ccsElements.length).toBeGreaterThanOrEqual(2);
      const coeElements = screen.getAllByText('COE');
      expect(coeElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows empty state when items array is empty', () => {
      render(
        <GlobalLedger
          items={[]}
          loading={false}
          error={null}
          deptName="Test Dept"
        />
      );

      expect(screen.getByText(/no items/i)).toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('filters items by name (case-insensitive)', () => {
      render(
        <GlobalLedger
          items={mockItems}
          loading={false}
          error={null}
          deptName="Test Dept"
        />
      );

      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'laptop' } });

      expect(screen.getByText('Laptop')).toBeInTheDocument();
      expect(screen.queryByText('Wallet')).not.toBeInTheDocument();
      expect(screen.queryByText('Phone')).not.toBeInTheDocument();
    });

    it('shows no results message when search matches nothing', () => {
      render(
        <GlobalLedger
          items={mockItems}
          loading={false}
          error={null}
          deptName="Test Dept"
        />
      );

      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'zzzzz' } });

      expect(screen.getByText(/no items/i)).toBeInTheDocument();
    });
  });

  describe('department filter', () => {
    it('filters items by department_origin', () => {
      render(
        <GlobalLedger
          items={mockItems}
          loading={false}
          error={null}
          deptName="Test Dept"
        />
      );

      const deptSelect = screen.getByLabelText(/department filter/i);
      fireEvent.change(deptSelect, { target: { value: 'COE' } });

      expect(screen.getByText('Wallet')).toBeInTheDocument();
      expect(screen.queryByText('Laptop')).not.toBeInTheDocument();
      expect(screen.queryByText('Phone')).not.toBeInTheDocument();
    });
  });

  describe('detail modal', () => {
    it('opens modal when clicking an item row', () => {
      render(
        <GlobalLedger
          items={mockItems}
          loading={false}
          error={null}
          deptName="Test Dept"
        />
      );

      // Click the laptop row
      fireEvent.click(screen.getByText('Laptop'));

      // Modal should show item details
      expect(screen.getByText(/Item Details/i)).toBeInTheDocument();
      // "Laptop" appears twice now: in table row and in modal
      const laptopElements = screen.getAllByText('Laptop');
      expect(laptopElements.length).toBe(2);
    });

    it('shows surrendered_by details for found items with matching department', () => {
      render(
        <GlobalLedger
          items={mockItems}
          loading={false}
          error={null}
          deptName="COE"
        />
      );

      // Click the Wallet item (found, department_origin = COE, same as deptName)
      fireEvent.click(screen.getByText('Wallet'));

      // Should show the full person details (dept matches)
      expect(screen.getByText(/Surrendered By/i)).toBeInTheDocument();
      expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
      expect(screen.getByText('+639123456789')).toBeInTheDocument();
      // id_type and id_number appear together as "student_id: 2020-0001"
      expect(screen.getByText(/student_id: 2020-0001/)).toBeInTheDocument();
    });

    it('masks PII for surrendered_by when department does not match', () => {
      render(
        <GlobalLedger
          items={mockItems}
          loading={false}
          error={null}
          deptName="CCS"
        />
      );

      // Click Wallet (department_origin = COE, deptName = CCS - not matching)
      fireEvent.click(screen.getByText('Wallet'));

      // Should show name but mask PII
      expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
      // [REDACTED] appears twice (mobile + id details)
      const redactedElements = screen.getAllByText(/\[REDACTED\]/i);
      expect(redactedElements.length).toBeGreaterThanOrEqual(1);
      // The mobile should NOT be visible
      expect(screen.queryByText('+639123456789')).not.toBeInTheDocument();
    });

    it('shows claimed_by details for claimed items with matching department', () => {
      render(
        <GlobalLedger
          items={mockItems}
          loading={false}
          error={null}
          deptName="CCS"
        />
      );

      // Click Phone (department_origin = CCS, matches deptName)
      fireEvent.click(screen.getByText('Phone'));

      // Should show claimed by details
      expect(screen.getByText(/Claimed By/i)).toBeInTheDocument();
      expect(screen.getByText('Pedro Reyes')).toBeInTheDocument();
      expect(screen.getByText('+639555666777')).toBeInTheDocument();
    });

    it('masks PII for claimed_by when department does not match', () => {
      render(
        <GlobalLedger
          items={mockItems}
          loading={false}
          error={null}
          deptName="COE"
        />
      );

      // Click Phone (department_origin = CCS, deptName = COE - not matching)
      fireEvent.click(screen.getByText('Phone'));

      // Should show name but mask PII for claimed_by
      expect(screen.getByText('Pedro Reyes')).toBeInTheDocument();
      // Should show REDACTED for PII (for surrendered_by mobile + id, and claimed_by mobile)
      const redactedElements = screen.getAllByText(/\[REDACTED\]/i);
      expect(redactedElements.length).toBeGreaterThan(0);
      expect(screen.queryByText('+639555666777')).not.toBeInTheDocument();
    });

    it('closes modal when clicking close button', () => {
      render(
        <GlobalLedger
          items={mockItems}
          loading={false}
          error={null}
          deptName="Test Dept"
        />
      );

      // Open modal
      fireEvent.click(screen.getByText('Laptop'));
      expect(screen.getByText(/Item Details/i)).toBeInTheDocument();

      // Close modal
      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(screen.queryByText(/Item Details/i)).not.toBeInTheDocument();
    });
  });

  describe('process claim button', () => {
    it('shows Process Claim button for found items when onProcessClaim is provided', () => {
      render(
        <GlobalLedger
          items={mockItems}
          loading={false}
          error={null}
          deptName="COE"
          onProcessClaim={() => {}}
        />
      );

      // Open the Wallet item (status = found)
      fireEvent.click(screen.getByText('Wallet'));

      expect(screen.getByRole('button', { name: /process claim/i })).toBeInTheDocument();
    });

    it('does not show Process Claim button when onProcessClaim is not provided', () => {
      render(
        <GlobalLedger
          items={mockItems}
          loading={false}
          error={null}
          deptName="COE"
        />
      );

      fireEvent.click(screen.getByText('Wallet'));

      expect(screen.queryByRole('button', { name: /process claim/i })).not.toBeInTheDocument();
    });

    it('does not show Process Claim button for lost items', () => {
      render(
        <GlobalLedger
          items={mockItems}
          loading={false}
          error={null}
          deptName="Test Dept"
          onProcessClaim={() => {}}
        />
      );

      fireEvent.click(screen.getByText('Laptop'));

      expect(screen.queryByRole('button', { name: /process claim/i })).not.toBeInTheDocument();
    });

    it('does not show Process Claim button for claimed items', () => {
      render(
        <GlobalLedger
          items={mockItems}
          loading={false}
          error={null}
          deptName="CCS"
          onProcessClaim={() => {}}
        />
      );

      fireEvent.click(screen.getByText('Phone'));

      expect(screen.queryByRole('button', { name: /process claim/i })).not.toBeInTheDocument();
    });

    it('calls onProcessClaim with the item id when clicked', () => {
      const onProcessClaim = vi.fn();
      render(
        <GlobalLedger
          items={mockItems}
          loading={false}
          error={null}
          deptName="COE"
          onProcessClaim={onProcessClaim}
        />
      );

      fireEvent.click(screen.getByText('Wallet'));
      fireEvent.click(screen.getByRole('button', { name: /process claim/i }));

      expect(onProcessClaim).toHaveBeenCalledWith('2');
    });
  });
});
