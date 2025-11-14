import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Server } from "http";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/index";

let server: Server;
let authToken: string;
const JWT_SECRET = process.env.JWT_SECRET || "default-secret";

beforeAll(async () => {
  server = app.listen(0);

  // Login to get token
  const loginResponse = await request(app)
    .post("/auth/login")
    .send({ username: "admin", password: "password" });
  authToken = loginResponse.body.token;
});

afterAll((done) => {
  server.close(done);
});

describe("Gateway API", () => {
  it("should return manifest data", async () => {
    const response = await request(app).get("/v1/manifests/QmTest123");
    expect(response.status).toBe(200);
    expect(response.body.cid).toBe("QmTest123");
  });

  it("should return 404 for unknown manifest", async () => {
    const response = await request(app).get("/v1/manifests/unknown");
    expect(response.status).toBe(404);
  });

  it("should return attestations", async () => {
    const response = await request(app)
      .get("/v1/attestations/QmTest123")
      .set("Authorization", `Bearer ${authToken}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.attestations)).toBe(true);
  });

  it("should return peers", async () => {
    const response = await request(app)
      .get("/v1/peers")
      .set("Authorization", `Bearer ${authToken}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.peers)).toBe(true);
  });

  it("should return metrics", async () => {
    const response = await request(app)
      .get("/v1/metrics")
      .set("Authorization", `Bearer ${authToken}`);
    expect(response.status).toBe(200);
    expect(response.body.catalogSize).toBeDefined();
  });

  it("should search index", async () => {
    const response = await request(app).get("/v1/index/search?q=neural");
    expect(response.status).toBe(200);
    expect(response.body.results.length).toBeGreaterThan(0);
  });

  it("should search by tag", async () => {
    const response = await request(app).get("/v1/index/search?tag=ai");
    expect(response.status).toBe(200);
    expect(response.body.results.length).toBeGreaterThan(0);
  });

  it("should return lineage", async () => {
    const response = await request(app).get("/v1/index/lineage/QmTest123");
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.lineage)).toBe(true);
  });

  it("should return confidence score", async () => {
    const response = await request(app).get("/v1/index/confidence/QmTest123");
    expect(response.status).toBe(200);
    expect(response.body.overallConfidence).toBeDefined();
  });

  it("should return 404 for unknown confidence", async () => {
    const response = await request(app).get("/v1/index/confidence/unknown");
    expect(response.status).toBe(404);
  });

  it("should reject invalid token", async () => {
    const response = await request(app)
      .get("/v1/attestations/QmTest123")
      .set("Authorization", "Bearer invalid-token");
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid token");
  });

  it("should reject expired token", async () => {
    const expiredToken = jwt.sign({ username: "admin" }, JWT_SECRET, { expiresIn: "-1h" });
    const response = await request(app)
      .get("/v1/peers")
      .set("Authorization", `Bearer ${expiredToken}`);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid token");
  });

  it("should reject missing token", async () => {
    const response = await request(app).get("/v1/metrics");
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Access denied");
  });
});