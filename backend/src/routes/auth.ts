import express, { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../db";

const router = express.Router();



router.post("/signup", async (req: any, res: any) => {
  const { name, email, phone, password, role, license_number, plate, brand, model, vehicle_type_id } = req.body;
  const client = await pool.connect();

  try {
    const check = await client.query("SELECT 1 FROM users WHERE email=$1 OR phone=$2", [email, phone]);
    if (check.rows.length > 0) return res.status(409).json({ message: "User already exists" });

    await client.query('BEGIN');

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const userRes = await client.query(
      `INSERT INTO users (name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING user_id, role`,
      [name, email, phone, hashedPassword, role]
    );
    const userId = userRes.rows[0].user_id;

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

    const token = jwt.sign({ id: userId, role }, process.env.JWT_SECRET as string, { expiresIn: '1d' });
    
    // Cookie options
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    };

    res.cookie("token", token, cookieOptions);
    res.cookie("auth_info", JSON.stringify({ role, exp: Date.now() + 24 * 60 * 60 * 1000 }), { 
      ...cookieOptions, 
      httpOnly: false // This allows frontend logic to read user state
    });

    res.status(201).json({ user: { id: userId, role, name } });

  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});



router.post("/login", async (req: any, res: any) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  try {
    const result = await pool.query(
      `SELECT u.user_id, u.password_hash, u.role, u.name, d.is_verified 
       FROM users u 
       LEFT JOIN drivers d ON u.user_id = d.user_id 
       WHERE u.email=$1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    const role = user.role;
    const isVerified = user.is_verified;

    if (!valid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET missing in .env");
    }

    if(role === "driver" && !isVerified){
      return res.status(400).json({ message: "Driver not verified" });
    }

    const token = jwt.sign(
      { id: user.user_id, role: user.role }, 
      process.env.JWT_SECRET as string, 
      { expiresIn: "1h" }
    );

    // Cookie options
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 1000 // 1 hour
    };

    res.cookie("token", token, cookieOptions);
    res.cookie("auth_info", JSON.stringify({ role: user.role, exp: Date.now() + 60 * 60 * 1000 }), { 
      ...cookieOptions, 
      httpOnly: false 
    });

    res.json({ 
      message: "Login successful", 
      user: { id: user.user_id, role: user.role, name: user.name } 
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


router.post("/logout", (_req: any, res: any) => {
  res.clearCookie("token");
  res.clearCookie("auth_info");
  res.json({ message: "Logged out successfully" });
});

router.get("/vehicle-types", async (req: any, res: any) => {
  try {
    const result = await pool.query(
      "SELECT vehicle_type_id, type_name, max_passengers FROM vehicle_types ORDER BY type_name ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching vehicle types:", err);
    res.status(500).json({ message: "Server error fetching vehicle types" });
  }
});






export default router;