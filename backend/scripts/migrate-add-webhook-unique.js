require("dotenv").config();
const pool = require("../src/db/postgres");

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE payment_events
      ADD CONSTRAINT payment_events_provider_event_id_unique
      UNIQUE (provider_event_id);
    `);
    console.log("Migration completed: added unique constraint to payment_events");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed", err);
  process.exit(1);
});