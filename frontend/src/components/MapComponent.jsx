import { useEffect, useRef, useState } from "react";
import { GoogleMap, Marker, Polyline } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "400px",
  border: "1px solid red",
};

function MapComponent({ optimizedRoute, onLocationUpdate, useSimulation, currentLocation }) {
  const mapRef = useRef(null);
  const [path, setPath] = useState([]);
  const [driverPosition, setDriverPosition] = useState(null);
  const [index, setIndex] = useState(0);
  const [geometryReady, setGeometryReady] = useState(false);
  const [markerOpacity, setMarkerOpacity] = useState(1); // For blinking effect
  const routeIdRef = useRef(null); // Track route ID to prevent resetting path
  const pathRef = useRef([]); // Persist path across renders

  // Handle polyline decoding (only if route is provided)
  useEffect(() => {
    console.log("MapComponent received optimizedRoute:", optimizedRoute);

    // Validate ride_id
    if (!optimizedRoute || !optimizedRoute.ride_id) {
      console.warn("Missing ride_id in optimizedRoute");
      setPath([]);
      pathRef.current = [];
      setGeometryReady(false);
      setDriverPosition(null);
      routeIdRef.current = null;
      return;
    }

    // Skip if route_id hasn't changed
    if (routeIdRef.current === optimizedRoute.ride_id) {
      console.log("Skipping polyline decode for same route_id:", optimizedRoute.ride_id);
      return;
    }

    // If no route data, proceed with driver and passenger markers
    if (!optimizedRoute.route || !optimizedRoute.route.overview_polyline?.points) {
      console.log("No route data provided, rendering map with driver and passenger markers");
      setPath([]);
      pathRef.current = [];
      setGeometryReady(false);
      routeIdRef.current = optimizedRoute.ride_id;
      return;
    }

    const waitForGeometry = setInterval(() => {
      const decodePath = window.google?.maps?.geometry?.encoding?.decodePath;
      if (decodePath) {
        try {
          const decoded = decodePath(optimizedRoute.route.overview_polyline.points);
          console.log("Decoded path length:", decoded.length);
          console.log(
            "First 5 path coordinates:",
            decoded.slice(0, 5).map(p => ({ lat: p.lat(), lng: p.lng() }))
          );
          if (decoded.length > 0) {
            pathRef.current = decoded;
            setPath(decoded);
            if (useSimulation) {
              setDriverPosition({ lat: decoded[0].lat(), lng: decoded[0].lng() });
              setIndex(0);
            }
            setGeometryReady(true);
            routeIdRef.current = optimizedRoute.ride_id;
          } else {
            console.error("Decoded path is empty");
            setPath([]);
            pathRef.current = [];
            setGeometryReady(false);
          }
        } catch (error) {
          console.error("Error decoding polyline:", error);
          setGeometryReady(false);
        }
        clearInterval(waitForGeometry);
      }
    }, 200);

    return () => clearInterval(waitForGeometry);
  }, [optimizedRoute, useSimulation]);

  // Handle real-time location updates
  useEffect(() => {
    if (useSimulation) {
      console.log("Skipping real-time update due to useSimulation=true");
      return;
    }

    if (!currentLocation || currentLocation.latitude == null || currentLocation.longitude == null) {
      console.warn("Invalid or missing currentLocation:", currentLocation);
      setDriverPosition(null);
      return;
    }

    const lat = Number(currentLocation.latitude);
    const lng = Number(currentLocation.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      console.warn("Invalid latitude or longitude values:", { lat, lng });
      setDriverPosition(null);
      return;
    }

    console.log("Setting driver position:", { lat, lng });
    setDriverPosition({ lat, lng });
    setMarkerOpacity(1); // No blinking in real-time mode
  }, [currentLocation, useSimulation]);

  // Blinking effect for simulation mode
  useEffect(() => {
    if (!useSimulation || !geometryReady || pathRef.current.length === 0) {
      setMarkerOpacity(1); // Reset opacity when not simulating
      return;
    }

    const blinkInterval = setInterval(() => {
      setMarkerOpacity((prev) => (prev === 1 ? 0.5 : 1));
    }, 500);

    return () => clearInterval(blinkInterval);
  }, [useSimulation, geometryReady]);

  // Simulation logic
  useEffect(() => {
    if (!useSimulation || !geometryReady || pathRef.current.length === 0) {
      console.log("Simulation not started:", { useSimulation, geometryReady, pathLength: pathRef.current.length });
      return;
    }

    console.log("Starting simulation with path length:", pathRef.current.length);
    const interval = setInterval(() => {
      if (index < pathRef.current.length - 1) {
        const next = pathRef.current[index + 1];
        setDriverPosition({ lat: next.lat(), lng: next.lng() });
        const newLocation = { latitude: next.lat(), longitude: next.lng() }; //ride_id: optimizedRoute?.ride_id // From prop
        console.log("Simulating driver movement:", newLocation);
        onLocationUpdate?.(newLocation);
        setIndex((prev) => prev + 1);
      } else {
        console.log("Simulation complete, reached end of path");
        clearInterval(interval);
      }
    }, 1000);

    return () => {
      console.log("Clearing simulation interval");
      clearInterval(interval);
    };
  }, [useSimulation, geometryReady, index, onLocationUpdate]);

  // Render map if driverPosition or passenger location is available
  if (!driverPosition && !optimizedRoute?.passengers?.length) {
    return (
      <div style={{ height: "400px", textAlign: "center", paddingTop: "150px" }}>
        <p>No location data available</p>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={driverPosition || (optimizedRoute?.passengers?.[0] && {
        lat: optimizedRoute.passengers[0].pickup_lat,
        lng: optimizedRoute.passengers[0].pickup_lng
      }) || { lat: -1.2921, lng: 36.8219 }}
      zoom={14}
      onLoad={(map) => {
        mapRef.current = map;
        console.log("GoogleMap loaded:", map);
      }}
    >
      {path.length > 0 && (
        <Polyline path={path} options={{ strokeColor: "#1E90FF", strokeWeight: 5 }} />
      )}
      {driverPosition && (
        <Marker
          position={driverPosition}
          icon={{
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            scaledSize: new window.google.maps.Size(32, 32),
          }}
          opacity={markerOpacity}
        />
      )}
      {optimizedRoute?.passengers?.map((p, i) => (
        <Marker
          key={i}
          position={{ lat: p.pickup_lat, lng: p.pickup_lng }}
          icon={{
            url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
            scaledSize: new window.google.maps.Size(32, 32),
          }}
        />
      ))}
    </GoogleMap>
  );
}

export default MapComponent;

