// @ts-nocheck
/// <reference types="jest" />
import { spawn } from 'child_process';
import path from 'path';
import jwt from 'jsonwebtoken';

jest.setTimeout(60000);

function startNsNode(port = 4100, gatewayUrls: string[] = []) {
  const serverPath = path.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
  const env = { ...process.env, PORT: port.toString(), GATEWAY_URLS: gatewayUrls.join(',') } as any;
  const detached = process.platform !== 'win32';
  const child = spawn('node', [serverPath], { env, stdio: ['ignore', 'pipe', 'pipe'], detached });
  child.stdout?.on('data', (d) => console.log(`[ns-node ${port}] ${d.toString().trim()}`));
  child.stderr?.on('data', (d) => console.error(`[ns-node ${port} ERR] ${d.toString().trim()}`));
  if (detached) child.unref?.();
  return child;
}

function startGateway(port = 4300, nsUrl?: string) {
  const serverPath = path.resolve(__dirname, '..', '..', 'neuroswarm', 'gateway-node', 'server.js');
  const env = { ...process.env, PORT: port.toString() } as any;
  if (nsUrl) env.NS_NODE_URL = nsUrl;
  const detached = process.platform !== 'win32';
  const child = spawn('node', [serverPath], { env, stdio: ['ignore', 'pipe', 'pipe'], detached });
  child.stdout?.on('data', (d) => console.log(`[gateway ${port}] ${d.toString().trim()}`));
  child.stderr?.on('data', (d) => console.error(`[gateway ${port} ERR] ${d.toString().trim()}`));
  if (detached) child.unref?.();
  return child;
}

