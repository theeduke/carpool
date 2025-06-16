import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/VerifyEmailPrompt.css';

const VerifyEmailPrompt = () => {
  return (
    <div className="verify-email-prompt-container">
      <div className="verify-email-prompt-box">
        <h2>Verify Your Email</h2>
        <p>
          Thank you for signing up! Please check your email inbox (and spam folder) for a verification link. Click the link to activate your account.
        </p>
        <p>
          Didn’t receive an email? <a href="#">Resend Verification Email</a>
        </p>
        <Link to="/login" className="btn">Back to Login</Link>
      </div>
    </div>
  );
};

export default VerifyEmailPrompt;