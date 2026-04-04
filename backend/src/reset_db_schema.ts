import fs from "fs";
import path from "path";
import pool from "./db";

async function resetSchema() {
  const filePath = path.join(__dirname, "rider_database_maker.txt");
  const sql = fs.readFileSync(filePath, "utf-8");

  try {
    console.log("Resetting database schema using rider_database_maker.txt...");
    await pool.query(sql);
    console.log("Database schema reset successful!");
    process.exit(0);
  } catch (err) {
    console.error("Database schema reset failed:", err);
    process.exit(1);
  }
}

resetSchema();
