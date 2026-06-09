import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import ClaimedItems from '../ClaimedItems';
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
  },
  {
    id: '2',
    item_name: 'Wallet',
    category: 'Accessories',
    department_origin: 'CCS',
    status: 'found',
    synced: 1,
    created_at: '2026-06-02T11:00:00Z',
    surrendered_by: 'person-1',
    surrenderedByPerson: {
      id: 'person-1',
      full_name: 'Juan Dela Cruz',
      mobile: '+639123456789',
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
    claimed_at: '2026-06-04T10:00:00Z',
    surrendered_by: 'person-2',
    surrenderedByPerson: {
      id: 'person-2',
      full_name: 'Maria Santos',
      mobile: '+639987654321',
      id_type: 'student_id',
      id_number: '2020-0002',
    },
    claimed_by: 'person-3',
    claimedByPerson: {
      id: 'person-3',
      full_name: 'Pedro Reyes',
      mobile: '+639555666777',
    },
  },
  {
    id: '4',
    item_name: 'Tablet',
    category: 'Electronics',
    department_origin: 'COE',
    status: 'claimed',
    synced: 1,
    created_at: '2026-06-05T12:00:00Z',
    claimed_at: '2026-06-06T14:00:00Z',
    surrendered_by: 'person-4',
    surrenderedByPerson: {
      id: 'person-4',
      full_name: 'Ana Gonzales',
      mobile: '+639111222333',
    },
    claimed_by: 'person-5',
    claimedByPerson: {
      id: 'person-5',
      full_name: 'Jose Rizal',
      mobile: '+639444555666',
    },
  },
];

