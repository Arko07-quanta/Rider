import pool from "./db";

async function seed() {
  try {
    console.log("Seeding promotions...");
    // 1. Create sample promotions
    await pool.query(`
      INSERT INTO promotions (code, discount_type, value, min_fare_amount, max_discount_amount)
      VALUES 
        ('SAVE50', 'percentage', 50, 10, 5),
        ('FLAT10', 'fixed', 10, 15, NULL),
        ('WELCOME20', 'percentage', 20, 0, NULL),
        ('LOYALTY50', 'fixed', 50, 0, NULL)
      ON CONFLICT (code) DO NOTHING
    `);

    // Note: Since we reset the DB, we need to create users first to assign coupons.
    // However, the user will likely sign up and the triggers will handle initial coupons.
    // For manual testing, the user can just use the codes if they exist in `promotions`.
    // My code allows any active promotion to be checked, but for /request it checks user_coupons.

    console.log('Sample promotions seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
