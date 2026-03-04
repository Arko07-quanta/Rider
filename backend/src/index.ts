export {};
const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
require("dotenv").config();
const pool = require("./db.ts");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

app.get("/", (_req: any, res: any) => res.send("Hello World 💖"));

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

    const fakeUsers = [
      {
        name: "Test Rider",
        email: "rider@example.com",
        phone: "1111111111",
        password: "password123",
        role: "rider"
      },
      {
        name: "Test Driver",
        email: "driver@example.com",
        phone: "2222222222",
        password: "password123",
        role: "driver"
      },
      {
        name: "Admin User",
        email: "admin@example.com",
        phone: "3333333333",
        password: "admin123",
        role: "admin"
      }
    ];

    for (const user of fakeUsers) {
      const userExists = await pool.query(
        "SELECT 1 FROM users WHERE email=$1",
        [user.email]
      );

      if (userExists.rows.length > 0) {
        console.log(`✅ User ${user.email} already exists`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      const newUser = await pool.query(
        `INSERT INTO users (name, email, phone, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING user_id, name, email, role`,
        [user.name, user.email, user.phone, hashedPassword, user.role]
      );

      await pool.query("INSERT INTO wallets (user_id, balance) VALUES ($1, 0.00)", [newUser.rows[0].user_id]);

      console.log(`✅ Created user & wallet: ${newUser.rows[0].email}`);
    }

    console.log("🚀 Database Initialization Complete.");
  } catch (err) {
    console.error("❌ Error during initialization:", err);
  }
};

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  initializeDatabase();
});