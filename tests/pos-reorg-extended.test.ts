// @ts-nocheck
/// <reference types="jest" />
import { spawn } from 'child_process';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { startServerWithLogs, waitForTip, waitForHeight, txIdFor, sleep, killChild } from './utils/testHelpers';

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

jest.setTimeout(300000);

// use startServerWithLogs for starting tests; convenience wrapper
function startNsNode(port = 4200, tag = 'ns') {
  const serverPath = path.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
  const env = { ...process.env, PORT: port.toString() } as any;
  const { child, logFile, errFile } = startServerWithLogs(serverPath, env, `${tag}-${port}`);
  // attach a small stdout capture for real-time debug output in tests
  return { child, logFile, errFile };
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  return res.json();
}

// Utility to register a validator
async function registerValidator(nsPort, id, stake, pubPem) {
  await fetchJson(`http://localhost:${nsPort}/validators/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validatorId: id, stake, publicKey: pubPem }) });
}

// Produce a block by signing header and posting
async function produceBlock(nsPort, prevHash, validatorId, privKeyPem, txs = []) {
  const txIds = txs.map(tx => {
    const copy = { ...tx };
    delete copy.signature;
    return sha256Hex(Buffer.from(canonicalize(copy), 'utf8'));
  });
  const merkleRoot = computeMerkleRoot(txIds);
  const header = { validatorId, prevHash, merkleRoot };
  const sig = crypto.sign(null, Buffer.from(canonicalize({ ...header, signature: undefined }), 'utf8'), privKeyPem);
  const signature = Buffer.from(sig).toString('base64');
  const res = await fetchJson(`http://localhost:${nsPort}/blocks/produce`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header, txs, signature }) });
  return res;
}

test('multi-block fork: longer/heavier chain overtakes the canonical tip', async () => {
  const nsPort = 4320;
  const { child: ns, logFile: nsLog } = startNsNode(nsPort);
  const ok = await waitForHeight(nsPort, 0, 30000);
  expect(ok).toBeTruthy();

  // Validator A and B: B will attempt to overtake by producing more blocks
  const { publicKey: pubA, privateKey: privA } = crypto.generateKeyPairSync('ed25519');
  const { publicKey: pubB, privateKey: privB } = crypto.generateKeyPairSync('ed25519');
  const pubA_pem = pubA.export({ type: 'spki', format: 'pem' });
  const privA_pem = privA.export({ type: 'pkcs8', format: 'pem' });
  const pubB_pem = pubB.export({ type: 'spki', format: 'pem' });
  const privB_pem = privB.export({ type: 'pkcs8', format: 'pem' });

  await registerValidator(nsPort, 'A', 10, pubA_pem);
  await registerValidator(nsPort, 'B', 1, pubB_pem);
  // initial sanity
  const vs = await fetchJson(`http://localhost:${nsPort}/validators`);
  expect(vs.totalStake).toBe(11);

  const genesisPrev = '0'.repeat(64);
  // A creates block A1 referencing genesis; includes one tx
  const txA1 = { type: 'chat', fee: 1, content: 'A tx1', signedBy: 'A', signature: '' };
  txA1.signature = crypto.sign(null, Buffer.from(canonicalize({ ...txA1, signature: undefined }), 'utf8'), privA).toString('base64');
  const resA1 = await produceBlock(nsPort, genesisPrev, 'A', privA_pem, [txA1]);
  expect(resA1.ok).toBeTruthy();
  const a1 = resA1.blockHash;

  // Wait and ensure canonical tip is A1
  let ok1 = await waitForTip(nsPort, a1, 30000);
  expect(ok1).toBeTruthy();

  // B creates a fork starting at genesis and extends it by producing multiple blocks; B will increase stake and make chain heavier
  const txB1 = { type: 'chat', fee: 1, content: 'B tx1', signedBy: 'B', signature: '' };
  txB1.signature = crypto.sign(null, Buffer.from(canonicalize({ ...txB1, signature: undefined }), 'utf8'), privB).toString('base64');
  const resB1 = await produceBlock(nsPort, genesisPrev, 'B', privB_pem, [txB1]);
  expect(resB1.ok).toBeTruthy();
  const b1 = resB1.blockHash;

  // B extends B1 by producing two more blocks, each increases its stake via rewards and adds cumWeight
  const txB2 = { type: 'chat', fee: 1, content: 'B tx2', signedBy: 'B', signature: '' };
  txB2.signature = crypto.sign(null, Buffer.from(canonicalize({ ...txB2, signature: undefined }), 'utf8'), privB).toString('base64');
  const resB2 = await produceBlock(nsPort, b1, 'B', privB_pem, [txB2]);
  expect(resB2.ok).toBeTruthy();
  const b2 = resB2.blockHash;

  const txB3 = { type: 'chat', fee: 1, content: 'B tx3', signedBy: 'B', signature: '' };
  txB3.signature = crypto.sign(null, Buffer.from(canonicalize({ ...txB3, signature: undefined }), 'utf8'), privB).toString('base64');
  const resB3 = await produceBlock(nsPort, b2, 'B', privB_pem, [txB3]);
  expect(resB3.ok).toBeTruthy();
  const b3 = resB3.blockHash;

  // After B's chain grows heavier, canonical tip should be B3
  let ok2 = await waitForTip(nsPort, b3, 30000);
  expect(ok2).toBeTruthy();

  // cleanup
  await killChild(ns);
});

test('reorg & mempool re-application: txs from old canonical chain return to mempool or are re-applied', async () => {
  const nsPort = 4323;
  const { child: ns2 } = startNsNode(nsPort);
  const okStart = await waitForHeight(nsPort, 0, 30000);
  expect(okStart).toBeTruthy();

  // Setup validators
  const { publicKey: pubA, privateKey: privA } = crypto.generateKeyPairSync('ed25519');
  const { publicKey: pubB, privateKey: privB } = crypto.generateKeyPairSync('ed25519');
  const pubA_pem = pubA.export({ type: 'spki', format: 'pem' });
  const privA_pem = privA.export({ type: 'pkcs8', format: 'pem' });
  const pubB_pem = pubB.export({ type: 'spki', format: 'pem' });
  const privB_pem = privB.export({ type: 'pkcs8', format: 'pem' });
  await registerValidator(nsPort, 'A', 10, pubA_pem);
  await registerValidator(nsPort, 'B', 1, pubB_pem);

  const genesisPrev = '0'.repeat(64);
  // tx1 submitted to mempool
  const tx1 = { type: 'chat', fee: 1, content: 'mempool tx', signedBy: 'A', signature: '' };
  tx1.signature = crypto.sign(null, Buffer.from(canonicalize({ ...tx1, signature: undefined }), 'utf8'), privA).toString('base64');
  const resTx = await fetchJson(`http://localhost:${nsPort}/tx`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tx1) });
  expect(resTx.ok).toBeTruthy();
  const tx1Id = resTx.txId;

  // A produces a canonical block that includes tx1
  const resA1 = await produceBlock(nsPort, genesisPrev, 'A', privA_pem, [tx1]);
  expect(resA1.ok).toBeTruthy();
  const a1hash = resA1.blockHash;
  await waitForTip(nsPort, a1hash, 30000);
  // SPV proof should exist
  const proof = await fetchJson(`http://localhost:${nsPort}/proof/${tx1Id}`);
  expect(proof).toHaveProperty('proof');

  // Now B creates a heavier chain that does NOT include tx1, causing a reorg
  // B produces three blocks to overtake A
  const txB1 = { type: 'chat', fee: 1, content: 'B tx1', signedBy: 'B', signature: '' };
  txB1.signature = crypto.sign(null, Buffer.from(canonicalize({ ...txB1, signature: undefined }), 'utf8'), privB).toString('base64');
  const resB1 = await produceBlock(nsPort, genesisPrev, 'B', privB_pem, [txB1]);
  expect(resB1.ok).toBeTruthy();
  const b1 = resB1.blockHash;
  const txB2 = { type: 'chat', fee: 1, content: 'B tx2', signedBy: 'B', signature: '' };
  txB2.signature = crypto.sign(null, Buffer.from(canonicalize({ ...txB2, signature: undefined }), 'utf8'), privB).toString('base64');
  const resB2 = await produceBlock(nsPort, b1, 'B', privB_pem, [txB2]);
  expect(resB2.ok).toBeTruthy();
  const b2 = resB2.blockHash;
  const txB3 = { type: 'chat', fee: 1, content: 'B tx3', signedBy: 'B', signature: '' };
  txB3.signature = crypto.sign(null, Buffer.from(canonicalize({ ...txB3, signature: undefined }), 'utf8'), privB).toString('base64');
  const resB3 = await produceBlock(nsPort, b2, 'B', privB_pem, [txB3]);
  expect(resB3.ok).toBeTruthy();

  await waitForTip(nsPort, resB3.blockHash, 10000);
  // After reorg, tx1 should be off canonical chain and no longer have proof
  const proofCheck = await fetch(`http://localhost:${nsPort}/proof/${tx1Id}`);
  expect(proofCheck.status).toBe(404);
  // mempool should contain tx1 again
  const mem = await fetchJson(`http://localhost:${nsPort}/mempool`);
  const inMempool = mem.mempool.find(m => m.id === tx1Id);
  expect(inMempool).toBeTruthy();

  // cleanup
  await killChild(ns);
});

