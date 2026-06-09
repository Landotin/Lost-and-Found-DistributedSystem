import { useState, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import type { Item } from '../types';

interface LostItemsProps {
  items: Item[] | null;
  loading: boolean;
  error: string | null;
  deptName: string;
}

type ItemStatus = 'lost' | 'found' | 'claimed';

const STATUS_COLORS: Record<ItemStatus, string> = {
  lost: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  found: 'bg-blue-900/50 text-blue-300 border-blue-700',
  claimed: 'bg-green-900/50 text-green-300 border-green-700',
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

interface DetailModalProps {
  item: Item;
  deptName: string;
  onClose: () => void;
}

function DetailModal({ item, deptName, onClose }: DetailModalProps) {
  const isOwnDepartment = item.department_origin === deptName;

  const renderPersonSection = (
    label: string,
    person: { full_name: string; mobile?: string; id_type?: string; id_number?: string } | undefined
  ) => {
    if (!person) return null;
    return (
      <div className="border-t border-gray-700 pt-3 mt-3">
        <h4 className="text-sm font-semibold text-gray-400 mb-2">{label}</h4>
        <p className="text-gray-200">{person.full_name}</p>
        {isOwnDepartment ? (
          <>
            <p className="text-sm text-gray-400">{person.mobile ?? '—'}</p>
            {person.id_type && (
              <p className="text-sm text-gray-400">
                {person.id_type}: {person.id_number ?? '—'}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-gray-400">[REDACTED]</p>
            {person.id_type && (
              <p className="text-sm text-gray-400">[REDACTED]</p>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-100">Lost Item Details</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Item details */}
        <div className="space-y-2">
          <div>
            <span className="text-sm text-gray-400">Item Name</span>
            <p className="text-gray-200 font-medium">{item.item_name}</p>
          </div>

          {item.description && (
            <div>
              <span className="text-sm text-gray-400">Description</span>
              <p className="text-gray-200">{item.description}</p>
            </div>
          )}

          <div>
            <span className="text-sm text-gray-400">Category</span>
            <p className="text-gray-200">{item.category ?? '—'}</p>
          </div>

          <div>
            <span className="text-sm text-gray-400">Origin Department</span>
            <p className="text-gray-200">{item.department_origin}</p>
          </div>

          <div>
            <span className="text-sm text-gray-400">Status</span>
            <span
              className={`ml-2 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                STATUS_COLORS[item.status as ItemStatus] ?? 'bg-gray-700 text-gray-300'
              }`}
            >
              {item.status}
            </span>
          </div>

          {item.surrenderedByPerson && renderPersonSection('Surrendered By', item.surrenderedByPerson)}
          {item.claimedByPerson && renderPersonSection('Claimed By', item.claimedByPerson)}

          <div>
            <span className="text-sm text-gray-400">Date Logged</span>
            <p className="text-gray-200">{formatDateTime(item.created_at)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LostItems({ items, loading, error, deptName }: LostItemsProps) {
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // Filter to only lost items from this department
  const lostItems = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => item.status === 'lost' && item.department_origin === deptName);
  }, [items, deptName]);

  // Further filter by search (matches item name)
  const filteredItems = useMemo(() => {
    if (!search) return lostItems;
    const q = search.toLowerCase();
    return lostItems.filter((item) => item.item_name.toLowerCase().includes(q));
  }, [lostItems, search]);

  // Loading state
  if (loading && !items) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-500 border-t-blue-500" />
          <span>Loading lost items...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-700 bg-red-900/30 p-4 text-red-300">
        <p className="font-medium">Error loading items</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  // Empty state — no items at all
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">📦 No items found</p>
        <p className="text-sm mt-1">Items logged in this department will appear here.</p>
      </div>
    );
  }

  // Empty state — items exist but none lost
  if (lostItems.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">🔍 No lost items yet</p>
        <p className="text-sm mt-1">Lost items from this department will appear here once logged.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search by item name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 pl-9 pr-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-400">
        Showing {filteredItems.length} of {lostItems.length} lost {lostItems.length === 1 ? 'item' : 'items'}
      </p>

      {/* Table */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No matching lost items</p>
          <p className="text-sm mt-1">Try adjusting your search terms.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Item Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date Logged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredItems.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="cursor-pointer transition-colors hover:bg-gray-800/50"
                >
                  <td className="px-4 py-3 text-gray-200 font-medium">{item.item_name}</td>
                  <td className="px-4 py-3 text-gray-400">{item.category ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{formatDate(item.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <DetailModal
          item={selectedItem}
          deptName={deptName}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
