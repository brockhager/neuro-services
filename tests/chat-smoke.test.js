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
var testHelpers_1 = require("./utils/testHelpers");
var path_1 = require("path");
var jsonwebtoken_1 = require("jsonwebtoken");
jest.setTimeout(30000);
function startNsNode(port) {
    if (port === void 0) { port = 4001; }
    var serverPath = path_1.default.resolve(__dirname, '..', '..', 'neuroswarm', 'ns-node', 'server.js');
    var env = __assign(__assign({}, process.env), { PORT: port.toString() });
    var child = (0, child_process_1.spawn)('node', [serverPath], { env: env, stdio: ['ignore', 'pipe', 'pipe'] });
    return child;
}
// We test gateway proxy behavior in a separate proxy-local test since building the full gateway can fail in CI.
test('ns-node responds with provenance fields', function () { return __awaiter(void 0, void 0, void 0, function () {
    var port, child, token, res, body, debug, dbg, e_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                port = 4001;
                child = startNsNode(port);
                // wait for server to start by listening to stdout
                return [4 /*yield*/, new Promise(function (resolve, reject) {
                        var timeout = setTimeout(function () {
                            reject(new Error('ns-node did not start fast enough'));
                        }, 10000);
                        child.stdout.on('data', function (d) {
                            var s = d.toString();
                            if (s.includes("ns-node local server started")) {
                                clearTimeout(timeout);
                                resolve(true);
                            }
                        });
                        child.stderr.on('data', function (d) { return console.error(d.toString()); });
                        child.on('error', function (err) { return reject(err); });
                    })];
            case 1:
                // wait for server to start by listening to stdout
                _a.sent();
                _a.label = 2;
            case 2:
                _a.trys.push([2, , 7, 12]);
                token = jsonwebtoken_1.default.sign({ username: 'test' }, 'test-secret');
                return [4 /*yield*/, fetch("http://localhost:".concat(port, "/chat"), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': "Bearer ".concat(token) },
                        body: JSON.stringify({ sender: 'test', content: 'hello' })
                    })];
            case 3:
                res = _a.sent();
                expect(res.status).toBe(200);
                return [4 /*yield*/, res.json()];
            case 4:
                body = _a.sent();
                expect(body).toHaveProperty('cid');
                expect(body).toHaveProperty('txSignature');
                expect(body.content).toContain('Echoing: hello');
                return [4 /*yield*/, fetch("http://localhost:".concat(port, "/debug/last-headers"))];
            case 5:
                debug = _a.sent();
                return [4 /*yield*/, debug.json()];
            case 6:
                dbg = _a.sent();
                expect(dbg.lastHeaders).toBeTruthy();
                expect(dbg.lastHeaders.authorization).toContain(token);
                return [3 /*break*/, 12];
            case 7:
                if (!child) return [3 /*break*/, 11];
                _a.label = 8;
            case 8:
                _a.trys.push([8, 10, , 11]);
                return [4 /*yield*/, (0, testHelpers_1.killChild)(child)];
            case 9:
                _a.sent();
                return [3 /*break*/, 11];
            case 10:
                e_1 = _a.sent();
                return [3 /*break*/, 11];
            case 11: return [7 /*endfinally*/];
            case 12: return [2 /*return*/];
        }
    });
}); });
