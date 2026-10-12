import request from "supertest";
import app from "../../src/app";

describe("Integration: Health & Routes", () => {
  it("GET / should return welcome message", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("GET /api/v1/health should return health status", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("GET /api/v1/health/live should return alive status", async () => {
    const res = await request(app).get("/api/v1/health/live");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("alive");
  });

  it("GET /api/v1/health/ready should return readiness with dependency checks", async () => {
    const res = await request(app).get("/api/v1/health/ready");
    expect(res.status).toBe(200);
    expect(res.body.checks.mongodb.status).toBe("up");
  });

  it("GET /metrics should expose Prometheus metrics", async () => {
    await request(app).get("/api/v1/health");

    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.text).toContain("http_requests_total");
    expect(res.text).toContain("process_cpu_user_seconds_total");
  });

  it("GET /unknown should return 404 with requestId", async () => {
    const res = await request(app).get("/api/v1/unknown-route");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.requestId).toBeDefined();
  });
});
