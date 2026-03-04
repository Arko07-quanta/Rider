export {};
const express = require("express");
const pool = require("../db.ts");
const { authenticateAdmin } = require("../middleware/authMiddleware");
const router = express.Router();


router.get("/pending-drivers", authenticateAdmin, async (req: any, res: any) => {
  try {
    const result = await pool.query(`
      SELECT u.name, d.license_number, v.plate_number, v.model, vt.type_name
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

module.exports = router;