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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = sleep;
exports.waitForTip = waitForTip;
exports.waitForHeight = waitForHeight;
exports.waitForCondition = waitForCondition;
exports.ensureLogsDir = ensureLogsDir;
exports.startServerWithLogs = startServerWithLogs;
exports.killChild = killChild;
exports.canonicalize = canonicalize;
exports.txIdFor = txIdFor;
var fs_1 = require("fs");
var path_1 = require("path");
var child_process_1 = require("child_process");
var crypto_1 = require("crypto");
function sleep(ms) { return new Promise(function (resolve) { return setTimeout(resolve, ms); }); }
function waitForTip(nsPort_1, expectedHash_1) {
    return __awaiter(this, arguments, void 0, function (nsPort, expectedHash, timeout, interval) {
        var start, res, j, e_1;
        if (timeout === void 0) { timeout = 10000; }
        if (interval === void 0) { interval = 200; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    start = Date.now();
                    _a.label = 1;
                case 1:
                    if (!(Date.now() - start < timeout)) return [3 /*break*/, 9];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 6, , 7]);
                    return [4 /*yield*/, fetch("http://localhost:".concat(nsPort, "/blocks/latest"))];
                case 3:
                    res = _a.sent();
                    if (!res.ok) return [3 /*break*/, 5];
                    return [4 /*yield*/, res.json()];
                case 4:
                    j = _a.sent();
                    if (j.block && j.block.blockHash === expectedHash)
                        return [2 /*return*/, true];
                    _a.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    e_1 = _a.sent();
                    return [3 /*break*/, 7];
                case 7: return [4 /*yield*/, sleep(interval)];
                case 8:
                    _a.sent();
                    return [3 /*break*/, 1];
                case 9: return [2 /*return*/, false];
            }
        });
    });
}
function waitForHeight(nsPort_1, expectedHeight_1) {
    return __awaiter(this, arguments, void 0, function (nsPort, expectedHeight, timeout, interval) {
        var start, res, j, e_2;
        if (timeout === void 0) { timeout = 10000; }
        if (interval === void 0) { interval = 200; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    start = Date.now();
                    _a.label = 1;
                case 1:
                    if (!(Date.now() - start < timeout)) return [3 /*break*/, 9];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 6, , 7]);
                    return [4 /*yield*/, fetch("http://localhost:".concat(nsPort, "/chain/height"))];
                case 3:
                    res = _a.sent();
                    if (!res.ok) return [3 /*break*/, 5];
                    return [4 /*yield*/, res.json()];
                case 4:
                    j = _a.sent();
                    if (j.height >= expectedHeight)
                        return [2 /*return*/, true];
                    _a.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    e_2 = _a.sent();
                    return [3 /*break*/, 7];
                case 7: return [4 /*yield*/, sleep(interval)];
                case 8:
                    _a.sent();
                    return [3 /*break*/, 1];
                case 9: return [2 /*return*/, false];
            }
        });
    });
}
function waitForCondition(checkFn_1) {
    return __awaiter(this, arguments, void 0, function (checkFn, timeout, interval) {
        var start, e_3;
        if (timeout === void 0) { timeout = 10000; }
        if (interval === void 0) { interval = 200; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    start = Date.now();
                    _a.label = 1;
                case 1:
                    if (!(Date.now() - start < timeout)) return [3 /*break*/, 7];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, checkFn()];
                case 3:
                    if (_a.sent())
                        return [2 /*return*/, true];
                    return [3 /*break*/, 5];
                case 4:
                    e_3 = _a.sent();
                    return [3 /*break*/, 5];
                case 5: return [4 /*yield*/, sleep(interval)];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 1];
                case 7: return [2 /*return*/, false];
            }
        });
    });
}
function ensureLogsDir() {
    var logsDir = path_1.default.join(process.cwd(), '..', 'neuroswarm', 'tmp', 'logs');
    if (!fs_1.default.existsSync(logsDir))
        fs_1.default.mkdirSync(logsDir, { recursive: true });
    return logsDir;
}
var _startedChildren = [];
function startServerWithLogs(serverPath, env, tag, cwd, args) {
    if (env === void 0) { env = {}; }
    if (tag === void 0) { tag = 'server'; }
    if (args === void 0) { args = []; }
    var logsDir = ensureLogsDir();
    var logFile = path_1.default.join(logsDir, "".concat(tag, "-").concat(Date.now(), ".log"));
    var errFile = path_1.default.join(logsDir, "".concat(tag, "-").concat(Date.now(), ".err"));
    var logStream = fs_1.default.createWriteStream(logFile, { flags: 'a' });
    var errStream = fs_1.default.createWriteStream(errFile, { flags: 'a' });
    // ensure args and spawnArgs are all strings to avoid child_process internal errors
    var safeArgs = (args || []).map(function (a) { return String(a); });
    var spawnArgs = __spreadArray([String(serverPath)], safeArgs, true);
    // use pipe stdio so we can manage streams and close them properly
    // ensure env values are strings
    var safeEnv = __assign({}, process.env);
    for (var _i = 0, _a = Object.entries(env || {}); _i < _a.length; _i++) {
        var _b = _a[_i], k = _b[0], v = _b[1];
        safeEnv[k] = v === undefined ? undefined : String(v);
    }
    var child;
    try {
        child = (0, child_process_1.spawn)('node', spawnArgs, { env: safeEnv, stdio: ['ignore', 'pipe', 'pipe'], cwd: cwd || process.cwd(), detached: false });
    }
    catch (err) {
        // close streams and surface the error for debugging
        try {
            logStream.end();
        }
        catch (e) { }
        try {
            errStream.end();
        }
        catch (e) { }
        console.error('[testHelpers] spawn failed:', err && err.message, { spawnArgs: spawnArgs, safeEnvKeys: Object.keys(safeEnv), cwd: String(cwd || process.cwd()) });
        throw err;
    }
    // pipe child output to our write streams
    if (child.stdout)
        child.stdout.pipe(logStream);
    if (child.stderr)
        child.stderr.pipe(errStream);
    // attach streams so they can be closed during cleanup
    try {
        child._logStream = logStream;
        child._errStream = errStream;
    }
    catch (e) { /* ignore */ }
    // close streams when child exits
    child.on('exit', function () {
        try {
            logStream.end();
        }
        catch (e) { }
        try {
            errStream.end();
        }
        catch (e) { }
    });
    _startedChildren.push(child);
    return { child: child, logFile: logFile, errFile: errFile };
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
                        // close any write streams opened for logs if present
                        try {
                            var ls = child._logStream;
                            if (ls && !ls.destroyed)
                                ls.end();
                        }
                        catch (e) { }
                        try {
                            var es = child._errStream;
                            if (es && !es.destroyed)
                                es.end();
                        }
                        catch (e) { }
                    };
                    var timeout = setTimeout(function () {
                        try {
                            child.kill('SIGKILL');
                        }
                        catch (e) { /* ignore */ }
                        onExit();
                    }, timeoutMs);
                    child.on('exit', function () {
                        clearTimeout(timeout);
                        onExit();
                    });
                    try {
                        if (child.pid) {
                            if (process.platform !== 'win32') {
                                try {
                                    process.kill(-child.pid, 'SIGTERM');
                                }
                                catch (e) { /* ignore */ }
                            }
                            else {
                                try {
                                    var tk = (0, child_process_1.spawn)('taskkill', ['/PID', String(child.pid), '/T', '/F']);
                                    tk.on('exit', function () { });
                                }
                                catch (e) { }
                                try {
                                    child.kill('SIGTERM');
                                }
                                catch (e) { }
                            }
                        }
                    }
                    catch (e) {
                        clearTimeout(timeout);
                        onExit();
                    }
                    // Ensure streams are closed even if kill didn't finish
                    try {
                        var ls = child._logStream;
                        if (ls && !ls.destroyed)
                            ls.end();
                    }
                    catch (e) { }
                    try {
                        var es = child._errStream;
                        if (es && !es.destroyed)
                            es.end();
                    }
                    catch (e) { }
                })];
        });
    });
}
// global cleanup for any started children in case a test forgets to kill them
process.on('beforeExit', function () { return __awaiter(void 0, void 0, void 0, function () {
    var _i, _startedChildren_1, c, e_4, e_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 7, , 8]);
                _i = 0, _startedChildren_1 = _startedChildren;
                _a.label = 1;
            case 1:
                if (!(_i < _startedChildren_1.length)) return [3 /*break*/, 6];
                c = _startedChildren_1[_i];
                _a.label = 2;
            case 2:
                _a.trys.push([2, 4, , 5]);
                return [4 /*yield*/, killChild(c, 2000)];
            case 3:
                _a.sent();
                return [3 /*break*/, 5];
            case 4:
                e_4 = _a.sent();
                return [3 /*break*/, 5];
            case 5:
                _i++;
                return [3 /*break*/, 1];
            case 6: return [3 /*break*/, 8];
            case 7:
                e_5 = _a.sent();
                return [3 /*break*/, 8];
            case 8: return [2 /*return*/];
        }
    });
}); });
function canonicalize(obj) {
    if (typeof obj !== 'object' || obj === null)
        return JSON.stringify(obj);
    if (Array.isArray(obj))
        return '[' + obj.map(canonicalize).join(',') + ']';
    var keys = Object.keys(obj).sort();
    return '{' + keys.map(function (k) { return JSON.stringify(k) + ':' + canonicalize(obj[k]); }).join(',') + '}';
}
function txIdFor(tx) {
    var txCopy = __assign({}, tx);
    delete txCopy.signature;
    return crypto_1.default.createHash('sha256').update(Buffer.from(canonicalize(txCopy), 'utf8')).digest('hex');
}
