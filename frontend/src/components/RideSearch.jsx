import { useState, useRef, useEffect } from "react";
import { passengerService } from '../services/api';
import RideCard from "./RideCard";
import { Autocomplete } from '@react-google-maps/api';
// import '../styles/main.css';
import '../styles/RideSearch.css';
import { formatPlaceLabel } from "../utils/placeUtils";
import { useLocation } from 'react-router-dom';

function RideSearch() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [rides, setRides] = useState([]);
  const [userRequests, setUserRequests] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const originRef = useRef(null);
  const destinationRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        const requestResponse = await passengerService.getRideRequests();
        const requests = Array.isArray(requestResponse.data) ? requestResponse.data : [];
        setUserRequests(requests);

        const params = new URLSearchParams(location.search);
        const rideId = params.get('rideId');
        if (rideId) {
          try {
            const rideResponse = await passengerService.getRideById(rideId);
            const ride = rideResponse.data;
            const restrictedRequest = requests.find(
              (req) => (req.ride === rideId || req.ride?.carpoolride_id === rideId) &&
                       ["pending", "canceled", "declined"].includes(req.status)
            );
            if (ride && !restrictedRequest) {
              setRides([ride]);
              setOrigin(ride.origin?.label || "");
              setDestination(ride.destination?.label || "");
              setPickupDate(new Date(ride.departure_time).toISOString().split('T')[0] || "");
              const rideHour = new Date(ride.departure_time).getHours();
              if (rideHour < 6) setTimeSlot('before_06');
              else if (rideHour >= 6 && rideHour < 12) setTimeSlot('06_12');
              else if (rideHour >= 12 && rideHour <= 18) setTimeSlot('12_18');
              else setTimeSlot('after_18');
            } else {
              setError(
                restrictedRequest
                  ? `This ride is unavailable because your request was ${restrictedRequest.status}.`
                  : "Ride not found."
              );
              setRides([]);
            }
          } catch (err) {
            console.error("Error fetching ride by ID:", err);
            setError("Failed to load ride: " + (err.response?.data?.error || err.message));
            setRides([]);
          }
        } else {
          setRides([]);
        }
      } catch (error) {
        console.error("Error fetching initial data:", error);
        setError("Failed to load ride requests: " + (error.response?.data?.error || error.message));
        setUserRequests([]);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [location.search]);

  const handlePlaceSelect = (field) => {
    const autocomplete = field === "origin" ? originRef.current : destinationRef.current;
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place && place.geometry) {
        const label = formatPlaceLabel(place);
        if (field === "origin") {
          setOrigin(label);
        } else {
          setDestination(label);
        }
      }
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!origin || !pickupDate) {
      setError("Please provide origin and pickup date.");
      setLoading(false);
      return;
    }

    const searchParams = {
      origin,
      destination,
      pickup_date: pickupDate,
      time_slot: timeSlot,
    };
    console.log("Search params:", searchParams);

    try {
      const [rideResponse, requestResponse] = await Promise.all([
        passengerService.searchRides(searchParams),
        passengerService.getRideRequests(),
      ]);
      console.log("Ride requests response in search:", requestResponse.data);
      console.log("Search rides response:", rideResponse.data);
      const allRides = Array.isArray(rideResponse.data) ? rideResponse.data : [];
      const requests = Array.isArray(requestResponse.data) ? requestResponse.data : [];
      setUserRequests(requests);

      const filteredRides = allRides.filter((ride) => {
        const originMatch = origin ? ride.origin?.label?.toLowerCase().includes(origin.toLowerCase()) : true;
        const destinationMatch = destination
          ? ride.destination?.label?.toLowerCase().includes(destination.toLowerCase())
          : true;
        const rideDate = new Date(ride.departure_time).toISOString().split('T')[0];
        const dateMatch = pickupDate ? rideDate === pickupDate : true;
        const timeMatch = timeSlot && timeSlot !== ''
          ? (() => {
              const rideHour = new Date(ride.departure_time).getHours();
              if (timeSlot === 'before_06') return rideHour < 6;
              if (timeSlot === '06_12') return rideHour >= 6 && rideHour < 12;
              if (timeSlot === '12_18') return rideHour >= 12 && rideHour <= 18;
              if (timeSlot === 'after_18') return rideHour > 18;
              return true;
            })()
          : true;

        return originMatch && destinationMatch && dateMatch && timeMatch;
      });

      setRides(filteredRides);
      console.log("Filtered rides:", filteredRides);

      if (filteredRides.length === 0) {
        const matchingRestrictedRequest = requests.find((req) => {
          const ride = req.ride || {};
          const rideOrigin = ride.origin?.label?.toLowerCase() || "";
          const rideDestination = ride.destination?.label?.toLowerCase() || "";
          const rideDate = ride.departure_time ? new Date(ride.departure_time).toISOString().split('T')[0] : "";
          const rideHour = ride.departure_time ? new Date(ride.departure_time).getHours() : null;

          const originMatch = origin ? rideOrigin.includes(origin.toLowerCase()) : true;
          const destinationMatch = destination ? rideDestination.includes(destination.toLowerCase()) : true;
          const dateMatch = pickupDate ? rideDate === pickupDate : true;
          const timeMatch = timeSlot && timeSlot !== ''
            ? (() => {
                if (!rideHour) return false;
                if (timeSlot === 'before_06') return rideHour < 6;
                if (timeSlot === '06_12') return rideHour >= 6 && rideHour < 12;
                if (timeSlot === '12_18') return rideHour >= 12 && rideHour <= 18;
                if (timeSlot === 'after_18') return rideHour > 18;
                return true;
              })()
            : true;

          return (
            ["pending", "canceled", "declined"].includes(req.status) &&
            originMatch &&
            destinationMatch &&
            dateMatch &&
            timeMatch
          );
        });

        setError(
          matchingRestrictedRequest
            ? `No available rides found. You have a ${matchingRestrictedRequest.status} request for a ride matching your criteria.`
            : "No available rides found for your criteria."
        );
      }
    } catch (error) {
      console.error("Error fetching rides:", error);
      setError("Failed to fetch rides: " + (error.response?.data?.error || error.message));
      setRides([]);
      setUserRequests([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-results">
      <h3 className="search-title">Search for a Ride</h3>
      <form onSubmit={handleSearch} className="search-form">
        <Autocomplete
          onLoad={(autocomplete) => {
            originRef.current = autocomplete;
            autocomplete.setComponentRestrictions({ country: 'ke' });
          }}
          onPlaceChanged={() => handlePlaceSelect("origin")}
        >
          <input
            type="text"
            placeholder="Origin"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="search-input"
            disabled={loading}
          />
        </Autocomplete>
        <Autocomplete
          onLoad={(autocomplete) => {
            destinationRef.current = autocomplete;
            autocomplete.setComponentRestrictions({ country: 'ke' });
          }}
          onPlaceChanged={() => handlePlaceSelect("destination")}
        >
          <input
            type="text"
            placeholder="Destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="search-input"
            disabled={loading}
          />
        </Autocomplete>
        <input
          type="date"
          placeholder="Pickup Date"
          value={pickupDate}
          onChange={(e) => {
            console.log("Selected date:", e.target.value);
            setPickupDate(e.target.value);
          }}
          className="search-input"
          disabled={loading}
          min={new Date().toISOString().split('T')[0]}
          max={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
        />
        <select
          value={timeSlot}
          onChange={(e) => setTimeSlot(e.target.value)}
          className="search-select"
          disabled={loading}
        >
          <option value="">Anytime</option>
          <option value="before_06">Before 06:00</option>
          <option value="06_12">06:00 - 12:00</option>
          <option value="12_18">12:01 - 18:00</option>
          <option value="after_18">After 18:00</option>
        </select>
        <button
          type="submit"
          className="search-button"
          disabled={loading || !origin || !pickupDate}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {loading && (
        <div className="search-loading">
          <p>Loading rides...</p>
        </div>
      )}
      {error && (
        <div className="search-error">
          <p>{error}</p>
        </div>
      )}
      {!loading && rides.length > 0 ? (
        rides.map((ride) => (
          <RideCard
            key={ride.carpoolride_id}
            ride={ride}
            userRequests={userRequests}
            className={location.search.includes(`rideId=${ride.carpoolride_id}`) ? 'highlighted-ride' : ''}
          />
        ))
      ) : (
        !loading && (
          <div className="search-error">
            <p>No rides found.</p>
          </div>
        )
      )}
    </div>
  );
}

export default RideSearch;

// import { useState, useRef, useEffect } from "react";
// import { passengerService } from '../services/api';
// import RideCard from "./RideCard";
// import { Autocomplete } from '@react-google-maps/api';
// import '../styles/main.css';
// import { formatPlaceLabel } from "../utils/placeUtils";
// import { useLocation } from 'react-router-dom';

// function RideSearch() {
//   const [origin, setOrigin] = useState("");
//   const [destination, setDestination] = useState("");
//   const [pickupDate, setPickupDate] = useState("");
//   const [timeSlot, setTimeSlot] = useState("");
//   const [rides, setRides] = useState([]);
//   const [userRequests, setUserRequests] = useState([]);
//   const [error, setError] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const originRef = useRef(null);
//   const destinationRef = useRef(null);
//   const location = useLocation();

//   useEffect(() => {
//     const fetchInitialData = async () => {
//       setLoading(true);
//       setError(null);
//       try {
//         const requestResponse = await passengerService.getRideRequests();
//         const requests = Array.isArray(requestResponse.data) ? requestResponse.data : [];
//         setUserRequests(requests);

//         const params = new URLSearchParams(location.search);
//         const rideId = params.get('rideId');
//         if (rideId) {
//           try {
//             const rideResponse = await passengerService.getRideById(rideId);
//             const ride = rideResponse.data;
//             const restrictedRequest = requests.find(
//               (req) => (req.ride === rideId || req.ride?.carpoolride_id === rideId) &&
//                        ["pending", "canceled", "declined"].includes(req.status)
//             );
//             if (ride && !restrictedRequest) {
//               setRides([ride]);
//               setOrigin(ride.origin?.label || "");
//               setDestination(ride.destination?.label || "");
//               setPickupDate(new Date(ride.departure_time).toISOString().split('T')[0] || "");
//               const rideHour = new Date(ride.departure_time).getHours();
//               if (rideHour < 6) setTimeSlot('before_06');
//               else if (rideHour >= 6 && rideHour < 12) setTimeSlot('06_12');
//               else if (rideHour >= 12 && rideHour <= 18) setTimeSlot('12_18');
//               else setTimeSlot('after_18');
//             } else {
//               setError(
//                 restrictedRequest
//                   ? `This ride is unavailable because your request was ${restrictedRequest.status}.`
//                   : "Ride not found."
//               );
//               setRides([]);
//             }
//           } catch (err) {
//             console.error("Error fetching ride by ID:", err);
//             setError("Failed to load ride: " + (err.response?.data?.error || err.message));
//             setRides([]);
//           }
//         } else {
//           setRides([]);
//         }
//       } catch (error) {
//         console.error("Error fetching initial data:", error);
//         setError("Failed to load ride requests: " + (error.response?.data?.error || error.message));
//         setUserRequests([]);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchInitialData();
//   }, [location.search]);

//   const handlePlaceSelect = (field) => {
//     const autocomplete = field === "origin" ? originRef.current : destinationRef.current;
//     if (autocomplete) {
//       const place = autocomplete.getPlace();
//       if (place && place.geometry) {
//         const label = formatPlaceLabel(place);
//         if (field === "origin") {
//           setOrigin(label);
//         } else {
//           setDestination(label);
//         }
//       }
//     }
//   };

//   const handleSearch = async (e) => {
//     e.preventDefault();
//     setError(null);
//     setLoading(true);

//     if (!origin || !pickupDate) {
//       setError("Please provide origin and pickup date.");
//       setLoading(false);
//       return;
//     }

//     const searchParams = {
//       origin,
//       destination,
//       pickup_date: pickupDate,
//       time_slot: timeSlot,
//     };
//     console.log("Search params:", searchParams);

//     try {
//       const [rideResponse, requestResponse] = await Promise.all([
//         passengerService.searchRides(searchParams),
//         passengerService.getRideRequests(),
//       ]);
//       console.log("Ride requests response in search:", requestResponse.data);
//       console.log("Search rides response:", rideResponse.data);
//       const allRides = Array.isArray(rideResponse.data) ? rideResponse.data : [];
//       const requests = Array.isArray(requestResponse.data) ? requestResponse.data : [];
//       setUserRequests(requests);

//       // Filter rides based on search criteria (backend already excludes restricted rides)
//       const filteredRides = allRides.filter((ride) => {
//         const originMatch = origin ? ride.origin?.label?.toLowerCase().includes(origin.toLowerCase()) : true;
//         const destinationMatch = destination
//           ? ride.destination?.label?.toLowerCase().includes(destination.toLowerCase())
//           : true;
//         const rideDate = new Date(ride.departure_time).toISOString().split('T')[0];
//         const dateMatch = pickupDate ? rideDate === pickupDate : true;
//         const timeMatch = timeSlot && timeSlot !== ''
//           ? (() => {
//               const rideHour = new Date(ride.departure_time).getHours();
//               if (timeSlot === 'before_06') return rideHour < 6;
//               if (timeSlot === '06_12') return rideHour >= 6 && rideHour < 12;
//               if (timeSlot === '12_18') return rideHour >= 12 && rideHour <= 18;
//               if (timeSlot === 'after_18') return rideHour > 18;
//               return true;
//             })()
//           : true;

//         return originMatch && destinationMatch && dateMatch && timeMatch;
//       });

//       setRides(filteredRides);
//       console.log("Filtered rides:", filteredRides);

//       if (filteredRides.length === 0) {
//         // Check if there are restricted requests matching the search criteria
//         const matchingRestrictedRequest = requests.find((req) => {
//           const ride = req.ride || {};
//           const rideOrigin = ride.origin?.label?.toLowerCase() || "";
//           const rideDestination = ride.destination?.label?.toLowerCase() || "";
//           const rideDate = ride.departure_time ? new Date(ride.departure_time).toISOString().split('T')[0] : "";
//           const rideHour = ride.departure_time ? new Date(ride.departure_time).getHours() : null;

//           const originMatch = origin ? rideOrigin.includes(origin.toLowerCase()) : true;
//           const destinationMatch = destination ? rideDestination.includes(destination.toLowerCase()) : true;
//           const dateMatch = pickupDate ? rideDate === pickupDate : true;
//           const timeMatch = timeSlot && timeSlot !== ''
//             ? (() => {
//                 if (!rideHour) return false;
//                 if (timeSlot === 'before_06') return rideHour < 6;
//                 if (timeSlot === '06_12') return rideHour >= 6 && rideHour < 12;
//                 if (timeSlot === '12_18') return rideHour >= 12 && rideHour <= 18;
//                 if (timeSlot === 'after_18') return rideHour > 18;
//                 return true;
//               })()
//             : true;

//           return (
//             ["pending", "canceled", "declined"].includes(req.status) &&
//             originMatch &&
//             destinationMatch &&
//             dateMatch &&
//             timeMatch
//           );
//         });

//         setError(
//           matchingRestrictedRequest
//             ? `No available rides found. You have a ${matchingRestrictedRequest.status} request for a ride matching your criteria.`
//             : "No available rides found for your criteria."
//         );
//       }
//     } catch (error) {
//       console.error("Error fetching rides:", error);
//       setError("Failed to fetch rides: " + (error.response?.data?.error || error.message));
//       setRides([]);
//       setUserRequests([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="search-results">
//       <form onSubmit={handleSearch} className="search-form">
//         <Autocomplete
//           onLoad={(autocomplete) => {
//             originRef.current = autocomplete;
//             autocomplete.setComponentRestrictions({ country: 'ke' });
//           }}
//           onPlaceChanged={() => handlePlaceSelect("origin")}
//         >
//           <input
//             type="text"
//             placeholder="Origin"
//             value={origin}
//             onChange={(e) => setOrigin(e.target.value)}
//             className="search-input"
//             disabled={loading}
//           />
//         </Autocomplete>
//         <Autocomplete
//           onLoad={(autocomplete) => {
//             destinationRef.current = autocomplete;
//             autocomplete.setComponentRestrictions({ country: 'ke' });
//           }}
//           onPlaceChanged={() => handlePlaceSelect("destination")}
//         >
//           <input
//             type="text"
//             placeholder="Destination"
//             value={destination}
//             onChange={(e) => setDestination(e.target.value)}
//             className="search-input"
//             disabled={loading}
//           />
//         </Autocomplete>
//         <input
//           type="date"
//           placeholder="Pickup Date"
//           value={pickupDate}
//           onChange={(e) => {
//             console.log("Selected date:", e.target.value);
//             setPickupDate(e.target.value);
//           }}
//           className="search-input"
//           disabled={loading}
//           min={new Date().toISOString().split('T')[0]}
//           max={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
//         />
//         <select
//           value={timeSlot}
//           onChange={(e) => setTimeSlot(e.target.value)}
//           className="search-select"
//           disabled={loading}
//         >
//           <option value="">Anytime</option>
//           <option value="before_06">Before 06:00</option>
//           <option value="06_12">06:00 - 12:00</option>
//           <option value="12_18">12:01 - 18:00</option>
//           <option value="after_18">After 18:00</option>
//         </select>
//         <button
//           type="submit"
//           className="search-button"
//           disabled={loading || !origin || !pickupDate}
//         >
//           {loading ? "Searching..." : "Search"}
//         </button>
//       </form>

//       {loading && <p>Loading rides...</p>}
//       {error && <p style={{ color: "red" }}>{error}</p>}
//       {!loading && rides.length > 0 ? (
//         rides.map((ride) => (
//           <RideCard
//             key={ride.carpoolride_id}
//             ride={ride}
//             userRequests={userRequests}
//             className={location.search.includes(`rideId=${ride.carpoolride_id}`) ? 'highlighted-ride' : ''}
//           />
//         ))
//       ) : (
//         !loading && <p>No rides found.</p>
//       )}
//     </div>
//   );
// }

// export default RideSearch;
