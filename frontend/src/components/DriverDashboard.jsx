import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { driverService, notificationService } from "../services/api";
import { Autocomplete } from "@react-google-maps/api";
import MapComponent from "./MapComponent";
import { formatPlaceLabel } from "../utils/placeUtils";
import "../styles/driverdashboard.css";
import { toast } from "react-toastify";

// Debounce utility to limit frequent API calls
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

function DriverDashboard() {
  const [driverData, setDriverData] = useState(null);
  const [rideForm, setRideForm] = useState({
    origin: "",
    destination: "",
    departure_time: "",
    available_seats: "",
    contribution_per_seat: "",
    is_women_only: false,
  });
  const [rideRequests, setRideRequests] = useState([]);
  const [idFront, setIdFront] = useState(null);
  const [idBack, setIdBack] = useState(null);
  const [smartDL, setSmartDL] = useState(null);
  const [rides, setRides] = useState([]);
  const [selectedRideId, setSelectedRideId] = useState(null);
  const [departureTime, setDepartureTime] = useState("");
  const [availability, setAvailability] = useState(false);
  const [location, setLocation] = useState({ latitude: null, longitude: null });
  const [lastValidLocation, setLastValidLocation] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [useSimulation, setUseSimulation] = useState(true);
  const initializedRideId = useRef(null);
  const originRef = useRef(null);
  const destinationRef = useRef(null);
  const wsRef = useRef(null);
  const rideWsRefs = useRef({}); // Store WebSocket connections for each ride
  const retryCount = useRef(0);
  const maxRetries = 3;
  const [dismissedNotifications, setDismissedNotifications] = useState(new Set());
  const isDismissing = useRef(new Set());
  const [vehicleCapacity, setVehicleCapacity] = useState(null);
  // const notificationCache = new Map();
  const fetchVehicle = async () => {
      try {
        const response = await driverService.getDriverVehicle();
        // console.log('this is the response for fetch vehicle', response);
        setVehicleCapacity(response.capacity);
        console.log('Vehicle capacity:', response.capacity);
      } catch (error) {
        console.warn('Error fetching vehicle:', error);
        // Handle error (e.g., disable form if no vehicle)
      }
    };
    fetchVehicle();

  // Calculate distance (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  };

  // Update driver location to backend
  const updateDriverLocation = async (location, rideId = null) => {
    if (!rideId) {
      console.log("No active ride, skipping location update.");
      return false;
    }
    try {
      const payload = {
        latitude: location.latitude,
        longitude: location.longitude,
        is_simulated: useSimulation,
        ride_id: rideId,
      };
      console.log("Sending location update payload:", payload);
      const response = await driverService.updateLocation(payload);
      console.log("Driver location update response:", response);
      retryCount.current = 0; // Reset retry count on success
      return true;
    } catch (err) {
      console.error("Error updating driver location:", err);
      setError(`Failed to update driver location: ${err.message}`);
      if (retryCount.current < maxRetries) {
        retryCount.current += 1;
        console.log(`Retrying location update (${retryCount.current}/${maxRetries})`);
        setTimeout(() => updateDriverLocation(location, rideId), 2000);
      } else {
        console.error("Max retries reached for location update");
        setError("Unable to update driver location after multiple attempts.");
      }
      return false;
    }
  };

  // Debounced location update
  const debouncedUpdateLocation = useCallback(
    debounce((location, rideId) => {
      console.log("Triggering debounced location update:", { location, rideId });
      updateDriverLocation(location, rideId);
    }, 1500),
    [useSimulation]
  );

  // Initialize WebSocket connection for driver notifications
  useEffect(() => {
    if (!driverData?.id) return;

    const token = localStorage.getItem("access_token");
    if (!token) {
      console.error("No JWT token found for WebSocket connection");
      setError("Authentication error: Please log in again.");
      return;
    }
    
    const backendWsUrl = import.meta.env.VITE_BACKEND_WSREQUEST_URL || "ws://127.0.0.1:8001";
    const wsUrl = `${backendWsUrl}/ws/notifications/user_${driverData.id}/?token=${token}`;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectInterval = 3000;

    const connectWebSocket = () => {
      // Close existing connection if open
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log(`WebSocket connected for driver ${driverData.id}`);
        reconnectAttempts = 0;
        setError(null);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("WebSocket message received:", data);

          if (data.type === "send_notification" && data.user_id === driverData.id) {
            if (dismissedNotifications.has(data.notification_id)) {
              console.log(`Skipping dismissed notification: ${data.notification_id}`);
              return;
            }
            setNotifications((prev) => {
              const existingIndex = prev.findIndex(
                (notif) => notif.notification_id === data.notification_id
              );
              const newNotification = {
                message: data.message,
                carpoolride_id: data.carpoolride_id,
                time: new Date(data.time || Date.now()),
                type: data.notification_type || "info",
                is_new: true,
                notification_id: data.notification_id,
              };

              if (existingIndex !== -1) {
                const updatedNotifications = [...prev];
                updatedNotifications[existingIndex] = newNotification;
                return updatedNotifications;
              } else {
                return [...prev, newNotification];
              }
            });
            console.log(`Received notification: ${data.message}`);
          } else if (data.type === "notification_dismissed" && data.user_id === driverData.id) {
            setDismissedNotifications((prev) => new Set(prev).add(data.notification_id));
            setNotifications((prev) => {
              console.log("Before filter (WebSocket dismiss):", prev);
              const updated = prev.filter((n) => n.notification_id !== data.notification_id);
              console.log("After filter:", updated);
              return updated;
            });
            console.log("Notification dismissed via WebSocket:", data.notification_id);
          }
        } catch (err) {
          console.error("WebSocket message error:", err);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("WebSocket connection failed.");
      };

      wsRef.current.onclose = (event) => {
        console.log(`WebSocket closed, code: ${event.code}, reason: ${event.reason}`);
        if (reconnectAttempts < maxReconnectAttempts) {
          console.log(`Reconnecting in ${reconnectInterval / 1000} seconds...`);
          setTimeout(connectWebSocket, reconnectInterval);
          reconnectAttempts++;
        } else {
          console.error("Max reconnect attempts reached");
          setError("Notification service unavailable.");
        }
      };
    };

    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [driverData?.id, dismissedNotifications]);

  //  initialize websocket for rides
    
  useEffect(() => {
    if (!driverData?.id || !rides.length) {
    console.log("No rides available, skipping WebSocket connections for ride requests");
    return;
  }

    const token = localStorage.getItem("access_token");
    if (!token) {
      console.error("No JWT token found for ride request WebSocket connection");
      setError("Authentication error: Please log in again.");
      return;
    }

    const backendWsUrl = import.meta.env.VITE_BACKEND_WSREQUEST_URL || "ws://127.0.0.1:8001";
    const activeRides = rides.filter(r => r.status === "pending" || r.status === "in_progress");

    // Connect WebSocket for each active ride
    activeRides.forEach(ride => {
      const rideId = ride.carpoolride_id;
      if (rideWsRefs.current[rideId] && rideWsRefs.current[rideId].readyState === WebSocket.OPEN) {
        console.log(`WebSocket already connected for ride ${rideId}`);
        return;
      }

      const wsUrl = `${backendWsUrl}/ws/ride_requests/ride_${rideId}/?token=${token}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`WebSocket connected for ride requests, ride ${rideId}`);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`WebSocket message for ride ${rideId}:`, data);
          if (data.type === "ride_request_update") {
            const requestData = data.request_data;
            setRideRequests((prev) => {
              const existingIndex = prev.findIndex(
                (req) => req.ridrequest_id === requestData.ridrequest_id
              );
              if (existingIndex !== -1) {
                // Update existing request
                const updatedRequests = [...prev];
                updatedRequests[existingIndex] = {
                  ...updatedRequests[existingIndex],
                  ...requestData,
                  created_at: new Date(requestData.created_at),
                };
                return updatedRequests;
              } else {
                // Add new request
                return [
                  ...prev,
                  {
                    ...requestData,
                    created_at: new Date(requestData.created_at),
                  },
                ];
              }
            });
            console.log(`Ride request updated for ride ${rideId}:`, requestData);
          }
        } catch (err) {
          console.error(`WebSocket message error for ride ${rideId}:`, err);
        }
      };

      ws.onerror = (error) => {
        console.error(`WebSocket error for ride ${rideId}:`, error);
        setError(`WebSocket connection failed for ride ${rideId}.`);
      };

      ws.onclose = (event) => {
        console.log(`WebSocket closed for ride ${rideId}, code: ${event.code}, reason: ${event.reason}`);
        delete rideWsRefs.current[rideId];
      };

      rideWsRefs.current[rideId] = ws;
    });

    // Cleanup: close WebSocket connections for rides that are no longer active
    return () => {
      Object.keys(rideWsRefs.current).forEach(rideId => {
        if (!activeRides.some(r => r.carpoolride_id === rideId)) {
          if (rideWsRefs.current[rideId]) {
            rideWsRefs.current[rideId].close();
            delete rideWsRefs.current[rideId];
            console.log(`Closed WebSocket for inactive ride ${rideId}`);
          }
        }
      });
    };
  }, [driverData?.id, rides]);

const sendNotification = async (userId, message, carpoolride_id = null) => {
  try {
    console.log(`Sending notification to user ${userId}: ${message}, ride: ${carpoolride_id}`);
    
    const response = await driverService.sendNotification({
      user_id: userId,
      message,
      carpoolride_id,
    });
    console.log('this is the response from backend notification', response);
    
    // Only log the response; do not update local notifications state
    // Notifications for the driver UI come from WebSocket, not this function
    if (
      response.status.includes("Notification sent via WebSocket") ||
      response.status.includes("Firebase fallback used")
    ) {
      console.log(`Notification successfully sent to user ${userId}: ${message}`);
    } else if (response.status.includes("Notification already sent and pending within 5 minutes")) {
      console.log(`Notification to user ${userId} skipped: already sent within 5 minutes`);
    }
  } catch (err) {
    console.error("Error sending notification:", err);
    setError(err.message || "Failed to send notification.");
  }
};

  const checkProximity = (latitude, longitude, rideId) => {
  if (optimizedRoute?.passengers) {
    const averageSpeed = 40 / 3.6; // 40 km/h in m/s
    for (const passenger of optimizedRoute.passengers) {
      if (!passenger.user_id || !passenger.pickup_lat || !passenger.pickup_lng) {
        console.warn("Invalid passenger data:", passenger);
        continue;
      }

      // Skip if user_id matches driver's ID
    if (passenger.user_id === driverData.id) {
      console.error(`Passenger user_id ${passenger.user_id} matches driverData.id, skipping notification for ${passenger.name}`);
      continue;
    }
    console.log(`Checking proximity for passenger user_id: ${passenger.user_id}, name: ${passenger.name}, driverData.id: ${driverData.id}`);


      const distance = calculateDistance(
        latitude,
        longitude,
        passenger.pickup_lat,
        passenger.pickup_lng
      );
      const eta = distance / averageSpeed; // ETA in seconds

      if ((useSimulation && (distance < 30 || eta < 60)) || (!useSimulation && (distance < 500 || eta < 120))) {
        const message = `Driver is approaching your pickup at ${passenger.label} (ETA: ${Math.round(eta / 60)} mins)`;
        console.log(`Proximity check: Sending to passenger ${passenger.user_id}, ETA: ${Math.round(eta / 60)} mins`);
        sendNotification(passenger.user_id, message, rideId);
        return true;
      }
    }
  }
  return false;
};


  // Fetch initial driver data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [dashboardResponse, walletResponse, ridesResponse, rideRequestResponse] = await Promise.all([
          driverService.getDashboard(),
          driverService.getWalletBalance(),
          driverService.getDriverRides(),
          driverService.getRideRequests(),
        ]);

        setDriverData(dashboardResponse.data);
        console.log("Driver data:", dashboardResponse.data);
        setWalletBalance(walletResponse.data.wallet_balance || 0);
        console.log("Wallet balance:", walletResponse.data.wallet_balance);
        setRides(ridesResponse.data || []);
        console.log("Rides:", ridesResponse.data);
        setRideRequests(rideRequestResponse.data || []);
        console.log("Ride requests:", rideRequestResponse.data);
        setAvailability(dashboardResponse.data.is_available || true);
        console.log("Availability:", dashboardResponse.data.is_available);
      } catch (err) {
        console.error("Error fetching driver data:", err);
        setError("Failed to load driver dashboard. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Memoize activeRide to prevent unnecessary useEffect triggers
  const activeRide = useMemo(
    () => rides.find((ride) => ride.status === "in_progress"),
    [rides]
  );

  // Handle simulated location updates
  const handleSimulatedLocationUpdate = (simulatedLocation) => {
    if (
      useSimulation &&
      simulatedLocation &&
      simulatedLocation.latitude &&
      simulatedLocation.longitude
    ) {
      const newLocation = {
        latitude: simulatedLocation.latitude,
        longitude: simulatedLocation.longitude,
      };
      if (
        lastValidLocation &&
        Math.abs(lastValidLocation.latitude - newLocation.latitude) < 0.0001 &&
        Math.abs(lastValidLocation.longitude - newLocation.longitude) < 0.0001
      ) {
        console.log("Skipping redundant simulation update:", newLocation);
        return;
      }
      console.log("Processing simulated location:", newLocation);
      setLocation(newLocation);
      setLastValidLocation(newLocation);
      if (activeRide) {
        debouncedUpdateLocation(newLocation, activeRide.carpoolride_id); // Include rideId
        const isNearPickup = checkProximity(
          newLocation.latitude,
          newLocation.longitude,
          activeRide.carpoolride_id
        );
        if (isNearPickup) {
          console.log("Triggering route optimization for simulated location:", newLocation);
          debouncedOptimizeRoute(activeRide.carpoolride_id, newLocation);
        }
      } else {
        console.log("No active ride, skipping backend location update for simulation.");
      }
    }
  };

  // Debounced optimizeRoute
  const debouncedOptimizeRoute = useCallback(
    debounce((rideId, currentLocation) => {
      optimizeRoute(rideId, currentLocation);
    }, 1000),
    []
  );

  // Optimize route with retry mechanism
  const optimizeRoute = async (rideId, currentLocation) => {
    console.log("optimizeRoute called with:", { currentLocation, rideId });
    if (!currentLocation.latitude || !currentLocation.longitude) {
      console.error("Invalid currentLocation:", currentLocation);
      setError("Cannot optimize route: missing latitude or longitude");
      return;
    }

    setOptimizing(true);
    try {
      const rideRequestResponse = await driverService.getRideRequests();
      const rideRequests = rideRequestResponse.data || [];

      const processedRequests = await Promise.all(
        rideRequests
          .filter((req) => req.ride === rideId)
          .map(async (req) => {
            if (typeof req.pickup_location === "string" || 
                (req.pickup_location && (req.pickup_location.lat == null || req.pickup_location.lng == null))) {
              const address = typeof req.pickup_location === "string" 
                ? req.pickup_location 
                : req.pickup_location.label;
              const geocoder = new window.google.maps.Geocoder();
              try {
                const geocodeResult = await new Promise((resolve, reject) => {
                  geocoder.geocode({ address }, (results, status) => {
                    if (status === "OK" && results[0]) {
                      resolve(results[0]);
                    } else {
                      reject(new Error(`Geocoding failed for ${address}: ${status}`));
                    }
                  });
                });
                return {
                  ...req,
                  pickup_location: {
                    lat: geocodeResult.geometry.location.lat(),
                    lng: geocodeResult.geometry.location.lng(),
                    label: address,
                  },
                };
              } catch (err) {
                console.error("Geocoding error:", err);
                return req;
              }
            }
            return req;
          })
      );

      console.log("Sending optimize route request:", {
        currentLocation,
        ride_id: rideId,
      });
      const response = await driverService.optimizeRoute({
        currentLocation,
        ride_id: rideId,
      });
      console.log("Optimized route data:", response);
      if (!response.route) {
        throw new Error("No route data returned from optimization");
      }
      setOptimizedRoute(response);
      retryCount.current = 0;
    } catch (err) {
      console.error("Error optimizing route, full error:", err);
      setError(err.response?.data?.error || `Failed to optimize route: ${err.message || "Unknown error"}`);
      setOptimizedRoute({ route: null, passengers: [] });
      if (retryCount.current < maxRetries) {
        retryCount.current += 1;
        console.log(`Retrying optimizeRoute (${retryCount.current}/${maxRetries})`);
        setTimeout(() => {
          optimizeRoute(rideId, currentLocation);
        }, 2000);
      } else {
        console.error("Max retries reached for optimizeRoute");
        setError("Unable to optimize route after multiple attempts.");
      }
    } finally {
      setOptimizing(false);
      console.log("Optimizing set to false");
    }
  };

  // Handle active ride and location tracking
  useEffect(() => {
    if (!activeRide) {
      // Initialize location to Nairobi default if no active ride
      if (!location.latitude || !location.longitude) {
        const defaultLocation = { latitude: -1.2921, longitude: 36.8219 };
        setLocation(defaultLocation);
        setLastValidLocation(defaultLocation);
        console.log("No active ride, setting default location without backend update.");
      }
      return;
    }

    // Check if already initialized for this ride
    if (initializedRideId.current === activeRide.carpoolride_id) {
      console.log("Skipping duplicate initialOptimize for ride:", activeRide.carpoolride_id);
      return;
    }

    // Initialize location with ride origin
    const origin = activeRide.origin || {
      lat: -1.3434791,
      lng: 36.7659754,
      label: "Galleria Mall, Nairobi",
    };
    setLocation({ latitude: origin.lat, longitude: origin.lng });
    setLastValidLocation({ latitude: origin.lat, longitude: origin.lng });
    debouncedUpdateLocation({ latitude: origin.lat, longitude: origin.lng }, activeRide.carpoolride_id);

    // Initial optimization with ride.origin
    const initialOptimize = async () => {
      setOptimizing(true);
      try {
        const response = await driverService.optimizeRoute({
          currentLocation: { latitude: origin.lat, longitude: origin.lng },
          ride_id: activeRide.carpoolride_id,
        });
        console.log("Initial optimizeRoute response:", response);
        if (!response.route) {
          throw new Error("No route data returned from initial optimization");
        }
        setOptimizedRoute(response);
      } catch (error) {
        console.error("Error optimizing route:", error);
        setError("Failed to optimize route: " + error.message);
      } finally {
        setOptimizing(false);
        console.log("Initial optimizing set to false");
      }
    };

    initialOptimize();
    initializedRideId.current = activeRide.carpoolride_id; // Mark as initialized

    if (useSimulation) {
      return;
    }

    // Real-time location tracking (non-simulation mode)
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        console.log("Geolocation:", {
          latitude,
          longitude,
          accuracy,
          timestamp: position.timestamp,
        });

        if (
          accuracy > 50 ||
          typeof latitude !== "number" ||
          isNaN(latitude) ||
          typeof longitude !== "number" ||
          isNaN(longitude)
        ) {
          console.warn("Invalid or low accuracy location:", {
            latitude,
            longitude,
            accuracy,
          });
          setError(`Invalid or low accuracy on the location (accuracy: ${accuracy}m)`);
          if (lastValidLocation) {
            setLocation(lastValidLocation);
          }
          return;
        }

        const newLocation = { latitude, longitude };
        setLocation(newLocation);
        setLastValidLocation(newLocation);
        debouncedUpdateLocation(newLocation, activeRide.carpoolride_id); // Include rideId
        console.log("Updated location:", newLocation);

        const isNearPickup = checkProximity(
          latitude,
          longitude,
          activeRide.carpoolride_id
        );
        if (activeRide && isNearPickup) {
          debouncedOptimizeRoute(activeRide.carpoolride_id, newLocation);
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        setError("Unable to retrieve location: " + err.message);
        if (lastValidLocation) {
          setLocation(lastValidLocation);
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      initializedRideId.current = null; // Reset on cleanup
    };
  }, [activeRide, useSimulation]);

  // Handle setting availability
  const handleSetAvailability = async () => {
    try {
      const newAvailability = !availability;
      await driverService.setAvailability({ is_available: newAvailability });
      setAvailability(newAvailability);
      alert(`Availability set to ${newAvailability ? "Available" : "Unavailable"}`);
    } catch (error) {
      console.error("Error setting availability:", error);
      alert("Failed to set availability: " + (error.response?.data?.error || "Unknown error"));
    }
  };

  // Handle creating a new ride
  const handleCreateRide = async (e) => {
    e.preventDefault();
    const activeRides = rides.filter((ride) => ride.status === "pending" || ride.status === "in_progress");
    if (activeRides.length > 0) {
      toast.warn("You already have an active ride. Please complete it before creating a new one.");
      // alert("You already have an active ride. Please complete it before creating a new one.");
      return;
    }
    // Validate departure_time
    if (rideForm.departure_time) {
        const departureDate = new Date(rideForm.departure_time);
        if (departureDate < new Date()) {
            toast.warn("Departure time cannot be in the past.");
            // alert("Departure time cannot be in the past.");
            return;
        }
    }
    // validate ride capacity
    if (vehicleCapacity && parseInt(rideForm.available_seats) > vehicleCapacity) {
      toast.warn(`Available seats cannot exceed your vehicle capacity, which is ${vehicleCapacity}.`);
      // alert(`Available seats cannot exceed vehicle capacity of ${vehicleCapacity}.`);
      return;
    }
    

    try {
      console.log("Sending rideForm data:", rideForm);
      await driverService.createCarpoolRide(rideForm);
      toast.success("Ride created successfully!");
      // alert("Ride created successfully!");
      setRideForm({
        origin: "",
        destination: "",
        departure_time: "",
        available_seats: "",
        contribution_per_seat: "",
        is_women_only: false,
      });
      const ridesResponse = await driverService.getDriverRides();
      console.log("Create ride response:", ridesResponse);
      setRides(ridesResponse.data || []);
    } catch (error){
      {
        console.error("Error creating ride:", error);
        let errorMessage = "Unknown error";
        if (error.response && error.response.status === 400) {
            const errorData = error.response.data;
            if (typeof errorData === "object" && errorData !== null) {
                // Handle field-specific errors (e.g., { departure_time: ["..."] })
                const fieldErrors = Object.keys(errorData)
                    .filter((key) => key !== "non_field_errors")
                    .map((key) => {
                        const messages = Array.isArray(errorData[key])
                            ? errorData[key].join(", ")
                            : errorData[key];
                        return `${key.replace("_", " ")}: ${messages}`;
                    });
                // Handle non-field errors (e.g., { non_field_errors: ["..."] })
                const nonFieldErrors = errorData.non_field_errors
                    ? Array.isArray(errorData.non_field_errors)
                        ? errorData.non_field_errors.join(", ")
                        : errorData.non_field_errors
                    : null;
                // Combine errors
                errorMessage = [
                    ...fieldErrors,
                    nonFieldErrors,
                ].filter(Boolean).join("; ") || "Validation error occurred";
            } else {
                errorMessage = errorData || "Invalid request";
            }
        } else if (error.response) {
            errorMessage = `Server error (status: ${error.response.status})`;
          }
          alert(`Failed to create ride: ${errorMessage}`);
      }
  }
    
  };

  // Handle selecting place for Autocomplete
  const handlePlaceSelect = (field) => {
    const autocomplete = field === "origin" ? originRef.current : destinationRef.current;
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        const location = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          label: formatPlaceLabel(place),
        };
        setRideForm((prev) => ({ ...prev, [field]: location }));
      }
    }
  };

  // Handle starting a ride
  const handleStartRide = async (rideId) => {
    try {
      await driverService.startRide(rideId);
      setRides((prev) =>
        prev.map((ride) =>
          ride.carpoolride_id === rideId ? { ...ride, status: "in_progress" } : ride
        )
      );
      if (location.latitude && location.longitude) {
        optimizeRoute(rideId, location);
      }
      // alert("Ride started! Passengers notified.");
      toast.success("Ride started.");
    } catch (error) {
      console.error("Error starting ride:", error);
      alert("Failed to start ride: " + (error.response?.data?.error || "Unknown error"));
    }
  };

  // Handle completing a ride
  const handleCompleteRide = async (rideId) => {
    try {
      await driverService.completeRide(rideId);
      setRides((prev) =>
        prev.map((ride) =>
          ride.carpoolride_id === rideId ? { ...ride, status: "completed" } : ride
        )
      );
      const rideRequestResponse = await driverService.getRideRequests();
      setRideRequests(rideRequestResponse.data || []);
      setOptimizedRoute(null);
      toast.success("Ride Completed!");
      // alert("Ride completed! Passengers notified.");
    } catch (error) {
      console.error("Error completing ride:", error);
      alert("Failed to complete ride: " + (error.response?.data?.error || "Unknown error"));
    }
  };


  // Handle accepting a ride request
  const handleAcceptRequest = async (ridrequest_id) => {
    try {
      await driverService.approveRideRequest(ridrequest_id);
      setRideRequests((prev) =>
        prev.map((req) =>
          req.ridrequest_id === ridrequest_id ? { ...req, status: "accepted" } : req
        )
      );
      const ridesResponse = await driverService.getDriverRides();
      setRides(ridesResponse.data || []);
    } catch (error) {
      console.error("Error accepting request:", error);
      alert("Failed to accept request: " + (error.response?.data?.error || "Unknown error"));
    }
  };

  // Handle rejecting a ride request
  const handleRejectRequest = async (ridrequest_id) => {
    try {
      await driverService.rejectRideRequest(ridrequest_id);
      setRideRequests((prev) =>
        prev.map((req) =>
          req.ridrequest_id === ridrequest_id ? { ...req, status: "declined" } : req
        )
      );
    } catch (error) {
      console.error("Error rejecting request:", error);
      alert("Failed to reject request: " + (error.response?.data?.error || "Unknown error"));
    }
  };

  // Handle updating a ride

  const handleUpdateRide = async (e) => {
  e.preventDefault();
  if (!departureTime) {
    toast.warn("Please select a departure time.");
    // alert("Please select a departure time.");
    return;
  }
  const departureDate = new Date(departureTime);
  if (departureDate < new Date()) {
    toast.warn("Departure time must be in the future.");
    // alert("Departure time must be in the future.");
    return;
  }
  try {
    console.log("Updating ride with departure_time:", departureTime);
    const response = await driverService.updateRide(selectedRideId, {
      departure_time: departureTime,
    });
    if (response.status === 200) {
      toast.success("Ride updated successfully!");
      // alert("Ride updated successfully!");
      
      // Refresh rides
      const ridesResponse = await driverService.getDriverRides();
      setRides(ridesResponse.data || []);
      setSelectedRideId(null);
      setDepartureTime("");
    } else {
      console.error("Unexpected response:", response);
      alert("Failed to update ride: Unexpected server response (status: " + response.status + ")");
    }
  } catch (error) {
    console.error("Error updating ride:", error);
    let errorMessage = "Unknown error";
    if (error.response && error.response.status === 400) {
      const errorData = error.response.data;
      if (typeof errorData === "object" && errorData !== null) {
        const fieldErrors = Object.keys(errorData)
          .filter((key) => key !== "non_field_errors")
          .map((key) => {
            const messages = Array.isArray(errorData[key])
              ? errorData[key].join(", ")
              : errorData[key];
            return `${key.replace("_", " ")}: ${messages}`;
          });
        const nonFieldErrors = errorData.non_field_errors
          ? Array.isArray(errorData.non_field_errors)
            ? errorData.non_field_errors.join(", ")
            : errorData.non_field_errors
          : null;
        errorMessage = [
          ...fieldErrors,
          nonFieldErrors,
        ].filter(Boolean).join("; ") || "Validation error occurred";
      } else {
        errorMessage = errorData || "Invalid request";
      }
    } else if (error.response) {
      errorMessage = `Server error (status: ${error.response.status})`;
    }
    alert(`Failed to update ride: ${errorMessage}`);
  }
};

// cancel ride update
const handleCancelEdit = () => {
  setSelectedRideId(null);
  setDepartureTime('');
};

  // Handle selecting a ride for editing
  const handleSelectRide = (ride) => {
    setSelectedRideId(ride.carpoolride_id);
    setDepartureTime(ride.departure_time);
  };
  // handle notification
  const handleDismiss = async (notif) => {
      if (isDismissing.current.has(notif.notification_id)) {
          console.log(`Dismiss already in progress for ${notif.notification_id}`);
          return;
      }
      isDismissing.current.add(notif.notification_id);
      console.log("Dismiss notif:", notif);
      try {
          const response = await notificationService.dismissNotification(notif.notification_id);
          console.log("Dismiss response:", response);
          if (response.status === 200) {
              setDismissedNotifications((prev) => new Set(prev).add(notif.notification_id));
              setNotifications((prev) => {
                  console.log("Before filter:", prev);
                  const updated = prev.filter((n) => n.notification_id !== notif.notification_id);
                  console.log("After filter:", updated);
                  return updated;
              });
              console.log("Notification removed from UI");
              // Optional: Log or show different feedback based on message
              if (response.data && response.data.message === "Notification already dismissed") {
                  console.log("Notification was already dismissed, no further action needed");
              }
          } else {
              console.error("Unexpected dismiss response:", response);
              alert("Failed to dismiss notification: Unexpected response from server (status: " + response.status + ")");
          }
      } catch (error) {
          console.error("Failed to dismiss notification:", error);
          setDismissedNotifications((prev) => new Set(prev).add(notif.notification_id));
          setNotifications((prev) => {
              console.log("Before filter (error):", prev);
              const updated = prev.filter((n) => n.notification_id !== notif.notification_id);
              console.log("After filter (error):", updated);
              return updated;
          });
          console.log("Notification removed from UI despite error");
          alert("Removed notification locally due to server error: " + (error.message || "Unknown error"));
      } finally {
          isDismissing.current.delete(notif.notification_id);
      }
  };

// Format date and time
// to display time in rides
  const formatDateTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).replace(',', '');
    } catch {
      return 'Invalid date';
    }
  };

  // for input in selecRide update
  const formatDateTimeForInput = (dateString) => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
};

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;
  if (!driverData) return <div>No driver data available.</div>;

  return (
    <div className="driver-dashboard">
      <div className="driver-profile-card">
  <h2 className="driver-title">Welcome, {driverData.full_name}</h2>
  <div className="driver-info">
    <p><span className="info-label">Phone:</span> {driverData.phone_number}</p>
    {/* <p><span className="info-label">Verified:</span> {driverData.is_verified ? "Yes" : "No"}</p> */}
    <p><span className="info-label">Wallet Balance:</span> Ksh {(walletBalance || 0.00).toFixed(2)}</p>
    {/* <p><span className="info-label">Rating:</span> {driverData.rating}</p> */}
    {/* <p><span className="info-label">Availability:</span> {availability ? "Available" : "Unavailable"}</p> */}
    {/* <p><span className="info-label">Current Location:</span> {location.latitude || "N/A"}, {location.longitude || "N/A"}</p> */}
  </div>
  <div className="driver-actions">
    <button onClick={handleSetAvailability} className="driver-form-button">
      {availability ? "Set Unavailable" : "Set Available"}
    </button>
    <label className="simulation-label">
      <input
        type="checkbox"
        checked={useSimulation}
        onChange={(e) => setUseSimulation(e.target.checked)}
      />
      Use Simulated Location
    </label>
  </div>
</div>

      {/* i prefer notification appearing in the as passenger's side */}
      {notifications.length > 0 && (
        <div className="notifications">
          <h4>Notifications <span className="badge">{notifications.filter(n => n.is_new).length} new</span></h4>
          <div className="notification-list">
            {notifications.map((notif) => (
              <div
                key={notif.notification_id}
                className={`notification-item ${notif.is_new ? 'new' : ''}`}
              >
                <span className="icon">{notif.type === 'cancellation' ? '🚫' : '📩'}</span>
                <div className="content">
                  <p>{notif.message} {notif.carpoolride_id && `(Ride ID: ${notif.carpoolride_id})`}</p>
                  <small>{new Date(notif.time).toLocaleTimeString()}</small>
                  <small>Notification ID: {notif.notification_id}</small>
                </div>
                <button onClick={() => handleDismiss(notif)}>Dismiss</button>
              </div>
            ))}
          </div>
        </div>
      )}
     
      {/* Always render MapComponent */}
      <div className="MapComponent">
      <MapComponent
        optimizedRoute={optimizedRoute}
        onLocationUpdate={handleSimulatedLocationUpdate}
        useSimulation={useSimulation}
        currentLocation={location}
      />
      </div>

      {/* Conditionally render route details */}
      {optimizedRoute && optimizedRoute.route && (
        <div className="driver-ride-card">
          <h3 className="driver-title">
            Optimized Route
            {/* {optimizedRoute.route.legs[optimizedRoute.route.legs.length - 1]?.end_address || "Unknown Destination"} */}
          </h3>
          {optimizing ? (
            <p>Optimizing route...</p>
          ) : (
            <>
              {/* <p>Summary: {optimizedRoute.route.summary || "N/A"}</p> */}
              <p>
                Total Distance:{" "}
                {(optimizedRoute.route.legs.reduce((acc, leg) => acc + leg.distance.value, 0) / 1000).toFixed(2)} km
              </p>
              <p>
                Total Duration:{" "}
                {(optimizedRoute.route.legs.reduce((acc, leg) => acc + leg.duration.value, 0) / 60).toFixed(0)} minutes
              </p>

               {/* <h4>Route Legs:</h4>
              {optimizedRoute.route.legs.length > 0 ? (
                optimizedRoute.route.legs.map((leg, index) => (
                  <div key={index} className="mb-4">
                    <p>
                      <strong>Leg {index + 1}:</strong> From {leg.start_address} to {leg.end_address}
                    </p>
                    <p>Distance: {leg.distance.text}</p>
                    <p>Duration: {leg.duration.text}</p>
                  </div>
                ))
              ) : (
                <p>No legs found for this route.</p>
              )} */}

              <h4>Passengers</h4>
              {optimizedRoute.passengers && optimizedRoute.passengers.length > 0 ? (
                optimizedRoute.passengers.map((passenger, index) => (
                  <p key={index}>
                    {passenger.name}: {passenger.label})
                    {/* {passenger.name}: {passenger.label} ({passenger.pickup_lat}, {passenger.pickup_lng}) */}
                  </p>
                ))
              ) : (
                <p>No passengers assigned.</p>
              )}
            </>
          )}
        </div>
      )}

      <h3 className="driver-title">Create a New Ride</h3>
      {rides.some((r) => r.status === "pending" || r.status === "in_progress") ? (
        <div className="conditional-message">
        <p>You must complete your current ride before creating a new one.</p>
        </div>
      ) : (
        <form onSubmit={handleCreateRide} className="driver-form">
          <Autocomplete
            onLoad={(autocomplete) => {
              originRef.current = autocomplete;
              autocomplete.setComponentRestrictions({ country: "ke" });
            }}
            onPlaceChanged={() => handlePlaceSelect("origin")}
          >
            <input
              type="text"
              placeholder="Pickup Location"
              value={rideForm.origin?.label || ""}
              onChange={(e) =>
                setRideForm({ ...rideForm, origin: { label: e.target.value, lat: null, lng: null } })
              }
              className="driver-form-input"
            />
          </Autocomplete>
          <Autocomplete
            onLoad={(autocomplete) => {
              destinationRef.current = autocomplete;
              autocomplete.setComponentRestrictions({ country: "ke" });
            }}
            onPlaceChanged={() => handlePlaceSelect("destination")}
          >
            <input
              type="text"
              placeholder="Destination"
              value={rideForm.destination?.label || ""}
              onChange={(e) =>
                setRideForm({ ...rideForm, destination: { label: e.target.value, lat: null, lng: null } })
              }
              className="driver-form-input"
            />
          </Autocomplete>
          <input
            type="datetime-local"
            value={rideForm.departure_time}
            onChange={(e) => setRideForm({ ...rideForm, departure_time: e.target.value })}
            className="driver-form-input"
            min={new Date().toISOString().slice(0, 16)} 
            max={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)} // +14 days
          />
          <input
            type="number"
            placeholder="Available Seats"
            value={rideForm.available_seats}
            onChange={(e) => setRideForm({ ...rideForm, available_seats: e.target.value })}
            className="driver-form-input"
            min="1"
            // max={vehicleCapacity || 10}
          />
          <input
            type="number"
            placeholder="Contribution per Seat"
            value={rideForm.contribution_per_seat}
            onChange={(e) => setRideForm({ ...rideForm, contribution_per_seat: e.target.value })}
            className="driver-form-input"
          />
          <label>
            <input
              type="checkbox"
              checked={rideForm.is_women_only}
              onChange={(e) => setRideForm({ ...rideForm, is_women_only: e.target.checked })}
            />
            Women-Only Ride
          </label>
          <button type="submit" className="driver-form-button">Create Ride</button>
        </form>
      )}

      <h3 className="driver-title">Your Rides</h3>
      {rides.length > 0 ? (
        rides
          .filter((ride) => ride.status === "pending" || ride.status === "in_progress")
          .map((ride) => (
            <div key={ride.carpoolride_id} className="driver-ride-card">
              <p>Driver’s Start: {ride.origin?.label || "N/A"}</p>
              <p>Driver’s End: {ride.destination?.label || "N/A"}</p>
              {/* <p>Departure (UTC): {new Date(ride.departure_time).toISOString().replace("T", " ").slice(0, -5)}</p> */}
              <p>Departure:{formatDateTime(ride.departure_time)}</p>
              <p>Seats not researved: {ride.available_seats}</p>
              <p>Status: {ride.status}</p>
              {ride.requests && ride.requests.length > 0 ? (
                <>
                  <p>Passenger Pickups:</p>
                  <ul>
                    {ride.requests
                      .filter((req) => req.status === "accepted")
                      .map((req) => (
                        <li key={req.ridrequest_id}>
                          {req.passenger_name || "Unknown"} from {req.pickup_location?.label || "N/A"}
                          {req.dropoff_location && ` to ${req.dropoff_location.label}`}
                        </li>
                      ))}
                  </ul>
                </>
              ) : (
                <div className="conditional-message">
                <p>No accepted passenger requests.</p>
                </div>
              )}
              {ride.status === "pending" && (
                <button
                  onClick={() => handleStartRide(ride.carpoolride_id)}
                  className="driver-form-button"
                >
                  Start Ride
                </button>
              )}
              {ride.status === "in_progress" && (
                <button
                  onClick={() => handleCompleteRide(ride.carpoolride_id)}
                  className="driver-form-button"
                >
                  Complete Ride
                </button>
              )}
              {ride.status === "pending" && (
                <button onClick={() => handleSelectRide(ride)} className="driver-form-button">
                  Edit
                </button>
              )}
            </div>
          ))
      ) : (
        <div className="conditional-message">
        <p>No rides created yet.</p>
        </div>
      )}

      {selectedRideId && (
        <>
          <h3 className="driver-title">Currently your editing ride</h3>
          <form onSubmit={handleUpdateRide} className="driver-form">
            <input
              type="datetime-local"
              value = {departureTime? formatDateTimeForInput(departureTime): ""}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="driver-form-input"
              min={formatDateTimeForInput(new Date())}
              max={formatDateTimeForInput(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))}
            />
            <button type="submit" className="driver-form-button">Update Pickup Date</button>
            <button type="button" onClick={handleCancelEdit} className="driver-form-button cancel-button">
            Cancel update
          </button>
          </form>
        </>
      )}

      <h3 className="driver-title">Ride Requests</h3>
      {rideRequests.length > 0 ? (
        rideRequests.map((req) => (
          <div key={req.ridrequest_id} className="driver-request-card">
            <p>Passenger: {req.passenger_name || "Unknown"}</p>
            <p>Pick up point: {req.pickup_location?.label || "N/A"}</p>
            {/* <p>Drop off location: {req.dropoff_location?.label || "N/A"}</p> */}
            <p>Seats Requested: {req.seats_requested || "N/A"}</p>
            {/* <p>Payment Status: {req.payment_status || "N/A"}</p> */}
            <p>Status: {req.status}</p>
            {req.status === "pending" && (
              <>
                <button
                  onClick={() => handleAcceptRequest(req.ridrequest_id)}
                  className="driver-form-button"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleRejectRequest(req.ridrequest_id)}
                  className="driver-form-button"
                >
                  Decline
                </button>
              </>
            )}
          </div>
        ))
      ) : (
        <div className="conditional-message">
        <p>No ride requests.</p>
        </div>
      )}
    </div>
  );
}

export default DriverDashboard;