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
    origin: 'http://localhost:5173',
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

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/rides", ridesRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/wallet", walletRoutes);

app.get("/", (_req: Request, res: Response) => res.send("Hello World 💖"));

const initializeDatabase = async () => {
  try {
    console.log("🛠️ Initializing Database Seeding...");

    const vehicleTypes = [
      { name: 'Cycle', pax: 1, weight: 100, speed: 15, base: 2.00, km: 0.50, min: 0.20, total_min: 5.00 },
      { name: 'Bike', pax: 1, weight: 150, speed: 45, base: 3.00, km: 0.80, min: 0.30, total_min: 7.00 },
      { name: 'Motorcycle', pax: 1, weight: 150, speed: 50, base: 3.50, km: 0.90, min: 0.35, total_min: 8.00 },
      { name: 'CNG', pax: 3, weight: 300, speed: 35, base: 4.00, km: 1.20, min: 0.40, total_min: 10.00 },
      { name: 'Car', pax: 4, weight: 500, speed: 50, base: 6.00, km: 2.00, min: 0.60, total_min: 15.00 },
      { name: 'Micro', pax: 7, weight: 800, speed: 45, base: 10.00, km: 2.50, min: 0.80, total_min: 25.00 },
      { name: 'Bus', pax: 40, weight: 5000, speed: 40, base: 20.00, km: 1.00, min: 0.50, total_min: 50.00 }
    ];

    for (const v of vehicleTypes) {
      const typeExists = await pool.query(
        "SELECT 1 FROM vehicle_types WHERE type_name=$1",
        [v.name]
      );

      if (typeExists.rows.length > 0) {
        console.log(`✅ Vehicle type ${v.name} already exists`);
        continue;
      }

      await pool.query(
        `INSERT INTO vehicle_types 
         (type_name, max_passengers, max_weight, average_speed, base_fare, fare_per_km, fare_per_minute, minimum_fare) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [v.name, v.pax, v.weight, v.speed, v.base, v.km, v.min, v.total_min]
      );
      console.log(`✅ Seeded Vehicle Type: ${v.name}`);
    }

    // --- Seed SQL Project Promotions ---
    const projectPromos = [
      { code: 'WELCOME20', type: 'percentage', val: 20 },
      { code: 'LOYALTY50', type: 'fixed', val: 50 }
    ];

    for (const p of projectPromos) {
      const exists = await pool.query("SELECT 1 FROM promotions WHERE code=$1", [p.code]);
      if (exists.rows.length === 0) {
        await pool.query(
          "INSERT INTO promotions (code, discount_type, value, usage_limit) VALUES ($1, $2, $3, 1000)",
          [p.code, p.type, p.val]
        );
        console.log(`🎁 Seeded Project Promotion: ${p.code}`);
      }
    }

    const fakeUsers = [
      {
        name: "Test Rider",
        email: "rider@example.com",
        phone: "1111111111",
        password: "1234",
        role: "rider"
      },
      {
        name: "Test Driver",
        email: "driver@example.com",
        phone: "2222222222",
        password: "1234",
        role: "driver"
      },

      {
        name: "Admin User",
        email: "admin@example.com",
        phone: "3333333333",
        password: "1234",
        role: "admin"
      }
    ];

    for (const user of fakeUsers) {
      let userId: number;

      const userExists = await pool.query(
        "SELECT user_id FROM users WHERE email=$1",
        [user.email]
      );

      if (userExists.rows.length > 0) {
        userId = userExists.rows[0].user_id;
        console.log(`✅ User ${user.email} already exists — ensuring role table row...`);
      } else {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        const newUser = await pool.query(
          `INSERT INTO users (name, email, phone, password_hash, role)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING user_id`,
          [user.name, user.email, user.phone, hashedPassword, user.role]
        );
        userId = newUser.rows[0].user_id;
        console.log(`✅ Created user: ${user.email}`);
      }

      if (user.role === 'rider') {
        await pool.query("INSERT INTO riders (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [userId]);
      } else if (user.role === 'driver') {
        await pool.query(
          "INSERT INTO drivers (user_id, license_number, is_verified, rating) VALUES ($1, 'TEST-LICENSE-999', TRUE, 4.95) ON CONFLICT DO NOTHING",
          [userId]
        );

        await pool.query(
          "INSERT INTO driver_status (driver_id, is_online, is_available) VALUES ($1, TRUE, TRUE) ON CONFLICT DO NOTHING",
          [userId]
        );

        const carType = await pool.query("SELECT vehicle_type_id FROM vehicle_types WHERE type_name = 'Car' LIMIT 1");
        if (carType.rows.length > 0) {
           await pool.query(
             "INSERT INTO vehicles (driver_id, vehicle_type_id, plate_number, brand, model, year, color) VALUES ($1, $2, 'TEST-PLATE-001', 'Toyota', 'Prius', 2022, 'Silver') ON CONFLICT (plate_number) DO NOTHING",
             [userId, carType.rows[0].vehicle_type_id]
           );
        }
      } else if (user.role === 'admin') {
        await pool.query("INSERT INTO admins (user_id, access_level) VALUES ($1, 99) ON CONFLICT DO NOTHING", [userId]);
      }

      await pool.query("INSERT INTO wallets (user_id, balance) VALUES ($1, 0.00) ON CONFLICT DO NOTHING", [userId]);
    }

    console.log("🚀 Database Initialization Complete.");
  } catch (err) {
    console.error("❌ Error during initialization:", err);
  }
};

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  initializeDatabase();
});