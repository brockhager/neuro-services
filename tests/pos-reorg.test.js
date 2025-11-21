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
jest.setTimeout(120000);
function startNsNode(port) {
    if (port === void 0) { port = 4200; }
    var serverPath = path_1.default.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
    var env = __assign(__assign({}, process.env), { PORT: port.toString() });
    var _a = (0, testHelpers_1.startServerWithLogs)(serverPath, env, "ns-".concat(port)), child = _a.child, logFile = _a.logFile, errFile = _a.errFile;
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
test('POS Reorg: accept fork and reorg to heavier chain; SPV proof remains valid for canonical txs', function () { return __awaiter(void 0, void 0, void 0, function () {
    // helper to find a slot that chooses a particular validator for a given prevHash
    function findSlotForValidator(prevHash_1, targetId_1) {
        return __awaiter(this, arguments, void 0, function (prevHash, targetId, start, max) {
            var s, seed, seedNum, r, acc, _i, _a, v;
            if (start === void 0) { start = 1; }
            if (max === void 0) { max = 100; }
            return __generator(this, function (_b) {
                for (s = start; s < max; s++) {
                    seed = sha256Hex(Buffer.from(String(prevHash) + String(s), 'utf8'));
                    seedNum = parseInt(seed.slice(0, 12), 16);
                    r = seedNum % vs.totalStake;
                    acc = 0;
                    for (_i = 0, _a = vs.validators; _i < _a.length; _i++) {
                        v = _a[_i];
                        acc += Number(v.stake || 0);
                        if (r < acc) {
                            if (v.validatorId === targetId)
                                return [2 /*return*/, s];
                            break;
                        }
                    }
                }
                return [2 /*return*/, null];
            });
        });
    }
    // produce a block for prevHash with given slot and validator keys, txs
    function produceBlock(prevHash_1, slot_1, validatorId_1, privKeyPem_1) {
        return __awaiter(this, arguments, void 0, function (prevHash, slot, validatorId, privKeyPem, txs) {
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
                        sig = crypto_1.default.sign(null, Buffer.from(canonicalize(__assign(__assign({}, header), { signature: undefined })), 'utf8'), { key: privKeyPem });
                        signature = Buffer.from(sig).toString('base64');
                        return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/blocks/produce"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header: header, txs: txs, signature: signature }) })];
                    case 1:
                        res = _a.sent();
                        return [2 /*return*/, res];
                }
            });
        });
    }
    var nsPort, ns, started, _a, pubA, privA, _b, pubB, privB, pubA_pem, privA_pem, pubB_pem, privB_pem, vs, genesisPrev, slotA, txA, resA, aHash, ok1, slotB, txB, resB, bHash, ok2, latest2, proofB, verifyB, txAId, checkA;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                nsPort = 4301;
                ns = startNsNode(nsPort).child;
                return [4 /*yield*/, (0, testHelpers_1.waitForHeight)(nsPort, 0, 5000)];
            case 1:
                started = _c.sent();
                expect(started).toBeTruthy();
                _a = crypto_1.default.generateKeyPairSync('ed25519'), pubA = _a.publicKey, privA = _a.privateKey;
                _b = crypto_1.default.generateKeyPairSync('ed25519'), pubB = _b.publicKey, privB = _b.privateKey;
                pubA_pem = pubA.export({ type: 'spki', format: 'pem' });
                privA_pem = privA.export({ type: 'pkcs8', format: 'pem' });
                pubB_pem = pubB.export({ type: 'spki', format: 'pem' });
                privB_pem = privB.export({ type: 'pkcs8', format: 'pem' });
                // register validators
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/validators/register"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validatorId: 'A', stake: 10, publicKey: pubA_pem }) })];
            case 2:
                // register validators
                _c.sent();
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/validators/register"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validatorId: 'B', stake: 25, publicKey: pubB_pem }) })];
            case 3:
                _c.sent();
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/validators"))];
            case 4:
                vs = _c.sent();
                expect(vs.totalStake).toBe(35);
                genesisPrev = '0'.repeat(64);
                slotA = 1;
                txA = { type: 'chat', fee: 1, content: 'txA', signedBy: 'A', signature: '' };
                // sign tx
                txA.signature = crypto_1.default.sign(null, Buffer.from(canonicalize(__assign(__assign({}, txA), { signature: undefined })), 'utf8'), privA).toString('base64');
                return [4 /*yield*/, produceBlock(genesisPrev, slotA, 'A', privA_pem, [txA])];
            case 5:
                resA = _c.sent();
                expect(resA.ok).toBeTruthy();
                aHash = resA.blockHash;
                return [4 /*yield*/, (0, testHelpers_1.waitForTip)(nsPort, aHash, 5000)];
            case 6:
                ok1 = _c.sent();
                expect(ok1).toBeTruthy();
                slotB = 1;
                txB = { type: 'chat', fee: 1, content: 'txB', signedBy: 'B', signature: '' };
                txB.signature = crypto_1.default.sign(null, Buffer.from(canonicalize(__assign(__assign({}, txB), { signature: undefined })), 'utf8'), privB).toString('base64');
                return [4 /*yield*/, produceBlock(genesisPrev, slotB, 'B', privB_pem, [txB])];
            case 7:
                resB = _c.sent();
                expect(resB.ok).toBeTruthy();
                bHash = resB.blockHash;
                return [4 /*yield*/, (0, testHelpers_1.waitForTip)(nsPort, bHash, 5000)];
            case 8:
                ok2 = _c.sent();
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/blocks/latest"))];
            case 9:
                latest2 = _c.sent();
                // since B had greater stake, canonical should now be B's block (reorg happened)
                expect(latest2.block.blockHash).toBe(bHash);
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/proof/").concat(sha256Hex(Buffer.from(canonicalize(__assign(__assign({}, txB), { signature: undefined })), 'utf8'))))];
            case 10:
                proofB = _c.sent();
                expect(proofB).toHaveProperty('proof');
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/verify/proof"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ txId: sha256Hex(Buffer.from(canonicalize(__assign(__assign({}, txB), { signature: undefined })), 'utf8')), proof: proofB.proof, blockHeader: proofB.blockHeader }) })];
            case 11:
                verifyB = _c.sent();
                expect(verifyB.ok).toBe(true);
                txAId = sha256Hex(Buffer.from(canonicalize(__assign(__assign({}, txA), { signature: undefined })), 'utf8'));
                return [4 /*yield*/, fetch("http://localhost:".concat(nsPort, "/proof/").concat(txAId))];
            case 12:
                checkA = _c.sent();
                expect(checkA.status).toBe(404);
                // cleanup
                return [4 /*yield*/, (0, testHelpers_1.killChild)(ns)];
            case 13:
                // cleanup
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
