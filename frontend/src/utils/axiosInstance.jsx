import axios from "axios";
import store from "../redux/store"; // Import your Redux store if using Redux
import { logoutUser, refreshToken } from "../redux/slices/authSlice"; // Actions to handle auth
import { BASE_URL } from "../config"; // Store your API base URL separately

const axiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/`, // Make sure BASE_URL is defined in `config.js`
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // If using HTTP-only cookies
});

// Request Interceptor: Attach Access Token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = store.getState().auth.accessToken; // Get token from Redux store
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Refresh Token on 401 (Unauthorized)
axiosInstance.interceptors.response.use(
  (response) => response, // Return response if no errors
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and retry not already attempted, try refreshing the token
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Prevent infinite loop
      
      try {
        const response = await store.dispatch(refreshToken()); // Dispatch refresh action
        if (response.payload) {
          axios.defaults.headers.common["Authorization"] = `Bearer ${response.payload.access}`;
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        store.dispatch(logoutUser()); // Log out if refresh fails
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
