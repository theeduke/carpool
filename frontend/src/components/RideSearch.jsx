import { useState, useRef } from "react";
import { passengerService } from '../services/api'; // Adjust path as needed
import RideCard from "./RideCard";
// import { LoadScript, Autocomplete } from '@react-google-maps/api';
import { Autocomplete } from '@react-google-maps/api';
import '../styles/main.css';
import { formatPlaceLabel } from "../utils/placeUtils";

function RideSearch() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [rides, setRides] = useState([]);
  const [error, setError] = useState(null);

  const originRef = useRef(null);
  const destinationRef = useRef(null);

  // const googlemapapi = 'import.meta.env.VITE_GOOGLE_MAPS_API_KEY'
  // const googlemapapi = 'AIzaSyAFoltcHolkzg3ZpbDHgXVSeYgNIXEQKHU'; // Your API key
  // const libraries = ['places']; // Libraries needed for Autocomplete

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
    try {
      const response = await passengerService.searchRides({
        origin,
        destination,
        pickup_date: pickupDate,
        time_slot: timeSlot,
      });
      setRides(response.data);
      console.log("this are the details ot the search", response.data)
    } catch (error) {
      console.error("Error fetching rides:", error);
      setError("Failed to fetch rides: " + (error.response?.data?.error || "Unknown error"));
    }
  };

  return (
    <div className="search-results">
      {/* <LoadScript googleMapsApiKey={googlemapapi} libraries={libraries}> */}
        <form onSubmit={handleSearch} className="search-form">
          <Autocomplete
            // onLoad={(autocomplete) => (originRef.current = autocomplete)}
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
            />
          </Autocomplete>
          <Autocomplete
            // onLoad={(autocomplete) => (destinationRef.current = autocomplete)}
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
            />
          </Autocomplete>
          <input
            type="date"
            placeholder="Pickup Date"
            value={pickupDate}
            onChange={(e) => setPickupDate(e.target.value)}
            className="search-input"
          />
          <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} className="search-select">
            <option value="">Anytime</option>
            <option value="before_06">Before 06:00</option>
            <option value="06_12">06:00 - 12:00</option>
            <option value="12_18">12:01 - 18:00</option>
            <option value="after_18">After 18:00</option>
          </select>
          <button type="submit" className="search-button">Search</button>
        </form>

        {/* {error && <p style={{ color: "red" }}>{error}</p>}
        {rides.length > 0 ? (
          rides.map((ride) => <RideCard key={ride.id} ride={ride} />)
        ) : (
          <p>No rides found.</p>
        )} */}
      {/* </LoadScript> */}
      {error && <p style={{ color: "red" }}>{error}</p>}
     {rides.length > 0 ? (
       rides.map((ride) => <RideCard key={ride.carpoolride_id} ride={ride} />)
     ) : (
       <p>No rides found.</p>
     )}
    </div>
  );
}

export default RideSearch;



// import { useState } from "react";
// import { passengerService } from '../services/api'; // Adjust path as needed
// import RideCard from "./RideCard";
// import '../styles/main.css'

// function RideSearch() {
//   const [origin, setOrigin] = useState("");
//   const [destination, setDestination] = useState("");
//   const [pickupDate, setPickupDate] = useState("");
//   // const [pickupTime, setPickupTime] = useState("");
//   const [timeSlot, setTimeSlot] = useState("");
  
//   const [rides, setRides] = useState([]);
//   const [error, setError] = useState(null); // Added for better error handling

//   const handleSearch = async (e) => {
//     e.preventDefault();
//     setError(null); // Reset error state
//     try {
//       const response = await passengerService.searchRides({
//         origin,
//         destination,
//         pickup_date: pickupDate, // Added to match potential backend expectation
//         // pickup_time: pickupTime, // Added to match potential backend expectation
//         time_slot: timeSlot,
//       });
//       setRides(response.data);
//     } catch (error) {
//       console.error("Error fetching rides:", error);
//       setError("Failed to fetch rides: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

// //   return (
// //     <div>
// //       <form onSubmit={handleSearch}>
// //         <input
// //           type="text"
// //           placeholder="Origin"
// //           value={origin}
// //           onChange={(e) => setOrigin(e.target.value)}
// //         />
// //         <input
// //           type="text"
// //           placeholder="Destination"
// //           value={destination}
// //           onChange={(e) => setDestination(e.target.value)}
// //         />
// //         <input
// //           type="date"
// //           placeholder="Pickup Date"
// //           value={pickupDate}
// //           onChange={(e) => setPickupDate(e.target.value)}
// //         />
// //         <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)}>
// //         <option value="">Anytime</option>
// //         <option value="before_06">Before 06:00</option>
// //         <option value="06_12">06:00 - 12:00</option>
// //         <option value="12_18">12:01 - 18:00</option>
// //         <option value="after_18">After 18:00</option>
// //         </select>
// //         <button type="submit">Search</button>
// //       </form>

// //       {error && <p style={{ color: "red" }}>{error}</p>}
// //       {rides.length > 0 ? (
// //         rides.map((ride) => <RideCard key={ride.id} ride={ride} />)
// //       ) : (
// //         <p>No rides found.</p>
// //       )}
// //     </div>
// //   );
// // }
// return (
//   <div className="search-results">
//     <form onSubmit={handleSearch} className="search-form">
//       <input
//         type="text"
//         placeholder="Origin"
//         value={origin}
//         onChange={(e) => setOrigin(e.target.value)}
//         className="search-input"
//       />
//       <input
//         type="text"
//         placeholder="Destination"
//         value={destination}
//         onChange={(e) => setDestination(e.target.value)}
//         className="search-input"
//       />
//       <input
//         type="date"
//         placeholder="Pickup Date"
//         value={pickupDate}
//         onChange={(e) => setPickupDate(e.target.value)}
//         className="search-input"
//       />
//       <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} className="search-select">
//         <option value="">Anytime</option>
//         <option value="before_06">Before 06:00</option>
//         <option value="06_12">06:00 - 12:00</option>
//         <option value="12_18">12:01 - 18:00</option>
//         <option value="after_18">After 18:00</option>
//       </select>
//       <button type="submit" className="search-button">Search</button>
//     </form>

//     {error && <p style={{ color: "red" }}>{error}</p>}
//     {rides.length > 0 ? (
//       rides.map((ride) => <RideCard key={ride.id} ride={ride} />)
//     ) : (
//       <p>No rides found.</p>
//     )}
//   </div>
// );
// }

// export default RideSearch;

