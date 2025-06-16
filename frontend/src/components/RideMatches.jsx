import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { passengerService } from '../services/api';
import '../styles/RideMatches.css';

const RideMatches = () => {
  const { user, token } = useContext(AuthContext); // Get user and token from AuthContext
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({}); // Store form data for each match
  // const [ws, setWs] = useState(null); // WebSocket connection

  // Fetch suggested ride matches
  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const data = await passengerService.getRideMatches();
        setMatches(data);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch ride matches');
        setLoading(false);
      }
    };
    fetchMatches();
  }, []);
  
  // Handle form input changes
  const handleInputChange = (matchId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], [field]: value },
    }));
  };

  // Handle Accept action
  const handleAccept = async (matchId) => {
    const data = formData[matchId] || {};
    try {
      const response = await passengerService.acceptRideMatch(matchId, {
        pickup_location: data.pickup_location || { label: 'Default Pickup', lat: -1.284, lng: 36.817 },
        seats_requested: parseInt(data.seats_requested) || 1,
        dropoff_location: data.dropoff_location || null,
      });
      alert(response.message); // Replace with toast
      setMatches(matches.filter((match) => match.id !== matchId)); // Remove accepted match
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to accept ride match');
    }
  };

  // Handle Decline action
  const handleDecline = async (matchId) => {
    try {
      const response = await passengerService.declineRideMatch(matchId);
      alert(response.message); // Replace with toast
      setMatches(matches.filter((match) => match.id !== matchId)); // Remove declined match
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to decline ride match');
    }
  };

  if (loading) return <div className="text-center mt-8">Loading...</div>;
  if (error) return <div className="text-red-500 text-center mt-8">{error}</div>;
  if (matches.length === 0) return <div className="text-center mt-8">No ride matches available</div>;

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Suggested Ride Matches</h2>
      <div className="grid gap-4">
        {matches.map((match) => (
          <div key={match.id} className="ride-match-card p-4 border rounded-lg shadow-md">
            <h3 className="text-lg font-semibold">
              {match.ride.origin.label} to {match.ride.destination.label}
            </h3>
            <p>Driver: {match.ride.driver.fullname}</p>
            <p>Departure: {new Date(match.ride.departure_time).toLocaleString()}</p>
            <p>Fare: KES {match.ride.fare}</p>
            <p>Seats Available: {match.ride.available_seats}</p>
            <p>Women-Only: {match.ride.is_women_only ? 'Yes' : 'No'}</p>
            <p>Match Score: {(match.score * 100).toFixed(1)}%</p>

            {/* Accept Form */}
            <div className="mt-4">
              <label className="block mb-1">Pickup Location</label>
              <input
                type="text"
                placeholder="Enter pickup location"
                className="w-full p-2 border rounded mb-2"
                onChange={(e) => handleInputChange(match.id, 'pickup_location', {
                  label: e.target.value,
                  lat: -1.284, // Replace with Google Maps API integration
                  lng: 36.817,
                })}
              />
              <label className="block mb-1">Seats Requested</label>
              <input
                type="number"
                min="1"
                max={match.ride.available_seats}
                placeholder="1"
                className="w-full p-2 border rounded mb-2"
                onChange={(e) => handleInputChange(match.id, 'seats_requested', e.target.value)}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleAccept(match.id)}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleDecline(match.id)}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RideMatches;