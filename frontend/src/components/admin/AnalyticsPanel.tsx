import { useEffect, useState } from "react";
import api from "../../api/axios";

interface DriverEarnings {
  name: string;
  license_number: string;
  total_earnings: string;
}

interface VehicleStats {
  type_name: string;
  total_rides: string;
}

interface CashFlow {
  transaction_date: string;
  total_credits: string;
  total_debits: string;
}

export default function AnalyticsPanel() {
  const [drivers, setDrivers] = useState<DriverEarnings[]>([]);
  const [vehicles, setVehicles] = useState<VehicleStats[]>([]);
  const [cashflow, setCashflow] = useState<CashFlow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [drv, vhc, cfw] = await Promise.all([
          api.get("/api/admin/analytics-drivers"),
          api.get("/api/admin/analytics-vehicles"),
          api.get("/api/admin/analytics-cashflow")
        ]);
        setDrivers(drv.data);
        setVehicles(vhc.data);
        setCashflow(cfw.data);
      } catch (err) {
        console.error("Failed to fetch analytics", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div>Loading Analytics...</div>;

  return (
    <div className="analytics-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <section className="analytics-section">
        <h2 style={{ marginBottom: '10px' }}>🏆 Top Drivers (By Earnings)</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Driver Name</th>
              <th>License Number</th>
              <th>Total Earnings</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d, i) => (
              <tr key={i}>
                <td>{d.name}</td>
                <td>{d.license_number}</td>
                <td style={{ color: '#2e7d32', fontWeight: 'bold' }}>${Number(d.total_earnings).toFixed(2)}</td>
              </tr>
            ))}
            {drivers.length === 0 && <tr><td colSpan={3}>No driver earnings yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="analytics-section">
        <h2 style={{ marginBottom: '10px' }}>🚗 Active Vehicle Trends</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Vehicle Class</th>
              <th>Completed Rides</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v, i) => (
              <tr key={i}>
                <td>{v.type_name}</td>
                <td>{v.total_rides} rides</td>
              </tr>
            ))}
            {vehicles.length === 0 && <tr><td colSpan={2}>No vehicle trends yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="analytics-section">
        <h2 style={{ marginBottom: '10px' }}>💸 Global Cash Flow (7 Days)</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Transaction Date</th>
              <th>Total Credits (Paid to Drivers)</th>
              <th>Total Debits (Charged to Riders)</th>
            </tr>
          </thead>
          <tbody>
            {cashflow.map((c, i) => (
              <tr key={i}>
                <td>{new Date(c.transaction_date).toLocaleDateString()}</td>
                <td style={{ color: '#2e7d32' }}>${Number(c.total_credits).toFixed(2)}</td>
                <td style={{ color: '#d32f2f' }}>${Number(c.total_debits).toFixed(2)}</td>
              </tr>
            ))}
            {cashflow.length === 0 && <tr><td colSpan={3}>No transactions logged yet.</td></tr>}
          </tbody>
        </table>
      </section>

    </div>
  );
}
