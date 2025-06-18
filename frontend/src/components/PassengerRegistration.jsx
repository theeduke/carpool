import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import '../styles/PassengerRegistration.css';
import { toast } from "react-toastify";

function PassengerRegistration() {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    gender: '',
    password: '',
    password2: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false); // Add state for password visibility
  const [showPassword2, setShowPassword2] = useState(false); // Add state for confirm password visibility

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (formData.password !== formData.password2) {
    setError('Passwords do not match.');
    setLoading(false);
    return;
  }

    try {
      // Assuming there's a registration service
      await authService.register(formData);
      // alert('Registration successful!'); // Placeholder
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone_number: '',
        gender: '',
        password: '',
        password2: '',
      });
      toast.success("Passenger registration successful!");
      navigate('/verify-email-prompt');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to register. Please try again.';
      setError(errorMessage);
      toast.error(`Passenger registration failed: ${errorMessage}`);
      console.error('User registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field) => {
    if (field === 'password') {
      setShowPassword(!showPassword);
    } else if (field === 'password2') {
      setShowPassword2(!showPassword2);
    }
  };

  return (
    <div className="registration-wrapper">
      <div className="passenger-registration-form">
        <h2>Passenger Registration</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          {/* Personal Information Section */}
          <div className="form-section">
            <h3>Personal Information</h3>
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
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </button>
          <div className="additional-links">
            <Link to="/driver/register" className="link">
              Or enroll as a driver
            </Link>
          </div>
        </form>
      </div>
    </div>

    // <div className="registration-wrapper">
    //   <div className="passenger-registration-form">
    //     <h2>Passenger Registration</h2>
    //     {error && <p className="error">{error}</p>}
    //     <form onSubmit={handleSubmit}>
    //       <input
    //         type="text"
    //         name="first_name"
    //         placeholder="First Name"
    //         value={formData.first_name}
    //         onChange={handleChange}
    //         required
    //       />
    //       <input
    //         type="text"
    //         name="last_name"
    //         placeholder="Last Name"
    //         value={formData.last_name}
    //         onChange={handleChange}
    //         required
    //       />
    //       <input
    //         type="email"
    //         name="email"
    //         placeholder="Email"
    //         value={formData.email}
    //         onChange={handleChange}
    //         required
    //       />
    //       <input
    //         type="tel"
    //         name="phone_number"
    //         placeholder="Phone Number"
    //         value={formData.phone_number}
    //         onChange={handleChange}
    //         required
    //       />
    //       <select
    //         name="gender"
    //         value={formData.gender}
    //         onChange={handleChange}
    //       >
    //         <option value="">Select Gender</option>
    //         <option value="male">Male</option>
    //         <option value="female">Female</option>
    //         <option value="other">Other</option>
    //       </select>
    //       <input
    //         type="password"
    //         name="password"
    //         placeholder="Password"
    //         value={formData.password}
    //         onChange={handleChange}
    //         required
    //       />
    //       <input
    //         type="password"
    //         name="password2"
    //         placeholder="Confirm Password"
    //         value={formData.password2}
    //         onChange={handleChange}
    //       />
    //       <button type="submit" disabled={loading}>
    //         {loading ? 'Registering...' : 'Register'}
    //       </button>
    //       <div className="additional-links">
    //         <Link to="/driver/register" className="link">
    //           Or enroll as a driver
    //         </Link>
    //       </div>
    //     </form>
    //   </div>
    // </div>
  );
}

export default PassengerRegistration;
