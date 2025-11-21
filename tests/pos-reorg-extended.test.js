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
var path_1 = require("path");
var crypto_1 = require("crypto");
var fs_1 = require("fs");
var testHelpers_1 = require("./utils/testHelpers");
function canonicalize(obj) {
    if (typeof obj !== 'object' || obj === null)
        return JSON.stringify(obj);
    if (Array.isArray(obj))
        return '[' + obj.map(canonicalize).join(',') + ']';
    var keys = Object.keys(obj).sort();
    return '{' + keys.map(function (k) { return JSON.stringify(k) + ':' + canonicalize(obj[k]); }).join(',') + '}';
}
function sha256Hex(buf) {
    return crypto_1.default.createHash('sha256').update(buf).digest('hex');
}
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
jest.setTimeout(180000);
// use startServerWithLogs for starting tests; convenience wrapper
function startNsNode(port, tag) {
    if (port === void 0) { port = 4200; }
    if (tag === void 0) { tag = 'ns'; }
    var serverPath = path_1.default.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
    var env = __assign(__assign({}, process.env), { PORT: port.toString() });
    var _a = (0, testHelpers_1.startServerWithLogs)(serverPath, env, "".concat(tag, "-").concat(port)), child = _a.child, logFile = _a.logFile, errFile = _a.errFile;
    // attach a small stdout capture for real-time debug output in tests
    return { child: child, logFile: logFile, errFile: errFile };
}
function fetchJson(url, opts) {
    return __awaiter(this, void 0, void 0, function () {
        var res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch(url, opts)];
                case 1:
                    res = _a.sent();
                    return [2 /*return*/, res.json()];
            }
        });
    });
}
// Utility to register a validator
function registerValidator(nsPort, id, stake, pubPem) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/validators/register"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validatorId: id, stake: stake, publicKey: pubPem }) })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Produce a block by signing header and posting
function produceBlock(nsPort_1, prevHash_1, validatorId_1, privKeyPem_1) {
    return __awaiter(this, arguments, void 0, function (nsPort, prevHash, validatorId, privKeyPem, txs) {
        var txIds, merkleRoot, header, sig, signature, res;
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
                    sig = crypto_1.default.sign(null, Buffer.from(canonicalize(__assign(__assign({}, header), { signature: undefined })), 'utf8'), privKeyPem);
                    signature = Buffer.from(sig).toString('base64');
                    return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/blocks/produce"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header: header, txs: txs, signature: signature }) })];
                case 1:
                    res = _a.sent();
                    return [2 /*return*/, res];
            }
        });
    });
}
test('multi-block fork: longer/heavier chain overtakes the canonical tip', function () { return __awaiter(void 0, void 0, void 0, function () {
    var nsPort, _a, ns, nsLog, ok, _b, pubA, privA, _c, pubB, privB, pubA_pem, privA_pem, pubB_pem, privB_pem, vs, genesisPrev, txA1, resA1, a1, ok1, txB1, resB1, b1, txB2, resB2, b2, txB3, resB3, b3, ok2;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                nsPort = 4320;
                _a = startNsNode(nsPort), ns = _a.child, nsLog = _a.logFile;
                return [4 /*yield*/, (0, testHelpers_1.waitForHeight)(nsPort, 0, 5000)];
            case 1:
                ok = _d.sent();
                expect(ok).toBeTruthy();
                _b = crypto_1.default.generateKeyPairSync('ed25519'), pubA = _b.publicKey, privA = _b.privateKey;
                _c = crypto_1.default.generateKeyPairSync('ed25519'), pubB = _c.publicKey, privB = _c.privateKey;
                pubA_pem = pubA.export({ type: 'spki', format: 'pem' });
                privA_pem = privA.export({ type: 'pkcs8', format: 'pem' });
                pubB_pem = pubB.export({ type: 'spki', format: 'pem' });
                privB_pem = privB.export({ type: 'pkcs8', format: 'pem' });
                return [4 /*yield*/, registerValidator(nsPort, 'A', 10, pubA_pem)];
            case 2:
                _d.sent();
                return [4 /*yield*/, registerValidator(nsPort, 'B', 1, pubB_pem)];
            case 3:
                _d.sent();
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/validators"))];
            case 4:
                vs = _d.sent();
                expect(vs.totalStake).toBe(11);
                genesisPrev = '0'.repeat(64);
                txA1 = { type: 'chat', fee: 1, content: 'A tx1', signedBy: 'A', signature: '' };
                txA1.signature = crypto_1.default.sign(null, Buffer.from(canonicalize(__assign(__assign({}, txA1), { signature: undefined })), 'utf8'), privA).toString('base64');
                return [4 /*yield*/, produceBlock(nsPort, genesisPrev, 'A', privA_pem, [txA1])];
            case 5:
                resA1 = _d.sent();
                expect(resA1.ok).toBeTruthy();
                a1 = resA1.blockHash;
                return [4 /*yield*/, (0, testHelpers_1.waitForTip)(nsPort, a1, 5000)];
            case 6:
                ok1 = _d.sent();
                expect(ok1).toBeTruthy();
                txB1 = { type: 'chat', fee: 1, content: 'B tx1', signedBy: 'B', signature: '' };
                txB1.signature = crypto_1.default.sign(null, Buffer.from(canonicalize(__assign(__assign({}, txB1), { signature: undefined })), 'utf8'), privB).toString('base64');
                return [4 /*yield*/, produceBlock(nsPort, genesisPrev, 'B', privB_pem, [txB1])];
            case 7:
                resB1 = _d.sent();
                expect(resB1.ok).toBeTruthy();
                b1 = resB1.blockHash;
                txB2 = { type: 'chat', fee: 1, content: 'B tx2', signedBy: 'B', signature: '' };
                txB2.signature = crypto_1.default.sign(null, Buffer.from(canonicalize(__assign(__assign({}, txB2), { signature: undefined })), 'utf8'), privB).toString('base64');
                return [4 /*yield*/, produceBlock(nsPort, b1, 'B', privB_pem, [txB2])];
            case 8:
                resB2 = _d.sent();
                expect(resB2.ok).toBeTruthy();
                b2 = resB2.blockHash;
                txB3 = { type: 'chat', fee: 1, content: 'B tx3', signedBy: 'B', signature: '' };
                txB3.signature = crypto_1.default.sign(null, Buffer.from(canonicalize(__assign(__assign({}, txB3), { signature: undefined })), 'utf8'), privB).toString('base64');
                return [4 /*yield*/, produceBlock(nsPort, b2, 'B', privB_pem, [txB3])];
            case 9:
                resB3 = _d.sent();
                expect(resB3.ok).toBeTruthy();
                b3 = resB3.blockHash;
                return [4 /*yield*/, (0, testHelpers_1.waitForTip)(nsPort, b3, 10000)];
            case 10:
                ok2 = _d.sent();
                expect(ok2).toBeTruthy();
                // cleanup
                return [4 /*yield*/, (0, testHelpers_1.killChild)(ns)];
            case 11:
                // cleanup
                _d.sent();
                return [2 /*return*/];
        }
    });
}); });
test('reorg & mempool re-application: txs from old canonical chain return to mempool or are re-applied', function () { return __awaiter(void 0, void 0, void 0, function () {
    var nsPort, ns2, okStart, _a, pubA, privA, _b, pubB, privB, pubA_pem, privA_pem, pubB_pem, privB_pem, genesisPrev, tx1, resTx, tx1Id, resA1, a1hash, proof, txB1, resB1, b1, txB2, resB2, b2, txB3, resB3, proofCheck, mem, inMempool;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                nsPort = 4323;
                ns2 = startNsNode(nsPort).child;
                return [4 /*yield*/, (0, testHelpers_1.waitForHeight)(nsPort, 0, 5000)];
            case 1:
                okStart = _c.sent();
                expect(okStart).toBeTruthy();
                _a = crypto_1.default.generateKeyPairSync('ed25519'), pubA = _a.publicKey, privA = _a.privateKey;
                _b = crypto_1.default.generateKeyPairSync('ed25519'), pubB = _b.publicKey, privB = _b.privateKey;
                pubA_pem = pubA.export({ type: 'spki', format: 'pem' });
                privA_pem = privA.export({ type: 'pkcs8', format: 'pem' });
                pubB_pem = pubB.export({ type: 'spki', format: 'pem' });
                privB_pem = privB.export({ type: 'pkcs8', format: 'pem' });
                return [4 /*yield*/, registerValidator(nsPort, 'A', 10, pubA_pem)];
            case 2:
                _c.sent();
                return [4 /*yield*/, registerValidator(nsPort, 'B', 1, pubB_pem)];
            case 3:
                _c.sent();
                genesisPrev = '0'.repeat(64);
                tx1 = { type: 'chat', fee: 1, content: 'mempool tx', signedBy: 'A', signature: '' };
                tx1.signature = crypto_1.default.sign(null, Buffer.from(canonicalize(__assign(__assign({}, tx1), { signature: undefined })), 'utf8'), privA).toString('base64');
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/tx"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tx1) })];
            case 4:
                resTx = _c.sent();
                expect(resTx.ok).toBeTruthy();
                tx1Id = resTx.txId;
                return [4 /*yield*/, produceBlock(nsPort, genesisPrev, 'A', privA_pem, [tx1])];
            case 5:
                resA1 = _c.sent();
                expect(resA1.ok).toBeTruthy();
                a1hash = resA1.blockHash;
                return [4 /*yield*/, (0, testHelpers_1.waitForTip)(nsPort, a1hash, 5000)];
            case 6:
                _c.sent();
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/proof/").concat(tx1Id))];
            case 7:
                proof = _c.sent();
                expect(proof).toHaveProperty('proof');
                txB1 = { type: 'chat', fee: 1, content: 'B tx1', signedBy: 'B', signature: '' };
                txB1.signature = crypto_1.default.sign(null, Buffer.from(canonicalize(__assign(__assign({}, txB1), { signature: undefined })), 'utf8'), privB).toString('base64');
                return [4 /*yield*/, produceBlock(nsPort, genesisPrev, 'B', privB_pem, [txB1])];
            case 8:
                resB1 = _c.sent();
                expect(resB1.ok).toBeTruthy();
                b1 = resB1.blockHash;
                txB2 = { type: 'chat', fee: 1, content: 'B tx2', signedBy: 'B', signature: '' };
                txB2.signature = crypto_1.default.sign(null, Buffer.from(canonicalize(__assign(__assign({}, txB2), { signature: undefined })), 'utf8'), privB).toString('base64');
                return [4 /*yield*/, produceBlock(nsPort, b1, 'B', privB_pem, [txB2])];
            case 9:
                resB2 = _c.sent();
                expect(resB2.ok).toBeTruthy();
                b2 = resB2.blockHash;
                txB3 = { type: 'chat', fee: 1, content: 'B tx3', signedBy: 'B', signature: '' };
                txB3.signature = crypto_1.default.sign(null, Buffer.from(canonicalize(__assign(__assign({}, txB3), { signature: undefined })), 'utf8'), privB).toString('base64');
                return [4 /*yield*/, produceBlock(nsPort, b2, 'B', privB_pem, [txB3])];
            case 10:
                resB3 = _c.sent();
                expect(resB3.ok).toBeTruthy();
                return [4 /*yield*/, (0, testHelpers_1.waitForTip)(nsPort, resB3.blockHash, 10000)];
            case 11:
                _c.sent();
                return [4 /*yield*/, fetch("http://localhost:".concat(nsPort, "/proof/").concat(tx1Id))];
            case 12:
                proofCheck = _c.sent();
                expect(proofCheck.status).toBe(404);
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/mempool"))];
            case 13:
                mem = _c.sent();
                inMempool = mem.mempool.find(function (m) { return m.id === tx1Id; });
                expect(inMempool).toBeTruthy();
                // cleanup
                return [4 /*yield*/, (0, testHelpers_1.killChild)(ns)];
            case 14:
                // cleanup
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
test('warning logged when non-selected validator produces block', function () { return __awaiter(void 0, void 0, void 0, function () {
    var nsPort, _a, nc, logFile, errFile, okStartWarn, _b, pubA, privA, _c, pubB, privB, pubA_pem, privA_pem, pubB_pem, privB_pem, genesisPrev, tx, joined;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                nsPort = 4330;
                _a = startNsNode(nsPort, 'ns-warn'), nc = _a.child, logFile = _a.logFile, errFile = _a.errFile;
                return [4 /*yield*/, (0, testHelpers_1.waitForHeight)(nsPort, 0, 5000)];
            case 1:
                okStartWarn = _d.sent();
                expect(okStartWarn).toBeTruthy();
                _b = crypto_1.default.generateKeyPairSync('ed25519'), pubA = _b.publicKey, privA = _b.privateKey;
                _c = crypto_1.default.generateKeyPairSync('ed25519'), pubB = _c.publicKey, privB = _c.privateKey;
                pubA_pem = pubA.export({ type: 'spki', format: 'pem' });
                privA_pem = privA.export({ type: 'pkcs8', format: 'pem' });
                pubB_pem = pubB.export({ type: 'spki', format: 'pem' });
                privB_pem = privB.export({ type: 'pkcs8', format: 'pem' });
                return [4 /*yield*/, registerValidator(nsPort, 'A', 10, pubA_pem)];
            case 2:
                _d.sent();
                return [4 /*yield*/, registerValidator(nsPort, 'B', 10, pubB_pem)];
            case 3:
                _d.sent();
                return [4 /*yield*/, (0, testHelpers_1.sleep)(200)];
            case 4:
                _d.sent();
                genesisPrev = '0'.repeat(64);
                tx = { type: 'chat', fee: 1, content: 'x', signedBy: 'B', signature: '' };
                tx.signature = crypto_1.default.sign(null, Buffer.from(canonicalize(__assign(__assign({}, tx), { signature: undefined })), 'utf8'), privB).toString('base64');
                return [4 /*yield*/, produceBlock(nsPort, genesisPrev, 'B', privB_pem, [tx])];
            case 5:
                _d.sent();
                // wait for log to be flushed
                return [4 /*yield*/, (0, testHelpers_1.sleep)(500)];
            case 6:
                // wait for log to be flushed
                _d.sent();
                joined = fs_1.default.readFileSync(logFile, 'utf8');
                expect(joined.includes('Warning: validator')).toBeTruthy();
                return [4 /*yield*/, (0, testHelpers_1.killChild)(child)];
            case 7:
                _d.sent();
                return [2 /*return*/];
        }
    });
}); });
