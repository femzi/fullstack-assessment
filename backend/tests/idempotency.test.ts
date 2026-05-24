import request from "supertest";
import app from "../src/app";
import pool from "../src/db/postgres";
import redis from "../src/db/redis";

describe("Idempotency - charge order", () => {
  let orderId: number;
  let productId: number;

  beforeEach(async () => {
    await pool.query(
      "DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE customer_id = $1)",
      ["test_customer"],
    );
    await pool.query(
      "DELETE FROM order_items USING orders WHERE order_items.order_id = orders.id AND orders.customer_id = $1",
      ["test_customer"],
    );
    await pool.query("DELETE FROM orders WHERE customer_id = $1", [
      "test_customer",
    ]);
    await pool.query("DELETE FROM products WHERE sku = $1", ["TEST-IDEM"]);

    const { rows: productRows } = await pool.query(
      `INSERT INTO products (sku, name, description, price, stock)
       VALUES ('TEST-IDEM', 'Idem Product', 'Test', 99.99, 10)
       RETURNING id`,
    );
    productId = productRows[0].id;

    const { rows: orderRows } = await pool.query(
      `INSERT INTO orders (customer_id, total_amount, status)
       VALUES ('test_customer', 99.99, 'PENDING')
       RETURNING id`,
    );
    orderId = orderRows[0].id;

    await pool.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
       VALUES ($1, $2, 1, 99.99)`,
      [orderId, productId],
    );
  });

  afterAll(async () => {
    await pool.query(
      "DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE customer_id = $1)",
      ["test_customer"],
    );
    await pool.query(
      "DELETE FROM order_items USING orders WHERE order_items.order_id = orders.id AND orders.customer_id = $1",
      ["test_customer"],
    );
    await pool.query("DELETE FROM orders WHERE customer_id = $1", [
      "test_customer",
    ]);
    await pool.query("DELETE FROM products WHERE sku = $1", ["TEST-IDEM"]);
    await pool.end();
    await redis.quit();
  });

  it("charges only once when same idempotency key is used twice", async () => {
    const key = `test-idem-key-${Date.now()}`;

    let res1: any;
    for (let i = 0; i < 10; i++) {
      res1 = await request(app)
        .post("/payments/charge")
        .set("Idempotency-Key", key)
        .send({ orderId });
      if (res1.status === 200) break;
    }

    const res2 = await request(app)
      .post("/payments/charge")
      .set("Idempotency-Key", key)
      .send({ orderId });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const { rows } = await pool.query(
      "SELECT * FROM payments WHERE order_id = $1",
      [orderId],
    );
    expect(rows).toHaveLength(1);
  });

  it("returns 409 when trying to charge an already paid order", async () => {
    await pool.query(
      "UPDATE orders SET status = 'PAID' WHERE id = $1",
      [orderId],
    );

    const res = await request(app)
      .post("/payments/charge")
      .send({ orderId });

    expect(res.status).toBe(409);
  });

  it("returns 404 when order does not exist", async () => {
    const res = await request(app)
      .post("/payments/charge")
      .send({ orderId: 999999 });

    expect(res.status).toBe(404);
  });
});