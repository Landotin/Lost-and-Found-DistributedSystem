import { EventEmitter } from 'events';
import { WebSocket } from 'ws';

/**
 * Configuration for the heartbeat manager.
 */
export interface HeartbeatConfig {
  /** Ping interval in ms (default: 15000) */
  intervalMs: number;
  /** Time to wait for an ACK before considering it missed (default: 5000) */
  ackTimeoutMs: number;
  /** Consecutive missed ACKs before firing node_timeout (default: 2) */
  maxMissedAcks: number;
}

/**
 * Internal state tracked for each monitored node.
 */
interface NodeHeartbeat {
  socketId: string;
  /** Timestamp (ms) of the last HEARTBEAT sent */
  lastPingSent: number;
  /** Timestamp (ms) of the last ping that was acknowledged (or lastPingSent when miss counted) */
  lastPingAcked: number;
  /** Consecutive missed ACK count */
  missedAcks: number;
  /** The WebSocket connection */
  socket: WebSocket;
}

const DEFAULT_CONFIG: HeartbeatConfig = {
  intervalMs: 15000,
  ackTimeoutMs: 5000,
  maxMissedAcks: 2,
};

/**
 * Manages the HEARTBEAT/ACK lifecycle for connected nodes.
 *
 * Sends periodic HEARTBEAT pings to tracked WebSocket connections and
 * monitors for ACK responses. Emits a `'node_timeout'` event when a node
 * fails to respond within the configured tolerance.
 *
 * @event node_timeout - Emitted with `{ socketId: string }` when a node exceeds max missed ACKs.
 */
export class HeartbeatManager extends EventEmitter {
  private config: HeartbeatConfig;
  private heartbeats: Map<string, NodeHeartbeat> = new Map();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private checkTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<HeartbeatConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Begin tracking a node's WebSocket connection.
   */
  addNode(socketId: string, socket: WebSocket): void {
    this.heartbeats.set(socketId, {
      socketId,
      lastPingSent: 0,
      lastPingAcked: 0,
      missedAcks: 0,
      socket,
    });
  }

  /**
   * Stop tracking a node. Safe to call even if the node is not tracked.
   */
  removeNode(socketId: string): void {
    this.heartbeats.delete(socketId);
  }

  /**
   * Start the heartbeat interval timer.
   * Sends HEARTBEAT pings to all tracked nodes at the configured interval.
   * A separate check timer monitors for missed ACKs.
   */
  start(): void {
    if (this.pingTimer !== null) {
      return; // Already started
    }

    this.pingTimer = setInterval(() => this.sendPings(), this.config.intervalMs);
    // Check for timeouts at a higher frequency than the ping interval
    // to detect missed ACKs promptly after ackTimeoutMs elapses.
    this.checkTimer = setInterval(() => this.checkTimeouts(), this.config.ackTimeoutMs);
  }

  /**
   * Stop the heartbeat interval and the timeout checker.
   * Cleans up all timers. Safe to call even if already stopped.
   */
  stop(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.checkTimer !== null) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * Record an ACK for the given socket.
   * Resets the missed ACK counter and updates the last ping acknowledged.
   */
  handleAck(socketId: string): void {
    const node = this.heartbeats.get(socketId);
    if (!node) return;

    node.lastPingAcked = node.lastPingSent;
    node.missedAcks = 0;
  }

  /**
   * Send a HEARTBEAT ping to every tracked node.
   */
  private sendPings(): void {
    const timestamp = Date.now();

    for (const [, node] of this.heartbeats) {
      if (node.socket.readyState === WebSocket.OPEN) {
        node.socket.send(
          JSON.stringify({
            event: 'HEARTBEAT',
            payload: { timestamp },
          }),
        );
        node.lastPingSent = timestamp;
      }
    }
  }

  /**
   * Inspect all tracked nodes and increment missedAcks for any that
   * haven't ACKed within `ackTimeoutMs`. Emits `'node_timeout'` for
   * nodes that have exceeded `maxMissedAcks`.
   *
   * Uses `lastPingAcked` to ensure each missed ping is only counted once:
   * once a miss is registered, lastPingAcked is updated to match lastPingSent,
   * preventing double-counting for the same ping cycle.
   */
  private checkTimeouts(): void {
    const now = Date.now();

    for (const [, node] of this.heartbeats) {
      // Skip nodes that have never received a ping
      if (node.lastPingSent === 0) continue;

      // Skip if the most recent ping has already been ACKed or its miss counted
      if (node.lastPingSent <= node.lastPingAcked) continue;

      // Skip if the ACK timeout has not yet elapsed since last ping
      const elapsed = now - node.lastPingSent;
      if (elapsed <= this.config.ackTimeoutMs) continue;

      // This ping cycle's ACK was missed
      node.missedAcks += 1;
      // Mark the current ping as counted so we don't double-count
      node.lastPingAcked = node.lastPingSent;

      if (node.missedAcks >= this.config.maxMissedAcks) {
        this.emit('node_timeout', { socketId: node.socketId });
      }
    }
  }
}
