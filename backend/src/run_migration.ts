import fs from "fs";
import path from "path";
import pool from "./db";

async function run() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "Rider_DataBase_maker.txt"), "utf-8");
    console.log("Running migration...");
    await pool.query(sql);
    console.log("Migration successful!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}
run();
