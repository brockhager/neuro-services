import { startServerWithLogs, waitForCondition, killChild } from './utils/testHelpers';
import { execSync } from 'child_process';

test('gateway tolerates ns-node startup order and connects after ns-node starts', async () => {
  const nsPort = 35201;
  const gwPort = 35202;
  const nsPath = require('path').resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
  const gwPath = require('path').resolve(__dirname, '..', '..', 'neuroswarm', 'gateway-node', 'server.js');
  // Ensure dependencies are installed (workspace or local) so spawned servers can start
  try {
    execSync('pnpm -w install', { stdio: 'pipe' });
  } catch (e) {
    try { execSync('npm install', { cwd: require('path').resolve(__dirname, '..', '..', 'neuroswarm', 'gateway-node'), stdio: 'pipe' }); } catch (ex) {}
    try { execSync('npm install', { cwd: require('path').resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node'), stdio: 'pipe' }); } catch (ex) {}
  }
  const { child: gwChild } = startServerWithLogs(gwPath, { PORT: gwPort, NS_NODE_URL: `http://localhost:${nsPort}`, NS_CHECK_RETRIES: 10, NS_CHECK_INITIAL_DELAY_MS: 100, NS_CHECK_MAX_DELAY_MS: 1000, NS_CHECK_EXIT_ON_FAIL: 'false' }, `gw-${gwPort}`);
  try {
    // gateway should start and be healthy despite NS not being available yet
    const gwOk = await waitForCondition(async () => {
      try { const r = await fetch(`http://localhost:${gwPort}/health`); return r.ok; } catch (e) { return false; }
    }, 10000, 200);
    expect(gwOk).toBe(true);
    // NS not yet running, ensure debug/peers shows nsNode configured but not reachable
    const nsNotOk = await waitForCondition(async () => {
      try { const r = await fetch(`http://localhost:${gwPort}/debug/peers`); if (!r.ok) return false; const j: any = await r.json(); return j.peers && j.peers.nsOk === false; } catch (e) { return false; }
    }, 30000, 200);
    expect(nsNotOk).toBe(true);
    // Now start ns-node
    const { child: nsChild } = startServerWithLogs(nsPath, { PORT: nsPort }, `ns-${nsPort}`);
    try {
      const nsOk = await waitForCondition(async () => {
        try { const r = await fetch(`http://localhost:${nsPort}/health`); return r.ok; } catch (e) { return false; }
      }, 10000, 200);
      expect(nsOk).toBe(true);
      // gateway should detect ns become reachable
      const gwDetectsNs = await waitForCondition(async () => {
        try { const r = await fetch(`http://localhost:${gwPort}/debug/peers`); if (!r.ok) return false; const j: any = await r.json(); return j.peers && j.peers.nsOk === true; } catch (e) { return false; }
      }, 10000, 200);
      expect(gwDetectsNs).toBe(true);
      // Now post a tx to gateway and verify ns mempool gets it
      const tx = { type: 'connectivity-startup-test', fee: 1, body: 'connectivity-check' };
      const post = await fetch(`http://localhost:${gwPort}/v1/tx`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tx) });
      expect(post.ok).toBe(true);
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
    }
  } finally {
    await killChild(gwChild);
  }
}, 60000);
