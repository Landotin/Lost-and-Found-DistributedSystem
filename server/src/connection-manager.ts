import crypto from 'node:crypto';
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

export class ConnectionManager {
  private nodes: Map<string, ConnectedNode> = new Map();
  private wss: WebSocketServer;
  private validSecret: string;

  constructor(wss: WebSocketServer, validSecret: string) {
    this.wss = wss;
    this.validSecret = validSecret;
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

    let helloReceived = false;

    socket.on('message', (data: Buffer) => {
      if (helloReceived) return;
      helloReceived = true;

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

      manager.registerNode(socket, payload.dept_name);
      manager.broadcastNodeList();
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
