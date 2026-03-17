import React, { useEffect, useState } from "react";
import api from "../api/axios";
import "./AdminDashboard.css";

interface PendingDriver {
  user_id: string;
  name: string;
  license_number: string;
  plate_number: string;
  model: string;
  type_name: string;
}

export default function AdminDashboard() {
  const [activePanel, setActivePanel] = useState("verification");
  const [drivers, setDrivers] = useState<PendingDriver[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    try {
      const res = await api.get("/api/admin/pending-drivers");
      setDrivers(res.data);
    } catch (err) {
      console.error("Unauthorized or server error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (userId: string) => {
    if (!window.confirm("Verify this driver and vehicle?")) return;
    try {
      await api.post(`/api/admin/verify-driver/${userId}`);
      setDrivers(drivers.filter(d => d.user_id !== userId));
    } catch (err) {
      console.error("Verify failed:", err);
      alert("Action failed");
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  return (
    <div className="admin-container">
      <aside className="admin-sidebar">
        <div className="logo">Rider<span>Admin</span></div>
        <nav>
          <button
            className={`nav-item ${activePanel === "verification" ? "active" : ""}`}
            onClick={() => setActivePanel("verification")}
          >Verification Queue</button>
          <button
            className={`nav-item ${activePanel === "users" ? "active" : ""}`}
            onClick={() => setActivePanel("users")}
          >User Management</button>
          <button
            className={`nav-item ${activePanel === "rides" ? "active" : ""}`}
            onClick={() => setActivePanel("rides")}
          >Active Rides</button>
          <button
            className={`nav-item ${activePanel === "logs" ? "active" : ""}`}
            onClick={() => setActivePanel("logs")}
          >System Logs</button>
        </nav>
      </aside>

      <main className="admin-content">
        <header className="admin-header">
          <h1>Level 1: Verification Desk</h1>
          <div className="user-profile">Admin ID: 001 (Level 1)</div>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <h3>Pending Drivers</h3>
            <p className="stat-number">{drivers.length}</p>
          </div>
          <div className="stat-card">
            <h3>Verified Today</h3>
            <p className="stat-number">12</p>
          </div>
        </section>

        <div className="table-container">
          {activePanel === "verification" && (
            <>
              <h2>Drivers Awaiting Approval</h2>
              {loading ? <p>Loading queue...</p> : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Driver Name</th>
                      <th>License</th>
                      <th>Vehicle Type</th>
                      <th>Model/Plate</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((driver) => (
                      <tr key={driver.user_id}>
                        <td><strong>{driver.name}</strong></td>
                        <td><code>{driver.license_number}</code></td>
                        <td><span className={`tag ${driver.type_name.toLowerCase()}`}>{driver.type_name}</span></td>
                        <td>{driver.model} ({driver.plate_number})</td>
                        <td>
                          <button className="btn-approve" onClick={() => handleVerify(driver.user_id)}>
                            Approve
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {activePanel === "users" && (
            <>
              <h2>User Management</h2>
              <p>User management content goes here.</p>
            </>
          )}

          {activePanel === "rides" && (
            <>
              <h2>Active Rides</h2>
              <p>Active rides content goes here.</p>
            </>
          )}

          {activePanel === "logs" && (
            <>
              <h2>System Logs</h2>
              <p>System logs content goes here.</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}