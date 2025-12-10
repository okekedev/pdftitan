import React, { useState, useEffect } from "react";
import sessionManager from "./services/sessionManager";
import Login from "./pages/Login/Login";
import Jobs from "./pages/Jobs/Jobs";
import Attachments from "./pages/Attachments/Attachments";
import Documentation from "./pages/Documentation/Documentation";
import BackflowTesting from "./pages/BackflowTesting/BackflowTesting";
import "./App.css";

export default function App() {
  // ===== CORE STATE =====
  const [technician, setTechnician] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState("jobs");
  const [selectedJob, setSelectedJob] = useState(null);

  // ===== SESSION MANAGEMENT =====
  useEffect(() => {
    const existingSession = sessionManager.getTechnicianSession();
    if (existingSession) {
      setTechnician(existingSession.technician);
      setCurrentPage("jobs");
    }
    setIsLoading(false);
  }, []);

  // ===== AUTH HANDLERS =====
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

  // ===== NAVIGATION HANDLERS =====
  const handleSelectJob = (job) => {
    setSelectedJob(job);
    setCurrentPage("attachments");
  };

  const handleBackToJobs = () => {
    setSelectedJob(null);
    setCurrentPage("jobs");
  };

  const handleStartBackflowTesting = (job) => {
    setSelectedJob(job);
    setCurrentPage("backflow-testing");
  };

  const handleNavigate = (page) => {
    if (page === "jobs") {
      handleBackToJobs();
    } else if (page === "documentation") {
      setCurrentPage("documentation");
    }
  };

  // ===== LOADING STATE =====
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

  // ===== NOT AUTHENTICATED =====
  if (!technician) {
    return <Login onLogin={handleLogin} />;
  }

  // ===== MAIN APP LAYOUT =====
  return (
    <div className="app">
      {/* Main Content */}
      <main className="app-main">
        {currentPage === "jobs" && (
          <Jobs
            technician={technician}
            onSelectJob={handleSelectJob}
            onStartBackflowTesting={handleStartBackflowTesting}
            onLogout={handleLogout}
          />
        )}

        {currentPage === "attachments" && (
          <Attachments
            job={selectedJob}
            onBack={handleBackToJobs}
            technician={technician}
            onLogout={handleLogout}
            onStartBackflowTesting={handleStartBackflowTesting}
          />
        )}

        {currentPage === "backflow-testing" && (
          <BackflowTesting
            job={selectedJob}
            technician={technician}
            onBack={handleBackToJobs}
            onLogout={handleLogout}
          />
        )}

        {currentPage === "documentation" && (
          <Documentation
            onBack={() => handleNavigate("jobs")}
            onLogout={handleLogout}
          />
        )}
      </main>
    </div>
  );
}
