import {useState} from "react"
import axios from "axios"

function Login(){
    const [email,setEmail] = useState<string>("");
    const [password,setPassword] = useState<string>("");
    const [loading,setLoading] = useState<boolean>(false);
    const [error,setError] = useState<string>("");

    const handleSubmit = async(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        

        try{
            const response = await axios.post("/api/auth/login",{email,password});
            console.log(response.data);
            localStorage.setItem("token",response.data.token);
            alert(response.data.message);
        }catch (err: any) {
            console.log("Axios error:", err);
            console.log("Axios response:", err.response);
            if (err.response && err.response.data?.message) {
              setError(err.response.data.message);
            } else {
              setError("Server error. Try again.");
            }
      }finally{
            setLoading(false);
        }
    };

        return(
            <div style={{ maxWidth: "400px", margin: "2rem auto" }}>
              <h2>Login</h2>
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: "1rem" }}>
                  <label>Email:</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <label>Password:</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ width: "100%", padding: "0.5rem" }}
                  />
                </div>

                {error && <p style={{ color: "red" }}>{error}</p>}

                <button type="submit" disabled={loading}>
                  {loading ? "Logging in..." : "Login"}
                </button>
              </form>
            </div>
          );
}

export default Login;

