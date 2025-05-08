import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { LoadScript } from "@react-google-maps/api";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import PassengerRegistration from "./pages/PassegerRegistrationPage";
import DriverRegister from "./pages/DriverRegistrationPage";
import LoginPage from "./pages/Login"
import PasswordReset from "./pages/PasswordResetPage"
import PasswordResetRequest from "./pages/PasswordResetRequestPage"
import DashboardPage from "./pages/DashboardPage";
import RideHistoryPage from "./pages/RideHistoryPage";
import SearchRidesPage from "./pages/SearchRidesPage";
import DriverDashboardPage from "./pages/DriverDashboardPage";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute"; // Correct import
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function App() {
  const libraries = ["places",'geometry'];
  return (
    <AuthProvider>
      <LoadScript
        googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
        libraries={libraries}
        onLoad={() => {
          console.log("Google Maps API loaded");
          console.log("Geometry library available:", window.google?.maps?.geometry);
          console.log("Google Maps version:", window.google?.maps?.version);
        }}
        // onLoad ={() =>console.log("API Key:", process.env.REACT_APP_GOOGLE_MAPS_API_KEY)}
      >
      <Router>
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <main style={{ flex: "1 0 auto" }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/register" element={<PassengerRegistration/>} />
              <Route path="/driver/register" element={<DriverRegister />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<PasswordResetRequest />} />
              <Route path="/password-reset" element={<PasswordReset />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/search" element={<SearchRidesPage />} />
              <Route
                path="/driver-dashboard"
                element={
                  <ProtectedRoute>
                    <DriverDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ride-history"
                element={
                  <ProtectedRoute>
                    <RideHistoryPage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>
          <Navbar />
        </div>
        <ToastContainer />
      </Router>
      </LoadScript>
    </AuthProvider>
  );
}

export default App;

















