import { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { AuthContext } from "../context/AuthContext"; // Adjust path
import { authService } from "../services/api"; // Adjust path

const GoogleLoginButton = () => {
  const { login, googleLogin } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [phone_number, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // GIS Initialization
  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (
        window.google &&
        window.google.accounts &&
        window.google.accounts.id
      ) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
          auto_select: true,
        });

        window.google.accounts.id.renderButton(
          document.getElementById("googleSignInButton"),
          { theme: "outline", size: "large" }
        );

        // One-tap prompt with control
        if (!sessionStorage.getItem("googlePromptShown")) {
          setTimeout(() => {
            window.google.accounts.id.prompt((notification) => {
              if (
                notification.isNotDisplayed() ||
                notification.isSkippedMoment()
              ) {
                console.log("One-tap prompt skipped or not displayed");
              } else {
                sessionStorage.setItem("googlePromptShown", "true");
              }
            });
          }, 2000); // Delay by 2 seconds to reduce intrusiveness
        }
      } else {
        console.error("Google Identity Services not available");
      }
    };

    // Check if GIS script is already loaded
    if (
      window.google &&
      window.google.accounts &&
      window.google.accounts.id
    ) {
      initializeGoogleSignIn();
    } else {
      // Dynamically load the GIS script
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleSignIn;
      script.onerror = () =>
        console.error("Failed to load Google Identity Services script");
      document.body.appendChild(script);

      // Cleanup script on component unmount
      return () => {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      };
    }
  }, []);

  const handleGoogleResponse = async (response) => {
    try {
      await googleLogin(response.credential);
      toast.success("Google login successful!");
      navigate("/"); // Stay on homepage
    } catch (error) {
      console.error("Google login error:", error);
      toast.error(
        "Google login failed: " +
          (error.response?.data?.error || "Unknown error")
      );
    }
  };

  // Traditional Login Handler
  const handleTraditionalLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login({ phone_number, password });
      toast.success("Login successful!");
      setShowModal(false);
      navigate("/");
    } catch (error) {
      console.error("Login error:", error);
      setError(error.response?.data?.error || "Invalid credentials");
      toast.error("Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Google Sign-In Button */}
      <div id="googleSignInButton"></div>

      {/* Traditional Login Button */}
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Login with Phone
      </button>

      {/* Modal for Traditional Login */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Login</h2>
            <form onSubmit={handleTraditionalLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700"
                >
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={phone_number}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  className="mt-1 w-full p-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your Phone number"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  >password
                  </label>
                  <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="mt-1 w-full p-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your password"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex justify-between">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Logging in..." : "Login"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleLoginButton;




// components/GoogleLoginButton.jsx
// import { useEffect, useState, useContext } from "react";
// import { useNavigate } from "react-router-dom";
// import { toast } from "react-toastify";
// import { AuthContext } from "../context/AuthContext"; // Adjust path
// import { authService } from "../services/api"; // Adjust path

// const GoogleLoginButton = () => {
//   const { login, googleLogin } = useContext(AuthContext);
//   const navigate = useNavigate();
//   const [showModal, setShowModal] = useState(false);
//   const [phone_number, setPhoneNumber] = useState("");
//   const [password, setPassword] = useState("");
//   const [error, setError] = useState(null);
//   const [loading, setLoading] = useState(false);

//   // GIS Initialization
//   useEffect(() => {
//     /* global google */
//     if (window.google) {
//       google.accounts.id.initialize({
//         client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
//         callback: handleGoogleResponse,
//         auto_select: true,
//       });

//       google.accounts.id.renderButton(
//         document.getElementById("googleSignInButton"),
//         { theme: "outline", size: "large" }
//       );

//       // One-tap prompt with control
//       if (!sessionStorage.getItem("googlePromptShown")) {
//         setTimeout(() => {
//           google.accounts.id.prompt((notification) => {
//             if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
//               console.log("One-tap prompt skipped or not displayed");
//             } else {
//               sessionStorage.setItem("googlePromptShown", "true");
//             }
//           });
//         }, 2000); // Delay by 2 seconds to reduce intrusiveness
//       }
//     }
//   }, []);

//   const handleGoogleResponse = async (response) => {
//     try {
//       await googleLogin(response.credential);
//       toast.success("Google login successful!");
//       navigate("/"); // Stay on homepage
//     } catch (error) {
//       console.error("Google login error:", error);
//       toast.error("Google login failed: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   // Traditional Login Handler
//   const handleTraditionalLogin = async (e) => {
//     e.preventDefault();
//     setLoading(true);
//     setError(null);

//     try {
//       await login({ phone_number, password });
//       toast.success("Login successful!");
//       setShowModal(false);
//       navigate("/");
//     } catch (error) {
//       console.error("Login error:", error);
//       setError(error.response?.data?.error || "Invalid credentials");
//       toast.error("Login failed");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="flex flex-col items-center space-y-4">
//       {/* Google Sign-In Button */}
//       <div id="googleSignInButton"></div>

//       {/* Traditional Login Button */}
//       <button
//         onClick={() => setShowModal(true)}
//         className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
//       >
//         Login with Phone
//       </button>

//       {/* Modal for Traditional Login */}
//       {showModal && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
//             <h2 className="text-xl font-bold mb-4">Login</h2>
//             <form onSubmit={handleTraditionalLogin} className="space-y-4">
//               <div>
//                 <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
//                   Phone Number
//                 </label>
//                 <input
//                   type="te;"
//                   id="phone"
//                   value={phone_number}
//                   onChange={(e) => setPhoneNumber(e.target.value)}
//                   required
//                   className="mt-1 w-full p-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
//                   placeholder="Enter your Phone number"
//                 />
//               </div>
//               <div>
//                 <label htmlFor="password" className="block text-sm font-medium text-gray-700">
//                   Password
//                 </label>
//                 <input
//                   type="password"
//                   id="password"
//                   value={password}
//                   onChange={(e) => setPassword(e.target.value)}
//                   required
//                   className="mt-1 w-full p-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
//                   placeholder="Enter your password"
//                 />
//               </div>
//               {error && <p className="text-red-500 text-sm">{error}</p>}
//               <div className="flex justify-between">
//                 <button
//                   type="submit"
//                   disabled={loading}
//                   className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
//                 >
//                   {loading ? "Logging in..." : "Login"}
//                 </button>
//                 <button
//                   type="button"
//                   onClick={() => setShowModal(false)}
//                   className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400"
//                 >
//                   Cancel
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default GoogleLoginButton;