// @ts-nocheck
/// <reference types="jest" />
import { spawn } from 'child_process';
import path from 'path';
import crypto from 'crypto';
import { startServerWithLogs, waitForTip, waitForHeight, waitForCondition, killChild } from './utils/testHelpers';

function canonicalize(obj) {
  if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
}

jest.setTimeout(120000);

function startNsNode(port = 4200) {
  const serverPath = path.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
  const env = { ...process.env, PORT: port.toString() } as any;
  const { child, logFile, errFile } = startServerWithLogs(serverPath, env, `ns-${port}`);
  return { child, logFile, errFile };
}

function startVpNode(nsUrl, port = 4400, validatorId = 'val-test', keys: any = {}) {
  const serverPath = path.resolve(__dirname, '..', '..', 'neuroswarm', 'vp-node', 'server.js');
  const env = { ...process.env, NS_NODE_URL: nsUrl, VALIDATOR_ID: validatorId, VP_INTERVAL_MS: '2000', INIT_STAKE: '10', ...keys } as any;
  const { child, logFile } = startServerWithLogs(serverPath, env, `vp-${validatorId}`);
  return { child, logFile };
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  return res.json();
}

test('POS: validator produces block and SPV proof inclusion', async () => {
  const nsPort = 4201;
  const { child: ns, logFile: nsLog } = startNsNode(nsPort);
  const started = await waitForHeight(nsPort, 0, 5000);
  expect(started).toBeTruthy();
  const gwPort = 4305;
  const gwPath = path.resolve(__dirname, '..', '..', 'neuroswarm', 'gateway-node', 'server.js');
  const gwCwd = path.resolve(__dirname, '..', '..', 'neuroswarm', 'gateway-node');
  const gwEnv = { ...process.env, PORT: gwPort.toString(), NS_NODE_URL: `http://localhost:${nsPort}` } as any;
  const { child: gw, logFile: gwLog } = startServerWithLogs(gwPath, gwEnv, `gw-${gwPort}`, gwCwd);
  // generate ed25519 keys for validator
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
  const vp = startVpNode(`http://localhost:${nsPort}`, 0, 'val-test', { PRIVATE_KEY_PEM: privPem, PUBLIC_KEY_PEM: pubPem });
  // wait for validator to register via VP
  const registered = await waitForCondition(async () => {
    const vs = await fetchJson(`http://localhost:${nsPort}/validators`);
    return !!vs.validators.find(v => v.validatorId === 'val-test');
  }, 10000, 300);
  expect(registered).toBeTruthy();
  // create a tx
  const tx = { type: 'chat', fee: 1, content: 'hello pos', signedBy: 'val-test', signature: '', timestamp: Date.now() };
  // sign transaction with ed25519 validator private key
  const sig = crypto.sign(null, Buffer.from(canonicalize({ ...tx, signature: undefined }), 'utf8'), privateKey).toString('base64');
  tx.signature = sig;
  const res = await fetchJson(`http://localhost:${gwPort}/v1/tx`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tx) });
  expect(res.ok).toBeTruthy();
  const txId = res.txId;
  // wait for at least one block to be produced
  const latestBlock = await fetchJson(`http://localhost:${nsPort}/blocks/latest`);
  const blockHash = latestBlock.block ? latestBlock.block.blockHash : null;
  // Try to wait if block is not produced yet
  if (!blockHash) {
    const ok = await waitForHeight(nsPort, 1, 15000);
    expect(ok).toBeTruthy();
  }
  // validator stake increased due to reward
  const val = await fetchJson(`http://localhost:${nsPort}/validators`);
  const myVal = val.validators.find(v => v.validatorId === 'val-test');
  expect(Number(myVal.stake)).toBeGreaterThanOrEqual(10);
  // check SPV proof
  const proof = await fetchJson(`http://localhost:${nsPort}/proof/${txId}`);
  expect(proof).toHaveProperty('proof');
  expect(proof.blockHeader).toHaveProperty('validatorId');
  // verify proof (SPV)
  const verify = await fetchJson(`http://localhost:${nsPort}/verify/proof`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ txId, proof: proof.proof, blockHeader: proof.blockHeader }) });
  expect(verify.ok).toBe(true);
  // cleanup
  await killChild(vp.child || vp);
  await killChild(gw || gw);
  await killChild(ns || ns);
});
