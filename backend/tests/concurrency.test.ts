import request from "supertest";
import app from "../src/app";
import pool from "../src/db/postgres";
import redis from "../src/db/redis";

describe("Concurrency - oversell protection", () => {
  let productId: number;

  beforeEach(async () => {
    await pool.query(
      "DELETE FROM order_items USING orders WHERE order_items.order_id = orders.id AND orders.customer_id = $1",
      ["test_customer"],
    );
    await pool.query("DELETE FROM orders WHERE customer_id = $1", [
      "test_customer",
    ]);
    await pool.query("DELETE FROM products WHERE sku = $1", [
      "TEST-CONCURRENCY",
    ]);

    const { rows } = await pool.query(
      `INSERT INTO products (sku, name, description, price, stock)
       VALUES ('TEST-CONCURRENCY', 'Test Product', 'Test', 99.99, 1)
       RETURNING id`,
    );
    productId = rows[0].id;
  });

  afterAll(async () => {
    await pool.query(
      "DELETE FROM order_items USING orders WHERE order_items.order_id = orders.id AND orders.customer_id = $1",
      ["test_customer"],
    );
    await pool.query("DELETE FROM orders WHERE customer_id = $1", [
      "test_customer",
    ]);
    await pool.query("DELETE FROM products WHERE sku = $1", [
      "TEST-CONCURRENCY",
    ]);
    await pool.end();
    await redis.quit();
  });

  it("only allows one order when two requests race for the last item", async () => {
    const orderBody = {
      customerId: "test_customer",
      items: [{ productId, quantity: 1 }],
      totalAmount: 99.99,
    };

    const [res1, res2] = await Promise.all([
      request(app).post("/orders").send(orderBody),
      request(app).post("/orders").send(orderBody),
    ]);

    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);

    const { rows } = await pool.query(
      "SELECT stock FROM products WHERE id = $1",
      [productId],
    );
    expect(rows[0].stock).toBe(0);
  });

  it("never lets stock go below zero", async () => {
    const orderBody = {
      customerId: "test_customer",
      items: [{ productId, quantity: 1 }],
      totalAmount: 99.99,
    };

    await Promise.all([
      request(app).post("/orders").send(orderBody),
      request(app).post("/orders").send(orderBody),
      request(app).post("/orders").send(orderBody),
    ]);

    const { rows } = await pool.query(
      "SELECT stock FROM products WHERE id = $1",
      [productId],
    );
    expect(rows[0].stock).toBeGreaterThanOrEqual(0);
  });
});