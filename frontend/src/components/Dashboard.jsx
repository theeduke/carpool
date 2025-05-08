import React, { useEffect, useState, useContext } from 'react';
import { passengerService } from '../services/api';
import MapComponent from './MapComponent';
import { AuthContext } from '../context/AuthContext';

const PassengerDashboard = () => {
  const { user } = useContext(AuthContext);
  const [upcomingRides, setUpcomingRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [driverLocation, setDriverLocation] = useState({}); // Store live driver location by ride ID

  // Protect the component: Redirect or show message if user is not logged in
  if (!user) {
    return <div>Please log in to view your dashboard.</div>;
  }

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
      await passengerService.cancelRide(rideId);
      alert('Ride cancelled successfully');
      // Refresh dashboard data
      const response = await passengerService.getDashboard();
      setUpcomingRides(response.data.upcoming_rides);
    } catch (err) {
      alert('Failed to cancel ride');
      console.error('Cancel ride error:', err);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="passenger-dashboard">
      <h2>Passenger Dashboard</h2>

      <section>
        <h3>Upcoming Rides</h3>
        {upcomingRides.length === 0 ? (
          <p>No upcoming rides</p>
        ) : (
          <ul>
            {upcomingRides.map((ride) => {
              const isInProgress = ride.status === 'in_progress';
              const displayLocation = isInProgress ? driverLocation[ride.carpoolride_id] : null;

              // Use passenger_request from UserDashboardView if available, else find from requests
              const passengerRequest = ride.passenger_request || ride.requests?.find(
                (r) => r.status === 'accepted' && r.passenger.id === user.id
              );

              console.log(`Ride ${ride.carpoolride_id} displayLocation:`, displayLocation);
              console.log(`Ride ${ride.carpoolride_id} passengerRequest:`, passengerRequest);

              return (
                <li key={ride.carpoolride_id}>
                  <h4>Ride from {ride.origin?.label} to {ride.destination?.label}</h4>
                  <p>Driver: {ride.driver?.fullname}</p>
                  <p>Departure: {new Date(ride.departure_time).toLocaleString()}</p>
                  <p>Seats: {ride.available_seats}</p>
                  <p>Status: {ride.status}</p>
                  {isInProgress && displayLocation && passengerRequest ? (
                    <div>
                      <p>
                        Driver Location: {displayLocation.latitude}, {displayLocation.longitude}
                      </p>
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
                  ) : isInProgress ? (
                    <p>Driver location or pickup details not available</p>
                  ) : null}
                  <button onClick={() => handleCancelRide(ride.carpoolride_id)}>Cancel Ride</button>
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



// import React, { useEffect, useState, useContext } from 'react';
// import { passengerService } from '../services/api';
// import MapComponent from './MapComponent';
// import { AuthContext } from '../context/AuthContext'; // Import AuthContext
// // import { AuthContext } from '../context/AuthContext'
// // import './PassengerDashboard.css';

// const PassengerDashboard = () => {
//   // const { user } = useContext(AuthContext);
//   const { user } = useContext(AuthContext); // Access user from AuthContext
//   const [upcomingRides, setUpcomingRides] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [driverLocation, setDriverLocation] = useState(null); // Store live driver location for in_progress ride

//   // Protect the component: Redirect or show message if user is not logged in
//   if (!user) {
//     return <div>Please log in to view your dashboard.</div>;
//   }
//   // Fetch dashboard data on mount
//   useEffect(() => {
//     const fetchDashboard = async () => {
//       try {
//         setLoading(true);
//         const response = await passengerService.getDashboard();
//         console.log('Dashboard response:', response.data);
//         setUpcomingRides(response.data.upcoming_rides);
//         setLoading(false);
//       } catch (err) {
//         setError('Failed to load dashboard data');
//         setLoading(false);
//         console.error('Dashboard fetch error:', err);
//       }
//     };
//     fetchDashboard();
//   }, []);

//   // Fetch driver live location for the in_progress ride
//   useEffect(() => {
//     const inProgressRide = upcomingRides.find((ride) => ride.status === 'in_progress');
//     if (!inProgressRide) {
//       setDriverLocation(null);
//       console.log('No in_progress ride found');
//       return;
//     }

//     const fetchDriverLocation = async () => {
//       try {
//         const response = await passengerService.getDriverLiveLocation(inProgressRide.carpoolride_id);
//         console.log('Driver location response:', response.data);
//         setDriverLocation({
//           latitude: Number(response.data.latitude),
//           longitude: Number(response.data.longitude),
//         });
//       } catch (err) {
//         console.warn(`Failed to fetch driver location for ride ${inProgressRide.carpoolride_id}:`, err);
//         setDriverLocation(null);
//       }
//     };

//     // Initial fetch
//     fetchDriverLocation();

//     // Poll every 10 seconds for live updates
//     const interval = setInterval(fetchDriverLocation, 10000);

//     return () => clearInterval(interval);
//   }, [upcomingRides]);

//   // Handle ride cancellation
//   const handleCancelRide = async (rideId) => {
//     try {
//       await passengerService.cancelRide(rideId);
//       alert('Ride cancelled successfully');
//       // Refresh dashboard data
//       const response = await passengerService.getDashboard();
//       setUpcomingRides(response.data.upcoming_rides);
//     } catch (err) {
//       alert('Failed to cancel ride');
//       console.error('Cancel ride error:', err);
//     }
//   };

//   if (loading) return <div>Loading...</div>;
//   if (error) return <div>{error}</div>;

//   return (
//     <div className="passenger-dashboard">
//       <h2>Passenger Dashboard</h2>

//       <section>
//         <h3>Upcoming Rides</h3>
//         {upcomingRides.length === 0 ? (
//           <p>No upcoming rides</p>
//         ) : (
//           <ul>
//             {upcomingRides.map((ride) => {
//               const isInProgress = ride.status === 'in_progress';
//               const displayLocation = isInProgress
//                 ? (driverLocation || (ride.driver_location && {
//                     latitude: Number(ride.driver_location.latitude),
//                     longitude: Number(ride.driver_location.longitude),
//                   }))
//                 : null;

//               // Find the current passenger's ride request
//               const passengerRequest = ride.requests?.find(
//                 (r) => r.status === 'accepted' && r.passenger.id === user.id
//               );

//               console.log(`Ride ${ride.carpoolride_id} displayLocation:`, displayLocation);
//               console.log(`Ride ${ride.carpoolride_id} passengerRequest:`, passengerRequest);

//               return (
//                 <li key={ride.carpoolride_id}>
//                   <h4>Ride from {ride.origin?.label} to {ride.destination?.label}</h4>
//                   <p>Driver: {ride.driver?.fullname}</p>
//                   <p>Departure: {new Date(ride.departure_time).toLocaleString()}</p>
//                   <p>Seats: {ride.available_seats}</p>
//                   <p>Status: {ride.status}</p>
//                   {isInProgress && displayLocation ? (
//                     <div>
//                       <p>
//                         Driver Location: {displayLocation.latitude}, {displayLocation.longitude}
//                       </p>
//                       <MapComponent
//                         optimizedRoute={{
//                           ride_id: ride.carpoolride_id,
//                           route: null, // No route data needed for passengers
//                           passengers: passengerRequest ? [{
//                             pickup_lat: passengerRequest.pickup_location.lat,
//                             pickup_lng: passengerRequest.pickup_location.lng,
//                             label: passengerRequest.pickup_location.label,
//                             name: passengerRequest.passenger.fullname,
//                           }] : [],
//                         }}
//                         currentLocation={displayLocation}
//                         useSimulation={false}
//                         onLocationUpdate={(newLocation) => console.log('Location updated:', newLocation)}
//                       />
//                     </div>
//                   ) : isInProgress ? (
//                     <p>Driver location not available</p>
//                   ) : null}
//                   <button onClick={() => handleCancelRide(ride.carpoolride_id)}>Cancel Ride</button>
//                 </li>
//               );
//             })}
//           </ul>
//         )}
//       </section>
//     </div>
//   );
// };

// export default PassengerDashboard;





// not correct
// import React, { useEffect, useState } from 'react';
// import { passengerService } from '../services/api';
// import MapComponent from './MapComponent';
// // import './PassengerDashboard.css';

// const PassengerDashboard = () => {
//   const [upcomingRides, setUpcomingRides] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [driverLocation, setDriverLocation] = useState(null); // Store live driver location for in_progress ride

//   // Fetch dashboard data on mount
//   useEffect(() => {
//     const fetchDashboard = async () => {
//       try {
//         setLoading(true);
//         const response = await passengerService.getDashboard();
//         console.log('Dashboard response:', response.data);
//         setUpcomingRides(response.data.upcoming_rides);
//         setLoading(false);
//       } catch (err) {
//         setError('Failed to load dashboard data');
//         setLoading(false);
//         console.error('Dashboard fetch error:', err);
//       }
//     };
//     fetchDashboard();
//   }, []);

//   // Fetch driver live location for the in_progress ride
//   useEffect(() => {
//     const inProgressRide = upcomingRides.find((ride) => ride.status === 'in_progress');
//     if (!inProgressRide) {
//       setDriverLocation(null);
//       console.log('No in_progress ride found');
//       return;
//     }

//     const fetchDriverLocation = async () => {
//       try {
//         const response = await passengerService.getDriverLiveLocation(inProgressRide.carpoolride_id);
//         console.log('Driver location response:', response.data);
//         setDriverLocation({
//           latitude: Number(response.data.latitude),
//           longitude: Number(response.data.longitude),
//         });
//       } catch (err) {
//         console.warn(`Failed to fetch driver location for ride ${inProgressRide.carpoolride_id}:`, err);
//         setDriverLocation(null);
//       }
//     };

//     // Initial fetch
//     fetchDriverLocation();

//     // Poll every 10 seconds for live updates
//     const interval = setInterval(fetchDriverLocation, 10000);

//     return () => clearInterval(interval);
//   }, [upcomingRides]);

//   // Handle ride cancellation
//   const handleCancelRide = async (rideId) => {
//     try {
//       await passengerService.cancelRide(rideId);
//       alert('Ride cancelled successfully');
//       // Refresh dashboard data
//       const response = await passengerService.getDashboard();
//       setUpcomingRides(response.data.upcoming_rides);
//     } catch (err) {
//       alert('Failed to cancel ride');
//       console.error('Cancel ride error:', err);
//     }
//   };

//   if (loading) return <div>Loading...</div>;
//   if (error) return <div>{error}</div>;

//   return (
//     <div className="passenger-dashboard">
//       <h2>Passenger Dashboard</h2>

//       <section>
//         <h3>Upcoming Rides</h3>
//         {upcomingRides.length === 0 ? (
//           <p>No upcoming rides</p>
//         ) : (
//           <ul>
//             {upcomingRides.map((ride) => {
//               const isInProgress = ride.status === 'in_progress';
//               const displayLocation = isInProgress
//                 ? (driverLocation || (ride.driver_location && {
//                     latitude: Number(ride.driver_location.latitude),
//                     longitude: Number(ride.driver_location.longitude),
//                   }))
//                 : null;

//               console.log(`Ride ${ride.carpoolride_id} displayLocation:`, displayLocation);

//               return (
//                 <li key={ride.carpoolride_id}>
//                   <h4>Ride from {ride.origin?.label} to {ride.destination?.label}</h4>
//                   <p>Driver: {ride.driver?.fullname}</p>
//                   <p>Departure: {new Date(ride.departure_time).toLocaleString()}</p>
//                   <p>Seats: {ride.available_seats}</p>
//                   <p>Status: {ride.status}</p>
//                   {isInProgress && displayLocation ? (
//                     <div>
//                       <p>
//                         Driver Location: {displayLocation.latitude}, {displayLocation.longitude}
//                       </p>
//                       <MapComponent
//                         optimizedRoute={{
//                           ride_id: ride.carpoolride_id,
//                           route: ride.route, // Assuming route data is included in serializer
//                           passengers: ride.requests?.filter((r) => r.status === 'accepted').map((r) => ({
//                             pickup_lat: r.pickup_location.lat,
//                             pickup_lng: r.pickup_location.lng,
//                             label: r.pickup_location.label,
//                             name: r.passenger.fullname,
//                           })),
//                         }}
//                         currentLocation={displayLocation}
//                         useSimulation={false}
//                         onLocationUpdate={(newLocation) => console.log('Location updated:', newLocation)}
//                       />
//                     </div>
//                   ) : isInProgress ? (
//                     <p>Driver location not available</p>
//                   ) : null}
//                   <button onClick={() => handleCancelRide(ride.carpoolride_id)}>Cancel Ride</button>
//                 </li>
//               );
//             })}
//           </ul>
//         )}
//       </section>
//     </div>
//   );
// };

// export default PassengerDashboard;









// import { useEffect, useState, useContext } from "react";
// import { passengerService, walletService, disputeService } from '../services/api'; 
// import TransferFundsModal from './TransferFundsModal'
// import  {  AuthContext} from "../context/AuthContext";
// // import { w3cwebsocket as W3CWebSocket } from "websocket";

// // import '../main.css'
// // import '../styles/main.css'

// function Dashboard() {
//   const { user } = useContext(AuthContext);
//   const [dashboardData, setDashboardData] = useState({
//     upcoming_rides: [],
//     ride_history: [],
//   });
//   const [disputes, setDisputes] = useState([]);
//   const [loading, setLoading] = useState(true); // Add loading state
//   const [error, setError] = useState(null); // Add error state
//   const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
//   const [notifications, setNotifications] = useState({});
  
//   // Initialize WebSocket
//   useEffect(() => {
//     if (!user|| !user.id || !user.access_token) return;

    
//     const backendwsUrl = import.meta.env.VITE_BACKEND_WS_URL;
//     // const backendUrl = "http://localhost:8000";
    
//     // console.log("VITE_BACKEND_URL:", backendUrl);
//     const wsProtocol = backendwsUrl.startsWith("https") ? "wss" : "ws";
//     const wsBaseUrl = backendwsUrl.replace(/^http[s]?:\/\//, ''); // Remove http:// or https://
//     const wsUrl = `${wsProtocol}://${wsBaseUrl}/ws/notifications/user_${user.id}/?token=${user.access_token}`;
//     // ws/notifications/user_(?P<user_id>[^/]+)/
//     console.log("this is the wsUrl:", wsUrl);

//     // const ws = new WebSocket(wsUrl);
//     let ws;
//     let reconnectAttempts = 0;
//     const maxReconnectAttempts = 5;
//     const reconnectInterval = 3000;

//     const connectWebSocket = () => {
//       ws = new WebSocket(wsUrl);
//       ws.onopen = () => {
//         console.log("WebSocket connected");
//         reconnectAttempts = 0; // Reset on successful connection
//         };

//     // const ws = new W3CWebSocket(`ws://VITE_BACKEND_URL/ws/user_${user.id}/`);

//     // ws.onopen = () => {
//     //   console.log("WebSocket connected");
//     // };

//       ws.onmessage = (event) => {
//         console.log("WebSocket message received:", event.data);
//         const data = JSON.parse(event.data);
//         if (data.type === "send_notification") {
//           console.log("Notification:", data);
//           setNotifications((prev) => {
//             const updated = {...prev, [data.carpoolride_id]: data.message}; // Store message by carpoolride_id if included
//             console.log("Updated notifications:", updated)
//             return updated;
//             });
//           }
//         };

//       ws.onclose = (event) => {
//         console.log(`WebSocket closed, code: ${event.code}, reason: ${event.reason}`);
//         if (reconnectAttempts < maxReconnectAttempts) {
//           console.log(`Reconnecting in ${reconnectInterval / 1000} seconds...`);
//           setTimeout(connectWebSocket, reconnectInterval);
//           reconnectAttempts++;
//         } else {
//           console.error("Max reconnect attempts reached");
//         }
//       };
//       ws.onerror = (error) => {
//         console.error("WebSocket error:", error);
//         ws.close();
//         };
//       };

//     connectWebSocket();

//   return () => {
//     if (ws) ws.close();
//   };
// }, [user]);

//   // const currentPassengerName = AuthProvider.user.fullname;// This should come from your auth context or state

//   // Fetch dashboard and disputes on mount
//   useEffect(() => {
//     if (!user) return; // Wait until user is loaded
//     const fetchData = async () => {
//       setLoading(true);
//       setError(null);
//       try {
//         // Fetch dashboard data
//         const dashboardResponse = await passengerService.getDashboard();
//         setDashboardData(dashboardResponse.data);

//         // Fetch user disputes
//         const disputesResponse = await disputeService.getUserDisputes();
//         setDisputes(disputesResponse.data);
//       } catch (err) {
//         console.error("Error fetching data:", err);
//         setError("Failed to load dashboard data. Please try again.");
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchData();
//   }, [user]); // Re-run when user changes

//   const handleCancelRide = async (rideId) => {
//     if (window.confirm("Are you sure you want to cancel this ride?")) {
//       try {
//         await passengerService.cancelRide(rideId);
//         setDashboardData((prev) => ({
//           upcoming_rides: prev.upcoming_rides.filter((ride) => ride.carpoolride_id !== rideId),
//           ride_history: [
//             ...prev.ride_history,
//             { ...prev.upcoming_rides.find((ride) => ride.carpoolride_id === rideId), status: "canceled" },
//           ],
//         }));
//         alert("Ride canceled successfully!");
//       } catch (error) {
//         console.error("Error canceling ride:", error);
//         alert("Failed to cancel ride: " + (error.response?.data?.error || "Unknown error"));
//       }
//     }
//   };

//   // const handleCancelRide = async (rideId) => {
//   //   if (window.confirm("Are you sure you want to cancel this ride?")) {
//   //     try {
//   //       await passengerService.cancelRide(rideId);
//   //       setDashboardData((prev) => {
//   //         const canceledRide = prev.upcoming_rides.find((ride) => ride.carpoolride_id === rideId);
//   //         return {
//   //           upcoming_rides: prev.upcoming_rides.filter((ride) => ride.carpoolride_id !== rideId),
//   //           ride_history: [
//   //             ...prev.ride_history,
//   //             { ...canceledRide, status: "canceled" },
//   //           ],
//   //         };
//   //       });
//   //       alert("Ride canceled successfully!");
//   //     } catch (error) {
//   //       console.error("Error canceling ride:", error);
//   //       alert("Failed to cancel ride: " + (error.response?.data?.error || "Unknown error"));
//   //     }
//   //   }
//   // };

//   const handleDeposit = async () => {
//     const phone = prompt("Enter phone number (e.g., 2547XXXXXXXX):");
//     const amount = prompt("Enter amount:");
//     if (!phone || !amount) return;
//     try {
//       await walletService.deposit({ phone_number: phone, amount });
//       alert("Approve the STK Push on your phone.");
//     } catch (error) {
//       console.error("Error depositing funds:", error);
//       alert("Deposit failed: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   // const handleTransfer = async () => {
//   //   const recipientId = prompt("Enter recipient user ID:");
//   //   const amount = prompt("Enter amount:");
//   //   if (!recipientId || !amount) return;
//   //   try {
//   //     const response = await walletService.transferFunds({ recipient_id: recipientId, amount });
//   //     alert(response.data.message);
//   //   } catch (error) {
//   //     console.error("Error transferring funds:", error);
//   //     alert("Transfer failed: " + (error.response?.data?.error || "Unknown error"));
//   //   }
//   // };
//   const handleTransfer = async (phone_number, amount) => {
//     try {
//       const response = await walletService.transferFunds({ phone_number: phone_number, amount });
//       alert(response.data.message);
//       setIsTransferModalOpen(false); // Close modal after success
//     } catch (error) {
//       console.error("Error transferring funds:", error);
//       alert("Transfer failed: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   const handleSubmitDispute = async (rideId) => {
//     const reason = prompt("Enter reason for dispute:");
//     if (!reason) return;
//     try {
//       const response = await disputeService.submitDispute({ ride_id: rideId, reason });
//       alert(response.data.message);
//       // Refresh disputes after submission
//       const disputesResponse = await disputeService.getUserDisputes();
//       setDisputes(disputesResponse.data);
//     } catch (error) {
//       console.error("Error submitting dispute:", error);
//       alert("Failed to submit dispute: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   const handleDisputeRide = async (rideId) => {
//     if (window.confirm("Are you sure you want to dispute this ride and request a refund?")) {
//       try {
//         const response = await disputeService.disputeRide(rideId);
//         alert(response.data.message);
//         // Refresh disputes after disputing ride
//         const disputesResponse = await disputeService.getUserDisputes();
//         setDisputes(disputesResponse.data);
//       } catch (error) {
//         console.error("Error disputing ride:", error);
//         alert("Failed to dispute ride: " + (error.response?.data?.error || "Unknown error"));
//       }
//     }
//   };

//   if (loading) {
//     return <div>Loading...</div>;
//   }

//   if (error) {
//     return <div>{error}</div>;
//   }

//   const currentPassengerId = user?.id
//   console.log("Current notifications:", notifications);
//   // console.log("this is what is in user", user)

//   return (
//     <div className="dashboard">
//       <h2 className="dashboard-title">Notifications</h2>
//       {Object.entries(notifications).length > 0 ? (
//         <ul>
//           {Object.entries(notifications).map(([carpoolride_id, message]) => (
//             <li key={carpoolride_id}>
//               Ride {carpoolride_id}: {message}
//             </li>
//           ))}
//         </ul>
//       ) : (
//         <p>No notifications yet.</p>
//       )}

//       <h2 className="dashboard-title">Upcoming Rides</h2>
//       {dashboardData.upcoming_rides.length > 0 ? (
//         dashboardData.upcoming_rides.filter((ride) => ride.status !== "completed")
//         .map((ride) => {
//           // Find the request for the current passenger
//           const passengerRequest = ride.requests.find(req => req.id === currentPassengerId && req.status === "accepted");
//           // const notification = notifications[ride.carpoolride_id];

//           return (
//             <div key={ride.carpoolride_id} className="ride-card">
//               {/* <h3 className="dashboard-title">Notifications</h3> */}
//       {/* {Object.entries(notifications).length > 0 ? (
//         <ul>
//           {Object.entries(notifications).map(([carpoolride_id, message]) => (
//             <li key={carpoolride_id}>
//               Ride {carpoolride_id}: {message}
//             </li>
//           ))}
//         </ul>
//       ) : (
//         <p>No notifications yet.</p>
//       )} */}

//               <p className="ride-details"><strong>Pickup:</strong> {passengerRequest?.pickup_location || "N/A"}</p>
//               <p className="ride-details"><strong>Destination:</strong> {ride.destination?.label || "N/A"}</p>
//               <p className="ride-details"><strong>Driver:</strong> {ride.driver_name || "N/A"}</p>
//               <p className="ride-details"><strong>Car:</strong> {ride.car_details || "N/A"}</p>
//               <p className="ride-details"><strong>Departure:</strong> {new Date(ride.departure_time).toLocaleString()}</p>
//               <button onClick={() => handleCancelRide(ride.carpoolride_id)} className="ride-button">Cancel Ride</button>
//             </div>
//                 );
//               })
//             ) : (
//               <p>No upcoming rides.</p>
//             )}
//       {/* {dashboardData.upcoming_rides.length > 0 ? (
//         dashboardData.upcoming_rides.map((ride) => (
//           <div key={ride.carpoolride_id} className="ride-card">
//             {/* <p className="ride-details"><strong>Pickup:</strong> {ride.requests.pickup_location || "N/A"}</p> */}
//             {/* <p className="ride-details"><strong>Destination:</strong> {ride.destination?.label || "N/A"}</p>
//             <p className="ride-details"><strong>Driver:</strong> {ride.driver_name || "N/A"}</p>
//             <p className="ride-details"><strong>Car:</strong> {ride.car_details || "N/A"}</p>
//             <p className="ride-details"><strong>Departure:</strong> {new Date(ride.departure_time).toLocaleString()}</p>
//             <button onClick={() => handleCancelRide(ride.carpoolride_id)} className="ride-button">Cancel Ride</button>
//           </div>
//         ))
//       ) : (
//         <p>No upcoming rides.</p> */}
//       {/* )} */} 

//       <h2 className="dashboard-title">Ride History</h2>
//       {dashboardData.ride_history.length > 0 ? (
//         dashboardData.ride_history.map((ride) => (
//           <div key={ride.carpoolride_id} className="ride-card">
//             <p className="ride-details"><strong>Pickup:</strong> {ride.pickup}</p>
//             <p className="ride-details"><strong>Destination:</strong> {ride.destination}</p>
//             <p className="ride-details"><strong>Driver:</strong> {ride.driver_name}</p>
//             <p className="ride-details"><strong>Car:</strong> {ride.car_details}</p>
//             <p className="ride-details"><strong>Departure:</strong> {new Date(ride.departure_time).toLocaleString()}</p>
//             <p className="ride-details"><strong>Status:</strong> {ride.status}</p>
//             <button onClick={() => handleDisputeRide(ride.carpoolride_id)} className="ride-button">Dispute Ride</button>
//             <button onClick={() => handleSubmitDispute(ride.carpoolride_id)} className="ride-button">Submit Dispute</button>
//           </div>
//         ))
//       ) : (
//         <p>No past rides.</p>
//       )}

//       <h3 className="dashboard-title">My Disputes</h3>
//       {disputes.length > 0 ? (
//         disputes.map((dispute) => (
//           <div key={dispute.id} className="dispute-card">
//             <p className="ride-details"><strong>Ride ID:</strong> {dispute.ride || "N/A"}</p>
//             <p className="ride-details"><strong>Reason:</strong> {dispute.reason}</p>
//             <p className="ride-details"><strong>Status:</strong> {dispute.status}</p>
//           </div>
//         ))
//       ) : (
//         <p>No disputes filed.</p>
//       )}

//       <div className="action-buttons">
//         <button onClick={handleDeposit} className="ride-button">Deposit Funds</button>
//         <button onClick={() => setIsTransferModalOpen(true)} className="ride-button">Transfer Funds</button>
//       </div>
//       <TransferFundsModal
//         isOpen={isTransferModalOpen}
//         onClose={() => setIsTransferModalOpen(false)}
//         onTransfer={handleTransfer}
//       />
//     </div>
//   );
// }
// export default Dashboard;



  // return (
  //   <div>
  //     <h2>Upcoming Rides</h2>
  //     {dashboardData.upcoming_rides.length > 0 ? (
  //       dashboardData.upcoming_rides.map((ride) => (
  //         <div key={ride.ride_id} style={{ border: "1px solid #ccc", padding: "10px", margin: "10px 0" }}>
  //           <p><strong>Pickup:</strong> {ride.pickup}</p>
  //           <p><strong>Destination:</strong> {ride.destination}</p>
  //           <p><strong>Driver:</strong> {ride.driver_name}</p>
  //           <p><strong>Car:</strong> {ride.car_details}</p>
  //           <p><strong>Departure:</strong> {new Date(ride.departure_time).toLocaleString()}</p>
  //           <button onClick={() => handleCancelRide(ride.ride_id)}>Cancel Ride</button>
  //         </div>
  //       ))
  //     ) : (
  //       <p>No upcoming rides.</p>
  //     )}

  //     <h2>Ride History</h2>
  //     {dashboardData.ride_history.length > 0 ? (
  //       dashboardData.ride_history.map((ride) => (
  //         <div key={ride.ride_id} style={{ border: "1px solid #ccc", padding: "10px", margin: "10px 0" }}>
  //           <p><strong>Pickup:</strong> {ride.pickup}</p>
  //           <p><strong>Destination:</strong> {ride.destination}</p>
  //           <p><strong>Driver:</strong> {ride.driver_name}</p>
  //           <p><strong>Car:</strong> {ride.car_details}</p>
  //           <p><strong>Departure:</strong> {new Date(ride.departure_time).toLocaleString()}</p>
  //           <p><strong>Status:</strong> {ride.status}</p>
  //           <button onClick={() => handleDisputeRide(ride.ride_id)}>Dispute Ride</button>
  //           <button onClick={() => handleSubmitDispute(ride.ride_id)}>Submit Dispute</button>
  //         </div>
  //       ))
  //     ) : (
  //       <p>No past rides.</p>
  //     )}

  //     <h3>My Disputes</h3>
  //     {disputes.length > 0 ? (
  //       disputes.map((dispute) => (
  //         <div key={dispute.id} style={{ border: "1px solid #ccc", padding: "10px", margin: "10px 0" }}>
  //           <p><strong>Ride ID:</strong> {dispute.ride || "N/A"}</p>
  //           <p><strong>Reason:</strong> {dispute.reason}</p>
  //           <p><strong>Status:</strong> {dispute.status}</p>
  //         </div>
  //       ))
  //     ) : (
  //       <p>No disputes filed.</p>
  //     )}

  //     <div>
  //       <button onClick={handleDeposit}>Deposit Funds</button>
  //       {/* <button onClick={handleTransfer}>Transfer Funds</button> */}
  //       <button onClick={() => setIsTransferModalOpen(true)}>Transfer Funds</button>
  //     </div>
  //     {/* Render Transfer Funds Modal */}
  //     <TransferFundsModal
  //       isOpen={isTransferModalOpen}
  //       onClose={() => setIsTransferModalOpen(false)}
  //       onTransfer={handleTransfer}
  //     />
  //   </div>
  // );
// }

// export default Dashboard;


// import { useEffect, useState } from "react";
// import axios from "axios";

// function Dashboard() {
//   const [dashboardData, setDashboardData] = useState({
//     upcoming_rides: [],
//     ride_history: [],
//   });
//   const [disputes, setDisputes] = useState([]); // Added missing state

//   useEffect(() => {
//     const fetchDashboard = async () => {
//       try {
//         const response = await axios.get("http://localhost:8000/api/dashboard/", {
//           headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
//         });
//         setDashboardData(response.data);
//       } catch (error) {
//         console.error("Error fetching dashboard:", error);
//       }
//     };
//     fetchDashboard();
//   }, []);

//   const handleCancelRide = async (rideId) => {
//     if (window.confirm("Are you sure you want to cancel this ride?")) {
//       try {
//         await axios.post(
//           `http://localhost:8000/api/cancel-ride/${rideId}/`,
//           {},
//           {
//             headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
//           }
//         );
//         setDashboardData((prev) => {
//           const canceledRide = prev.upcoming_rides.find((ride) => ride.ride_id === rideId);
//           return {
//             upcoming_rides: prev.upcoming_rides.filter((ride) => ride.ride_id !== rideId),
//             ride_history: [
//               ...prev.ride_history,
//               { ...canceledRide, status: "canceled" },
//             ],
//           };
//         });
//         alert("Ride canceled successfully!");
//       } catch (error) {
//         console.error("Error canceling ride:", error);
//         alert("Failed to cancel ride: " + (error.response?.data?.error || "Unknown error"));
//       }
//     }
//   };

//   const handleDeposit = async () => {
//     const phone = prompt("Enter phone number (e.g., 2547XXXXXXXX):");
//     const amount = prompt("Enter amount:");
//     try {
//       await axios.post(
//         "http://localhost:8000/api/deposit/",
//         { phone_number: phone, amount },
//         { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
//       );
//       alert("Approve the STK Push on your phone.");
//     } catch (error) {
//       alert("Deposit failed: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   const handleTransfer = async () => {
//     const recipientId = prompt("Enter recipient user ID:");
//     const amount = prompt("Enter amount:");
//     try {
//       const response = await axios.post(
//         "http://localhost:8000/api/transfer/",
//         { recipient_id: recipientId, amount },
//         { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
//       );
//       alert(response.data.message);
//     } catch (error) {
//       alert("Transfer failed: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   const handleSubmitDispute = async (rideId) => {
//     const reason = prompt("Enter reason for dispute:");
//     if (!reason) return;
//     try {
//       const response = await axios.post(
//         "http://localhost:8000/api/submit-dispute/",
//         { ride_id: rideId, reason },
//         { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
//       );
//       alert(response.data.message);
//     } catch (error) {
//       alert("Failed to submit dispute: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };
  
//   const handleDisputeRide = async (rideId) => {
//     if (window.confirm("Are you sure you want to dispute this ride and request a refund?")) {
//       try {
//         const response = await axios.post(
//           `http://localhost:8000/api/dispute-ride/${rideId}/`,
//           {},
//           { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
//         );
//         alert(response.data.message);
//       } catch (error) {
//         alert("Failed to dispute ride: " + (error.response?.data?.error || "Unknown error"));
//       }
//     }
//   };

//   return (
//     <div>
//       <h2>Upcoming Rides</h2>
//       {dashboardData.upcoming_rides.length > 0 ? (
//         dashboardData.upcoming_rides.map((ride) => (
//           <div key={ride.ride_id} style={{ border: "1px solid #ccc", padding: "10px", margin: "10px 0" }}>
//             <p><strong>Pickup:</strong> {ride.pickup}</p>
//             <p><strong>Destination:</strong> {ride.destination}</p>
//             <p><strong>Driver:</strong> {ride.driver_name}</p>
//             <p><strong>Car:</strong> {ride.car_details}</p>
//             <p><strong>Departure:</strong> {new Date(ride.departure_time).toLocaleString()}</p>
//             <button onClick={() => handleCancelRide(ride.ride_id)}>Cancel Ride</button>
//           </div>
//         ))
//       ) : (
//         <p>No upcoming rides.</p>
//       )}

//       <h2>Ride History</h2>
//       {dashboardData.ride_history.length > 0 ? (
//         dashboardData.ride_history.map((ride) => (
//           <div key={ride.ride_id} style={{ border: "1px solid #ccc", padding: "10px", margin: "10px 0" }}>
//             <p><strong>Pickup:</strong> {ride.pickup}</p>
//             <p><strong>Destination:</strong> {ride.destination}</p>
//             <p><strong>Driver:</strong> {ride.driver_name}</p>
//             <p><strong>Car:</strong> {ride.car_details}</p>
//             <p><strong>Departure:</strong> {new Date(ride.departure_time).toLocaleString()}</p>
//             <p><strong>Status:</strong> {ride.status}</p>
//             <button onClick={() => handleDisputeRide(ride.ride_id)}>Dispute Ride</button>
//           </div>
//         ))
//       ) : (
//         <p>No past rides.</p>
//       )}

//       <h3>My Disputes</h3>
//       {disputes.length > 0 ? (
//         disputes.map((dispute) => (
//           <div key={dispute.id}>
//             <p>Ride ID: {dispute.ride || "N/A"}</p>
//             <p>Reason: {dispute.reason}</p>
//             <p>Status: {dispute.status}</p>
//           </div>
//         ))
//       ) : (
//         <p>No disputes filed.</p>
//       )}

//       <div>
//         <button onClick={handleDeposit}>Deposit Funds</button>
//         <button onClick={handleTransfer}>Transfer Funds</button>
//       </div>
//     </div>
//   );
// }

// export default Dashboard;


// import { useEffect, useState } from "react";
// import axios from "axios";
// // import RideCard from "./RideCard";

// function Dashboard() {
//   const [dashboardData, setDashboardData] = useState({
//     upcoming_rides: [],
//     ride_history: [],
//   });

//   useEffect(() => {
//     const fetchDashboard = async () => {
//       try {
//         const response = await axios.get("http://localhost:8000/api/dashboard/", {
//           headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
//         });
//         setDashboardData(response.data);
//       } catch (error) {
//         console.error("Error fetching dashboard:", error);
//       }
//       };
//       fetchDashboard();
//     }, []);

//     // Handle ride cancellation with confirmation
//   const handleCancelRide = async (rideId) => {
//     if (window.confirm("Are you sure you want to cancel this ride?")) {
//       try {
//         await axios.post(
//           `http://localhost:8000/api/cancel-ride/${rideId}/`,
//           {},
//           {
//             headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
//           }
//         );
//         // Move the canceled ride to ride_history and remove from upcoming_rides
//         setDashboardData((prev) => {
//           const canceledRide = prev.upcoming_rides.find((ride) => ride.ride_id === rideId);
//           return {
//             upcoming_rides: prev.upcoming_rides.filter((ride) => ride.ride_id !== rideId),
//             ride_history: [
//               ...prev.ride_history,
//               { ...canceledRide, status: "canceled" }, // Add status for display
//             ],
//           };
//         });
//         alert("Ride canceled successfully!");
//       } catch (error) {
//         console.error("Error canceling ride:", error);
//         alert("Failed to cancel ride: " + (error.response?.data?.error || "Unknown error"));
//       }
//     }
//   };

//   const handleDeposit = async () => {
//     const phone = prompt("Enter phone number (e.g., 2547XXXXXXXX):");
//     const amount = prompt("Enter amount:");
//     try {
//       await axios.post(
//         "http://localhost:8000/api/deposit/",
//         { phone_number: phone, amount },
//         { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
//       );
//       alert("Approve the STK Push on your phone.");
//     } catch (error) {
//       alert("Deposit failed: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   const handleTransfer = async () => {
//     const recipientId = prompt("Enter recipient user ID:");
//     const amount = prompt("Enter amount:");
//     try {
//       const response = await axios.post(
//         "http://localhost:8000/api/transfer/",
//         { recipient_id: recipientId, amount },
//         { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
//       );
//       alert(response.data.message);
//     } catch (error) {
//       alert("Transfer failed: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   const handleSubmitDispute = async (rideId) => {
//     const reason = prompt("Enter reason for dispute:");
//     if (!reason) return;
//     try {
//       const response = await axios.post(
//         "http://localhost:8000/api/submit-dispute/",
//         { ride_id: rideId, reason },
//         { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
//       );
//       alert(response.data.message);
//     } catch (error) {
//       alert("Failed to submit dispute: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };
  
//   const handleDisputeRide = async (rideId) => {
//     if (window.confirm("Are you sure you want to dispute this ride and request a refund?")) {
//       try {
//         const response = await axios.post(
//           `http://localhost:8000/api/dispute-ride/${rideId}/`,
//           {},
//           { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
//         );
//         alert(response.data.message);
//         // Refresh dashboard data
//         fetchDashboard();
//       } catch (error) {
//         alert("Failed to dispute ride: " + (error.response?.data?.error || "Unknown error"));
//       }
//     }
//   };
// // </div>
// // );

//   return (
    
//       {/* 
//         <div>
//         <h2>Upcoming Rides</h2>
//       {dashboardData.upcoming_rides.length > 0 ? (
//         dashboardData.upcoming_rides.map((ride) => (
//           <RideCard key={ride.ride_id} ride={ride} />
//         ))
//       ) : (
//         <p>No upcoming rides.</p>
//       )}

//       <h2>Ride History</h2>
//       {dashboardData.ride_history.length > 0 ? (
//         dashboardData.ride_history.map((ride) => (
//           <RideCard key={ride.ride_id} ride={ride} />
//         ))
//       ) : (
//         <p>No past rides.</p>
//       )} 
//        </div>
//   );
//        */}


//   <h2>Upcoming Rides</h2>
//       {dashboardData.upcoming_rides.length > 0 ? (
//         dashboardData.upcoming_rides.map((ride) => (
//           <div key={ride.ride_id} style={{ border: "1px solid #ccc", padding: "10px", margin: "10px 0" }}>
//             <p><strong>Pickup:</strong> {ride.pickup}</p>
//             <p><strong>Destination:</strong> {ride.destination}</p>
//             <p><strong>Driver:</strong> {ride.driver_name}</p>
//             <p><strong>Car:</strong> {ride.car_details}</p>
//             <p><strong>Departure:</strong> {new Date(ride.departure_time).toLocaleString()}</p>
//             <button onClick={() => handleCancelRide(ride.ride_id)}>Cancel Ride</button>
//           </div>
//         ))
//       ) : (
//         <p>No upcoming rides.</p>
//       )}

//       <h2>Ride History</h2>
//       {dashboardData.ride_history.length > 0 ? (
//         dashboardData.ride_history.map((ride) => (
//           <div key={ride.ride_id} style={{ border: "1px solid #ccc", padding: "10px", margin: "10px 0" }}>
//             <p><strong>Pickup:</strong> {ride.pickup}</p>
//             <p><strong>Destination:</strong> {ride.destination}</p>
//             <p><strong>Driver:</strong> {ride.driver_name}</p>
//             <p><strong>Car:</strong> {ride.car_details}</p>
//             <p><strong>Departure:</strong> {new Date(ride.departure_time).toLocaleString()}</p>
//             <p><strong>Status:</strong> {ride.status}</p>
//           </div>
//         ))
//       ) : (
//         <p>No past rides.</p>
//       )}

      
//     </div>
//   );

//       <h3>My Disputes</h3>
//     {disputes.length > 0 ? (
//       disputes.map((dispute) => (
//         <div key={dispute.id}>
//           <p>Ride ID: {dispute.ride || "N/A"}</p>
//           <p>Reason: {dispute.reason}</p>
//           <p>Status: {dispute.status}</p>
//         </div>
//       ))
//     ) : (
//       <p>No disputes filed.</p>
//     )}

//   <button onClick={handleDeposit}>Deposit Funds</button>
//   <button onClick={handleTransfer}>Transfer Funds</button>
// }

// export default Dashboard;