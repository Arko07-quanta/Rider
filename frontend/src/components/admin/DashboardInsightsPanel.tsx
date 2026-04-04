import { useEffect, useState } from 'react';
import api from '../../api/axios';
import AnalyticsCharts from './AnalyticsCharts';

interface DashboardStats {
  financials: {
    total_revenue: string;
    total_completed_rides: string;
    avg_fare: string;
  };
  active_drivers: number;
  growth: { day: string; signup_count: string }[];
  statusBreakdown: { status: string; count: string }[];
}

interface Hotspots {
  pickups: { address: string; ride_count: string }[];
  dropoffs: { address: string; ride_count: string }[];
}

export default function DashboardInsightsPanel() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [hotspots, setHotspots] = useState<Hotspots | null>(null);
  const [loading, setLoading] = useState(true);
  const [mtLoading, setMtLoading] = useState(false);
  const [mtMsg, setMtMsg] = useState("");

  const handleRunMaintenance = async () => {
    setMtLoading(true);
    setMtMsg("");
    try {
      const res = await api.post('/api/admin/run-maintenance');
      setMtMsg(res.data.message);
    } catch (err) {
      setMtMsg("Maintenance failed. Check server logs.");
    } finally {
      setMtLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, hotspotsRes] = await Promise.all([
          api.get('/api/admin/dashboard-stats'),
          api.get('/api/admin/hotspots')
        ]);
        setStats(statsRes.data);
        setHotspots(hotspotsRes.data);
      } catch (err) {
        console.error('Failed to fetch analytics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="loading-state">Generating Intelligence Data...</div>;

  return (
    <div className="insights-panel">
      {/* 💳 Top Metric Cards */}
      <div className="insights-metrics">
        <div className="insight-card highlight">
          <label>Total Fare Revenue</label>
          <div className="value">${parseFloat(stats?.financials.total_revenue || '0').toFixed(2)}</div>
          <div className="sub-value">{stats?.financials.total_completed_rides} successful trips</div>
        </div>
        <div className="insight-card">
          <label>Average Fare</label>
          <div className="value">${parseFloat(stats?.financials.avg_fare || '0').toFixed(2)}</div>
          <div className="sub-value">per customer</div>
        </div>
        <div className="insight-card">
          <label>Active Fleet</label>
          <div className="value">{stats?.active_drivers || 0}</div>
          <div className="sub-value">drivers online</div>
        </div>
      </div>

      <div className="insights-grid">
        {/* 📉 User Growth Chart */}
        <div className="grid-item">
          <AnalyticsCharts 
            title="User Growth (Last 7 Days)" 
            data={stats?.growth.map(g => ({ label: new Date(g.day).toLocaleDateString(undefined, { weekday: 'short' }), value: parseInt(g.signup_count) })) || []}
            color="#22C55E"
          />
        </div>

        {/* 🥧 Ride Status Breakdown */}
        <div className="grid-item">
          <AnalyticsCharts 
            title="Ride Success Rate" 
            data={stats?.statusBreakdown.map(s => ({ label: s.status, value: parseInt(s.count) })) || []}
            color="#3B82F6"
          />
        </div>

        {/* 📍 Hotspot Rankings */}
        <div className="grid-item">
          <AnalyticsCharts 
            type="ranking"
            title="Top Pickup Hotspots" 
            data={hotspots?.pickups.map(p => ({ label: p.address, value: parseInt(p.ride_count) })) || []}
            color="#FACC15"
          />
        </div>

        <div className="grid-item">
          <AnalyticsCharts 
            type="ranking"
            title="Top Dropoff Hotspots" 
            data={hotspots?.dropoffs.map(d => ({ label: d.address, value: parseInt(d.ride_count) })) || []}
            color="#EC4899"
          />
        </div>
      </div>

      {/* 🛠️ System Maintenance Action */}
      <div className="maintenance-section">
        <div className="maintenance-content">
          <h3>System Maintenance</h3>
          <p>Execute advanced SQL stored procedures to optimize log tables and perform system-wide maintenance tasks.</p>
        </div>
        <button 
          className="btn-maintenance" 
          onClick={handleRunMaintenance}
          disabled={mtLoading}
        >
          {mtLoading ? "Executing Procedure..." : "Trigger SQL Maintenance"}
        </button>
      </div>
      {mtMsg && <div className={`maintenance-feedback ${mtMsg.includes("fail") ? "error" : "success"}`}>{mtMsg}</div>}

      <style>{`
        .insights-panel {
          padding: 24px 0;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .insights-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 24px;
        }

        .insight-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .insight-card.highlight {
          border-left: 4px solid var(--color-primary);
        }

        .insight-card label {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: var(--text-muted);
        }

        .insight-card .value {
          font-size: 32px;
          font-weight: 900;
          color: var(--text-main);
          letter-spacing: -1px;
        }

        .insight-card .sub-value {
          font-size: 13px;
          color: var(--text-secondary);
        }

        .insights-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 24px;
        }

        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 400px;
          color: var(--text-secondary);
          font-weight: 600;
          letter-spacing: 1px;
        }

        .maintenance-section {
          background: rgba(34, 197, 94, 0.05);
          border: 1px dashed var(--color-primary);
          border-radius: var(--radius-md);
          padding: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          margin-top: 12px;
        }

        .maintenance-content h3 {
          font-size: 16px;
          font-weight: 800;
          color: var(--color-primary);
          margin-bottom: 4px;
        }

        .maintenance-content p {
          font-size: 13px;
          color: var(--text-secondary);
          max-width: 500px;
        }

        .btn-maintenance {
          background: var(--color-primary);
          color: #000;
          padding: 12px 24px;
          border-radius: var(--radius-sm);
          font-weight: 800;
          font-size: 14px;
          white-space: nowrap;
          transition: var(--transition);
        }

        .btn-maintenance:hover:not(:disabled) {
          transform: scale(1.05);
          filter: brightness(1.1);
        }

        .btn-maintenance:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .maintenance-feedback {
          padding: 12px;
          border-radius: var(--radius-sm);
          font-size: 13px;
          text-align: center;
          font-weight: 600;
        }

        .maintenance-feedback.success {
          background: rgba(34, 197, 94, 0.1);
          color: var(--color-primary);
        }

        .maintenance-feedback.error {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
      `}</style>
    </div>
  );
}
