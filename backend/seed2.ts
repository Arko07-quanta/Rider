import pool from "./src/db";
import bcrypt from "bcrypt";

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
      await pool.query(
        `INSERT INTO vehicle_types 
         (type_name, max_passengers, max_weight, average_speed, base_fare, fare_per_km, fare_per_minute, minimum_fare) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (type_name) DO NOTHING`,
        [v.name, v.pax, v.weight, v.speed, v.base, v.km, v.min, v.total_min]
      );
    }

    const fakeUsers = [
      { name: "Test Rider", email: "rider@example.com", phone: "1111111111", password: "password123", role: "rider" },
      { name: "Test Driver", email: "driver@example.com", phone: "2222222222", password: "password123", role: "driver" },
      { name: "Admin User", email: "admin@example.com", phone: "3333333333", password: "password123", role: "admin" }
    ];

    for (const user of fakeUsers) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      const res = await pool.query(
          `INSERT INTO users (name, email, phone, password_hash, role)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING
           RETURNING user_id`,
          [user.name, user.email, user.phone, hashedPassword, user.role]
      );
      
      let userId;
      if (res.rows.length > 0) {
        userId = res.rows[0].user_id;
      } else {
        const fetchRes = await pool.query("SELECT user_id FROM users WHERE email=$1", [user.email]);
        userId = fetchRes.rows[0].user_id;
      }

      if (user.role === 'rider') {
        await pool.query("INSERT INTO riders (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [userId]);
      } else if (user.role === 'driver') {
        await pool.query("INSERT INTO drivers (user_id, license_number, is_verified, rating) VALUES ($1, 'TEST-LICENSE-999', TRUE, 4.95) ON CONFLICT DO NOTHING", [userId]);
        await pool.query("INSERT INTO driver_status (driver_id, is_online, is_available) VALUES ($1, TRUE, TRUE) ON CONFLICT DO NOTHING", [userId]);
        const carType = await pool.query("SELECT vehicle_type_id FROM vehicle_types WHERE type_name = 'Car' LIMIT 1");
        if (carType.rows.length > 0) {
           await pool.query("INSERT INTO vehicles (driver_id, vehicle_type_id, plate_number, brand, model, year, color) VALUES ($1, $2, 'TEST-PLATE-001', 'Toyota', 'Prius', 2022, 'Silver') ON CONFLICT (plate_number) DO NOTHING", [userId, carType.rows[0].vehicle_type_id]);
        }
      } else if (user.role === 'admin') {
        await pool.query("INSERT INTO admins (user_id, access_level, original_role) VALUES ($1, 99, 'rider') ON CONFLICT DO NOTHING", [userId]);
      }
      await pool.query("INSERT INTO wallets (user_id, balance) VALUES ($1, 0.00) ON CONFLICT DO NOTHING", [userId]);
    }

    console.log("🚀 Database Initialization Complete.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error during initialization:", err);
    process.exit(1);
  }
};

initializeDatabase();
