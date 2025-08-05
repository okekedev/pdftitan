import React, { useState, useEffect } from "react";
import sessionManager from "./services/sessionManager";
import Login from "./pages/Login/Login";
import Jobs from "./pages/Jobs/Jobs";
import Attachments from "./pages/Attachments/Attachments";
import Documentation from "./pages/Documentation/Documentation";
import Footer from "./components/Footer/Footer"; // ✅ Import Footer component
import "./App.css";

export default function App() {
  const [technician, setTechnician] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState("jobs");
  const [selectedJob, setSelectedJob] = useState(null);
  const [helpSection, setHelpSection] = useState("support");

  // Check for existing session on app load
  useEffect(() => {
    const existingSession = sessionManager.getTechnicianSession();
    if (existingSession) {
      console.log(
        "✅ Found existing session:",
        existingSession.technician?.name
      );
      setTechnician(existingSession.technician);
      setCurrentPage("jobs");
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (userData) => {
    sessionManager.setTechnicianSession(userData);
    setTechnician(userData.technician);
    setCurrentPage("jobs");
  };

  const handleLogout = () => {
    sessionManager.clearTechnicianSession();
    setTechnician(null);
    setSelectedJob(null);
    setCurrentPage("jobs");
  };

  const handleSelectJob = (job) => {
    setSelectedJob(job);
    setCurrentPage("attachments");
  };

  const handleBackToJobs = () => {
    setSelectedJob(null);
    setCurrentPage("jobs");
  };

  // ✅ Documentation navigation functions
  const handleShowDocumentation = (section = "support") => {
    console.log(`Navigating to Documentation section: ${section}`);
    setHelpSection(section);
    setCurrentPage("documentation");
  };

  const handleBackFromDocumentation = () => {
    if (selectedJob) {
      setCurrentPage("attachments");
    } else {
      setCurrentPage("jobs");
    }
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>Loading TitanPDF...</h2>
          <p>Checking your session...</p>
        </div>
      </div>
    );
  }

  if (!technician) {
    return <Login onLogin={handleLogin} />;
  }

  // ✅ Show Documentation page
  if (currentPage === "documentation") {
    return (
      <Documentation 
        onBack={handleBackFromDocumentation}
        initialSection={helpSection}
      />
    );
  }

  return (
    <div className="app">
      {/* Header with Navigation */}
      <header className="app-header">
        <div className="header-container">
          <div className="header-left">
            <button
              className="logo-btn"
              onClick={() => handleBackToJobs()}
              aria-label="Go to jobs"
            >
              <img
                src="/web-app-manifest-192x192.png"
                alt="1-A Services"
                className="logo-image"
              />
              <span className="logo-icon"></span>
            </button>

            {/* Breadcrumb Navigation */}
            <nav className="breadcrumb-nav" aria-label="Navigation">
              {selectedJob && (
                <>
                  <span className="breadcrumb-separator">→</span>
                  <span className="breadcrumb-item active">
                    📎 {selectedJob.title}
                  </span>
                </>
              )}
            </nav>
          </div>

          {/* Center - Technician Info */}
          <div className="header-center">
            <div className="user-info">
              <span className="user-icon"></span>
              <div className="user-details">
                <span className="user-name">{technician.name}</span>
                <span className="user-role">Technician</span>
              </div>
            </div>
          </div>

          <div className="header-right">
            {/* ✅ Help Button */}
            <button
              onClick={() => handleShowDocumentation('support')}
              style={{
                background: "rgba(72, 187, 120, 0.1)",
                border: "1px solid rgba(72, 187, 120, 0.3)",
                color: "#2f855a",
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                fontSize: "0.8rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontWeight: "600",
                marginRight: "1rem"
              }}
            >
              <span>❓</span>
              <span>Help</span>
            </button>
            
            <button
              className="logout-btn"
              onClick={handleLogout}
              aria-label="Logout"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {currentPage === "jobs" ? (
          <Jobs technician={technician} onSelectJob={handleSelectJob} />
        ) : (
          <Attachments job={selectedJob} onBack={handleBackToJobs} />
        )}
      </main>

      {/* ✅ Footer Component with Navigation */}
      <Footer onShowDocumentation={handleShowDocumentation} />
    </div>
  );
}