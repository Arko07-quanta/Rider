# 🚀 SQL Project Technical Report: Rider.io

This document serves as the official report for the SQL implementation details of the Rider platform, highlighting advanced database features including Triggers and Stored Procedures.

---

## 1. Relational Schema Overview
The system uses a highly normalized relational structure with **24 tables** and custom **Enum types** for status management.

### Key Table Groups:
- **User Management**: `users`, `riders`, `drivers`, `admins` (using Class-Subclass inheritance).
- **Core Operations**: `rides`, `ride_requests`, `locations`, `vehicles`.
- **Financial Details**: `wallets`, `transactions`, `payment_types`.
- **Engagement**: `promotions`, `user_coupons`, `reviews`, `chat_messages`.

---

## 2. Advanced SQL Logic: Triggers
We implemented automated rewards using PostgreSQL **Triggers** and **PL/pgSQL Trigger Functions**.

### **Trigger: `trg_after_ride_complete`**
- **Objective**: Automatically issue promotional coupons to riders based on their activity milestones.
- **Table**: `rides`
- **Timing**: `AFTER UPDATE OF status`
- **Logic**:
    1.  Fires only when `status` changes to `'completed'`.
    2.  Calculates the total number of successful rides for the associated `rider_id`.
    3.  **Milestone 1**: On the **1st ride**, grants a `'WELCOME20'` coupon (20% discount).
    4.  **Milestone 2**: On the **20th ride**, grants a `'LOYALTY50'` coupon ($50 fixed discount).
    5.  Inserts entries into the `user_coupons` table with a `UNIQUE` constraint to prevent double-issuance.

---

## 3. Advanced SQL Logic: Stored Procedures
Administrative maintenance is handled via secure **Stored Procedures**, allowing complex operations to be triggered directly from the application UI.

### **Procedure: `sp_system_maintenance(p_admin_id BIGINT)`**
- **Objective**: Standard system cleanup, log rotation, and optimization.
- **Logic**:
    1.  **Audit Trail**: Logs the maintenance start event into `admin_actions`.
    2.  **Log Rotation**: Deletes `chat_messages` older than 30 days to optimize storage performance.
    3.  **Audit Cleanup**: Deletes `admin_actions` logs older than 90 days.
    4.  **Concurrency**: Uses explicit `COMMIT` to ensure data integrity for multi-stage deletion.
- **Frontend Integration**: Linked to the **"Trigger SQL Maintenance"** button in the Admin Intelligence Panel.

---

## 4. Performance Optimization
- **Indices**:
    - `idx_users_email`: Accelerated authentication.
    - `idx_rides_status`: Fast retrieval for analytics charts.
    - `idx_trip_history_ride_ts`: Optimized path rendering for active rides.
- **Constraints**:
    - `Generous use of ON DELETE CASCADE` for clean data removal.
    - `CHECK constraints` on fares and ratings to ensure data validity.

---

## 5. Summary of SQL Entities
| Entity Type | Count | key Examples |
| :--- | :--- | :--- |
| **Tables** | 24 | `users`, `rides`, `user_coupons` |
| **Enum Types** | 9 | `ride_status`, `user_role`, `discount_type` |
| **Indices** | 8 | `idx_rides_status`, `idx_users_email` |
| **Triggers** | 1 | `trg_after_ride_complete` |
| **Procedures** | 1 | `sp_system_maintenance` |

**Developed for the Rider.io SQL Database Coursework.**
