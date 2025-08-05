import React, { useState, useEffect } from "react";
import sessionManager from "./services/sessionManager";
import Login from "./pages/Login/Login";
import Jobs from "./pages/Jobs/Jobs";
import Attachments from "./pages/Attachments/Attachments";
import Documentation from "./pages/Documentation/Documentation";
import "./App.css";

export default function App() {
  // ===== CORE STATE =====
  const [technician, setTechnician] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState("jobs");
  const [selectedJob, setSelectedJob] = useState(null);
  const [isPdfEditorOpen, setIsPdfEditorOpen] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

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
    setIsPdfEditorOpen(false);
    setShowMobileMenu(false);
  };

  // ===== NAVIGATION HANDLERS =====
  const handleSelectJob = (job) => {
    setSelectedJob(job);
    setCurrentPage("attachments");
  };

  const handleBackToJobs = () => {
    setSelectedJob(null);
    setCurrentPage("jobs");
    setIsPdfEditorOpen(false);
  };

  const handleNavigate = (page) => {
    if (page === "jobs") {
      handleBackToJobs();
    } else if (page === "documentation") {
      setCurrentPage("documentation");
    }
    setShowMobileMenu(false);
  };

  const handlePdfEditorStateChange = (isOpen) => {
    setIsPdfEditorOpen(isOpen);
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

  // ===== PDF EDITOR MODE (FULL SCREEN) =====
  if (isPdfEditorOpen) {
    return (
      <div className="app app-pdf-editor-mode">
        <main className="app-main-fullscreen">
          <Attachments 
            job={selectedJob} 
            onBack={handleBackToJobs}
            onPdfEditorStateChange={handlePdfEditorStateChange}
          />
        </main>
      </div>
    );
  }

  // ===== SIMPLE MOBILE MENU =====
  const renderMobileMenu = () => (
    <div className="mobile-menu">
      <button 
        className="mobile-menu-toggle"
        onClick={() => setShowMobileMenu(!showMobileMenu)}
      >
        ☰ Menu
      </button>
      
      {showMobileMenu && (
        <div className="mobile-menu-dropdown">
          <div className="mobile-menu-header">
            <div className="user-info">
              <strong>{technician.name}</strong>
              <small>Technician</small>
            </div>
          </div>
          
          <div className="mobile-menu-items">
            <button 
              className={`menu-item ${currentPage === 'jobs' ? 'active' : ''}`}
              onClick={() => handleNavigate("jobs")}
            >
              📋 Jobs
            </button>
            
            {selectedJob && (
              <button 
                className={`menu-item ${currentPage === 'attachments' ? 'active' : ''}`}
                onClick={() => setCurrentPage("attachments")}
              >
                📎 Attachments
              </button>
            )}
            
            <button 
              className={`menu-item ${currentPage === 'documentation' ? 'active' : ''}`}
              onClick={() => handleNavigate("documentation")}
            >
              ❓ Help
            </button>
            
            <button 
              className="menu-item logout"
              onClick={handleLogout}
            >
              🚪 Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ===== MAIN APP LAYOUT (NO HEADER/FOOTER) =====
  return (
    <div className="app">
      {/* Simple Mobile Menu */}
      {renderMobileMenu()}
      
      {/* Main Content */}
      <main className="app-main">
        {currentPage === "jobs" && (
          <Jobs technician={technician} onSelectJob={handleSelectJob} />
        )}
        
        {currentPage === "attachments" && (
          <Attachments 
            job={selectedJob} 
            onBack={handleBackToJobs}
            onPdfEditorStateChange={handlePdfEditorStateChange}
          />
        )}
        
        {currentPage === "documentation" && (
          <Documentation onBack={() => handleNavigate("jobs")} />
        )}
      </main>
    </div>
  );
}