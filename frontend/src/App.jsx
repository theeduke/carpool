import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { LoadScript } from "@react-google-maps/api";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import PassengerRegistration from "./pages/PassegerRegistrationPage";
import DriverRegister from "./pages/DriverRegistrationPage";
import LoginPage from "./pages/Login";
import PasswordReset from "./pages/PasswordResetPage";
import PasswordResetRequest from "./pages/PasswordResetRequestPage";
import WalletTopUp from "./pages/WalletTopUpPage";
import WalletWithdrawal from "./pages/WalletWithdrawalPage";
import TransferFunds from "./components/TransferFunds";
import UserProfile from "./pages/UserProfilePage";
import UpdateProfile from "./components/UpdateProfile";
import DashboardPage from "./pages/DashboardPage";
import RideHistoryPage from "./pages/RideHistoryPage";
import SearchRidesPage from "./pages/SearchRidesPage";
import RideMatches from './components/RideMatches';
import DriverDashboardPage from "./pages/DriverDashboardPage";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute"; // Correct import
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import VerifyEmailPrompt from "./components/VerifyEmailPrompt";
import VerifyEmailSuccess from "./components/VerifyEmailSuccess";
import VerifyEmailError from './components/VerifyEmailError';
import VerifiedEmailHandler from "./components/VerifiedEmailHandler";
import Reports from "./components/Reports";


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
              <Route path="/ride-matches" element={<RideMatches />} />
              <Route path="/verify-email-success" element={<VerifyEmailSuccess />} />
              <Route path="/verify-email-prompt" element={<VerifyEmailPrompt />} />
              <Route path="/verify-email" element={<VerifiedEmailHandler />} />
              <Route path="/verify-email-error" element={<VerifyEmailError />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute>
                    <Reports />
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
              <Route
                path="/wallet/topup"
                element={
                  <ProtectedRoute>
                    <WalletTopUp />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/wallet-withdrawal"
                element={
                  <ProtectedRoute>
                    <WalletWithdrawal/>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/wallet/send-money"
                element={
                  <ProtectedRoute>
                    <TransferFunds />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <UserProfile/>
                  </ProtectedRoute>
                }
              /> 
              <Route
                path="/profile-update"
                element={
                  <ProtectedRoute>
                    <UpdateProfile/>
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

















