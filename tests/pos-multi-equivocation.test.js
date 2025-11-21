"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
/// <reference types="jest" />
var path_1 = require("path");
var crypto_1 = require("crypto");
var testHelpers_1 = require("./utils/testHelpers");
function canonicalize(obj) {
    if (typeof obj !== 'object' || obj === null)
        return JSON.stringify(obj);
    if (Array.isArray(obj))
        return '[' + obj.map(canonicalize).join(',') + ']';
    var keys = Object.keys(obj).sort();
    return '{' + keys.map(function (k) { return JSON.stringify(k) + ':' + canonicalize(obj[k]); }).join(',') + '}';
}
function sha256Hex(buf) { return crypto_1.default.createHash('sha256').update(buf).digest('hex'); }
function computeMerkleRoot(txIds) {
    if (!txIds || txIds.length === 0)
        return sha256Hex('');
    var layer = txIds.map(function (id) { return Buffer.from(id, 'hex'); });
    while (layer.length > 1) {
        if (layer.length % 2 === 1)
            layer.push(layer[layer.length - 1]);
        var next = [];
        for (var i = 0; i < layer.length; i += 2) {
            var a = layer[i];
            var b = layer[i + 1];
            var hash = sha256Hex(Buffer.concat([a, b]));
            next.push(Buffer.from(hash, 'hex'));
        }
        layer = next;
    }
    return layer[0].toString('hex');
}
jest.setTimeout(120000);
var nsChild = null;
afterEach(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!nsChild) return [3 /*break*/, 2];
                return [4 /*yield*/, (0, testHelpers_1.killChild)(nsChild)];
            case 1:
                _a.sent();
                nsChild = null;
                _a.label = 2;
            case 2: return [2 /*return*/];
        }
    });
}); });
function fetchJson(url, opts) {
    return __awaiter(this, void 0, void 0, function () { var res; return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, fetch(url, opts)];
            case 1:
                res = _a.sent();
                return [2 /*return*/, res.json()];
        }
    }); });
}
function produceBlock(nsPort_1, validatorId_1, privPem_1, pubPem_1, prevHash_1) {
    return __awaiter(this, arguments, void 0, function (nsPort, validatorId, privPem, pubPem, prevHash, txs) {
        var txIds, merkleRoot, header, headerCopy, signature, pubKey, sigBuf, ok, verifyResp, vj, e_1, res, text, json;
        if (txs === void 0) { txs = []; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    txIds = txs.map(function (tx) {
                        var copy = __assign({}, tx);
                        delete copy.signature;
                        return sha256Hex(Buffer.from(canonicalize(copy), 'utf8'));
                    });
                    merkleRoot = computeMerkleRoot(txIds);
                    header = { validatorId: validatorId, prevHash: prevHash, merkleRoot: merkleRoot };
                    headerCopy = __assign(__assign({}, header), { signature: undefined });
                    signature = Buffer.from(crypto_1.default.sign(null, Buffer.from(canonicalize(headerCopy), 'utf8'), privPem)).toString('base64');
                    // local verification check using provided public key
                    try {
                        pubKey = crypto_1.default.createPublicKey(pubPem);
                        sigBuf = Buffer.from(signature, 'base64');
                        ok = crypto_1.default.verify(null, Buffer.from(canonicalize(headerCopy), 'utf8'), pubKey, sigBuf);
                        if (!ok)
                            console.error('Local signature verify failed for validator', validatorId, 'header', canonicalize(headerCopy));
                    }
                    catch (e) {
                        console.error('Local verify error for validator', validatorId, e.message);
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, fetch("http://localhost:".concat(nsPort, "/debug/verifyHeader"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header: header, signature: signature, publicKey: pubPem }) })];
                case 2:
                    verifyResp = _a.sent();
                    return [4 /*yield*/, verifyResp.json()];
                case 3:
                    vj = _a.sent();
                    console.log('server verify debug:', vj);
                    return [3 /*break*/, 5];
                case 4:
                    e_1 = _a.sent();
                    console.error('server debug verify error', e_1.message);
                    return [3 /*break*/, 5];
                case 5: return [4 /*yield*/, fetch("http://localhost:".concat(nsPort, "/blocks/produce"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header: header, txs: txs, signature: signature }) })];
                case 6:
                    res = _a.sent();
                    return [4 /*yield*/, res.text()];
                case 7:
                    text = _a.sent();
                    try {
                        json = JSON.parse(text);
                    }
                    catch (e) {
                        json = { ok: false, error: 'non-json-response', body: text };
                    }
                    if (!res.ok) {
                        console.error("produceBlock failed: ".concat(res.status), json);
                    }
                    return [2 /*return*/, json];
            }
        });
    });
}
test('multi-signer equivocation slashing: two validators double-sign same slot and are slashed; slashed cannot produce canonical blocks', function () { return __awaiter(void 0, void 0, void 0, function () {
    var nsPort, ns, _a, p1, pr1, _b, p2, pr2, p1pem, pr1pem, p2pem, pr2pem, genesis, resS1A, vsAfterS1A, resS1B, resS2A, resS2B, slashed, vsNow, s1f, s2f, attempt, beforeStakes, attempt2, afterStakes;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                nsPort = 4370;
                ns = (0, testHelpers_1.startServerWithLogs)(path_1.default.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js'), { PORT: nsPort }, "ns-".concat(nsPort)).child;
                nsChild = ns;
                return [4 /*yield*/, (0, testHelpers_1.waitForHeight)(nsPort, 0, 10000)];
            case 1:
                _c.sent();
                _a = crypto_1.default.generateKeyPairSync('ed25519'), p1 = _a.publicKey, pr1 = _a.privateKey;
                _b = crypto_1.default.generateKeyPairSync('ed25519'), p2 = _b.publicKey, pr2 = _b.privateKey;
                p1pem = p1.export({ type: 'spki', format: 'pem' });
                pr1pem = pr1.export({ type: 'pkcs8', format: 'pem' });
                p2pem = p2.export({ type: 'spki', format: 'pem' });
                pr2pem = pr2.export({ type: 'pkcs8', format: 'pem' });
                return [4 /*yield*/, fetch("http://localhost:".concat(nsPort, "/validators/register"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validatorId: 'S1', stake: 100, publicKey: p1pem }) })];
            case 2:
                _c.sent();
                return [4 /*yield*/, fetch("http://localhost:".concat(nsPort, "/validators/register"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validatorId: 'S2', stake: 100, publicKey: p2pem }) })];
            case 3:
                _c.sent();
                genesis = '0'.repeat(64);
                return [4 /*yield*/, produceBlock(nsPort, 'S1', pr1pem, p1pem, genesis, [{ type: 'chat', fee: 1, content: 's1a', signedBy: 'S1' }])];
            case 4:
                resS1A = _c.sent();
                expect(resS1A.ok).toBeTruthy();
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/validators"))];
            case 5:
                vsAfterS1A = _c.sent();
                console.log('validators after S1A', vsAfterS1A);
                return [4 /*yield*/, produceBlock(nsPort, 'S1', pr1pem, p1pem, genesis, [{ type: 'chat', fee: 1, content: 's1b', signedBy: 'S1' }])];
            case 6:
                resS1B = _c.sent();
                expect(resS1B.ok).toBeTruthy();
                return [4 /*yield*/, produceBlock(nsPort, 'S2', pr2pem, p2pem, genesis, [{ type: 'chat', fee: 1, content: 's2a', signedBy: 'S2' }])];
            case 7:
                resS2A = _c.sent();
                expect(resS2A.ok).toBeTruthy();
                return [4 /*yield*/, produceBlock(nsPort, 'S2', pr2pem, p2pem, genesis, [{ type: 'chat', fee: 1, content: 's2b', signedBy: 'S2' }])];
            case 8:
                resS2B = _c.sent();
                expect(resS2B.ok).toBeTruthy();
                return [4 /*yield*/, (0, testHelpers_1.waitForCondition)(function () { return __awaiter(void 0, void 0, void 0, function () {
                        var vs, s1, s2;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/validators"))];
                                case 1:
                                    vs = _a.sent();
                                    s1 = vs.validators.find(function (v) { return v.validatorId === 'S1'; });
                                    s2 = vs.validators.find(function (v) { return v.validatorId === 'S2'; });
                                    return [2 /*return*/, s1 && s2 && s1.slashed && s2.slashed];
                            }
                        });
                    }); }, 5000, 200)];
            case 9:
                slashed = _c.sent();
                expect(slashed).toBeTruthy();
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/validators"))];
            case 10:
                vsNow = _c.sent();
                s1f = vsNow.validators.find(function (v) { return v.validatorId === 'S1'; });
                s2f = vsNow.validators.find(function (v) { return v.validatorId === 'S2'; });
                expect(s1f.stake).toBeLessThan(100);
                expect(s2f.stake).toBeLessThan(100);
                expect(s1f.slashed).toBeTruthy();
                expect(s2f.slashed).toBeTruthy();
                return [4 /*yield*/, produceBlock(nsPort, 'S1', pr1pem, p1pem, genesis, [{ type: 'chat', fee: 1, content: 's1-after-slash', signedBy: 'S1' }])];
            case 11:
                attempt = _c.sent();
                expect(attempt.ok).toBeFalsy();
                expect(attempt.error).toBe('validator_slashed');
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/validators"))];
            case 12:
                beforeStakes = (_c.sent()).validators.map(function (v) { return ({ id: v.validatorId, stake: v.stake }); });
                return [4 /*yield*/, produceBlock(nsPort, 'S1', pr1pem, p1pem, genesis, [{ type: 'chat', fee: 1, content: 's1-after-slash-2', signedBy: 'S1' }])];
            case 13:
                attempt2 = _c.sent();
                expect(attempt2.ok).toBeFalsy();
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/validators"))];
            case 14:
                afterStakes = (_c.sent()).validators.map(function (v) { return ({ id: v.validatorId, stake: v.stake }); });
                expect(afterStakes.find(function (x) { return x.id === 'S1'; }).stake).toBe(beforeStakes.find(function (x) { return x.id === 'S1'; }).stake);
                return [4 /*yield*/, (0, testHelpers_1.killChild)(ns)];
            case 15:
                _c.sent();
                nsChild = null;
                return [2 /*return*/];
        }
    });
}); });