test('warning logged when non-selected validator produces block', async () => {
  const nsPort = 4330;
  const { child: nc, logFile, errFile } = startNsNode(nsPort, 'ns-warn');
  // give server a moment to start
  const okStartWarn = await waitForHeight(nsPort, 0, 30000);
  expect(okStartWarn).toBeTruthy();
  const { publicKey: pubA, privateKey: privA } = crypto.generateKeyPairSync('ed25519');
  const { publicKey: pubB, privateKey: privB } = crypto.generateKeyPairSync('ed25519');
  const pubA_pem = pubA.export({ type: 'spki', format: 'pem' });
  const privA_pem = privA.export({ type: 'pkcs8', format: 'pem' });
  const pubB_pem = pubB.export({ type: 'spki', format: 'pem' });
  const privB_pem = privB.export({ type: 'pkcs8', format: 'pem' });
  await registerValidator(nsPort, 'A', 10, pubA_pem);
  await registerValidator(nsPort, 'B', 10, pubB_pem);
  await sleep(200);
  const genesisPrev = '0'.repeat(64);
  // Suppose deterministic selection picks one validator for slot; produce a block from the other to trigger warning
  const tx = { type: 'chat', fee: 1, content: 'x', signedBy: 'B', signature: '' };
  tx.signature = crypto.sign(null, Buffer.from(canonicalize({ ...tx, signature: undefined }), 'utf8'), privB).toString('base64');
  await produceBlock(nsPort, genesisPrev, 'B', privB_pem, [tx]);
  // wait for log to be flushed
  await sleep(500);
  const joined = fs.readFileSync(logFile, 'utf8');
  expect(joined.includes('Warning: validator')).toBeTruthy();
  await killChild(child);
});
