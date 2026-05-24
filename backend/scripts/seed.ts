require("dotenv").config();
const pool = require("../src/db/postgres");

const products = [
  {
    sku: "SKU-001",
    name: "Wireless Headphones",
    description:
      "Comfortable over-ear wireless headphones with 30 hour battery life.",
    price: 129.99,
    stock: 12,
  },
  {
    sku: "SKU-002",
    name: "Mechanical Keyboard",
    description: "Compact 65% mechanical keyboard with hot-swappable switches.",
    price: 89.5,
    stock: 5,
  },
  {
    sku: "SKU-003",
    name: "USB-C Hub",
    description: "7-in-1 USB-C hub with HDMI, ethernet, SD, and USB-A ports.",
    price: 39.0,
    stock: 25,
  },
  {
    sku: "SKU-004",
    name: "Laptop Stand",
    description: "Aluminium adjustable laptop stand for laptops up to 17 inch.",
    price: 49.95,
    stock: 8,
  },
  {
    sku: "SKU-005",
    name: "Webcam 1080p",
    description: "1080p webcam with auto-focus and dual stereo microphones.",
    price: 59.0,
    stock: 0,
  },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM payment_events");
    await client.query("DELETE FROM payments");
    await client.query("DELETE FROM order_items");
    await client.query("DELETE FROM orders");
    await client.query("DELETE FROM products");

    for (const p of products) {
      await client.query(
        `INSERT INTO products (sku, name, description, price, stock)
         VALUES ($1, $2, $3, $4, $5)`,
        [p.sku, p.name, p.description, p.price, p.stock],
      );
    }

    await client.query("COMMIT");
    console.log(`Seeded ${products.length} products`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Seed failed", err);
  process.exit(1);
});
