import { useEffect, useState } from "react";
import api from "../api/axios";
import "./AdminDashboard.css";

import VerificationPanel, { type PendingDriver } from "../components/admin/VerificationPanel";
import UserManagementPanel from "../components/admin/UserManagementPanel";
import ActiveRidesPanel from "../components/admin/ActiveRidesPanel";
import SystemLogsPanel from "../components/admin/SystemLogsPanel";
import DashboardInsightsPanel from "../components/admin/DashboardInsightsPanel";
import AnalyticsPanel from "../components/admin/AnalyticsPanel";
import PromotionsPanel from "../components/admin/PromotionsPanel";
import TripReplayPanel from "../components/admin/TripReplayPanel";
import AdminControlPanel from "../components/admin/AdminControlPanel";
import Cookies from "js-cookie";

export default function AdminDashboard() {
  const [activePanel, setActivePanel] = useState("insights");
  const [drivers, setDrivers] = useState<PendingDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifiedToday, setVerifiedToday] = useState(0);

  const authInfo = Cookies.get("auth_info");
  const accessLevel = authInfo ? JSON.parse(authInfo).access_level : 0;

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

  const handleDecline = async (userId: string) => {
    if (!window.confirm("Decline and delete this driver?")) return;
    try {
      await api.delete(`/api/admin/decline-driver/${userId}`);
      setDrivers(drivers.filter(d => d.user_id !== userId));
    } catch (err) {
      console.error("Decline failed:", err);
      alert("Action failed");
    }
  };

  const handleVerifiedToday = async () => {
    try {
      const res = await api.get("api/admin/verified-today");
      setVerifiedToday(res.data[0].count);
    } catch (err) {
      console.error("Failed to fetch verified today");
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  useEffect( () => {
    handleVerifiedToday();
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
            className={`nav-item ${activePanel === "insights" ? "active" : ""}`}
            onClick={() => setActivePanel("insights")}
          >Intelligence & Hotspots</button>
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
          <button
            className={`nav-item ${activePanel === "analytics" ? "active" : ""}`}
            onClick={() => setActivePanel("analytics")}
          >Analytics Hub</button>
          <button
            className={`nav-item ${activePanel === "promotions" ? "active" : ""}`}
            onClick={() => setActivePanel("promotions")}
          >Promotions & Coupons</button>
          <button
            className={`nav-item ${activePanel === "replay" ? "active" : ""}`}
            onClick={() => setActivePanel("replay")}
          >Trip Replay</button>
          {accessLevel >= 1 && (
            <button
              className={`nav-item ${activePanel === "admin_control" ? "active" : ""}`}
              onClick={() => setActivePanel("admin_control")}
            >Admin Control</button>
          )}
        </nav>
      </aside>

      <main className="admin-content">
        <header className="admin-header">
          <h1>
            {activePanel === "verification" ? "Verification Desk" : 
             activePanel === "insights" ? "System Intelligence" : 
             activePanel === "promotions" ? "Marketing & Rewards" :
             activePanel === "replay" ? "Trip Replay Gallery" :
             activePanel === "admin_control" ? "Admin Oversight" :
             "Management Console"}
          </h1>
          <div className="user-profile">Admin Level: {accessLevel}</div>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <h3>Pending Drivers</h3>
            <p className="stat-number">{drivers.length}</p>
          </div>
          <div className="stat-card">
            <h3>Verified Today</h3>
            <p className="stat-number">{verifiedToday}</p>
          </div>
        </section>

        <div className="table-container">
          {activePanel === "insights" && <DashboardInsightsPanel />}
          {activePanel === "verification" && (
            <VerificationPanel
              drivers={drivers}
              loading={loading}
              onVerify={handleVerify}
              onDecline={handleDecline}
            />
          )}
          {activePanel === "users" && <UserManagementPanel />}
          {activePanel === "rides" && <ActiveRidesPanel />}
          {activePanel === "logs" && <SystemLogsPanel />}
          {activePanel === "analytics" && <AnalyticsPanel />}
          {activePanel === "promotions" && <PromotionsPanel />}
          {activePanel === "replay" && <TripReplayPanel />}
          {activePanel === "admin_control" && <AdminControlPanel access_level={accessLevel} />}
        </div>
      </main>
    </div>
  );
}