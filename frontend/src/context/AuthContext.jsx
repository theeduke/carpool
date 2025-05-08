// context/AuthContext.jsx
import { createContext, useState, useEffect } from "react";
import { authService } from "../services/api"; // Adjust path
import { toast } from "react-toastify";
import { initializeApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

const firebaseConfig = {
  // Firebase config object
  apiKey: "AIzaSyC0775aaYxluwZGcaitaAkmFLvT457cXhs",
  // VITE_apiKey
  authDomain: "carpool-ff143.firebaseapp.com",
  // VITE_authDomain
  projectId: "carpool-ff143",
  // VITE_projectId
  storageBucket: "carpool-ff143.firebasestorage.app",
  // VITE_storageBucket
  messagingSenderId: "82851711305",
  // VITE_messagingSenderId
  appId: "1:82851711305:web:b92eb7b9989acdb58b3298",
  // VITE_appId
  measurementId: "G-CXPC301TSN",
  // VITE_measurementId
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);
// const analytics = getAnalytics(app)

// Create the context
export const AuthContext = createContext();

// AuthProvider component to wrap the app
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Send FCM token to backend
  const sendFCMToken = async (token) => {
    try {
      await authService.updateFCMToken({ fcm_token: token }); // Add this endpoint
    } catch (error) {
      console.error("Error sending FCM token:", error);
    }
  };

  // Check for existing tokens on mount
  useEffect(() => {
    const checkAuth = async () => {
      const accessToken = localStorage.getItem("access_token");
      const refreshToken = localStorage.getItem("refresh_token");
      const id = localStorage.getItem("user_id");
      const fullname = localStorage.getItem("fullname");
      const is_driver = localStorage.getItem("is_driver");
      const phone_number = localStorage.getItem("phone_number");

      if (accessToken && refreshToken) {
        try {
          // Fetch user profile using the access token
          // const Response = await authService.getProfile();
          setUser({
            // ...profileResponse.data, // This should include fullname, e.g., { fullname: "mike brandon", access_token: "...", refresh_token: "..." }
            access_token: accessToken,
            refresh_token: refreshToken,
            id,
            fullname,
            is_driver: is_driver === "true", // stored as string in localStorage
            phone_number,
          });
          // Request FCM token
          getToken(messaging, { vapidKey: import.meta.env.VITE_VAPID_KEY })
            .then((currentToken) => {
              if (currentToken) {
                sendFCMToken(currentToken);
              }
            })
            .catch((err) => {
              console.error("Error getting FCM token:", err);
            });
        } catch (error) {
          console.error("Error checking auth:", error);


        // } catch (error) {
        //   console.error("Error fetching profile:", error);
          // If profile fetch fails, log out or handle accordingly
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          setUser(null);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);
    // , []);

  // Login function
  const login = async (credentials) => {
    try {
      const response = await authService.login(credentials);
      // console.log("this is the response for login", response.data);
      const { access_token, refresh_token, id, fullname, is_driver, phone_number } = response.data;
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);
      localStorage.setItem("user_id", id);
      localStorage.setItem("fullname", fullname);
      localStorage.setItem("is_driver", is_driver);
      localStorage.setItem("phone_number", phone_number);
      
      // const profileResponse = await authService.getProfile();
      // setUser({ access_token, refresh_token });
      setUser({
        // ...profileResponse.data,
        access_token,
        refresh_token,
        id,
        fullname,
        is_driver,
        phone_number,
      });
      // vapidkey is used to subscribe browser to push notification without it getToken fails
      // getToken(messaging, { vapidKey: "BF_8YdlgW9dN3fARt85aAmpIQgzC0mI9mrUPNJTiR6XunWeogMrGbsXPk7FnsUWR2twGOrl2wpg4sTFcjCOu6Xc" })
      getToken(messaging, { vapidKey: import.meta.env.VITE_VAPID_KEY })
        .then((currentToken) => {
          if (currentToken) {
            sendFCMToken(currentToken);
          }
        })
        .catch((err) => {
          console.error("Error getting FCM token:", err);
        });

      // console.log("this is the response data after login", response.data)
      return response.data; // Return for further handling if needed
    } catch (error) {
      throw error; // Let caller handle the error
    }
  };

  // Google login (for GIS)
  const googleLogin = async (token) => {
    try {
      const response = await authService.googleLogin(token);
      const { access_token, refresh_token, id, fullname, is_driver, phone_number } = response.data;
      // const profileResponse = await authService.getProfile();
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);
      localStorage.setItem("user_id", id);
      localStorage.setItem("fullname", fullname);
      localStorage.setItem("is_driver", is_driver);
      localStorage.setItem("phone_number", phone_number);
      setUser({ id, fullname, is_driver,access_token, refresh_token, phone_number });
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await authService.logout();
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user_id");
      localStorage.removeItem("fullname");
      localStorage.removeItem("is_driver");
      localStorage.removeItem("phone_number");
      setUser(null);
      toast.success("Logged out successfully!");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Logout failed");
    }
  };

  // Provide context value
  const value = {
    user,
    loading,
    login,
    googleLogin,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children} {/* Render children only when loading is complete */}
    </AuthContext.Provider>
  );
};