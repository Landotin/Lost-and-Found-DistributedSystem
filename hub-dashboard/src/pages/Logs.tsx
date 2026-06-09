import { useState, useRef, useCallback, useEffect } from 'react'
import { useAdminWs, type WsEvent, type WsState } from '../hooks/useAdminWs'
import { Play, Square, Trash2, Terminal } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LogEntry {
  id: number
  timestamp: Date
  event: string
  payload: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WS_COLORS: Record<string, string> = {
  HELLO: 'text-purple-400',
  HEARTBEAT: 'text-green-400',
  ACK: 'text-blue-400',
  ITEM_BROADCAST: 'text-yellow-400',
  STATUS_UPDATE: 'text-cyan-400',
  NODE_LIST: 'text-gray-400',
  SYNC_DUMP: 'text-orange-400',
  ERROR: 'text-red-400',
}

function getEventColor(event: string): string {
  return WS_COLORS[event] ?? 'text-gray-300'
}

function getStateColor(state: WsState): string {
  switch (state) {
    case 'connected': return 'text-green-400'
    case 'connecting': return 'text-yellow-400'
    case 'disconnected': return 'text-red-400'
  }
}

// ---------------------------------------------------------------------------
// Logs Page
// ---------------------------------------------------------------------------

function Logs() {
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [paused, setPaused] = useState(false)
  // Use a ref to accumulate buffered entries during pause (avoids stale closure)
  const pausedBufferRef = useRef<LogEntry[]>([])
  const [pausedCount, setPausedCount] = useState(0)
  const nextIdRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  // Stable onEvent callback for the WS hook — always reads paused from ref
  const pausedRef = useRef(paused)
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  const handleEvent = useCallback((event: WsEvent) => {
    const entry: LogEntry = {
      id: nextIdRef.current++,
      timestamp: new Date(),
      event: event.event,
      payload: JSON.stringify(event.payload, null, 2),
    }

    if (pausedRef.current) {
      pausedBufferRef.current = [...pausedBufferRef.current, entry]
      setPausedCount(pausedBufferRef.current.length)
    } else {
      setLogEntries((prev) => [...prev, entry])
    }
  }, [])

  const wsState = useAdminWs({ onEvent: handleEvent }).state

  // Auto-scroll to bottom when new entries arrive (only when not paused)
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logEntries])

  const handlePause = useCallback(() => {
    setPaused(true)
    autoScrollRef.current = false
  }, [])

  const handleResume = useCallback(() => {
    setPaused(false)
    // Flush buffered entries into logEntries atomically
    const buffer = pausedBufferRef.current
    if (buffer.length > 0) {
      setLogEntries((prev) => [...prev, ...buffer])
      pausedBufferRef.current = []
      setPausedCount(0)
    }
    autoScrollRef.current = true
    // Scroll in next tick after state update
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    })
  }, [])

  const handleClear = useCallback(() => {
    setLogEntries([])
    pausedBufferRef.current = []
    setPausedCount(0)
    nextIdRef.current = 0
  }, [])

  return (
    <div className="p-8 flex flex-col h-screen">
      <div className="mb-6 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Event Logs</h1>
            <p className="text-gray-400 mt-1">Real-time WebSocket event stream</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${getStateColor(wsState)}`}>
              <span className={`w-2 h-2 rounded-full ${wsState === 'connected' ? 'bg-green-500' : wsState === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
              {wsState}
            </span>

            {/* Control Buttons */}
            {paused ? (
              <button
                onClick={handleResume}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 hover:bg-green-500 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                Resume
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-yellow-600 hover:bg-yellow-500 transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                Pause
              </button>
            )}
            <button
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>
        {paused && pausedCount > 0 && (
          <p className="text-yellow-400 text-sm mt-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            Logging paused — {pausedCount} event{pausedCount !== 1 ? 's' : ''} buffered
          </p>
        )}
      </div>

      {/* Terminal */}
      <div
        ref={scrollRef}
        className="flex-1 bg-gray-950 border border-gray-800 rounded-xl overflow-y-auto font-mono text-xs min-h-0"
        onScroll={() => {
          if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
            autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50
          }
        }}
      >
        {logEntries.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600">
            <Terminal className="w-10 h-10 mb-3" />
            <p className="text-sm">Waiting for events...</p>
            <p className="text-xs mt-1">Connect to the hub WebSocket to see real-time events</p>
          </div>
        ) : (
          <div className="p-4 space-y-1">
            {logEntries.map((entry) => (
              <div key={entry.id} className="hover:bg-gray-900 rounded px-2 py-1">
                <span className="text-gray-600 mr-2">
                  {entry.timestamp.toLocaleTimeString()}
                </span>
                <span className={`font-semibold ${getEventColor(entry.event)} mr-2`}>
                  {entry.event}
                </span>
                <span className="text-gray-500">{entry.payload}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Logs
