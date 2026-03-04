export {};
const jwt = require("jsonwebtoken");
const pool = require("../db.ts");

const authenticateAdmin = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(" ")[1];


  if (!token) return res.status(401).json({ message: "No token provided" });


  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;


    const userRes = await pool.query("SELECT role FROM users WHERE user_id = $1", [req.user.id]);
    
    if (userRes.rows.length === 0 || userRes.rows[0].role !== 'admin') {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = { authenticateAdmin };