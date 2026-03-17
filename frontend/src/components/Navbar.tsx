import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "./Navbar.css";

const Navbar: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decodedToken: { role: string } = jwtDecode(token);
        setIsAuthenticated(true);
        setUserRole(decodedToken.role);
      } catch (error) {
        console.error("Invalid token:", error);
        handleLogout();
      }
    } else {
      setIsAuthenticated(false);
      setUserRole("");
    }
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
    setUserRole("");
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <NavLink to="/" className="navbar-brand">
        RideShare
      </NavLink>
      <div className="navbar-links">
        {isAuthenticated ? (
          <>
            {userRole === "admin" && (
              <NavLink to="/dashboard" className="nav-link">
                Dashboard
              </NavLink>
            )}
            {userRole === "rider" && (
              <NavLink to="/rider" className="nav-link">
                Rider
              </NavLink>
            )}
            {userRole === "driver" && (
              <NavLink to="/driver" className="nav-link">
                Driver
              </NavLink>
            )}
            <button onClick={handleLogout} className="nav-button">
              Logout
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login" className="nav-link">
              Login
            </NavLink>
            <NavLink to="/signup" className="nav-link">
              Signup
            </NavLink>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
