import express from "express";
import pool from "../db";
import { authenticateToken } from "../middleware/authMiddleware";

const router = express.Router();

router.get("/", authenticateToken, async (req: any, res: any) => {
  const user_id = req.user.id;
  try {
    const walletRes = await pool.query(
      `SELECT wallet_id, balance, currency FROM wallets WHERE user_id = $1`,
      [user_id]
    );

    let wallet = walletRes.rows[0];
    if (!wallet) {
      const newWallet = await pool.query(
        `INSERT INTO wallets (user_id, balance) VALUES ($1, 0.00) RETURNING wallet_id, balance, currency`,
        [user_id]
      );
      wallet = newWallet.rows[0];
    }

    const txRes = await pool.query(
      `SELECT transaction_id, type, amount, status, timestamp, payment_method, external_ref
       FROM transactions
       WHERE wallet_id = $1
       ORDER BY timestamp DESC`,
      [wallet.wallet_id]
    );

    res.json({
      balance: wallet.balance,
      currency: wallet.currency,
      transactions: txRes.rows
    });
  } catch (err: any) {
    console.error("Fetch wallet error:", err);
    res.status(500).json({ message: "Failed to fetch wallet contents" });
  }
});

router.post("/deposit", authenticateToken, async (req: any, res: any) => {
  const { amount, payment_method } = req.body;
  const user_id = req.user.id;

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: "Invalid deposit amount" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let walletRes = await client.query(
      `SELECT wallet_id FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [user_id]
    );
    
    if (walletRes.rows.length === 0) {
      walletRes = await client.query(
        `INSERT INTO wallets (user_id, balance) VALUES ($1, 0.00) RETURNING wallet_id`,
        [user_id]
      );
    }
    const wallet_id = walletRes.rows[0].wallet_id;

    await client.query(
      `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE wallet_id = $2`,
      [amount, wallet_id]
    );

    await client.query(
      `INSERT INTO transactions (wallet_id, type, amount, status, payment_method)
       VALUES ($1, 'credit', $2, 'completed', $3)`,
      [wallet_id, amount, payment_method || 'Deposit']
    );

    await client.query("COMMIT");
    res.json({ message: "Deposit successful" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Deposit error:", err);
    res.status(500).json({ message: "Failed to deposit funds" });
  } finally {
    client.release();
  }
});

export default router;
