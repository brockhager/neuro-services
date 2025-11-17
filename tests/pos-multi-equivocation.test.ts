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

jest.setTimeout(240000);

let nsChild: any = null;

afterEach(async () => {
  if (nsChild) {
    await killChild(nsChild);
    nsChild = null;
  }
});

async function fetchJson(url, opts) { const res = await fetch(url, opts); return res.json(); }

async function produceBlock(nsPort, validatorId, privPem, pubPem, prevHash, txs = []) {
  const txIds = txs.map(tx => {
    const copy = { ...tx };
    delete copy.signature;
    return sha256Hex(Buffer.from(canonicalize(copy), 'utf8'));
  });
  const merkleRoot = computeMerkleRoot(txIds);
  const header = { validatorId, prevHash, merkleRoot };
  const headerCopy = { ...header, signature: undefined };
  const signature = Buffer.from(crypto.sign(null, Buffer.from(canonicalize(headerCopy), 'utf8'), privPem)).toString('base64');
  // local verification check using provided public key
  try {
    const pubKey = crypto.createPublicKey(pubPem);
    const sigBuf = Buffer.from(signature, 'base64');
    const ok = crypto.verify(null, Buffer.from(canonicalize(headerCopy), 'utf8'), pubKey, sigBuf);
    if (!ok) console.error('Local signature verify failed for validator', validatorId, 'header', canonicalize(headerCopy));
  } catch (e) {
    console.error('Local verify error for validator', validatorId, e.message);
  }
  // call server debug verify to compare canonicalization and server verification
  try {
    const verifyResp = await fetch(`http://localhost:${nsPort}/debug/verifyHeader`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header, signature, publicKey: pubPem }) });
    const vj = await verifyResp.json();
    console.log('server verify debug:', vj);
  } catch (e) {
    console.error('server debug verify error', e.message);
  }
  const res = await fetch(`http://localhost:${nsPort}/blocks/produce`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header, txs, signature }) });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = { ok: false, error: 'non-json-response', body: text };
  }
  if (!res.ok) {
    console.error(`produceBlock failed: ${res.status}`, json);
  }
  return json;
}

test('multi-signer equivocation slashing: two validators double-sign same slot and are slashed; slashed cannot produce canonical blocks', async () => {
  const nsPort = 4370;
  const { child: ns } = startServerWithLogs(path.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js'), { PORT: nsPort }, `ns-${nsPort}`);
  nsChild = ns;
  await waitForHeight(nsPort, 0, 30000);

  // configure two validators
  const { publicKey: p1, privateKey: pr1 } = crypto.generateKeyPairSync('ed25519');
  const { publicKey: p2, privateKey: pr2 } = crypto.generateKeyPairSync('ed25519');
  const p1pem = p1.export({ type: 'spki', format: 'pem' });
  const pr1pem = pr1.export({ type: 'pkcs8', format: 'pem' });
  const p2pem = p2.export({ type: 'spki', format: 'pem' });
  const pr2pem = pr2.export({ type: 'pkcs8', format: 'pem' });
  await fetch(`http://localhost:${nsPort}/validators/register`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ validatorId: 'S1', stake: 100, publicKey: p1pem }) });
  await fetch(`http://localhost:${nsPort}/validators/register`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ validatorId: 'S2', stake: 100, publicKey: p2pem }) });

  const genesis = '0'.repeat(64);
  // S1 creates two different blocks for same parent (equivocate)
  const resS1A = await produceBlock(nsPort, 'S1', pr1pem, p1pem, genesis, [{ type: 'chat', fee: 1, content: 's1a', signedBy: 'S1' }]);
  expect(resS1A.ok).toBeTruthy();
  // debug: print validators after first block
  const vsAfterS1A = await fetchJson(`http://localhost:${nsPort}/validators`);
  console.log('validators after S1A', vsAfterS1A);
  const resS1B = await produceBlock(nsPort, 'S1', pr1pem, p1pem, genesis, [{ type: 'chat', fee: 1, content: 's1b', signedBy: 'S1' }]);
  expect(resS1B.ok).toBeTruthy();

  // S2 also equivocate
  const resS2A = await produceBlock(nsPort, 'S2', pr2pem, p2pem, genesis, [{ type: 'chat', fee: 1, content: 's2a', signedBy: 'S2' }]);
  expect(resS2A.ok).toBeTruthy();
  const resS2B = await produceBlock(nsPort, 'S2', pr2pem, p2pem, genesis, [{ type: 'chat', fee: 1, content: 's2b', signedBy: 'S2' }]);
  expect(resS2B.ok).toBeTruthy();

  // wait for slashing to be applied (flag present)
  const slashed = await waitForCondition(async () => {
    const vs = await fetchJson(`http://localhost:${nsPort}/validators`);
    const s1 = vs.validators.find(v => v.validatorId === 'S1');
    const s2 = vs.validators.find(v => v.validatorId === 'S2');
    return s1 && s2 && s1.slashed && s2.slashed;
  }, 30000, 200);
  expect(slashed).toBeTruthy();

  // verify both have stake reduced
  const vsNow = await fetchJson(`http://localhost:${nsPort}/validators`);
  const s1f = vsNow.validators.find(v => v.validatorId === 'S1');
  const s2f = vsNow.validators.find(v => v.validatorId === 'S2');
  expect(s1f.stake).toBeLessThan(100);
  expect(s2f.stake).toBeLessThan(100);
  expect(s1f.slashed).toBeTruthy();
  expect(s2f.slashed).toBeTruthy();

  // ensure slashed validators can't produce a canonical block; attempt to produce and expect an error and idempotent slashing
  const attempt = await produceBlock(nsPort, 'S1', pr1pem, p1pem, genesis, [{ type: 'chat', fee: 1, content: 's1-after-slash', signedBy: 'S1' }]);
  expect(attempt.ok).toBeFalsy();
  expect(attempt.error).toBe('validator_slashed');
  // capture stakes and attempt another equivocation (should not further reduce stake because slashed flag prevents re-slash)
  const beforeStakes = (await fetchJson(`http://localhost:${nsPort}/validators`)).validators.map(v => ({ id: v.validatorId, stake: v.stake }));
  // attempt to equivocate again for S1 (should be rejected)
  const attempt2 = await produceBlock(nsPort, 'S1', pr1pem, p1pem, genesis, [{ type: 'chat', fee: 1, content: 's1-after-slash-2', signedBy: 'S1' }]);
  expect(attempt2.ok).toBeFalsy();
  // verify stakes unchanged
  const afterStakes = (await fetchJson(`http://localhost:${nsPort}/validators`)).validators.map(v => ({ id: v.validatorId, stake: v.stake }));
  expect(afterStakes.find(x => x.id === 'S1').stake).toBe(beforeStakes.find(x => x.id === 'S1').stake);

  await killChild(ns);
  nsChild = null;
});
