import { spawn } from 'child_process';
import path from 'path';
import jwt from 'jsonwebtoken';

jest.setTimeout(30000);

function startNsNode(port = 4001) {
  const serverPath = path.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
  const env = { ...process.env, PORT: port.toString() } as any;
  const child = spawn('node', [serverPath], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  return child;
}

// We test gateway proxy behavior in a separate proxy-local test since building the full gateway can fail in CI.

test('ns-node responds with provenance fields', async () => {
  const port = 4001;
  const child = startNsNode(port);

  // wait for server to start by listening to stdout
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('ns-node did not start fast enough'));
    }, 10000);
    child.stdout.on('data', (d) => {
      const s = d.toString();
      if (s.includes(`ns-node local server started`)) {
        clearTimeout(timeout);
        resolve(true);
      }
    });
    child.stderr.on('data', (d) => console.error(d.toString()));
    child.on('error', (err) => reject(err));
  });

  // No gateway in this smoke test; test ns-node directly for provenance and header capture.

  try {
    // Create a JWT to pass authenticate middleware in gateway
    const token = jwt.sign({ username: 'test' }, 'test-secret');

    const res = await fetch(`http://localhost:${port}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ sender: 'test', content: 'hello' })
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body).toHaveProperty('cid');
    expect(body).toHaveProperty('txSignature');
    expect(body.content).toContain('Echoing: hello');
    // verify the auth header was preserved and visible via the debug endpoint
    const debug = await fetch(`http://localhost:${port}/debug/last-headers`);
    const dbg: any = await debug.json();
    expect(dbg.lastHeaders).toBeTruthy();
    expect(dbg.lastHeaders.authorization).toContain(token);
  } finally {
    if (child) {
      try {
        child.kill();
        (child as any).stdin?.end?.();
        child.stdout?.destroy?.();
        child.stderr?.destroy?.();
      } catch {}
    }
  }
});
