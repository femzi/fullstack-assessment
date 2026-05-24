import request from "supertest";
import app from "../src/app";
import pool from "../src/db/postgres";
import redis from "../src/db/redis";

describe("Admin auth", () => {
  afterAll(async () => {
    await pool.end();
    await redis.quit();
  });

  it("returns 401 when no token is provided to POST /admin/products", async () => {
    const res = await request(app).post("/admin/products").send({});
    expect(res.status).toBe(401);
  });

  it("returns 403 when wrong token is provided to POST /admin/products", async () => {
    const res = await request(app)
      .post("/admin/products")
      .set("Authorization", "Bearer wrong-token")
      .send({});
    expect(res.status).toBe(403);
  });

  it("returns 401 when no token is provided to GET /orders", async () => {
    const res = await request(app).get("/orders");
    expect(res.status).toBe(401);
  });

  it("returns 401 when no token is provided to PATCH /admin/products/:id", async () => {
    const res = await request(app)
      .patch("/admin/products/1")
      .send({ price: 9.99 });
    expect(res.status).toBe(401);
  });

  it("allows access with correct token", async () => {
    const res = await request(app)
      .post("/admin/products")
      .set("Authorization", `Bearer ${process.env.ADMIN_TOKEN || "change-me"}`)
      .send({ sku: "TEST-AUTH-001", name: "Auth Test", price: 9.99, stock: 1 });
    expect(res.status).toBe(201);

    await pool.query("DELETE FROM products WHERE sku = $1", ["TEST-AUTH-001"]);
  });
});