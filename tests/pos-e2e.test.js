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
jest.setTimeout(120000);
function startNsNode(port) {
    if (port === void 0) { port = 4200; }
    var serverPath = path_1.default.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
    var env = __assign(__assign({}, process.env), { PORT: port.toString() });
    var _a = (0, testHelpers_1.startServerWithLogs)(serverPath, env, "ns-".concat(port)), child = _a.child, logFile = _a.logFile, errFile = _a.errFile;
    return { child: child, logFile: logFile, errFile: errFile };
}
function startVpNode(nsUrl, port, validatorId, keys) {
    if (port === void 0) { port = 4400; }
    if (validatorId === void 0) { validatorId = 'val-test'; }
    if (keys === void 0) { keys = {}; }
    var serverPath = path_1.default.resolve(__dirname, '..', '..', 'neuroswarm', 'vp-node', 'server.js');
    var env = __assign(__assign(__assign({}, process.env), { NS_NODE_URL: nsUrl, VALIDATOR_ID: validatorId, VP_INTERVAL_MS: '2000', INIT_STAKE: '10' }), keys);
    var _a = (0, testHelpers_1.startServerWithLogs)(serverPath, env, "vp-".concat(validatorId)), child = _a.child, logFile = _a.logFile;
    return { child: child, logFile: logFile };
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
test('POS: validator produces block and SPV proof inclusion', function () { return __awaiter(void 0, void 0, void 0, function () {
    var nsPort, _a, ns, nsLog, started, gwPort, gwPath, gwCwd, gwEnv, _b, gw, gwLog, _c, publicKey, privateKey, privPem, pubPem, vp, registered, tx, sig, res, txId, latestBlock, blockHash, ok, val, myVal, proof, verify;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                nsPort = 4201;
                _a = startNsNode(nsPort), ns = _a.child, nsLog = _a.logFile;
                return [4 /*yield*/, (0, testHelpers_1.waitForHeight)(nsPort, 0, 5000)];
            case 1:
                started = _d.sent();
                expect(started).toBeTruthy();
                gwPort = 4305;
                gwPath = path_1.default.resolve(__dirname, '..', '..', 'neuroswarm', 'gateway-node', 'server.js');
                gwCwd = path_1.default.resolve(__dirname, '..', '..', 'neuroswarm', 'gateway-node');
                gwEnv = __assign(__assign({}, process.env), { PORT: gwPort.toString(), NS_NODE_URL: "http://localhost:".concat(nsPort) });
                _b = (0, testHelpers_1.startServerWithLogs)(gwPath, gwEnv, "gw-".concat(gwPort), gwCwd), gw = _b.child, gwLog = _b.logFile;
                _c = crypto_1.default.generateKeyPairSync('ed25519'), publicKey = _c.publicKey, privateKey = _c.privateKey;
                privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
                pubPem = publicKey.export({ type: 'spki', format: 'pem' });
                vp = startVpNode("http://localhost:".concat(nsPort), 0, 'val-test', { PRIVATE_KEY_PEM: privPem, PUBLIC_KEY_PEM: pubPem });
                return [4 /*yield*/, (0, testHelpers_1.waitForCondition)(function () { return __awaiter(void 0, void 0, void 0, function () {
                        var vs;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/validators"))];
                                case 1:
                                    vs = _a.sent();
                                    return [2 /*return*/, !!vs.validators.find(function (v) { return v.validatorId === 'val-test'; })];
                            }
                        });
                    }); }, 10000, 300)];
            case 2:
                registered = _d.sent();
                expect(registered).toBeTruthy();
                tx = { type: 'chat', fee: 1, content: 'hello pos', signedBy: 'val-test', signature: '', timestamp: Date.now() };
                sig = crypto_1.default.sign(null, Buffer.from(canonicalize(__assign(__assign({}, tx), { signature: undefined })), 'utf8'), privateKey).toString('base64');
                tx.signature = sig;
                return [4 /*yield*/, fetchJson("http://localhost:".concat(gwPort, "/v1/tx"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tx) })];
            case 3:
                res = _d.sent();
                expect(res.ok).toBeTruthy();
                txId = res.txId;
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/blocks/latest"))];
            case 4:
                latestBlock = _d.sent();
                blockHash = latestBlock.block ? latestBlock.block.blockHash : null;
                if (!!blockHash) return [3 /*break*/, 6];
                return [4 /*yield*/, (0, testHelpers_1.waitForHeight)(nsPort, 1, 15000)];
            case 5:
                ok = _d.sent();
                expect(ok).toBeTruthy();
                _d.label = 6;
            case 6: return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/validators"))];
            case 7:
                val = _d.sent();
                myVal = val.validators.find(function (v) { return v.validatorId === 'val-test'; });
                expect(Number(myVal.stake)).toBeGreaterThanOrEqual(10);
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/proof/").concat(txId))];
            case 8:
                proof = _d.sent();
                expect(proof).toHaveProperty('proof');
                expect(proof.blockHeader).toHaveProperty('validatorId');
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/verify/proof"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ txId: txId, proof: proof.proof, blockHeader: proof.blockHeader }) })];
            case 9:
                verify = _d.sent();
                expect(verify.ok).toBe(true);
                // cleanup
                return [4 /*yield*/, (0, testHelpers_1.killChild)(vp.child || vp)];
            case 10:
                // cleanup
                _d.sent();
                return [4 /*yield*/, (0, testHelpers_1.killChild)(gw || gw)];
            case 11:
                _d.sent();
                return [4 /*yield*/, (0, testHelpers_1.killChild)(ns || ns)];
            case 12:
                _d.sent();
                return [2 /*return*/];
        }
    });
}); });
