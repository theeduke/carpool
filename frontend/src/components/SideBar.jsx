// import { Link } from "react-router-dom";
// import { Home, Users, Calendar, LogOut } from "lucide-react";

// const Sidebar = () => {
//   return (
//     <div className="h-screen w-64 bg-primary text-white flex flex-col p-5">
//       <h2 className="text-2xl font-bold mb-8">Dashboard</h2>

//       <nav className="flex-1 space-y-4">
//         <Link to="/dashboard" className="flex items-center space-x-3 p-3 hover:bg-secondary rounded-md">
//           <Home size={20} />
//           <span>Home</span>
//         </Link>
//         <Link to="/dashboard/users" className="flex items-center space-x-3 p-3 hover:bg-secondary rounded-md">
//           <Users size={20} />
//           <span>Users</span>
//         </Link>
//         <Link to="/dashboard/appointments" className="flex items-center space-x-3 p-3 hover:bg-secondary rounded-md">
//           <Calendar size={20} />
//           <span>Appointments</span>
//         </Link>
//       </nav>

//       <button className="mt-auto flex items-center space-x-3 p-3 hover:bg-red-500 rounded-md">
//         <LogOut size={20} />
//         <span>Logout</span>
//       </button>
//     </div>
//   );
// };

// export default Sidebar;


import React from "react";
import { Link } from "react-router-dom";
import "./Sidebar.css"; // Import CSS

const Sidebar = () => {
    return (
        <div className="sidebar">
            <Link to="/">🏠 Home</Link>
            <Link to="/users">👥 Users</Link>
            <Link to="/calendar">📅 Calendar</Link>
            <Link to="/logout">🚪 Log Out</Link>
        </div>
    );
};

export default Sidebar;
