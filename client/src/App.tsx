import { useState } from 'react';
import ConnectionStatus from './components/ConnectionStatus';
import LogItemForm from './components/LogItemForm';
import PendingSync from './components/PendingSync';
import GlobalLedger from './components/GlobalLedger';
import ProcessClaim from './components/ProcessClaim';
import ClaimedItems from './components/ClaimedItems';
import LostItems from './components/LostItems';
import FoundItems from './components/FoundItems';
import { usePolling } from './hooks/usePolling';
import { fetchStatus, fetchPendingSync, fetchItems } from './hooks/useApi';
import type { StatusResponse, PendingSyncResponse, Item } from './types';

type Tab = 'ledger' | 'lost-items' | 'found-items' | 'claimed-items' | 'log' | 'claim' | 'pending';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('ledger');
  const [processClaimItemId, setProcessClaimItemId] = useState<string | null>(null);

  // Lifted polling state to prevent duplicate HTTP requests
  const { data: statusData, loading: statusLoading, error: statusError } = usePolling<StatusResponse>(fetchStatus, 5000);
  const { data: pendingData, loading: pendingLoading, error: pendingError } = usePolling<PendingSyncResponse>(fetchPendingSync, 5000);
  const { data: items, loading: itemsLoading, error: itemsError } = usePolling<Item[]>(fetchItems, 5000);

  const deptName = statusData?.deptName || import.meta.env.VITE_DEPT_NAME || 'Department Node';

  const getTabClassName = (tab: Tab) =>
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
          aria-selected={activeTab === 'lost-items'}
          onClick={() => setActiveTab('lost-items')}
          className={getTabClassName('lost-items')}
        >
          Lost Items
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'found-items'}
          onClick={() => setActiveTab('found-items')}
          className={getTabClassName('found-items')}
        >
          Found Items
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'claimed-items'}
          onClick={() => setActiveTab('claimed-items')}
          className={getTabClassName('claimed-items')}
        >
          Claimed Items
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
          aria-selected={activeTab === 'claim'}
          onClick={() => { setActiveTab('claim'); setProcessClaimItemId(null); }}
          className={getTabClassName('claim')}
        >
          Process Claim
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
            onProcessClaim={(itemId) => {
              setProcessClaimItemId(itemId);
              setActiveTab('claim');
            }}
          />
        ) : activeTab === 'lost-items' ? (
          <LostItems
            items={items}
            loading={itemsLoading}
            error={itemsError}
            deptName={deptName}
          />
        ) : activeTab === 'found-items' ? (
          <FoundItems
            items={items}
            loading={itemsLoading}
            error={itemsError}
            deptName={deptName}
            onProcessClaim={(itemId) => {
              setProcessClaimItemId(itemId);
              setActiveTab('claim');
            }}
          />
        ) : activeTab === 'claimed-items' ? (
          <ClaimedItems
            items={items}
            loading={itemsLoading}
            error={itemsError}
            deptName={deptName}
          />
        ) : activeTab === 'log' ? (
          <LogItemForm
            onNavigate={(tab, itemId) => {
              if (tab === 'claim' && itemId) {
                setProcessClaimItemId(itemId);
              }
              setActiveTab(tab);
            }}
          />
        ) : activeTab === 'claim' ? (
          <ProcessClaim
            items={items}
            preselectedItemId={processClaimItemId}
            onClaimProcessed={() => {
              setProcessClaimItemId(null);
            }}
          />
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

