# Rider Database Schema & Automated Logic Documentation

This document explains the advanced PostgreSQL features configured within the `Rider_DataBase_maker.txt` schema file. The database is designed to handle core business logic at the data tier, providing speed, consistency, and safe data integrity without relying on frontend or backend logic for transaction validation.

---

## ⚡ Triggers & Trigger Functions
These automated tasks automatically fire off depending on how specific tables are interacted with.

### 1. `fn_reward_rider_coupons` & `trg_reward_rider_coupons`
- **What it does**: This automatically issues a special "LOYALTY50" coupon discount for every rider who successfully completes their first 3 rides on the platform.
- **When it fires**: It executes `AFTER UPDATE` anytime a ride's `status` changes to 'completed' inside the `rides` table.
- **Backend Use-case**: You don't have to check if a user qualifies for promotions within the actual API routes! The backend simply calls to update the ride to complete, and the database evaluates and awards loyalty milestones behind the scenes.

### 2. `log_ride_status_change` & `trg_log_ride_status`
- **What it does**: Records every historical status update for a ride (e.g., pending -> accepted -> ongoing -> completed).
- **When it fires**: It executes `AFTER UPDATE OF status` on the `rides` table.
- **Backend Use-case**: This effectively allows the application to pull an exact chronological lifecycle of any trip (useful for admin dashboards tracking trip history timestamps).

---

## 🛠️ Stored Procedures & Functions
These are called explicitly via backend routes, reducing the need for Express API endpoints to write multi-step SQL queries. By grouping operations inside Procedures (`CALL`) and Functions (`SELECT`), they function as "All-or-Nothing" operations—if any logic within them fails, everything cleanly abandons without leaving corrupted partial data.

### 🚕 Ride Booking & Interactions

#### `fn_request_ride`
- **Functionality**: Logs pickup/drop-off destinations, processes distance against `vehicle_types` definitions to calculate fare minimums, validates submitted coupons (`target_app_age_days`, expirations), logs the pending payload, and issues an immediate coupon usage flag.
- **Normal Code Use-case**: Replaces a massive transactional logic block within the `/request` endpoint. It returns a cleanly formatted `request_id`, `discount`, and `final_fare` to automatically emit a socket event.

#### `sp_accept_ride`
- **Functionality**: Locks the pending request to avoid duplicate acceptances from multiple drivers. Marks it as accepted, officially commits the driver ID to the core rides table, and resets timestamps.
- **Normal Code Use-case**: Executed inside driver's `/accept/:requestId`. 

#### `sp_complete_ride`
- **Functionality**: Tallies the exact commission split (80% driver pay). It automatically checks for and subtracts wallet balances from the rider, appends wallet balances to the driver, and registers both inputs into the `transactions` ledger.
- **Normal Code Use-case**: Handles the `/complete/:rideId` route securely, preventing financial manipulation or transaction drops.

#### `sp_driver_cancel_ride` & `sp_rider_cancel_request`
- **Functionality**: Scrub the ride and cascade the cancellation logic back into the `ride_requests` table. Initiating a driver cancellation independently logs the reason into the `ride_cancellations` analytical ledger. 
- **Normal Code Use-case**: Directly handles `/cancel` mechanisms ensuring no driver is assigned to a ghosted request, preventing application bugs.

#### `sp_submit_review`
- **Functionality**: Validates the payload to enforce 1-5 ratings. Determines whether a Rider or Driver is submitting the review. Checks against duplicate reviews. Automatically recalculates the driver's global `avg_rating` within the `drivers` table immediately. 
- **Normal Code Use-case**: Called by the `/review/:rideId` endpoints. It handles complex recursive updates natively.

---

### 🛡️ Administrative Controls

#### `sp_verify_driver` & `reject_driver_application`
- **Functionality**: Grants official verification status to a pending driver applicant (`sp_verify_driver`), or outright scrubs them by permanently removing their vehicles, driver profiles, and wallet tables (`reject_driver_application`).
- **Normal Code Use-case**: Used inside the admin `/verify-driver` and `/decline-driver` endpoints. It safely binds with the `admin_actions` logging table to track exactly which admin permitted or deleted a user profile.

#### `sp_promote_user` & `sp_demote_admin`
- **Functionality**: Controls hierarchy leveling structure. If a user is promoted, it tracks their original 'rider' or 'driver' state gracefully so they can be demoted in the future. Bumps their token validation layer slightly to instantly log out modified admin sessions.
- **Normal Code Use-case**: Handled tightly by `/promote` and `/demote` logic endpoints, enforcing stringent hierarchical security tracking.

#### `sp_system_maintenance`
- **Functionality**: Clears orphaned or dead session data in the background. It purges ride requests that were "pending" for ages with no acceptance, automatically declining out-of-date records. 
- **Normal Code Use-case**: An administrative push-button route (`/run-maintenance`) specifically used to groom the database health. 

#### `get_driver_total_earnings`
- **Functionality**: A clean, single-pass function that queries the transactions and wallet table to calculate exactly how much total revenue a driver successfully completed. 
- **Normal Code Use-case**: Highly modular and specifically leveraged during `analytics-drivers` dashboard routing to show top driver demographics dynamically without large backend math loops.
