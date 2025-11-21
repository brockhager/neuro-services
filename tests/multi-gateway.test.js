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
var child_process_1 = require("child_process");
var path_1 = require("path");
var jsonwebtoken_1 = require("jsonwebtoken");
jest.setTimeout(60000);
function startNsNode(port, gatewayUrls) {
    var _a, _b, _c;
    if (port === void 0) { port = 4100; }
    if (gatewayUrls === void 0) { gatewayUrls = []; }
    var serverPath = path_1.default.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
    var env = __assign(__assign({}, process.env), { PORT: port.toString(), GATEWAY_URLS: gatewayUrls.join(',') });
    var detached = process.platform !== 'win32';
    var child = (0, child_process_1.spawn)('node', [serverPath], { env: env, stdio: ['ignore', 'pipe', 'pipe'], detached: detached });
    (_a = child.stdout) === null || _a === void 0 ? void 0 : _a.on('data', function (d) { return console.log("[ns-node ".concat(port, "] ").concat(d.toString().trim())); });
    (_b = child.stderr) === null || _b === void 0 ? void 0 : _b.on('data', function (d) { return console.error("[ns-node ".concat(port, " ERR] ").concat(d.toString().trim())); });
    if (detached)
        (_c = child.unref) === null || _c === void 0 ? void 0 : _c.call(child);
    return child;
}
function startGateway(port, nsUrl) {
    var _a, _b, _c;
    if (port === void 0) { port = 4300; }
    var serverPath = path_1.default.resolve(__dirname, '..', '..', 'neuroswarm', 'gateway-node', 'server.js');
    var env = __assign(__assign({}, process.env), { PORT: port.toString() });
    if (nsUrl)
        env.NS_NODE_URL = nsUrl;
    var detached = process.platform !== 'win32';
    var child = (0, child_process_1.spawn)('node', [serverPath], { env: env, stdio: ['ignore', 'pipe', 'pipe'], detached: detached });
    (_a = child.stdout) === null || _a === void 0 ? void 0 : _a.on('data', function (d) { return console.log("[gateway ".concat(port, "] ").concat(d.toString().trim())); });
    (_b = child.stderr) === null || _b === void 0 ? void 0 : _b.on('data', function (d) { return console.error("[gateway ".concat(port, " ERR] ").concat(d.toString().trim())); });
    if (detached)
        (_c = child.unref) === null || _c === void 0 ? void 0 : _c.call(child);
    return child;
}
function waitForOutput(proc_1, match_1) {
    return __awaiter(this, arguments, void 0, function (proc, match, timeoutMs) {
        if (timeoutMs === void 0) { timeoutMs = 15000; }
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    var stderr = '';
                    var onStdout = function (d) {
                        var s = d.toString();
                        if (typeof match === 'string' ? s.includes(match) : match.test(s)) {
                            cleanup();
                            return resolve(true);
                        }
                    };
                    var onStderr = function (d) {
                        stderr += d.toString();
                        console.error('[child stderr] ', d.toString().trim());
                    };
                    var onExit = function (code, signal) {
                        cleanup();
                        return reject(new Error("Process exited before expected output: code=".concat(code, " signal=").concat(signal, " stderr=").concat(stderr)));
                    };
                    var onError = function (err) {
                        cleanup();
                        return reject(new Error("Process error before expected output: ".concat(err.message, " stderr=").concat(stderr)));
                    };
                    var timeout = setTimeout(function () {
                        cleanup();
                        reject(new Error("Process did not output '".concat(String(match), "' within ").concat(timeoutMs, "ms; stderr=").concat(stderr)));
                    }, timeoutMs);
                    function cleanup() {
                        clearTimeout(timeout);
                        try {
                            proc.stdout.removeListener('data', onStdout);
                        }
                        catch (e) { }
                        try {
                            proc.stderr.removeListener('data', onStderr);
                        }
                        catch (e) { }
                        try {
                            proc.removeListener('exit', onExit);
                        }
                        catch (e) { }
                        try {
                            proc.removeListener('error', onError);
                        }
                        catch (e) { }
                    }
                    proc.stdout.on('data', onStdout);
                    proc.stderr.on('data', onStderr);
                    proc.on('exit', onExit);
                    proc.on('error', onError);
                })];
        });
    });
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
function killChild(child_1) {
    return __awaiter(this, arguments, void 0, function (child, timeoutMs) {
        if (timeoutMs === void 0) { timeoutMs = 5000; }
        return __generator(this, function (_a) {
            if (!child)
                return [2 /*return*/];
            return [2 /*return*/, new Promise(function (resolve) {
                    var finished = false;
                    var onExit = function () {
                        if (finished)
                            return;
                        finished = true;
                        cleanup();
                        resolve(true);
                    };
                    var cleanup = function () {
                        var _a, _b, _c, _d, _e, _f;
                        try {
                            child.removeListener('exit', onExit);
                        }
                        catch (e) { }
                        try {
                            (_b = (_a = child.stdout) === null || _a === void 0 ? void 0 : _a.destroy) === null || _b === void 0 ? void 0 : _b.call(_a);
                        }
                        catch (e) { }
                        try {
                            (_d = (_c = child.stderr) === null || _c === void 0 ? void 0 : _c.destroy) === null || _d === void 0 ? void 0 : _d.call(_c);
                        }
                        catch (e) { }
                        try {
                            if (child.stdin)
                                (_f = (_e = child.stdin).end) === null || _f === void 0 ? void 0 : _f.call(_e);
                        }
                        catch (e) { }
                    };
                    var timeout = setTimeout(function () {
                        try {
                            child.kill('SIGKILL');
                        }
                        catch (e) { }
                        onExit();
                    }, timeoutMs);
                    child.on('exit', function () {
                        clearTimeout(timeout);
                        onExit();
                    });
                    // try to gracefully kill
                    try {
                        if (child.pid) {
                            if (process.platform !== 'win32') {
                                try {
                                    process.kill(-child.pid, 'SIGTERM');
                                }
                                catch (e) { /* ignore */ }
                            }
                            else {
                                // On Windows, use taskkill to ensure entire process tree is terminated
                                try {
                                    var tk = (0, child_process_1.spawn)('taskkill', ['/PID', String(child.pid), '/T', '/F']);
                                    tk.on('exit', function () { });
                                }
                                catch (e) { /* ignore */ }
                                try {
                                    child.kill('SIGTERM');
                                }
                                catch (e) { /* ignore */ }
                            }
                        }
                    }
                    catch (e) {
                        clearTimeout(timeout);
                        onExit();
                    }
                })];
        });
    });
}
test('ns-node publishes to multiple gateways and fails over', function () { return __awaiter(void 0, void 0, void 0, function () {
    var gw1Port, gw2Port, nsPort, gateways, ns, gw1, gw2, token, forwardedFor, forwardedUser, correlationId, res, last1, gstatus, gw1status, gw2status, correlationId2, res2, last2, gstatus2, gw1status2, gw2status2;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                gw1Port = 4301;
                gw2Port = 4302;
                nsPort = 4101;
                gateways = ["http://localhost:".concat(gw1Port), "http://localhost:".concat(gw2Port)];
                ns = startNsNode(nsPort, gateways);
                return [4 /*yield*/, waitForOutput(ns, "ns-node local server started")];
            case 1:
                _c.sent();
                gw1 = startGateway(gw1Port, "http://localhost:".concat(nsPort));
                return [4 /*yield*/, waitForOutput(gw1, "Gateway node listening")];
            case 2:
                _c.sent();
                gw2 = startGateway(gw2Port, "http://localhost:".concat(nsPort));
                return [4 /*yield*/, waitForOutput(gw2, "Gateway node listening")];
            case 3:
                _c.sent();
                _c.label = 4;
            case 4:
                _c.trys.push([4, , 12, 16]);
                token = jsonwebtoken_1.default.sign({ username: 'test' }, 'test-secret');
                forwardedFor = '1.2.3.4';
                forwardedUser = 'test-user';
                correlationId = 'cid-' + Math.random().toString(36).slice(2, 9);
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/chat"), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: "Bearer ".concat(token), 'X-Forwarded-For': forwardedFor, 'X-Forwarded-User': forwardedUser, 'X-Correlation-Id': correlationId }, body: JSON.stringify({ sender: 'test', content: 'hello gw1' }) })];
            case 5:
                res = _c.sent();
                expect(res.cid).toBeTruthy();
                return [4 /*yield*/, fetchJson("http://localhost:".concat(gw1Port, "/debug/last-message"))];
            case 6:
                last1 = _c.sent();
                expect(last1.last).toBeTruthy();
                expect(last1.last.headers.authorization).toContain('Bearer');
                expect(last1.last.headers['x-forwarded-for']).toBe(forwardedFor);
                expect(last1.last.headers['x-forwarded-user']).toBe(forwardedUser);
                expect(last1.last.headers['x-correlation-id']).toBe(correlationId);
                expect((_a = last1.last.headers) === null || _a === void 0 ? void 0 : _a.authorization).toContain('Bearer');
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/debug/gateways"))];
            case 7:
                gstatus = _c.sent();
                console.log('Gateways status after first publish:', JSON.stringify(gstatus, null, 2));
                gw1status = gstatus.gateways.find(function (g) { return g.url.includes(":".concat(gw1Port)); });
                gw2status = gstatus.gateways.find(function (g) { return g.url.includes(":".concat(gw2Port)); });
                expect(gw1status.reachable).toBe(true);
                // kill gw1 to simulate failure
                return [4 /*yield*/, killChild(gw1)];
            case 8:
                // kill gw1 to simulate failure
                _c.sent();
                correlationId2 = 'cid-' + Math.random().toString(36).slice(2, 9);
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/chat"), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: "Bearer ".concat(token), 'X-Forwarded-For': forwardedFor, 'X-Forwarded-User': forwardedUser, 'X-Correlation-Id': correlationId2 }, body: JSON.stringify({ sender: 'test', content: 'hello gw2' }) })];
            case 9:
                res2 = _c.sent();
                expect(res2.cid).toBeTruthy();
                return [4 /*yield*/, fetchJson("http://localhost:".concat(gw2Port, "/debug/last-message"))];
            case 10:
                last2 = _c.sent();
                expect(last2.last).toBeTruthy();
                expect(last2.last.headers.authorization).toContain('Bearer');
                expect(last2.last.headers['x-forwarded-for']).toBe(forwardedFor);
                expect(last2.last.headers['x-forwarded-user']).toBe(forwardedUser);
                expect(last2.last.headers['x-correlation-id']).toBe(correlationId2);
                expect((_b = last2.last.headers) === null || _b === void 0 ? void 0 : _b.authorization).toContain('Bearer');
                return [4 /*yield*/, fetchJson("http://localhost:".concat(nsPort, "/debug/gateways"))];
            case 11:
                gstatus2 = _c.sent();
                console.log('Gateways status after failover publish:', JSON.stringify(gstatus2, null, 2));
                gw1status2 = gstatus2.gateways.find(function (g) { return g.url.includes(":".concat(gw1Port)); });
                gw2status2 = gstatus2.gateways.find(function (g) { return g.url.includes(":".concat(gw2Port)); });
                expect(gw1status2.reachable).toBe(false);
                expect(gw2status2.reachable).toBe(true);
                expect(last2.last.direction).toBe('out');
                return [3 /*break*/, 16];
            case 12: return [4 /*yield*/, killChild(ns)];
            case 13:
                _c.sent();
                return [4 /*yield*/, killChild(gw1)];
            case 14:
                _c.sent();
                return [4 /*yield*/, killChild(gw2)];
            case 15:
                _c.sent();
                return [7 /*endfinally*/];
            case 16: return [2 /*return*/];
        }
    });
}); });
