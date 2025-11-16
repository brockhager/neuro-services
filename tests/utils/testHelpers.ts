import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import crypto from 'crypto';

export function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

export async function waitForTip(nsPort: number, expectedHash: string, timeout = 30000, interval = 200): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://localhost:${nsPort}/blocks/latest`);
      if (res.ok) {
        const j: any = await res.json();
        if (j.block && j.block.blockHash === expectedHash) return true;
      }
    } catch (e) {}
    await sleep(interval);
  }
  return false;
}

export async function waitForHeight(nsPort: number, expectedHeight: number, timeout = 30000, interval = 200): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://localhost:${nsPort}/chain/height`);
      if (res.ok) {
        const j: any = await res.json();
        if (j.height >= expectedHeight) return true;
      }
    } catch (e) {}
    await sleep(interval);
  }
  return false;
}

export async function waitForCondition(checkFn: () => Promise<boolean>, timeout = 30000, interval = 200) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await checkFn()) return true;
    } catch (e) {}
    await sleep(interval);
  }
  return false;
}

export function ensureLogsDir() {
  const logsDir = path.join(process.cwd(), '..', 'neuroswarm', 'tmp', 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  return logsDir;
}

const _startedChildren: any[] = [];

export function startServerWithLogs(serverPath: string, env: any = {}, tag = 'server', cwd?: string, args: any[] = []) {
  const logsDir = ensureLogsDir();
  const logFile = path.join(logsDir, `${tag}-${Date.now()}.log`);
  const errFile = path.join(logsDir, `${tag}-${Date.now()}.err`);
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });
  const errStream = fs.createWriteStream(errFile, { flags: 'a' });
  // ensure args and spawnArgs are all strings to avoid child_process internal errors
  const safeArgs = (args || []).map(a => String(a));
  const spawnArgs = [String(serverPath), ...safeArgs];
  // use pipe stdio so we can manage streams and close them properly
  // ensure env values are strings
  const safeEnv = { ...process.env } as Record<string, string | undefined>;
  for (const [k, v] of Object.entries(env || {})) safeEnv[k] = v === undefined ? undefined : String(v);
  let child: any;
  try {
    child = spawn('node', spawnArgs, { env: safeEnv, stdio: ['ignore', 'pipe', 'pipe'], cwd: cwd || process.cwd(), detached: false });
  } catch (err) {
    // close streams and surface the error for debugging
    try { logStream.end(); } catch (e) {}
    try { errStream.end(); } catch (e) {}
    console.error('[testHelpers] spawn failed:', err && (err as any).message, { spawnArgs, safeEnvKeys: Object.keys(safeEnv), cwd: String(cwd || process.cwd()) });
    throw err;
  }
  // pipe child output to our write streams
  if (child.stdout) child.stdout.pipe(logStream);
  if (child.stderr) child.stderr.pipe(errStream);
  // attach streams so they can be closed during cleanup
  try { (child as any)._logStream = logStream; (child as any)._errStream = errStream; } catch (e) { /* ignore */ }
  // close streams when child exits
  child.on('exit', () => {
    try { logStream.end(); } catch (e) {}
    try { errStream.end(); } catch (e) {}
  });
  _startedChildren.push(child);
  return { child, logFile, errFile };
}

export async function killChild(child: any, timeoutMs = 5000) {
  if (!child) return;
  return new Promise((resolve) => {
    let finished = false;
    const onExit = () => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(true);
    };
    const cleanup = () => {
      try { child.removeListener('exit', onExit); } catch (e) {}
      try { child.stdout?.destroy?.(); } catch (e) {}
      try { child.stderr?.destroy?.(); } catch (e) {}
      try { if ((child as any).stdin) (child as any).stdin.end?.(); } catch (e) {}
      // close any write streams opened for logs if present
      try { const ls = (child as any)._logStream; if (ls && !ls.destroyed) ls.end(); } catch (e) {}
      try { const es = (child as any)._errStream; if (es && !es.destroyed) es.end(); } catch (e) {}
    };
    const timeout = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (e) { /* ignore */ }
      onExit();
    }, timeoutMs);
    child.on('exit', () => {
      clearTimeout(timeout);
      onExit();
    });
    try {
      if (child.pid) {
        if (process.platform !== 'win32') {
          try { process.kill(-child.pid, 'SIGTERM'); } catch (e) { /* ignore */ }
        } else {
          try { const tk = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F']); tk.on('exit', () => {}); } catch (e) {}
          try { child.kill('SIGTERM'); } catch (e) {}
        }
      }
    } catch (e) {
      clearTimeout(timeout);
      onExit();
    }
      // Ensure streams are closed even if kill didn't finish
      try { const ls = (child as any)._logStream; if (ls && !ls.destroyed) ls.end(); } catch (e) {}
      try { const es = (child as any)._errStream; if (es && !es.destroyed) es.end(); } catch (e) {}
  });
}

// global cleanup for any started children in case a test forgets to kill them
process.on('beforeExit', async () => {
  try {
    for (const c of _startedChildren) {
      try { await killChild(c, 2000); } catch (e) {}
    }
  } catch (e) { /* ignore */ }
});

export function canonicalize(obj: any): string {
  if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
}

export function txIdFor(tx: any) {
  const txCopy = { ...tx };
  delete txCopy.signature;
  return crypto.createHash('sha256').update(Buffer.from(canonicalize(txCopy), 'utf8')).digest('hex');
}
