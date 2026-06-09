import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import FoundItems from '../FoundItems';
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
    department_origin: 'COE',
    status: 'found',
    synced: 1,
    created_at: '2026-06-03T12:00:00Z',
    surrendered_by: 'person-2',
    surrenderedByPerson: {
      id: 'person-2',
      full_name: 'Maria Santos',
      mobile: '+639987654321',
      id_type: 'student_id',
      id_number: '2020-0002',
    },
  },
];

describe('FoundItems', () => {
  afterEach(() => {
    cleanup();
  });

  describe('loading state', () => {
    it('shows loading indicator when loading is true', () => {
      render(
        <FoundItems items={null} loading={true} error={null} deptName="CCS" />
      );
      expect(screen.getByText(/Loading found items/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when error is provided', () => {
      render(
        <FoundItems items={null} loading={false} error="Network error" deptName="CCS" />
      );
      expect(screen.getByText('Error loading items')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty message when items array is null', () => {
      render(
        <FoundItems items={null} loading={false} error={null} deptName="CCS" />
      );
      expect(screen.getByText(/No items found/i)).toBeInTheDocument();
    });

    it('shows empty message when items array is empty', () => {
      render(
        <FoundItems items={[]} loading={false} error={null} deptName="CCS" />
      );
      expect(screen.getByText(/No items found/i)).toBeInTheDocument();
    });
  });

  describe('no found items state', () => {
    it('shows specific message when items exist but none are found', () => {
      const nonFoundItems = mockItems.filter((i) => i.status !== 'found');
      render(
        <FoundItems items={nonFoundItems} loading={false} error={null} deptName="CCS" />
      );
      expect(screen.getByText(/No found items yet/i)).toBeInTheDocument();
    });
  });

  describe('found items display', () => {
    it('shows only found items from the current department', () => {
      render(
        <FoundItems items={mockItems} loading={false} error={null} deptName="CCS" />
      );
      // Wallet is CCS+found → visible
      expect(screen.getByText('Wallet')).toBeInTheDocument();
      // Phone is COE+found → hidden (wrong department)
      expect(screen.queryByText('Phone')).not.toBeInTheDocument();
      // Laptop is lost → hidden
      expect(screen.queryByText('Laptop')).not.toBeInTheDocument();
    });

    it('shows surrenderer name for found items', () => {
      render(
        <FoundItems items={mockItems} loading={false} error={null} deptName="CCS" />
      );
      expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    });

    it('shows summary text with count', () => {
      render(
        <FoundItems items={mockItems} loading={false} error={null} deptName="CCS" />
      );
      expect(screen.getByText(/Showing 1 of 1 found item/i)).toBeInTheDocument();
    });
  });

  describe('search filtering', () => {
    it('filters by item name', () => {
      render(
        <FoundItems items={mockItems} loading={false} error={null} deptName="CCS" />
      );
      const searchInput = screen.getByPlaceholderText(/Search by item name/i);
      fireEvent.change(searchInput, { target: { value: 'Wallet' } });

      expect(screen.getByText('Wallet')).toBeInTheDocument();
    });

    it('filters by surrenderer name', () => {
      render(
        <FoundItems items={mockItems} loading={false} error={null} deptName="CCS" />
      );
      const searchInput = screen.getByPlaceholderText(/Search by item name/i);
      fireEvent.change(searchInput, { target: { value: 'Dela Cruz' } });

      expect(screen.getByText('Wallet')).toBeInTheDocument();
    });

    it('shows no matches message when search yields no results', () => {
      render(
        <FoundItems items={mockItems} loading={false} error={null} deptName="CCS" />
      );
      const searchInput = screen.getByPlaceholderText(/Search by item name/i);
      fireEvent.change(searchInput, { target: { value: 'zzzznotfound' } });

      expect(screen.getByText('No matching found items')).toBeInTheDocument();
    });
  });

  describe('process claim button', () => {
    it('renders Process Claim button in modal when onProcessClaim is provided', () => {
      const onProcessClaim = vi.fn();
      render(
        <FoundItems items={mockItems} loading={false} error={null} deptName="CCS" onProcessClaim={onProcessClaim} />
      );
      fireEvent.click(screen.getByText('Wallet'));

      expect(screen.getByText('Process Claim')).toBeInTheDocument();
    });

    it('does not render Process Claim button when onProcessClaim is not provided', () => {
      render(
        <FoundItems items={mockItems} loading={false} error={null} deptName="CCS" />
      );
      fireEvent.click(screen.getByText('Wallet'));

      expect(screen.queryByText('Process Claim')).not.toBeInTheDocument();
    });

    it('calls onProcessClaim with correct item id', () => {
      const onProcessClaim = vi.fn();
      render(
        <FoundItems items={mockItems} loading={false} error={null} deptName="CCS" onProcessClaim={onProcessClaim} />
      );
      fireEvent.click(screen.getByText('Wallet'));
      fireEvent.click(screen.getByText('Process Claim'));

      expect(onProcessClaim).toHaveBeenCalledWith('2');
    });
  });

  describe('detail modal', () => {
    it('opens detail modal on row click', () => {
      render(
        <FoundItems items={mockItems} loading={false} error={null} deptName="CCS" />
      );
      fireEvent.click(screen.getByText('Wallet'));

      expect(screen.getByText('Found Item Details')).toBeInTheDocument();
      // "Juan Dela Cruz" appears in both table row and modal
      const nameElements = screen.getAllByText('Juan Dela Cruz');
      expect(nameElements.length).toBeGreaterThanOrEqual(2);
    });

    it('closes modal on close button click', () => {
      render(
        <FoundItems items={mockItems} loading={false} error={null} deptName="CCS" />
      );
      fireEvent.click(screen.getByText('Wallet'));
      expect(screen.getByText('Found Item Details')).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Close'));
      expect(screen.queryByText('Found Item Details')).not.toBeInTheDocument();
    });
  });
});
