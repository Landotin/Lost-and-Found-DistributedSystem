import crypto from 'node:crypto';
import { WebSocket } from 'ws';
export class ConnectionManager {
    nodes = new Map();
    constructor(_wss, _validSecret) {
        // _wss and _validSecret reserved for future use (admin broadcast, re-auth)
    }
    getConnectedNodes() {
        return Array.from(this.nodes.values());
    }
    getNodeCount() {
        return this.nodes.size;
    }
    registerNode(socket, deptName) {
        const socketId = crypto.randomUUID();
        const connectedAt = new Date().toISOString();
        const node = {
            socketId,
            deptName,
            connectedAt,
            socket,
        };
        // Store socketId on the socket for retrieval in close/error handlers
        socket.__socketId = socketId;
        this.nodes.set(socketId, node);
        return node;
    }
    removeNode(socketId) {
        this.nodes.delete(socketId);
    }
    broadcastNodeList() {
        const nodes = this.getConnectedNodes().map((n) => ({
            dept_name: n.deptName,
            socket_id: n.socketId,
            connected_at: n.connectedAt,
        }));
        const message = {
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
export function handleConnection(wss, manager, validSecret) {
    wss.on('connection', (socket) => {
        let timeoutId = setTimeout(() => {
            socket.close(4002, 'Timeout waiting for HELLO');
        }, 5000);
        let helloReceived = false;
        socket.on('message', (data) => {
            if (helloReceived)
                return;
            helloReceived = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            let parsed;
            try {
                parsed = JSON.parse(data.toString());
            }
            catch {
                socket.close(4002, 'Invalid JSON');
                return;
            }
            if (parsed.event !== 'HELLO') {
                socket.close(4002, 'Expected HELLO as first message');
                return;
            }
            const payload = parsed.payload;
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
            const socketId = socket.__socketId;
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
            const socketId = socket.__socketId;
            if (socketId) {
                manager.removeNode(socketId);
                manager.broadcastNodeList();
            }
        });
    });
}
