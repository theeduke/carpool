import React, { useEffect, useState, useContext, useRef } from 'react';
import { passengerService, notificationService } from '../services/api';
import MapComponent from './MapComponent';
import { AuthContext } from '../context/AuthContext';
import "../styles/passengerdashboard.css";

const PassengerDashboard = () => {
  const { user } = useContext(AuthContext);
  const [upcomingRides, setUpcomingRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [driverLocation, setDriverLocation] = useState({}); // Store live driver location by ride ID
  const [notifications, setNotifications] = useState([]);
  const [dismissedNotifications, setDismissedNotifications] = useState(new Set());
  const wsRef = useRef(null); // WebSocket reference
  const isDismissing = useRef(new Set()); //to track dismissed notification_ids and filter them out in websocket handler

  // Protect the component: Redirect or show message if user is not logged in
  if (!user) {
    return <div>Please log in to view your dashboard.</div>;
  }

  // // Initialize WebSocket for notifications
  useEffect(() => {
    if (!user?.id) return;

    const token = localStorage.getItem("access_token");
    if (!token) {
        console.error("No JWT token found for WebSocket connection");
        setError("Authentication error: Please log in again.");
        return;
    }

    const backendWsUrl = import.meta.env.VITE_BACKEND_WSREQUEST_URL || "ws://127.0.0.1:8001";
    const wsUrl = `${backendWsUrl}/ws/notifications/user_${user.id}/?token=${token}`;
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
            console.log(`WebSocket connected for user ${user.id}`);
            reconnectAttempts = 0;
        };

        wsRef.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("WebSocket message received:", data);

                if (data.type === "send_notification" && data.user_id === user.id) {
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
                } else if (data.type === "notification_dismissed" && data.user_id === user.id) {
                    setDismissedNotifications((prev) => new Set(prev).add(data.notification_id));
                    setNotifications((prev) => {
                        console.log("Before filter (WebSocket dismiss):", prev);
                        const updated = prev.filter((n) => n.notification_id !== data.notification_id);
                        console.log("After filter (WebSocket dismiss):", updated);
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
}, [user?.id, dismissedNotifications]);


  // Fetch dashboard data on mount
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const response = await passengerService.getDashboard();
        console.log('Dashboard response:', response.data);
        setUpcomingRides(response.data.upcoming_rides);
        setLoading(false);
      } catch (err) {
        setError('Failed to load dashboard data');
        setLoading(false);
        console.error('Dashboard fetch error:', err);
      }
    };
    fetchDashboard();
  }, []);

  // Fetch driver live location for each in_progress ride
  useEffect(() => {
    upcomingRides.forEach((ride) => {
      if (ride.status === 'in_progress') {
        const fetchDriverLocation = async () => {
          try {
            const response = await passengerService.getDriverLiveLocation(ride.carpoolride_id);
            console.log('Driver location response:', response.data);
            setDriverLocation((prev) => ({
              ...prev,
              [ride.carpoolride_id]: {
                latitude: Number(response.data.latitude),
                longitude: Number(response.data.longitude),
                user_id: response.data.user_id,
                name: response.data.name,
                updated_at: response.data.updated_at,
              },
            }));
          } catch (err) {
            console.warn(`Failed to fetch driver location for ride ${ride.carpoolride_id}:`, err);
            setDriverLocation((prev) => ({
              ...prev,
              [ride.carpoolride_id]: null,
            }));
          }
        };

        // Initial fetch
        fetchDriverLocation();

        // Poll every 5 seconds for live updates
        const interval = setInterval(fetchDriverLocation, 5000);

        return () => clearInterval(interval);
      }
    });
  }, [upcomingRides]);

  // Handle ride cancellation


const handleCancelRide = async (rideId) => {
  try {
    const response = await passengerService.cancelRide(rideId);
    const { message, refund_amount, reference } = response.data;
    alert(`${message} Refund: KES ${parseFloat(refund_amount).toFixed(2)}${reference ? ` (Ref: ${reference})` : ''}`);
    // Refresh dashboard
    const dashboardResponse = await passengerService.getDashboard();
    setUpcomingRides(dashboardResponse.data.upcoming_rides || []);
  } catch (err) {
    console.error('Cancel ride error:', err);
    let errorMessage = 'Failed to cancel ride.';
    if (err.response?.status === 400) {
      errorMessage = err.response.data.error || 'Ride cannot be canceled.';
    } else if (err.response?.status === 404) {
      errorMessage = err.response.data.error || 'Ride request not found.';
    } else if (err.response?.status === 500) {
      errorMessage = err.response.data.error || 'Server error during refund.';
    } else {
      errorMessage = err.message || 'An unexpected error occurred.';
    }
    alert(errorMessage);
  }
};


//   // Handle notification dismissal


