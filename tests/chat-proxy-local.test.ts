import express from 'express';
// use global fetch available in Node 18+
import jwt from 'jsonwebtoken';
import { spawn } from 'child_process';
import path from 'path';

jest.setTimeout(30000);

function startNsNode(port = 4002) {
  const serverPath = path.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
  const env = { ...process.env, PORT: port.toString() } as any;
  const child = spawn('node', [serverPath], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  return child;
}

test('gateway proxy mock preserves Authorization header', async () => {
  const port = 4002;
  const child = startNsNode(port);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('ns-node did not start fast enough')), 10000);
    child.stdout.on('data', (d: any) => {
      const s = d.toString();
      if (s.includes('ns-node local server started')) {
        clearTimeout(timeout);
        resolve(true);
      }
    });
    child.stderr.on('data', (d: any) => console.error(d.toString()));
    child.on('error', (err) => reject(err));
  });

  // start a light-weight gateway proxy (not the real neuro-services)
  const app = express();
  app.use(express.json());
  const gwPort = 5002;
  app.post('/v1/chat', (req, res) => {
    const authHeader = req.header('authorization');
    const forwardRes = fetch(`http://localhost:${port}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader as string },
      body: JSON.stringify(req.body)
    }).then((r: any) => r.json()).then((body: any) => res.json(body)).catch((e: any) => res.status(502).json({ error: 'forward failed', detail: e.message }));
  });
  const srv = app.listen(gwPort);

  try {
    const token = jwt.sign({ username: 'test' }, 'test-secret');
    const res = await fetch(`http://localhost:${gwPort}/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sender: 'test', content: 'hello' })
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body).toHaveProperty('cid');
    expect(body).toHaveProperty('txSignature');

    // verify forwarded header at ns-node
    const debug = await fetch(`http://localhost:${port}/debug/last-headers`);
    const dbg: any = await debug.json();
    expect(dbg.lastHeaders).toBeTruthy();
    expect(dbg.lastHeaders.authorization).toContain(token);
  } finally {
    if (child) {
      child.kill();
      (child as any).stdin?.end();
      child.stdout?.destroy();
      child.stderr?.destroy();
    }
    if (srv) srv.close();
  }
});
