import { Router } from "express";
import { pool } from "../db";

const router = Router();
const MY_QUERY = "SELECT 'users' AS type, COUNT(*) AS count FROM users";

router.get("/", async (_, res) => {
  try {
    const result = await pool.query(MY_QUERY);
    
    console.log("HEllo world");
    console.log(result);
    res.json(result.rows); 
    
  } catch (error) {
    res.status(500).json({ error: "Query failed", details: error });
  }
});

export default router;
