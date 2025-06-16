import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "../styles/home.css";
import "../styles/unauthHome.css";
import femaleDriver from "../assets/images/femaledriver.png";
import carpoolRideImage from "../assets/images/carpoolRideImage.png";
import earningsImage from "../assets/images/earningIconImage.png";
import flexibilityImage from "../assets/images/flexibilityIconImage.png";
import communityImage from "../assets/images/communityIcon.png";
import rideMatchImage from "../assets/images/rideMatchImage.png";
import verifiedIconImage from "../assets/images/verifiedIconImage.png";

function Home() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [reportType, setReportType] = useState("ride_history");

  const handleFindRide = () => navigate("/search");
  const handleDashboard = () => navigate("/dashboard");
  const handleOfferRide = () => navigate("/driver-dashboard");
  const handleDriverDashboard = () => navigate("/driver-dashboard");

  const handleViewReports = () => {
    navigate(`/reports?type=${reportType}`);
  };

  return (
    <div className="home-container">
      {user ? (
        user.is_driver ? (
          <>
            <section className="hero">
              <div className="hero-content">
                <h1>Drive, Earn, and Connect</h1>
                <p>
                  Offer rides, manage your availability, and earn money while helping others travel sustainably!
                </p>
                <div className="hero-buttons">
                  <button onClick={handleOfferRide} className="cta-btn primary">
                    Offer a Ride
                  </button>
                  <button onClick={handleDriverDashboard} className="cta-btn secondary">
                    Driver Dashboard
                  </button>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="report-select"
                  >
                    <option value="ride_history">Ride History</option>
                    <option value="payment_receipt">Payment Receipts</option>
                    <option value="driver_earnings">Driver Earnings</option>
                  </select>
                  <button onClick={handleViewReports} className="cta-btn tertiary">
                    View Reports
                  </button>
                </div>
              </div>
              <div className="hero-image">
                <img src={carpoolRideImage} alt="Carpool ride illustration" />
              </div>
            </section>
            <section className="features">
              <h2>Why Drive with Us?</h2>
              <div className="feature-list">
                <div className="feature-item">
                  <img src={earningsImage} alt="Earnings image icon" className="feature-icon" />
                  <h3>Earn Extra Income</h3>
                  <p>Make money by offering rides on your schedule.</p>
                </div>
                <div className="feature-item">
                  <img src={flexibilityImage} alt="Flexibility image icon" className="feature-icon" />
                  <h3>Flexible Schedule</h3>
                  <p>Choose when and where you want to drive.</p>
                </div>
                <div className="feature-item">
                  <img src={communityImage} alt="Community image icon" className="feature-icon" />
                  <h3>Join a Community</h3>
                  <p>Connect with passengers and build a network.</p>
                </div>
              </div>
            </section>
            <section className="testimonials">
              <h2>What Our Drivers Say</h2>
              <div className="testimonial-list">
                <div className="testimonial-item">
                  <p>"I love the flexibility and the extra income I earn with Carpool!"</p>
                  <h4>— John D.</h4>
                </div>
                <div className="testimonial-item">
                  <p>"It's great to meet new people while reducing my carbon footprint."</p>
                  <h4>— Michael S.</h4>
                </div>
              </div>
            </section>
            <footer className="footer">
              <p>© 2025 Duke Rides. All rights reserved.</p>
            </footer>
          </>
        ) : (
          <>
            <section className="hero">
              <div className="hero-content">
                <h1>Share the Ride, Save the Planet</h1>
                <p>
                  Connect with drivers and passengers for a seamless carpooling experience. Save money, reduce emissions, and travel together!
                </p>
                <div className="hero-buttons">
                  <button onClick={handleFindRide} className="cta-btn primary">
                    Find a Ride
                  </button>
                  <button onClick={handleDashboard} className="cta-btn secondary">
                    My Dashboard
                  </button>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="report-select"
                  >
                    <option value="ride_history">Ride History</option>
                    <option value="payment_receipt">Payment Receipts</option>
                    <option value="passenger_spending">Passenger Spending</option>
                  </select>
                  <button onClick={handleViewReports} className="cta-btn tertiary">
                    View Reports
                  </button>
                </div>
              </div>
              <div className="hero-image">
                <img src={carpoolRideImage} alt="Carpooling illustration" />
              </div>
            </section>
            <section className="features">
              <h2>Why Choose Us?</h2>
              <div className="feature-list">
                <div className="feature-item">
                  <img src={rideMatchImage} alt="Match image icon" className="feature-icon" />
                  <h3>Easy Ride Matching</h3>
                  <p>Find the perfect ride with our smart matching algorithm.</p>
                </div>
                <div className="feature-item">
                  <img src={femaleDriver} alt="Woman in driver's seat illustration" className="feature-icon" />
                  <h3>Women-Only Ride Options</h3>
                  <p>Feel safe with our women-only ride feature.</p>
                </div>
                <div className="feature-item">
                  <img src={verifiedIconImage} alt="Shield illustrating verification" className="feature-icon" />
                  <h3>Secure & Verified Drivers</h3>
                  <p>All drivers are thoroughly vetted for your safety.</p>
                </div>
              </div>
            </section>
            <section className="testimonials">
              <h2>What Our Users Say</h2>
              <div className="testimonial-list">
                <div className="testimonial-item">
                  <p>"Carpool made my daily commute so much easier and cheaper!"</p>
                  <h4>— Sarah K.</h4>
                </div>
                <div className="testimonial-item">
                  <p>"I feel safe with the women-only option. Highly recommend!"</p>
                  <h4>— Jane M.</h4>
                </div>
              </div>
            </section>
            <footer className="footer">
              <p>© 2025 Carpool. All rights reserved.</p>
            </footer>
          </>
        )
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
          <div className="why-choose">
            <h3 className="why-title">Why Choose Us?</h3>
            <ul className="why-list">
              <li>Easy ride matching</li>
              <li>Women-only ride options</li>
              <li>Secure and verified drivers</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;




// import { useContext, useState } from "react";
// // import { Link, useNavigate } from "report";
// import { Link, useNavigate } from "react-router-dom";
// // import { AuthContext } from "../context";
// import { AuthContext } from "../context/AuthContext";
// import { reportService } from "../services/api";
// import "../styles/home.css"; // For authenticated view
// import "../styles/unauthHome.css"; // For unauthenticated view
// import femaleDriver from "../assets/images/femaledriver.png";
// import carpoolRideImage from "../assets/images/carpoolRideImage.png";
// import earningsImage from "../assets/images/earningIconImage.png";
// import flexibilityImage from '../assets/images/flexibilityIconImage.png';
// // import flexibilityImage from "../assets/lib/pagesizes.js";
// import communityImage from "../assets/images/communityIcon.png";
// import rideMatchImage from "../assets/images/rideMatchImage.png";
// import verifiedIconImage from "../assets/images/verifiedIconImage.png";

// function Home() {
//   const { user } = useContext(AuthContext);
//   const navigate = useNavigate();
//   const [reportType, setReportType] = useState('ride_history');

//   // Handlers for passenger actions
//   const handleFindRide = () => {
//     navigate("/search");
//   };

//   const handleDashboard = () => {
//     navigate("/dashboard");
//   };

//   // Handlers for driver actions
//   const handleOfferRide = () => {
//     navigate("/driver-dashboard");
//   };

//   const handleDriverDashboard = () => {
//     navigate("/driver-dashboard");
//   };

//   // Handler for viewing reports
//   // 
//   const handleViewReports = async () => {
//   try {
//     let response;
//     if (reportType === 'ride_history') {
//       response = await reportService.getRideHistory();
//     } else {
//       response = await reportService.getReports({ report_type: reportType });
//     }
//     if (reportType === 'ride_history') {
//       // Open HTML report in a new tab
//       const blob = new Blob([response.data], { type: 'text/html' });
//       const url = URL.createObjectURL(blob);
//       window.open(url, '_blank');
//       URL.revokeObjectURL(url);
//     } else {
//       // Handle JSON reports (e.g., display in modal or new page)
//       console.log('Report data:', response.data);
//       alert('Report data logged to console. Implement modal or page to display.');
//     }
//   } catch (error) {
//     console.error(`Error fetching ${reportType} report:`, error);
//     alert('Failed to load report. Please try again.');
//   }
// };

//   return (
//     <div className="home-container">
//       {user ? (
//         user.is_driver ? (
//           // Driver-specific authenticated view
//           <>
//             {/* Hero Section for Drivers */}
//             <section className="hero">
//               <div className="hero-content">
//                 <h1>Drive, Earn, and Connect</h1>
//                 <p>
//                   Offer rides, manage your availability, and earn money while helping others travel sustainably!
//                 </p>
//                 <div className="hero-buttons">
//                   <button onClick={handleOfferRide} className="cta-btn primary">
//                     Offer a Ride
//                   </button>
//                   <button onClick={handleDriverDashboard} className="cta-btn secondary">
//                     Driver Dashboard
//                   </button>
//                   <button onClick={handleViewReports} className="cta-btn tertiary">
//                     View Reports
//                   </button>
//                 </div>
//               </div>
//               <div className="hero-image">
//                 <img src={carpoolRideImage} alt="Carpool ride illustration" />
//               </div>
//             </section>

//             {/* Why Drive with Us Section */}
//             <section className="features">
//               <h2>Why Drive with Us?</h2>
//               <div className="feature-list">
//                 <div className="feature-item">
//                   <img src={earningsImage} alt="Earnings image icon" className="feature-icon" />
//                   <h3>Earn Extra Income</h3>
//                   <p>Make money by offering rides on your schedule.</p>
//                 </div>
//                 <div className="feature-item">
//                   <img src={flexibilityImage} alt="Flexibility image icon" className="feature-icon" />
//                   <h3>Flexible Schedule</h3>
//                   <p>Choose when and where you want to drive.</p>
//                 </div>
//                 <div className="feature-item">
//                   <img src={communityImage} alt="Community image icon" className="feature-icon" />
//                   <h3>Join a Community</h3>
//                   <p>Connect with passengers and build a network.</p>
//                 </div>
//               </div>
//             </section>

//             {/* Testimonials Section */}
//             <section className="testimonials">
//               <h2>What Our Drivers Say</h2>
//               <div className="testimonial-list">
//                 <div className="testimonial-item">
//                   <p>"I love the flexibility and the extra income I earn with Carpool!"</p>
//                   <h4>— John D.</h4>
//                 </div>
//                 <div className="testimonial-item">
//                   <p>"It's great to meet new people while reducing my carbon footprint."</p>
//                   <h4>— Michael S.</h4>
//                 </div>
//               </div>
//             </section>

//             {/* Footer */}
//             <footer className="footer">
//               <p>© 2025 Carpool. All rights reserved.</p>
//             </footer>
//           </>
//         ) : (
//           // Passenger-specific authenticated view
//           <>
//             {/* Hero Section for Passengers */}
//             <section className="hero">
//               <div className="hero-content">
//                 <h1>Share the Ride, Save the Planet</h1>
//                 <p>
//                   Connect with drivers and passengers for a seamless carpooling experience. Save money, reduce emissions, and travel together!
//                 </p>
//                 <div className="hero-buttons">
//                   <button onClick={handleFindRide} className="cta-btn primary">
//                     Find a Ride
//                   </button>
//                   <button onClick={handleDashboard} className="cta-btn secondary">
//                     My Dashboard
//                   </button>
//                   <button onClick={handleViewReports} className="cta-btn tertiary">
//                     View Reports
//                   </button>
//                 </div>
//               </div>
//               <div className="hero-image">
//                 <img src={carpoolRideImage} alt="Carpooling illustration" />
//               </div>
//             </section>

//             {/* Why Choose Us Section */}
//             <section className="features">
//               <h2>Why Choose Us?</h2>
//               <div className="feature-list">
//                 <div className="feature-item">
//                   <img src={rideMatchImage} alt="Match image icon associating users to carpool" className="feature-icon" />
//                   <h3>Easy Ride Matching</h3>
//                   <p>Find the perfect ride with our smart matching algorithm.</p>
//                 </div>
//                 <div className="feature-item">
//                   <img src={femaleDriver} alt="Woman in driver's seat illustration female ride" className="feature-icon" />
//                   <h3>Women-Only Ride Options</h3>
//                   <p>Feel safe with our women-only ride feature.</p>
//                 </div>
//                 <div className="feature-item">
//                   <img src={verifiedIconImage} alt="Shield illustrating verification and security" className="feature-icon" />
//                   <h3>Secure & Verified Drivers</h3>
//                   <p>All drivers are thoroughly vetted for your safety.</p>
//                 </div>
//               </div>
//             </section>

//             {/* Testimonials Section */}
//             <section className="testimonials">
//               <h2>What Our Users Say</h2>
//               <div className="testimonial-list">
//                 <div className="testimonial-item">
//                   <p>"Carpool made my daily commute so much easier and cheaper!"</p>
//                   <h4>— Sarah K.</h4>
//                 </div>
//                 <div className="testimonial-item">
//                   <p>"I feel safe with the women-only option. Highly recommend!"</p>
//                   <h4>— Jane M.</h4>
//                 </div>
//               </div>
//             </section>

//             {/* Footer */}
//             <footer className="footer">
//               <p>© 2025 Carpool. All rights reserved.</p>
//             </footer>
//           </>
//         )
//       ) : (
//         // Unauthenticated view (unchanged)
//         <div className="registration-prompt">
//           <p className="home-paragraph">
//             Join our carpooling community today! Sign up as a passenger to find rides or as a driver to offer your own.
//           </p>
//           <div className="button-group">
//             <Link to="/register">
//               <button className="home-button register-passenger">Register as Passenger</button>
//             </Link>
//             <Link to="/driver/register">
//               <button className="home-button register-driver">Register as Driver</button>
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
//         </div>
//       )}
//     </div>
//   );
// }

// export default Home;




// import { useContext } from "react";
// import { Link, useNavigate } from "react-router-dom";
// import { AuthContext } from "../context/AuthContext";

// // import { FaDollarSign, FaClock, FaUsers } from 'react-icons/fa';
// import "../styles/home.css"; // For unauthenticated view
// import "../styles/unauthHome.css"; // For authenticated view
// import femaleDriver from '../assets/images/femaledriver.png';
// import carpoolRideImage from '../assets/images/carpoolRideImage.png';
// import earningsImage from '../assets/images/earningIconImage.png';
// import flexibilityImage from '../assets/images/flexibilityIconImage.png';
// import communityImage from '../assets/images/communityIcon.png';
// import rideMatchImage from '../assets/images/rideMatchImage.png';
// import verifiedIconImage from '../assets/images/verifiedIconImage.png';



// function Home() {
//   const { user } = useContext(AuthContext);
//   const navigate = useNavigate();

//   // Handlers for passenger actions
//   const handleFindRide = () => {
//     navigate("/search");
//   };

//   const handleDashboard = () => {
//     navigate("/dashboard");
//   };

//   // Handlers for driver actions
//   const handleOfferRide = () => {
//     navigate("/driver-dashboard"); // Assuming a route for offering a ride
//   };

//   const handleDriverDashboard = () => {
//     navigate("/driver-dashboard");
//   };

//   return (
//     <div className="home-container">
//       {/* Navbar for all users */}
//       {/* <Navbar /> */}

//       {/* <h1 className="home-title">Welcome to Carpool</h1> */}

//       {user ? (
//         user.is_driver ? (
//           // Driver-specific authenticated view
//           <>
//             {/* Hero Section for Drivers */}
//             <section className="hero">
//               <div className="hero-content">
//                 <h1>Drive, Earn, and Connect</h1>
//                 <p>
//                   Offer rides, manage your availability, and earn money while helping others travel sustainably!
//                 </p>
//                 <div className="hero-buttons">
//                   <button onClick={handleOfferRide} className="cta-btn primary">
//                     Offer a Ride
//                   </button>
//                   <button onClick={handleDriverDashboard} className="cta-btn secondary">
//                     Driver Dashboard
//                   </button>
//                 </div>
//               </div>
//               <div className="hero-image">
//                 <img src={carpoolRideImage} alt="Carpool ride illustration" />
//               </div>
//             </section>

//             {/* Why Drive with Us Section */}
//             <section className="features">
//               <h2>Why Drive with Us?</h2>
//               <div className="feature-list">
//                 <div className="feature-item">
//                   {/* <FaDollarSign className="feature-icon" /> */}
//                   <img src={earningsImage} alt="Earnings image icon" className="feature-icon" />
//                   <h3>Earn Extra Income</h3>
//                   <p>Make money by offering rides on your schedule.</p>
//                 </div>
//                 <div className="feature-item">
//                   {/* <FaClock className="feature-icon" /> */}
//                   <img src={flexibilityImage} alt="Flexibility image icon" className="feature-icon" />
//                   <h3>Flexible Schedule</h3>
//                   <p>Choose when and where you want to drive.</p>
//                 </div>
//                 <div className="feature-item">
//                   {/* <FaUsers className="feature-icon" /> */}
//                   <img src={communityImage} alt="Community image icon" className="feature-icon" />
//                   <h3>Join a Community</h3>
//                   <p>Connect with passengers and build a network.</p>
//                 </div>
//               </div>
//             </section>

//             {/* Testimonials Section */}
//             <section className="testimonials">
//               <h2>What Our Drivers Say</h2>
//               <div className="testimonial-list">
//                 <div className="testimonial-item">
//                   <p>"I love the flexibility and the extra income I earn with Carpool!"</p>
//                   <h4>— John D.</h4>
//                 </div>
//                 <div className="testimonial-item">
//                   <p>"It's great to meet new people while reducing my carbon footprint."</p>
//                   <h4>— Michael S.</h4>
//                 </div>
//               </div>
//             </section>

//             {/* Footer */}
//             <footer className="footer">
//               <p>© 2025 Carpool. All rights reserved.</p>
//             </footer>
//           </>
//         ) : (
//           // Passenger-specific authenticated view
//           <>
//             {/* Hero Section for Passengers */}
//             <section className="hero">
//               <div className="hero-content">
//                 <h1>Share the Ride, Save the Planet</h1>
//                 <p>
//                   Connect with drivers and passengers for a seamless carpooling experience. Save money, reduce emissions, and travel together!
//                 </p>
//                 <div className="hero-buttons">
//                   <button onClick={handleFindRide} className="cta-btn primary">
//                     Find a Ride
//                   </button>
//                   <button onClick={handleDashboard} className="cta-btn secondary">
//                     My Dashboard
//                   </button>
//                 </div>
//               </div>
//               <div className="hero-image">
//                 <img src={carpoolRideImage} alt="Carpooling illustration" />
//               </div>
//             </section>

//             {/* Why Choose Us Section */}
//             <section className="features">
//               <h2>Why Choose Us?</h2>
//               <div className="feature-list">
//                 <div className="feature-item">
//                   <img src={rideMatchImage}  alt="Match image icon associating users to carpool" className="feature-icon" />
//                   <h3>Easy Ride Matching</h3>
//                   <p>Find the perfect ride with our smart matching algorithm.</p>
//                 </div>
//                 <div className="feature-item">
//                   <img src={femaleDriver} alt="Woman in driver's seat illustration female ride" className="feature-icon" />
//                   <h3>Women-Only Ride Options</h3>
//                   <p>Feel safe with our women-only ride feature.</p>
//                 </div>
//                 <div className="feature-item">
//                   <img src={verifiedIconImage}alt="Shield illustrating verification and security" className="feature-icon" />
//                   <h3>Secure & Verified Drivers</h3>
//                   <p>All drivers are thoroughly vetted for your safety.</p>
//                 </div>
//               </div>
//             </section>

//             {/* Testimonials Section */}
//             <section className="testimonials">
//               <h2>What Our Users Say</h2>
//               <div className="testimonial-list">
//                 <div className="testimonial-item">
//                   <p>"Carpool made my daily commute so much easier and cheaper!"</p>
//                   <h4>— Sarah K.</h4>
//                 </div>
//                 <div className="testimonial-item">
//                   <p>"I feel safe with the women-only option. Highly recommend!"</p>
//                   <h4>— Jane M.</h4>
//                 </div>
//               </div>
//             </section>

//             {/* Footer */}
//             <footer className="footer">
//               <p>© 2025 Carpool. All rights reserved.</p>
//             </footer>
//           </>
//         )
//       ) : (
//         // Unauthenticated view (same as before)
//         <div className="registration-prompt">
//           <p className="home-paragraph">
//             Join our carpooling community today! Sign up as a passenger to find rides or as a driver to offer your own.
//           </p>
//           <div className="button-group">
//             <Link to="/register">
//               <button className="home-button register-passenger">Register as Passenger</button>
//             </Link>
//             <Link to="/driver/register">
//               <button className="home-button register-driver">Register as Driver</button>
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
//         </div>
//       )}
//     </div>
//   );
// }

// export default Home;
