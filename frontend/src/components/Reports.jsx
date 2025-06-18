import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { reportService } from "../services/api";
import { jsPDF } from "jspdf";
import "../styles/reports.css";

function Reports() {
  const navigate = useNavigate();
  const location = useLocation();
  const [reportHtml, setReportHtml] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Get query params
  const queryParams = new URLSearchParams(location.search);
  const reportType = queryParams.get("type") || "ride_history";
  const month = queryParams.get("month") || "";
  const year = queryParams.get("year") || new Date().getFullYear().toString();

  // Filter state
  const [filterMonth, setFilterMonth] = useState(month);
  const [filterYear, setFilterYear] = useState(year);

  // Generate year options (current year and past 5 years)
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
  const months = [
    { value: "", label: "All Months" },
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        let response;
        const params = {};
        if (filterMonth && !isNaN(parseInt(filterMonth)) && parseInt(filterMonth) >= 1 && parseInt(filterMonth) <= 12) {
          params.month = parseInt(filterMonth);
        }
        if (filterYear && !isNaN(parseInt(filterYear)) && parseInt(filterYear) >= 2000 && parseInt(filterYear) <= new Date().getFullYear()) {
          params.year = parseInt(filterYear);
        } else if (filterYear) {
          throw new Error("Invalid year selected.");
        }

        switch (reportType) {
          case "ride_history":
            response = await reportService.getRideHistory(params);
            break;
          case "payment_receipt":
            response = await reportService.getPaymentReceipts(params);
            break;
          case "driver_earnings":
            response = await reportService.getDriverEarnings(params);
            break;
          case "passenger_spending":
            response = await reportService.getPassengerSpending(params);
            break;
          default:
            throw new Error("Invalid report type");
        }
        setReportHtml(response.data);
      } catch (err) {
        console.error("Error fetching report:", err);
        setError(err.message || "Failed to load report. Please check your filters or try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportType, filterMonth, filterYear]);

  const handleReportTypeChange = (e) => {
    const newType = e.target.value;
    const params = new URLSearchParams({ type: newType });
    if (filterMonth) params.set("month", filterMonth);
    if (filterYear) params.set("year", filterYear);
    navigate(`/reports?${params.toString()}`);
  };

  const handleFilterChange = () => {
    const params = new URLSearchParams({ type: reportType });
    if (filterMonth && !isNaN(parseInt(filterMonth)) && parseInt(filterMonth) >= 1 && parseInt(filterMonth) <= 12) {
      params.set("month", parseInt(filterMonth));
    }
    if (filterYear && !isNaN(parseInt(filterYear)) && parseInt(filterYear) >= 2000 && parseInt(filterYear) <= new Date().getFullYear()) {
      params.set("year", parseInt(filterYear));
    } else if (filterYear) {
      setError("Invalid year selected. Please choose a year between 2000 and the current year.");
      return;
    }
    navigate(`/reports?${params.toString()}`);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait', //or landscape
      unit: 'mm',
      format: 'a4', //options: 'a4', 'letter', 'a3', or [width, height] for custom size
    });
    doc.html(document.querySelector('.report-content'), {
      callback: (doc) => doc.save(`${reportType}-${filterMonth || 'all'}-${filterYear || 'all'}.pdf`),
      x: 5,
      y: 5,
      html2canvas: { scale: 0.2 }, //adjust scale  for size vs. quality
    });
  };

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h1>Reports</h1>
        <div className="reports-controls">
          <select
            value={reportType}
            onChange={handleReportTypeChange}
            className="report-select"
          >
            <option value="ride_history">Ride History</option>
            <option value="payment_receipt">Payment Receipts</option>
            {localStorage.getItem("is_driver") === "true" ? (
              <option value="driver_earnings">Driver Earnings</option>
            ) : (
              <option value="passenger_spending">Passenger Spending</option>
            )}
          </select>
          <div className="filter-form">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="filter-select"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="filter-select"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button onClick={handleFilterChange} className="cta-btn tertiary">
              Apply Filter
            </button>
            <button onClick={handleDownloadPDF} className="cta-btn tertiary">
              Download PDF
            </button>
          </div>
        </div>
      </div>
      {loading && <p>Loading report...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && (
        <div
          className="report-content"
          dangerouslySetInnerHTML={{ __html: reportHtml }}
        />
      )}
    </div>
  );
}

export default Reports;
