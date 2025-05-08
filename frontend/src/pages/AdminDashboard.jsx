import { useEffect, useState } from "react";
import { adminService } from './services/api'; // Adjust path as needed

function AdminDashboard() {
  const [disputes, setDisputes] = useState([]);
  const [error, setError] = useState(null); // Added for better error handling

  useEffect(() => {
    const fetchDisputes = async () => {
      try {
        const response = await adminService.getAllDisputes();
        setDisputes(response.data);
      } catch (error) {
        console.error("Error fetching disputes:", error);
        setError("Failed to fetch disputes: " + (error.response?.data?.error || "Unknown error"));
      }
    };
    fetchDisputes();
  }, []);

  const handleResolveDispute = async (disputeId, action) => {
    const notes = prompt("Enter resolution notes:");
    let amount = null;
    if (action === "adjust") {
      amount = prompt("Enter adjustment amount:");
      if (!amount || isNaN(amount) || Number(amount) <= 0) {
        alert("Invalid amount");
        return;
      }
    }
    try {
      await adminService.resolveDispute(disputeId, {
        action,
        resolution_notes: notes,
        amount: amount ? Number(amount) : null, // Convert to number if provided
      });
      alert("Dispute resolved!");
      // Refresh disputes
      const response = await adminService.getAllDisputes();
      setDisputes(response.data);
    } catch (error) {
      console.error("Error resolving dispute:", error);
      alert("Failed to resolve dispute: " + (error.response?.data?.error || "Unknown error"));
    }
  };

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <h2>Disputes</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {disputes.length > 0 ? (
        disputes.map((dispute) => (
          <div key={dispute.id} style={{ border: "1px solid #ccc", padding: "10px", margin: "10px 0" }}>
            <p><strong>User:</strong> {dispute.user}</p>
            <p><strong>Ride ID:</strong> {dispute.ride_id || "N/A"}</p>
            <p><strong>Transaction ID:</strong> {dispute.transaction_id || "N/A"}</p>
            <p><strong>Reason:</strong> {dispute.reason}</p>
            <p><strong>Status:</strong> {dispute.status}</p>
            <p><strong>Notes:</strong> {dispute.resolution_notes || "None"}</p>
            <p><strong>Created:</strong> {new Date(dispute.created_at).toLocaleString()}</p>
            {dispute.status === "pending" && (
              <>
                <button onClick={() => handleResolveDispute(dispute.id, "approve")}>Approve</button>
                <button onClick={() => handleResolveDispute(dispute.id, "reject")}>Reject</button>
                <button onClick={() => handleResolveDispute(dispute.id, "adjust")}>Adjust</button>
              </>
            )}
          </div>
        ))
      ) : (
        <p>No disputes found.</p>
      )}
    </div>
  );
}

export default AdminDashboard;





// import { useEffect, useState } from "react";
// import axios from "axios";

// function AdminDashboard() {
//     const [disputes, setDisputes] = useState([]);
  
//     useEffect(() => {
//       const fetchDisputes = async () => {
//         try {
//           const response = await axios.get("http://localhost:8000/api/all-disputes/", {
//             headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
//           });
//           setDisputes(response.data);
//         } catch (error) {
//           console.error("Error fetching disputes:", error);
//           alert("Failed to fetch disputes: " + (error.response?.data?.error || "Unknown error"));
//         }
//       };
//       fetchDisputes();
//     }, []);
  
//     const handleResolveDispute = async (disputeId, action) => {
//       const notes = prompt("Enter resolution notes:");
//       let amount = null;
//       if (action === "adjust") {
//         amount = prompt("Enter adjustment amount:");
//         if (!amount || isNaN(amount) || Number(amount) <= 0) {
//           alert("Invalid amount");
//           return;
//         }
//       }
//       try {
//         await axios.post(
//           `http://localhost:8000/api/resolve-dispute/${disputeId}/`,
//           { action, resolution_notes: notes, amount },
//           { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
//         );
//         alert("Dispute resolved!");
//         // Refresh disputes
//         const response = await axios.get("http://localhost:8000/api/all-disputes/", {
//           headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
//         });
//         setDisputes(response.data);
//       } catch (error) {
//         alert("Failed to resolve dispute: " + (error.response?.data?.error || "Unknown error"));
//       }
//     };
  
