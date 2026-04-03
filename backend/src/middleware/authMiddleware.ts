import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import pool from "../db";

export const authenticateAdmin = async (req: any, res: any, next: any) => {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    req.user = decoded;

    const userRes = await pool.query("SELECT role, token_version FROM users WHERE user_id = $1", [req.user.id]);
    
    if (userRes.rows.length === 0 || userRes.rows[0].token_version !== req.user.version) {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    if (userRes.rows[0].role !== 'admin') {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = req.cookies?.token || (authHeader && authHeader.split(' ')[1]);

  if (!token) return res.status(401).json({ message: "Access denied. No token provided." });

  jwt.verify(token, process.env.JWT_SECRET as string, async (err: any, user: any) => {
    if (err) return res.status(403).json({ message: "Invalid or expired token." });
    
    try {
      const userRes = await pool.query("SELECT token_version FROM users WHERE user_id = $1", [user.id]);
      if (userRes.rows.length === 0 || userRes.rows[0].token_version !== user.version) {
        return res.status(401).json({ message: "Session expired. Please log in again." });
      }
      req.user = user;
      next();
    } catch (dbErr) {
      res.status(500).json({ message: "Server error during authentication" });
    }
  });
};