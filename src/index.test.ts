import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import app from "./index";

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
    const response = await request(app).get("/v1/attestations/QmTest123");
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.attestations)).toBe(true);
  });

  it("should return peers", async () => {
    const response = await request(app).get("/v1/peers");
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.peers)).toBe(true);
  });

  it("should return metrics", async () => {
    const response = await request(app).get("/v1/metrics");
    expect(response.status).toBe(200);
    expect(response.body.catalogSize).toBeDefined();
  });

  it("should return health status", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });
});