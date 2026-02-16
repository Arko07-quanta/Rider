const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
require("dotenv").config();

const router = express.Router();

// ----------------------
// REGISTER
// ----------------------
router.post("/register", async (req: any, res: any) => {
  const { name, email, phone, password, role } = req.body;

  if (!name || !email || !phone || !password || !role) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const userExists = await pool.query(
      "SELECT 1 FROM users WHERE email=$1 OR phone=$2",
      [email, phone]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING user_id, name, email, phone, role, status`,
      [name, email, phone, hashedPassword, role]
    );

    res.status(201).json({ message: "User registered", user: newUser.rows[0] });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ----------------------
// LOGIN
// ----------------------
router.post("/login", async (req: any, res: any) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  try {
    const result = await pool.query(
      "SELECT user_id, password_hash FROM users WHERE email=$1",
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

    const token = jwt.sign({ id: user.user_id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ message: "Login successful", token });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

export {};  // ← ADD THIS LINE