"use strict";
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
var globals_1 = require("@jest/globals");
var supertest_1 = require("supertest");
var jsonwebtoken_1 = require("jsonwebtoken");
var index_1 = require("../src/index");
var server;
var authToken;
var JWT_SECRET = process.env.JWT_SECRET || "default-secret";
(0, globals_1.beforeAll)(function () { return __awaiter(void 0, void 0, void 0, function () {
    var loginResponse;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                server = index_1.default.listen(0);
                return [4 /*yield*/, (0, supertest_1.default)(index_1.default)
                        .post("/auth/login")
                        .send({ username: "admin", password: "password" })];
            case 1:
                loginResponse = _a.sent();
                authToken = loginResponse.body.token;
                return [2 /*return*/];
        }
    });
}); });
(0, globals_1.afterAll)(function () { return __awaiter(void 0, void 0, void 0, function () {
    var err_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, new Promise(function (resolve) { return server.close(function () { return resolve(); }); })];
            case 1:
                _a.sent();
                _a.label = 2;
            case 2:
                _a.trys.push([2, 4, , 5]);
                return [4 /*yield*/, (0, index_1.shutdown)()];
            case 3:
                _a.sent();
                return [3 /*break*/, 5];
            case 4:
                err_1 = _a.sent();
                console.error('Error during test shutdown', err_1);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
(0, globals_1.describe)("Gateway API", function () {
    (0, globals_1.it)("should return manifest data", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(index_1.default).get("/v1/manifests/QmTest123")];
                case 1:
                    response = _a.sent();
                    (0, globals_1.expect)(response.status).toBe(200);
                    (0, globals_1.expect)(response.body.cid).toBe("QmTest123");
                    return [2 /*return*/];
            }
        });
    }); });
    (0, globals_1.it)("should return 404 for unknown manifest", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(index_1.default).get("/v1/manifests/unknown")];
                case 1:
                    response = _a.sent();
                    (0, globals_1.expect)(response.status).toBe(404);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, globals_1.it)("should return attestations", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(index_1.default)
                        .get("/v1/attestations/QmTest123")
                        .set("Authorization", "Bearer ".concat(authToken))];
                case 1:
                    response = _a.sent();
                    (0, globals_1.expect)(response.status).toBe(200);
                    (0, globals_1.expect)(Array.isArray(response.body.attestations)).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, globals_1.it)("should return peers", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(index_1.default)
                        .get("/v1/peers")
                        .set("Authorization", "Bearer ".concat(authToken))];
                case 1:
                    response = _a.sent();
                    (0, globals_1.expect)(response.status).toBe(200);
                    (0, globals_1.expect)(Array.isArray(response.body.peers)).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, globals_1.it)("should return metrics", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(index_1.default)
                        .get("/v1/metrics")
                        .set("Authorization", "Bearer ".concat(authToken))];
                case 1:
                    response = _a.sent();
                    (0, globals_1.expect)(response.status).toBe(200);
                    (0, globals_1.expect)(response.body.catalogSize).toBeDefined();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, globals_1.it)("should search index", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(index_1.default).get("/v1/index/search?q=neural")];
                case 1:
                    response = _a.sent();
                    (0, globals_1.expect)(response.status).toBe(200);
                    (0, globals_1.expect)(response.body.results.length).toBeGreaterThan(0);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, globals_1.it)("should search by tag", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(index_1.default).get("/v1/index/search?tag=ai")];
                case 1:
                    response = _a.sent();
                    (0, globals_1.expect)(response.status).toBe(200);
                    (0, globals_1.expect)(response.body.results.length).toBeGreaterThan(0);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, globals_1.it)("should return lineage", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(index_1.default).get("/v1/index/lineage/QmTest123")];
                case 1:
                    response = _a.sent();
                    (0, globals_1.expect)(response.status).toBe(200);
                    (0, globals_1.expect)(Array.isArray(response.body.lineage)).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, globals_1.it)("should return confidence score", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(index_1.default).get("/v1/index/confidence/QmTest123")];
                case 1:
                    response = _a.sent();
                    (0, globals_1.expect)(response.status).toBe(200);
                    (0, globals_1.expect)(response.body.overallConfidence).toBeDefined();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, globals_1.it)("should return 404 for unknown confidence", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(index_1.default).get("/v1/index/confidence/unknown")];
                case 1:
                    response = _a.sent();
                    (0, globals_1.expect)(response.status).toBe(404);
                    return [2 /*return*/];
            }
        });
    }); });
    (0, globals_1.it)("should reject invalid token", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(index_1.default)
                        .get("/v1/attestations/QmTest123")
                        .set("Authorization", "Bearer invalid-token")];
                case 1:
                    response = _a.sent();
                    (0, globals_1.expect)(response.status).toBe(400);
                    (0, globals_1.expect)(response.body.error).toBe("Invalid token");
                    return [2 /*return*/];
            }
        });
    }); });
    (0, globals_1.it)("should reject expired token", function () { return __awaiter(void 0, void 0, void 0, function () {
        var expiredToken, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    expiredToken = jsonwebtoken_1.default.sign({ username: "admin" }, JWT_SECRET, { expiresIn: "-1h" });
                    return [4 /*yield*/, (0, supertest_1.default)(index_1.default)
                            .get("/v1/peers")
                            .set("Authorization", "Bearer ".concat(expiredToken))];
                case 1:
                    response = _a.sent();
                    (0, globals_1.expect)(response.status).toBe(400);
                    (0, globals_1.expect)(response.body.error).toBe("Invalid token");
                    return [2 /*return*/];
            }
        });
    }); });
    (0, globals_1.it)("should reject missing token", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(index_1.default).get("/v1/metrics")];
                case 1:
                    response = _a.sent();
                    (0, globals_1.expect)(response.status).toBe(401);
                    (0, globals_1.expect)(response.body.error).toBe("Access denied");
                    return [2 /*return*/];
            }
        });
    }); });
});
