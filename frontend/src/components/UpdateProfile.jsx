import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileService } from '../services/api';
import '../styles/UpdateProfile.css';

const UpdateProfile = () => {
  const [profile, setProfile] = useState({
    fullname: '',
    phone_number: '',
    gender: '',
    is_driver: '',
    profile_picture: null,
    vehicle: {
      plate_number: '',
      capacity: '',
      year: '',
      color: '',
      vehicle_photo: null,
    },
  });
  const [preferences, setPreferences] = useState({
    prefers_women_only_rides: false,
    email_notifications: true,
    push_notifications: true,
  });
  const [previewImage, setPreviewImage] = useState(null);
  const [vehiclePreviewImage, setVehiclePreviewImage] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await profileService.getProfile();
        setProfile({
          fullname: response.profile.fullname,
          phone_number: response.profile.phone_number,
          gender: response.profile.gender || '',
          profile_picture: null,
          is_driver: response.profile.is_driver,
          vehicle: response.profile.vehicle || {
            plate_number: '',
            capacity: '',
            year: '',
            color: '',
            vehicle_photo: null,
          },
        });
        setPreferences(response.preferences);
        if (response.profile.profile_picture) {
          setPreviewImage(response.profile.profile_picture);
        }
        if (response.profile.vehicle?.vehicle_photo) {
          setVehiclePreviewImage(response.profile.vehicle.vehicle_photo);
        }
      } catch (err) {
        setError('Failed to load profile data');
      }
    };
    fetchProfile();
  }, []);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleVehicleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({
      ...prev,
      vehicle: { ...prev.vehicle, [name]: value },
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfile((prev) => ({ ...prev, profile_picture: file }));
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  const handleVehicleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfile((prev) => ({
        ...prev,
        vehicle: { ...prev.vehicle, vehicle_photo: file },
      }));
      setVehiclePreviewImage(URL.createObjectURL(file));
    }
  };

  const handlePreferencesChange = (e) => {
    const { name, checked } = e.target;
    setPreferences((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const profileData = {
        phone_number: profile.phone_number,
        ...(profile.profile_picture && { profile_picture: profile.profile_picture }),
        ...(profile.vehicle && profile.vehicle.plate_number && { vehicle: profile.vehicle }),
      };
      await profileService.updateProfile(profileData);
      console.log("this is the profileData", profileData)

      await profileService.updatePreferences(preferences);
      setSuccess('Profile and preferences updated successfully');
      setTimeout(() => {
        navigate('/profile');
      }, 1500);
    } catch (err) {
      setError(
        err.response?.data?.error ||
        'Failed to update profile or preferences'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-container">
      <h2>Update Profile</h2>
      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}
      <form onSubmit={handleSubmit} className="profile-form">
        {/* Personal Information */}
        <div className="form-section">
          <h3>Personal Information</h3>
          <div className="form-group">
            <label>Full Name</label>
            <p className="read-only">{profile.fullname}</p>
          </div>
          <div className="form-group">
            <label>Gender</label>
            <p className="read-only">{profile.gender || 'Not specified'}</p>
          </div>
          <div className="form-group">
            <label htmlFor="phone_number">Phone Number</label>
            <input
              type="tel"
              id="phone_number"
              name="phone_number"
              value={profile.phone_number}
              onChange={handleProfileChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="profile_picture">Profile Picture</label>
            <input
              type="file"
              id="profile_picture"
              accept="image/*"
              onChange={handleFileChange}
            />
            {previewImage && (
              <img
                src={previewImage}
                alt="Profile Preview"
                className="profile-preview"
              />
            )}
          </div>
        </div>

        {/* Vehicle Information (only for drivers) */}
        
        {profile.is_driver && profile.vehicle && (
          <div className="form-section vehicle-update-section">
            <h3>Vehicle Information</h3>
            <div className="form-group">
              <label htmlFor="plate_number">Plate Number</label>
              <input
                type="text"
                id="plate_number"
                name="plate_number"
                value={profile.vehicle.plate_number}
                onChange={handleVehicleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="capacity">Capacity</label>
              <input
                type="number"
                id="capacity"
                name="capacity"
                value={profile.vehicle.capacity}
                onChange={handleVehicleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="year">Year</label>
              <input
                type="number"
                id="year"
                name="year"
                value={profile.vehicle.year}
                onChange={handleVehicleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="color">Color</label>
              <input
                type="text"
                id="color"
                name="color"
                value={profile.vehicle.color}
                onChange={handleVehicleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="vehicle_photo">Vehicle Photo</label>
              <input
                type="file"
                id="vehicle_photo"
                accept="image/*"
                onChange={handleVehicleFileChange}
              />
              {vehiclePreviewImage && (
                <img
                  src={vehiclePreviewImage}
                  alt="Vehicle Preview"
                  className="vehicle-photo-preview"
                />
              )}
            </div>
          </div>
        )}
      

        {/* Preferences */}
        <div className="form-section">
          <h3>Preferences</h3>
          <div className="form-group checkbox-group">
            <input
              type="checkbox"
              id="prefers_women_only_rides"
              name="prefers_women_only_rides"
              checked={preferences.prefers_women_only_rides}
              onChange={handlePreferencesChange}
              disabled={profile.gender !== 'female'}
            />
            <label htmlFor="prefers_women_only_rides">
              Prefer women-only rides
              {profile.gender !== 'female' && (
                <span className="disabled-text">
                  {' '} (Available for female users only)
                </span>
              )}
            </label>
          </div>
          <div className="form-group checkbox-group">
            <input
              type="checkbox"
              id="email_notifications"
              name="email_notifications"
              checked={preferences.email_notifications}
              onChange={handlePreferencesChange}
            />
            <label htmlFor="email_notifications">
              Receive email notifications
            </label>
          </div>
          <div className="form-group checkbox-group">
            <input
              type="checkbox"
              id="push_notifications"
              name="push_notifications"
              checked={preferences.push_notifications}
              onChange={handlePreferencesChange}
            />
            <label htmlFor="push_notifications">
              Receive push notifications
            </label>
          </div>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
};

export default UpdateProfile;


// import { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { profileService } from '../services/api';
// import '../styles/UpdateProfile.css';

// const UpdateProfile = () => {
//   const [profile, setProfile] = useState({
//     fullname: '',
//     phone_number: '',
//     gender: '',
//     profile_picture: null,
//   });
//   const [preferences, setPreferences] = useState({
//     prefers_women_only_rides: false,
//     email_notifications: true,
//     push_notifications: true,
//   });
//   const [previewImage, setPreviewImage] = useState(null);
//   const [error, setError] = useState('');
//   const [success, setSuccess] = useState('');
//   const [loading, setLoading] = useState(false);
//   const navigate = useNavigate();

//   useEffect(() => {
//     const fetchProfile = async () => {
//       try {
//         const response = await profileService.getProfile();
//         console.log("this is the profile data", response)
//         setProfile({
//           fullname: response.profile.fullname,
//           phone_number: response.profile.phone_number,
//           gender: response.profile.gender || '',
//           profile_picture: null,
//         });
//         setPreferences(response.preferences);
//         if (response.profile.profile_picture) {
//           setPreviewImage(response.profile.profile_picture);
//         }
//       } catch (err) {
//         setError('Failed to load profile data');
//       }
//     };
//     fetchProfile();
//   }, []);

//   const handleProfileChange = (e) => {
//     const { name, value } = e.target;
//     setProfile((prev) => ({ ...prev, [name]: value }));
//   };

//   const handleFileChange = (e) => {
//     const file = e.target.files[0];
//     if (file) {
//       setProfile((prev) => ({ ...prev, profile_picture: file }));
//       setPreviewImage(URL.createObjectURL(file));
//     }
//   };

//   const handlePreferencesChange = (e) => {
//     const { name, checked } = e.target;
//     setPreferences((prev) => ({ ...prev, [name]: checked }));
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError('');
//     setSuccess('');
//     setLoading(true);

//     try {
//       // Update profile (only phone_number and profile_picture)
//       const profileData = {
//         phone_number: profile.phone_number,
//         ...(profile.profile_picture && { profile_picture: profile.profile_picture }),
//       };
//       await profileService.updateProfile(profileData);

//       // Update preferences
//       await profileService.updatePreferences(preferences);
//       setSuccess('Profile and preferences updated successfully');
//       // Redirect to profile page after a short delay to show success message
//       setTimeout(() => {
//         navigate('/profile');
//       }, 1500);
//     } catch (err) {
//       setError(
//         err.response?.data?.error ||
//         'Failed to update profile or preferences'
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="profile-container">
//       <h2>Update Profile</h2>
//       {error && <div className="alert error">{error}</div>}
//       {success && <div className="alert success">{success}</div>}
//       <form onSubmit={handleSubmit} className="profile-form">
//         {/* Personal Information */}
//         <div className="form-section">
//           <h3>Personal Information</h3>
//           <div className="form-group">
//             <label>Full Name</label>
//             <p className="read-only">{profile.fullname}</p>
//           </div>
//           <div className="form-group">
//             <label>Gender</label>
//             <p className="read-only">{profile.gender || 'Not specified'}</p>
//           </div>
//           <div className="form-group">
//             <label htmlFor="phone_number">Phone Number</label>
//             <input
//               type="tel"
//               id="phone_number"
//               name="phone_number"
//               value={profile.phone_number}
//               onChange={handleProfileChange}
//               required
//             />
//           </div>
//           <div className="form-group">
//             <label htmlFor="profile_picture">Profile Picture</label>
//             <input
//               type="file"
//               id="profile_picture"
//               accept="image/*"
//               onChange={handleFileChange}
//             />
//             {previewImage && (
//               <img
//                 src={previewImage}
//                 alt="Profile Preview"
//                 className="profile-preview"
//               />
//             )}
//           </div>
//         </div>

//         {/* Preferences */}
//         <div className="form-section">
//           <h3>Preferences</h3>
//           <div className="form-group checkbox-group">
//             <input
//               type="checkbox"
//               id="prefers_women_only_rides"
//               name="prefers_women_only_rides"
//               checked={preferences.prefers_women_only_rides}
//               onChange={handlePreferencesChange}
//               disabled={profile.gender !== 'female'}
//             />
//             <label htmlFor="prefers_women_only_rides">
//               Prefer women-only rides
//               {profile.gender !== 'female' && (
//                 <span className="disabled-text">
//                   {' '}
//                   (Available for female users only)
//                 </span>
//               )}
//             </label>
//           </div>
//           <div className="form-group checkbox-group">
//             <input
//               type="checkbox"
//               id="email_notifications"
//               name="email_notifications"
//               checked={preferences.email_notifications}
//               onChange={handlePreferencesChange}
//             />
//             <label htmlFor="email_notifications">
//               Receive email notifications
//             </label>
//           </div>
//           <div className="form-group checkbox-group">
//             <input
//               type="checkbox"
//               id="push_notifications"
//               name="push_notifications"
//               checked={preferences.push_notifications}
//               onChange={handlePreferencesChange}
//             />
//             <label htmlFor="push_notifications">
//               Receive push notifications
//             </label>
//           </div>
//         </div>

//         <button type="submit" disabled={loading}>
//           {loading ? 'Saving...' : 'Save Changes'}
//         </button>
//       </form>
//     </div>
//   );
// };

// export default UpdateProfile;