import { useEffect, useState } from "react";

export default function App() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => setData({ error: "Failed to fetch", message: err.message }));
  }, []);

  return (
    <div>
      <h1>Database Output:</h1>
      <pre style={{ background: "#222", color: "#fff", padding: "15px" }}>
        {data ? JSON.stringify(data, null, 2) : "Loading..."}
      </pre>
    </div>
  );
}
