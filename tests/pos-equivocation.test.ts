// @ts-nocheck
/// <reference types="jest" />
import path from 'path';
import crypto from 'crypto';
import { startServerWithLogs, waitForTip, waitForHeight, sleep, killChild } from './utils/testHelpers';

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

jest.setTimeout(240000);

async function fetchJson(url, opts) { const res = await fetch(url, opts); return res.json(); }

test('equivocation: slash validator on double-sign (same parent, two different blocks)', async () => {
  const nsPort = 4350;
  const serverPath = path.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
  const { child, logFile } = startServerWithLogs(serverPath, { PORT: nsPort }, 'ns-equiv');
  const started = await waitForHeight(nsPort, 0, 30000);
  expect(started).toBeTruthy();
  const { publicKey: pubS, privateKey: privS } = crypto.generateKeyPairSync('ed25519');
  const pubS_pem = pubS.export({ type: 'spki', format: 'pem' });
  const privS_pem = privS.export({ type: 'pkcs8', format: 'pem' });
  // register
  await fetchJson(`http://localhost:${nsPort}/validators/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validatorId: 'S', stake: 100, publicKey: pubS_pem }) });
  const genesisPrev = '0'.repeat(64);
  // create two different txs and blocks for the same parent
  const tx1 = { type: 'chat', fee: 1, content: 's1', signedBy: 'S', signature: '' };
  tx1.signature = crypto.sign(null, Buffer.from(canonicalize({ ...tx1, signature: undefined }), 'utf8'), privS).toString('base64');
  const tx2 = { type: 'chat', fee: 1, content: 's2', signedBy: 'S', signature: '' };
  tx2.signature = crypto.sign(null, Buffer.from(canonicalize({ ...tx2, signature: undefined }), 'utf8'), privS).toString('base64');
  // helper produce
  const produce = async (txs) => {
    const txIds = txs.map(tx => sha256Hex(Buffer.from(canonicalize({ ...tx, signature: undefined }), 'utf8')));
    const merkleRoot = computeMerkleRoot(txIds);
    const header = { validatorId: 'S', prevHash: genesisPrev, merkleRoot };
    const signature = Buffer.from(crypto.sign(null, Buffer.from(canonicalize({ ...header, signature: undefined }), 'utf8'), privS)).toString('base64');
    const res = await fetchJson(`http://localhost:${nsPort}/blocks/produce`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header, txs, signature }) });
    return res;
  };
  const r1 = await produce([tx1]);
  expect(r1.ok).toBeTruthy();
  const r2 = await produce([tx2]);
  expect(r2.ok).toBeTruthy();
  // wait for slashing to occur
  const slashed = await waitForCondition(async () => {
    const vs = await fetchJson(`http://localhost:${nsPort}/validators`);
    const s = vs.validators.find(v => v.validatorId === 'S');
    return s && s.slashed;
  }, 30000, 200);
  expect(slashed).toBeTruthy();
  const vs = await fetchJson(`http://localhost:${nsPort}/validators`);
  const s = vs.validators.find(v => v.validatorId === 'S');
  expect(s).toBeTruthy();
  expect(s.stake).toBeLessThan(100);
  expect(s.slashed).toBeTruthy();
  await killChild(child);
});
