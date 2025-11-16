// @ts-nocheck
/// <reference types="jest" />
import path from 'path';
import crypto from 'crypto';
import { startServerWithLogs, waitForTip, waitForHeight, killChild, waitForCondition } from './utils/testHelpers';

function canonicalize(obj) {
  if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
}

function sha256Hex(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function computeMerkleRoot(txIds) {
  if (!txIds || txIds.length === 0) return sha256Hex('');
  let layer = txIds.map(id => Buffer.from(id, 'hex'));
  while (layer.length > 1) {
    if (layer.length % 2 === 1) layer.push(layer[layer.length - 1]);
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      const a = layer[i];
      const b = layer[i + 1];
      const hash = sha256Hex(Buffer.concat([a, b]));
      next.push(Buffer.from(hash, 'hex'));
    }
    layer = next;
  }
  return layer[0].toString('hex');
}

jest.setTimeout(180000);

async function fetchJson(url, opts) { const res = await fetch(url, opts); return res.json(); }

// Helper to produce blocks as a specific validator using the produce endpoint
async function produceBlock(nsPort, validatorId, privKey, prevHash, txs = []) {
  const txIds = txs.map(tx => sha256Hex(Buffer.from(canonicalize({ ...tx, signature: undefined }), 'utf8')));
  const merkleRoot = computeMerkleRoot(txIds);
  const header = { validatorId, prevHash, merkleRoot };
  const signature = Buffer.from(crypto.sign(null, Buffer.from(canonicalize({ ...header, signature: undefined }), 'utf8'), privKey)).toString('base64');
  const res = await fetch(`http://localhost:${nsPort}/blocks/produce`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header, txs, signature }) });
  return res.json();
}

test('long-range fork: deeper branch overtakes canonical after multiple blocks', async () => {
  const nsPort = 4360;
  const { child: ns } = startServerWithLogs(path.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js'), { PORT: nsPort }, `ns-${nsPort}`);
  const started = await waitForHeight(nsPort, 0, 5000);
  expect(started).toBeTruthy();

  const { publicKey: pubA, privateKey: privA } = crypto.generateKeyPairSync('ed25519');
  const { publicKey: pubB, privateKey: privB } = crypto.generateKeyPairSync('ed25519');
  const pubA_pem = pubA.export({ type: 'spki', format: 'pem' });
  const privA_pem = privA.export({ type: 'pkcs8', format: 'pem' });
  const pubB_pem = pubB.export({ type: 'spki', format: 'pem' });
  const privB_pem = privB.export({ type: 'pkcs8', format: 'pem' });

  await fetch(`http://localhost:${nsPort}/validators/register`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ validatorId: 'A', stake: 10, publicKey: pubA_pem }) });
  await fetch(`http://localhost:${nsPort}/validators/register`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ validatorId: 'B', stake: 10, publicKey: pubB_pem }) });

  const genesis = '0'.repeat(64);
  // A produces initial block with a tx
  const txA = { type: 'chat', fee: 1, content: 'A-run', signedBy: 'A' };
  const sigA = Buffer.from(crypto.sign(null, Buffer.from(canonicalize({ ...txA, signature: undefined }), 'utf8'), privA)).toString('base64');
  txA.signature = sigA;
  const resA1 = await produceBlock(nsPort, 'A', privA_pem, genesis, [txA]);
  expect(resA1.ok).toBeTruthy();
  const tipA1 = resA1.blockHash;
  const tipA_ok = await waitForTip(nsPort, tipA1, 5000);
  expect(tipA_ok).toBeTruthy();

  // B creates a chain of 5 blocks, each incrementally increasing its stake via reward
  let prev = genesis;
  let lastB = null;
  for (let i = 1; i <= 5; i++) {
    const tx = { type: 'chat', fee: 1, content: `B-${i}`, signedBy: 'B' };
    tx.signature = Buffer.from(crypto.sign(null, Buffer.from(canonicalize({ ...tx, signature: undefined }), 'utf8'), privB)).toString('base64');
    const rb = await produceBlock(nsPort, 'B', privB_pem, prev, [tx]);
    expect(rb.ok).toBeTruthy();
    lastB = rb.blockHash;
    prev = lastB;
  }

  // After B's extended chain, it should overtake the canonical tip of A
  const overtook = await waitForTip(nsPort, lastB, 15000);
  expect(overtook).toBeTruthy();

  // Verify that any tx previously in A's block is now not provable
  const txAId = sha256Hex(Buffer.from(canonicalize({ ...txA, signature: undefined }), 'utf8'));
  const proofRes = await fetch(`http://localhost:${nsPort}/proof/${txAId}`);
  expect(proofRes.status).toBe(404);

  // Mempool has the rolled-back txs (if any)
  const mem = await fetchJson(`http://localhost:${nsPort}/mempool`);
  // txA should be present again
  const found = mem.mempool.find((m) => m.id === txAId);
  expect(found).toBeTruthy();

  await killChild(ns);
});
