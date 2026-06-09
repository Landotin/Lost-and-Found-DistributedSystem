import { spawn, execSync, type ChildProcess } from 'child_process';
import path from 'path';
import http from 'http';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ServerConfig {
  projectRoot: string;
  hubPort?: number;
  nodeAPort?: number;
  nodeBPort?: number;
  adminSecret?: string;
  dataDir?: string;
}

export interface TestServers {
  hub: ChildProcess;
  nodeA: ChildProcess;
  nodeB: ChildProcess;
  hubPort: number;
  nodeAPort: number;
  nodeBPort: number;
  adminSecret: string;
  hubUrl: string;
  nodeAUrl: string;
  nodeBUrl: string;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(3000, () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
  });
}

export async function waitForUrl(url: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { status } = await httpGet(url);
      if (status >= 200 && status < 400) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timeout waiting for ${url} after ${timeoutMs}ms`);
}

export async function waitForNodeConnected(nodeUrl: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { body } = await httpGet(`${nodeUrl}/api/status`);
      if (body.includes('"connected":true')) return;
    } catch {
      // not ready
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timeout waiting for node at ${nodeUrl} to connect`);
}

export async function waitForNodeDisconnected(nodeUrl: string, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { body } = await httpGet(`${nodeUrl}/api/status`);
      if (body.includes('"connected":false')) return;
    } catch {
      // node may be down — that's fine
      return;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timeout waiting for node at ${nodeUrl} to disconnect`);
}

export async function waitForPendingCount(nodeUrl: string, expectedCount: number, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { body } = await httpGet(`${nodeUrl}/api/pending`);
      const match = body.match(/"count":(\d+)/);
      if (match && parseInt(match[1]) === expectedCount) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timeout waiting for pending count ${expectedCount} at ${nodeUrl}`);
}

// ---------------------------------------------------------------------------
// Spawn helper
// ---------------------------------------------------------------------------

