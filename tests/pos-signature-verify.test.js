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
jest.setTimeout(20000);
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
    return __awaiter(this, void 0, void 0, function () { var res, txt; return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, fetch(url, opts)];
            case 1:
                res = _a.sent();
                return [4 /*yield*/, res.text()];
            case 2:
                txt = _a.sent();
                try {
                    return [2 /*return*/, JSON.parse(txt)];
                }
                catch (_b) {
                    return [2 /*return*/, { ok: false, status: res.status, body: txt }];
                }
                return [2 /*return*/];
        }
    }); });
}
test('header signature verify: valid header passes, altered header fails', function () { return __awaiter(void 0, void 0, void 0, function () {
    var nsPort, ns, _a, p1, pr1, p1pem, pr1pem, genesis, header, hdrData, sig, dbg, altered, dbg2, resOk, resTamper, _b, wrongP, wrongPr, wrongPrivPem, wrongSig, resWrongSig, vsNow, v;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                nsPort = 4380;
                ns = (0, testHelpers_1.startServerWithLogs)(path_1.default.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js'), { PORT: nsPort }, "ns-".concat(nsPort)).child;
                nsChild = ns;
                return [4 /*yield*/, (0, testHelpers_1.waitForHeight)(nsPort, 0, 10000)];
            case 1:
                _c.sent();
                _a = crypto_1.default.generateKeyPairSync('ed25519'), p1 = _a.publicKey, pr1 = _a.privateKey;
                p1pem = p1.export({ type: 'spki', format: 'pem' });
                pr1pem = pr1.export({ type: 'pkcs8', format: 'pem' });
                return [4 /*yield*/, fetch("http://localhost:".concat(nsPort, "/validators/register"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validatorId: 'V1', stake: 100, publicKey: p1pem }) })];
            case 2:
                _c.sent();
                genesis = '0'.repeat(64);
                header = { validatorId: 'V1', prevHash: genesis, merkleRoot: computeMerkleRoot([]) };
                hdrData = canonicalize(__assign(__assign({}, header), { signature: undefined }));
                sig = Buffer.from(crypto_1.default.sign(null, Buffer.from(hdrData, 'utf8'), pr1pem)).toString('base64');
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/debug/verifyHeader"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header: header, signature: sig, publicKey: p1pem }) })];
            case 3:
                dbg = _c.sent();
                expect(dbg.ok).toBeTruthy();
                altered = __assign(__assign({}, header), { merkleRoot: '00'.repeat(32) });
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/debug/verifyHeader"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header: altered, signature: sig, publicKey: p1pem }) })];
            case 4:
                dbg2 = _c.sent();
                expect(dbg2.ok).toBeFalsy();
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/blocks/produce"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header: header, txs: [], signature: sig }) })];
            case 5:
                resOk = _c.sent();
                expect(resOk.ok).toBeTruthy();
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/blocks/produce"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header: altered, txs: [], signature: sig }) })];
            case 6:
                resTamper = _c.sent();
                expect(resTamper.ok).toBeFalsy();
                expect(resTamper.error).toBe('invalid header signature' || 'bad_sig');
                _b = crypto_1.default.generateKeyPairSync('ed25519'), wrongP = _b.publicKey, wrongPr = _b.privateKey;
                wrongPrivPem = wrongPr.export({ type: 'pkcs8', format: 'pem' });
                wrongSig = Buffer.from(crypto_1.default.sign(null, Buffer.from(hdrData, 'utf8'), wrongPrivPem)).toString('base64');
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/blocks/produce"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header: header, txs: [], signature: wrongSig }) })];
            case 7:
                resWrongSig = _c.sent();
                expect(resWrongSig.ok).toBeFalsy();
                expect(resWrongSig.error).toBe('invalid header signature' || 'bad_sig');
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/validators"))];
            case 8:
                vsNow = _c.sent();
                v = vsNow.validators.find(function (x) { return x.validatorId === 'V1'; });
                expect(v.slashed).toBeFalsy();
                // stake increased by block reward after successful produce, so should be > 100
                expect(v.stake).toBeGreaterThan(100);
                return [4 /*yield*/, (0, testHelpers_1.killChild)(ns)];
            case 9:
                _c.sent();
                nsChild = null;
                return [2 /*return*/];
        }
    });
}); });
