import express, { Request, Response } from "express";
import bcrypt from "bcrypt";
import pool from "../db";
import { authenticateToken } from "../middleware/authMiddleware";
import { generateToken, setAuthCookies, clearAuthCookies } from "../utils/authUtils";

const router = express.Router();

router.post("/signup", async (req: Request, res: Response) => {
  const { name, email, phone, password, role, license_number, plate, brand, model, vehicle_type_id } = req.body;
  const client = await pool.connect();

  try {
    const check = await client.query("SELECT 1 FROM users WHERE email=$1 OR phone=$2", [email, phone]);
    if (check.rows.length > 0) return res.status(409).json({ message: "User already exists" });

    await client.query('BEGIN');

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const userRes = await client.query(
      `INSERT INTO users (name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING user_id, role, token_version`,
      [name, email, phone, hashedPassword, role]
    );
    const { user_id: userId, role: userRole, token_version: tokenVersion } = userRes.rows[0];

    if (role === 'driver') {
      await client.query(
        "INSERT INTO drivers (user_id, license_number, is_verified) VALUES ($1, $2, FALSE)",
        [userId, license_number]
      );
      await client.query(
        "INSERT INTO vehicles (driver_id, vehicle_type_id, plate_number, brand, model) VALUES ($1, $2, $3, $4, $5)",
        [userId, vehicle_type_id, plate, brand, model]
      );
    } else if (role === 'rider') {
      await client.query("INSERT INTO riders (user_id) VALUES ($1)", [userId]);
    } else if (role === 'admin') {
      await client.query("INSERT INTO admins (user_id, access_level) VALUES ($1, 1)", [userId]);
    }

    await client.query("INSERT INTO wallets (user_id, balance) VALUES ($1, 0.00)", [userId]);

    await client.query('COMMIT');

    const token = generateToken({ id: userId, role: userRole, version: tokenVersion });
    setAuthCookies(res, token, userRole);

    res.status(201).json({ user: { id: userId, role: userRole, name } });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  try {
    const result = await pool.query(
      `SELECT u.user_id, u.password_hash, u.role, u.name, u.token_version, d.is_verified 
       FROM users u 
       LEFT JOIN drivers d ON u.user_id = d.user_id 
       WHERE u.email=$1`,
      [email]
    );


    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Invalid credentials"});
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (user.role === "driver" && !user.is_verified) {
      return res.status(400).json({ message: "Driver not verified" });
    }

    const token = generateToken({ id: user.user_id, role: user.role, version: user.token_version });
    setAuthCookies(res, token, user.role);

    res.json({ 
      message: "Login successful", 
      user: { id: user.user_id, role: user.role, name: user.name } 
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/logout", (_req: Request, res: Response) => {
  clearAuthCookies(res);
  res.json({ message: "Logged out successfully" });
});

router.get("/profile", authenticateToken, async (req: any, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT user_id, name, email, phone, role FROM users WHERE user_id = $1",
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error fetching profile" });
  }
});

router.put("/profile", authenticateToken, async (req: any, res: Response) => {
  const { name, email, phone, password } = req.body;
  const userId = req.user.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (email || phone) {
      const check = await client.query(
        "SELECT user_id FROM users WHERE (email = $1 OR phone = $2) AND user_id != $3",
        [email || null, phone || null, userId]
      );
      if (check.rows.length > 0) {
        return res.status(409).json({ message: "Email or phone already in use" });
      }
    }

    let query = "UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), phone = COALESCE($3, phone)";
    let params: any[] = [name || null, email || null, phone || null];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ", password_hash = $4, token_version = token_version + 1";
      params.push(hashedPassword);
    }

    query += " WHERE user_id = $" + (params.length + 1) + " RETURNING user_id, role, token_version";
    params.push(userId);

    const result = await client.query(query, params);
    await client.query("COMMIT");

    if (password) {
      clearAuthCookies(res);
      return res.json({ message: "Profile updated and password changed. Please log in again.", logout: true });
    }

    res.json({ message: "Profile updated successfully", user: result.rows[0] });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Server error updating profile" });
  } finally {
    client.release();
  }
});

export default router;