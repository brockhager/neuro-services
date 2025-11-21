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
test('equivocation: slash validator on double-sign (same parent, two different blocks)', function () { return __awaiter(void 0, void 0, void 0, function () {
    var nsPort, serverPath, _a, child, logFile, started, _b, pubS, privS, pubS_pem, privS_pem, genesisPrev, tx1, tx2, produce, r1, r2, slashed, vs, s;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                nsPort = 4350;
                serverPath = path_1.default.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
                _a = (0, testHelpers_1.startServerWithLogs)(serverPath, { PORT: nsPort }, 'ns-equiv'), child = _a.child, logFile = _a.logFile;
                return [4 /*yield*/, (0, testHelpers_1.waitForHeight)(nsPort, 0, 5000)];
            case 1:
                started = _c.sent();
                expect(started).toBeTruthy();
                _b = crypto_1.default.generateKeyPairSync('ed25519'), pubS = _b.publicKey, privS = _b.privateKey;
                pubS_pem = pubS.export({ type: 'spki', format: 'pem' });
                privS_pem = privS.export({ type: 'pkcs8', format: 'pem' });
                // register
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/validators/register"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validatorId: 'S', stake: 100, publicKey: pubS_pem }) })];
            case 2:
                // register
                _c.sent();
                genesisPrev = '0'.repeat(64);
                tx1 = { type: 'chat', fee: 1, content: 's1', signedBy: 'S', signature: '' };
                tx1.signature = crypto_1.default.sign(null, Buffer.from(canonicalize(__assign(__assign({}, tx1), { signature: undefined })), 'utf8'), privS).toString('base64');
                tx2 = { type: 'chat', fee: 1, content: 's2', signedBy: 'S', signature: '' };
                tx2.signature = crypto_1.default.sign(null, Buffer.from(canonicalize(__assign(__assign({}, tx2), { signature: undefined })), 'utf8'), privS).toString('base64');
                produce = function (txs) { return __awaiter(void 0, void 0, void 0, function () {
                    var txIds, merkleRoot, header, signature, res;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                txIds = txs.map(function (tx) { return sha256Hex(Buffer.from(canonicalize(__assign(__assign({}, tx), { signature: undefined })), 'utf8')); });
                                merkleRoot = computeMerkleRoot(txIds);
                                header = { validatorId: 'S', prevHash: genesisPrev, merkleRoot: merkleRoot };
                                signature = Buffer.from(crypto_1.default.sign(null, Buffer.from(canonicalize(__assign(__assign({}, header), { signature: undefined })), 'utf8'), privS)).toString('base64');
                                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/blocks/produce"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header: header, txs: txs, signature: signature }) })];
                            case 1:
                                res = _a.sent();
                                return [2 /*return*/, res];
                        }
                    });
                }); };
                return [4 /*yield*/, produce([tx1])];
            case 3:
                r1 = _c.sent();
                expect(r1.ok).toBeTruthy();
                return [4 /*yield*/, produce([tx2])];
            case 4:
                r2 = _c.sent();
                expect(r2.ok).toBeTruthy();
                return [4 /*yield*/, waitForCondition(function () { return __awaiter(void 0, void 0, void 0, function () {
                        var vs, s;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/validators"))];
                                case 1:
                                    vs = _a.sent();
                                    s = vs.validators.find(function (v) { return v.validatorId === 'S'; });
                                    return [2 /*return*/, s && s.slashed];
                            }
                        });
                    }); }, 5000, 200)];
            case 5:
                slashed = _c.sent();
                expect(slashed).toBeTruthy();
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/validators"))];
            case 6:
                vs = _c.sent();
                s = vs.validators.find(function (v) { return v.validatorId === 'S'; });
                expect(s).toBeTruthy();
                expect(s.stake).toBeLessThan(100);
                expect(s.slashed).toBeTruthy();
                return [4 /*yield*/, (0, testHelpers_1.killChild)(child)];
            case 7:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
