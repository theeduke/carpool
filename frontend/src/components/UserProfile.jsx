import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { profileService } from '../services/api';
import RideHistory from "../components/RideHistory";
import '../styles/UserProfile.css';
import userImage from "../assets/images/user.png";

function UserProfile() {
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [preferences, setPreferences]= useState (null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        // const data = await fetchUserProfile();
        const { profile, preferences } = await profileService.getProfile();
        console.log("this is the profile data", profile)
        setProfile(profile);
        setPreferences(preferences);
        console.log("this is the preference data", preferences)
      } catch (err) {
        setError('Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleTopUpRedirect = () => {
    navigate('/wallet/topup');
  };

  const handleWithdrawRedirect = () => {
    navigate('/wallet-withdrawal');
  };

  const handleUpdateProfileRedirect = () => {
    navigate('/profile-update');
  };
  const handleSendMoneyRedirect = () => {
    navigate('/wallet/send-money');
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;
  if (!profile) return <div>No profile data available.</div>;

  return (
    <div className="profile-wrapper">
      <div className="profile-header">
        <img
          src={profile.profile_picture || userImage}
          alt="Profile"
          className="profile-picture"
        />
        <h2>{profile.fullname}</h2>
        <p>{profile.email}</p>
        <p>Phone: {profile.phone_number}</p>
        <p>Gender: {profile.gender || 'Not specified'}</p>
        <p>Wallet Balance: KES {(profile.wallet_balance|| 0.00).toFixed(2)}</p>
        <button onClick={handleUpdateProfileRedirect} className="update-profile-button">
          Update Profile
        </button>
      </div>

      <div className="profile-content">
       {profile.is_driver && (
          <div className="profile-section driver-section">
            <h3>Driver Information</h3>
            <p>Availability: {profile.is_available ? 'Online' : 'Offline'}</p>
            <p>Driving License: {profile.driving_license_number || 'Not provided'}</p>
            {profile.vehicle ? (
              <div className="vehicle-info">
                <h4>Vehicle</h4>
                <p>Make: {profile.vehicle.make_name}</p>
                <p>Model: {profile.vehicle.model_name}</p>
                <p>Plate Number: {profile.vehicle.plate_number}</p>
                <p>Capacity: {profile.vehicle.capacity} seats</p>
                <p>Year: {profile.vehicle.year}</p>
                <p>Color: {profile.vehicle.color}</p>
                {/* <p>Verified: {profile.vehicle.verified ? 'Yes' : 'No'}</p> */}
                {profile.vehicle.vehicle_photo && (
                  <img src={profile.vehicle.vehicle_photo} alt="Vehicle" className="vehicle-photo" />
                )}
              </div>
            ) : (
              <p>No vehicle assigned.</p>
            )}
          </div>
)}
        {/* <div className="profile-section driver-section">
          {profile.is_driver && (
            <>
              <h3>Driver Information</h3>
              <p>Availability: {profile.is_available ? 'Online' : 'Offline'}</p>
              <p>Driving License: {profile.driving_license_number || 'Not provided'}</p>
              {profile.vehicle ? (
                <div className="vehicle-info">
                  <h4>Vehicle</h4>
                  <p>Make: {profile.vehicle.make_name}</p>
                  <p>Model: {profile.vehicle.model_name}</p>
                  <p>Plate Number: {profile.vehicle.plate_number}</p>
                  <p>Capacity: {profile.vehicle.capacity} seats</p>
                  <p>Year: {profile.vehicle.year}</p>
                  <p>Color: {profile.vehicle.color}</p>
                  <p>Verified: {profile.vehicle.verified ? 'Yes' : 'No'}</p>
                  {profile.vehicle.vehicle_photo && (
                    <img src={profile.vehicle.vehicle_photo} alt="Vehicle" className="vehicle-photo" />
                  )}
                </div>
              ) : (
                <p>No vehicle assigned.</p>
              )}
            </>
          )}
        </div> */}

        <div className="profile-section ride-history">
          <h3>Ride History</h3>
          <RideHistory />
        </div>

        
        <div className="wallet-earnings-wrapper">
  <div className="profile-section wallet-section">
    <h3>Wallet</h3>
    <p>Balance: KES {(profile.wallet_balance|| 0.00).toFixed(2)}</p>
    {!profile.is_driver && (
      <div className="wallet-buttons">
        <button onClick={handleTopUpRedirect}>Top Up</button>
        <button onClick={handleSendMoneyRedirect}>Send Money</button>
      </div>
    )}
    {profile.is_driver && (
      <div className="wallet-buttons">
      <button onClick={handleWithdrawRedirect}>Withdraw</button>
      </div>
    )}
  </div>
  {profile.is_driver && (
    <div className="profile-section earnings-section">
      <h3>Earnings</h3>
      <p>Monthly Earnings: KES {(profile.monthly_earnings || 0.00).toFixed(2)}</p>
      <p>Lifetime Earnings: KES {(profile.total_earnings || 0.00).toFixed(2)}</p>
    </div>
  )}
</div>
      </div>
    </div>
  );
}

export default UserProfile;