function spawnServer(
  name: string,
  entryFile: string,
  options: { cwd: string; env: Record<string, string | undefined> }
): ChildProcess {
  // Use npx tsx to run TypeScript directly (no shell — args stay separate)
  const tsxPath = path.join(options.cwd, 'node_modules', '.bin', 'tsx');
  const proc = spawn(tsxPath, [entryFile], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  proc.stdout?.on('data', (d: Buffer) => {
    const line = d.toString().trim();
    if (line) console.log(`  [${name}] ${line}`);
  });
  proc.stderr?.on('data', (d: Buffer) => {
    const line = d.toString().trim();
    if (line && !line.includes('ExperimentalWarning') && !line.includes('Deprecation')) {
      console.error(`  [${name}:ERR] ${line}`);
    }
  });

  return proc;
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

export async function startServers(config?: Partial<ServerConfig>): Promise<TestServers> {
  const projectRoot = config?.projectRoot ?? path.resolve(import.meta.dirname ?? __dirname, '..', '..');
  const hubPort = config?.hubPort ?? 5000;
  const nodeAPort = config?.nodeAPort ?? 3001;
  const nodeBPort = config?.nodeBPort ?? 3002;
  const adminSecret = config?.adminSecret ?? 'e2e-test-secret';
  const dataDir = config?.dataDir ?? path.resolve(import.meta.dirname ?? __dirname, '..', 'test-data');

  // Ensure clean data directory
  if (fs.existsSync(dataDir)) {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  fs.mkdirSync(dataDir, { recursive: true });

  // Also clean hub's default data directory
  const hubDataDir = path.join(projectRoot, 'server', 'data');
  if (fs.existsSync(hubDataDir)) {
    fs.rmSync(hubDataDir, { recursive: true, force: true });
  }

  // --- Start Hub ---
  console.log(`\n[E2E] Starting Hub on port ${hubPort}...`);
  const hub = spawnServer('Hub', 'src/index.ts', {
    cwd: path.join(projectRoot, 'server'),
    env: {
      PORT: String(hubPort),
      ADMIN_SECRET: adminSecret,
    },
  });
  await waitForUrl(`http://localhost:${hubPort}/health`);
  console.log(`  [E2E] Hub ready`);

  // --- Start Node A (Security) ---
  console.log(`\n[E2E] Starting Node A (Security) on port ${nodeAPort}...`);
  const nodeA = spawnServer('NodeA', 'src/index.ts', {
    cwd: path.join(projectRoot, 'client', 'server'),
    env: {
      PORT: String(nodeAPort),
      DEPT_NAME: 'Security',
      DEPT_SECRET: adminSecret,
      SERVER_WS_URL: `ws://localhost:${hubPort}`,
      NODE_ENV: 'production',
      DB_PATH: path.join(dataDir, 'node-a.db'),
    },
  });

  // --- Start Node B (Engineering) ---
  console.log(`[E2E] Starting Node B (Engineering) on port ${nodeBPort}...`);
  const nodeB = spawnServer('NodeB', 'src/index.ts', {
    cwd: path.join(projectRoot, 'client', 'server'),
    env: {
      PORT: String(nodeBPort),
      DEPT_NAME: 'Engineering',
      DEPT_SECRET: adminSecret,
      SERVER_WS_URL: `ws://localhost:${hubPort}`,
      NODE_ENV: 'production',
      DB_PATH: path.join(dataDir, 'node-b.db'),
    },
  });

  // Wait for node API servers
  await waitForUrl(`http://localhost:${nodeAPort}/api/status`);
  await waitForUrl(`http://localhost:${nodeBPort}/api/status`);
  console.log(`  [E2E] Node web servers ready`);

  // Wait for WebSocket connections
  await Promise.all([
    waitForNodeConnected(`http://localhost:${nodeAPort}`),
    waitForNodeConnected(`http://localhost:${nodeBPort}`),
  ]);
  console.log(`  [E2E] Both nodes connected to hub`);

  return {
    hub, nodeA, nodeB,
    hubPort, nodeAPort, nodeBPort, adminSecret,
    hubUrl: `http://localhost:${hubPort}`,
    nodeAUrl: `http://localhost:${nodeAPort}`,
    nodeBUrl: `http://localhost:${nodeBPort}`,
  };
}

export async function stopServers(servers: TestServers): Promise<void> {
  console.log(`\n[E2E] Stopping servers...`);

  const allProcs: Array<{ name: string; proc: ChildProcess }> = [
    { name: 'NodeB', proc: servers.nodeB },
    { name: 'NodeA', proc: servers.nodeA },
    { name: 'Hub', proc: servers.hub },
  ];

  for (const { name, proc } of allProcs) {
    try {
      proc.kill('SIGTERM');
    } catch { /* ok */ }
  }

  await new Promise((r) => setTimeout(r, 2000));

  for (const { name, proc } of allProcs) {
    try {
      proc.kill('SIGKILL');
    } catch { /* ok */ }
  }

  console.log(`  [E2E] All servers stopped`);
}

export async function restartHub(servers: TestServers): Promise<void> {
  const projectRoot = path.resolve(import.meta.dirname ?? __dirname, '..', '..');
  const adminSecret = servers.adminSecret;
  const hubPort = servers.hubPort;

  console.log(`\n[E2E] Restarting Hub on port ${hubPort}...`);

  // Kill old hub
  try {
    servers.hub.kill('SIGTERM');
  } catch { /* ok */ }
  await new Promise((r) => setTimeout(r, 2000));
  try {
    servers.hub.kill('SIGKILL');
  } catch { /* ok */ }

  // Start new hub
  const hub = spawnServer('Hub', 'src/index.ts', {
    cwd: path.join(projectRoot, 'server'),
    env: {
      PORT: String(hubPort),
      ADMIN_SECRET: adminSecret,
    },
  });

  await waitForUrl(`http://localhost:${hubPort}/health`);
  console.log(`  [E2E] Hub restarted`);
  servers.hub = hub;
}
