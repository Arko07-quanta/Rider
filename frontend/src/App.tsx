import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import "./App.css";


import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Home from "./pages/Home";
import AdminDashboard from "./pages/AdminDashboard";
import Rider from "./pages/Rider";
import Driver from "./pages/Driver";
import Navbar from "./components/Navbar";
import { checkAuthAndRedirect } from "./utils/auth";


function AuthGuard() {
  const location = useLocation();
  const publicRoutes = ["/login", "/signup", "/", "/home"];

  useEffect(() => {
    if (!publicRoutes.includes(location.pathname)) {
      checkAuthAndRedirect();
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
        <Route path="/dashboard" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;