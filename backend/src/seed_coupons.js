const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/rider' });

async function seed() {
  try {
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

    // 2. Assign coupons to a test user (assuming user_id 1 is a rider)
    // In a real scenario, this would be part of a signup or loyalty flow.
    await pool.query(`
      INSERT INTO user_coupons (user_id, promo_id)
      SELECT 1, promo_id FROM promotions
      ON CONFLICT DO NOTHING
    `);

    console.log('Sample coupons seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
