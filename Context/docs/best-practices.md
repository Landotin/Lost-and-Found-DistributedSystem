# Development Best Practices & API References (`Context/docs/best-practices.md`)

This document aggregates the official best practices, connection patterns, and database instructions for the RDLFT project stack. All AI agents must write code conforming to these structures.

---

## 1. Express & WebSockets (`ws`) Integration

### A. Sharing the Same HTTP Port
Do not call `app.listen()` directly on the Express app. Instead, bind the Express app to a native Node.js HTTP server and attach the `ws` server to it. This allows WebSocket handshakes and HTTP requests to share a single port.

```javascript
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const port = process.env.PORT || 5000;

// 1. Create native HTTP server wrapping the Express application
const server = http.createServer(app);

// 2. Attach WebSocket server to the HTTP server
const wss = new WebSocketServer({ server });

// 3. Handle WebSocket Events
wss.on('connection', (ws, req) => {
  console.log(`Node connected from: ${req.socket.remoteAddress}`);
  
  ws.on('message', (message) => {
    // Process message
  });
});

// 4. Bind the HTTP server to the port
server.listen(port, () => {
  console.log(`Unified Server running on port ${port}`);
});
```

### B. Zombie Connection Pruning (Heartbeat)
Implement protocol-level Ping/Pong frames (rather than custom JSON messages) to detect dead connections and garbage collect them.

```javascript
// Server-side Heartbeat setup
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('Terminating unresponsive socket');
      return ws.terminate(); // Instantly frees socket file descriptor
    }
    
    ws.isAlive = false;
    ws.ping(); // Send native ping frame
  });
}, HEARTBEAT_INTERVAL);

wss.on('connection', (ws) => {
  ws.isAlive = true;
  
  ws.on('pong', () => {
    ws.isAlive = true; // Connection is confirmed active
  });
});

wss.on('close', () => {
  clearInterval(interval);
});
```

---

## 2. SQLite Async Operations & Concurrency

To guarantee local database performance and prevent SQLite locking exceptions (`SQLITE_BUSY` errors), configure:
1.  **Write-Ahead Logging (WAL) Mode** for concurrently reading and writing without blocking.
2.  **Async/Await Query Wrapper** utilizing parameterized queries to avoid SQL Injection.

### A. Initialization & WAL Mode Configuration
```javascript
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

async function initializeDatabase(dbPath) {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable WAL mode for concurrency handling
  await db.exec('PRAGMA journal_mode = WAL;');
  
  // Set foreign keys verification
  await db.exec('PRAGMA foreign_keys = ON;');
  
  return db;
}
```

### B. Parameterized SQL Query Pattern
```javascript
// Insert Item Example
async function saveItem(db, item) {
  const query = `
    INSERT INTO items (id, item_name, description, category, department_origin, status, surrendered_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  await db.run(query, [
    item.id,
    item.item_name,
    item.description,
    item.category,
    item.department_origin,
    item.status,
    item.surrendered_by
  ]);
}

---

## 3. React + Vite + TypeScript Best Practices

### A. TypeScript Type Definitions for WebSocket Events
To maintain type safety across both frontend and backend messages, define the socket payloads strictly. Do not use type `any`.

```typescript
export type WsEventName = 
  | 'HELLO' 
  | 'SYNC_DUMP' 
  | 'ITEM_BROADCAST' 
  | 'STATUS_UPDATE' 
  | 'SYNC_QUEUE_FLUSH' 
  | 'NODE_LIST' 
  | 'HEARTBEAT';

export interface WsMessage<T = unknown> {
  event: WsEventName;
  payload: T;
}

export interface HelloPayload {
  deptName: string;
  deptSecret: string;
}

export interface ItemPayload {
  id: string;
  item_name: string;
  description: string;
  category: string;
  department_origin: string;
  status: 'lost' | 'found' | 'claimed';
  surrendered_by: string; // Person ID
  updated_at: string;
}
```

### B. Encapsulating WebSocket State in Custom Hooks
Avoid placing raw WebSockets inside components. Create a custom hook `useWebSocket` that manages connection state, event handlers, and cleanups automatically.

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import { WsMessage } from '../types';

export function useWebSocket(url: string) {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    setStatus('connecting');
    setError(null);
    
    const socket = new WebSocket(url);
    wsRef.current = socket;

    socket.onopen = () => {
      setStatus('connected');
    };

    socket.onclose = () => {
      setStatus('disconnected');
      // Exponential backoff reconnect retry
      setTimeout(connect, 5000);
    };

    socket.onerror = (errEvent) => {
      setError('Connection failed');
      setStatus('disconnected');
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((msg: WsMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { status, error, sendMessage };
}
```

---

## 4. Tailwind CSS LED & State Styling

Ensure visual elements dynamically indicate connection states without relying on boring text. Use Tailwind's utility animation classes for modern indicators.

```tsx
import React from 'react';

interface LedgerLEDProps {
  status: 'connected' | 'disconnected' | 'connecting';
  pendingCount?: number;
}

export const LedgerLED: React.FC<LedgerLEDProps> = ({ status, pendingCount = 0 }) => {
  const stateColor = 
    status === 'connected' ? 'bg-green-500' :
    status === 'connecting' ? 'bg-amber-500 animate-pulse' :
    'bg-red-500';

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800">
      <div className="relative flex h-3.5 w-3.5">
        {status === 'connected' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        )}
        <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${stateColor}`}></span>
      </div>
      <div className="flex flex-col text-xs font-semibold">
        <span className="text-gray-300 capitalize">{status}</span>
        {status === 'disconnected' && pendingCount > 0 && (
          <span className="text-amber-400 text-[10px]">{pendingCount} pending sync</span>
        )}
      </div>
    </div>
  );
};
```

---

## 5. Docker & Compose Orchestration Best Practices

### A. Healthchecks for SQLite Databases & APIs
Ensure standard Healthcheck tests are defined in both `Dockerfile` and `docker-compose.yml` configurations so dependant services wait until databases and websockets are ready.

```yaml
# docker-compose.yml service snippet
services:
  central_server:
    build:
      context: ./server
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  dept_ccs:
    build:
      context: ./client
      dockerfile: Dockerfile
    ports:
      - "5001:3000"
    depends_on:
      central_server:
        condition: service_healthy
```

```
