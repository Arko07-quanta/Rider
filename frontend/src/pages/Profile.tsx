import React, { useState, useEffect } from "react";
import api, { logoutApi } from "../api/axios";
import "./Profile.css";

const Profile: React.FC = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get("/api/auth/profile");
      setFormData({
        name: response.data.name,
        email: response.data.email,
        phone: response.data.phone,
        password: "",
      });
    } catch (err: any) {
      setMessage({ type: "error", text: "Failed to fetch profile information." });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setMessage({ type: "", text: "" });

    try {
      const res = await api.put("/api/auth/profile", formData);
      if (res.data.logout) {
        setMessage({ type: "success", text: "Password changed. Redirecting to login..." });
        setTimeout(() => {
          logoutApi();
        }, 2000);
      } else {
        setMessage({ type: "success", text: "Profile updated successfully!" });
        setFormData({ ...formData, password: "" });
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || "An error occurred during update.";
      setMessage({ type: "error", text: errMsg });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loader">Loading...</div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <h1>Account Settings</h1>
          <p>Update your personal information and security settings</p>
        </div>

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Your Name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="email@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+1 234 567 890"
              required
            />
          </div>

          <div className="form-group password-group">
            <label htmlFor="password">New Password (leave blank if not changing)</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn-update" disabled={updating}>
            {updating ? "Updating..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;
