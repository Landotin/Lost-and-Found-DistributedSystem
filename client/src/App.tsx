import { useState } from 'react';
import ConnectionStatus from './components/ConnectionStatus';
import LogItemForm from './components/LogItemForm';
import PendingSync from './components/PendingSync';
import GlobalLedger from './components/GlobalLedger';
import { usePolling } from './hooks/usePolling';
import { fetchStatus, fetchPendingSync, fetchItems } from './hooks/useApi';
import type { StatusResponse, PendingSyncResponse, Item } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'ledger' | 'log' | 'pending'>('ledger');

  // Lifted polling state to prevent duplicate HTTP requests
  const { data: statusData, loading: statusLoading, error: statusError } = usePolling<StatusResponse>(fetchStatus, 5000);
  const { data: pendingData, loading: pendingLoading, error: pendingError } = usePolling<PendingSyncResponse>(fetchPendingSync, 5000);
  const { data: items, loading: itemsLoading, error: itemsError } = usePolling<Item[]>(fetchItems, 5000);

  const deptName = statusData?.deptName || import.meta.env.VITE_DEPT_NAME || 'Department Node';

  const getTabClassName = (tab: 'ledger' | 'log' | 'pending') =>
    `px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
      activeTab === tab
        ? 'border-b-2 border-blue-500 text-blue-400'
        : 'text-gray-400 hover:text-gray-200'
    }`;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Connection status banner */}
      <ConnectionStatus
        className="px-6 pt-6"
        statusData={statusData}
        loading={statusLoading}
        error={statusError}
        pendingCount={pendingData ? pendingData.count : null}
      />

      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight">
          Lost & Found Tracker — {deptName}
        </h1>
      </header>

      {/* Tab navigation */}
      <nav className="flex border-b border-gray-800 px-6" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'ledger'}
          onClick={() => setActiveTab('ledger')}
          className={getTabClassName('ledger')}
        >
          Global Ledger
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'log'}
          onClick={() => setActiveTab('log')}
          className={getTabClassName('log')}
        >
          Log Item
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'pending'}
          onClick={() => setActiveTab('pending')}
          className={getTabClassName('pending')}
        >
          Pending Sync
        </button>
      </nav>

      {/* Tab content */}
      <main className="p-6">
        {activeTab === 'ledger' ? (
          <GlobalLedger
            items={items}
            loading={itemsLoading}
            error={itemsError}
            deptName={deptName}
          />
        ) : activeTab === 'log' ? (
          <LogItemForm />
        ) : (
          <PendingSync
            pendingData={pendingData}
            loading={pendingLoading}
            error={pendingError}
          />
        )}
      </main>
    </div>
  );
}

