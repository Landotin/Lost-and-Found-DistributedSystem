import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import LostItems from '../LostItems';
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
    status: 'lost',
    synced: 1,
    created_at: '2026-06-03T12:00:00Z',
  },
];

describe('LostItems', () => {
  afterEach(() => {
    cleanup();
  });

  describe('loading state', () => {
    it('shows loading indicator when loading is true', () => {
      render(
        <LostItems items={null} loading={true} error={null} deptName="CCS" />
      );
      expect(screen.getByText(/Loading lost items/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when error is provided', () => {
      render(
        <LostItems items={null} loading={false} error="Network error" deptName="CCS" />
      );
      expect(screen.getByText('Error loading items')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty message when items array is null', () => {
      render(
        <LostItems items={null} loading={false} error={null} deptName="CCS" />
      );
      expect(screen.getByText(/No items found/i)).toBeInTheDocument();
    });

    it('shows empty message when items array is empty', () => {
      render(
        <LostItems items={[]} loading={false} error={null} deptName="CCS" />
      );
      expect(screen.getByText(/No items found/i)).toBeInTheDocument();
    });
  });

  describe('no lost items state', () => {
    it('shows specific message when items exist but none are lost', () => {
      const nonLostItems = mockItems.filter((i) => i.status !== 'lost');
      render(
        <LostItems items={nonLostItems} loading={false} error={null} deptName="CCS" />
      );
      expect(screen.getByText(/No lost items yet/i)).toBeInTheDocument();
    });
  });

  describe('lost items display', () => {
    it('shows only lost items from the current department', () => {
      render(
        <LostItems items={mockItems} loading={false} error={null} deptName="CCS" />
      );
      // Laptop is CCS+lost → visible
      expect(screen.getByText('Laptop')).toBeInTheDocument();
      // Phone is COE+lost → hidden (wrong department)
      expect(screen.queryByText('Phone')).not.toBeInTheDocument();
      // Wallet is found → hidden
      expect(screen.queryByText('Wallet')).not.toBeInTheDocument();
    });

    it('shows summary text with count', () => {
      render(
        <LostItems items={mockItems} loading={false} error={null} deptName="CCS" />
      );
      expect(screen.getByText(/Showing 1 of 1 lost item/i)).toBeInTheDocument();
    });
  });

  describe('search filtering', () => {
    it('filters by item name', () => {
      render(
        <LostItems items={mockItems} loading={false} error={null} deptName="CCS" />
      );
      const searchInput = screen.getByPlaceholderText(/Search by item name/i);
      fireEvent.change(searchInput, { target: { value: 'Laptop' } });

      expect(screen.getByText('Laptop')).toBeInTheDocument();
    });

    it('shows no matches message when search yields no results', () => {
      render(
        <LostItems items={mockItems} loading={false} error={null} deptName="CCS" />
      );
      const searchInput = screen.getByPlaceholderText(/Search by item name/i);
      fireEvent.change(searchInput, { target: { value: 'zzzznotfound' } });

      expect(screen.getByText('No matching lost items')).toBeInTheDocument();
    });
  });

  describe('detail modal', () => {
    it('opens detail modal on row click', () => {
      render(
        <LostItems items={mockItems} loading={false} error={null} deptName="CCS" />
      );
      fireEvent.click(screen.getByText('Laptop'));

      expect(screen.getByText('Lost Item Details')).toBeInTheDocument();
      // "Electronics" appears in both table row and modal
      const electronicsElements = screen.getAllByText('Electronics');
      expect(electronicsElements.length).toBeGreaterThanOrEqual(2);
    });

    it('closes modal on close button click', () => {
      render(
        <LostItems items={mockItems} loading={false} error={null} deptName="CCS" />
      );
      fireEvent.click(screen.getByText('Laptop'));
      expect(screen.getByText('Lost Item Details')).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Close'));
      expect(screen.queryByText('Lost Item Details')).not.toBeInTheDocument();
    });
  });
});