async function waitForOutput(proc: any, match: string | RegExp, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const onStdout = (d: any) => {
      const s = d.toString();
      if (typeof match === 'string' ? s.includes(match) : match.test(s)) {
        cleanup();
        return resolve(true);
      }
    };
    const onStderr = (d: any) => {
      stderr += d.toString();
      console.error('[child stderr] ', d.toString().trim());
    };
    const onExit = (code: number, signal: string) => {
      cleanup();
      return reject(new Error(`Process exited before expected output: code=${code} signal=${signal} stderr=${stderr}`));
    };
    const onError = (err: Error) => {
      cleanup();
      return reject(new Error(`Process error before expected output: ${err.message} stderr=${stderr}`));
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Process did not output '${String(match)}' within ${timeoutMs}ms; stderr=${stderr}`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      try { proc.stdout.removeListener('data', onStdout); } catch(e) {}
      try { proc.stderr.removeListener('data', onStderr); } catch(e) {}
      try { proc.removeListener('exit', onExit); } catch(e) {}
      try { proc.removeListener('error', onError); } catch(e) {}
    }

    proc.stdout.on('data', onStdout);
    proc.stderr.on('data', onStderr);
    proc.on('exit', onExit);
    proc.on('error', onError);
  });
}

async function fetchJson(url: string, opts?: any) {
  const res = await fetch(url, opts);
  return res.json();
}

async function killChild(child?: any, timeoutMs = 5000) {
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
      try { child.removeListener('exit', onExit); } catch(e) {}
      try { child.stdout?.destroy?.(); } catch(e) {}
      try { child.stderr?.destroy?.(); } catch(e) {}
      try { if ((child as any).stdin) (child as any).stdin.end?.(); } catch(e) {}
    };
    const timeout = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch(e) {}
      onExit();
    }, timeoutMs);
    child.on('exit', () => {
      clearTimeout(timeout);
      onExit();
    });
    // try to gracefully kill
    try {
      if (child.pid) {
        if (process.platform !== 'win32') {
          try { process.kill(-child.pid, 'SIGTERM'); } catch (e) { /* ignore */ }
        } else {
          // On Windows, use taskkill to ensure entire process tree is terminated
          try {
            const tk = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F']);
            tk.on('exit', () => {});
          } catch(e) { /* ignore */ }
          try { child.kill('SIGTERM'); } catch (e) { /* ignore */ }
        }
      }
    } catch(e) {
      clearTimeout(timeout);
      onExit();
    }
  });
}

test('ns-node publishes to multiple gateways and fails over', async () => {
  const gw1Port = 4301;
  const gw2Port = 4302;
  const nsPort = 4101;

  const gateways = [`http://localhost:${gw1Port}`, `http://localhost:${gw2Port}`];
  const ns = startNsNode(nsPort, gateways);
  await waitForOutput(ns, `ns-node local server started`);

  const gw1 = startGateway(gw1Port, `http://localhost:${nsPort}`);
  await waitForOutput(gw1, `Gateway node listening`);
  const gw2 = startGateway(gw2Port, `http://localhost:${nsPort}`);
  await waitForOutput(gw2, `Gateway node listening`);

  try {
    const token = jwt.sign({ username: 'test' }, 'test-secret');
    // send chat, should publish to primary gw1
    const forwardedFor = '1.2.3.4';
    const forwardedUser = 'test-user';
    const correlationId = 'cid-' + Math.random().toString(36).slice(2, 9);
    const res = await fetchJson(`http://localhost:${nsPort}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Forwarded-For': forwardedFor, 'X-Forwarded-User': forwardedUser, 'X-Correlation-Id': correlationId }, body: JSON.stringify({ sender: 'test', content: 'hello gw1' }) });
    expect(res.cid).toBeTruthy();

    // check gw1 recorded message and forwarded headers
    const last1 = await fetchJson(`http://localhost:${gw1Port}/debug/last-message`);
    expect(last1.last).toBeTruthy();
    expect(last1.last.headers.authorization).toContain('Bearer');
    expect(last1.last.headers['x-forwarded-for']).toBe(forwardedFor);
    expect(last1.last.headers['x-forwarded-user']).toBe(forwardedUser);
    expect(last1.last.headers['x-correlation-id']).toBe(correlationId);
    expect(last1.last.headers?.authorization).toContain('Bearer');

    // check ns-node gateway status reflects that gw1 is reachable
    const gstatus = await fetchJson(`http://localhost:${nsPort}/debug/gateways`);
    console.log('Gateways status after first publish:', JSON.stringify(gstatus, null, 2));
    const gw1status = gstatus.gateways.find((g) => g.url.includes(`:${gw1Port}`));
    const gw2status = gstatus.gateways.find((g) => g.url.includes(`:${gw2Port}`));
    expect(gw1status.reachable).toBe(true);

    // kill gw1 to simulate failure
    await killChild(gw1);

    // send new message; ns-node should attempt gw1, fail, and publish to gw2
    const correlationId2 = 'cid-' + Math.random().toString(36).slice(2, 9);
    const res2 = await fetchJson(`http://localhost:${nsPort}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Forwarded-For': forwardedFor, 'X-Forwarded-User': forwardedUser, 'X-Correlation-Id': correlationId2 }, body: JSON.stringify({ sender: 'test', content: 'hello gw2' }) });
    expect(res2.cid).toBeTruthy();

    // check gw2 recorded message
    const last2 = await fetchJson(`http://localhost:${gw2Port}/debug/last-message`);
    expect(last2.last).toBeTruthy();
    expect(last2.last.headers.authorization).toContain('Bearer');
    expect(last2.last.headers['x-forwarded-for']).toBe(forwardedFor);
    expect(last2.last.headers['x-forwarded-user']).toBe(forwardedUser);
    expect(last2.last.headers['x-correlation-id']).toBe(correlationId2);
    expect(last2.last.headers?.authorization).toContain('Bearer');

    // check ns-node gateway status now reflects gw1 unreachable and gw2 reachable
    const gstatus2 = await fetchJson(`http://localhost:${nsPort}/debug/gateways`);
    console.log('Gateways status after failover publish:', JSON.stringify(gstatus2, null, 2));
    const gw1status2 = gstatus2.gateways.find((g) => g.url.includes(`:${gw1Port}`));
    const gw2status2 = gstatus2.gateways.find((g) => g.url.includes(`:${gw2Port}`));
    expect(gw1status2.reachable).toBe(false);
    expect(gw2status2.reachable).toBe(true);
    expect(last2.last.direction).toBe('out');

  } finally {
    await killChild(ns);
    await killChild(gw1);
    await killChild(gw2);
  }
});
