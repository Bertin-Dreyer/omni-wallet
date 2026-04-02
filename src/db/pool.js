import pg from "pg";
import { config } from "../config/index.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.db.appUrl,
  ssl: config.env === 'production' ? { rejectUnauthorized: true } : false,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});


if (config.env === 'development') {
  pool.on('connect', () => {
    console.log('Connected to the database');
  });
}

export default pool;
