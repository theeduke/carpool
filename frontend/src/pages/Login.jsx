import { useEffect, useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { AuthContext } from "../context/AuthContext";
import { authService } from "../services/api";
import "../styles/LoginPage.css";

const LoginPage = () => {
  const { login, googleLogin } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [phone_number, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // GIS Initialization
  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (
        window.google &&
        window.google.accounts &&
        window.google.accounts.id
      ) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
          auto_select: true,
        });

        window.google.accounts.id.renderButton(
          document.getElementById("googleSignInButton"),
          { theme: "outline", size: "large", width: 300 }
        );

        // One-tap prompt with control
        if (!sessionStorage.getItem("googlePromptShown")) {
          setTimeout(() => {
            window.google.accounts.id.prompt((notification) => {
              if (
                notification.isNotDisplayed() ||
                notification.isSkippedMoment()
              ) {
                console.log("One-tap prompt skipped or not displayed");
              } else {
                sessionStorage.setItem("googlePromptShown", "true");
              }
            });
          }, 2000);
        }
      } else {
        console.error("Google Identity Services not available");
      }
    };

    if (
      window.google &&
      window.google.accounts &&
      window.google.accounts.id
    ) {
      initializeGoogleSignIn();
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleSignIn;
      script.onerror = () =>
        console.error("Failed to load Google Identity Services script");
      document.body.appendChild(script);

      return () => {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      };
    }
  }, []);

  const handleGoogleResponse = async (response) => {
    try {
      await googleLogin(response.credential); // JWT from Google
      toast.success("Google login successful!");
      navigate("/");
    } catch (error) {
      console.error("Google login error:", error);
      toast.error(
        "Google login failed: " +
          (error.response?.data?.error || "Unknown error")
      );
    }
  };

  const handleTraditionalLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login({ phone_number, password });
      toast.success("Login successful!");
      setShowModal(false);
      navigate("/");
    } catch (error) {
      console.error("Login error:", error);
      setError(error.response?.data?.error || "Invalid credentials");
      toast.error("Login failed");
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="login-page">
      {/* Header */}
      <header className="login-header">
        <div className="logo-placeholder">🚖</div>
        <h1>Welcome to Duke Rides</h1>
        <p className="tagline">Ride with ease, anytime, anywhere!</p>
      </header>

      {/* Main Content */}
      <main className="login-content">
        <h2>Sign In to Your Account</h2>
        <div className="login-options">
          {/* Google Sign-In Button */}
          <div id="googleSignInButton" className="google-signin"></div>

          {/* Traditional Login Button */}
          <button
            onClick={() => setShowModal(true)}
            className="phone-login-btn"
          >
            Login with Phone
          </button>

          {/* Additional Links */}
          <div className="additional-links">
            <Link to="/register" className="link">
              Don’t have an account? Sign Up
            </Link>
            <Link to="/forgot-password" className="link">
              Forgot Password?
            </Link>
          </div>
        </div>
      </main>

      {/* Modal for Traditional Login */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Login with Phone</h2>
            <form onSubmit={handleTraditionalLogin}>
              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  type="tel"
                  id="phone"
                  value={phone_number}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  placeholder="Enter your phone number"
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="password-container">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                  />
                  <span
                    className="password-toggle"
                    onClick={togglePasswordVisibility}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex="0"
                    onKeyDown={(e) => e.key === "Enter" && togglePasswordVisibility()}
                  >
                    <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                  </span>
                </div>
              </div>
              {error && <p className="error">{error}</p>}
              <div className="modal-actions">
                <button
                  type="submit"
                  disabled={loading}
                  className="submit-btn"
                >
                  {loading ? "Logging in..." : "Login"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="login-footer">
        <p>
          &copy; 2025 Taxi App. All rights reserved.{" "}
          <Link to="/privacy" className="link">
            Privacy Policy
          </Link>
        </p>
      </footer>
    </div>
  );
};

export default LoginPage;
