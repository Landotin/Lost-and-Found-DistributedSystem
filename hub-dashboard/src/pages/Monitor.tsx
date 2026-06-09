import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchHubHealth, fetchNodes, forceSync, disconnectNode, type NodeInfo, type HubHealth } from '../hooks/useAdminApi'
import { Wifi, WifiOff, RefreshCw, XCircle, Loader2, AlertCircle } from 'lucide-react'

type ActionState = 'idle' | 'loading' | 'success' | 'error'

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  parts.push(`${s}s`)
  return parts.join(' ')
}

function NodeActions({ node }: { node: NodeInfo }) {
  const [actionState, setActionState] = useState<ActionState>('idle')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up reset timer on unmount
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  const handleAction = useCallback(async (action: 'sync' | 'disconnect') => {
    // Clear any existing reset timer
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current)
    }

    setActionState('loading')
    setErrorMsg('')
    try {
      if (action === 'sync') {
        await forceSync(node.socketId)
      } else {
        await disconnectNode(node.socketId)
      }
      setActionState('success')
      resetTimerRef.current = setTimeout(() => setActionState('idle'), 2000)
    } catch (err) {
      setActionState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Action failed')
      resetTimerRef.current = setTimeout(() => setActionState('idle'), 3000)
    }
  }, [node.socketId])

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleAction('sync')}
        disabled={actionState === 'loading'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors"
        title="Force SYNC_DUMP to this node"
      >
        {actionState === 'loading' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5" />
        )}
        Force Sync
      </button>
      <button
        onClick={() => handleAction('disconnect')}
        disabled={actionState === 'loading'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors"
        title="Disconnect this node"
      >
        <XCircle className="w-3.5 h-3.5" />
        Disconnect
      </button>
      {actionState === 'error' && (
        <span className="text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {errorMsg}
        </span>
      )}
      {actionState === 'success' && (
        <span className="text-xs text-green-400">Done</span>
      )}
    </div>
  )
}

function Monitor() {
  const [health, setHealth] = useState<HubHealth | null>(null)
  const [nodes, setNodes] = useState<NodeInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [healthData, nodesData] = await Promise.all([
        fetchHubHealth(),
        fetchNodes(),
      ])
      setHealth(healthData)
      setNodes(nodesData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    // Defer data loading to avoid setState-in-effect lint
    Promise.resolve().then(() => {
      if (!cancelled) loadData()
    })
    const interval = setInterval(() => {
      if (!cancelled) loadData()
    }, 10000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [loadData])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Monitor</h1>
        <p className="text-gray-400 mt-1">Real-time connection status and node health</p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-400">Connected Nodes</h2>
            <div className={`w-3 h-3 rounded-full ${health && health.nodeCount > 0 ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          </div>
          {loading && !health ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : error ? (
            <p className="text-2xl font-bold text-red-400">—</p>
          ) : (
            <p className="text-4xl font-bold text-white">{health?.nodeCount ?? '—'}</p>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-400">Hub Uptime</h2>
            <span className="text-xs text-gray-500">live</span>
          </div>
          {loading && !health ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : error ? (
            <p className="text-2xl font-bold text-red-400">—</p>
          ) : (
            <p className="text-3xl font-bold text-white font-mono">{health ? formatUptime(health.uptime) : '—'}</p>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-400">Items Tracked</h2>
            <span className="text-xs text-gray-500">total</span>
          </div>
          {loading && !health ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : error ? (
            <p className="text-2xl font-bold text-red-400">—</p>
          ) : (
            <p className="text-4xl font-bold text-white">{nodes.length}</p>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-800 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
          <button
            onClick={loadData}
            className="ml-auto text-xs font-medium text-red-200 hover:text-white underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Nodes Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Connected Nodes</h2>
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading && nodes.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm">Loading nodes...</p>
          </div>
        ) : nodes.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-500">
            <WifiOff className="w-10 h-10 mb-3" />
            <p className="text-sm">No nodes connected</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-6 py-3 text-gray-400 font-medium">Department</th>
                  <th className="text-left px-6 py-3 text-gray-400 font-medium">Socket ID</th>
                  <th className="text-left px-6 py-3 text-gray-400 font-medium">Connected At</th>
                  <th className="text-right px-6 py-3 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {nodes.map((node) => (
                  <tr key={node.socketId} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-green-400" />
                        <span className="font-medium text-white">{node.deptName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs text-gray-400 font-mono bg-gray-800 px-2 py-0.5 rounded">
                        {node.socketId.substring(0, 16)}...
                      </code>
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {new Date(node.connectedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <NodeActions node={node} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Monitor
