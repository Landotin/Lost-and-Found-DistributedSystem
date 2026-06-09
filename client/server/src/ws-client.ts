import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { getPendingSyncItems, getPersonById, markItemSynced } from './database.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface WsMessage {
  event: string;
  payload: unknown;
}

interface NodeInfo {
  socketId: string;
  deptName: string;
}

interface SyncQueueItem {
  id: string;
  item_name: string;
  description?: string;
  category?: string;
  department_origin: string;
  status: string;
  surrendered_by?: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Heartbeat / connection config
// ---------------------------------------------------------------------------

const HEARTBEAT_INTERVAL_MS = 15_000;   // Send ping every 15s
const HEARTBEAT_TIMEOUT_MS = 25_000;    // Disconnect if no ACK within 25s
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

// ---------------------------------------------------------------------------
// WebSocket Client Manager
// ---------------------------------------------------------------------------

export class WsClientManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private deptName: string;
  private deptSecret: string;
  private serverUrl: string;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private _nodeList: NodeInfo[] = [];

  constructor(deptName: string, deptSecret: string, serverUrl: string) {
    super();
    this.deptName = deptName;
    this.deptSecret = deptSecret;
    this.serverUrl = serverUrl;
  }

  get connectionStatus(): ConnectionStatus {
    return this.status;
  }

  get nodeList(): NodeInfo[] {
    return this._nodeList;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  connect(): void {
    if (this.ws) {
      this.ws.close();
    }
    this.setStatus('connecting');
    this.reconnectAttempts = 0;

    try {
      const socket = new WebSocket(this.serverUrl);
      this.ws = socket;

      socket.onopen = () => {
        // Send HELLO immediately
        this.send('HELLO', {
          dept_name: this.deptName,
          dept_secret: this.deptSecret,
        });
      };

      socket.onmessage = (event: WebSocket.MessageEvent) => {
        try {
          const msg: WsMessage = JSON.parse(event.data.toString());
          this.handleMessage(msg);
        } catch {
          console.error('[WS-Client] Failed to parse message:', event.data);
        }
      };

      socket.onclose = () => {
        this.handleDisconnect();
      };

      socket.onerror = (err: WebSocket.ErrorEvent) => {
        console.error('[WS-Client] Socket error:', err.message || 'Unknown error');
      };
    } catch (err) {
      console.error('[WS-Client] Connection error:', err);
      this.handleDisconnect();
    }
  }

  disconnect(): void {
    this.clearTimers();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  send(event: string, payload: unknown): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, payload }));
      return true;
    }
    return false;
  }

  // -----------------------------------------------------------------------
  // Message handling
  // -----------------------------------------------------------------------

  private handleMessage(msg: WsMessage): void {
    const eventHandlers: Record<string, (payload: any) => void> = {
      NODE_LIST: (payload) => {
        this._nodeList = (payload as { nodes: NodeInfo[] }).nodes ?? [];
        this.emit('node_list', this._nodeList);
      },
      ACK: () => {
        this.resetHeartbeatTimeout();
      },
      HEARTBEAT: () => {
        this.send('ACK', {});
      },
      SYNC_DUMP: (payload) => {
        this.emit('sync_dump', payload);
      },
      ITEM_BROADCAST: (payload) => {
        this.emit('item_broadcast', payload);
      },
      STATUS_UPDATE: (payload) => {
        this.emit('status_update', payload);
      },
    };

    // HELLO response marks the connection as authenticated
    if (msg.event === 'HELLO') {
      const payload = msg.payload as { accepted: boolean; reason?: string };
      if (payload.accepted) {
        console.log('[WS-Client] HELLO accepted by hub');
        this.setStatus('connected');
        this.startHeartbeat();
        this.reconnectAttempts = 0;
        this.emit('authenticated');
      } else {
        console.error('[WS-Client] HELLO rejected:', payload.reason ?? 'Unknown reason');
        this.emit('hello_rejected', payload.reason);
        this.handleDisconnect();
      }
      return;
    }

    const handler = eventHandlers[msg.event];
    if (handler) {
      handler(msg.payload);
    } else {
      console.log('[WS-Client] Unhandled event:', msg.event);
    }
  }

  // -----------------------------------------------------------------------
  // Heartbeat
  // -----------------------------------------------------------------------

  private startHeartbeat(): void {
    this.clearTimers();
    this.heartbeatInterval = setInterval(() => {
      this.send('HEARTBEAT', {});
      // Set a timeout for the ACK response, unless one is already pending
      if (!this.heartbeatTimeout) {
        this.heartbeatTimeout = setTimeout(() => {
          console.warn('[WS-Client] Heartbeat ACK timeout — reconnecting');
          this.handleDisconnect();
        }, HEARTBEAT_TIMEOUT_MS);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private clearTimers(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.resetHeartbeatTimeout();
  }

  // -----------------------------------------------------------------------
  // Reconnection / Disconnect
  // -----------------------------------------------------------------------

  private handleDisconnect(): void {
    this.clearTimers();
    this.ws = null;
    this.setStatus('disconnected');

    this.emit('disconnected');

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempts - 1),
      RECONNECT_MAX_MS
    );

    console.log(`[WS-Client] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  // -----------------------------------------------------------------------
  // Sync queue flush
  // -----------------------------------------------------------------------

  async flushSyncQueue(): Promise<void> {
    if (this.status !== 'connected') return;

    const pending = await getPendingSyncItems();
    if (pending.length === 0) return;

    // For each pending item, fetch the full surrenderer person details
    const batch = await Promise.all(
      pending.map(async (item) => {
        let surrenderedByPerson = null;
        if (item.surrendered_by) {
          surrenderedByPerson = await getPersonById(item.surrendered_by);
        }
        return {
          id: item.id,
          item_name: item.item_name,
          description: item.description,
          category: item.category,
          department_origin: item.department_origin,
          status: item.status,
          surrendered_by: surrenderedByPerson, // full person object or null
          created_at: item.created_at,
        };
      })
    );

    this.send('SYNC_QUEUE_FLUSH', { items: batch });

    for (const item of pending) {
      await markItemSynced(item.id);
    }

    console.log(`[WS-Client] Flushed ${pending.length} item(s) to hub`);
    this.emit('sync_flushed', pending.length);
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private setStatus(s: ConnectionStatus): void {
    if (this.status !== s) {
      this.status = s;
      this.emit('status_change', s);
    }
  }
}
