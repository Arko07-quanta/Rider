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
  const { pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, vehicle_type_id, distance_km, duration, coupon_code } = req.body;
  if (!vehicle_type_id) {
    return res.status(400).json({ message: "vehicle_type_id is required" });
  }
  const rider_id = req.user.id;

  try {
    const result = await pool.query(
      `SELECT * FROM fn_request_ride($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        rider_id, 
        pickup_lat, pickup_lng, pickup_address, 
        dropoff_lat, dropoff_lng, dropoff_address, 
        vehicle_type_id, distance_km || 0, duration || 0, coupon_code || null
      ]
    );

    const { req_id, req_status, discount, final_fare } = result.rows[0];
    res.status(201).json({ request_id: req_id, status: req_status, discount, final_fare });
  } catch (err: any) {
    console.error("Ride request error:", err);
    res.status(500).json({ message: err.message });
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
          r.driver_id AS driver_user_id,
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
    await pool.query("CALL sp_rider_cancel_request($1, $2)", [requestId, rider_id]);
    res.json({ message: "Request cancelled" });
  } catch (err: any) {
    console.error("Cancel request error:", err);
    res.status(err.message.includes('No pending request found') ? 404 : 500).json({ message: err.message });
  }
});

router.get("/pending", authenticateToken, async (req: any, res: any) => {
  const driver_id = req.user.id;
  try {
    const result = await pool.query(
      `SELECT rq.request_id, u.name AS rider_name, rq.rider_id,
              lp.address AS pickup_address, ld.address AS dropoff_address,
              lp.latitude AS pickup_lat, lp.longitude AS pickup_lng,
              ld.latitude AS dropoff_lat, ld.longitude AS dropoff_lng,
              rq.created_at,
              vt.type_name as vehicle_type,
              r.distance, (r.fare * 0.8) as fare, r.duration
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
          u_rider.name AS rider_name,
          rq.rider_id,
          r.distance,
          (r.fare * 0.8) AS fare
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

  try {
    const result = await pool.query("SELECT * FROM sp_accept_ride($1, $2)", [requestId, driver_id]);
    const ride_id = result.rows[0].ride_id;
    const driver_name = result.rows[0].driver_name;
    
    // Notify the rider immediately that the request is accepted
    io.to(`request_${requestId}`).emit("ride_status_update", { 
      status: 'accepted', 
      driver_name,
      ride_id,
      request_id: requestId
    });
    
    res.json({ ride_id, message: "Ride accepted!" });
  } catch (err: any) {
    console.error("Accept ride error:", err);
    res.status(err.message === 'Request no longer available' ? 409 : 500).json({ message: err.message });
  }
});

router.get("/my-ride", authenticateToken, async (req: any, res: any) => {
  const driver_id = req.user.id;
  try {
    const result = await pool.query(
      `SELECT r.ride_id, r.request_id, r.status, r.distance, (r.fare * 0.8) as fare, r.duration,
              u.name AS rider_name, u.phone AS rider_phone,
              rq.rider_id,
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
  
  try {
    const result = await pool.query("CALL sp_complete_ride($1, $2, null)", [rideId, driver_id]);
    const rider_id = result.rows[0]?.p_rider_id;
    
    io.to(`ride_${rideId}`).emit("ride_status_update", { 
      status: 'completed', 
      ride_id: Number(rideId),
      rider_id: rider_id ? Number(rider_id) : null,
      driver_id: Number(driver_id)
    });
    
    res.json({ message: "Ride completed!" });
  } catch (err: any) {
    console.error("Complete ride error:", err);
    res.status(err.message.includes('not found') ? 404 : (err.message.includes('ongoing') ? 400 : 500)).json({ message: err.message });
  }
});

router.post("/driver-cancel/:rideId", authenticateToken, async (req: any, res: any) => {
  const { rideId } = req.params;
  const driver_id = req.user.id;
  try {
    await pool.query("CALL sp_driver_cancel_ride($1, $2)", [rideId, driver_id]);
    io.to(`ride_${rideId}`).emit("ride_status_update", { status: 'cancelled' });
    res.json({ message: "Ride cancelled by driver" });
  } catch (err: any) {
    console.error("Driver cancel error:", err);
    res.status(err.message.includes('not found') ? 404 : 500).json({ message: err.message });
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

router.post("/review/:rideId", authenticateToken, async (req: any, res: any) => {
  const { rideId } = req.params;
  const { rating, comment } = req.body;
  const caller_id = req.user.id;

  try {
    await pool.query("CALL sp_submit_review($1, $2, $3, $4)", [rideId, caller_id, rating, comment || null]);
    res.status(201).json({ message: "Review submitted successfully" });
  } catch (err: any) {
    console.error("Submit review error:", err);
    let code = 500;
    if (err.message.includes('Rating must be between')) code = 400;
    else if (err.message.includes('Ride not found')) code = 404;
    else if (err.message.includes('Can only review completed') || err.message.includes('already reviewed')) code = 400;
    else if (err.message.includes('Not part of this ride')) code = 403;
    res.status(code).json({ message: err.message });
  }
});

router.get("/profile/:userId", authenticateToken, async (req: any, res: any) => {
  const { userId } = req.params;
  const { rideId } = req.query;
  const caller_id = req.user.id;

  try {
    // Get user basic info
    const userRes = await pool.query(
      `SELECT user_id, name, role FROM users WHERE user_id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userRes.rows[0];

    // Get avg rating and count (reviews written ABOUT this user)
    const ratingRes = await pool.query(
      `SELECT
         ROUND(AVG(rev.rating)::numeric, 1) AS avg_rating,
         COUNT(*) AS review_count
       FROM reviews rev
       JOIN rides r ON rev.ride_id = r.ride_id
       JOIN ride_requests rq ON rq.request_id = r.request_id
       WHERE (
         (rev.review_type = 'rider_to_driver' AND r.driver_id = $1) OR
         (rev.review_type = 'driver_to_rider' AND rq.rider_id = $1)
       )`,
      [userId]
    );

    // Get recent reviews about this user
    const reviewsRes = await pool.query(
      `SELECT rev.rating, rev.comment, rev.created_at, u.name AS author_name
       FROM reviews rev
       JOIN rides r ON rev.ride_id = r.ride_id
       JOIN ride_requests rq ON rq.request_id = r.request_id
       JOIN users u ON u.user_id = rev.author_id
       WHERE (
         (rev.review_type = 'rider_to_driver' AND r.driver_id = $1) OR
         (rev.review_type = 'driver_to_rider' AND rq.rider_id = $1)
       )
       ORDER BY rev.created_at DESC
       LIMIT 10`,
      [userId]
    );

    // Check if the caller has already reviewed for this specific ride
    let hasReviewed = false;
    if (rideId) {
      const dupCheck = await pool.query(
        `SELECT 1 FROM reviews WHERE ride_id = $1 AND author_id = $2`,
        [rideId, caller_id]
      );
      hasReviewed = dupCheck.rows.length > 0;
    }

    res.json({
      user_id: user.user_id,
      name: user.name,
      role: user.role,
      avg_rating: ratingRes.rows[0].avg_rating || null,
      review_count: parseInt(ratingRes.rows[0].review_count),
      reviews: reviewsRes.rows,
      has_reviewed: hasReviewed,
    });
  } catch (err: any) {
    console.error("Get profile error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
