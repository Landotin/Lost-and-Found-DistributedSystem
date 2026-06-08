import type { StatusResponse } from '../types';

interface ConnectionStatusProps {
  className?: string;
  statusData: StatusResponse | null;
  loading: boolean;
  error: string | null;
  pendingCount: number | null; // null indicates still loading
}

export default function ConnectionStatus({
  className,
  statusData,
  loading,
  error,
  pendingCount,
}: ConnectionStatusProps) {
  const connectionStatus = statusData?.status;
  const nodeCount = statusData?.nodeCount ?? 0;
  const isDisconnected = connectionStatus === 'disconnected' && !loading && !error;
  const hasPendingCount = pendingCount !== null; // only show count once pending-sync data has loaded

  // Determine LED appearance and status text
  let ledColor: string;
  let ledAnimation: string;
  let showPing = false;
  let statusText: string;

  if (loading && !statusData) {
    // Initial loading skeleton
    ledColor = 'bg-gray-600';
    ledAnimation = 'animate-pulse';
    statusText = 'Loading...';
  } else if (error) {
    ledColor = 'bg-red-500';
    ledAnimation = '';
    statusText = 'Status unavailable';
  } else if (connectionStatus === 'connected') {
    ledColor = 'bg-green-500';
    ledAnimation = '';
    showPing = true;
    statusText = `Connected — ${nodeCount} node(s)`;
  } else if (connectionStatus === 'connecting') {
    ledColor = 'bg-amber-500';
    ledAnimation = 'animate-pulse';
    statusText = 'Connecting...';
  } else {
    // disconnected or unknown status
    ledColor = 'bg-red-500';
    ledAnimation = '';
    statusText = 'Disconnected';
  }

  return (
    <>
      {/* Offline banner — fixed to top of page when disconnected */}
      {isDisconnected && (
        <div className="fixed top-0 left-0 w-full bg-amber-600/90 text-amber-100 text-center py-2 px-4 text-sm font-medium z-50 backdrop-blur-sm">
          ⚠ You are offline. {hasPendingCount ? `${pendingCount} item(s) pending sync.` : 'Checking pending items...'}
        </div>
      )}

      {/* Connection status indicator */}
      <div className={`flex items-center gap-2 ${className ?? ''}`}>
        <div className="relative flex items-center justify-center">
          {/* Ping ring (only for connected state) */}
          {showPing && (
            <span className="absolute inline-flex h-3 w-3 rounded-full bg-green-500 opacity-75 animate-ping" />
          )}
          {/* Solid LED dot */}
          <span
            className={`relative inline-flex h-3 w-3 rounded-full ${ledColor} ${ledAnimation}`}
          />
        </div>
        <span className="text-sm text-gray-300">{statusText}</span>
      </div>
    </>
  );
}
