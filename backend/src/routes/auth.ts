export {};
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db.ts");
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
    }

    await client.query('COMMIT');

    const token = jwt.sign({ id: userId, role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.status(201).json({ token, user: { id: userId, role, name } });

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
      "SELECT user_id, password_hash, role, name FROM users WHERE email=$1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET missing in .env");
    }

    const token = jwt.sign(
      { id: user.user_id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: "1h" }
    );

    res.json({ 
      message: "Login successful", 
      token, 
      user: { id: user.user_id, role: user.role, name: user.name } 
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
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




const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: "Access denied. No token provided." });

  jwt.verify(token, process.env.JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: "Invalid or expired token." });
    req.user = user;
    next();
  });
};

module.exports = router;