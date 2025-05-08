import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { driverService } from "../services/api";
import { Autocomplete } from "@react-google-maps/api";
import MapComponent from "./MapComponent";
import { formatPlaceLabel } from "../utils/placeUtils";

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
  const retryCount = useRef(0);
  const maxRetries = 3;

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

    const token = localStorage.getItem("jwt_token");
    if (!token) {
      console.error("No JWT token found for WebSocket connection");
      setError("Authentication error: Please log in again.");
      return;
    }

    const wsUrl = `ws://127.0.0.1:8000/ws/notifications/user_${driverData.id}/?token=${token}`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log(`WebSocket connected for user ${driverData.id}`);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "send_notification") {
          setNotifications((prev) => [
            ...prev,
            {
              message: data.message,
              carpoolride_id: data.carpoolride_id,
              time: new Date(),
            },
          ]);
          console.log(`Received notification: ${data.message}`);
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
      console.log(`WebSocket closed for user ${driverData.id}, code: ${event.code}`);
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [driverData?.id]);

  // Send notification
  const sendNotification = async (userId, message, carpoolride_id = null) => {
    try {
      console.log(`Sending notification to user ${userId}: ${message}, ride: ${carpoolride_id}`);
      await driverService.sendNotification({
        user_id: userId,
        message,
        carpoolride_id,
      });
      setNotifications((prev) => [
        ...prev,
        { userId, message, carpoolride_id, time: new Date() },
      ]);
    } catch (err) {
      console.error("Error sending notification:", err);
      setError("Failed to send notification.");
    }
  };

  // Check proximity to passengers and send notifications
  const checkProximity = (latitude, longitude, rideId) => {
    if (optimizedRoute?.passengers) {
      const averageSpeed = 40 / 3.6; // 40 km/h in m/s
      for (const passenger of optimizedRoute.passengers) {
        const distance = calculateDistance(
          latitude,
          longitude,
          passenger.pickup_lat,
          passenger.pickup_lng
        );
        const eta = distance / averageSpeed; // ETA in seconds
        if (distance < 500 || eta < 120) {
          sendNotification(
            passenger.user_id,
            `Driver is approaching your pickup at ${passenger.label} (ETA: ${Math.round(eta / 60)} mins)`,
            rideId
          );
          return true; // Indicate proximity for optimization
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
        setWalletBalance(walletResponse.data.balance || 0);
        console.log("Wallet balance:", walletResponse.data.balance);
        setRides(ridesResponse.data || []);
        console.log("Rides:", ridesResponse.data);
        setRideRequests(rideRequestResponse.data || []);
        console.log("Ride requests:", rideRequestResponse.data);
        setAvailability(dashboardResponse.data.is_available || false);
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
      retryCount.current = 0; // Reset retry count on success
    } catch (err) {
      console.error("Error optimizing route:", err);
      setError(err.response?.data?.error || `Failed to optimize route: ${err.message}`);
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
      alert("You already have an active ride. Please complete it before creating a new one.");
      return;
    }
    try {
      console.log("Sending rideForm data:", rideForm);
      await driverService.createCarpoolRide(rideForm);
      alert("Ride created successfully!");
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
    } catch (error) {
      console.error("Error creating ride:", error);
      alert("Failed to create ride: " + (error.response?.data?.error || "Unknown error"));
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
      alert("Ride started! Passengers notified.");
    } catch (error) {
      console.error("Error starting ride:", error);
      alert("Failed to start ride: " + (error.response?.data?.error || "Unknown error"));
    }
  };

  // // Handle completing a ride
  // const handleCompleteRide = async (rideId) => {
  //   try {
  //     await driverService.completeRide(rideId);  // 👈 now uses the proper completion endpoint
  
  //     // Update UI status manually since the server no longer returns the updated ride object
  //     setRides((prev) =>
  //       prev.map((ride) =>
  //         ride.carpoolride_id === rideId ? { ...ride, status: "completed" } : ride
  //       )
  //     );
  
  //     const rideRequestResponse = await driverService.getRideRequests();
  //     setRideRequests(rideRequestResponse.data || []);
  //     setOptimizedRoute(null);
  
  //     alert("Ride completed! Passengers notified.");
  //   } catch (error) {
  //     console.error("Error completing ride:", error);
  //     alert("Failed to complete ride: " + (error.response?.data?.error || "Unknown error"));
  //   }
  // };
  const handleCompleteRide = async (rideId) => {
    try {
      await driverService.updateRide(rideId, { status: "completed" });
      setRides((prev) =>
        prev.map((ride) =>
          ride.carpoolride_id === rideId ? { ...ride, status: "completed" } : ride
        )
      );
      const rideRequestResponse = await driverService.getRideRequests();
      setRideRequests(rideRequestResponse.data || []);
      setOptimizedRoute(null);
      alert("Ride completed! Passengers notified.");
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
    if (!selectedRideId) return alert("Please select a ride to update.");
    try {
      const localDateTime = new Date(departureTime);
      const utcDateTime = new Date(localDateTime.getTime() - localDateTime.getTimezoneOffset() * 60000);
      const updatedRide = { departure_time: utcDateTime.toISOString() };
      await driverService.updateRide(selectedRideId, updatedRide);
      alert("Ride updated successfully!");
      setDepartureTime("");
      setSelectedRideId(null);
      const ridesResponse = await driverService.getDriverRides();
      setRides(ridesResponse.data || []);
    } catch (error) {
      console.error("Error updating ride:", error);
      alert("Failed to update ride: " + (error.response?.data?.error || "Unknown error"));
    }
  };

  // Handle selecting a ride for editing
  const handleSelectRide = (ride) => {
    setSelectedRideId(ride.carpoolride_id);
    setDepartureTime(ride.departure_time);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;
  if (!driverData) return <div>No driver data available.</div>;

  return (
    <div className="driver-dashboard">
      <h2 className="driver-title">Welcome, {driverData.full_name}</h2>
      <p>Phone: {driverData.phone_number}</p>
      <p>Verified: {driverData.is_verified ? "Yes" : "No"}</p>
      <p>Wallet Balance: ${walletBalance}</p>
      <p>Rating: {driverData.rating}</p>
      <p>Availability: {availability ? "Available" : "Unavailable"}</p>
      <p>Current Location: {location.latitude || "N/A"}, {location.longitude || "N/A"}</p>
      <button onClick={handleSetAvailability} className="driver-form-button">
        {availability ? "Set Unavailable" : "Set Available"}
      </button>
      <label>
        <input
          type="checkbox"
          checked={useSimulation}
          onChange={(e) => setUseSimulation(e.target.checked)}
        />
        Use Simulated Location
      </label>

      {notifications.length > 0 && (
        <div className="notifications">
          <h4>Notifications</h4>
          {notifications.map((notif, index) => (
            <p key={index}>
              {notif.time.toLocaleTimeString()}: {notif.message}
              {notif.carpoolride_id && ` (Ride ID: ${notif.carpoolride_id})`}
            </p>
          ))}
        </div>
      )}

      {/* Always render MapComponent */}
      <MapComponent
        optimizedRoute={optimizedRoute}
        onLocationUpdate={handleSimulatedLocationUpdate}
        useSimulation={useSimulation}
        currentLocation={location}
      />

      {/* Conditionally render route details */}
      {optimizedRoute && optimizedRoute.route ? (
        <div className="driver-ride-card">
          <h3 className="driver-title">
            Optimized Route to{" "}
            {optimizedRoute.route.legs[optimizedRoute.route.legs.length - 1]?.end_address || "Unknown Destination"}
          </h3>
          {optimizing ? (
            <p>Optimizing route...</p>
          ) : (
            <>
              <p>Summary: {optimizedRoute.route.summary || "N/A"}</p>
              <p>
                Total Distance:{" "}
                {(optimizedRoute.route.legs.reduce((acc, leg) => acc + leg.distance.value, 0) / 1000).toFixed(2)} km
              </p>
              <p>
                Total Duration:{" "}
                {(optimizedRoute.route.legs.reduce((acc, leg) => acc + leg.duration.value, 0) / 60).toFixed(0)} minutes
              </p>

              <h4>Route Legs:</h4>
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
              )}

              <h4>Passengers</h4>
              {optimizedRoute.passengers && optimizedRoute.passengers.length > 0 ? (
                optimizedRoute.passengers.map((passenger, index) => (
                  <p key={index}>
                    {passenger.name}: {passenger.label} ({passenger.pickup_lat}, {passenger.pickup_lng})
                  </p>
                ))
              ) : (
                <p>No passengers assigned.</p>
              )}
            </>
          )}
        </div>
      ) : (
        <p>No optimized route available. {optimizedRoute && !optimizedRoute.route ? "Route optimization failed." : "Start a ride to view details."}</p>
      )}

      <h3 className="driver-title">Create a New Ride</h3>
      {rides.some((r) => r.status === "pending" || r.status === "in_progress") ? (
        <p>You must complete your current ride before creating a new one.</p>
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
          />
          <input
            type="number"
            placeholder="Available Seats"
            value={rideForm.available_seats}
            onChange={(e) => setRideForm({ ...rideForm, available_seats: e.target.value })}
            className="driver-form-input"
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
              <p>Departure (UTC): {new Date(ride.departure_time).toISOString().replace("T", " ").slice(0, -5)}</p>
              <p>Seats: {ride.available_seats}</p>
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
                <p>No accepted passenger requests.</p>
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
        <p>No rides created yet.</p>
      )}

      {selectedRideId && (
        <>
          <h3 className="driver-title">Edit Ride (ID: {selectedRideId})</h3>
          <form onSubmit={handleUpdateRide} className="driver-form">
            <input
              type="datetime-local"
              value={departureTime ? new Date(departureTime).toISOString().slice(0, 16) : ""}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="driver-form-input"
            />
            <button type="submit" className="driver-form-button">Update Pickup Date</button>
          </form>
        </>
      )}

      <h3 className="driver-title">Ride Requests</h3>
      {rideRequests.length > 0 ? (
        rideRequests.map((req) => (
          <div key={req.ridrequest_id} className="driver-request-card">
            <p>Passenger: {req.passenger_name || "Unknown"}</p>
            <p>Pick up point: {req.pickup_location?.label || "N/A"}</p>
            <p>Drop off location: {req.dropoff_location?.label || "N/A"}</p>
            <p>Seats Requested: {req.seats_requested || "N/A"}</p>
            <p>Payment Status: {req.payment_status || "N/A"}</p>
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
        <p>No ride requests.</p>
      )}
    </div>
  );
}

export default DriverDashboard;





// import { useEffect, useState, useRef, useCallback, useMemo } from "react";
// import { driverService } from "../services/api";
// import { Autocomplete } from "@react-google-maps/api";
// import MapComponent from "./MapComponent";
// import { formatPlaceLabel } from "../utils/placeUtils";

// // Debounce utility to limit frequent API calls
// const debounce = (func, wait) => {
//   let timeout;
//   return (...args) => {
//     clearTimeout(timeout);
//     timeout = setTimeout(() => func(...args), wait);
//   };
// };

// function DriverDashboard() {
//   const [driverData, setDriverData] = useState(null);
//   const [rideForm, setRideForm] = useState({
//     origin: "",
//     destination: "",
//     departure_time: "",
//     available_seats: "",
//     contribution_per_seat: "",
//     is_women_only: false,
//   });
//   const [rideRequests, setRideRequests] = useState([]);
//   const [idFront, setIdFront] = useState(null);
//   const [idBack, setIdBack] = useState(null);
//   const [smartDL, setSmartDL] = useState(null);
//   const [rides, setRides] = useState([]);
//   const [selectedRideId, setSelectedRideId] = useState(null);
//   const [departureTime, setDepartureTime] = useState("");
//   const [availability, setAvailability] = useState(false);
//   const [location, setLocation] = useState({ latitude: null, longitude: null });
//   const [lastValidLocation, setLastValidLocation] = useState(null);
//   const [walletBalance, setWalletBalance] = useState(0);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [optimizedRoute, setOptimizedRoute] = useState(null);
//   const [optimizing, setOptimizing] = useState(false);
//   const [notifications, setNotifications] = useState([]);
//   const [useSimulation, setUseSimulation] = useState(true);
//   const initializedRideId = useRef(null);
//   const originRef = useRef(null);
//   const destinationRef = useRef(null);
//   const wsRef = useRef(null);
//   const retryCount = useRef(0);
//   const maxRetries = 3;

//   // Calculate distance (Haversine formula)
//   const calculateDistance = (lat1, lon1, lat2, lon2) => {
//     const R = 6371e3; // Earth's radius in meters
//     const φ1 = (lat1 * Math.PI) / 180;
//     const φ2 = (lat2 * Math.PI) / 180;
//     const Δφ = ((lat2 - lat1) * Math.PI) / 180;
//     const Δλ = ((lon2 - lon1) * Math.PI) / 180;

//     const a =
//       Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
//       Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
//     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//     return R * c; // Distance in meters
//   };

//   // Update driver location to backend
//   const updateDriverLocation = async (location, rideId = null) => {
//     if (!rideId) {
//       console.log("No active ride, skipping location update.");
//       return false;
//     }
//     try {
//       const payload = {
//         latitude: location.latitude,
//         longitude: location.longitude,
//         is_simulated: useSimulation,
//         ride_id: rideId,
//       };
//       console.log("Sending location update payload:", payload);
//       const response = await driverService.updateLocation(payload);
//       console.log("Driver location update response:", response);
//       retryCount.current = 0; // Reset retry count on success
//       return true;
//     } catch (err) {
//       console.error("Error updating driver location:", err);
//       setError(`Failed to update driver location: ${err.message}`);
//       if (retryCount.current < maxRetries) {
//         retryCount.current += 1;
//         console.log(`Retrying location update (${retryCount.current}/${maxRetries})`);
//         setTimeout(() => updateDriverLocation(location, rideId), 2000);
//       } else {
//         console.error("Max retries reached for location update");
//         setError("Unable to update driver location after multiple attempts.");
//       }
//       return false;
//     }
//   };
//   // const updateDriverLocation = async (location, rideId = null) => {
//   //   try {
//   //     const payload = {
//   //       latitude: location.latitude,
//   //       longitude: location.longitude,
//   //       is_simulated: useSimulation,
//   //     };
//   //     if (rideId) {
//   //       payload.ride_id = rideId;
//   //     }
//   //     console.log("Sending location update payload:", payload);
//   //     const response = await driverService.updateLocation(payload);
//   //     console.log("Driver location update response:", response);
//   //     retryCount.current = 0; // Reset retry count on success
//   //     return true;
//   //   } catch (err) {
//   //     console.error("Error updating driver location:", err);
//   //     setError(`Failed to update driver location: ${err.message}`);
//   //     if (retryCount.current < maxRetries) {
//   //       retryCount.current += 1;
//   //       console.log(`Retrying location update (${retryCount.current}/${maxRetries})`);
//   //       setTimeout(() => updateDriverLocation(location, rideId), 2000);
//   //     } else {
//   //       console.error("Max retries reached for location update");
//   //       setError("Unable to update driver location after multiple attempts.");
//   //     }
//   //     return false;
//   //   }
//   // };

//   // Debounced location update
//   const debouncedUpdateLocation = useCallback(
//     debounce((location, rideId) => {
//       console.log("Triggering debounced location update:", { location, rideId });
//       updateDriverLocation(location, rideId);
//     }, 1500),
//     [useSimulation] // Include useSimulation in dependencies
//   );

//   // Initialize WebSocket connection for driver notifications
//   useEffect(() => {
//     if (!driverData?.id) return;

//     const token = localStorage.getItem("jwt_token");
//     if (!token) {
//       console.error("No JWT token found for WebSocket connection");
//       setError("Authentication error: Please log in again.");
//       return;
//     }

//     const wsUrl = `ws://127.0.0.1:8000/ws/notifications/user_${driverData.id}/?token=${token}`;
//     wsRef.current = new WebSocket(wsUrl);

//     wsRef.current.onopen = () => {
//       console.log(`WebSocket connected for user ${driverData.id}`);
//     };

//     wsRef.current.onmessage = (event) => {
//       try {
//         const data = JSON.parse(event.data);
//         if (data.type === "send_notification") {
//           setNotifications((prev) => [
//             ...prev,
//             {
//               message: data.message,
//               carpoolride_id: data.carpoolride_id,
//               time: new Date(),
//             },
//           ]);
//           console.log(`Received notification: ${data.message}`);
//         }
//       } catch (err) {
//         console.error("WebSocket message error:", err);
//       }
//     };

//     wsRef.current.onerror = (error) => {
//       console.error("WebSocket error:", error);
//       setError("WebSocket connection failed.");
//     };

//     wsRef.current.onclose = (event) => {
//       console.log(`WebSocket closed for user ${driverData.id}, code: ${event.code}`);
//     };

//     return () => {
//       if (wsRef.current) {
//         wsRef.current.close();
//       }
//     };
//   }, [driverData?.id]);

//   // Send notification
//   const sendNotification = async (userId, message, carpoolride_id = null) => {
//     try {
//       console.log(`Sending notification to user ${userId}: ${message}, ride: ${carpoolride_id}`);
//       await driverService.sendNotification({
//         user_id: userId,
//         message,
//         carpoolride_id,
//       });
//       setNotifications((prev) => [
//         ...prev,
//         { userId, message, carpoolride_id, time: new Date() },
//       ]);
//     } catch (err) {
//       console.error("Error sending notification:", err);
//       setError("Failed to send notification.");
//     }
//   };

//   // Check proximity to passengers and send notifications
//   const checkProximity = (latitude, longitude, rideId) => {
//     if (optimizedRoute?.passengers) {
//       const averageSpeed = 40 / 3.6; // 40 km/h in m/s
//       for (const passenger of optimizedRoute.passengers) {
//         const distance = calculateDistance(
//           latitude,
//           longitude,
//           passenger.pickup_lat,
//           passenger.pickup_lng
//         );
//         const eta = distance / averageSpeed; // ETA in seconds
//         if (distance < 500 || eta < 120) {
//           sendNotification(
//             passenger.user_id,
//             `Driver is approaching your pickup at ${passenger.label} (ETA: ${Math.round(eta / 60)} mins)`,
//             rideId
//           );
//           return true; // Indicate proximity for optimization
//         }
//       }
//     }
//     return false;
//   };

//   // Fetch initial driver data
//   useEffect(() => {
//     const fetchData = async () => {
//       setLoading(true);
//       setError(null);
//       try {
//         const [dashboardResponse, walletResponse, ridesResponse, rideRequestResponse] = await Promise.all([
//           driverService.getDashboard(),
//           driverService.getWalletBalance(),
//           driverService.getDriverRides(),
//           driverService.getRideRequests(),
//         ]);

//         setDriverData(dashboardResponse.data);
//         console.log("Driver data:", dashboardResponse.data);
//         setWalletBalance(walletResponse.data.balance || 0);
//         console.log("Wallet balance:", walletResponse.data.balance);
//         setRides(ridesResponse.data || []);
//         console.log("Rides:", ridesResponse.data);
//         setRideRequests(rideRequestResponse.data || []);
//         console.log("Ride requests:", rideRequestResponse.data);
//         setAvailability(dashboardResponse.data.is_available || false);
//         console.log("Availability:", dashboardResponse.data.is_available);
//       } catch (err) {
//         console.error("Error fetching driver data:", err);
//         setError("Failed to load driver dashboard. Please try again.");
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchData();
//   }, []);

//   // Memoize activeRide to prevent unnecessary useEffect triggers
//   const activeRide = useMemo(
//     () => rides.find((ride) => ride.status === "in_progress"),
//     [rides]
//   );

//   // Handle simulated location updates
//   const handleSimulatedLocationUpdate = (simulatedLocation) => {
//     if (
//       useSimulation &&
//       simulatedLocation &&
//       simulatedLocation.latitude &&
//       simulatedLocation.longitude
//     ) {
//       const newLocation = {
//         latitude: simulatedLocation.latitude,
//         longitude: simulatedLocation.longitude,
//       };
//       if (
//         lastValidLocation &&
//         Math.abs(lastValidLocation.latitude - newLocation.latitude) < 0.0001 &&
//         Math.abs(lastValidLocation.longitude - newLocation.longitude) < 0.0001
//       ) {
//         console.log("Skipping redundant simulation update:", newLocation);
//         return;
//       }
//       console.log("Processing simulated location:", newLocation);
//       setLocation(newLocation);
//       setLastValidLocation(newLocation);
//       if (activeRide) {
//         debouncedUpdateLocation(newLocation, activeRide.carpoolride_id); // Include rideId
//         const isNearPickup = checkProximity(
//           newLocation.latitude,
//           newLocation.longitude,
//           activeRide.carpoolride_id
//         );
//         if (isNearPickup) {
//           console.log("Triggering route optimization for simulated location:", newLocation);
//           debouncedOptimizeRoute(activeRide.carpoolride_id, newLocation);
//         }
//       } else {
//         console.warn("No active ride found, skipping location update to backend");
//       }
//     }
//   };

//   // Debounced optimizeRoute
//   const debouncedOptimizeRoute = useCallback(
//     debounce((rideId, currentLocation) => {
//       optimizeRoute(rideId, currentLocation);
//     }, 1000),
//     []
//   );

//   // Optimize route with retry mechanism
//   const optimizeRoute = async (rideId, currentLocation) => {
//     console.log("optimizeRoute called with:", { currentLocation, rideId });
//     if (!currentLocation.latitude || !currentLocation.longitude) {
//       console.error("Invalid currentLocation:", currentLocation);
//       setError("Cannot optimize route: missing latitude or longitude");
//       return;
//     }
//     setOptimizing(true);
//     try {
//       console.log("Sending optimize route request:", {
//         currentLocation,
//         ride_id: rideId,
//       });
//       const response = await driverService.optimizeRoute({
//         currentLocation,
//         ride_id: rideId,
//       });
//       console.log("Optimized route data:", response);
//       if (!response.route) {
//         throw new Error("No route data returned from optimization");
//       }
//       setOptimizedRoute(response);
//       retryCount.current = 0; // Reset retry count on success
//     } catch (err) {
//       console.error("Error optimizing route:", err);
//       setError(err.response?.data?.error || `Failed to optimize route: ${err.message}`);
//       if (retryCount.current < maxRetries) {
//         retryCount.current += 1;
//         console.log(`Retrying optimizeRoute (${retryCount.current}/${maxRetries})`);
//         setTimeout(() => {
//           optimizeRoute(rideId, currentLocation);
//         }, 2000);
//       } else {
//         console.error("Max retries reached for optimizeRoute");
//         setError("Unable to optimize route after multiple attempts.");
//       }
//     } finally {
//       setOptimizing(false);
//       console.log("Optimizing set to false");
//     }
//   };

//   // Handle active ride and location tracking
//   useEffect(() => {
//     if (!activeRide) {
//       // Initialize location to Nairobi default if no active ride
//       if (!location.latitude || !location.longitude) {
//         const defaultLocation = { latitude: -1.2921, longitude: 36.8219 };
//         setLocation(defaultLocation);
//         setLastValidLocation(defaultLocation);
//         // Only update backend if no active ride is needed
//         debouncedUpdateLocation(defaultLocation, null);
//       }
//       return;
//     }

//     // Check if already initialized for this ride
//     if (initializedRideId.current === activeRide.carpoolride_id) {
//       console.log("Skipping duplicate initialOptimize for ride:", activeRide.carpoolride_id);
//       return;
//     }

//     // Initialize location with ride origin
//     const origin = activeRide.origin || {
//       lat: -1.3434791,
//       lng: 36.7659754,
//       label: "Galleria Mall, Nairobi",
//     };
//     setLocation({ latitude: origin.lat, longitude: origin.lng });
//     setLastValidLocation({ latitude: origin.lat, longitude: origin.lng });
//     debouncedUpdateLocation({ latitude: origin.lat, longitude: origin.lng }, activeRide.carpoolride_id);

//     // Initial optimization with ride.origin
//     const initialOptimize = async () => {
//       setOptimizing(true);
//       try {
//         const response = await driverService.optimizeRoute({
//           currentLocation: { latitude: origin.lat, longitude: origin.lng },
//           ride_id: activeRide.carpoolride_id,
//         });
//         console.log("Initial optimizeRoute response:", response);
//         if (!response.route) {
//           throw new Error("No route data returned from initial optimization");
//         }
//         setOptimizedRoute(response);
//       } catch (error) {
//         console.error("Error optimizing route:", error);
//         setError("Failed to optimize route: " + error.message);
//       } finally {
//         setOptimizing(false);
//         console.log("Initial optimizing set to false");
//       }
//     };

//     initialOptimize();
//     initializedRideId.current = activeRide.carpoolride_id; // Mark as initialized

//     if (useSimulation) {
//       return;
//     }

//     // Real-time location tracking (non-simulation mode)
//     if (!navigator.geolocation) {
//       setError("Geolocation is not supported by your browser.");
//       return;
//     }

//     const watchId = navigator.geolocation.watchPosition(
//       (position) => {
//         const { latitude, longitude, accuracy } = position.coords;
//         console.log("Geolocation:", {
//           latitude,
//           longitude,
//           accuracy,
//           timestamp: position.timestamp,
//         });

//         if (
//           accuracy > 50 ||
//           typeof latitude !== "number" ||
//           isNaN(latitude) ||
//           typeof longitude !== "number" ||
//           isNaN(longitude)
//         ) {
//           console.warn("Invalid or low accuracy location:", {
//             latitude,
//             longitude,
//             accuracy,
//           });
//           setError(`Invalid or low accuracy on the location (accuracy: ${accuracy}m)`);
//           if (lastValidLocation) {
//             setLocation(lastValidLocation);
//           }
//           return;
//         }

//         const newLocation = { latitude, longitude };
//         setLocation(newLocation);
//         setLastValidLocation(newLocation);
//         debouncedUpdateLocation(newLocation, activeRide.carpoolride_id); // Include rideId
//         console.log("Updated location:", newLocation);

//         const isNearPickup = checkProximity(
//           latitude,
//           longitude,
//           activeRide.carpoolride_id
//         );
//         if (activeRide && isNearPickup) {
//           debouncedOptimizeRoute(activeRide.carpoolride_id, newLocation);
//         }
//       },
//       (err) => {
//         console.error("Geolocation error:", err);
//         setError("Unable to retrieve location: " + err.message);
//         if (lastValidLocation) {
//           setLocation(lastValidLocation);
//         }
//       },
//       { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
//     );

//     return () => {
//       navigator.geolocation.clearWatch(watchId);
//       initializedRideId.current = null; // Reset on cleanup
//     };
//   }, [activeRide, useSimulation]);

//   // Handle setting availability
//   const handleSetAvailability = async () => {
//     try {
//       const newAvailability = !availability;
//       await driverService.setAvailability({ is_available: newAvailability });
//       setAvailability(newAvailability);
//       alert(`Availability set to ${newAvailability ? "Available" : "Unavailable"}`);
//     } catch (error) {
//       console.error("Error setting availability:", error);
//       alert("Failed to set availability: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   // Handle creating a new ride
//   const handleCreateRide = async (e) => {
//     e.preventDefault();
//     const activeRides = rides.filter((ride) => ride.status === "pending" || ride.status === "in_progress");
//     if (activeRides.length > 0) {
//       alert("You already have an active ride. Please complete it before creating a new one.");
//       return;
//     }
//     try {
//       console.log("Sending rideForm data:", rideForm);
//       await driverService.createCarpoolRide(rideForm);
//       alert("Ride created successfully!");
//       setRideForm({
//         origin: "",
//         destination: "",
//         departure_time: "",
//         available_seats: "",
//         contribution_per_seat: "",
//         is_women_only: false,
//       });
//       const ridesResponse = await driverService.getDriverRides();
//       console.log("Create ride response:", ridesResponse);
//       setRides(ridesResponse.data || []);
//     } catch (error) {
//       console.error("Error creating ride:", error);
//       alert("Failed to create ride: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   // Handle selecting place for Autocomplete
//   const handlePlaceSelect = (field) => {
//     const autocomplete = field === "origin" ? originRef.current : destinationRef.current;
//     if (autocomplete) {
//       const place = autocomplete.getPlace();
//       if (place.geometry) {
//         const location = {
//           lat: place.geometry.location.lat(),
//           lng: place.geometry.location.lng(),
//           label: formatPlaceLabel(place),
//         };
//         setRideForm((prev) => ({ ...prev, [field]: location }));
//       }
//     }
//   };

//   // Handle starting a ride
//   const handleStartRide = async (rideId) => {
//     try {
//       await driverService.startRide(rideId);
//       setRides((prev) =>
//         prev.map((ride) =>
//           ride.carpoolride_id === rideId ? { ...ride, status: "in_progress" } : ride
//         )
//       );
//       if (location.latitude && location.longitude) {
//         optimizeRoute(rideId, location);
//       }
//       alert("Ride started! Passengers notified.");
//     } catch (error) {
//       console.error("Error starting ride:", error);
//       alert("Failed to start ride: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   // Handle completing a ride
//   const handleCompleteRide = async (rideId) => {
//     try {
//       await driverService.updateRide(rideId, { status: "completed" });
//       setRides((prev) =>
//         prev.map((ride) =>
//           ride.carpoolride_id === rideId ? { ...ride, status: "completed" } : ride
//         )
//       );
//       const rideRequestResponse = await driverService.getRideRequests();
//       setRideRequests(rideRequestResponse.data || []);
//       setOptimizedRoute(null);
//       alert("Ride completed! Passengers notified.");
//     } catch (error) {
//       console.error("Error completing ride:", error);
//       alert("Failed to complete ride: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   // Handle accepting a ride request
//   const handleAcceptRequest = async (ridrequest_id) => {
//     try {
//       await driverService.approveRideRequest(ridrequest_id);
//       setRideRequests((prev) =>
//         prev.map((req) =>
//           req.ridrequest_id === ridrequest_id ? { ...req, status: "accepted" } : req
//         )
//       );
//       const ridesResponse = await driverService.getDriverRides();
//       setRides(ridesResponse.data || []);
//     } catch (error) {
//       console.error("Error accepting request:", error);
//       alert("Failed to accept request: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   // Handle rejecting a ride request
//   const handleRejectRequest = async (ridrequest_id) => {
//     try {
//       await driverService.rejectRideRequest(ridrequest_id);
//       setRideRequests((prev) =>
//         prev.map((req) =>
//           req.ridrequest_id === ridrequest_id ? { ...req, status: "declined" } : req
//         )
//       );
//     } catch (error) {
//       console.error("Error rejecting request:", error);
//       alert("Failed to reject request: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   // Handle updating a ride
//   const handleUpdateRide = async (e) => {
//     e.preventDefault();
//     if (!selectedRideId) return alert("Please select a ride to update.");
//     try {
//       const localDateTime = new Date(departureTime);
//       const utcDateTime = new Date(localDateTime.getTime() - localDateTime.getTimezoneOffset() * 60000);
//       const updatedRide = { departure_time: utcDateTime.toISOString() };
//       await driverService.updateRide(selectedRideId, updatedRide);
//       alert("Ride updated successfully!");
//       setDepartureTime("");
//       setSelectedRideId(null);
//       const ridesResponse = await driverService.getDriverRides();
//       setRides(ridesResponse.data || []);
//     } catch (error) {
//       console.error("Error updating ride:", error);
//       alert("Failed to update ride: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   // Handle selecting a ride for editing
//   const handleSelectRide = (ride) => {
//     setSelectedRideId(ride.carpoolride_id);
//     setDepartureTime(ride.departure_time);
//   };

//   if (loading) return <div>Loading...</div>;
//   if (error) return <div>{error}</div>;
//   if (!driverData) return <div>No driver data available.</div>;

//   return (
//     <div className="driver-dashboard">
//       <h2 className="driver-title">Welcome, {driverData.full_name}</h2>
//       <p>Phone: {driverData.phone_number}</p>
//       <p>Verified: {driverData.is_verified ? "Yes" : "No"}</p>
//       <p>Wallet Balance: ${walletBalance}</p>
//       <p>Rating: {driverData.rating}</p>
//       <p>Availability: {availability ? "Available" : "Unavailable"}</p>
//       <p>Current Location: {location.latitude || "N/A"}, {location.longitude || "N/A"}</p>
//       <button onClick={handleSetAvailability} className="driver-form-button">
//         {availability ? "Set Unavailable" : "Set Available"}
//       </button>
//       <label>
//         <input
//           type="checkbox"
//           checked={useSimulation}
//           onChange={(e) => setUseSimulation(e.target.checked)}
//         />
//         Use Simulated Location
//       </label>

//       {notifications.length > 0 && (
//         <div className="notifications">
//           <h4>Notifications</h4>
//           {notifications.map((notif, index) => (
//             <p key={index}>
//               {notif.time.toLocaleTimeString()}: {notif.message}
//               {notif.carpoolride_id && ` (Ride ID: ${notif.carpoolride_id})`}
//             </p>
//           ))}
//         </div>
//       )}

//       {/* Always render MapComponent */}
//       <MapComponent
//         optimizedRoute={optimizedRoute}
//         onLocationUpdate={handleSimulatedLocationUpdate}
//         useSimulation={useSimulation}
//         currentLocation={location}
//       />

//       {/* Conditionally render route details */}
//       {optimizedRoute && optimizedRoute.route ? (
//         <div className="driver-ride-card">
//           <h3 className="driver-title">
//             Optimized Route to{" "}
//             {optimizedRoute.route.legs[optimizedRoute.route.legs.length - 1]?.end_address || "Unknown Destination"}
//           </h3>
//           {optimizing ? (
//             <p>Optimizing route...</p>
//           ) : (
//             <>
//               <p>Summary: {optimizedRoute.route.summary || "N/A"}</p>
//               <p>
//                 Total Distance:{" "}
//                 {(optimizedRoute.route.legs.reduce((acc, leg) => acc + leg.distance.value, 0) / 1000).toFixed(2)} km
//               </p>
//               <p>
//                 Total Duration:{" "}
//                 {(optimizedRoute.route.legs.reduce((acc, leg) => acc + leg.duration.value, 0) / 60).toFixed(0)} minutes
//               </p>

//               <h4>Route Legs:</h4>
//               {optimizedRoute.route.legs.length > 0 ? (
//                 optimizedRoute.route.legs.map((leg, index) => (
//                   <div key={index} className="mb-4">
//                     <p>
//                       <strong>Leg {index + 1}:</strong> From {leg.start_address} to {leg.end_address}
//                     </p>
//                     <p>Distance: {leg.distance.text}</p>
//                     <p>Duration: {leg.duration.text}</p>
//                   </div>
//                 ))
//               ) : (
//                 <p>No legs found for this route.</p>
//               )}

//               <h4>Passengers</h4>
//               {optimizedRoute.passengers && optimizedRoute.passengers.length > 0 ? (
//                 optimizedRoute.passengers.map((passenger, index) => (
//                   <p key={index}>
//                     {passenger.name}: {passenger.label} ({passenger.pickup_lat}, {passenger.pickup_lng})
//                   </p>
//                 ))
//               ) : (
//                 <p>No passengers assigned.</p>
//               )}
//             </>
//           )}
//         </div>
//       ) : (
//         <p>No optimized route available. {optimizedRoute && !optimizedRoute.route ? "Route optimization failed." : "Start a ride to view details."}</p>
//       )}

//       <h3 className="driver-title">Create a New Ride</h3>
//       {rides.some((r) => r.status === "pending" || r.status === "in_progress") ? (
//         <p>You must complete your current ride before creating a new one.</p>
//       ) : (
//         <form onSubmit={handleCreateRide} className="driver-form">
//           <Autocomplete
//             onLoad={(autocomplete) => {
//               originRef.current = autocomplete;
//               autocomplete.setComponentRestrictions({ country: "ke" });
//             }}
//             onPlaceChanged={() => handlePlaceSelect("origin")}
//           >
//             <input
//               type="text"
//               placeholder="Pickup Location"
//               value={rideForm.origin?.label || ""}
//               onChange={(e) =>
//                 setRideForm({ ...rideForm, origin: { label: e.target.value, lat: null, lng: null } })
//               }
//               className="driver-form-input"
//             />
//           </Autocomplete>
//           <Autocomplete
//             onLoad={(autocomplete) => {
//               destinationRef.current = autocomplete;
//               autocomplete.setComponentRestrictions({ country: "ke" });
//             }}
//             onPlaceChanged={() => handlePlaceSelect("destination")}
//           >
//             <input
//               type="text"
//               placeholder="Destination"
//               value={rideForm.destination?.label || ""}
//               onChange={(e) =>
//                 setRideForm({ ...rideForm, destination: { label: e.target.value, lat: null, lng: null } })
//               }
//               className="driver-form-input"
//             />
//           </Autocomplete>
//           <input
//             type="datetime-local"
//             value={rideForm.departure_time}
//             onChange={(e) => setRideForm({ ...rideForm, departure_time: e.target.value })}
//             className="driver-form-input"
//           />
//           <input
//             type="number"
//             placeholder="Available Seats"
//             value={rideForm.available_seats}
//             onChange={(e) => setRideForm({ ...rideForm, available_seats: e.target.value })}
//             className="driver-form-input"
//           />
//           <input
//             type="number"
//             placeholder="Contribution per Seat"
//             value={rideForm.contribution_per_seat}
//             onChange={(e) => setRideForm({ ...rideForm, contribution_per_seat: e.target.value })}
//             className="driver-form-input"
//           />
//           <label>
//             <input
//               type="checkbox"
//               checked={rideForm.is_women_only}
//               onChange={(e) => setRideForm({ ...rideForm, is_women_only: e.target.checked })}
//             />
//             Women-Only Ride
//           </label>
//           <button type="submit" className="driver-form-button">Create Ride</button>
//         </form>
//       )}

//       <h3 className="driver-title">Your Rides</h3>
//       {rides.length > 0 ? (
//         rides
//           .filter((ride) => ride.status === "pending" || ride.status === "in_progress")
//           .map((ride) => (
//             <div key={ride.carpoolride_id} className="driver-ride-card">
//               <p>Driver’s Start: {ride.origin?.label || "N/A"}</p>
//               <p>Driver’s End: {ride.destination?.label || "N/A"}</p>
//               <p>Departure (UTC): {new Date(ride.departure_time).toISOString().replace("T", " ").slice(0, -5)}</p>
//               <p>Seats: {ride.available_seats}</p>
//               <p>Status: {ride.status}</p>
//               {ride.requests && ride.requests.length > 0 ? (
//                 <>
//                   <p>Passenger Pickups:</p>
//                   <ul>
//                     {ride.requests
//                       .filter((req) => req.status === "accepted")
//                       .map((req) => (
//                         <li key={req.ridrequest_id}>
//                           {req.passenger_name || "Unknown"} from {req.pickup_location?.label || "N/A"}
//                           {req.dropoff_location && ` to ${req.dropoff_location.label}`}
//                         </li>
//                       ))}
//                   </ul>
//                 </>
//               ) : (
//                 <p>No accepted passenger requests.</p>
//               )}
//               {ride.status === "pending" && (
//                 <button
//                   onClick={() => handleStartRide(ride.carpoolride_id)}
//                   className="driver-form-button"
//                 >
//                   Start Ride
//                 </button>
//               )}
//               {ride.status === "in_progress" && (
//                 <button
//                   onClick={() => handleCompleteRide(ride.carpoolride_id)}
//                   className="driver-form-button"
//                 >
//                   Complete Ride
//                 </button>
//               )}
//               {ride.status === "pending" && (
//                 <button onClick={() => handleSelectRide(ride)} className="driver-form-button">
//                   Edit
//                 </button>
//               )}
//             </div>
//           ))
//       ) : (
//         <p>No rides created yet.</p>
//       )}

//       {selectedRideId && (
//         <>
//           <h3 className="driver-title">Edit Ride (ID: {selectedRideId})</h3>
//           <form onSubmit={handleUpdateRide} className="driver-form">
//             <input
//               type="datetime-local"
//               value={departureTime ? new Date(departureTime).toISOString().slice(0, 16) : ""}
//               onChange={(e) => setDepartureTime(e.target.value)}
//               className="driver-form-input"
//             />
//             <button type="submit" className="driver-form-button">Update Pickup Date</button>
//           </form>
//         </>
//       )}

//       <h3 className="driver-title">Ride Requests</h3>
//       {rideRequests.length > 0 ? (
//         rideRequests.map((req) => (
//           <div key={req.ridrequest_id} className="driver-request-card">
//             <p>Passenger: {req.passenger_name || "Unknown"}</p>
//             <p>Pick up point: {req.pickup_location?.label || "N/A"}</p>
//             <p>Drop off location: {req.dropoff_location?.label || "N/A"}</p>
//             <p>Seats Requested: {req.seats_requested || "N/A"}</p>
//             <p>Payment Status: {req.payment_status || "N/A"}</p>
//             <p>Status: {req.status}</p>
//             {req.status === "pending" && (
//               <>
//                 <button
//                   onClick={() => handleAcceptRequest(req.ridrequest_id)}
//                   className="driver-form-button"
//                 >
//                   Accept
//                 </button>
//                 <button
//                   onClick={() => handleRejectRequest(req.ridrequest_id)}
//                   className="driver-form-button"
//                 >
//                   Decline
//                 </button>
//               </>
//             )}
//           </div>
//         ))
//       ) : (
//         <p>No ride requests.</p>
//       )}
//     </div>
//   );
// }

// export default DriverDashboard;



// import { useEffect, useState, useRef, useCallback, useMemo } from "react";
// import { driverService } from "../services/api";
// import { Autocomplete } from "@react-google-maps/api";
// import MapComponent from "./MapComponent";
// import { formatPlaceLabel } from "../utils/placeUtils";

// // Debounce utility to limit frequent API calls
// const debounce = (func, wait) => {
//   let timeout;
//   return (...args) => {
//     clearTimeout(timeout);
//     timeout = setTimeout(() => func(...args), wait);
//   };
// };

// function DriverDashboard() {
//   const [driverData, setDriverData] = useState(null);
//   const [rideForm, setRideForm] = useState({
//     origin: "",
//     destination: "",
//     departure_time: "",
//     available_seats: "",
//     contribution_per_seat: "",
//     is_women_only: false,
//   });
//   const [rideRequests, setRideRequests] = useState([]);
//   const [idFront, setIdFront] = useState(null);
//   const [idBack, setIdBack] = useState(null);
//   const [smartDL, setSmartDL] = useState(null);
//   const [rides, setRides] = useState([]);
//   const [selectedRideId, setSelectedRideId] = useState(null);
//   const [departureTime, setDepartureTime] = useState("");
//   const [availability, setAvailability] = useState(false);
//   const [location, setLocation] = useState({ latitude: null, longitude: null });
//   const [lastValidLocation, setLastValidLocation] = useState(null);
//   const [walletBalance, setWalletBalance] = useState(0);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [optimizedRoute, setOptimizedRoute] = useState(null);
//   const [optimizing, setOptimizing] = useState(false);
//   const [notifications, setNotifications] = useState([]);
//   const [useSimulation, setUseSimulation] = useState(true);
//   const initializedRideId = useRef(null);
//   const originRef = useRef(null);
//   const destinationRef = useRef(null);
//   const wsRef = useRef(null);

//   // Calculate distance (Haversine formula)
//   const calculateDistance = (lat1, lon1, lat2, lon2) => {
//     const R = 6371e3; // Earth's radius in meters
//     const φ1 = (lat1 * Math.PI) / 180;
//     const φ2 = (lat2 * Math.PI) / 180;
//     const Δφ = ((lat2 - lat1) * Math.PI) / 180;
//     const Δλ = ((lon2 - lon1) * Math.PI) / 180;

//     const a =
//       Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
//       Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
//     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//     return R * c; // Distance in meters
//   };

//   // Initialize WebSocket connection for driver notifications
//   useEffect(() => {
//     if (!driverData?.id) return;

//     const token = localStorage.getItem("jwt_token"); // Assume JWT token is stored
//     if (!token) {
//       console.error("No JWT token found for WebSocket connection");
//       return;
//     }

//     const wsUrl = `ws://127.0.0.1:8000/ws/notifications/user_${driverData.id}/?token=${token}`;
//     wsRef.current = new WebSocket(wsUrl);

//     wsRef.current.onopen = () => {
//       console.log(`WebSocket connected for user ${driverData.id}`);
//     };

//     wsRef.current.onmessage = (event) => {
//       const data = JSON.parse(event.data);
//       if (data.type === "send_notification") {
//         setNotifications((prev) => [
//           ...prev,
//           {
//             message: data.message,
//             carpoolride_id: data.carpoolride_id,
//             time: new Date(),
//           },
//         ]);
//         console.log(`Received notification: ${data.message}`);
//       }
//     };

//     wsRef.current.onerror = (error) => {
//       console.error("WebSocket error:", error);
//     };

//     wsRef.current.onclose = (event) => {
//       console.log(`WebSocket closed for user ${driverData.id}, code: ${event.code}`);
//     };

//     return () => {
//       if (wsRef.current) {
//         wsRef.current.close();
//       }
//     };
//   }, [driverData?.id]);

//   // Send notification
//   const sendNotification = async (userId, message, carpoolride_id = null) => {
//     try {
//       console.log(`Sending notification to user ${userId}: ${message}, ride: ${carpoolride_id}`);
//       await driverService.sendNotification({
//         user_id: userId,
//         message,
//         carpoolride_id,
//       });

//       if (userId === currentUserId) {
//         setNotifications((prev) => [
//           ...prev,
//           { userId, message, carpoolride_id, time: new Date() },
//         ]);
//       }
//     } catch (err) {
//       console.error("Error sending notification:", err);
//     }
//   };

//   //     setNotifications((prev) => [
//   //       ...prev,
//   //       { userId, message, carpoolride_id, time: new Date() },
//   //     ]);
//   //   } catch (err) {
//   //     console.error("Error sending notification:", err);
//   //   }
//   // };

//   // Check proximity to passengers and send notifications
//   const checkProximity = (latitude, longitude, rideId) => {
//     if (optimizedRoute?.passengers) {
//       const averageSpeed = 40 / 3.6; // 40 km/h in m/s
//       for (const passenger of optimizedRoute.passengers) {
//         const distance = calculateDistance(
//           latitude,
//           longitude,
//           passenger.pickup_lat,
//           passenger.pickup_lng
//         );
//         const eta = distance / averageSpeed; // ETA in seconds
//         if (distance < 500 || eta < 120) {
//           sendNotification(
//             passenger.user_id,
//             `Driver is approaching your pickup at ${passenger.label} (ETA: ${Math.round(eta / 60)} mins)`,
//             rideId
//           );
//           return true; // Indicate proximity for optimization
//         }
//       }
//     }
//     return false;
//   };

//   // Fetch initial driver data
//   useEffect(() => {
//     const fetchData = async () => {
//       setLoading(true);
//       setError(null);
//       try {
//         const [dashboardResponse, walletResponse, ridesResponse, rideRequestResponse] = await Promise.all([
//           driverService.getDashboard(),
//           driverService.getWalletBalance(),
//           driverService.getDriverRides(),
//           driverService.getRideRequests(),
//         ]);

//         setDriverData(dashboardResponse.data);
//         console.log("Driver data:", dashboardResponse.data);
//         setWalletBalance(walletResponse.data.balance || 0);
//         console.log("Wallet balance:", walletResponse.data.balance);
//         setRides(ridesResponse.data || []);
//         console.log("Rides:", ridesResponse.data);
//         setRideRequests(rideRequestResponse.data || []);
//         console.log("Ride requests:", rideRequestResponse.data);
//         setAvailability(dashboardResponse.data.is_available || false);
//         console.log("Availability:", dashboardResponse.data.is_available);
//       } catch (err) {
//         console.error("Error fetching driver data:", err);
//         setError("Failed to load driver dashboard. Please try again.");
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchData();
//   }, []);

//   // Memoize activeRide to prevent unnecessary useEffect triggers
//   const activeRide = useMemo(
//     () => rides.find((ride) => ride.status === "in_progress"),
//     [rides]
//   );

//   // Handle simulated location updates
//   const handleSimulatedLocationUpdate = (simulatedLocation) => {
//     if (
//       useSimulation &&
//       simulatedLocation &&
//       simulatedLocation.latitude &&
//       simulatedLocation.longitude
//     ) {
//       const newLocation = {
//         latitude: simulatedLocation.latitude,
//         longitude: simulatedLocation.longitude,
//       };
//       if (
//         lastValidLocation &&
//         Math.abs(lastValidLocation.latitude - newLocation.latitude) < 0.0001 &&
//         Math.abs(lastValidLocation.longitude - newLocation.longitude) < 0.0001
//       ) {
//         console.log("Skipping redundant simulation update:", newLocation);
//         return;
//       }
//       console.log("Processing simulated location:", newLocation);
//       setLocation(newLocation);
//       setLastValidLocation(newLocation);
//       const isNearPickup = checkProximity(
//         newLocation.latitude,
//         newLocation.longitude,
//         activeRide?.carpoolride_id
//       );
//       if (activeRide && isNearPickup) {
//         console.log("Triggering route optimization for simulated location:", newLocation);
//         debouncedOptimizeRoute(activeRide.carpoolride_id, newLocation);
//       }
//     }
//   };

//   // Debounced optimizeRoute
//   const debouncedOptimizeRoute = useCallback(
//     debounce((rideId, currentLocation) => {
//       optimizeRoute(rideId, currentLocation);
//     }, 1000),
//     []
//   );

//   // Optimize route
//   const optimizeRoute = async (rideId, currentLocation) => {
//     console.log("optimizeRoute called with:", { currentLocation, rideId });
//     if (!currentLocation.latitude || !currentLocation.longitude) {
//       console.error("Invalid currentLocation:", currentLocation);
//       setError("Cannot optimize route: missing latitude or longitude");
//       return;
//     }
//     setOptimizing(true);
//     try {
//       console.log("Sending optimize route request:", {
//         currentLocation,
//         ride_id: rideId,
//       });
//       const response = await driverService.optimizeRoute({
//         currentLocation,
//         ride_id: rideId,
//       });
//       console.log("Optimized route data:", response);
//       setOptimizedRoute(response);
//     } catch (err) {
//       console.error("Error optimizing route:", err);
//       setError(err.response?.data?.error || "Failed to optimize route.");
//     } finally {
//       setOptimizing(false);
//       console.log("Optimizing set to false");
//     }
//   };

//   // Handle active ride and location tracking
//   useEffect(() => {
//     if (!activeRide) {
//       // Initialize location to Nairobi default if no active ride
//       if (!location.latitude || !location.longitude) {
//         setLocation({ latitude: -1.2921, longitude: 36.8219 });
//         setLastValidLocation({ latitude: -1.2921, longitude: 36.8219 });
//       }
//       return;
//     }

//     // Check if already initialized for this ride
//     if (initializedRideId.current === activeRide.carpoolride_id) {
//       console.log("Skipping duplicate initialOptimize for ride:", activeRide.carpoolride_id);
//       return;
//     }

//     // Initialize location with ride origin
//     const origin = activeRide.origin || {
//       lat: -1.3434791,
//       lng: 36.7659754,
//       label: "Galleria Mall, Nairobi",
//     };
//     setLocation({ latitude: origin.lat, longitude: origin.lng });
//     setLastValidLocation({ latitude: origin.lat, longitude: origin.lng });

//     // Initial optimization with ride.origin
//     const initialOptimize = async () => {
//       setOptimizing(true);
//       try {
//         const response = await driverService.optimizeRoute({
//           currentLocation: { latitude: origin.lat, longitude: origin.lng },
//           ride_id: activeRide.carpoolride_id,
//         });
//         console.log("Initial optimizeRoute response:", response);
//         setOptimizedRoute(response);
//       } catch (error) {
//         console.error("Error optimizing route:", error);
//         setError("Failed to optimize route: " + error.message);
//       } finally {
//         setOptimizing(false);
//         console.log("Initial optimizing set to false");
//       }
//     };

//     initialOptimize();
//     initializedRideId.current = activeRide.carpoolride_id; // Mark as initialized

//     if (useSimulation) {
//       return;
//     }

//     // Real-time location tracking (non-simulation mode)
//     if (!navigator.geolocation) {
//       setError("Geolocation is not supported by your browser.");
//       return;
//     }

//     const watchId = navigator.geolocation.watchPosition(
//       (position) => {
//         const { latitude, longitude, accuracy } = position.coords;
//         console.log("Geolocation:", {
//           latitude,
//           longitude,
//           accuracy,
//           timestamp: position.timestamp,
//         });

//         if (
//           accuracy > 50 ||
//           typeof latitude !== "number" ||
//           isNaN(latitude) ||
//           typeof longitude !== "number" ||
//           isNaN(longitude)
//         ) {
//           console.warn("Invalid or low accuracy location:", {
//             latitude,
//             longitude,
//             accuracy,
//           });
//           setError(`Invalid or low accuracy on the location (accuracy: ${accuracy}m)`);
//           if (lastValidLocation) {
//             setLocation(lastValidLocation);
//           }
//           return;
//         }

//         const newLocation = { latitude, longitude };
//         setLocation(newLocation);
//         setLastValidLocation(newLocation);
//         console.log("Updated location:", newLocation);

//         const isNearPickup = checkProximity(
//           latitude,
//           longitude,
//           activeRide.carpoolride_id
//         );
//         if (activeRide && isNearPickup) {
//           debouncedOptimizeRoute(activeRide.carpoolride_id, newLocation);
//         }
//       },
//       (err) => {
//         console.error("Geolocation error:", err);
//         setError("Unable to retrieve location: " + err.message);
//         if (lastValidLocation) {
//           setLocation(lastValidLocation);
//         }
//       },
//       { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
//     );

//     return () => {
//       navigator.geolocation.clearWatch(watchId);
//       initializedRideId.current = null; // Reset on cleanup
//     };
//   }, [activeRide, useSimulation]);

//   // Handle setting availability
//   const handleSetAvailability = async () => {
//     try {
//       const newAvailability = !availability;
//       await driverService.setAvailability({ is_available: newAvailability });
//       setAvailability(newAvailability);
//       alert(`Availability set to ${newAvailability ? "Available" : "Unavailable"}`);
//     } catch (error) {
//       console.error("Error setting availability:", error);
//       alert("Failed to set availability: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   // Handle creating a new ride
//   const handleCreateRide = async (e) => {
//     e.preventDefault();
//     const activeRides = rides.filter((ride) => ride.status === "pending" || ride.status === "in_progress");
//     if (activeRides.length > 0) {
//       alert("You already have an active ride. Please complete it before creating a new one.");
//       return;
//     }
//     try {
//       console.log("Sending rideForm data:", rideForm);
//       await driverService.createCarpoolRide(rideForm);
//       alert("Ride created successfully!");
//       setRideForm({
//         origin: "",
//         destination: "",
//         departure_time: "",
//         available_seats: "",
//         contribution_per_seat: "",
//         is_women_only: false,
//       });
//       const ridesResponse = await driverService.getDriverRides();
//       console.log("Create ride response:", ridesResponse);
//       setRides(ridesResponse.data || []);
//     } catch (error) {
//       console.error("Error creating ride:", error);
//       alert("Failed to create ride: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   // Handle selecting place for Autocomplete
//   const handlePlaceSelect = (field) => {
//     const autocomplete = field === "origin" ? originRef.current : destinationRef.current;
//     if (autocomplete) {
//       const place = autocomplete.getPlace();
//       if (place.geometry) {
//         const location = {
//           lat: place.geometry.location.lat(),
//           lng: place.geometry.location.lng(),
//           label: formatPlaceLabel(place),
//         };
//         setRideForm((prev) => ({ ...prev, [field]: location }));
//       }
//     }
//   };

//   // Handle starting a ride
//   const handleStartRide = async (rideId) => {
//     try {
//       await driverService.startRide(rideId);
//       setRides((prev) =>
//         prev.map((ride) =>
//           ride.carpoolride_id === rideId ? { ...ride, status: "in_progress" } : ride
//         )
//       );
//       if (location.latitude && location.longitude) {
//         optimizeRoute(rideId, location);
//       }
//       alert("Ride started! Passengers notified.");
//     } catch (error) {
//       console.error("Error starting ride:", error);
//       alert("Failed to start ride: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   // Handle completing a ride
//   const handleCompleteRide = async (rideId) => {
//     try {
//       await driverService.updateRide(rideId, { status: "completed" });
//       setRides((prev) =>
//         prev.map((ride) =>
//           ride.carpoolride_id === rideId ? { ...ride, status: "completed" } : ride
//         )
//       );
//       const rideRequestResponse = await driverService.getRideRequests();
//       setRideRequests(rideRequestResponse.data || []);
//       setOptimizedRoute(null);
//       alert("Ride completed! Passengers notified.");
//     } catch (error) {
//       console.error("Error completing ride:", error);
//       alert("Failed to complete ride: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   // Handle accepting a ride request
//   const handleAcceptRequest = async (ridrequest_id) => {
//     try {
//       await driverService.approveRideRequest(ridrequest_id);
//       setRideRequests((prev) =>
//         prev.map((req) =>
//           req.ridrequest_id === ridrequest_id ? { ...req, status: "accepted" } : req
//         )
//       );
//       const ridesResponse = await driverService.getDriverRides();
//       setRides(ridesResponse.data || []);
//     } catch (error) {
//       console.error("Error accepting request:", error);
//       alert("Failed to accept request: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   // Handle rejecting a ride request
//   const handleRejectRequest = async (ridrequest_id) => {
//     try {
//       await driverService.rejectRideRequest(ridrequest_id);
//       setRideRequests((prev) =>
//         prev.map((req) =>
//           req.ridrequest_id === ridrequest_id ? { ...req, status: "declined" } : req
//         )
//       );
//     } catch (error) {
//       console.error("Error rejecting request:", error);
//       alert("Failed to reject request: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   // Handle updating a ride
//   const handleUpdateRide = async (e) => {
//     e.preventDefault();
//     if (!selectedRideId) return alert("Please select a ride to update.");
//     try {
//       const localDateTime = new Date(departureTime);
//       const utcDateTime = new Date(localDateTime.getTime() - localDateTime.getTimezoneOffset() * 60000);
//       const updatedRide = { departure_time: utcDateTime.toISOString() };
//       await driverService.updateRide(selectedRideId, updatedRide);
//       alert("Ride updated successfully!");
//       setDepartureTime("");
//       setSelectedRideId(null);
//       const ridesResponse = await driverService.getDriverRides();
//       setRides(ridesResponse.data || []);
//     } catch (error) {
//       console.error("Error updating ride:", error);
//       alert("Failed to update ride: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   // Handle selecting a ride for editing
//   const handleSelectRide = (ride) => {
//     setSelectedRideId(ride.carpoolride_id);
//     setDepartureTime(ride.departure_time);
//   };

//   if (loading) return <div>Loading...</div>;
//   if (error) return <div>{error}</div>;
//   if (!driverData) return <div>No driver data available.</div>;

//   return (
//     <div className="driver-dashboard">
//       <h2 className="driver-title">Welcome, {driverData.full_name}</h2>
//       <p>Phone: {driverData.phone_number}</p>
//       <p>Verified: {driverData.is_verified ? "Yes" : "No"}</p>
//       <p>Wallet Balance: ${walletBalance}</p>
//       <p>Rating: {driverData.rating}</p>
//       <p>Availability: {availability ? "Available" : "Unavailable"}</p>
//       <p>Current Location: {location.latitude || "N/A"}, {location.longitude || "N/A"}</p>
//       <button onClick={handleSetAvailability} className="driver-form-button">
//         {availability ? "Set Unavailable" : "Set Available"}
//       </button>
//       <label>
//         <input
//           type="checkbox"
//           checked={useSimulation}
//           onChange={(e) => setUseSimulation(e.target.checked)}
//         />
//         Use Simulated Location
//       </label>

//       {notifications.length > 0 && (
//         <div className="notifications">
//           <h4>Notifications</h4>
//           {notifications.map((notif, index) => (
//             <p key={index}>
//               {notif.time.toLocaleTimeString()}: {notif.message}
//               {notif.carpoolride_id && ` (Ride ID: ${notif.carpoolride_id})`}
//             </p>
//           ))}
//         </div>
//       )}

//       {/* Always render MapComponent */}
//       <MapComponent
//         optimizedRoute={optimizedRoute}
//         onLocationUpdate={handleSimulatedLocationUpdate}
//         useSimulation={useSimulation}
//         currentLocation={location}
//       />

//       {/* Conditionally render route details */}
//       {optimizedRoute && optimizedRoute.route ? (
//         <div className="driver-ride-card">
//           <h3 className="driver-title">
//             Optimized Route to{" "}
//             {optimizedRoute.route.legs[optimizedRoute.route.legs.length - 1]?.end_address || "Unknown Destination"}
//           </h3>
//           {optimizing ? (
//             <p>Optimizing route...</p>
//           ) : (
//             <>
//               <p>Summary: {optimizedRoute.route.summary || "N/A"}</p>
//               <p>
//                 Total Distance:{" "}
//                 {(optimizedRoute.route.legs.reduce((acc, leg) => acc + leg.distance.value, 0) / 1000).toFixed(2)} km
//               </p>
//               <p>
//                 Total Duration:{" "}
//                 {(optimizedRoute.route.legs.reduce((acc, leg) => acc + leg.duration.value, 0) / 60).toFixed(0)} minutes
//               </p>

//               <h4>Route Legs:</h4>
//               {optimizedRoute.route.legs.length > 0 ? (
//                 optimizedRoute.route.legs.map((leg, index) => (
//                   <div key={index} className="mb-4">
//                     <p>
//                       <strong>Leg {index + 1}:</strong> From {leg.start_address} to {leg.end_address}
//                     </p>
//                     <p>Distance: {leg.distance.text}</p>
//                     <p>Duration: {leg.duration.text}</p>
//                   </div>
//                 ))
//               ) : (
//                 <p>No legs found for this route.</p>
//               )}

//               <h4>Passengers</h4>
//               {optimizedRoute.passengers && optimizedRoute.passengers.length > 0 ? (
//                 optimizedRoute.passengers.map((passenger, index) => (
//                   <p key={index}>
//                     {passenger.name}: {passenger.label} ({passenger.pickup_lat}, {passenger.pickup_lng})
//                   </p>
//                 ))
//               ) : (
//                 <p>No passengers assigned.</p>
//               )}
//             </>
//           )}
//         </div>
//       ) : (
//         <p>No optimized route available. Start a ride to view details.</p>
//       )}

//       <h3 className="driver-title">Create a New Ride</h3>
//       {rides.some((r) => r.status === "pending" || r.status === "in_progress") ? (
//         <p>You must complete your current ride before creating a new one.</p>
//       ) : (
//         <form onSubmit={handleCreateRide} className="driver-form">
//           <Autocomplete
//             onLoad={(autocomplete) => {
//               originRef.current = autocomplete;
//               autocomplete.setComponentRestrictions({ country: "ke" });
//             }}
//             onPlaceChanged={() => handlePlaceSelect("origin")}
//           >
//             <input
//               type="text"
//               placeholder="Pickup Location"
//               value={rideForm.origin?.label || ""}
//               onChange={(e) =>
//                 setRideForm({ ...rideForm, origin: { label: e.target.value, lat: null, lng: null } })
//               }
//               className="driver-form-input"
//             />
//           </Autocomplete>
//           <Autocomplete
//             onLoad={(autocomplete) => {
//               destinationRef.current = autocomplete;
//               autocomplete.setComponentRestrictions({ country: "ke" });
//             }}
//             onPlaceChanged={() => handlePlaceSelect("destination")}
//           >
//             <input
//               type="text"
//               placeholder="Destination"
//               value={rideForm.destination?.label || ""}
//               onChange={(e) =>
//                 setRideForm({ ...rideForm, destination: { label: e.target.value, lat: null, lng: null } })
//               }
//               className="driver-form-input"
//             />
//           </Autocomplete>
//           <input
//             type="datetime-local"
//             value={rideForm.departure_time}
//             onChange={(e) => setRideForm({ ...rideForm, departure_time: e.target.value })}
//             className="driver-form-input"
//           />
//           <input
//             type="number"
//             placeholder="Available Seats"
//             value={rideForm.available_seats}
//             onChange={(e) => setRideForm({ ...rideForm, available_seats: e.target.value })}
//             className="driver-form-input"
//           />
//           <input
//             type="number"
//             placeholder="Contribution per Seat"
//             value={rideForm.contribution_per_seat}
//             onChange={(e) => setRideForm({ ...rideForm, contribution_per_seat: e.target.value })}
//             className="driver-form-input"
//           />
//           <label>
//             <input
//               type="checkbox"
//               checked={rideForm.is_women_only}
//               onChange={(e) => setRideForm({ ...rideForm, is_women_only: e.target.checked })}
//             />
//             Women-Only Ride
//           </label>
//           <button type="submit" className="driver-form-button">Create Ride</button>
//         </form>
//       )}

//       <h3 className="driver-title">Your Rides</h3>
//       {rides.length > 0 ? (
//         rides
//           .filter((ride) => ride.status === "pending" || ride.status === "in_progress")
//           .map((ride) => (
//             <div key={ride.carpoolride_id} className="driver-ride-card">
//               <p>Driver’s Start: {ride.origin.label}</p>
//               <p>Driver’s End: {ride.destination.label}</p>
//               <p>Departure (UTC): {new Date(ride.departure_time).toISOString().replace("T", " ").slice(0, -5)}</p>
//               <p>Seats: {ride.available_seats}</p>
//               <p>Status: {ride.status}</p>
//               {ride.requests && ride.requests.length > 0 && (
//                 <>
//                   <p>Passenger Pickups:</p>
//                   <ul>
//                     {ride.requests
//                       .filter((req) => req.status === "accepted")
//                       .map((req) => (
//                         <li key={req.ridrequest_id}>
//                           {req.passenger_name} from {req.pickup_location.label}
//                           {req.dropoff_location && ` to ${req.dropoff_location.label}`}
//                         </li>
//                       ))}
//                   </ul>
//                 </>
//               )}
//               {ride.status === "pending" && (
//                 <button
//                   onClick={() => handleStartRide(ride.carpoolride_id)}
//                   className="driver-form-button"
//                 >
//                   Start Ride
//                 </button>
//               )}
//               {ride.status === "in_progress" && (
//                 <button
//                   onClick={() => handleCompleteRide(ride.carpoolride_id)}
//                   className="driver-form-button"
//                 >
//                   Complete Ride
//                 </button>
//               )}
//               {ride.status === "pending" && (
//                 <button onClick={() => handleSelectRide(ride)} className="driver-form-button">
//                   Edit
//                 </button>
//               )}
//             </div>
//           ))
//       ) : (
//         <p>No rides created yet.</p>
//       )}

//       {selectedRideId && (
//         <>
//           <h3 className="driver-title">Edit Ride (ID: {selectedRideId})</h3>
//           <form onSubmit={handleUpdateRide} className="driver-form">
//             <input
//               type="datetime-local"
//               value={departureTime ? new Date(departureTime).toISOString().slice(0, 16) : ""}
//               onChange={(e) => setDepartureTime(e.target.value)}
//               className="driver-form-input"
//             />
//             <button type="submit" className="driver-form-button">Update Pickup Date</button>
//           </form>
//         </>
//       )}

//       <h3 className="driver-title">Ride Requests</h3>
//       {rideRequests.length > 0 ? (
//         rideRequests.map((req) => (
//           <div key={req.ridrequest_id} className="driver-request-card">
//             <p>Passenger: {req.passenger_name}</p>
//             <p>Pick up point: {req.pickup_location.label}</p>
//             <p>Drop off location: {req.dropoff_location?.label || "N/A"}</p>
//             <p>Seats Requested: {req.seats_requested}</p>
//             <p>Payment Status: {req.payment_status}</p>
//             <p>Status: {req.status}</p>
//             {req.status === "pending" && (
//               <>
//                 <button
//                   onClick={() => handleAcceptRequest(req.ridrequest_id)}
//                   className="driver-form-button"
//                 >
//                   Accept
//                 </button>
//                 <button
//                   onClick={() => handleRejectRequest(req.ridrequest_id)}
//                   className="driver-form-button"
//                 >
//                   Decline
//                 </button>
//               </>
//             )}
//           </div>
//         ))
//       ) : (
//         <p>No ride requests.</p>
//       )}
//     </div>
//   );
// }

// export default DriverDashboard;
