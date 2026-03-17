import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  return (
    <div style={{ textAlign: "center", marginTop: "2rem" }}>
      <h1>Home Page</h1>
      <div style={{ marginTop: "2rem" }}>
        <button onClick={() => navigate("/login")}>Login</button>
        <button onClick={() => navigate("/signup")}>Signup</button>
      </div>
    </div>
  );
}

export default Home;