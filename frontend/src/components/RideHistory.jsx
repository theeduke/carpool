import React, { useEffect, useState, useContext, useRef } from 'react';
import { rideService } from '../services/api';
import { AuthContext } from '../context/AuthContext';
import Chat from './Chat';
import '../styles/ridehistory.css';

const RideHistory = () => {
  const { user } = useContext(AuthContext);
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(2);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedRideId, setSelectedRideId] = useState(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState([]);
  const [chatPosition, setChatPosition] = useState({ top: 0, left: 0 });
  const buttonRefs = useRef({});
  const scrollPositionRef = useRef(null); // Store scroll position before chat opens

  useEffect(() => {
    const fetchRideHistory = async () => {
      try {
        const response = await rideService.getRideHistory({ page: currentPage, limit });
        console.log("API Response:", response);
        setRides(response.results || []);
        setTotalPages(Math.ceil(response.count / limit));
      } catch (error) {
        console.error('Error fetching ride history:', error);
        setRides([]);
      } finally {
        setLoading(false);
      }
    };

    const fetchUnreadMessages = async () => {
      try {
        const counts = await rideService.getUnreadMessages();
        console.log("these are the unread counts:", counts);
        setUnreadCounts(counts);
      } catch (error) {
        console.error('Error fetching unread messages:', error);
      }
    };

    fetchRideHistory();
    fetchUnreadMessages();
  }, [currentPage, limit]);

  useEffect(() => {
    if (!chatOpen) {
      const fetchUnreadMessages = async () => {
        try {
          const counts = await rideService.getUnreadMessages();
          setUnreadCounts(counts);
        } catch (error) {
          console.error('Error fetching unread messages:', error);
        }
      };
      fetchUnreadMessages();
    }
  }, [chatOpen]);

  useEffect(() => {
    const handleScroll = () => {
      if (chatOpen && selectedRecipientId && buttonRefs.current[selectedRecipientId]) {
        const button = buttonRefs.current[selectedRecipientId];
        const rect = button.getBoundingClientRect();
        const scrollY = window.scrollY || window.pageYOffset;
        setChatPosition({
          top: rect.top + scrollY - 450,
          left: Math.min(rect.left, window.innerWidth - 350),
        });
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [chatOpen, selectedRecipientId]);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const openChat = (rideId, recipientId, event) => {
    event.preventDefault(); // Prevent default button behavior
    console.log('Opening chat with:', { rideId, recipientId });
    if (!recipientId) {
      console.error('Cannot open chat: No recipient ID provided');
      alert('Cannot start chat: No recipient selected.');
      return;
    }
    // Save current scroll position
    scrollPositionRef.current = window.scrollY || window.pageYOffset;
    const button = event.currentTarget;
    buttonRefs.current[recipientId] = button;
    const rect = button.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    setChatPosition({
      top: rect.top + scrollY - 450,
      left: Math.min(rect.left, window.innerWidth - 350),
    });
    setSelectedRideId(rideId);
    setSelectedRecipientId(recipientId);
    setChatOpen(true);
    // Restore scroll position immediately after chat opens
    setTimeout(() => {
      window.scrollTo(0, scrollPositionRef.current);
    }, 0);
  };

  const closeChat = () => {
    setChatOpen(false);
    setSelectedRideId(null);
    setSelectedRecipientId(null);
    setChatPosition({ top: 0, left: 0 });
    // Restore scroll position when closing
    if (scrollPositionRef.current !== null) {
      window.scrollTo(0, scrollPositionRef.current);
    }
  };

  const getUnreadCount = (carpoolride_id, sender_id) => {
    const countObj = unreadCounts.find(
      (c) => c.carpoolride_id === carpoolride_id && c.sender_id === sender_id
    );
    return countObj ? countObj.unread_count : 0;
  };

  if (loading) {
    return <div className="ride-history-loading">Loading ride history...</div>;
  }

  return (
  <div className="ride-history-container">
    {/* <h2 className="ride-history-title">Ride History</h2> */}

    {rides.length === 0 ? (
      <p className="ride-history-empty">No completed rides yet.</p>
    ) : (
      <>
        {rides.map((ride) => {
          // const isDriver = !ride.passengers_info.some(p => p.phone === user.phone_number);
          const isDriver = ride.driver_contact?.id === user.id;
          const isPassengerInRide = ride.passengers_info.some(p => p.phone === user.phone_number);

          const renderMessageButton = (rideId, recipientId, disabled = false) => (
            <div className="message-button-container">
              <button
                onClick={(e) => openChat(rideId, recipientId, e)}
                disabled={disabled}
                className={`p-2 rounded ${
                  disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {disabled ? 'Message disabled (Unavailable)' : 'Message'}
              </button>
              {!disabled && getUnreadCount(rideId, recipientId) > 0 && (
                <span className="unread-badge">
                  {getUnreadCount(rideId, recipientId)}
                </span>
              )}
            </div>
          );

          const renderUserCard = (user, rideId, roleLabel = null, showAmount = false) => (
            <div key={user.id} className="user-card">
              {roleLabel && <p><strong>{roleLabel}</strong></p>}
              <p><strong>Name:</strong> {user.name}</p>
              <p><strong>Contact:</strong> {user.phone}</p>
              {showAmount && (
                <>
                  <p><strong>Amount Paid:</strong> {user.amount_paid} KES</p>
                  <p><strong>Seats requested:</strong> {user.seats_requested}</p>
                </>
              )}
              {renderMessageButton(rideId, user.id, !user.id)}
            </div>
          );

          return (
            <div key={ride.carpoolride_id} className="ride-card">
              <div className="ride-summary">
                <p><strong>From:</strong> {ride.origin.label}</p>
                <p><strong>To:</strong> {ride.destination.label}</p>
                <p><strong>Departure:</strong> {new Date(ride.departure_time).toLocaleString()}</p>
                <p><strong>Status:</strong> {ride.status}</p>
              </div>

              <div className="ride-users">
                {isDriver ? (
                  <>
                    <h4>Passengers</h4>
                    {ride.passengers_info.map(p => renderUserCard(p, ride.carpoolride_id, null, true))}
                    <p className="ride-total"><strong>Total for Trip:</strong> {ride.total_amount_paid ?? 'N/A'} KES</p>
                  </>
                ) : (
                  <>
                    <h4>Driver</h4>
                    {renderUserCard(ride.driver_contact ?? {}, ride.carpoolride_id, null)}

                    {/* {ride.passengers_info.filter(p => p.phone !== user.phone_number).length > 0 && ( */}
                    {isPassengerInRide && ride.passengers_info.filter(p => p.phone !== user.phone_number).length > 0 && (
                      <>
                        <h4>Other Passengers</h4>
                        {ride.passengers_info
                          .filter(p => p.phone !== user.phone_number)
                          .map(p => renderUserCard(p, ride.carpoolride_id))}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        <div className="pagination-controls">
          <button onClick={handlePreviousPage} disabled={currentPage === 1} className="pagination-button">
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button onClick={handleNextPage} disabled={currentPage === totalPages} className="pagination-button">
            Next
          </button>
        </div>
      </>
    )}

    {chatOpen && (
      <Chat
        carpoolride_id={selectedRideId}
        recipientId={selectedRecipientId}
        onClose={closeChat}
        position={chatPosition}
      />
    )}
  </div>
);
};

export default RideHistory;
