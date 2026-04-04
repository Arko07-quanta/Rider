import jwt from "jsonwebtoken";
import { Response } from "express";

export const generateToken = (payload: object): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET missing in .env");
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1d" });
};

export const setAuthCookies = (res: Response, token: string, role: string, access_level: number = 0, expireMs: number = 24 * 60 * 60 * 1000): void => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: expireMs
  };

  res.cookie("token", token, cookieOptions);
  res.cookie("auth_info", JSON.stringify({ role, access_level, exp: Date.now() + expireMs }), { 
    ...cookieOptions, 
    httpOnly: false // Accessible by frontend logic
  });
};

export const clearAuthCookies = (res: Response): void => {
  res.clearCookie("token");
  res.clearCookie("auth_info");
};
