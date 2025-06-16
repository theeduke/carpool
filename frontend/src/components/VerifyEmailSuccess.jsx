import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/VerifyEmailSuccess.css';

const VerifyEmailSuccess = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/login');
    }, 5000); // Redirect to login after 5 seconds
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="verify-email-success-container">
      <div className="verify-email-success-box">
        <div className="icon">✔</div>
        <h2>Email Verified!</h2>
        <p>
          Your email has been successfully verified. You will be redirected to the login page in 5 seconds.
        </p>
        <p>
          <a href="/login">Click here to go to login now</a>
        </p>
      </div>
    </div>
  );
};

export default VerifyEmailSuccess;