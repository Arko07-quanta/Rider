import express from "express";
import pool from "../db";
import { authenticateToken } from "../middleware/authMiddleware";

const router = express.Router();

// Get chat history for a specific ride
router.get("/:rideId", authenticateToken, async (req: any, res: any) => {
  const { rideId } = req.params;
  const user_id = req.user.id;

  try {
    // Fetch all messages for the specified ride
    const chatResult = await pool.query(
      `SELECT cm.message_id, cm.sender_id, cm.message_text, cm.sent_at, cm.is_read, u.name as sender_name
       FROM chat_messages cm
       JOIN users u ON u.user_id = cm.sender_id
       WHERE cm.ride_id = $1
       ORDER BY cm.sent_at ASC`,
      [rideId]
    );

    res.json(chatResult.rows);
  } catch (err: any) {
    console.error("Fetch chat error:", err);
    res.status(500).json({ message: "Failed to fetch chat history" });
  }
});

// Send a new chat message
router.post("/send", authenticateToken, async (req: any, res: any) => {
  const { ride_id, message_text } = req.body;
  const sender_id = req.user.id;

  if (!ride_id || !message_text) {
    return res.status(400).json({ message: "ride_id and message_text are required" });
  }

  try {
    // Verify user is authorized to send a message on this active ride
    const rideCheck = await pool.query(
      `SELECT r.ride_id FROM rides r 
       JOIN ride_requests rq ON r.request_id = rq.request_id
       WHERE r.ride_id = $1 AND (r.driver_id = $2 OR rq.rider_id = $2) AND r.status = 'ongoing'`,
      [ride_id, sender_id]
    );

    if (rideCheck.rows.length === 0) {
      return res.status(403).json({ message: "Not authorized to send messages for this active ride" });
    }

    const insertResult = await pool.query(
      `INSERT INTO chat_messages (ride_id, sender_id, message_text)
       VALUES ($1, $2, $3) RETURNING *`,
      [ride_id, sender_id, message_text]
    );

    res.status(201).json(insertResult.rows[0]);
  } catch (err: any) {
    console.error("Send message error:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
});

export default router;
