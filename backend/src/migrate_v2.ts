import pool from "./db";

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("Adding new columns to promotions...");
    await client.query(`
      ALTER TABLE promotions 
      ADD COLUMN IF NOT EXISTS target_min_distance NUMERIC(10,2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS target_min_rides INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS target_min_spend NUMERIC(15,2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS target_app_age_days INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
    `);

    console.log("Updating fn_reward_rider_coupons function...");
    await client.query(`
CREATE OR REPLACE FUNCTION fn_reward_rider_coupons()
RETURNS TRIGGER AS $$
DECLARE
    v_rider_id BIGINT;
    v_total_rides INT;
    v_total_distance NUMERIC(10,2);
    v_total_spend NUMERIC(15,2);
    v_app_age_days INT;
BEGIN
    IF (NEW.status = 'completed') THEN
        SELECT rider_id INTO v_rider_id FROM ride_requests WHERE request_id = NEW.request_id;

        -- Calculate Stats
        SELECT 
            COUNT(*), 
            COALESCE(SUM(distance), 0), 
            COALESCE(SUM(fare), 0)
        INTO v_total_rides, v_total_distance, v_total_spend
        FROM rides r
        JOIN ride_requests req ON r.request_id = req.request_id
        WHERE req.rider_id = v_rider_id AND r.status = 'completed';

        SELECT EXTRACT(DAY FROM (CURRENT_TIMESTAMP - created_at)) 
        INTO v_app_age_days
        FROM users WHERE user_id = v_rider_id;

        -- Award milestone coupons that the user doesn't already have
        INSERT INTO user_coupons (user_id, promo_id)
        SELECT v_rider_id, promo_id
        FROM promotions p
        WHERE p.is_active = TRUE
          AND p.is_public = FALSE
          AND (p.expiry_date >= CURRENT_DATE OR p.expiry_date IS NULL)
          -- Check any of the milestones (reward if ANY target is met and is non-zero)
          AND (
            (p.target_min_rides > 0 AND v_total_rides >= p.target_min_rides) OR
            (p.target_min_distance > 0 AND v_total_distance >= p.target_min_distance) OR
            (p.target_min_spend > 0 AND v_total_spend >= p.target_min_spend) OR
            (p.target_app_age_days > 0 AND v_app_age_days >= p.target_app_age_days)
          )
          AND NOT EXISTS (
              SELECT 1 FROM user_coupons uc 
              WHERE uc.user_id = v_rider_id AND uc.promo_id = p.promo_id
          )
        ON CONFLICT DO NOTHING;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;`);

    await client.query("COMMIT");
    console.log("Migration V2 successful!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration V2 failed:", err);
  } finally {
    client.release();
    process.exit();
  }
}

migrate();
