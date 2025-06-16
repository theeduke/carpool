import axios from 'axios';
import { scheduleTokenRefresh } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URLREQUESTS || 'http://django:8001';
console.log("API Base URL:", API_BASE_URL);

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
//  notifiication services
export const notificationService = {
  dismissNotification: async (notification_id) => {
    try {
      const response = await api.post(`/api/dismiss-notification/${notification_id}/`, null, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      console.log("this is the response", response);
      return response;
    } catch (error) {
      console.error('Error dismissing notification:', error);
      throw error.response?.data?.error || 'Failed to dismiss notification';
    }
  },
};

// driver services
export const driverService = {
  getVehicleMakes: async () => {
    const response = await api.get('vehicle-makes/');
    return response.data;
  },
  getVehicleModels: async (makeId) => {
    const response = await api.get(`vehicle-models/?make_id=${makeId}`);
    return response.data;
  },
  getDriverVehicle: async () => {
    const response = await api.get(`driver/vehicle/`);
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
  completeRide: (rideId) => api.post(`/driver/complete-ride/${rideId}/`),
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
};

// admin services
export const adminService = {
  resetCooldown: () => api.post('/admin/reset-cooldown/'),
  resolveDispute: (disputeId, resolutionData) => api.post(`/admin/resolve-dispute/${disputeId}/`, resolutionData),
  getAllDisputes: () => api.get('/all-disputes/'),
};


// passenger services
export const passengerService = {
  getDashboard: () => api.get('/dashboard/'),
  cancelRide: (rideId) => api.post(`/cancel-ride/${rideId}/`),
  getDriverLiveLocation: (rideId) => api.get(`/passenger/api/driver-location/${rideId}/`),
  requestToJoin: (rideData) => api.post('/passenger/request-to-join', rideData),
  searchRides: (params) => api.get('/passenger/available-rides/', { params }),
  getRideRequests: async () => {
    const response = await api.get('/passenger/ride-requests/');
    return Array.isArray(response.data) ? response.data : [];
  },
  acceptRideMatch: async (matchId, data) => {
    const response = await api.post(`/passenger/ride-match/${matchId}/accept/`, data);
    return response.data;
  },
  declineRideMatch: async (matchId) => {
    const response = await api.post(`/ride-match/${matchId}/decline/`, {});
    return response.data;
  },
};

// ride services
export const rideService = {
  getRideHistory: async ({ page = 1, limit = 5 } = {}) => {
    const response = await api.get('/rides/history/', {
      params: { page, limit },
    });
    return response.data; // Expecting { results: [...], total: number, total_pages: number }
  },
  // chat
  getChatHistory: async (carpoolride_id) => {
    const response = await api.get(`/api/chat/${carpoolride_id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    });
    console.log("this is the response in chat history", response);
    return response.data;
  },
  getUnreadMessages: async () => {
    try {
      const response = await api.get(`/api/messages/unread/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      console.log('Unread messages response not the data:', response);
      return response.data
      // return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Error fetching unread messages:', error.response?.data || error.message);
      return [];
    }
  },
  // get chat recepient profile
  getUserProfile: async (userId) => {
    const response = await api.get(`/profile/${userId}/`);
    // console.log("this is the response data for reveives profile", response)
    return response.data;
  },
};

// wallet services
export const walletService = {
  topUpWallet: (depositData) => api.post('/wallet/mock/deposit/', depositData),
  transferFunds: (transferData) => api.post('/wallet/transfer/', transferData),
  withdraw: (withdrawData) => api.post('/wallet/mock/withdraw/', withdrawData),
  payForRide: (rideId) => api.post(`/wallet/pay-ride/${rideId}/`),
  releasePayment: (rideId) => api.post(`/wallet/release-payment/${rideId}/`),
  getWalletBalance: async () => {
    const response = await api.get('/wallet/balance/');
    return response.data;
  },
};

// user profile & profile services
export const fetchUserProfile = async () => {
  const response = await api.get('/profile/'); 
  return response.data;
};

export const profileService = {
  getProfile: async () => {
  const response = await api.get('/profile/');
  // console.log("Response:", response.data);
  const { profile, preferences } = response.data;
  console.log("Profile:", profile);
  console.log("Preferences:", preferences);
  return { profile, preferences };
},
  // updateProfile: (profileData) => {
  //   const formData = new FormData();
  //   Object.keys(profileData).forEach((key) => {
  //     if (profileData[key] !== null && profileData[key] !== undefined) {
  //       formData.append(key, profileData[key]);
  //     }

  //   });
  //   if (profileData.vehicle) {
  //     formData.append('vehicle', JSON.stringify(profileData.vehicle));
  //   }
  updateProfile: (profileData) => {
    const formData = new FormData();
    Object.keys(profileData).forEach((key) => {
        if (profileData[key] !== null && profileData[key] !== undefined) {
            if (key === 'profile_picture' && profileData[key] instanceof File) {
                formData.append(key, profileData[key], profileData[key].name);
            } else if (key === 'vehicle' && profileData[key]) {
                formData.append(key, JSON.stringify(profileData[key]));
            } else {
                formData.append(key, profileData[key]);
            }
        }
    });
    return api.patch('/profile/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  updatePreferences: (preferencesData) => api.patch('/preferences/', preferencesData),
};

// auth service
export const authService = {
  register: (userData) => api.post('/register', userData),
  registerDriver: async (formData) => {
    const response = await api.post('register/driver/', formData, {
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
  // googleLogin: (googleCredential) => api.post('/api/google-login', { token: googleCredential }),
  verifyEmail: async (token) => {
  const response = await api.get(`/verify-email/?token=${token}`);
  // console.log('Verification data that would be taken for verify email:', response);
  return response.data;
},
  requestPasswordReset: (emailData) => api.post('/password-reset-request/', emailData),
  resetPassword: (resetData, config) => api.post('/password-reset/', resetData, config),
  getProfile: async () => {
    return await api.get("/auth/profile"); // Adjust endpoint as needed
  },
  updateFCMToken: async (data) => api.post('/auth/update-fcm-token/', data),
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
  refreshToken: () => {
  const refresh_token = localStorage.getItem('refresh_token');
  return api.post('/refresh-token/', { refresh: refresh_token });
},
};

// reports
export const reportService = {
  // getRideHistory: () => api.get('/reports/ride-history/'),
  getRideHistory: (params = {}) => api.get('/reports/ride-history/', { params }),
  // getPaymentReceipts: () => api.get('/reports/payment-receipt/'),
  getPaymentReceipts: (params = {}) => api.get('/reports/payment-receipt/', { params }),
  // getDriverEarnings: () => api.get('/reports/driver-earnings/'),
  getDriverEarnings: (params = {}) => api.get('/reports/driver-earnings/', { params }),
  // getPassengerSpending: () => api.get('/reports/passenger-spending/'),
  getPassengerSpending: (params = {}) => api.get('/reports/passenger-spending/', { params }),
  // getReports: (params) => api.get('/reports/', { params }), // For other reports via UserReportsView
  getReports: (params = {}) => api.get('/api/reports/', { params }),
};

// for payments
export const mpesaService = {
  callback: (callbackData) => api.post('/api/mpesa/callback/', callbackData),
};


// Function to get CSRF token from cookies
const getCsrfToken = () => {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1];
};

// Request interceptor to add auth token and csrf token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    // console.log("Interceptor attaching token:", token);
  }
  // Add CSRF token for POST requests
  if (config.method === 'post' || config.method === 'put' || config.method === 'patch') {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
      // console.log("Interceptor attaching CSRF token:", csrfToken);
    } else {
      console.warn("No CSRF token available in cookies");
    }
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
        scheduleTokenRefresh();

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
