import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { WebSocket, WebSocketServer } from 'ws';

export interface ConnectedNode {
  socketId: string;
  deptName: string;
  connectedAt: string;
  socket: WebSocket;
}

export interface HelloPayload {
  dept_name: string;
  dept_secret: string;
}

export interface NodeListPayload {
  nodes: Array<{
    dept_name: string;
    socket_id: string;
    connected_at: string;
  }>;
  count: number;
}

export interface WsMessage {
  event: string;
  payload?: unknown;
}

export class ConnectionManager extends EventEmitter {
  private nodes: Map<string, ConnectedNode> = new Map();
  /** Admin WebSocket connections that receive unredacted copies of all broadcasts */
  private adminNodes: Map<string, WebSocket> = new Map();

  constructor(_wss: WebSocketServer, _validSecret: string) {
    super();
    // _wss and _validSecret reserved for future use (admin broadcast, re-auth)
  }

  // ---------------------------------------------------------------------------
  // Department Nodes
  // ---------------------------------------------------------------------------

  getConnectedNodes(): ConnectedNode[] {
    return Array.from(this.nodes.values());
  }

  getNodeCount(): number {
    return this.nodes.size;
  }

  /** Lookup a single node by socketId. Returns undefined if not found. */
  getNode(socketId: string): ConnectedNode | undefined {
    return this.nodes.get(socketId);
  }

  registerNode(socket: WebSocket, deptName: string): ConnectedNode {
    const socketId = crypto.randomUUID();
    const connectedAt = new Date().toISOString();
    const node: ConnectedNode = {
      socketId,
      deptName,
      connectedAt,
      socket,
    };
    // Store socketId on the socket for retrieval in close/error handlers
    (socket as { __socketId?: string }).__socketId = socketId;
    this.nodes.set(socketId, node);
    return node;
  }

  removeNode(socketId: string): void {
    this.nodes.delete(socketId);
  }

  /** Close a node's WebSocket connection. Returns true if the node was found. */
  disconnectNode(socketId: string): boolean {
    const node = this.nodes.get(socketId);
    if (node && node.socket.readyState === WebSocket.OPEN) {
      node.socket.close(1000, 'Disconnected by admin');
      return true;
    }
    return false;
  }

