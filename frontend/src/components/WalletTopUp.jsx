import { useState } from 'react';
import { walletService } from '../services/api';
import '../styles/WalletTopUp.css';
import { useNavigate, useLocation } from 'react-router-dom';

function WalletTopUp() {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        amount,
        payment_method: paymentMethod,
      };

      // Only add phone number if required
      if (paymentMethod === 'mpesa' && phoneNumber) {
        payload.phone_number = phoneNumber;
      }

      const response = await walletService.topUpWallet(payload);
      setSuccess(response.message || 'Wallet topped up successfully!');
      // Clear the form
      setAmount('');
      setPhoneNumber('');
      // Anticipate redirection timeout
      setTimeout(() => {
        // Check navigation state to determine redirect
        const from = location.state?.from;
          if (from === 'ride' && location.state?.rideId) {
            navigate(`/search?rideId=${location.state.rideId}`); // Redirect to RideSearch with rideId
          } else {
            navigate('/profile'); // Default to profile
          }
          }, 1400);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to top up wallet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="topup-wrapper">
      <div className="topup-form">
        <h2>Top Up Your Wallet</h2>
        <p className="instructions">
          Add funds to your wallet using your preferred method.
        </p>

        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="amount">Amount (KES)</label>
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="Enter amount"
              min="1"
            />
          </div>

          <div className="form-group">
            <label htmlFor="payment-method">Payment Method</label>
            <select
              id="payment-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="card">Debit/Credit Card</option>
              {/* <option value="bank_transfer">Bank Transfer</option> */}
              {/* <option value="crypto">Crypto</option> */}
              <option value="mpesa">M-Pesa</option>
              {/* <option value="mock">Mock (Test Only)</option> */}
            </select>
          </div>

          {paymentMethod === 'mpesa' && (
            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input
                type="text"
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. 0712345678"
                required
              />
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Processing...' : 'Top Up'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default WalletTopUp;
