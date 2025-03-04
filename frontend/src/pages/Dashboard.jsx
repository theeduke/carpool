import Sidebar from "../components/SideBar";

const Dashboard = () => {
  return (
    <div className="flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 p-8 bg-gray-100 min-h-screen">
        <h1 className="text-3xl font-bold">Welcome to the Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage users, appointments, and settings.</p>
      </div>
    </div>
  );
};

export default Dashboard;
