import { useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "../styles/home.css"

function Home() {
  const { user } = useContext(AuthContext);

  return (
    <div className="home-container">
      <h1 className="home-title">Welcome to Carpool</h1>

      {user ? (
        <>
          <p className="home-paragraph">
            Connect with drivers and passengers for a seamless carpooling experience. Save money, reduce emissions, and travel together!
          </p>
          <div className="button-group">
            <Link to="/search">
              <button className="home-button find-ride">Find a Ride</button>
            </Link>
            <Link to="/dashboard">
              <button className="home-button dashboard">My Dashboard</button>
            </Link>
          </div>
          <div className="why-choose">
            <h3 className="why-title">Why Choose Us?</h3>
            <ul className="why-list">
              <li>Easy ride matching</li>
              <li>Women-only ride options</li>
              <li>Secure and verified drivers</li>
            </ul>
          </div>
        </>
      ) : (
        <div className="registration-prompt">
          <p className="home-paragraph">
            Join our carpooling community today! Sign up as a passenger to find rides or as a driver to offer your own.
          </p>
          <div className="button-group">
            <Link to="/register">
              <button className="home-button register-passenger">Register as Passenger</button>
            </Link>
            <Link to="/driver/register">
              <button className="home-button register-driver">Register as Driver</button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;



// import {useContext } from "react"; // Added useContext import
// import { Link } from "react-router-dom";
// import { AuthContext } from "../context/AuthContext";
// import "../styles/home.css"


// function Home() {
//   const { user } = useContext(AuthContext);

//   return (
//     <div className="home-container">
//       <h1 className="home-title">Welcome to Carpool</h1>

//       {user ? (
//         <>
//           <p className="home-paragraph">
//             Connect with drivers and passengers for a seamless carpooling experience. Save money, reduce emissions, and travel together!
//           </p>
//           <div className="button-group">
//             <Link to="/search">
//               <button className="home-button find-ride">Find a Ride</button>
//             </Link>
//             <Link to="/dashboard">
//               <button className="home-button dashboard">My Dashboard</button>
//             </Link>
//           </div>
//           <div className="why-choose">
//             <h3 className="why-title">Why Choose Us?</h3>
//             <ul className="why-list">
//               <li>Easy ride matching</li>
//               <li>Women-only ride options</li>
//               <li>Secure and verified drivers</li>
//             </ul>
//           </div>
//         </>
//       ) : (
//         <div>
//           <p className="home-paragraph">
//             Please log in using the button in the navigation bar to search for rides or offer your own!
//           </p>
//         </div>
//       )}
//     </div>
//   );
// }

// export default Home;







// function Home() {
//   const { user } = useContext(AuthContext);

//   return (
//     <div style={{ textAlign: "center", padding: "20px", minHeight: "100vh" }}>
//       <h1 style={{ fontSize: "2.5rem", marginBottom: "20px" }}>Welcome to Carpool</h1>

//       {user ? (
//         <>
//           <p style={{ fontSize: "1.2rem", marginBottom: "20px" }}>
//             Connect with drivers and passengers for a seamless carpooling experience. Save money, reduce emissions, and travel together!
//           </p>
//           <p>hgjgjh</p>
//           <div style={{ marginTop: "20px" }}>
//             <Link to="/search">
//               <button
//                 style={{
//                   padding: "10px 20px",
//                   margin: "0 10px",
//                   fontSize: "16px",
//                   cursor: "pointer",
//                   backgroundColor: "#4CAF50",
//                   color: "white",
//                   border: "none",
//                   borderRadius: "5px",
//                 }}
//               >
//                 Find a Ride
//               </button>
//             </Link>
//             <Link to="/dashboard">
//               <button
//                 style={{
//                   padding: "10px 20px",
//                   margin: "0 10px",
//                   fontSize: "16px",
//                   cursor: "pointer",
//                   backgroundColor: "#2196F3",
//                   color: "white",
//                   border: "none",
//                   borderRadius: "5px",
//                 }}
//               >
//                 My Dashboard
//               </button>
//             </Link>
//           </div>
//           <div style={{ marginTop: "40px" }}>
//             <h3 style={{ fontSize: "1.5rem", marginBottom: "10px" }}>Why Choose Us?</h3>
//             <ul style={{ listStyle: "none", padding: 0, fontSize: "1.1rem" }}>
//               <li style={{ margin: "10px 0" }}>Easy ride matching</li>
//               <li style={{ margin: "10px 0" }}>Women-only ride options</li>
//               <li style={{ margin: "10px 0" }}>Secure and verified drivers</li>
//             </ul>
//           </div>
//         </>
//       ) : (
//         <div>
//           <p style={{ fontSize: "1.2rem", marginBottom: "20px" }}>
//             Please log in using the button in the navigation bar to search for rides or offer your own!
//           </p>
//         </div>
//       )}
//     </div>
//   );
// }

// export default Home;



