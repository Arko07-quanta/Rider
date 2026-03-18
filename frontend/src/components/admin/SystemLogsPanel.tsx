import { useEffect, useState } from "react";
import api from "../../api/axios";

interface SystemLog {
  action_id: string;
  admin_name: string;
  action_description: string;
  timestamp: string;
}

export default function SystemLogsPanel() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.get("/api/admin/system-logs");
        setLogs(res.data);
      } catch (err) {
        console.error("Failed to fetch system logs", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return (
    <>
      <h2>System Logs</h2>
      {loading ? (
        <p>Loading logs...</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Action ID</th>
              <th>Admin Name</th>
              <th>Description</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.action_id}>
                <td>{log.action_id}</td>
                <td>
                  <strong>{log.admin_name}</strong>
                </td>
                <td>{log.action_description}</td>
                <td>{new Date(log.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
