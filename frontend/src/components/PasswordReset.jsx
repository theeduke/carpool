import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/api';
import '../styles/PasswordReset.css';

function PasswordReset() {
  const [formData, setFormData] = useState({
    password: '',
    password2: '',
  });
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Extract token from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError('No token provided. Please request a new reset link.');
    }
  }, [location]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const togglePasswordVisibility = (field) => {
    if (field === 'password') {
      setShowPassword(!showPassword);
    } else {
      setShowPassword2(!showPassword2);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (formData.password !== formData.password2) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      const response = await authService.resetPassword(formData, { params: { token } });
      setSuccess(response.message || 'Password reset successful! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-wrapper">
      <div className="reset-form">
        <h2>Set New Password</h2>
        <p className="instructions">
          Enter your new password below.
        </p>
        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <div className="password-container">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Enter new password"
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
          </div>
          <div className="form-group">
            <label htmlFor="password2">Confirm Password</label>
            <div className="password-container">
              <input
                type={showPassword2 ? 'text' : 'password'}
                id="password2"
                name="password2"
                value={formData.password2}
                onChange={handleChange}
                required
                placeholder="Confirm new password"
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
          <button type="submit" disabled={loading || !token}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default PasswordReset;