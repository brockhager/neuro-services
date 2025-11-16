import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import crypto from 'crypto';

export function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

export async function waitForTip(nsPort: number, expectedHash, timeout = 10000, interval = 200) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://localhost:${nsPort}/blocks/latest`);
      if (res.ok) {
        const j = await res.json();
        if (j.block && j.block.blockHash === expectedHash) return true;
      }
    } catch (e) {}
    await sleep(interval);
  }
  return false;
}

export async function waitForHeight(nsPort: number, expectedHeight, timeout = 10000, interval = 200) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://localhost:${nsPort}/chain/height`);
      if (res.ok) {
        const j = await res.json();
        if (j.height >= expectedHeight) return true;
      }
    } catch (e) {}
    await sleep(interval);
  }
  return false;
}

export async function waitForCondition(checkFn: () => Promise<boolean>, timeout = 10000, interval = 200) {
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

export function startServerWithLogs(serverPath: string, env = {}, tag = 'server', cwd?: string, args: string[] = []) {
  const logsDir = ensureLogsDir();
  const logFile = path.join(logsDir, `${tag}-${Date.now()}.log`);
  const errFile = path.join(logsDir, `${tag}-${Date.now()}.err`);
  const lf = fs.openSync(logFile, 'a');
  const ef = fs.openSync(errFile, 'a');
  const spawnArgs = [serverPath, ...args];
  const child = spawn('node', spawnArgs, { env: { ...process.env, ...env }, stdio: ['ignore', lf, ef], cwd: cwd || process.cwd(), detached: false });
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
  });
}

export function canonicalize(obj: any) {
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
