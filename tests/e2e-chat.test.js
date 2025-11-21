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
var child_process_1 = require("child_process");
var path_1 = require("path");
var jsonwebtoken_1 = require("jsonwebtoken");
var testHelpers_1 = require("./utils/testHelpers");
jest.setTimeout(120000);
function startNsNode(port) {
    if (port === void 0) { port = 4010; }
    var serverPath = path_1.default.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
    var env = __assign(__assign({}, process.env), { PORT: port.toString() });
    var child = (0, testHelpers_1.startServerWithLogs)(serverPath, env, "ns-".concat(port)).child;
    return child;
}
function startGateway(nsUrl, port) {
    if (port === void 0) { port = 5010; }
    var cwd = path_1.default.resolve(__dirname, '..', '..', 'neuro-services');
    var gatewayPath = path_1.default.resolve(cwd, 'dist', 'index.js');
    return (0, child_process_1.spawn)('node', [gatewayPath], { cwd: cwd, env: __assign(__assign({}, process.env), { NS_NODE_URL: nsUrl, PORT: port.toString(), JWT_SECRET: 'test-secret' }), stdio: ['ignore', 'pipe', 'pipe'] });
}
function startNeuroWeb(port) {
    if (port === void 0) { port = 3010; }
    var cwd = path_1.default.resolve(__dirname, '..', '..', 'neuro-web');
    return (0, child_process_1.spawn)('npm', ['run', 'start'], { cwd: cwd, env: __assign(__assign({}, process.env), { PORT: port.toString() }), stdio: ['ignore', 'pipe', 'pipe'], shell: true });
}
function waitForOutput(process, match, timeoutMs) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    var timeout = setTimeout(function () { return reject(new Error('timeout waiting for output')); }, timeoutMs);
                    process.stdout.on('data', function (d) {
                        var s = d.toString();
                        if (match.test(s)) {
                            clearTimeout(timeout);
                            resolve();
                        }
                    });
                    process.stderr.on('data', function (d) { return console.error(d.toString()); });
                })];
        });
    });
}
test('E2E: neuro-web -> gateway -> ns-node chat flow', function () { return __awaiter(void 0, void 0, void 0, function () {
    var nsPort, gwPort, webPort, cwdGateway, buildGw, cwdWeb, buildWeb, ns, gateway, web, started, token, res, body, debug, dbg, err_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                nsPort = 4010;
                gwPort = 5010;
                webPort = 3010;
                cwdGateway = path_1.default.resolve(__dirname, '..', '..', 'neuro-services');
                buildGw = (0, child_process_1.spawn)('npm', ['run', 'build'], { cwd: cwdGateway, stdio: ['pipe', 'pipe', 'pipe'], shell: true });
                return [4 /*yield*/, new Promise(function (resolve, reject) {
                        buildGw.on('exit', function (code) { return code === 0 ? resolve(true) : reject(new Error('build gateway failed')); });
                    })];
            case 1:
                _a.sent();
                cwdWeb = path_1.default.resolve(__dirname, '..', '..', 'neuro-web');
                buildWeb = (0, child_process_1.spawn)('npm', ['run', 'build'], { cwd: cwdWeb, stdio: ['pipe', 'pipe', 'pipe'], shell: true });
                return [4 /*yield*/, new Promise(function (resolve, reject) {
                        buildWeb.on('exit', function (code) { return code === 0 ? resolve(true) : reject(new Error('build web failed')); });
                    })];
            case 2:
                _a.sent();
                ns = startNsNode(nsPort);
                _a.label = 3;
            case 3:
                _a.trys.push([3, 18, , 21]);
                return [4 /*yield*/, waitForOutput(ns, /ns-node local server started/, 15000)];
            case 4:
                _a.sent();
                gateway = startGateway("http://localhost:".concat(nsPort), gwPort);
                return [4 /*yield*/, waitForOutput(gateway, /Neuro Services Gateway API listening on port/, 15000)];
            case 5:
                _a.sent();
                web = startNeuroWeb(webPort);
                return [4 /*yield*/, waitForOutput(web, /started server on/, 15000).catch(function () { })];
            case 6:
                _a.sent(); // Next prints different messages
                return [4 /*yield*/, (0, testHelpers_1.waitForHeight)(nsPort, 0, 5000)];
            case 7:
                started = _a.sent();
                expect(started).toBeTruthy();
                token = jsonwebtoken_1.default.sign({ username: 'e2e' }, 'test-secret');
                return [4 /*yield*/, fetch("http://localhost:".concat(gwPort, "/v1/chat"), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': "Bearer ".concat(token) },
                        body: JSON.stringify({ sender: 'e2e', content: 'hi from e2e' })
                    })];
            case 8:
                res = _a.sent();
                expect(res.status).toBe(200);
                return [4 /*yield*/, res.json()];
            case 9:
                body = _a.sent();
                expect(body).toHaveProperty('cid');
                return [4 /*yield*/, fetch("http://localhost:".concat(nsPort, "/debug/last-headers"))];
            case 10:
                debug = _a.sent();
                return [4 /*yield*/, debug.json()];
            case 11:
                dbg = _a.sent();
                expect(dbg.lastHeaders.authorization).toContain('Bearer');
                if (!web) return [3 /*break*/, 13];
                return [4 /*yield*/, (0, testHelpers_1.killChild)(web)];
            case 12:
                _a.sent();
                _a.label = 13;
            case 13:
                if (!gateway) return [3 /*break*/, 15];
                return [4 /*yield*/, (0, testHelpers_1.killChild)(gateway)];
            case 14:
                _a.sent();
                _a.label = 15;
            case 15:
                if (!ns) return [3 /*break*/, 17];
                return [4 /*yield*/, (0, testHelpers_1.killChild)(ns)];
            case 16:
                _a.sent();
                _a.label = 17;
            case 17: return [3 /*break*/, 21];
            case 18:
                err_1 = _a.sent();
                if (!ns) return [3 /*break*/, 20];
                return [4 /*yield*/, (0, testHelpers_1.killChild)(ns)];
            case 19:
                _a.sent();
                _a.label = 20;
            case 20: throw err_1;
            case 21: return [2 /*return*/];
        }
    });
}); });