describe('ClaimedItems', () => {
  afterEach(() => {
    cleanup();
  });

  describe('loading state', () => {
    it('shows loading indicator when loading is true', () => {
      render(
        <ClaimedItems
          items={null}
          loading={true}
          error={null}
          deptName="CCS"
        />
      );
      expect(screen.getByText(/Loading claimed items/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when error is provided', () => {
      render(
        <ClaimedItems
          items={null}
          loading={false}
          error="Network error"
          deptName="CCS"
        />
      );
      expect(screen.getByText('Error loading items')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty message when items array is null', () => {
      render(
        <ClaimedItems
          items={null}
          loading={false}
          error={null}
          deptName="CCS"
        />
      );
      expect(screen.getByText(/No items found/i)).toBeInTheDocument();
    });

    it('shows empty message when items array is empty', () => {
      render(
        <ClaimedItems
          items={[]}
          loading={false}
          error={null}
          deptName="CCS"
        />
      );
      expect(screen.getByText(/No items found/i)).toBeInTheDocument();
    });
  });

  describe('no claimed items state', () => {
    it('shows specific message when items exist but none are claimed', () => {
      const nonClaimedItems = mockItems.filter((i) => i.status !== 'claimed');
      render(
        <ClaimedItems
          items={nonClaimedItems}
          loading={false}
          error={null}
          deptName="CCS"
        />
      );
      expect(screen.getByText(/No claimed items yet/i)).toBeInTheDocument();
    });
  });

  describe('claimed items display', () => {
    it('shows only claimed items from the current department', () => {
      render(
        <ClaimedItems
          items={mockItems}
          loading={false}
          error={null}
          deptName="CCS"
        />
      );
      // Phone is CCS+claimed → visible
      expect(screen.getByText('Phone')).toBeInTheDocument();
      // Tablet is COE+claimed → hidden (wrong department)
      expect(screen.queryByText('Tablet')).not.toBeInTheDocument();
      // Lost/found items should not appear
      expect(screen.queryByText('Laptop')).not.toBeInTheDocument();
      expect(screen.queryByText('Wallet')).not.toBeInTheDocument();
    });

    it('shows only this department claimed items (COE)', () => {
      render(
        <ClaimedItems
          items={mockItems}
          loading={false}
          error={null}
          deptName="COE"
        />
      );
      // Tablet is COE+claimed → visible
      expect(screen.getByText('Tablet')).toBeInTheDocument();
      // Phone is CCS+claimed → hidden (wrong department)
      expect(screen.queryByText('Phone')).not.toBeInTheDocument();
    });

    it('shows surrenderer and claimant names for claimed items', () => {
      render(
        <ClaimedItems
          items={mockItems}
          loading={false}
          error={null}
          deptName="CCS"
        />
      );
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      expect(screen.getByText('Pedro Reyes')).toBeInTheDocument();
      // Ana Gonzales and Jose Rizal are COE items — should not show on CCS
      expect(screen.queryByText('Ana Gonzales')).not.toBeInTheDocument();
      expect(screen.queryByText('Jose Rizal')).not.toBeInTheDocument();
    });

    it('shows summary text with count', () => {
      render(
        <ClaimedItems
          items={mockItems}
          loading={false}
          error={null}
          deptName="CCS"
        />
      );
      // Only Phone (CCS+claimed), not Tablet (COE+claimed)
      expect(screen.getByText(/Showing 1 of 1 claimed item/i)).toBeInTheDocument();
    });
  });

  describe('search filtering', () => {
    it('filters by item name', () => {
      render(
        <ClaimedItems
          items={mockItems}
          loading={false}
          error={null}
          deptName="CCS"
        />
      );
      const searchInput = screen.getByPlaceholderText(/Search by item name/i);
      fireEvent.change(searchInput, { target: { value: 'Phone' } });

      expect(screen.getByText('Phone')).toBeInTheDocument();
      expect(screen.queryByText('Tablet')).not.toBeInTheDocument();
    });

    it('filters by claimant name', () => {
      render(
        <ClaimedItems
          items={mockItems}
          loading={false}
          error={null}
          deptName="CCS"
        />
      );
      const searchInput = screen.getByPlaceholderText(/Search by item name/i);
      fireEvent.change(searchInput, { target: { value: 'Reyes' } });

      expect(screen.getByText('Phone')).toBeInTheDocument();
      expect(screen.queryByText('Tablet')).not.toBeInTheDocument();
    });

    it('filters by surrenderer name', () => {
      render(
        <ClaimedItems
          items={mockItems}
          loading={false}
          error={null}
          deptName="COE"
        />
      );
      const searchInput = screen.getByPlaceholderText(/Search by item name/i);
      fireEvent.change(searchInput, { target: { value: 'Gonzales' } });

      expect(screen.getByText('Tablet')).toBeInTheDocument();
      expect(screen.queryByText('Phone')).not.toBeInTheDocument();
    });

    it('shows no matches message when search yields no results', () => {
      render(
        <ClaimedItems
          items={mockItems}
          loading={false}
          error={null}
          deptName="CCS"
        />
      );
      const searchInput = screen.getByPlaceholderText(/Search by item name/i);
      fireEvent.change(searchInput, { target: { value: 'zzzznotfound' } });

      expect(screen.getByText('No matching claimed items')).toBeInTheDocument();
    });
  });

  describe('detail modal', () => {
    it('opens detail modal on row click', () => {
      render(
        <ClaimedItems
          items={mockItems}
          loading={false}
          error={null}
          deptName="CCS"
        />
      );
      fireEvent.click(screen.getByText('Phone'));

      expect(screen.getByText('Claimed Item Details')).toBeInTheDocument();
      // Names appear in both table and modal - use getAllByText
      expect(screen.getAllByText('Pedro Reyes').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Maria Santos').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Claimed By')).toBeInTheDocument();
      expect(screen.getByText('Surrendered By')).toBeInTheDocument();
    });

    it('shows claim date in modal', () => {
      render(
        <ClaimedItems
          items={mockItems}
          loading={false}
          error={null}
          deptName="CCS"
        />
      );
      fireEvent.click(screen.getByText('Phone'));

      // Use getAllByText and assert at least one match for the label
      const dateClaimedLabels = screen.getAllByText('Date Claimed');
      expect(dateClaimedLabels.length).toBeGreaterThanOrEqual(1);
    });

    it('closes modal on close button click', () => {
      render(
        <ClaimedItems
          items={mockItems}
          loading={false}
          error={null}
          deptName="CCS"
        />
      );
      fireEvent.click(screen.getByText('Phone'));
      expect(screen.getByText('Claimed Item Details')).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Close'));
      expect(screen.queryByText('Claimed Item Details')).not.toBeInTheDocument();
    });

    it('shows full PII for own department items', () => {
      render(
        <ClaimedItems
          items={mockItems}
          loading={false}
          error={null}
          deptName="CCS"
        />
      );
      // Phone is from CCS, same as deptName
      fireEvent.click(screen.getByText('Phone'));

      // Use getAllByText - the label "student_id" and content "student_id: 2020-0002" both match
      const studentIdElements = screen.getAllByText(/student_id/);
      expect(studentIdElements.length).toBeGreaterThanOrEqual(1);
    });
  });
});
