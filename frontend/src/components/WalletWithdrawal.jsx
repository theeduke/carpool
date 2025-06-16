import { useState } from 'react';
import { walletService } from '../services/api';
import '../styles/WalletTopUp.css';
import { useNavigate } from 'react-router-dom';

function WalletWithdrawal() {
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        amount,
      };

      // Include phone number if provided
      if (phoneNumber) {
        payload.phone_number = phoneNumber;
      }

      const response = await walletService.withdraw(payload);
      setSuccess(response.message || 'Withdrawal successful!');
      // clear the form
      setAmount('');
      setPhoneNumber('');
      // redirect user back to profile page
      setTimeout(() => {
      navigate('/profile');
    }, 1400);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process withdrawal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="topup-wrapper">
      <div className="topup-form">
        <h2>Withdraw from Your Wallet</h2>
        <p className="instructions">
          Withdraw funds from your wallet to your preferred destination.
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
            <label htmlFor="phone">Phone Number (Optional)</label>
            <input
              type="text"
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g. 0712345678"
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Processing...' : 'Withdraw'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default WalletWithdrawal;