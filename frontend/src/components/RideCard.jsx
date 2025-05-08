import { useState, useRef } from "react";
import { passengerService, walletService } from '../services/api'; // Adjust path as needed
import { Autocomplete } from '@react-google-maps/api';
import '../styles/main.css';
import { formatPlaceLabel } from "../utils/placeUtils";

function RideCard({ ride }) {
  const [requestStatus, setRequestStatus] = useState(null); // Track request state
  const [selectedSeats, setSelectedSeats] = useState(1);
  const [pickupLocation, setPickupLocation] = useState({ label: "", lat: null, lng: null });
  console.log("this is the ride data", ride.data)

  const pickupLocationRef = useRef(null);

  const handlePickupLocationSelect = () => {
    if (pickupLocationRef.current) {
      const place = pickupLocationRef.current.getPlace();
      if (place && place.geometry) {
        const label = formatPlaceLabel(place);
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setPickupLocation({label, lat, lng});
      }
    }
  };

  const handleRequestToJoin = async () => {
    try {
      const rideData = {
        ride: ride.carpoolride_id, // Use carpoolride_id as per data
        seats_requested: selectedSeats,
        pickup_location: pickupLocation,
      };
      console.log("Sending request with data:", rideData);
      const response = await passengerService.requestToJoin(rideData);
      setRequestStatus("Request sent successfully!");
    } catch (error) {
      console.error("Error requesting ride:", error);
      setRequestStatus("Failed to send request: " + (error.response?.data?.error || "Unknown error"));
    }
  };

  const handlePayRide = async () => {
    try {
      // Use carpoolride_id since ride_id or id might not exist
      await walletService.payForRide(ride.carpoolride_id);
      alert("Ride paid successfully!");
    } catch (error) {
      console.error("Error paying for ride:", error);
      alert("Payment failed: " + (error.response?.data?.error || "Unknown error"));
    }
  };

  return (
    <div className="ride-card">
      <p className="ride-detail"><strong>Pickup:</strong> {ride.origin?.label || "Unknown"}</p>
      <p className="ride-detail"><strong>Destination:</strong> {ride.destination?.label || "Unknown"}</p>
      <p className="ride-detail"><strong>Driver:</strong> {ride.driver_name || "ID: " + (ride.driver.full_name || "Unknown")}</p>
      <p className="ride-detail"><strong>Car:</strong> {ride.car_details || (ride.vehicle ? "Vehicle Available" : "No vehicle details")}</p>
      <p className="ride-detail"><strong>Departure:</strong> {ride.departure_time ? new Date(ride.departure_time).toLocaleString() : "Unknown"}</p>
      <p className="ride-detail"><strong>Seats Available:</strong> {ride.available_seats || 0}</p>
      <p className="ride-detail"><strong>Contribution per Seat:</strong> ${ride.contribution_per_seat || "N/A"}</p>
      <p className="ride-detail"><strong>Women-Only:</strong> {ride.is_women_only ? "Yes" : "No"}</p>
      {/* Show request form if ride is not cancelled or completed */}
      {!ride.is_cancelled && !ride.is_completed && (
        <>
          <label>
            Seats Requested:
            <input
              type="number"
              value={selectedSeats}
              onChange={(e) => setSelectedSeats(Number(e.target.value))}
              min="1"
              max={ride.available_seats || 1}
              className="driver-form-input"
            />
          </label>
          <br />
          <label>
            Pickup Location:
            <Autocomplete
              onLoad={(autocomplete) => (pickupLocationRef.current = autocomplete)}
              onPlaceChanged={handlePickupLocationSelect}
            >
            <input
              type="text"
              // value={pickupLocation}
              value={pickupLocation?.label || ""}
              onChange={(e) => setPickupLocation({ ...pickupLocation, label: e.target.value })}
              placeholder="Enter pickup location"
              className="driver-form-input"
            />
            </Autocomplete>
          </label>
          <br />
          <button
            onClick={handleRequestToJoin}
            disabled={requestStatus === "Request sent successfully!"}
            className="ride-button"
          >
            {requestStatus === "Request sent successfully!" ? "Requested" : "Request to Join"}
          </button>
          {requestStatus && (
            <p className={requestStatus.includes("Failed") ? "error-status" : "request-status"}>
              {requestStatus}
            </p>
          )}
        </>
      )}
      <button onClick={handlePayRide} className="ride-button">Pay for Ride</button>
    </div>
  );
}

export default RideCard;
