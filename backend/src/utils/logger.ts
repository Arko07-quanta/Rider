import pool from "../db";

/**
 * Logs an admin action to the database.
 * @param adminId The ID of the admin performing the action.
 * @param description A human-readable description of the action.
 */
export async function logAdminAction(adminId: number, description: string): Promise<void> {
  try {
    await pool.query(
      "INSERT INTO admin_actions (admin_id, action_description) VALUES ($1, $2)",
      [adminId, description]
    );
  } catch (err) {
    console.error("Failed to log admin action:", err);
    // We don't throw here to avoid failing the main action if logging fails, 
    // but in a production app you might want more robust error handling.
  }
}
