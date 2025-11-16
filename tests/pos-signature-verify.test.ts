// @ts-nocheck
/// <reference types="jest" />
import path from 'path';
import crypto from 'crypto';
import { startServerWithLogs, killChild, waitForHeight, waitForCondition } from './utils/testHelpers';

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

jest.setTimeout(20000);

let nsChild: any = null;

afterEach(async () => {
  if (nsChild) {
    await killChild(nsChild);
    nsChild = null;
  }
});

async function fetchJson(url, opts) { const res = await fetch(url, opts); const txt = await res.text(); try { return JSON.parse(txt);} catch { return { ok: false, status: res.status, body: txt }; } }

test('header signature verify: valid header passes, altered header fails', async () => {
  const nsPort = 4380;
  const { child: ns } = startServerWithLogs(path.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js'), { PORT: nsPort }, `ns-${nsPort}`);
  nsChild = ns;
  await waitForHeight(nsPort, 0, 30000);

  const { publicKey: p1, privateKey: pr1 } = crypto.generateKeyPairSync('ed25519');
  const p1pem = p1.export({ type: 'spki', format: 'pem' });
  const pr1pem = pr1.export({ type: 'pkcs8', format: 'pem' });
  await fetch(`http://localhost:${nsPort}/validators/register`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ validatorId: 'V1', stake: 100, publicKey: p1pem }) });
  // build header and sign
  const genesis = '0'.repeat(64);
  const header = { validatorId: 'V1', prevHash: genesis, merkleRoot: computeMerkleRoot([]) };
  const hdrData = canonicalize({ ...header, signature: undefined });
  const sig = Buffer.from(crypto.sign(null, Buffer.from(hdrData, 'utf8'), pr1pem)).toString('base64');

  // server debug verify should be true
  const dbg = await fetchJson(`http://localhost:${nsPort}/debug/verifyHeader`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header, signature: sig, publicKey: p1pem }) });
  expect(dbg.ok).toBeTruthy();

  // altered header should fail verification
  const altered = { ...header, merkleRoot: '00'.repeat(32) };
  const dbg2 = await fetchJson(`http://localhost:${nsPort}/debug/verifyHeader`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header: altered, signature: sig, publicKey: p1pem }) });
  expect(dbg2.ok).toBeFalsy();

  // produce with valid header succeeds
  const resOk = await fetchJson(`http://localhost:${nsPort}/blocks/produce`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header, txs: [], signature: sig }) });
  expect(resOk.ok).toBeTruthy();

  // produce with tampered header and same signature fails
  const resTamper = await fetchJson(`http://localhost:${nsPort}/blocks/produce`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header: altered, txs: [], signature: sig }) });
  expect(resTamper.ok).toBeFalsy();
  expect(resTamper.error).toBe('invalid header signature' || 'bad_sig');

  // invalid signature should NOT slash the validator: generate wrong key and attempt produce
  const { publicKey: wrongP, privateKey: wrongPr } = crypto.generateKeyPairSync('ed25519');
  const wrongPrivPem = wrongPr.export({ type: 'pkcs8', format: 'pem' });
  const wrongSig = Buffer.from(crypto.sign(null, Buffer.from(hdrData, 'utf8'), wrongPrivPem)).toString('base64');
  const resWrongSig = await fetchJson(`http://localhost:${nsPort}/blocks/produce`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header, txs: [], signature: wrongSig }) });
  expect(resWrongSig.ok).toBeFalsy();
  expect(resWrongSig.error).toBe('invalid header signature' || 'bad_sig');
  const vsNow = await fetchJson(`http://localhost:${nsPort}/validators`);
  const v = vsNow.validators.find((x) => x.validatorId === 'V1');
  expect(v.slashed).toBeFalsy();
  // stake increased by block reward after successful produce, so should be > 100
  expect(v.stake).toBeGreaterThan(100);

  await killChild(ns);
  nsChild = null;
});
