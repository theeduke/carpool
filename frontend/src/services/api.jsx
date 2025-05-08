import axios from 'axios';

const API_BASE_URL = import.meta.env.REACT_APP_API_URL || 'http://localhost:8000';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10-second timeout
});

// Define services first (to avoid reference errors in interceptors)
export const disputeService = {
  submitDispute: (disputeData) => api.post('/dispute/submit/', disputeData),
  resolveDispute: (disputeId) => api.post(`/dispute/${disputeId}/resolve/`),
  getUserDisputes: () => api.get('/dispute/my-disputes/'),
  disputeRide: (rideId) => api.post(`/api/dispute-ride/${rideId}/`),
  getAllDisputes: () => api.get('/api/all-disputes/'),
};

export const driverService = {
  getVehicleMakes: async () => {
    const response = await api.get('vehicle-makes/');
    return response.data;
  },
  getVehicleModels: async (makeId) => {
    const response = await api.get(`vehicle-models/?make_id=${makeId}`);
    return response.data;
  },
  getDashboard: () => api.get('/driver/dashboard/'),
  getRideRequests: () => api.get('driver/ride-requests'),
  uploadIdImage: (imageData) => api.post('/driver/upload-id/', imageData),
  uploadSmartDL: (dlData) => api.post('/driver/upload-smart-dl/', dlData),
  getWalletBalance: () => api.get('/driver/wallet/'),
  requestPayout: (payoutData) => api.post('/driver/payout/', payoutData),
  setAvailability: (availabilityData) => api.post('/driver/availability/', availabilityData),
  approveRideRequest: (pk) => api.patch(`/driver/ride-request/approve/${pk}/`),
  rejectRideRequest: (pk) => api.patch(`/driver/ride-request/decline/${pk}/`),
  createCarpoolRide: (rideData) => api.post('/driver/create-ride/', rideData),
  // getRideHistory: () => api.get('/rides/history/'),
  updateRide: (pk, rideData) => api.patch(`/driver/update-ride/${pk}/`, rideData),
  completeRide: (rideId) => api.patch(`/driver/complete-ride/${rideId}/`),
  // updateLocation: (locationData) => api.post('/driver/update-location/', locationData),
  getLocation: (rideId) => api.get(`/passenger/driver-location/${rideId}/`),
  startRide: (rideId) => api.patch(`/driver/start-ride/${rideId}/`),
  getDriverRides: () => api.get('/driver/rides/?driver=me'),
  // send notification
  sendNotification: async ({ user_id, message, carpoolride_id }) => {
    try {
      const response = await api.post("/notifications/", {
        user_id,
        message,
        carpoolride_id: carpoolride_id || null,
      });
      return response.data;
    } catch (error) {
      console.error("Error sending notification:", error);
      throw error.response?.data?.error || "Failed to send notification";
    }
  },

  getDriverLocation: async (rideId) => {
    const response = await api.get(`/driver/api/driver-location/${rideId}/`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    return response.data;
  },

  // getDriverLocation: async (rideId) => {
  //   const response = await api.get(`/driver/api/driver-location/${rideId}/`, {
  //     headers: {
  //       Authorization: `Bearer ${localStorage.getItem('token')}`,
  //     },
  //   });
  //   return response.data
  // },
  // getDriverLocation: async (driverId) => {
  //   const response = await fetch(`/api/driver-location/${driverId}`, {
  //     headers: {
  //       "Authorization": `Bearer ${localStorage.getItem("token")}`,
  //     },
  //   });
  //   return response.json();
  // },
  getMapKey: async () => {
    const response = await api.get("/api/get-map-key/", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    
    return response.data
  },
  updateLocation: async (location) => {
    try {
      const response = await api.post('/driver/update-location/', location, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error updating location:', error);
      throw error.response?.data?.error || 'Failed to update location';
    }
  },
  
  optimizeRoute: async (data) => {
    try{
        const response = await api.post("driver/api/optimize-route", data, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        console.log("Optimize Route API Response:", response);
        return response.data;
      } catch (error) {
        throw error.response?.data?.error || new Error("Failed to optimize route.");
    }
  },

  // optimizeRoute: async (data) => {
  //   try {
  //     const response = await api.post("driver/api/optimize-route", data, {
  //       headers: {
  //         "Content-Type": "application/json",
  //         "Authorization": `Bearer ${localStorage.getItem("token")}`,
  //       },
  //     });
  //     return response.data;
  //   } catch (error) {
  //     // Optional: rethrow with better message
  //     throw error.response?.data?.error || new Error("Failed to optimize route.");
  //   }
  // },


  //   const response = await api.post("driver/api/optimize-route", data,{
  //     headers: {
  //       "Content-Type": "application/json",
  //       "Authorization": `Bearer ${localStorage.getItem("token")}`,
  //     },
  //   });
  //   if (!response.ok) throw new Error((await response.data).error);
  //   return response.data;
  // },
};

export const adminService = {
  resetCooldown: () => api.post('/admin/reset-cooldown/'),
  resolveDispute: (disputeId, resolutionData) => api.post(`/admin/resolve-dispute/${disputeId}/`, resolutionData),
  getAllDisputes: () => api.get('/all-disputes/'),
};
// export const adminService = {
//   getAllDisputes: () => api.get('/api/all-disputes/'),
//   resolveDispute: (disputeId, resolutionData) => api.post(`/api/resolve-dispute/${disputeId}/`, resolutionData),
// };

export const passengerService = {
  getDashboard: () => api.get('/dashboard/'),
  cancelRide: (rideId) => api.post(`/cancel-ride/${rideId}/`),
  // getDriverLiveLocation: (rideId) => api.get(`/driver-location/${rideId}/`),
  getDriverLiveLocation: (rideId) => api.get(`/passenger/api/driver-location/${rideId}/`),
  requestToJoin: (rideData) => api.post('/passenger/request-to-join', rideData),
  searchRides: (params) => api.get('/passenger/available-rides/', { params }),
  // getRideHistory: () => api.get('/rides/history/'),
};

export const rideService = {
  getRideHistory: () => api.get('/rides/history/'),
};

export const walletService = {
  deposit: (depositData) => api.post('/wallet/deposit/', depositData),
  transferFunds: (transferData) => api.post('/wallet/transfer/', transferData),
  withdraw: (withdrawData) => api.post('/wallet/withdraw/', withdrawData),
  payForRide: (rideId) => api.post(`/wallet/pay-ride/${rideId}/`),
  releasePayment: (rideId) => api.post(`/wallet/release-payment/${rideId}/`),
};

export const authService = {
  register: (userData) => api.post('/register', userData),
  registerDriver: async (formData) => {
    const response = await api.post('driver/register/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  registerPassenger: async (formData) => {
    const response = await api.post('register/', formData);
    return response.data;
  },
  login: (credentials) => api.post('/login', credentials),
  googleLogin: (googleData) => api.post('/api/google-login', googleData),
  verifyEmail: (emailData) => api.post('/verify-email/', emailData),
  requestPasswordReset: (emailData) => api.post('/password-reset-request/', emailData),
  resetPassword: (resetData, config) => api.post('/password-reset/', resetData, config),
  getProfile: async () => {
    return await api.get("/auth/profile"); // Adjust endpoint as needed
  },
  updateFCMToken: async (data) => api.post('/auth/update-fcm-token/', data),
  // logout: () => 
  //   api.post('/logout', {
  //     refresh_token: localStorage.getItem('refresh_token')
  //   }),
  logout: () => {
    const refreshToken = localStorage.getItem('refresh_token');
    const access_Token = localStorage.getItem('access_token')
    if (!refreshToken) {
      console.warn("No refresh token found for logout");
      return Promise.resolve();
    }
    return api.post('/logout', { refresh_token: refreshToken }, {
      headers: {
        Authorization: `Bearer ${access_Token}`, // Explicitly ensure header is set
      },
    });
  },
  refreshToken: () => api.post('/refresh-token/'),
};

export const mpesaService = {
  callback: (callbackData) => api.post('/api/mpesa/callback/', callbackData),
};

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    // console.log("Interceptor attaching token:", token);
  }
  return config;
});

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/refresh-token/')
    ) {
      originalRequest._retry = true;

      const refresh_token = localStorage.getItem('refresh_token');
      if (!refresh_token) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const response = await authService.refreshToken();
        const { access_token, refresh_token: new_refresh_token } = response.data;

        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', new_refresh_token);

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error('Refresh token failed:', refreshError);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
