export {};
const express = require("express");
const pool = require("../db.ts");
const { authenticateAdmin } = require("../middleware/authMiddleware");
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

module.exports = router;