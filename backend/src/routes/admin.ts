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

router.get("/verified-today", authenticateAdmin, async(req: any, res: any) => {
  try {
    const result = await pool.query(`
      SELECT count(*) FROM drivers
      WHERE is_verified = TRUE AND TO_CHAR(SYSDATE, 'MON') = TO_CHAR(created_at, 'MON')
    `)
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
      "UPDATE drivers SET is_verified = TRUE, created_at = CURRENT_TIMESTAMP WHERE user_id = $1",
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
      SELECT u.user_id, u.name, u.email, u.role, u.status, u.created_at, a.access_level
      FROM users u
      LEFT JOIN admins a ON u.user_id = a.user_id
      ORDER BY u.created_at DESC
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

    // 2. Online Drivers Count (Active Fleet - updated in last 5 mins)
    const activeDrivers = await pool.query(`
      SELECT COUNT(*) AS active_drivers
      FROM drivers
      WHERE is_verified = TRUE 
        AND updated_at > NOW() - INTERVAL '5 minutes'
    `);

    // 3. User Growth (Last 7 Days)
    const userGrowth = await pool.query(`
      SELECT 
        DATE(created_at) AS day,
        COUNT(*) AS signup_count
      FROM users
      GROUP BY DATE(created_at)
      ORDER BY day DESC
      LIMIT 7
    `);

    // 4. Ride Status Breakdown
    const statusBreakdown = await pool.query(`
      SELECT status, COUNT(*) AS count
      FROM rides
      GROUP BY status
    `);

    res.json({
      financials: financialStats.rows[0],
      active_drivers: parseInt(activeDrivers.rows[0].active_drivers),
      growth: userGrowth.rows,
      statusBreakdown: statusBreakdown.rows
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
          SUM(CASE WHEN t.type = 'debit' THEN t.amount ELSE 0 END) as rider_payments,
          SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END) as driver_payouts,
          (SUM(CASE WHEN t.type = 'debit' THEN t.amount ELSE 0 END) - SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END)) as platform_revenue
      FROM transactions t
      WHERE t.ride_id IS NOT NULL
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

// ─── Trip Replay ──────────────────────────────────────────────────────────────

router.get("/trips", authenticateAdmin, async (req: any, res: any) => {
  try {
    const result = await pool.query(
      `SELECT r.ride_id, r.status, r.distance, r.fare, r.created_at,
              u1.name AS rider_name, u2.name AS driver_name
       FROM rides r
       JOIN ride_requests rq ON rq.request_id = r.request_id
       JOIN users u1 ON u1.user_id = rq.rider_id
       LEFT JOIN users u2 ON u2.user_id = r.driver_id
       WHERE r.status IN ('completed', 'ongoing')
       ORDER BY r.created_at DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Get trips error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/trips/:rideId/history", authenticateAdmin, async (req: any, res: any) => {
  const { rideId } = req.params;
  try {
    const result = await pool.query(
      `SELECT latitude, longitude, timestamp FROM trip_history WHERE ride_id = $1 ORDER BY timestamp ASC`,
      [rideId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Get trip history error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── Admin Level Management ────────────────────────────────────────────────────

router.post("/promote", authenticateAdmin, async (req: any, res: any) => {
  const { name_or_email, target_level = 1 } = req.body;
  const adminLevel = req.user.access_level ?? 0;

  if (adminLevel <= target_level && adminLevel !== 99) {
    return res.status(403).json({ message: `Insufficient admin level. You cannot promote someone to level ${target_level} if you are level ${adminLevel}.` });
  }

  if (!name_or_email?.trim()) {
    return res.status(400).json({ message: "name_or_email is required" });
  }

  const client = await pool.connect();
  try {
    const userRes = await client.query(
      `SELECT u.user_id, u.name, u.role, a.access_level as current_level, a.original_role
       FROM users u 
       LEFT JOIN admins a ON a.user_id = u.user_id
       WHERE (u.name = $1 OR u.email = $1)`,
      [name_or_email.trim()]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const target = userRes.rows[0];
    
    // Check if target is already an admin and has higher or equal level
    if (target.role === 'admin' && (target.current_level ?? 0) >= adminLevel && adminLevel !== 99) {
      return res.status(403).json({ message: "You cannot modify an admin with a level higher than or equal to yours." });
    }

    await client.query("BEGIN");
    await client.query("UPDATE users SET role = 'admin', token_version = token_version + 1 WHERE user_id = $1", [target.user_id]);
    await client.query(
      `INSERT INTO admins (user_id, access_level, original_role) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET access_level = $2, original_role = COALESCE(admins.original_role, EXCLUDED.original_role)`,
      [target.user_id, target_level, target.role === 'admin' ? (target.original_role || 'rider') : target.role]
    );
    await client.query("COMMIT");
    await logAdminAction(req.user.id, `Set ${target.name} (ID: ${target.user_id}) level to ${target_level}`);
    res.json({ message: `${target.name} level set to ${target_level} successfully` });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Promote error:", err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

router.post("/demote/:userId", authenticateAdmin, async (req: any, res: any) => {
  const { userId } = req.params;
  const adminLevel = req.user.access_level ?? 0;

  if (Number(userId) === req.user.id) {
    return res.status(400).json({ message: "You cannot demote yourself." });
  }

  const client = await pool.connect();
  try {
    const adminRes = await client.query(
      `SELECT a.original_role, a.access_level, u.name FROM admins a JOIN users u ON u.user_id = a.user_id WHERE a.user_id = $1`,
      [userId]
    );

    if (adminRes.rows.length === 0) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const target = adminRes.rows[0];

    // Level check
    if (target.access_level >= adminLevel && adminLevel !== 99) {
      return res.status(403).json({ message: "You cannot demote an admin with a level higher than or equal to yours." });
    }

    const restoreRole = target.original_role || 'rider';

    await client.query("BEGIN");
    await client.query("DELETE FROM admins WHERE user_id = $1", [userId]);
    await client.query("UPDATE users SET role = $1, token_version = token_version + 1 WHERE user_id = $2", [restoreRole, userId]);
    await client.query("COMMIT");
    await logAdminAction(req.user.id, `Demoted ${target.name} (ID: ${userId}) from admin back to ${restoreRole}`);
    res.json({ message: `${target.name} successfully demoted back to ${restoreRole}` });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Demote error:", err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

export default router;