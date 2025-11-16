import { spawn } from 'child_process';
import path from 'path';
import jwt from 'jsonwebtoken';
import { startServerWithLogs, waitForHeight, killChild } from './utils/testHelpers';

jest.setTimeout(120000);

function startNsNode(port = 4010) {
  const serverPath = path.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
  const env = { ...process.env, PORT: port.toString() } as any;
  const { child } = startServerWithLogs(serverPath, env, `ns-${port}`);
  return child;
}

function startGateway(nsUrl: string, port = 5010) {
  const cwd = path.resolve(__dirname, '..', '..', 'neuro-services');
  const gatewayPath = path.resolve(cwd, 'dist', 'index.js');
  return spawn('node', [gatewayPath], { cwd, env: { ...process.env, NS_NODE_URL: nsUrl, PORT: port.toString(), JWT_SECRET: 'test-secret' }, stdio: ['ignore', 'pipe', 'pipe'] });
}

function startNeuroWeb(port = 3010) {
  const cwd = path.resolve(__dirname, '..', '..', 'neuro-web');
  return spawn('npm', ['run', 'start'], { cwd, env: { ...process.env, PORT: port.toString() }, stdio: ['ignore', 'pipe', 'pipe'], shell: true });
}

async function waitForOutput(process: any, match: RegExp, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timeout waiting for output')), timeoutMs);
    process.stdout.on('data', (d: any) => {
      const s = d.toString();
      if (match.test(s)) {
        clearTimeout(timeout);
        resolve();
      }
    });
    process.stderr.on('data', (d: any) => console.error(d.toString()));
  });
}

test('E2E: neuro-web -> gateway -> ns-node chat flow', async () => {
  const nsPort = 4010;
  const gwPort = 5010;
  const webPort = 3010;

  // Build gateway and neuro-web first
  const cwdGateway = path.resolve(__dirname, '..', '..', 'neuro-services');
  const buildGw = spawn('npm', ['run', 'build'], { cwd: cwdGateway, stdio: ['pipe', 'pipe', 'pipe'], shell: true });
  await new Promise((resolve, reject) => {
    buildGw.on('exit', (code) => code === 0 ? resolve(true) : reject(new Error('build gateway failed')));
  });

  const cwdWeb = path.resolve(__dirname, '..', '..', 'neuro-web');
  const buildWeb = spawn('npm', ['run', 'build'], { cwd: cwdWeb, stdio: ['pipe', 'pipe', 'pipe'], shell: true });
  await new Promise((resolve, reject) => {
    buildWeb.on('exit', (code) => code === 0 ? resolve(true) : reject(new Error('build web failed')));
  });

  const ns = startNsNode(nsPort);
  try {
    await waitForOutput(ns, /ns-node local server started/, 15000);
    const gateway = startGateway(`http://localhost:${nsPort}`, gwPort);
    await waitForOutput(gateway, /Neuro Services Gateway API listening on port/, 15000);
    const web = startNeuroWeb(webPort);
    await waitForOutput(web, /started server on/, 15000).catch(() => {}); // Next prints different messages

    // Wait for ns/gateway to be ready
    const started = await waitForHeight(nsPort, 0, 5000);
    expect(started).toBeTruthy();

    // Create token and call web -> it will attempt to call gateway under the hood, but for e2e we'll call gateway directly
    const token = jwt.sign({ username: 'e2e' }, 'test-secret');
    const res = await fetch(`http://localhost:${gwPort}/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ sender: 'e2e', content: 'hi from e2e' })
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body).toHaveProperty('cid');

    // check ns-node recorded header via debug
    const debug = await fetch(`http://localhost:${nsPort}/debug/last-headers`);
    const dbg: any = await debug.json();
    expect(dbg.lastHeaders.authorization).toContain('Bearer');

    // Cleanup
    if (web) { await killChild(web); }
    if (gateway) { await killChild(gateway); }
    if (ns) { await killChild(ns); }
  } catch (err) {
    if (ns) { await killChild(ns); }
    throw err;
  }
});