//     return (
//       <div>
//         <h1>Admin Dashboard</h1>
//         <h2>Disputes</h2>
//         {disputes.length > 0 ? (
//           disputes.map((dispute) => (
//             <div key={dispute.id} style={{ border: "1px solid #ccc", padding: "10px", margin: "10px 0" }}>
//               <p><strong>User:</strong> {dispute.user}</p>
//               <p><strong>Ride ID:</strong> {dispute.ride_id || "N/A"}</p>
//               <p><strong>Transaction ID:</strong> {dispute.transaction_id || "N/A"}</p>
//               <p><strong>Reason:</strong> {dispute.reason}</p>
//               <p><strong>Status:</strong> {dispute.status}</p>
//               <p><strong>Notes:</strong> {dispute.resolution_notes || "None"}</p>
//               <p><strong>Created:</strong> {new Date(dispute.created_at).toLocaleString()}</p>
//               {dispute.status === "pending" && (
//                 <>
//                   <button onClick={() => handleResolveDispute(dispute.id, "approve")}>Approve</button>
//                   <button onClick={() => handleResolveDispute(dispute.id, "reject")}>Reject</button>
//                   <button onClick={() => handleResolveDispute(dispute.id, "adjust")}>Adjust</button>
//                 </>
//               )}
//             </div>
//           ))
//         ) : (
//           <p>No disputes found.</p>
//         )}
//       </div>
//     );
//   }
  
//   export default AdminDashboard;

// function AdminDashboard() {
//   const [disputes, setDisputes] = useState([]);

//   useEffect(() => {
//     const fetchDisputes = async () => {
//         try {
//           const response = await axios.get("http://localhost:8000/api/all-disputes/", {
//             headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
//           });
//           setDisputes(response.data);
//         } catch (error) {
//           console.error("Error fetching disputes:", error);
//           alert("Failed to fetch disputes: " + (error.response?.data?.error || "Unknown error"));
//         }
//       };
//       fetchDisputes();
//     }, []);

//   const handleResolveDispute = async (disputeId, action) => {
//     const notes = prompt("Enter resolution notes:");
//     try {
//       await axios.post(
//         `http://localhost:8000/api/resolve-dispute/${disputeId}/`,
//         { action, resolution_notes: notes },
//         { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
//       );
//       alert("Dispute resolved!");
//       // Refresh disputes
//     } catch (error) {
//       alert("Failed to resolve dispute: " + (error.response?.data?.error || "Unknown error"));
//     }
//   };

//   return (
//     <div>
//       <h1>Admin Dashboard</h1>
//       <h2>Disputes</h2>
//       {disputes.length > 0 ? (
//         disputes.map((dispute) => (
//           <div key={dispute.id} style={{ border: "1px solid #ccc", padding: "10px", margin: "10px 0" }}>
//             <p>User: {dispute.user}</p>
//             <p>Ride: {dispute.ride || "N/A"}</p>
//             <p>Transaction: {dispute.transaction || "N/A"}</p>
//             <p>Reason: {dispute.reason}</p>
//             <p>Status: {dispute.status}</p>
//             {dispute.status === "pending" && (
//               <>
//                 <button onClick={() => handleResolveDispute(dispute.id, "approve")}>Approve</button>
//                 <button onClick={() => handleResolveDispute(dispute.id, "reject")}>Reject</button>
//                 <button onClick={() => handleResolveDispute(dispute.id, "adjust")}>Adjust</button>
//               </>
//             )}
//           </div>
//         ))
//       ) : (
//         <p>No disputes found.</p>
//       )}
//     </div>
//   );
// }

// export default AdminDashboard;