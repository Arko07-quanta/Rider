import express, { Request, Response } from "express";
import pool from "../db";
import { authenticateAdmin } from "../middleware/authMiddleware";

const router = express.Router();

router.get("/pending-drivers", authenticateAdmin, async (req: any, res: any) => {
  try {
    const result = await pool.query(`
      SELECT u.user_id, u.name, d.license_number, v.plate_number, v.model, vt.type_name
      FROM users u
      JOIN drivers d ON u.user_id = d.user_id
      JOIN vehicles v ON v.driver_id = d.user_id
      JOIN vehicle_types vt ON v.vehicle_type_id = vt.vehicle_type_id
      WHERE d.is_verified = FALSE
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/verify-driver/:id", authenticateAdmin, async (req: any, res: any) => {
  const { id } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    // 1. Mark driver as verified
    await client.query(
      "UPDATE drivers SET is_verified = TRUE WHERE user_id = $1",
      [id]
    );

    // 2. Commit
    await client.query("COMMIT");

    res.json({ message: "Driver verified successfully" });

  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Verify driver error:", err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

router.get("/users", authenticateAdmin, async (req: any, res: any) => {
  try {
    const result = await pool.query(`
      SELECT user_id, name, email, role, status, created_at
      FROM users
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/active-rides", authenticateAdmin, async (req: any, res: any) => {
  try {
    const result = await pool.query(`
      SELECT r.ride_id, u1.name AS rider_name, u2.name AS driver_name, r.status, r.distance AS distance_km, r.fare AS fare_amount
      FROM rides r
      JOIN ride_requests req ON r.request_id = req.request_id
      JOIN users u1 ON req.rider_id = u1.user_id
      LEFT JOIN users u2 ON r.driver_id = u2.user_id
      WHERE r.status = 'ongoing'
      ORDER BY r.ride_id DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Get active rides error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/system-logs", authenticateAdmin, async (req: any, res: any) => {
  try {
    const result = await pool.query(`
      SELECT a.action_id, u.name AS admin_name, a.action_description, a.timestamp
      FROM admin_actions a
      JOIN users u ON a.admin_id = u.user_id
      ORDER BY a.timestamp DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Get system logs error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;