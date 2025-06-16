import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authService } from '../services/api';

// This component processes the verification token and redirects to success or error pages.
const VerifyEmailHandler = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  useEffect(() => {
    console.log('Token:', token);
    if (token) {
      authService
        .verifyEmail(token)
        .then((data) => {
        console.log('Verification data:', data);
          if (data.message === 'Email verified successfully') {
            navigate('/verify-email-success');
          }
        })
        .catch((error) => {
          navigate('/verify-email-error', { state: { error: error.response?.data?.error || 'Verification failed' } });
        });
    } else {
      navigate('/verify-email-error', { state: { error: 'No token provided' } });
    }
  }, [token, navigate]);

  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Verifying...</div>;
};

export default VerifyEmailHandler;