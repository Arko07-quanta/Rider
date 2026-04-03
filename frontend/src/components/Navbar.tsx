import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import Cookies from "js-cookie";
import { logoutApi } from "../api/axios";
import "./Navbar.css";

const Navbar: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState("");
  const location = useLocation();

  useEffect(() => {
    const authInfoStr = Cookies.get("auth_info");
    if (authInfoStr) {
      try {
        const authInfo = JSON.parse(authInfoStr);
        setIsAuthenticated(true);
        setUserRole(authInfo.role);
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
    logoutApi();
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <NavLink to="/" className="navbar-brand">
          RIDER.IO
        </NavLink>
        
        <div className="navbar-links">
          <NavLink to="/rider" className="nav-link">
            Ride
          </NavLink>
          <NavLink to="/driver" className="nav-link">
            Drive
          </NavLink>
          <NavLink to="#" className="nav-link">
            Business
          </NavLink>
        </div>

        <div className="navbar-actions">
          {isAuthenticated ? (
            <>
              {userRole === "admin" && (
                <NavLink to="/dashboard" className="nav-link">
                  Dashboard
                </NavLink>
              )}
              <button onClick={handleLogout} className="btn-secondary">
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="btn-secondary">
                Login
              </NavLink>
              <NavLink to="/signup" className="btn-primary">
                Signup
              </NavLink>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
