import express from "express";
import pool from "../db";
import { authenticateToken } from "../middleware/authMiddleware";
import { io } from "../index";

const router = express.Router();

async function insertLocation(client: any, lat: number, lng: number, address: string): Promise<number> {
  const res = await client.query(
    `INSERT INTO locations (latitude, longitude, address) VALUES ($1, $2, $3) RETURNING location_id`,
    [lat, lng, address]
  );
  return res.rows[0].location_id;
}

router.get("/vehicle-types", authenticateToken, async (req: any, res: any) => {
  try {
    const result = await pool.query(
      `SELECT vehicle_type_id, type_name, max_passengers, base_fare, minimum_fare, fare_per_km FROM vehicle_types ORDER BY vehicle_type_id ASC`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error("Vehicle types error:", err);
    res.status(500).json({ message: "Failed to fetch vehicle types" });
  }
});

router.get("/coupons", authenticateToken, async (req: any, res: any) => {
  const user_id = req.user.id;
  try {
    const result = await pool.query(
      `SELECT p.*, COALESCE(uc.is_used, FALSE) as is_used, uc.earned_at
       FROM promotions p
       LEFT JOIN user_coupons uc ON p.promo_id = uc.promo_id AND uc.user_id = $1
       WHERE p.is_active = TRUE 
         AND (p.expiry_date >= CURRENT_DATE OR p.expiry_date IS NULL)
         AND (
           (p.is_public = TRUE AND (uc.is_used IS FALSE OR uc.is_used IS NULL))
           OR 
           (p.is_public = FALSE AND uc.user_id IS NOT NULL AND uc.is_used IS FALSE)
         )
       ORDER BY p.is_public DESC, p.expiry_date ASC NULLS LAST`,
      [user_id]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error("Get coupons error:", err);
    res.status(500).json({ message: "Failed to fetch coupons" });
  }
});

router.post("/validate-coupon", authenticateToken, async (req: any, res: any) => {
  const { code, fare } = req.body;
  const user_id = req.user.id;

  try {
    const promoRes = await pool.query(
      `SELECT p.*, uc.is_used 
       FROM promotions p
       LEFT JOIN user_coupons uc ON p.promo_id = uc.promo_id AND uc.user_id = $1
       WHERE p.code = $2 AND p.is_active = TRUE AND (p.expiry_date >= CURRENT_DATE OR p.expiry_date IS NULL)`,
      [user_id, code]
    );

    if (promoRes.rows.length === 0) {
      return res.status(404).json({ message: "Invalid or expired coupon code" });
    }

    const promo = promoRes.rows[0];

    // Check if user has the coupon and if it's already used
    if (promo.is_used) {
      return res.status(400).json({ message: "Coupon already used" });
    }

    // Check minimum fare
    if (fare < Number(promo.min_fare_amount)) {
      return res.status(400).json({ 
        message: `Minimum fare of $${promo.min_fare_amount} required for this coupon` 
      });
    }

    let discount = 0;
    if (promo.discount_type === 'percentage') {
      discount = (fare * Number(promo.value)) / 100;
      if (promo.max_discount_amount) {
        discount = Math.min(discount, Number(promo.max_discount_amount));
      }
    } else {
      discount = Number(promo.value);
    }

    res.json({
      promo_id: promo.promo_id,
      discount: Number(discount.toFixed(2)),
      final_fare: Number((fare - discount).toFixed(2))
    });

  } catch (err) {
    console.error("Validate coupon error:", err);
    res.status(500).json({ message: "Failed to validate coupon" });
  }
});

router.post("/request", authenticateToken, async (req: any, res: any) => {
  const { pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, vehicle_type_id, distance_km, coupon_code } = req.body;
  if (!vehicle_type_id) {
    return res.status(400).json({ message: "vehicle_type_id is required" });
  }
  const rider_id = req.user.id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const pickupLocId = await insertLocation(client, pickup_lat, pickup_lng, pickup_address);
    const dropoffLocId = await insertLocation(client, dropoff_lat, dropoff_lng, dropoff_address);

    let fare = 0;
    const vType = await client.query("SELECT * FROM vehicle_types WHERE vehicle_type_id = $1", [vehicle_type_id]);
    if (vType.rows.length > 0) {
      const v = vType.rows[0];
      const dist = distance_km || 0;
      let calculatedFare = Number(v.base_fare) + (dist * Number(v.fare_per_km));
      fare = Math.max(calculatedFare, Number(v.minimum_fare));
    }

    let discount_amount = 0;
    let promo_id = null;

    if (coupon_code) {
      const promoRes = await client.query(
        `SELECT p.* FROM promotions p
         LEFT JOIN user_coupons uc ON p.promo_id = uc.promo_id AND uc.user_id = $1
         WHERE p.code = $2 AND (uc.is_used IS FALSE OR uc.is_used IS NULL) 
         AND p.is_active = TRUE AND (p.expiry_date >= CURRENT_DATE OR p.expiry_date IS NULL)
         AND (p.is_public = TRUE OR uc.user_id IS NOT NULL)`,
        [rider_id, coupon_code]
      );

      if (promoRes.rows.length > 0) {
        const promo = promoRes.rows[0];
        if (fare >= Number(promo.min_fare_amount)) {
          promo_id = promo.promo_id;
          if (promo.discount_type === 'percentage') {
            discount_amount = (fare * Number(promo.value)) / 100;
            if (promo.max_discount_amount) {
              discount_amount = Math.min(discount_amount, Number(promo.max_discount_amount));
            }
          } else {
            discount_amount = Number(promo.value);
          }
        }
      }
    }

    const reqResult = await client.query(
      `INSERT INTO ride_requests (rider_id, vehicle_type_id, status) VALUES ($1, $2, 'pending') RETURNING request_id`,
      [rider_id, vehicle_type_id]
    );
    const request_id = reqResult.rows[0].request_id;

    await client.query(
      `INSERT INTO rides (request_id, driver_id, pickup_location_id, dropoff_location_id, status, distance, fare, applied_promo_id, discount_amount)
       VALUES ($1, NULL, $2, $3, 'ongoing', $4, $5, $6, $7)`,
      [request_id, pickupLocId, dropoffLocId, distance_km || 0, fare, promo_id, discount_amount]
    );

    // If a coupon was applied, mark it as used immediately to prevent double usage 
    // (though in some systems you'd mark it used only upon completion, 
    // here we mark it at request but should revert if cancelled)
    if (promo_id) {
       await client.query(
         `INSERT INTO user_coupons (user_id, promo_id, is_used) 
          VALUES ($1, $2, TRUE)
          ON CONFLICT (user_id, promo_id) DO UPDATE SET is_used = TRUE`, 
         [rider_id, promo_id]
       );
    }

    await client.query("COMMIT");
    res.status(201).json({ request_id, status: "pending", discount: discount_amount, final_fare: fare - discount_amount });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Ride request error:", err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

router.get("/my-requests", authenticateToken, async (req: any, res: any) => {
  const user_id = req.user.id;
  try {
    const result = await pool.query(
      `SELECT 
          rq.request_id, 
          rq.status AS request_status, 
          rq.created_at,
          lp.address AS pickup_address, 
          ld.address AS dropoff_address,
          lp.latitude AS pickup_lat, lp.longitude AS pickup_lng,
          ld.latitude AS dropoff_lat, ld.longitude AS dropoff_lng,
          r.status AS ride_status,
          r.ride_id,
          r.distance,
          r.fare,
          r.discount_amount,
          u_driver.name AS driver_name,
          u_driver.phone AS driver_phone
       FROM ride_requests rq
       LEFT JOIN rides r ON r.request_id = rq.request_id
       LEFT JOIN locations lp ON lp.location_id = r.pickup_location_id
       LEFT JOIN locations ld ON ld.location_id = r.dropoff_location_id
       LEFT JOIN users u_driver ON u_driver.user_id = r.driver_id
       WHERE rq.rider_id = $1
       ORDER BY rq.created_at DESC
       LIMIT 50`,
      [user_id]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error("Error fetching requests:", err);
    res.status(500).json({ message: "Failed to fetch ride requests" });
  }
});

router.get("/my-request", authenticateToken, async (req: any, res: any) => {
  const rider_id = req.user.id;

  try {
    const result = await pool.query(
      `SELECT rq.request_id, rq.status AS request_status, r.status AS ride_status, 
              u.name AS driver_name, u.phone AS driver_phone,
              lp.address AS pickup_address, ld.address AS dropoff_address,
              lp.latitude AS pickup_lat, lp.longitude AS pickup_lng,
              ld.latitude AS dropoff_lat, ld.longitude AS dropoff_lng,
              d.current_lat AS driver_lat, d.current_lng AS driver_lng
       FROM ride_requests rq
       LEFT JOIN rides r ON r.request_id = rq.request_id
       LEFT JOIN locations lp ON lp.location_id = r.pickup_location_id
       LEFT JOIN locations ld ON ld.location_id = r.dropoff_location_id
       LEFT JOIN users u ON u.user_id = r.driver_id
       LEFT JOIN drivers d ON d.user_id = r.driver_id
       WHERE rq.rider_id = $1
       ORDER BY rq.created_at DESC LIMIT 1`,
      [rider_id]
    );

    if (result.rows.length === 0) {
      return res.json({ phase: "idle" });
    }

    const row = result.rows[0];

    if (row.request_status === 'accepted' && row.ride_status === 'ongoing') {
      return res.json({ phase: "matched", ride: row });
    }

    if (row.request_status === 'pending') {
      return res.json({ phase: "pending", request: row });
    }

    res.json({ phase: "idle" });
  } catch (err: any) {
    console.error("my-request error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.delete("/cancel/:requestId", authenticateToken, async (req: any, res: any) => {
  const { requestId } = req.params;
  const rider_id = req.user.id;
  try {
    const reqUpdate = await pool.query(
      "UPDATE ride_requests SET status = 'cancelled' WHERE request_id = $1 AND rider_id = $2 AND status = 'pending' RETURNING request_id",
      [requestId, rider_id]
    );

    if (reqUpdate.rows.length === 0) {
      return res.status(404).json({ message: "No pending request found to cancel." });
    }

    await pool.query(
      "UPDATE rides SET status = 'cancelled' WHERE request_id = $1 AND driver_id IS NULL",
      [reqUpdate.rows[0].request_id]
    );

    res.json({ message: "Request cancelled" });
  } catch (err: any) {
    console.error("Cancel request error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/pending", authenticateToken, async (req: any, res: any) => {
  const driver_id = req.user.id;
  try {
    const result = await pool.query(
      `SELECT rq.request_id, u.name AS rider_name,
              lp.address AS pickup_address, ld.address AS dropoff_address,
              lp.latitude AS pickup_lat, lp.longitude AS pickup_lng,
              ld.latitude AS dropoff_lat, ld.longitude AS dropoff_lng,
              rq.created_at,
              vt.type_name as vehicle_type
       FROM ride_requests rq
       JOIN users u ON u.user_id = rq.rider_id
       JOIN rides r ON r.request_id = rq.request_id
       JOIN locations lp ON lp.location_id = r.pickup_location_id
       JOIN locations ld ON ld.location_id = r.dropoff_location_id
       JOIN vehicle_types vt ON vt.vehicle_type_id = rq.vehicle_type_id
       WHERE rq.status = 'pending' AND r.driver_id IS NULL
         AND EXISTS (SELECT 1 FROM vehicles v WHERE v.driver_id = $1 AND v.vehicle_type_id = rq.vehicle_type_id)
       ORDER BY rq.created_at ASC
       LIMIT 10`,
      [driver_id]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error("Pending requests error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/activity", authenticateToken, async (req: any, res: any) => {
  const user_id = req.user.id;
  try {
    const result = await pool.query(
      `SELECT 
          r.ride_id, 
          rq.request_id,
          rq.status AS request_status, 
          r.status AS ride_status,
          r.created_at,
          lp.address AS pickup_address, 
          ld.address AS dropoff_address,
          u_rider.name AS rider_name
       FROM rides r
       JOIN ride_requests rq ON rq.request_id = r.request_id
       JOIN locations lp ON lp.location_id = r.pickup_location_id
       JOIN locations ld ON ld.location_id = r.dropoff_location_id
       JOIN users u_rider ON u_rider.user_id = rq.rider_id
       WHERE r.driver_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [user_id]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error("Driver activity error:", err);
    res.status(500).json({ message: "Failed to fetch driver activity" });
  }
});

router.post("/accept/:requestId", authenticateToken, async (req: any, res: any) => {
  const { requestId } = req.params;
  const driver_id = req.user.id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const reqCheck = await client.query(
      "SELECT request_id FROM ride_requests WHERE request_id = $1 AND status = 'pending' FOR UPDATE",
      [requestId]
    );

    if (reqCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Request no longer available" });
    }

    await client.query(
      "UPDATE ride_requests SET status = 'accepted' WHERE request_id = $1",
      [requestId]
    );

    const rideResult = await client.query(
      `UPDATE rides SET driver_id = $1, start_time = NOW(), updated_at = NOW()
       WHERE request_id = $2 AND driver_id IS NULL
       RETURNING ride_id`,
      [driver_id, requestId]
    );

    await client.query("COMMIT");
    
    // Notify the rider immediately that the request is accepted
    io.to(`request_${requestId}`).emit("ride_status_update", { status: 'accepted' });
    
    res.json({ ride_id: rideResult.rows[0]?.ride_id, message: "Ride accepted!" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Accept ride error:", err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

router.get("/my-ride", authenticateToken, async (req: any, res: any) => {
  const driver_id = req.user.id;
  try {
    const result = await pool.query(
      `SELECT r.ride_id, r.status,
              u.name AS rider_name, u.phone AS rider_phone,
              lp.address AS pickup_address, ld.address AS dropoff_address,
              lp.latitude AS pickup_lat, lp.longitude AS pickup_lng,
              ld.latitude AS dropoff_lat, ld.longitude AS dropoff_lng
       FROM rides r
       JOIN ride_requests rq ON rq.request_id = r.request_id
       JOIN users u ON u.user_id = rq.rider_id
       JOIN locations lp ON lp.location_id = r.pickup_location_id
       JOIN locations ld ON ld.location_id = r.dropoff_location_id
       WHERE r.driver_id = $1 AND r.status = 'ongoing'
       ORDER BY r.ride_id DESC LIMIT 1`,
      [driver_id]
    );
    res.json(result.rows[0] || null);
  } catch (err: any) {
    console.error("my-ride error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/complete/:rideId", authenticateToken, async (req: any, res: any) => {
  const { rideId } = req.params;
  const driver_id = req.user.id;
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    const rideRes = await client.query(
      `SELECT r.status, r.fare, r.discount_amount, rq.rider_id 
       FROM rides r 
       JOIN ride_requests rq ON r.request_id = rq.request_id
       WHERE r.ride_id = $1 AND r.driver_id = $2 FOR UPDATE`,
      [rideId, driver_id]
    );

    if (rideRes.rows.length === 0) {
       await client.query("ROLLBACK");
       return res.status(404).json({ message: "Active ride not found" });
    }
    
    if (rideRes.rows[0].status !== 'ongoing') {
       await client.query("ROLLBACK");
       return res.status(400).json({ message: "Ride is not ongoing" });
    }

    const { fare, discount_amount, rider_id } = rideRes.rows[0];

    await client.query(
      `UPDATE rides SET status = 'completed', end_time = NOW(), updated_at = NOW()
       WHERE ride_id = $1`,
      [rideId]
    );

    if (fare && Number(fare) > 0) {
       let riderWallet = await client.query(`SELECT wallet_id FROM wallets WHERE user_id = $1 FOR UPDATE`, [rider_id]);
       if (riderWallet.rows.length === 0) {
         riderWallet = await client.query(`INSERT INTO wallets (user_id, balance) VALUES ($1, 0.00) RETURNING wallet_id`, [rider_id]);
       }
       const r_wallet_id = riderWallet.rows[0].wallet_id;

       let driverWallet = await client.query(`SELECT wallet_id FROM wallets WHERE user_id = $1 FOR UPDATE`, [driver_id]);
       if (driverWallet.rows.length === 0) {
         driverWallet = await client.query(`INSERT INTO wallets (user_id, balance) VALUES ($1, 0.00) RETURNING wallet_id`, [driver_id]);
       }
       const d_wallet_id = driverWallet.rows[0].wallet_id;

       // Rider pays (Original Fare - Discount)
       const finalRiderCost = Number(fare) - Number(discount_amount || 0);

       await client.query(`UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE wallet_id = $2`, [finalRiderCost, r_wallet_id]);
       await client.query(
         `INSERT INTO transactions (wallet_id, ride_id, type, amount, status, payment_method) VALUES ($1, $2, 'debit', $3, 'completed', 'Wallet')`,
         [r_wallet_id, rideId, finalRiderCost]
       );

       // Driver gets full Original Fare
       await client.query(`UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE wallet_id = $2`, [fare, d_wallet_id]);
       await client.query(
         `INSERT INTO transactions (wallet_id, ride_id, type, amount, status, payment_method) VALUES ($1, $2, 'credit', $3, 'completed', 'Wallet')`,
         [d_wallet_id, rideId, fare]
       );
    }

    await client.query("COMMIT");
    
    io.to(`ride_${rideId}`).emit("ride_status_update", { status: 'completed' });
    
    res.json({ message: "Ride completed!" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Complete ride error:", err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

router.post("/driver-cancel/:rideId", authenticateToken, async (req: any, res: any) => {
  const { rideId } = req.params;
  const driver_id = req.user.id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const rideResult = await client.query(
      `UPDATE rides SET status = 'cancelled', updated_at = NOW()
       WHERE ride_id = $1 AND driver_id = $2 AND status = 'ongoing'
       RETURNING request_id`,
      [rideId, driver_id]
    );

    if (rideResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Ongoing ride not found" });
    }

    const requestId = rideResult.rows[0].request_id;

    await client.query(
      "UPDATE ride_requests SET status = 'cancelled' WHERE request_id = $1",
      [requestId]
    );

    await client.query(
      "INSERT INTO ride_cancellations (ride_id, cancelled_by, reason) VALUES ($1, 'driver', 'Driver initiated cancellation')",
      [rideId]
    );

    await client.query("COMMIT");
    
    // Notify clients that the ride is cancelled
    io.to(`ride_${rideId}`).emit("ride_status_update", { status: 'cancelled' });
    
    res.json({ message: "Ride cancelled by driver" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Driver cancel error:", err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

router.post("/location", authenticateToken, async (req: any, res: any) => {
  const { lat, lng } = req.body;
  const user_id = req.user.id;
  try {
    await pool.query(
      "UPDATE drivers SET current_lat = $1, current_lng = $2, updated_at = NOW() WHERE user_id = $3",
      [lat, lng, user_id]
    );
    res.json({ message: "Location updated" });
  } catch (err: any) {
    console.error("Update location error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/rider-location", authenticateToken, async (req: any, res: any) => {
  const { lat, lng } = req.body;
  const user_id = req.user.id;
  try {
    const activeRide = await pool.query(
      `SELECT r.ride_id FROM rides r
       JOIN ride_requests rq ON rq.request_id = r.request_id
       WHERE rq.rider_id = $1 AND r.status = 'ongoing'
       ORDER BY r.ride_id DESC LIMIT 1`,
      [user_id]
    );
    if (activeRide.rows.length > 0) {
      await pool.query(
        `INSERT INTO trip_history (ride_id, latitude, longitude) VALUES ($1, $2, $3)`,
        [activeRide.rows[0].ride_id, lat, lng]
      );
    }
    res.json({ message: "Rider location noted" });
  } catch (err: any) {
    console.error("Rider location error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
