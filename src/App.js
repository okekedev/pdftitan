// src/App.js - Modern JSX with Simplified Navigation
import React, { useState, useEffect } from "react";
import sessionManager from "./services/sessionManager";
import Login from "./pages/Login";
import Jobs from "./pages/Jobs";
import Attachments from "./pages/Attachments";
import "./App.css";

export default function App() {
  const [technician, setTechnician] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState("jobs");
  const [selectedJob, setSelectedJob] = useState(null);

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
                src="\images\favicon.svg"
                alt="1-A Services"
                className="logo-image"
              ></img>
              <span className="logo-icon"></span>
              <h1>TitanPDF</h1>
            </button>

            {/* Breadcrumb Navigation */}
            <nav className="breadcrumb-nav" aria-label="Navigation">
              <button
                className={`breadcrumb-item ${
                  currentPage === "jobs" ? "active" : ""
                }`}
                onClick={() => handleBackToJobs()}
              >
                My Jobs
              </button>
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

          <div className="header-right">
            <div className="user-info">
              <span className="user-icon"></span>
              <div className="user-details">
                <span className="user-name">{technician.name}</span>
                <span className="user-role">Technician</span>
              </div>
            </div>
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

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-container">
          <p>&copy; 2024 TitanPDF - Technician Portal</p>
          <div className="footer-status">
            <span className="status-indicator online"></span>
            <span>Connected to ServiceTitan</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
