// @ts-nocheck
/// <reference types="jest" />
import path from 'path';
import { spawn } from 'child_process';
import crypto from 'crypto';
import { startServerWithLogs, waitForHeight, killChild } from './utils/testHelpers';

function canonicalize(obj) {
  if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
}

jest.setTimeout(30000);

function startNsNode(port = 4300) {
  const serverPath = path.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
  const env = { ...process.env, PORT: port.toString() } as any;
  const { child, logFile } = startServerWithLogs(serverPath, env, `ns-${port}`);
  return { child, logFile };
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  return res.json();
}

test('ed25519 validator registration and tx acceptance', async () => {
  const nsPort = 4301;
  const { child: ns, logFile } = startNsNode(nsPort);
  const started = await waitForHeight(nsPort, 0, 5000);
  expect(started).toBeTruthy();
  // create ed25519 key pair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
  const priv = privateKey;
  // register validator
  const r = await fetchJson(`http://localhost:${nsPort}/validators`, { method: 'GET' }) ;
  await fetch(`http://localhost:${nsPort}/validators/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validatorId: 'test-val', publicKey: pubPem, stake: 5 }) });
  // sign tx
  const tx = { type: 'chat', fee: 1, content: 'hello ed25519', signedBy: 'test-val', timestamp: Date.now() };
  const sig = crypto.sign(null, Buffer.from(canonicalize({ ...tx, signature: undefined }), 'utf8'), priv).toString('base64');
  tx.signature = sig;
  const res = await fetchJson(`http://localhost:${nsPort}/tx`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tx) });
  expect(res.ok).toBe(true);
  await killChild(ns);
});