const handleDismiss = async (notif) => {
    if (isDismissing.current.has(notif.notification_id)) {
        // console.log(`Dismiss already in progress for ${notif.notification_id}`);
        return;
    }
    isDismissing.current.add(notif.notification_id);
    // console.log("Dismiss notif:", notif);
    try {
        const response = await notificationService.dismissNotification(notif.notification_id);
        // console.log("Dismiss response:", response);
        if (response.status === 200) {
            setDismissedNotifications((prev) => new Set(prev).add(notif.notification_id));
            setNotifications((prev) => {
                // console.log("Before filter:", prev);
                const updated = prev.filter((n) => n.notification_id !== notif.notification_id);
                // console.log("After filter:", updated);
                return updated;
            });
            console.log("Notification removed from UI");
            // Optional: Log or show different feedback based on message
            if (response.data && response.data.message === "Notification already dismissed") {
                console.log("Notification was already dismissed, no further action needed");
            }
        } else {
            // console.error("Unexpected dismiss response:", response);
            // use toast
            alert("Failed to dismiss notification: Unexpected response from server (status: " + response.status + ")");
        }
    } catch (error) {
        console.error("Failed to dismiss notification:", error);
        setDismissedNotifications((prev) => new Set(prev).add(notif.notification_id));
        setNotifications((prev) => {
            const updated = prev.filter((n) => n.notification_id !== notif.notification_id);
            return updated;
        });
        //  use toast
        alert("Removed notification locally due to server error: " + (error.message || "Unknown error"));
    } finally {
        isDismissing.current.delete(notif.notification_id);
    }
};

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="passenger-dashboard">
      {/* <h2>Passenger Dashboard</h2> */}

      <section>
        {notifications.length > 0 && (
          <div className="notifications">
            <h4>Notifications <span className="badge">{notifications.filter(n => n.is_new).length} new</span></h4>
              <div className="notification-list">
                  {console.log("Notifications state:", notifications)}
                  {notifications.map((notif) => (
                      <div
                          key={notif.notification_id} // Safe after fixing duplicates
                          className={`notification-item ${notif.is_new ? 'new' : ''}`}
                      >
                          <span className="icon">{notif.type === 'cancellation' ? '🚫' : '📩'}</span>
                          <div className="content">
                              {/* <p>{notif.message} {notif.carpoolride_id && `(Ride ID: ${notif.carpoolride_id})`}</p> */}
                              <small>{new Date(notif.time).toLocaleTimeString()}</small>
                              {/* <small>Notification ID: {notif.notification_id || 'Missing'}</small> */}
                          </div>
                          <button onClick={() => handleDismiss(notif)}>Dismiss</button>
                      </div>
                  ))}
                </div>
                </div>
            )}

        <h3>Upcoming Rides</h3>
        {upcomingRides.length === 0 ? (
          <div className="conditional-message">
          <p>No upcoming rides. Kindly navigate to search rides to find your suitable ride.</p>
          </div>
        ) : (
          <ul>
            {upcomingRides.map((ride) => {
              const isInProgress = ride.status === 'in_progress';
              const displayLocation = isInProgress ? driverLocation[ride.carpoolride_id] : null;

              // Use passenger_request from UserDashboardView if available, else find from requests
              const passengerRequest = ride.passenger_request || ride.requests?.find(
                (r) => r.status === 'accepted' && r.passenger.id === user.id
              );

              

              return (
                <li key={ride.carpoolride_id}>
                  <h4>Ride from {ride.origin?.label} to {ride.destination?.label}</h4>
                  <p>Driver: {ride.driver?.name}</p>
                  <p>Departure: {new Date(ride.departure_time).toLocaleString()}</p>
                  <p>Seats unoccupied: {ride.available_seats}</p>
                  <p>Status: {ride.status}</p>
                  {isInProgress && displayLocation && passengerRequest ? (
                    <div>
                      {/* <p>
                        Driver Location: {displayLocation.latitude}, {displayLocation.longitude}
                      </p> */}
                      <div className="MapComponent">
                      <MapComponent
                        optimizedRoute={{
                          ride_id: ride.carpoolride_id,
                          route: null,
                          passengers: [{
                            user_id: passengerRequest.passenger_id,
                            pickup_lat: passengerRequest.pickup_location.lat,
                            pickup_lng: passengerRequest.pickup_location.lng,
                            label: passengerRequest.pickup_location.label,
                            name: passengerRequest.passenger_fullname,
                          }],
                        }}
                        currentLocation={displayLocation}
                        useSimulation={false}
                        onLocationUpdate={(newLocation) => console.log('Location updated:', newLocation)}
                      />
                      </div>
                    </div>
                  ) : isInProgress ? (
                    <p>Driver location or pickup details not available</p>
                  ) : null}
                  {passengerRequest && ride.status !== 'completed' && (
                    <button
                      onClick={() => handleCancelRide(ride.carpoolride_id)}
                      disabled={ride.status === 'completed'}
                    >
                      Cancel Ride
                    </button>
                  )}
    
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default PassengerDashboard;
