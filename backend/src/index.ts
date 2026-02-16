const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
require("dotenv").config();
const pool = require("./db.ts");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

app.get("/", (_req: any, res: any) => res.send("Hello World 💖"));







const insertFakeUsers = async () => {
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

  try {
    for (const user of fakeUsers) {
      // Check if user exists
      const userExists = await pool.query(
        "SELECT 1 FROM users WHERE email=$1",
        [user.email]
      );

      if (userExists.rows.length > 0) {
        console.log(`✅ User ${user.email} already exists`);
        continue;
      }

      // Hash password and insert
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      const newUser = await pool.query(
        `INSERT INTO users (name, email, phone, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING user_id, name, email, role`,
        [user.name, user.email, user.phone, hashedPassword, user.role]
      );

      console.log(`✅ Created user: ${newUser.rows[0].email}`);
    }
  } catch (err) {
    console.error("❌ Error creating fake users:", err);
  }
};



app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  insertFakeUsers();
});

export {};  // ← ADD THIS LINE
