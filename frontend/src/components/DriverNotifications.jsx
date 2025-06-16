import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const DriverNotifications = () => {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const websocket = new WebSocket(`ws://localhost:8000/ws/notifications/user_${user.id}/?token=${token}`);
    websocket.onopen = () => console.log('WebSocket connected');
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setNotifications((prev) => [...prev, data.message]);
    };
    websocket.onclose = () => console.log('WebSocket disconnected');

    return () => websocket.close();
  }, [user.id, token]);

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Driver Notifications</h2>
      {notifications.length === 0 ? (
        <p>No notifications</p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((msg, index) => (
            <li key={index} className="p-2 bg-gray-100 rounded">{msg}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DriverNotifications;