import { Pool } from "pg";
import { DATABASE_URL } from "../config/env";

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
});

export default pool;
