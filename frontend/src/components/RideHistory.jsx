import React, { useEffect, useState, useContext  } from 'react';
import { rideService } from '../services/api';
import { AuthContext } from '../context/AuthContext'
// import '../ridehistory.css'; // Import the native CSS file

const RideHistory = () => {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);
  // console.log("🟡 User from context:", user);

  useEffect(() => {
    const fetchRideHistory = async () => {
      try {
        const response = await rideService.getRideHistory();
        console.log("response from getridehistory", response.data);
        setRides(response.data);
      } catch (error) {
        console.error('Error fetching ride history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRideHistory();
  }, []);

  if (loading) {
    return <div className="ride-history-loading">Loading ride history...</div>;
  }
  return (
    <div className="ride-history-container">
      <h2 className="ride-history-title">Ride History</h2>
      {rides.length === 0 ? (
        <p className="ride-history-empty">No completed rides yet.</p>
      ) : (
        rides.map((ride) => {
            
            const isDriver =  !ride.passengers_info.some(p => p.phone === user.phone_number);

            // console.log("Current user phone:", user.phone_number);
            // console.log("Ride passengers:", ride.passengers_info);
          
            return (
              <div key={ride.carpoolride_id} className="ride-card">
                <div className="ride-summary">
                  <p><strong>From:</strong> {ride.origin.label}</p>
                  <p><strong>To:</strong> {ride.destination.label}</p>
                  <p><strong>Departure:</strong> {new Date(ride.departure_time).toLocaleString()}</p>
                  <p><strong>Status:</strong> {ride.status}</p>
                </div>
          
                {isDriver ? (
                  <div className="ride-users">
                    <h4>Passengers</h4>
                    {ride.passengers_info.map((passenger) => (
                      <div key={passenger.id} className="user-card">
                        <p><strong>Name:</strong> {passenger.fullname}</p>
                        <p><strong>Contact:</strong> {passenger.phone}</p>
                        <p><strong>Amount Paid:</strong> {passenger.amount_paid} KES</p>
                        <button onClick={() => messageUser(passenger.id)}>Message Passenger</button>
                      </div>
                    ))}
                    <p className="ride-total"><strong>Total for Trip:</strong> {ride.total_amount_paid ?? 'N/A'} KES</p>
                  </div>
                ) : (
                  <div className="ride-users">
                    <h4>Driver</h4>
                    <div className="user-card">
                      <p><strong>Name:</strong> {ride.driver_contact?.name || 'N/A'}</p>
                      <p><strong>Phone:</strong> {ride.driver_contact?.phone || 'N/A'}</p>
                      <button onClick={() => messageUser(ride.driver_contact.phone)}>Message Driver</button>
                    </div>
          
                    {ride.passengers_info.length > 1 && (
                      <>
                        <h4>Other Passengers</h4>
                        {ride.passengers_info
                          .filter((p) => p.phone !== user.phone_number)
                          .map((p) => (
                            <div key={p.id} className="user-card">
                              <p>{p.name}</p>
                            </div>
                          ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          }))
      }
    </div>
  );
};

const messageUser = (userId) => {
  alert(`Starting chat with user ID: ${userId}`);
  // Replace with your actual messaging logic (e.g., redirect to chat)
};

export default RideHistory;