  broadcastNodeList(): void {
    const nodes = this.getConnectedNodes().map((n) => ({
      dept_name: n.deptName,
      socket_id: n.socketId,
      connected_at: n.connectedAt,
    }));

    const message: WsMessage = {
      event: 'NODE_LIST',
      payload: {
        nodes,
        count: nodes.length,
      },
    };

    const data = JSON.stringify(message);

    for (const [, node] of this.nodes) {
      if (node.socket.readyState === WebSocket.OPEN) {
        node.socket.send(data);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Admin Nodes
  // ---------------------------------------------------------------------------

  /** Register a new admin WebSocket connection. Returns the assigned socketId. */
  addAdminNode(socket: WebSocket): string {
    const socketId = crypto.randomUUID();
    (socket as { __socketId?: string }).__socketId = socketId;
    this.adminNodes.set(socketId, socket);
    return socketId;
  }

  /** Remove an admin node from tracking. */
  removeAdminNode(socketId: string): void {
    this.adminNodes.delete(socketId);
  }

  /** Return the number of connected admin sockets. */
  getAdminNodeCount(): number {
    return this.adminNodes.size;
  }

  // ---------------------------------------------------------------------------
  // Broadcasting
  // ---------------------------------------------------------------------------

  /**
   * Send a WebSocket message to all connected department nodes
   * except the one identified by senderSocketId.
   * Redacts PII details (mobile, id_type, id_number) for unrelated department nodes.
   *
   * Also sends an unredacted copy of every event to all connected admin sockets
   * for the Message Log feature.
   */
  broadcastToOthers(
    senderSocketId: string,
    event: string,
    payload: any,
    deptOrigin?: string
  ): void {
    const redactPersonPII = (person: any) => {
      if (!person || typeof person !== 'object') return person;
      return {
        ...person,
        mobile: '[REDACTED]',
        id_type: '[REDACTED]',
        id_number: '[REDACTED]',
      };
    };

    for (const [id, node] of this.nodes) {
      if (id !== senderSocketId && node.socket.readyState === WebSocket.OPEN) {
        let relayedPayload = payload;

        // Check if the node is unrelated to the origin department
        const itemOrigin = deptOrigin || payload?.department_origin;
        const isSameDept = itemOrigin && node.deptName === itemOrigin;

        if (!isSameDept) {
          if (event === 'ITEM_BROADCAST') {
            relayedPayload = {
              ...payload,
              surrendered_by: redactPersonPII(payload.surrendered_by),
              claimed_by: redactPersonPII(payload.claimed_by),
              reported_by: redactPersonPII(payload.reported_by),
            };
          } else if (event === 'STATUS_UPDATE') {
            relayedPayload = {
              ...payload,
              claimed_by: redactPersonPII(payload.claimed_by),
              surrendered_by: redactPersonPII(payload.surrendered_by),
              reported_by: redactPersonPII(payload.reported_by),
            };
          }
        }

        const data = JSON.stringify({ event, payload: relayedPayload } satisfies WsMessage);
        node.socket.send(data);
      }
    }

    // Send unredacted copy to all connected admin sockets
    const adminData = JSON.stringify({ event, payload } satisfies WsMessage);
    for (const [, adminSocket] of this.adminNodes) {
      if (adminSocket.readyState === WebSocket.OPEN) {
        adminSocket.send(adminData);
      }
    }
  }
}

export function handleConnection(
  wss: WebSocketServer,
  manager: ConnectionManager,
  validSecret: string,
): void {
  wss.on('connection', (socket: WebSocket) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      socket.close(4002, 'Timeout waiting for HELLO');
    }, 5000);

    socket.once('message', (data: Buffer) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      let parsed: WsMessage;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        socket.close(4002, 'Invalid JSON');
        return;
      }

      if (parsed.event !== 'HELLO') {
        socket.close(4002, 'Expected HELLO as first message');
        return;
      }

      const payload = parsed.payload as Record<string, unknown> | undefined;

      // --- Admin HELLO ---
      if (payload?.type === 'ADMIN') {
        if (!payload.secret || payload.secret !== validSecret) {
          socket.close(4001, 'Invalid admin secret');
          return;
        }
        const socketId = manager.addAdminNode(socket);
        socket.send(JSON.stringify({
          event: 'HELLO',
          payload: { accepted: true, type: 'ADMIN' },
        }));
        return;
      }

      // --- Department Node HELLO ---
      const deptPayload = parsed.payload as HelloPayload | undefined;

      if (!deptPayload || !deptPayload.dept_secret || deptPayload.dept_secret !== validSecret) {
        socket.close(4001, 'Invalid department secret');
        return;
      }

      if (!deptPayload.dept_name || deptPayload.dept_name.trim() === '') {
        socket.close(4001, 'Department name required');
        return;
      }

      const node = manager.registerNode(socket, deptPayload.dept_name);

      // Reply with HELLO accepted
      socket.send(JSON.stringify({
        event: 'HELLO',
        payload: { accepted: true },
      }));

      manager.broadcastNodeList();

      // Emit registered event so the hub can send SYNC_DUMP
      manager.emit('registered', {
        socketId: node.socketId,
        deptName: node.deptName,
        socket,
      });

      // Setup persistent listener for subsequent messages
      socket.on('message', (postHelloData: Buffer) => {
        try {
          const postHelloParsed = JSON.parse(postHelloData.toString()) as WsMessage;
          if (postHelloParsed && typeof postHelloParsed === 'object' && typeof postHelloParsed.event === 'string') {
            manager.emit('message', { socketId: node.socketId, message: postHelloParsed });
          }
        } catch {
          // Ignore parsing errors for robust handling
        }
      });
    });

    socket.on('close', () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      const socketId = (socket as { __socketId?: string }).__socketId;
      if (socketId) {
        manager.removeNode(socketId);
        manager.removeAdminNode(socketId);
        manager.broadcastNodeList();
      }
    });

    socket.on('error', () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      const socketId = (socket as { __socketId?: string }).__socketId;
      if (socketId) {
        manager.removeNode(socketId);
        manager.removeAdminNode(socketId);
        manager.broadcastNodeList();
      }
    });
  });
}
