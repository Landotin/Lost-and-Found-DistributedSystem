import { useEffect, useRef, useCallback, useState } from 'react'

export type WsEvent = {
  event: string
  payload: Record<string, unknown>
}

export type WsState = 'connecting' | 'connected' | 'disconnected'

type UseAdminWsOptions = {
  hubWsUrl?: string
  adminSecret?: string
  onEvent?: (event: WsEvent) => void
}

const DEFAULT_WS_URL = 'ws://localhost:5000'

/**
 * Hook that connects to the Hub WebSocket as an ADMIN client.
 *
 * Sends `{ event: "HELLO", payload: { type: "ADMIN", secret: "<secret>" } }`
 * on connect, then listens for real-time events.
 */
export function useAdminWs(options: UseAdminWsOptions = {}) {
  const {
    hubWsUrl = import.meta.env.VITE_HUB_WS_URL ?? DEFAULT_WS_URL,
    adminSecret = import.meta.env.VITE_ADMIN_SECRET ?? '',
    onEvent,
  } = options

  const wsRef = useRef<WebSocket | null>(null)
  const [state, setState] = useState<WsState>('disconnected')
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setState('connecting')
    const ws = new WebSocket(hubWsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      // Authenticate as ADMIN
      ws.send(JSON.stringify({
        event: 'HELLO',
        payload: { type: 'ADMIN', secret: adminSecret },
      }))
      setState('connected')
    }

    ws.onmessage = (msg) => {
      try {
        const event: WsEvent = JSON.parse(msg.data.toString())
        onEvent?.(event)
      } catch {
        // Ignore malformed messages
      }
    }

    ws.onclose = () => {
      if (wsRef.current === ws) {
        setState('disconnected')
        // Schedule reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, 3000)
      }
    }

    ws.onerror = () => {
      // onclose will fire after onerror, so we handle disconnect there
    }
  }, [hubWsUrl, adminSecret, onEvent])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
    // Only run connect on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { state }
}
