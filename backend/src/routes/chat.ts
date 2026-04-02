import express from "express";
import pool from "../db";
import { authenticateToken } from "../middleware/authMiddleware";
import { io } from "../index";

const router = express.Router();

router.get("/:rideId", authenticateToken, async (req: any, res: any) => {
  const { rideId } = req.params;
  const user_id = req.user.id;

  try {
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

router.post("/send", authenticateToken, async (req: any, res: any) => {
  const { ride_id, message_text } = req.body;
  const sender_id = req.user.id;

  if (!ride_id || !message_text) {
    return res.status(400).json({ message: "ride_id and message_text are required" });
  }

  try {
    const rideCheck = await pool.query(
      `SELECT r.ride_id FROM rides r 
       JOIN ride_requests rq ON r.request_id = rq.request_id
       WHERE r.ride_id = $1 AND (r.driver_id = $2 OR rq.rider_id = $2) AND r.status = 'ongoing'`,
      [ride_id, sender_id]
    );

    if (rideCheck.rows.length === 0) {
      return res.status(400).json({ message: "Not authorized to send messages for this active ride, or ride is ended." });
    }

    const insertResult = await pool.query(
      `INSERT INTO chat_messages (ride_id, sender_id, message_text)
       VALUES ($1, $2, $3) RETURNING *`,
      [ride_id, sender_id, message_text]
    );

    const newMessage = insertResult.rows[0];
    
    const senderResult = await pool.query(
      `SELECT name FROM users WHERE user_id = $1`,
      [sender_id]
    );
    newMessage.sender_name = senderResult.rows[0]?.name || "Unknown";

    io.to(`ride_${ride_id}`).emit("new_message", newMessage);

    res.status(201).json(newMessage);
  } catch (err: any) {
    console.error("Send message error:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
});

export default router;
