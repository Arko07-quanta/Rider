import express, { Request, Response } from "express";
import pool from "../db";
import { authenticateAdmin } from "../middleware/authMiddleware";
import { logAdminAction } from "../utils/logger";

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

    // 3. Log Action
    await logAdminAction(req.user.id, `Admin ${req.user.name} verified driver with ID ${id}`);

    res.json({ message: "Driver verified successfully" });

  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Verify driver error:", err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

router.delete("/decline-driver/:id", authenticateAdmin, async (req: any, res: any) => {
  const { id } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query("CALL reject_driver_application($1, $2)", [id, req.user.id]);
    
    // Log Action
    await logAdminAction(req.user.id, `Admin ${req.user.name} declined driver application with ID ${id}`);

    res.json({ message: "Driver declined and deleted" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Decline driver error:", err);
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
      SELECT r.ride_id, u1.name AS rider_name, u2.name AS driver_name, r.status,
             r.distance AS distance_km, r.fare AS fare_amount,
             lp.address AS pickup_address, ld.address AS dropoff_address
      FROM rides r
      JOIN ride_requests req ON r.request_id = req.request_id
      JOIN users u1 ON req.rider_id = u1.user_id
      LEFT JOIN users u2 ON r.driver_id = u2.user_id
      LEFT JOIN locations lp ON r.pickup_location_id = lp.location_id
      LEFT JOIN locations ld ON r.dropoff_location_id = ld.location_id
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

router.get("/dashboard-stats", authenticateAdmin, async (req: any, res: any) => {
  try {
    // 1. Total Revenue & Completed Rides
    const financialStats = await pool.query(`
      SELECT 
        COALESCE(SUM(fare), 0) AS total_revenue,
        COUNT(*) AS total_completed_rides,
        AVG(fare) AS avg_fare
      FROM rides 
      WHERE status = 'completed'
    `);

    // 2. User Growth (Last 7 Days)
    const userGrowth = await pool.query(`
      SELECT 
        DATE(created_at) AS day,
        COUNT(*) AS signup_count
      FROM users
      WHERE created_at > CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `);

    // 3. Ride Status Counts
    const statusCounts = await pool.query(`
      SELECT status, COUNT(*) AS count
      FROM rides
      GROUP BY status
    `);

    res.json({
      financials: financialStats.rows[0],
      growth: userGrowth.rows,
      statusBreakdown: statusCounts.rows
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/hotspots", authenticateAdmin, async (req: any, res: any) => {
  try {
    // Top 5 Pickups
    const pickups = await pool.query(`
      SELECT l.address, COUNT(*) AS ride_count
      FROM rides r
      JOIN locations l ON r.pickup_location_id = l.location_id
      GROUP BY l.address
      ORDER BY ride_count DESC
      LIMIT 5
    `);

    // Top 5 Dropoffs
    const dropoffs = await pool.query(`
      SELECT l.address, COUNT(*) AS ride_count
      FROM rides r
      JOIN locations l ON r.dropoff_location_id = l.location_id
      GROUP BY l.address
      ORDER BY ride_count DESC
      LIMIT 5
    `);

    res.json({ pickups: pickups.rows, dropoffs: dropoffs.rows });
  } catch (err) {
    console.error("Hotspots error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/run-maintenance", authenticateAdmin, async (req: any, res: any) => {
  try {
    const adminId = req.user.id;
    // Call the stored procedure
    await pool.query("CALL sp_system_maintenance($1)", [adminId]);
    
    // Express level logging (SP already logs internally, but this adds consistency)
    await logAdminAction(adminId, `Admin ${req.user.name} initiated system maintenance`);

    res.json({ message: "System maintenance procedure executed successfully." });
  } catch (err) {
    console.error("Maintenance procedure error:", err);
    res.status(500).json({ message: "Failed to execute maintenance procedure." });
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

router.get("/analytics-drivers", authenticateAdmin, async (req: any, res: any) => {
  try {
    const result = await pool.query(`
      SELECT u.name, d.license_number, get_driver_total_earnings(u.user_id) as total_earnings
      FROM users u
      JOIN drivers d ON u.user_id = d.user_id
      ORDER BY total_earnings DESC
      LIMIT 5
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Analytics driver error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/analytics-vehicles", authenticateAdmin, async (req: any, res: any) => {
  try {
    const result = await pool.query(`
      SELECT vt.type_name, COUNT(r.ride_id) as total_rides
      FROM vehicle_types vt
      JOIN ride_requests rq ON vt.vehicle_type_id = rq.vehicle_type_id
      JOIN rides r ON rq.request_id = r.request_id
      WHERE r.status = 'completed'
      GROUP BY vt.type_name
      ORDER BY total_rides DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Analytics vehicle error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/analytics-cashflow", authenticateAdmin, async (req: any, res: any) => {
  try {
    const result = await pool.query(`
      SELECT 
          DATE(t.timestamp) as transaction_date,
          SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END) as total_credits,
          SUM(CASE WHEN t.type = 'debit' THEN t.amount ELSE 0 END) as total_debits
      FROM transactions t
      GROUP BY DATE(t.timestamp)
      ORDER BY transaction_date DESC
      LIMIT 7
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Analytics cashflow error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Coupon Management
router.get("/coupons", authenticateAdmin, async (req: any, res: any) => {
  try {
    const result = await pool.query(
      "SELECT * FROM promotions ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Get admin coupons error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/coupons", authenticateAdmin, async (req: any, res: any) => {
  const { 
    code, discount_type, value, min_fare_amount, max_discount_amount, 
    usage_limit, expiry_date, is_active,
    target_min_distance, target_min_rides, target_min_spend, target_app_age_days, is_public
  } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO promotions (
        code, discount_type, value, min_fare_amount, max_discount_amount, 
        usage_limit, expiry_date, is_active,
        target_min_distance, target_min_rides, target_min_spend, target_app_age_days, is_public
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        code.toUpperCase(), discount_type, value, min_fare_amount || 0, max_discount_amount || null, 
        usage_limit || null, expiry_date || null, is_active ?? true,
        target_min_distance || 0, target_min_rides || 0, target_min_spend || 0, target_app_age_days || 0, is_public ?? false
      ]
    );
    
    await logAdminAction(req.user.id, `Admin ${req.user.name} created new coupon: ${code.toUpperCase()}`);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error("Create coupon error:", err);
    if (err.code === '23505') return res.status(400).json({ message: "Coupon code already exists" });
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/coupons/:id", authenticateAdmin, async (req: any, res: any) => {
  const { id } = req.params;
  const { 
    code, discount_type, value, min_fare_amount, max_discount_amount, 
    usage_limit, expiry_date, is_active,
    target_min_distance, target_min_rides, target_min_spend, target_app_age_days, is_public
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE promotions 
       SET code = $1, discount_type = $2, value = $3, min_fare_amount = $4, max_discount_amount = $5, 
           usage_limit = $6, expiry_date = $7, is_active = $8,
           target_min_distance = $9, target_min_rides = $10, target_min_spend = $11, target_app_age_days = $12, is_public = $13
       WHERE promo_id = $14 RETURNING *`,
      [
        code.toUpperCase(), discount_type, value, min_fare_amount || 0, max_discount_amount || null, 
        usage_limit || null, expiry_date || null, is_active ?? true,
        target_min_distance || 0, target_min_rides || 0, target_min_spend || 0, target_app_age_days || 0, is_public ?? false,
        id
      ]
    );
    
    if (result.rows.length === 0) return res.status(404).json({ message: "Coupon not found" });
    
    await logAdminAction(req.user.id, `Admin ${req.user.name} updated coupon: ${code.toUpperCase()}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update coupon error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/coupons/:id", authenticateAdmin, async (req: any, res: any) => {
  const { id } = req.params;
  try {
    const checkRes = await pool.query("SELECT code FROM promotions WHERE promo_id = $1", [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ message: "Coupon not found" });
    
    const code = checkRes.rows[0].code;
    await pool.query("DELETE FROM promotions WHERE promo_id = $1", [id]);
    
    await logAdminAction(req.user.id, `Admin ${req.user.name} deleted coupon: ${code}`);
    res.json({ message: "Coupon deleted successfully" });
  } catch (err) {
    console.error("Delete coupon error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;