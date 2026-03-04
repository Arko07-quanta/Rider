import { useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();

  return (
    <div style={{ textAlign: "center", marginTop: "2rem" }}>
      <h1>Dashboard</h1>
      <p>You are now on the dashboard.</p>
      <button onClick={() => navigate("/")}>Go back Home</button>
    </div>
  );
}

export default Dashboard;