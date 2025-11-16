import path from 'path';
import { startServerWithLogs, waitForCondition, killChild, waitForHeight } from './utils/testHelpers';

jest.setTimeout(120000);

let gwChild: any = null;
let nsChild: any = null;

afterEach(async () => {
  if (gwChild) {
    await killChild(gwChild);
    gwChild = null;
  }
  if (nsChild) {
    await killChild(nsChild);
    nsChild = null;
  }
});

test('gateway startup: starts before ns-node and detects ns when it comes online', async () => {
  // Start gateway first
  const { child: gw } = startServerWithLogs(path.resolve(__dirname, '..', '..', 'neuroswarm', 'gateway-node', 'server.js'), { NS_NODE_URL: 'http://localhost:3000', NS_CHECK_EXIT_ON_FAIL: 'false', PORT: '8080' }, 'gw-test');
  gwChild = gw;
  // Wait for gateway health
  const gwHealth = await waitForCondition(async () => {
    try {
      const res = await fetch('http://localhost:8080/health');
      return res.ok;
    } catch (e) {
      return false;
    }
  }, 10000, 200);
  expect(gwHealth).toBeTruthy();

  // initially gateway should not see ns
  const gwNoNs = await waitForCondition(async () => {
    try {
      const res = await fetch('http://localhost:8080/debug/peers');
      if (!res.ok) return false;
      const j = await res.json();
      return j && (!j.peers || j.peers.nsOk === false);
    } catch (e) { return true; }
  }, 2000, 200);
  expect(gwNoNs).toBeTruthy();

  // start ns now
  const { child: ns } = startServerWithLogs(path.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js'), { PORT: '3000' }, 'ns-test');
  nsChild = ns;
  const nsReady = await waitForHeight(3000, 0, 10000);
  expect(nsReady).toBeTruthy();

  // Wait for gateway to detect ns via debug/peers nsOk true
  const gwSeesNs = await waitForCondition(async () => {
    try {
      const res = await fetch('http://localhost:8080/debug/peers');
      if (!res.ok) return false;
      const j = await res.json();
      return j && j.peers && j.peers.nsOk === true;
    } catch (e) { return false; }
  }, 10000, 200);
  expect(gwSeesNs).toBeTruthy();

  // Try to submit a tx to gateway and verify it's forwarded to ns
  const tx = { type: 'chat', fee: 1, content: 'test forward' };
  const res = await fetch('http://localhost:8080/v1/tx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tx) });
  const j = await res.json();
  expect(res.ok).toBeTruthy();

  // Check ns mempool has tx
  const z = await (await fetch('http://localhost:3000/v1/mempool')).json();
  expect(Array.isArray(z.mempool) && z.mempool.length > 0).toBeTruthy();
});
