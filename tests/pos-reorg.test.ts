// @ts-nocheck
/// <reference types="jest" />
import { spawn } from 'child_process';
import path from 'path';
import crypto from 'crypto';
import { startServerWithLogs, waitForTip, waitForHeight, killChild } from './utils/testHelpers';

function canonicalize(obj) {
  if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
}

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

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

jest.setTimeout(120000);

function startNsNode(port = 4200) {
  const serverPath = path.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
  const env = { ...process.env, PORT: port.toString() } as any;
  const { child, logFile, errFile } = startServerWithLogs(serverPath, env, `ns-${port}`);
  return { child, logFile, errFile };
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  return res.json();
}

test('POS Reorg: accept fork and reorg to heavier chain; SPV proof remains valid for canonical txs', async () => {
  const nsPort = 4301;
  const { child: ns } = startNsNode(nsPort);
  const started = await waitForHeight(nsPort, 0, 30000);
  expect(started).toBeTruthy();

  // create two validators with different stakes (valA lower, valB higher)
  const { publicKey: pubA, privateKey: privA } = crypto.generateKeyPairSync('ed25519');
  const { publicKey: pubB, privateKey: privB } = crypto.generateKeyPairSync('ed25519');
  const pubA_pem = pubA.export({ type: 'spki', format: 'pem' });
  const privA_pem = privA.export({ type: 'pkcs8', format: 'pem' });
  const pubB_pem = pubB.export({ type: 'spki', format: 'pem' });
  const privB_pem = privB.export({ type: 'pkcs8', format: 'pem' });

  // register validators
  await fetchJson(`http://localhost:${nsPort}/validators/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validatorId: 'A', stake: 10, publicKey: pubA_pem }) });
  await fetchJson(`http://localhost:${nsPort}/validators/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validatorId: 'B', stake: 25, publicKey: pubB_pem }) });

  // fetch validators & verify
  const vs = await fetchJson(`http://localhost:${nsPort}/validators`);
  expect(vs.totalStake).toBe(35);

  const genesisPrev = '0'.repeat(64);
  // helper to find a slot that chooses a particular validator for a given prevHash
  async function findSlotForValidator(prevHash, targetId, start = 1, max = 100) {
    for (let s = start; s < max; s++) {
      const seed = sha256Hex(Buffer.from(String(prevHash) + String(s), 'utf8'));
      const seedNum = parseInt(seed.slice(0, 12), 16);
      const r = seedNum % vs.totalStake;
      let acc = 0;
      for (const v of vs.validators) {
        acc += Number(v.stake || 0);
        if (r < acc) {
          if (v.validatorId === targetId) return s;
          break;
        }
      }
    }
    return null;
  }

  // produce a block for prevHash with given slot and validator keys, txs
  async function produceBlock(prevHash, slot, validatorId, privKeyPem, txs = []) {
    const txIds = txs.map(tx => {
      const copy = { ...tx };
      delete copy.signature;
      return sha256Hex(Buffer.from(canonicalize(copy), 'utf8'));
    });
    const merkleRoot = computeMerkleRoot(txIds);
    const header = { validatorId, prevHash, merkleRoot };
    const sig = crypto.sign(null, Buffer.from(canonicalize({ ...header, signature: undefined }), 'utf8'), { key: privKeyPem });
    const signature = Buffer.from(sig).toString('base64');
    const res = await fetchJson(`http://localhost:${nsPort}/blocks/produce`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header, txs, signature }) });
    return res;
  }

  // slot for genesis children is parentHeight+1 = 1
  const slotA = 1;
  // include a tx in A's block
  const txA = { type: 'chat', fee: 1, content: 'txA', signedBy: 'A', signature: '' };
  // sign tx
  txA.signature = crypto.sign(null, Buffer.from(canonicalize({ ...txA, signature: undefined }), 'utf8'), privA).toString('base64');
  const resA = await produceBlock(genesisPrev, slotA, 'A', privA_pem, [txA]);
  expect(resA.ok).toBeTruthy();
  const aHash = resA.blockHash;

  const ok1 = await waitForTip(nsPort, aHash, 30000);
  expect(ok1).toBeTruthy();

  const slotB = 1;
  // include a tx in B's block
  const txB = { type: 'chat', fee: 1, content: 'txB', signedBy: 'B', signature: '' };
  txB.signature = crypto.sign(null, Buffer.from(canonicalize({ ...txB, signature: undefined }), 'utf8'), privB).toString('base64');
  const resB = await produceBlock(genesisPrev, slotB, 'B', privB_pem, [txB]);
  expect(resB.ok).toBeTruthy();
  const bHash = resB.blockHash;

  const ok2 = await waitForTip(nsPort, bHash, 30000);
  const latest2 = await fetchJson(`http://localhost:${nsPort}/blocks/latest`);
  // since B had greater stake, canonical should now be B's block (reorg happened)
  expect(latest2.block.blockHash).toBe(bHash);

  // SPV: verify txB proof
  const proofB = await fetchJson(`http://localhost:${nsPort}/proof/${sha256Hex(Buffer.from(canonicalize({ ...txB, signature: undefined }), 'utf8'))}`);
  expect(proofB).toHaveProperty('proof');
  const verifyB = await fetchJson(`http://localhost:${nsPort}/verify/proof`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ txId: sha256Hex(Buffer.from(canonicalize({ ...txB, signature: undefined }), 'utf8')), proof: proofB.proof, blockHeader: proofB.blockHeader }) });
  expect(verifyB.ok).toBe(true);

  // txA should not be canonical after reorg; request proof should 404
  const txAId = sha256Hex(Buffer.from(canonicalize({ ...txA, signature: undefined }), 'utf8'));
  const checkA = await fetch(`http://localhost:${nsPort}/proof/${txAId}`);
  expect(checkA.status).toBe(404);

  // cleanup
  await killChild(ns);
});
