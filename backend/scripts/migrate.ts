require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("../src/db/postgres");

async function main() {
  const schemaPath = path.join(__dirname, "..", "src", "db", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");

  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("Migration completed");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed", err);
  process.exit(1);
});
