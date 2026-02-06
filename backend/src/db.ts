import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const isLocal = process.env.NODE_ENV !== "production";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});
