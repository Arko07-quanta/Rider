import express from "express";
import pool from "../db";
import { authenticateToken } from "../middleware/authMiddleware";

const router = express.Router();

// Helper: insert a location row and return its ID
async function insertLocation(client: any, lat: number, lng: number, address: string): Promise<number> {
  const res = await client.query(
    `INSERT INTO locations (latitude, longitude, address) VALUES ($1, $2, $3) RETURNING location_id`,
    [lat, lng, address]
  );
  return res.rows[0].location_id;
}

// ── RIDER: Create a ride request ─────────────────────────────────────────
// We store pickup/dropoff as location rows and attach a pending ride_request.
// The locations are attached to the rides row when a driver accepts.
// To let drivers see pickup/dropoff on the pending list, we store them in a 
// temporary table-agnostic way: we pre-create a rides row with status 'ongoing'=false
// by storing locations separately and linking via ride_requests.
//
// Actual approach: store locations upfront, create ride_requests row, 
// and create a placeholder rides row pointing to them so drivers can query.
router.post("/request", authenticateToken, async (req: any, res: any) => {
  const { pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng } = req.body;
  const rider_id = req.user.id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Cancel any existing pending request from this rider
    const existingReqs = await client.query(
      `SELECT rq.request_id FROM ride_requests rq WHERE rq.rider_id = $1 AND rq.status = 'pending'`,
      [rider_id]
    );
    if (existingReqs.rows.length > 0) {
      const ids = existingReqs.rows.map((r: any) => r.request_id);
      await client.query(
        `UPDATE ride_requests SET status = 'cancelled' WHERE request_id = ANY($1::bigint[])`,
        [ids]
      );
    }

    // Insert pickup and dropoff locations
    const pickupLocId = await insertLocation(client, pickup_lat, pickup_lng, pickup_address);
    const dropoffLocId = await insertLocation(client, dropoff_lat, dropoff_lng, dropoff_address);

    // Create the ride_request
    const reqResult = await client.query(
      `INSERT INTO ride_requests (rider_id, status) VALUES ($1, 'pending') RETURNING request_id`,
      [rider_id]
    );
    const request_id = reqResult.rows[0].request_id;

    // Pre-create the rides row (driver_id null until accepted) so drivers can query location info
    await client.query(
      `INSERT INTO rides (request_id, driver_id, pickup_location_id, dropoff_location_id, status)
       VALUES ($1, NULL, $2, $3, 'ongoing')`,
      [request_id, pickupLocId, dropoffLocId]
    );

    await client.query("COMMIT");
    res.status(201).json({ request_id, status: "pending" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Ride request error:", err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

// ── RIDER: Poll for their current active request/ride ────────────────────
router.get("/my-request", authenticateToken, async (req: any, res: any) => {
  const rider_id = req.user.id;

  try {
    // Check if there's an accepted ride with a driver assigned
    const rideResult = await pool.query(
      `SELECT r.ride_id, r.status, u.name AS driver_name, u.phone AS driver_phone,
              lp.address AS pickup_address, ld.address AS dropoff_address
       FROM ride_requests rq
       JOIN rides r ON r.request_id = rq.request_id
       JOIN locations lp ON lp.location_id = r.pickup_location_id
       JOIN locations ld ON ld.location_id = r.dropoff_location_id
       LEFT JOIN users u ON u.user_id = r.driver_id
       WHERE rq.rider_id = $1 AND rq.status = 'accepted'
       ORDER BY r.ride_id DESC LIMIT 1`,
      [rider_id]
    );

    if (rideResult.rows.length > 0) {
      return res.json({ phase: "matched", ride: rideResult.rows[0] });
    }

    // Check for a pending request
    const reqResult = await pool.query(
      `SELECT rq.request_id, rq.status, lp.address AS pickup_address, ld.address AS dropoff_address
       FROM ride_requests rq
       JOIN rides r ON r.request_id = rq.request_id
       JOIN locations lp ON lp.location_id = r.pickup_location_id
       JOIN locations ld ON ld.location_id = r.dropoff_location_id
       WHERE rq.rider_id = $1 AND rq.status = 'pending'
       ORDER BY rq.created_at DESC LIMIT 1`,
      [rider_id]
    );

    if (reqResult.rows.length > 0) {
      return res.json({ phase: "pending", request: reqResult.rows[0] });
    }

    res.json({ phase: "idle" });
  } catch (err: any) {
    console.error("my-request error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ── RIDER: Cancel their pending request ──────────────────────────────────
router.delete("/cancel", authenticateToken, async (req: any, res: any) => {
  const rider_id = req.user.id;
  try {
    // Update the ride_request status to 'cancelled'
    const reqUpdate = await pool.query(
      "UPDATE ride_requests SET status = 'cancelled' WHERE rider_id = $1 AND status = 'pending' RETURNING request_id",
      [rider_id]
    );

    if (reqUpdate.rows.length === 0) {
      return res.status(404).json({ message: "No pending request found to cancel." });
    }

    // Also update the associated rides row status if it exists and is not yet accepted
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

// ── DRIVER: Get all pending requests (with location info) ─────────────────
router.get("/pending", authenticateToken, async (req: any, res: any) => {
  try {
    const result = await pool.query(
      `SELECT rq.request_id, u.name AS rider_name,
              lp.address AS pickup_address, ld.address AS dropoff_address,
              rq.created_at
       FROM ride_requests rq
       JOIN users u ON u.user_id = rq.rider_id
       JOIN rides r ON r.request_id = rq.request_id
       JOIN locations lp ON lp.location_id = r.pickup_location_id
       JOIN locations ld ON ld.location_id = r.dropoff_location_id
       WHERE rq.status = 'pending' AND r.driver_id IS NULL
       ORDER BY rq.created_at ASC
       LIMIT 10`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error("Pending requests error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ── DRIVER: Accept a ride request ────────────────────────────────────────
router.post("/accept/:requestId", authenticateToken, async (req: any, res: any) => {
  const { requestId } = req.params;
  const driver_id = req.user.id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock and verify the request is still pending
    const reqCheck = await client.query(
      "SELECT request_id FROM ride_requests WHERE request_id = $1 AND status = 'pending' FOR UPDATE",
      [requestId]
    );

    if (reqCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Request no longer available" });
    }

    // Mark request accepted
    await client.query(
      "UPDATE ride_requests SET status = 'accepted' WHERE request_id = $1",
      [requestId]
    );

    // Assign this driver to the pre-created rides row
    const rideResult = await client.query(
      `UPDATE rides SET driver_id = $1, start_time = NOW(), updated_at = NOW()
       WHERE request_id = $2 AND driver_id IS NULL
       RETURNING ride_id`,
      [driver_id, requestId]
    );

    await client.query("COMMIT");
    res.json({ ride_id: rideResult.rows[0]?.ride_id, message: "Ride accepted!" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Accept ride error:", err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

// ── DRIVER: Get their current active ride ────────────────────────────────
router.get("/my-ride", authenticateToken, async (req: any, res: any) => {
  const driver_id = req.user.id;
  try {
    const result = await pool.query(
      `SELECT r.ride_id, r.status,
              u.name AS rider_name, u.phone AS rider_phone,
              lp.address AS pickup_address, ld.address AS dropoff_address
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

// ── DRIVER: Complete a ride ───────────────────────────────────────────────
router.post("/complete/:rideId", authenticateToken, async (req: any, res: any) => {
  const { rideId } = req.params;
  const driver_id = req.user.id;
  try {
    const result = await pool.query(
      `UPDATE rides SET status = 'completed', end_time = NOW(), updated_at = NOW()
       WHERE ride_id = $1 AND driver_id = $2 AND status = 'ongoing'
       RETURNING ride_id`,
      [rideId, driver_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Active ride not found" });
    }
    res.json({ message: "Ride completed!" });
  } catch (err: any) {
    console.error("Complete ride error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
