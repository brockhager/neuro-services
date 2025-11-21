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
var testHelpers_1 = require("./utils/testHelpers");
var crypto_1 = require("crypto");
var testHelpers_2 = require("./utils/testHelpers");
jest.setTimeout(30000);
function startNsNode(port) {
    if (port === void 0) { port = 4340; }
    var serverPath = path_1.default.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
    var env = __assign(__assign({}, process.env), { PORT: port.toString() });
    var _a = (0, testHelpers_2.startServerWithLogs)(serverPath, env, "ns-".concat(port)), child = _a.child, logFile = _a.logFile;
    return { child: child, logFile: logFile };
}
function canonicalize(obj) {
    if (typeof obj !== 'object' || obj === null)
        return JSON.stringify(obj);
    if (Array.isArray(obj))
        return '[' + obj.map(canonicalize).join(',') + ']';
    var keys = Object.keys(obj).sort();
    return '{' + keys.map(function (k) { return JSON.stringify(k) + ':' + canonicalize(obj[k]); }).join(',') + '}';
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
test('namespace rejects invalid header signatures', function () { return __awaiter(void 0, void 0, void 0, function () {
    var nsPort, _a, ns, logFile, started, _b, publicKey, privateKey, pubPem, priv, tx, txs, txIds, merkleRoot, header, headerData, other, sig, res, j;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                nsPort = 4341;
                _a = startNsNode(nsPort), ns = _a.child, logFile = _a.logFile;
                return [4 /*yield*/, (0, testHelpers_2.waitForHeight)(nsPort, 0, 5000)];
            case 1:
                started = _c.sent();
                expect(started).toBeTruthy();
                _b = crypto_1.default.generateKeyPairSync('ed25519'), publicKey = _b.publicKey, privateKey = _b.privateKey;
                pubPem = publicKey.export({ type: 'spki', format: 'pem' });
                priv = privateKey;
                // register validator
                return [4 /*yield*/, fetch("http://localhost:".concat(nsPort, "/validators/register"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validatorId: 'invalid-val', publicKey: pubPem, stake: 10 }) })];
            case 2:
                // register validator
                _c.sent();
                tx = { type: 'chat', fee: 1, content: 'invalid sign test' };
                txs = [tx];
                txIds = txs.map(function (t) { return crypto_1.default.createHash('sha256').update(canonicalize(t)).digest('hex'); });
                merkleRoot = crypto_1.default.createHash('sha256').update(txIds.join('|')).digest('hex');
                header = { version: 1, prevHash: '0'.repeat(64), merkleRoot: merkleRoot, timestamp: Date.now(), validatorId: 'invalid-val', stakeWeight: 10 };
                headerData = canonicalize(header);
                other = crypto_1.default.generateKeyPairSync('ed25519');
                sig = crypto_1.default.sign(null, Buffer.from(headerData, 'utf8'), other.privateKey).toString('base64');
                return [4 /*yield*/, fetch("http://localhost:".concat(nsPort, "/blocks/produce"), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ header: header, txs: txs, signature: sig }) })];
            case 3:
                res = _c.sent();
                return [4 /*yield*/, res.json()];
            case 4:
                j = _c.sent();
                expect(j.error).toBeTruthy();
                return [4 /*yield*/, (0, testHelpers_1.killChild)(ns)];
            case 5:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
