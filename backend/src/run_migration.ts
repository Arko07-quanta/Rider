import fs from "fs";
import path from "path";
import pool from "./db";

async function run() {
  try {
    console.log("Running incremental migration: and adding duration column...");
    await pool.query("ALTER TABLE rides ADD COLUMN IF NOT EXISTS duration NUMERIC(10,2) DEFAULT 0.00 CHECK (duration >= 0)");
    console.log("Migration successful!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}
run();
