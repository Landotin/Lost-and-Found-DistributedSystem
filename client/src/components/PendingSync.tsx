import type { ItemStatus, PendingSyncResponse } from '../types';

function StatusBadge({ status }: { status: ItemStatus }) {
  const colors: Record<ItemStatus, string> = {
    lost: 'bg-red-900/50 text-red-200 border-red-700',
    found: 'bg-blue-900/50 text-blue-200 border-blue-700',
    claimed: 'bg-green-900/50 text-green-200 border-green-700',
  };

  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-xs font-medium capitalize ${colors[status]}`}
    >
      {status}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="flex animate-pulse gap-4 px-4 py-3">
      <div className="h-4 w-2/5 rounded bg-gray-700" />
      <div className="h-4 w-1/6 rounded bg-gray-700" />
      <div className="h-4 w-1/4 rounded bg-gray-700" />
    </div>
  );
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

interface PendingSyncProps {
  className?: string;
  pendingData: PendingSyncResponse | null;
  loading: boolean;
  error: string | null;
}

export default function PendingSync({
  className,
  pendingData,
  loading,
  error,
}: PendingSyncProps) {
  const data = pendingData;

  // --- Loading state ---
  if (loading && !data) {
    return (
      <div className={className}>
        <h2 className="mb-4 text-lg font-semibold text-gray-200">
          Pending Sync
        </h2>
        <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
          {[1, 2, 3].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className={className}>
        <h2 className="mb-4 text-lg font-semibold text-gray-200">
          Pending Sync
        </h2>
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-6 text-center">
          <p className="mb-3 text-red-300">
            Failed to load pending items
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-red-700 bg-red-900/50 px-4 py-2 text-sm font-medium text-red-200 transition-colors hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // --- Empty state ---
  if (!data || data.items.length === 0) {
    return (
      <div className={className}>
        <h2 className="mb-4 text-lg font-semibold text-gray-200">
          Pending Sync
        </h2>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-center">
          <p className="text-gray-400">
            ✅ All synced — no pending items
          </p>
        </div>
      </div>
    );
  }

  // --- Has items ---
  return (
    <div className={className}>
      <h2 className="mb-4 text-lg font-semibold text-gray-200">
        Pending Sync{' '}
        <span className="ml-1 inline-flex items-center justify-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
          {data.count}
        </span>
      </h2>

      <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-800/50">
              <th className="px-4 py-3 font-medium text-gray-400">
                Item Name
              </th>
              <th className="px-4 py-3 font-medium text-gray-400">Status</th>
              <th className="px-4 py-3 font-medium text-gray-400">
                Created At
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {data.items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-800/30">
                <td className="px-4 py-3 text-gray-100">{item.item_name}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3 text-gray-300">
                  {formatDateTime(item.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
