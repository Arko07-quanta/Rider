import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import "./App.css";


import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Home from "./pages/Home";
import AdminDashboard from "./pages/AdminDashboard";
import Rider from "./pages/Rider";
import Driver from "./pages/Driver";
import Profile from "./pages/Profile";
import Navbar from "./components/Navbar";


import Cookies from "js-cookie";

const ROLE_HOME: Record<string, string> = {
  rider: "/rider",
  driver: "/driver",
  admin: "/dashboard",
};

function AuthGuard() {
  const location = useLocation();
  const publicRoutes = ["/login", "/signup", "/", "/home"];

  useEffect(() => {
    if (publicRoutes.includes(location.pathname)) return;

    let authInfo: { role?: string; exp?: number } = {};
    try {
      const raw = Cookies.get("auth_info");
      if (raw) authInfo = JSON.parse(raw);
    } catch {}

    if (!authInfo.exp || authInfo.exp <= Date.now()) {
      Cookies.remove("auth_info");
      window.location.href = "/login";
      return;
    }

    const role = authInfo.role as string;
    const path = location.pathname;
    const roleHome = ROLE_HOME[role] ?? "/login";

    const roleGuards: Record<string, string> = {
      "/rider": "rider",
      "/driver": "driver",
      "/dashboard": "admin",
    };

    if (roleGuards[path] && roleGuards[path] !== role) {
      window.location.href = roleHome;
    }
  }, [location.pathname]);

  return null;
}


function App() {
  return (
    <BrowserRouter>
      <AuthGuard />
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<Home />} />
        <Route path="/rider" element={<Rider />} />
        <Route path="/driver" element={<Driver />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/dashboard" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;