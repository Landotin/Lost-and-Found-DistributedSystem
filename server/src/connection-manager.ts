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

  constructor(_wss: WebSocketServer, _validSecret: string) {
    super();
    // _wss and _validSecret reserved for future use (admin broadcast, re-auth)
  }

  getConnectedNodes(): ConnectedNode[] {
    return Array.from(this.nodes.values());
  }

  getNodeCount(): number {
    return this.nodes.size;
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

  /**
   * Send a WebSocket message to all connected department nodes
   * except the one identified by senderSocketId.
   */
  broadcastToOthers(senderSocketId: string, event: string, payload: unknown): void {
    const data = JSON.stringify({ event, payload } satisfies WsMessage);

    for (const [id, node] of this.nodes) {
      if (id !== senderSocketId && node.socket.readyState === WebSocket.OPEN) {
        node.socket.send(data);
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

      const payload = parsed.payload as HelloPayload | undefined;

      if (!payload || !payload.dept_secret || payload.dept_secret !== validSecret) {
        socket.close(4001, 'Invalid department secret');
        return;
      }

      if (!payload.dept_name || payload.dept_name.trim() === '') {
        socket.close(4001, 'Department name required');
        return;
      }

      const node = manager.registerNode(socket, payload.dept_name);

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
        manager.broadcastNodeList();
      }
    });
  });
}
