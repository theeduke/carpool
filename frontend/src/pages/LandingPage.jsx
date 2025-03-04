import { Link } from "react-router-dom";

const LandingPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-primary">
      {/* Hero Section */}
      <section className="text-center p-10">
        <h1 className="text-5xl font-bold mb-4">Welcome to Our Platform</h1>
        <p className="text-lg text-secondary">
          Experience seamless booking and management with ease.
        </p>
        <div className="mt-6">
          <Link to="/dashboard">
            <button className="bg-primary text-white px-6 py-3 rounded-lg shadow-md hover:bg-secondary transition">
              Get Started
            </button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 px-6">
        <div className="bg-white p-6 rounded-lg shadow-lg text-center">
          <h3 className="text-xl font-semibold">Easy Booking</h3>
          <p className="text-gray-600">Schedule your appointments with ease.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-lg text-center">
          <h3 className="text-xl font-semibold">Secure Payments</h3>
          <p className="text-gray-600">Process payments safely with Pesapal.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-lg text-center">
          <h3 className="text-xl font-semibold">User Friendly</h3>
          <p className="text-gray-600">Simple and intuitive interface for all.</p>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
