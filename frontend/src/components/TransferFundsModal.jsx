import React, { useState } from "react";

function TransferFundsModal({ isOpen, onClose, onTransfer }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState("");

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!phoneNumber || !amount) {
      alert("Please fill in all fields.");
      return;
    }
    onTransfer(phoneNumber, amount);
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Transfer Funds</h2>
        <input
          type="text"
          placeholder="Recipient Phone Number"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
        />
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button onClick={handleSubmit}>Transfer</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

export default TransferFundsModal;
