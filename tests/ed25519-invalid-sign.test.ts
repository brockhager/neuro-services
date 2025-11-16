// @ts-nocheck
/// <reference types="jest" />
import path from 'path';
import { spawn } from 'child_process';
import { killChild } from './utils/testHelpers';
import crypto from 'crypto';
import { startServerWithLogs, waitForHeight } from './utils/testHelpers';

jest.setTimeout(30000);

function startNsNode(port = 4340) {
  const serverPath = path.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
  const env = { ...process.env, PORT: port.toString() } as any;
  const { child, logFile } = startServerWithLogs(serverPath, env, `ns-${port}`);
  return { child, logFile };
}

function canonicalize(obj) {
  if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  return res.json();
}

test('namespace rejects invalid header signatures', async () => {
  const nsPort = 4341;
  const { child: ns, logFile } = startNsNode(nsPort);
  const started = await waitForHeight(nsPort, 0, 5000);
  expect(started).toBeTruthy();
  // generate ed25519 keys for validator
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
  const priv = privateKey;
  // register validator
  await fetch(`http://localhost:${nsPort}/validators/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validatorId: 'invalid-val', publicKey: pubPem, stake: 10 }) });
  // craft header and txs
  const tx = { type: 'chat', fee: 1, content: 'invalid sign test' };
  const txs = [tx];
  const txIds = txs.map(t => crypto.createHash('sha256').update(canonicalize(t)).digest('hex'));
  const merkleRoot = crypto.createHash('sha256').update(txIds.join('|')).digest('hex');
  const header = { version: 1, prevHash: '0'.repeat(64), merkleRoot, timestamp: Date.now(), validatorId: 'invalid-val', stakeWeight: 10 };
  const headerData = canonicalize(header);
  // sign with a different key (invalid)
  const other = crypto.generateKeyPairSync('ed25519');
  const sig = crypto.sign(null, Buffer.from(headerData, 'utf8'), other.privateKey).toString('base64');
  const res = await fetch(`http://localhost:${nsPort}/blocks/produce`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header, txs, signature: sig }) });
  const j = await res.json();
  expect(j.error).toBeTruthy();
  await killChild(ns);
});
