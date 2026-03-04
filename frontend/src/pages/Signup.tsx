import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import "./Signup.css";

type UserRole = "rider" | "driver";

export default function Signup() {
  const navigate = useNavigate();

  const [role, setRole] = useState<UserRole>("rider");
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    license_number: "",
    plate: "",
    brand: "",
    model: "",
    vehicle_type_id: "",
  });

  useEffect(() => {
    const getTypes = async () => {
      try {
        const res = await api.get("/api/auth/vehicle-types");
        setVehicleTypes(res.data);
      } catch (err) {
        console.error("Failed to fetch vehicle types", err);
      }
    };
    getTypes();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/auth/signup", { ...form, role });
      alert("Signup successful!");
      navigate("/login");
    } catch (err: any) {
      setError(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
        <h2>Create Account</h2>
        <p className="subtitle">Sign up to get started</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input name="name" value={form.name} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label>Phone</label>
            <input name="phone" value={form.phone} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input type="password" name="password" value={form.password} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label>Role</label>
            <select name="role" value={role} onChange={e => setRole(e.target.value as UserRole)}>
              <option value="rider">Rider</option>
              <option value="driver">Driver</option>
            </select>
          </div>

          {role === "driver" && (
            <>
              <div className="form-group">
                <label>License Number</label>
                <input name="license_number" value={form.license_number} onChange={handleChange} />
              </div>

              <div className="form-group">
                <label>Vehicle Type</label>
                <select name="vehicle_type_id" value={form.vehicle_type_id} onChange={handleChange}>
                  <option value="">Select Vehicle Type</option>
                  {vehicleTypes.map(v => (
                    <option key={v.vehicle_type_id} value={v.vehicle_type_id}>
                      {v.type_name} (Max: {v.max_passengers})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Plate Number</label>
                <input name="plate" value={form.plate} onChange={handleChange} />
              </div>

              <div className="form-group">
                <label>Brand</label>
                <input name="brand" value={form.brand} onChange={handleChange} />
              </div>

              <div className="form-group">
                <label>Model</label>
                <input name="model" value={form.model} onChange={handleChange} />
              </div>
            </>
          )}

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "Signing up..." : "Sign Up"}
          </button>
        </form>

        <p className="switch-page">
          Already have an account?{" "}
          <button className="link-btn" onClick={() => navigate("/login")}>Login</button>
        </p>
      </div>
    </div>
  );
}