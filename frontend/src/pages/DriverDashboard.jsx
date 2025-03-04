import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";

const DriverDashboard = () => {
    const [driverData, setDriverData] = useState(null);
    const [error, setError] = useState("");

    const token = useSelector((state) => state.auth.token); // Assuming token is stored in Redux

    useEffect(() => {
        const fetchDriverData = async () => {
            try {
                const response = await fetch("/api/driver-dashboard/", {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (!response.ok) {
                    throw new Error("Access denied. Not a driver.");
                }

                const data = await response.json();
                setDriverData(data);
            } catch (err) {
                setError(err.message);
            }
        };

        fetchDriverData();
    }, [token]);

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="driver-dashboard">
            <h2>Driver Dashboard</h2>
            {driverData ? (
                <div className="driver-info">
                    <p><strong>Name:</strong> {driverData.full_name}</p>
                    <p><strong>Phone:</strong> {driverData.phone_number}</p>
                    <p><strong>Verified:</strong> {driverData.is_verified ? "Yes" : "No"}</p>
                    <p><strong>Wallet Balance:</strong> ${driverData.wallet_balance}</p>
                    <p><strong>Rating:</strong> {driverData.rating} ⭐</p>
                </div>
            ) : (
                <p>Loading...</p>
            )}
        </div>
    );
};

export default DriverDashboard;
