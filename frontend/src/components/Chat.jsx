import React, { useState, useEffect, useRef, useContext } from 'react';
import { rideService } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import '../styles/chat.css';

const Chat = ({ carpoolride_id, recipientId, onClose, position }) => {
  const { user } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [recipientName, setRecipientName] = useState('');
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const chatRef = useRef(null);
  const messagesContainerRef = useRef(null); // Ref for chat-messages container

  const token = localStorage.getItem("access_token");
  if (!token) {
    console.error("No JWT token found for WebSocket connection");
    setError("Authentication error: Please log in again.");
    return null;
  }
  const backendWsUrl = import.meta.env.VITE_BACKEND_WSREQUEST_URL;
  const wsUrl = `${backendWsUrl}/ws/chat/${carpoolride_id}/?token=${token}`;


  useEffect(() => {
    const fetchRecipientName = async () => {
      try {
        if (!recipientId) {
          console.warn('recipientId is undefined or null');
          setRecipientName('Unknown User');
          return;
        }
        // getting details of the recipient
        const response = await rideService.getUserProfile(recipientId);
        console.log("Fetched profile data:", response);
        const { first_name, last_name } = response;
        if (!first_name || !last_name) {
          console.warn('first_name or last_name missing in response:', response);
          setRecipientName('Unknown User');
        } else {
          const fullName = `${first_name} ${last_name}`.trim();
          console.log('Setting recipientName to:', fullName);
          setRecipientName(fullName);
        }
      } catch (err) {
        console.error('Failed to fetch recipient name:', err);
        if (err.response) {
          console.error('API Error Response:', err.response);
        }
        setRecipientName('Unknown User');
      }
    };

    fetchRecipientName();
  }, [recipientId]);
  

  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        const history = await rideService.getChatHistory(carpoolride_id);
        const filteredMessages = history.filter(
           (msg) =>
            (String(msg.sender.id) === String(user.id) && String(msg.recipient.id) === String(recipientId)) ||
            (String(msg.sender.id) === String(recipientId) && String(msg.recipient.id) === String(user.id))
        );
        console.log("Current user ID:", user.id);
        console.log("Recipient ID:", recipientId);

        //   (msg) =>
        //     (msg.sender.id === user.id && msg.recipient.id === recipientId) ||
        //     (msg.sender.id === recipientId && msg.recipient.id === user.id)
        // );
        setMessages(filteredMessages);
      } catch (err) {
        setError('Failed to load chat history');
        console.error('Chat history fetch error:', err);
      }
    };

    fetchChatHistory();
  }, [carpoolride_id, recipientId, user.id]);

  useEffect(() => {
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected for chat:', carpoolride_id);
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);

      if (data.type === 'chat_message') {
        if (
          (data.sender_id === user.id && data.recipient_id === recipientId) ||
          (data.sender_id === recipientId && data.recipient_id === user.id)
        ) {
          setMessages((prev) => [
            ...prev,
            {
              message_id: data.message_id,
              sender: { id: data.sender_id },
              recipient: { id: data.recipient_id },
              content: data.content,
              timestamp: data.timestamp,
              status: data.status,
            },
          ]);
        }
      } else if (data.type === 'message_status') {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.message_id === data.message_id ? { ...msg, status: data.status } : msg
          )
        );
      } else if (data.type === 'typing') {
        if (data.user_id === recipientId) {
          setTypingUser(data.user_id);
          setIsTyping(true);
          setTimeout(() => setIsTyping(false), 3000);
        }
      } else if (data.type === 'error') {
        setError(data.message);
      }
    };

    wsRef.current.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setError('Chat connection closed');
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Chat connection error');
    };

    return () => {
      wsRef.current.close();
    };
  }, [wsUrl, carpoolride_id, recipientId, user.id]);

  // Auto-scroll to latest message within chat-messages container
  useEffect(() => {
    if (messagesEndRef.current && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesEndRef.current.offsetTop,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  useEffect(() => {
    const markMessagesSeen = async () => {
      const unseenMessages = messages.filter(
        (msg) => msg.recipient.id === user.id && msg.status !== 'seen'
      );
      for (const msg of unseenMessages) {
        wsRef.current.send(
          JSON.stringify({
            action: 'mark_seen',
            message_id: msg.message_id,
          })
        );
      }
    };
    markMessagesSeen();
  }, [messages, user.id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (chatRef.current && !chatRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Cannot send message: Connection not established or empty message');
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        action: 'send_message',
        content: newMessage,
        recipient_id: recipientId,
        carpoolride_id,
      })
    );
    setNewMessage('');
  };

  const handleTyping = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          action: 'typing',
        })
      );
    }
  };

  return (
    <div
      ref={chatRef}
      className="chat-container"
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 1000,
        width: '320px',
        height: '400px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
      }}
    >
      <div className="chat-header">
        <h3>{recipientName}</h3>
        <button onClick={onClose} className="close-chat-button">
          Close
        </button>
      </div>
      {error && <div className="chat-error">{error}</div>}
      <div
        ref={messagesContainerRef}
        className="chat-messages"
      >
        {messages.map((msg) => (
          <div
            key={msg.message_id}
            className={`chat-message ${msg.sender.id === user.id ? 'sent' : 'received'}`}
          >
            <p>{msg.content}</p>
            <span className="message-timestamp">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
            <span className="message-status">
              {msg.status === 'sent' && '✓'}
              {msg.status === 'delivered' && '✓✓'}
              {msg.status === 'seen' && '✓✓ (Seen)'}
            </span>
          </div>
        ))}
        {isTyping && typingUser === recipientId && (
          <div className="typing-indicator">Typing...</div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value);
            handleTyping();
          }}
          onFocus={(e) => e.preventDefault()} // Prevent focus from causing scroll
          placeholder="Type a message..."
        />
        <button onClick={handleSendMessage} className="send-message-button">
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat;

