import { useState, useEffect, useRef } from 'react';
import { driverService } from '../services/api';
import '../styles/DriverRegister.css';

function DriverRegister() {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    password: '',
    password2: '',
    is_driver: true,
    gender: '',
    id_verification_front: null,
    id_verification_back: null,
    driving_license_number: '',
    driving_license_file: null,
    vehicle: {
      make_id: '',
      model_id: '',
      plate_number: '',
      capacity: 4,
      year: '',
      color: '',
      vehicle_photo: null,
    },
  });
  const [vehicleMakes, setVehicleMakes] = useState([]);
  const [vehicleModels, setVehicleModels] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

  const idVerificationFrontRef = useRef(null);
  const idVerificationBackRef = useRef(null);
  const licenseFileRef = useRef(null);
  const vehiclePhotoRef = useRef(null);

  // Fetch vehicle makes on mount
  useEffect(() => {
    const fetchMakes = async () => {
      try {
        const makes = await driverService.getVehicleMakes();
        setVehicleMakes(makes);
      } catch (err) {
        console.error('Error fetching vehicle makes:', err);
        setError('Failed to load vehicle makes.');
      }
    };
    fetchMakes();
  }, []);

  // Fetch vehicle models when make is selected
  useEffect(() => {
    if (formData.vehicle.make_id) {
      const fetchModels = async () => {
        try {
          const models = await driverService.getVehicleModels(formData.vehicle.make_id);
          setVehicleModels(models);
        } catch (err) {
          console.error('Error fetching vehicle models:', err);
          setError('Failed to load vehicle models.');
        }
      };
      fetchModels();
    } else {
      setVehicleModels([]);
    }
  }, [formData.vehicle.make_id]);

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    if (name.startsWith('vehicle.')) {
      const field = name.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        vehicle: {
          ...prev.vehicle,
          [field]: type === 'file' ? files[0] : type === 'number' ? parseInt(value) || '' : value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === 'file' ? files[0] : value,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate passwords match
    if (formData.password !== formData.password2) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    // Create FormData for file uploads
    const formDataToSend = new FormData();
    for (const [key, value] of Object.entries(formData)) {
      if (key === 'vehicle') {
        for (const [vehicleKey, vehicleValue] of Object.entries(value)) {
          if (vehicleValue !== null && vehicleValue !== '') {
            formDataToSend.append(`vehicle.${vehicleKey}`, vehicleValue);
          }
        }
      } else if (value !== null && value !== '') {
        formDataToSend.append(key, value);
      }
    }

    try {
      await driverService.register(formDataToSend);
      alert('Registration successful! Check your email to verify.');
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone_number: '',
        password: '',
        password2: '',
        is_driver: true,
        gender: '',
        id_verification_front: null,
        id_verification_back: null,
        driving_license_number: '',
        driving_license_file: null,
        vehicle: {
          make_id: '',
          model_id: '',
          plate_number: '',
          capacity: 4,
          year: '',
          color: '',
          vehicle_photo: null,
        },
      });
      // Reset file inputs
      idVerificationFrontRef.current.value = '';
      idVerificationBackRef.current.value = '';
      licenseFileRef.current.value = '';
      vehiclePhotoRef.current.value = '';
    } catch (err) {
      console.error('Error registering driver:', err);
      setError(err.response?.data?.error || 'Failed to register. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field) => {
    if (field === 'password') {
      setShowPassword(!showPassword);
    } else {
      setShowPassword2(!showPassword2);
    }
  };

  return (
    <div className="register-form">
      <h2>Driver Registration</h2>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit} encType="multipart/form-data">
        <input
          type="text"
          name="first_name"
          placeholder="First Name"
          value={formData.first_name}
          onChange={handleChange}
          required
        />
        <input
          type="text"
          name="last_name"
          placeholder="Last Name"
          value={formData.last_name}
          onChange={handleChange}
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
        />
        <input
          type="tel"
          name="phone_number"
          placeholder="Phone Number"
          value={formData.phone_number}
          onChange={handleChange}
          required
        />
        <div className="password-container">
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />
          <span
            className="password-toggle"
            onClick={() => togglePasswordVisibility('password')}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex="0"
            onKeyDown={(e) => e.key === 'Enter' && togglePasswordVisibility('password')}
          >
            <i className={showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
          </span>
        </div>
        <div className="password-container">
          <input
            type={showPassword2 ? 'text' : 'password'}
            name="password2"
            placeholder="Confirm Password"
            value={formData.password2}
            onChange={handleChange}
            required
          />
          <span
            className="password-toggle"
            onClick={() => togglePasswordVisibility('password2')}
            aria-label={showPassword2 ? 'Hide confirm password' : 'Show confirm password'}
            tabIndex="0"
            onKeyDown={(e) => e.key === 'Enter' && togglePasswordVisibility('password2')}
          >
            <i className={showPassword2 ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
          </span>
        </div>
        <select
          name="gender"
          value={formData.gender}
          onChange={handleChange}
        >
          <option value="">Select Gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
        <label className="file-label">ID Verification (Front)</label>
        <input
          type="file"
          name="id_verification_front"
          onChange={handleChange}
          accept=".pdf,.jpg,.jpeg,.png"
          required
          ref={idVerificationFrontRef}
        />
        <label className="file-label">ID Verification (Back)</label>
        <input
          type="file"
          name="id_verification_back"
          onChange={handleChange}
          accept=".pdf,.jpg,.jpeg,.png"
          required
          ref={idVerificationBackRef}
        />
        <input
          type="text"
          name="driving_license_number"
          placeholder="Driving License Number"
          value={formData.driving_license_number}
          onChange={handleChange}
          required
        />
        <label className="file-label">Driver’s License (Front)</label>
        <input
          type="file"
          name="driving_license_file"
          onChange={handleChange}
          accept=".pdf,.jpg,.jpeg,.png"
          required
          ref={licenseFileRef}
        />
        <select
          name="vehicle.make_id"
          value={formData.vehicle.make_id}
          onChange={handleChange}
          required
        >
          <option value="">Select Vehicle Make</option>
          {vehicleMakes.map((make) => (
            <option key={make.id} value={make.id}>
              {make.name}
            </option>
          ))}
        </select>
        <select
          name="vehicle.model_id"
          value={formData.vehicle.model_id}
          onChange={handleChange}
          required
          disabled={!formData.vehicle.make_id}
        >
          <option value="">Select Vehicle Model</option>
          {vehicleModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="vehicle.plate_number"
          placeholder="Plate Number"
          value={formData.vehicle.plate_number}
          onChange={handleChange}
          required
        />
        <input
          type="number"
          name="vehicle.capacity"
          placeholder="Capacity"
          value={formData.vehicle.capacity}
          onChange={handleChange}
          min="1"
          required
        />
        <input
          type="number"
          name="vehicle.year"
          placeholder="Year"
          value={formData.vehicle.year}
          onChange={handleChange}
          min="1900"
          max="2025"
          required
        />
        <input
          type="text"
          name="vehicle.color"
          placeholder="Color"
          value={formData.vehicle.color}
          onChange={handleChange}
          required
        />
        <label className="file-label">Vehicle Photo (Optional)</label>
        <input
          type="file"
          name="vehicle.vehicle_photo"
          onChange={handleChange}
          accept=".jpg,.jpeg,.png"
          ref={vehiclePhotoRef}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>
    </div>
  );
}

export default DriverRegister;



// import { useState, useEffect } from 'react';
// import { driverService, authService } from '../services/api';
// import '../styles/DriverRegister.css';

// function DriverRegister() {
//   const [formData, setFormData] = useState({
//     first_name: '',
//     last_name: '',
//     email: '',
//     phone_number: '',
//     password: '',
//     is_driver: false,
//     gender: '',
//     id_verification: null,
//     driving_license_number: '',
//     driving_license_file: null,
//     vehicle: {
//       make_id: '',
//       model_id: '',
//       plate_number: '',
//       capacity: 4,
//       year: '',
//       color: '',
//       vehicle_photo: null,
//     },
//   });
//   const [vehicleMakes, setVehicleMakes] = useState([]);
//   const [vehicleModels, setVehicleModels] = useState([]);
//   const [error, setError] = useState(null);
//   const [loading, setLoading] = useState(false);

//   // Fetch vehicle makes on mount
//   useEffect(() => {
//     const fetchMakes = async () => {
//       try {
//         const makes = await driverService.getVehicleMakes();
//         setVehicleMakes(makes);
//       } catch (err) {
//         console.error('Error fetching vehicle makes:', err);
//         setError('Failed to load vehicle makes.');
//       }
//     };
//     fetchMakes();
//   }, []);

//   // Fetch vehicle models when make is selected
//   useEffect(() => {
//     if (formData.vehicle.make_id) {
//       const fetchModels = async () => {
//         try {
//           const models = await driverService.getVehicleModels(formData.vehicle.make_id);
//           setVehicleModels(models);
//         } catch (err) {
//           console.error('Error fetching vehicle models:', err);
//           setError('Failed to load vehicle models.');
//         }
//       };
//       fetchModels();
//     } else {
//       setVehicleModels([]);
//     }
//   }, [formData.vehicle.make_id]);

//   const handleChange = (e) => {
//     const { name, value, type, checked, files } = e.target;
//     if (name.startsWith('vehicle.')) {
//       const field = name.split('.')[1];
//       setFormData((prev) => ({
//         ...prev,
//         vehicle: {
//           ...prev.vehicle,
//           [field]: type === 'file' ? files[0] : type === 'number' ? parseInt(value) || '' : value,
//         },
//       }));
//     } else {
//       setFormData((prev) => ({
//         ...prev,
//         [name]: type === 'file' ? files[0] : type === 'checkbox' ? checked : value,
//       }));
//     }
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setLoading(true);
//     setError(null);

//     // Create FormData for file uploads
//     const formDataToSend = new FormData();
//     for (const [key, value] of Object.entries(formData)) {
//       if (key === 'vehicle') {
//         for (const [vehicleKey, vehicleValue] of Object.entries(value)) {
//           if (vehicleValue !== null && vehicleValue !== '') {
//             formDataToSend.append(`vehicle.${vehicleKey}`, vehicleValue);
//           }
//         }
//       } else if (value !== null && value !== '') {
//         formDataToSend.append(key, value);
//       }
//     }

//     try {
//       await authService.registerDriver(formDataToSend);
//       alert('Registration successful!');
//       setFormData({
//         first_name: '',
//         last_name: '',
//         email: '',
//         phone_number: '',
//         password: '',
//         is_driver: false,
//         gender: '',
//         id_verification: null,
//         driving_license_number: '',
//         driving_license_file: null,
//         vehicle: {
//           make_id: '',
//           model_id: '',
//           plate_number: '',
//           capacity: 4,
//           year: '',
//           color: '',
//           vehicle_photo: null,
//         },
//       });
//     } catch (err) {
//       console.error('Error registering user:', err);
//       setError(err.response?.data?.error || 'Failed to register. Please try again.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="register-form">
//       <h2>Register</h2>
//       {error && <p className="error">{error}</p>}
//       <form onSubmit={handleSubmit} encType="multipart/form-data">
//         <input
//           type="text"
//           name="first_name"
//           placeholder="First Name"
//           value={formData.first_name}
//           onChange={handleChange}
//           required
//         />
//         <input
//           type="text"
//           name="last_name"
//           placeholder="Last Name"
//           value={formData.last_name}
//           onChange={handleChange}
//           required
//         />
//         <input
//           type="email"
//           name="email"
//           placeholder="Email"
//           value={formData.email}
//           onChange={handleChange}
//           required
//         />
//         <input
//           type="tel"
//           name="phone_number"
//           placeholder="Phone Number"
//           value={formData.phone_number}
//           onChange={handleChange}
//           required
//         />
//         <input
//           type="password"
//           name="password"
//           placeholder="Password"
//           value={formData.password}
//           onChange={handleChange}
//           required
//         />
//         <select
//           name="gender"
//           value={formData.gender}
//           onChange={handleChange}
//         >
//           <option value="">Select Gender</option>
//           <option value="male">Male</option>
//           <option value="female">Female</option>
//           <option value="other">Other</option>
//         </select>
//         <label>
//           <input
//             type="checkbox"
//             name="is_driver"
//             checked={formData.is_driver}
//             onChange={handleChange}
//           />
//           Register as Driver
//         </label>

//         {formData.is_driver && (
//           <>
//             <input
//               type="file"
//               name="id_verification"
//               onChange={handleChange}
//               accept=".pdf,.jpg,.jpeg,.png"
//               required
//             />
//             <input
//               type="text"
//               name="driving_license_number"
//               placeholder="Driving License Number"
//               value={formData.driving_license_number}
//               onChange={handleChange}
//               required
//             />
//             <input
//               type="file"
//               name="driving_license_file"
//               onChange={handleChange}
//               accept=".pdf,.jpg,.jpeg,.png"
//               required
//             />
//             <select
//               name="vehicle.make_id"
//               value={formData.vehicle.make_id}
//               onChange={handleChange}
//               required
//             >
//               <option value="">Select Vehicle Make</option>
//               {vehicleMakes.map((make) => (
//                 <option key={make.id} value={make.id}>
//                   {make.name}
//                 </option>
//               ))}
//             </select>
//             <select
//               name="vehicle.model_id"
//               value={formData.vehicle.model_id}
//               onChange={handleChange}
//               required
//               disabled={!formData.vehicle.make_id}
//             >
//               <option value="">Select Vehicle Model</option>
//               {vehicleModels.map((model) => (
//                 <option key={model.id} value={model.id}>
//                   {model.name}
//                 </option>
//               ))}
//             </select>
//             <input
//               type="text"
//               name="vehicle.plate_number"
//               placeholder="Plate Number"
//               value={formData.vehicle.plate_number}
//               onChange={handleChange}
//               required
//             />
//             <input
//               type="number"
//               name="vehicle.capacity"
//               placeholder="Capacity"
//               value={formData.vehicle.capacity}
//               onChange={handleChange}
//               min="1"
//               required
//             />
//             <input
//               type="number"
//               name="vehicle.year"
//               placeholder="Year"
//               value={formData.vehicle.year}
//               onChange={handleChange}
//               min="1900"
//               max="2025"
//               required
//             />
//             <input
//               type="text"
//               name="vehicle.color"
//               placeholder="Color"
//               value={formData.vehicle.color}
//               onChange={handleChange}
//               required
//             />
//             <input
//               type="file"
//               name="vehicle.vehicle_photo"
//               onChange={handleChange}
//               accept=".jpg,.jpeg,.png"
//             />
//           </>
//         )}
//         <button type="submit" disabled={loading}>
//           {loading ? 'Registering...' : 'Register'}
//         </button>
//       </form>
//     </div>
//   );
// }

// export default DriverRegister;