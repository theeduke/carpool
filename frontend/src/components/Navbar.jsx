import { Link } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import "../styles/Navbar.css";
// import LogoImage from "../assets/images/LogoImage.png";

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);

  return (
    <nav className="nav">
      <div className="nav-container">
        {/* <div className="nav-image">
        <img src={LogoImage} alt="Duke ride logo image" />
        </div> */}
        <Link to="/" className="nav-brand">Duke Rides</Link>
        <div className="nav-links">
          <Link to="/" className="nav-link">Home</Link>
          {user ? (
            <>
              {user.is_driver ? (
                <Link to="/driver-dashboard" className="nav-link">Driver Dashboard</Link>
              ) : (
                <>
                  <Link to="/search" className="nav-link">Search Rides</Link>
                  <Link to="/dashboard" className="nav-link">Dashboard</Link>
                </>
              )}
              <Link to="/profile" className="nav-link">User Profile</Link>
              <button onClick={logout} className="nav-button">Logout</button>
            </>
          ) : (
            <Link to="/login" className="nav-link">Login</Link>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;


