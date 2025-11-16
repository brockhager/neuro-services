// @ts-nocheck
/// <reference types="jest" />
import { spawn } from 'child_process';
import path from 'path';
import jwt from 'jsonwebtoken';

jest.setTimeout(60000);

function startNsNode(port = 4100, gatewayUrls: string[] = []) {
  const serverPath = path.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
  const env = { ...process.env, PORT: port.toString(), GATEWAY_URLS: gatewayUrls.join(',') } as any;
  const child = spawn('node', [serverPath], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  return child;
}

function startGateway(port = 4300) {
  const serverPath = path.resolve(__dirname, '..', '..', 'neuroswarm', 'gateway-node', 'server.js');
  const env = { ...process.env, PORT: port.toString() } as any;
  const child = spawn('node', [serverPath], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  return child;
}

async function waitForOutput(proc: any, match: string | RegExp, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Process did not start')), timeoutMs);
    proc.stdout.on('data', (d: any) => {
      const s = d.toString();
      if (typeof match === 'string' ? s.includes(match) : match.test(s)) {
        clearTimeout(timeout);
        resolve(true);
      }
    });
    proc.stderr.on('data', (d: any) => {
      // console.error('proc err', d.toString());
    });
  });
}

async function fetchJson(url: string, opts?: any) {
  const res = await fetch(url, opts);
  return res.json();
}

async function killChild(child?: any) {
  if (!child) return;
  try {
    child.kill();
    if ((child as any).stdin) (child as any).stdin.end?.();
    child.stdout?.destroy?.();
    child.stderr?.destroy?.();
  } catch (e) {}
}

test('ns-node publishes to multiple gateways and fails over', async () => {
  const gw1Port = 4301;
  const gw2Port = 4302;
  const nsPort = 4101;

  const gw1 = startGateway(gw1Port);
  await waitForOutput(gw1, `Gateway node listening`);
  const gw2 = startGateway(gw2Port);
  await waitForOutput(gw2, `Gateway node listening`);

  const gateways = [`http://localhost:${gw1Port}`, `http://localhost:${gw2Port}`];
  const ns = startNsNode(nsPort, gateways);
  await waitForOutput(ns, `ns-node local server started`);

  try {
    const token = jwt.sign({ username: 'test' }, 'test-secret');
    // send chat, should publish to primary gw1
    const res = await fetchJson(`http://localhost:${nsPort}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ sender: 'test', content: 'hello gw1' }) });
    expect(res.cid).toBeTruthy();

    // check gw1 recorded message
    const last1 = await fetchJson(`http://localhost:${gw1Port}/debug/last-message`);
    expect(last1.last).toBeTruthy();
    expect(last1.last.headers?.authorization).toContain('Bearer');

    // check ns-node gateway status reflects that gw1 is reachable
    const gstatus = await fetchJson(`http://localhost:${nsPort}/debug/gateways`);
    const gw1status = gstatus.gateways.find((g) => g.url.includes(`:${gw1Port}`));
    const gw2status = gstatus.gateways.find((g) => g.url.includes(`:${gw2Port}`));
    expect(gw1status.reachable).toBe(true);

    // kill gw1 to simulate failure
    await killChild(gw1);

    // send new message; ns-node should attempt gw1, fail, and publish to gw2
    const res2 = await fetchJson(`http://localhost:${nsPort}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ sender: 'test', content: 'hello gw2' }) });
    expect(res2.cid).toBeTruthy();

    // check gw2 recorded message
    const last2 = await fetchJson(`http://localhost:${gw2Port}/debug/last-message`);
    expect(last2.last).toBeTruthy();
    expect(last2.last.headers?.authorization).toContain('Bearer');

    // check ns-node gateway status now reflects gw1 unreachable and gw2 reachable
    const gstatus2 = await fetchJson(`http://localhost:${nsPort}/debug/gateways`);
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
