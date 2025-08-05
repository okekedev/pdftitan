import React, { useState, useEffect } from "react";
import sessionManager from "./services/sessionManager";
import Login from "./pages/Login/Login";
import Jobs from "./pages/Jobs/Jobs";
import Attachments from "./pages/Attachments/Attachments";
import Documentation from "./pages/Documentation/Documentation";
import Header from "./components/Header/Header"; // ✅ Import Header component
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

  // ✅ Navigation handler for Header component
  const handleNavigate = (page) => {
    if (page === "jobs") {
      handleBackToJobs();
    } else if (page === "documentation") {
      handleShowDocumentation("support");
    }
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

  // ✅ Generate breadcrumbs for Header component
  const getBreadcrumbs = () => {
    const breadcrumbs = [];
    
    // Always show Jobs as first breadcrumb
    breadcrumbs.push({
      id: "jobs",
      label: "📋 Jobs",
      active: currentPage === "jobs"
    });

    // Add current page breadcrumb if not on jobs
    if (currentPage === "attachments" && selectedJob) {
      breadcrumbs.push({
        id: "attachments",
        label: `📎 ${selectedJob.title || selectedJob.summary || 'Job Attachments'}`,
        active: true
      });
    } else if (currentPage === "documentation") {
      breadcrumbs.push({
        id: "documentation", 
        label: "❓ Help & Documentation",
        active: true
      });
    }

    return breadcrumbs;
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
      {/* ✅ Use Header Component with proper props */}
      <Header 
        user={technician}
        onLogout={handleLogout}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        breadcrumbs={getBreadcrumbs()}
      />

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