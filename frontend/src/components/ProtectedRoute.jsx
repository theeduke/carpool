// src/components/ProtectedRoute.jsx
import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <div style={{ textAlign: "center", padding: "20px" }}>Loading...</div>; // Simple loading state
  }

  if (!user) {
    return <Navigate to="/login" replace />; // Redirect to home if not authenticated
  }

  return children; // Render the protected component if authenticated
};

export default ProtectedRoute;