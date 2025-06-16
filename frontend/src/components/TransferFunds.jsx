import { useState } from 'react';
import { walletService } from '../services/api';
import '../styles/TransferFunds.css';
import { useNavigate } from 'react-router-dom';

function TransferFunds() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
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
        phone_number: phoneNumber,
        amount,
      };

      const response = await walletService.transferFunds(payload);
      setSuccess(response.data.message || 'Transfer successful!');
      setAmount('');
      setPhoneNumber('');
      setTimeout(() => {
        navigate('/profile');
      }, 1400);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to transfer funds. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="transfer-wrapper">
      <div className="transfer-form">
        <h2>Transfer Funds</h2>
        <p className="instructions">
          Send money to another user using their phone number.
        </p>

        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="phone">Recipient Phone Number</label>
            <input
              type="text"
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
              placeholder="e.g. 0712345678"
            />
          </div>

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

          <button type="submit" disabled={loading}>
            {loading ? 'Processing...' : 'Transfer'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default TransferFunds;