import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import '../styles/VerifyEmailError.css';

const VerifyEmailError = () => {
  const { state } = useLocation();
  const error = state?.error || 'An error occurred';

  return (
    <div className="verify-email-error-container">
      <div className="verify-email-error-box">
        <h2>Verification Failed</h2>
        <p>{error}</p>
        <Link to="/verify-email-prompt" className="btn">Try Again</Link>
      </div>
    </div>
  );
};

export default VerifyEmailError;