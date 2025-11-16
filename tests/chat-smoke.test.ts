import { spawn } from 'child_process';
import path from 'path';

jest.setTimeout(30000);

function startNsNode(port = 4001) {
  const serverPath = path.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
  const env = { ...process.env, PORT: port.toString() } as any;
  const child = spawn('node', [serverPath], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  return child;
}

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

  try {
    const res = await fetch(`http://localhost:${port}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: 'test', content: 'hello' })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('cid');
    expect(body).toHaveProperty('txSignature');
    expect(body.content).toContain('Echoing: hello');
  } finally {
    child.kill();
  }
});
