import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";
import ridesRoutes from "./routes/rides";
import chatRoutes from "./routes/chat";
import walletRoutes from "./routes/wallet";
import pool from "./db";
import bcrypt from "bcrypt";

import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const PORT = process.env.PORT || 4000;

const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log(`⚡ Socket connected: ${socket.id}`);

  socket.on("join_ride", (rideId) => {
    socket.join(`ride_${rideId}`);
    console.log(`🔌 Socket ${socket.id} joined ride_${rideId}`);
  });

  socket.on("join_request", (requestId) => {
    socket.join(`request_${requestId}`);
    console.log(`🔌 Socket ${socket.id} joined request_${requestId}`);
  });

  socket.on("disconnect", () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/rides", ridesRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/wallet", walletRoutes);

app.get("/", (_req: Request, res: Response) => res.send("Hello World 💖"));

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});