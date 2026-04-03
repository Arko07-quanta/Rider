import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import pool from "../db";

interface AuthRequest extends Request {
  user?: any;
}

const verifyUserVersion = async (token: string): Promise<any> => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET missing in .env");

  const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
  if (!decoded || !decoded.id || !decoded.version) {
    throw new Error("Invalid token payload");
  }

  const userRes = await pool.query("SELECT role, token_version FROM users WHERE user_id = $1", [decoded.id]);
  
  if (userRes.rows.length === 0 || userRes.rows[0].token_version !== decoded.version) {
    throw new Error("Session expired. Please log in again.");
  }

  return { ...decoded, actualRole: userRes.rows[0].role };
};

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided. Access denied." });
  }

  try {
    req.user = await verifyUserVersion(token);
    next();
  } catch (err: any) {
    res.status(401).json({ message: err.message || "Invalid or expired token" });
  }
};

export const authenticateAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided. Access denied." });
  }

  try {
    const user = await verifyUserVersion(token);
    if (user.actualRole !== 'admin') {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }
    req.user = user;
    next();
  } catch (err: any) {
    res.status(401).json({ message: err.message || "Invalid or expired token" });
  }
};