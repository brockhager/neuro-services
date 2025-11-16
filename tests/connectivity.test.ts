import { startServerWithLogs, waitForCondition, killChild } from './utils/testHelpers';

test('gateway forwards tx to ns-node and nodes are reachable', async () => {
  const nsPort = 35001; // high ports to avoid collisions
  const gwPort = 35002;
  const nsPath = require('path').resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
  const gwPath = require('path').resolve(__dirname, '..', '..', 'neuroswarm', 'gateway-node', 'server.js');
  const { child: nsChild } = startServerWithLogs(nsPath, { PORT: nsPort }, `ns-${nsPort}`);
  // Wait a short time for ns-node to start before launching gateway
  await waitForCondition(async () => {
    try { const r = await fetch(`http://localhost:${nsPort}/health`); return r.ok; } catch (e) { return false; }
  }, 10000, 200);
  const { child: gwChild } = startServerWithLogs(gwPath, { PORT: gwPort, NS_NODE_URL: `http://localhost:${nsPort}` }, `gw-${gwPort}`);
  try {
    // Wait until both health endpoints return ok
    const nsOk = await waitForCondition(async () => {
      try { const r = await fetch(`http://localhost:${nsPort}/health`); return r.ok; } catch (e) { return false; }
    }, 10000, 200);
    const gwOk = await waitForCondition(async () => {
      try { const r = await fetch(`http://localhost:${gwPort}/health`); return r.ok; } catch (e) { return false; }
    }, 10000, 200);
    expect(nsOk).toBe(true);
    expect(gwOk).toBe(true);
    // Send a tx to gateway and verify it is forwarded to ns-node mempool
    const tx = { type: 'connectivity-test', fee: 1, body: 'connectivity-check' };
    const post = await fetch(`http://localhost:${gwPort}/v1/tx`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tx) });
    expect(post.ok).toBe(true);
    // Wait until ns-node mempool contains our tx
    const okInMempool = await waitForCondition(async () => {
      try {
        const r = await fetch(`http://localhost:${nsPort}/mempool`);
        if (!r.ok) return false;
        const j: any = await r.json();
        return (j.mempool || []).some((e: any) => e.tx && e.tx.body === 'connectivity-check');
      } catch (e) { return false; }
    }, 30000, 200);
    expect(okInMempool).toBe(true);
  } finally {
    await killChild(nsChild);
    await killChild(gwChild);
  }
}, 30000);
