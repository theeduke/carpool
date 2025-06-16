import { useState, useEffect, useRef, useContext } from 'react';
import { passengerService, walletService} from '../services/api';
import { Autocomplete } from '@react-google-maps/api';
import { formatPlaceLabel } from '../utils/placeUtils';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { toast } from "react-toastify";
import '../styles/global.css';

function RideCard({ ride, userRequests }) {
  const { user } = useContext(AuthContext);
  const [requestStatus, setRequestStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [seatsRequested, setSeatsRequested] = useState(1);
  const [pickupLocation, setPickupLocation] = useState({ label: '', lat: null, lng: null });
  const [walletBalance, setWalletBalance] = useState(null);
  const [balanceChecked, setBalanceChecked] = useState(false);
  const [localRequests, setLocalRequests] = useState(userRequests);
  const pickupRef = useRef(null);
  const wsRef = useRef(null);
  const navigate = useNavigate();

  // Calculate total ride cost
  const totalRideCost = (ride.contribution_per_seat || 0) * seatsRequested;

  // Check wallet balance
  const checkWalletBalance = async () => {
    try {
      const response = await walletService.getWalletBalance();
      setWalletBalance(response.balance || 0);
      setBalanceChecked(true);
    } catch (err) {
      console.error('Error fetching wallet balance:', err);
      const errorMessage = err.response?.data?.error || err.message;
      setError(`Failed to check wallet balance: ${errorMessage}`);
      setWalletBalance(0);
      setBalanceChecked(true);
    }
  };

  // Check request status
  const checkRequestStatus = () => {
    setLoading(true);
    setError(null);
    try {
      if (!Array.isArray(localRequests)) {
        console.warn('localRequests is not an array:', localRequests);
        setRequestStatus('none');
        return;
      }
      const rideRequest = localRequests.find(
        (req) => (req.ride === ride.carpoolride_id || req.ride?.carpoolride_id === ride.carpoolride_id)
      );
      if (rideRequest) {
        setRequestStatus(rideRequest.status);
      } else {
        setRequestStatus('none');
      }
    } catch (err) {
      console.error('Error checking ride requests:', err);
      setError('Failed to check request status: ' + err.message);
      setRequestStatus('none');
    } finally {
      setLoading(false);
    }
  };

  // Setup WebSocket
  const setupWebSocket = () => {
    if (!user?.id) return;

    const token = localStorage.getItem("access_token");
    if (!token) {
      console.error("No JWT token found for WebSocket connection");
      setError("Authentication error: Please log in again.");
      return;
    }
    const backendWsUrl = import.meta.env.VITE_BACKEND_WSREQUEST_URL || "ws://127.0.0.1:8001";
    const wsUrl = `${backendWsUrl}/ws/notifications/user_${user.id}/?token=${token}`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected for notifications');
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.notification_type === 'declined' && data.carpoolride_id === ride.carpoolride_id) {
          setLocalRequests((prev) => {
            const updated = prev.map((req) =>
              (req.ride === ride.carpoolride_id || req.ride?.carpoolride_id === ride.carpoolride_id)
                ? { ...req, status: 'declined' }
                : req
            );
            return updated.length ? updated : [...prev, {
              ride: ride.carpoolride_id,
              riderequest_id: data.notification_id,
              status: 'declined'
            }];
          });
          setRequestStatus('declined');
          setError(data.message);
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
      }
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket closed, attempting reconnect...');
      setTimeout(setupWebSocket, 3000);
    };

    wsRef.current.onerror = (err) => {
      console.error('WebSocket error:', err);
      wsRef.current.close();
    };
  };

  useEffect(() => {
    checkRequestStatus();
    checkWalletBalance();
    setupWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [ride.carpoolride_id, localRequests]);

  useEffect(() => {
    setLocalRequests(userRequests);
    checkRequestStatus();
  }, [userRequests]);

  // Handle place selection from Autocomplete
  const handlePlaceSelect = () => {
    if (pickupRef.current) {
      const place = pickupRef.current.getPlace();
      if (place && place.geometry) {
        const label = formatPlaceLabel(place);
        const location = {
          label,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };
        setPickupLocation(location);
        console.log('Selected pickup location:', location);
      }
    }
  };

  const handleRequestRide = async () => {
    if (!pickupLocation.label) {
      setError('Please select a pickup location.');
      return;
    }

    if (walletBalance < totalRideCost) {
      const shortfall = totalRideCost - walletBalance;
      setError(
        `Insufficient balance. You need at least KES ${totalRideCost.toFixed(2)} for this ride. ` +
        `Please top up at least KES ${shortfall.toFixed(2)} to proceed.`
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await passengerService.requestToJoin({
        ride: ride.carpoolride_id,
        pickup_location: pickupLocation,
        seats_requested: seatsRequested,
      });
      setRequestStatus('pending');
      toast.success("Ride request sent");
      // alert('Ride requested successfully!');
    } catch (err) {
      console.error('Error requesting ride:', err);
      let errorMessage = 'Failed to request ride.';
      if (err.response?.data) {
        if (Array.isArray(err.response.data.non_field_errors) && err.response.data.non_field_errors.length > 0) {
          errorMessage = err.response.data.non_field_errors[0];
        } else if (Array.isArray(err.response.data) && err.response.data[0]) {
          errorMessage = err.response.data[0];
        } else if (err.response.data.error) {
          errorMessage = err.response.data.error;
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle top-up redirection with ride context
  const handleTopUpRedirect = () => {
    navigate('/wallet/topup', { state: { from: 'ride', rideId: ride.carpoolride_id } });
  };

  // Format date and time
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

  // Format vehicle details
  const formatVehicleDetails = (vehicle) => {
    if (!vehicle) return 'No vehicle details';
    const { make_name, model_name, plate_number, color, year, capacity } = vehicle;
    return `${make_name || ''} ${model_name || ''} (${year || ''}), ${color || ''}, Plate: ${plate_number || 'N/A'}, Capacity: ${capacity || 'N/A'}`;
  };

  return (
    <div className="ride-card">
      <p><strong>Driver's origin:</strong> {ride.origin?.label || 'N/A'}</p>
      <p><strong>Destination:</strong> {ride.destination?.label || 'N/A'}</p>
      <p><strong>Driver:</strong> {ride.driver_name || 'Unknown'}</p>
      <p><strong>Driver's contact:</strong> {ride.driver_number || 'Unknown'}</p>
      <p><strong>Car:</strong> {formatVehicleDetails(ride.vehicle)}</p>
      <p><strong>Departure:</strong> {formatDateTime(ride.departure_time)}</p>
      <p><strong>Seats Still Available:</strong> {ride.available_seats || 'N/A'}</p>
      <p><strong>Contribution per Seat:</strong> KES {parseFloat(ride.contribution_per_seat || 0).toFixed(2)}</p>
      <p><strong>Total Cost ({seatsRequested} seat{seatsRequested > 1 ? 's' : ''}):</strong> KES {totalRideCost.toFixed(2)}</p>
      <p><strong>Women-Only:</strong> {ride.is_women_only ? 'Yes' : 'No'}</p>
      {balanceChecked && walletBalance !== null && (
        <p><strong>Wallet Balance:</strong> KES {walletBalance.toFixed(2)}</p>
      )}
      {requestStatus === 'none' && !loading && (
        <>
          <label>
            <strong>Seats Requested:</strong>
            <input
              type="number"
              min="1"
              max={ride.available_seats || 1}
              value={seatsRequested}
              onChange={(e) => setSeatsRequested(parseInt(e.target.value) || 1)}
              className="search-input"
              disabled={loading}
            />
          </label>
          <label>
            <strong>Pickup Location:</strong>
            <Autocomplete
              onLoad={(autocomplete) => {
                pickupRef.current = autocomplete;
                autocomplete.setComponentRestrictions({ country: 'ke' });
              }}
              onPlaceChanged={handlePlaceSelect}
            >
              <input
                type="text"
                placeholder="Enter your pickup location"
                value={pickupLocation.label}
                onChange={(e) => setPickupLocation({ ...pickupLocation, label: e.target.value })}
                className="search-input"
                disabled={loading}
              />
            </Autocomplete>
          </label>
          {balanceChecked && walletBalance < totalRideCost && (
            <p style={{ color: 'red' }}>
              Insufficient balance.{' '}
              <button
                onClick={handleTopUpRedirect}
                className="topup-link"
                style={{ display: 'inline', color: 'blue', textDecoration: 'underline', cursor: 'pointer' }}
              >
                Top up at least KES {(totalRideCost - walletBalance).toFixed(2)} to proceed.
              </button>
            </p>
          )}
          <button
            onClick={handleRequestRide}
            disabled={loading || !pickupLocation.label || walletBalance < totalRideCost}
            className="request-button"
          >
            Request to Join
          </button>
        </>
      )}
      {requestStatus === 'pending' && (
        <p><strong>Status:</strong> Ride request pending</p>
      )}
      {requestStatus === 'canceled' && (
        <p><strong>Status:</strong> You previously cancelled a request for this ride.</p>
      )}
      {requestStatus === 'declined' && (
        <p><strong>Status:</strong> Your request for this ride was declined by the driver.</p>
      )}
      {loading && <p>Checking request status...</p>}
      {error && (
        <div>
          <p style={{ color: 'red' }}>{error}</p>
          {error.includes('Insufficient balance') && (
            <button
              onClick={handleTopUpRedirect}
              className="topup-link"
              style={{ display: 'inline', color: 'blue', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Top Up Now
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default RideCard;
