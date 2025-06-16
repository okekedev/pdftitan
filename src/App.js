// src/App.js - Simplified for Technician-Only Portal
import React, { useState, useEffect } from 'react';
import sessionManager from './services/sessionManger';
import apiClient from './services/apiClient';
import Login from './pages/Login/Login';
import Header from './components/layout/Header/Header';
import Footer from './components/layout/Footer/Footer';
import Jobs from './pages/Jobs/Jobs';
import Attachments from './pages/Attachments/Attachments';
import './App.css';

function App() {
  const [technician, setTechnician] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('jobs');
  const [selectedJob, setSelectedJob] = useState(null);

  // Check for existing session on app load
  useEffect(() => {
    console.log('🔍 Checking for existing technician session...');
    
    const existingSession = sessionManager.getTechnicianSession();
    if (existingSession) {
      console.log('✅ Found existing technician session:', existingSession.technician?.name);
      setTechnician(existingSession.technician);
      setCurrentPage('jobs'); // Technicians always start with jobs
    } else {
      console.log('❌ No existing technician session found');
    }
    
    setIsLoading(false);
  }, []);

  const handleLogin = (userData) => {
    console.log('👤 Technician logged in:', userData.technician?.name);
    
    // Save to session storage
    sessionManager.setTechnicianSession(userData);
    setTechnician(userData.technician);
    
    // Technicians always go to jobs page
    setCurrentPage('jobs');
  };

  const handleLogout = () => {
    console.log('🚪 Logging out technician');
    
    // Clear session storage
    sessionManager.clearTechnicianSession();
    
    setTechnician(null);
    setSelectedJob(null);
    setCurrentPage('jobs');
  };

  const handleSelectJob = (job) => {
    console.log('👷 Job selected:', job.number);
    setSelectedJob(job);
    setCurrentPage('attachments');
  };

  const handleBackToJobs = () => {
    setSelectedJob(null);
    setCurrentPage('jobs');
  };

  // Show loading spinner while checking session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading TitanPDF...</p>
        </div>
      </div>
    );
  }

  // Show login page if technician is not logged in
  if (!technician) {
    return <Login onLogin={handleLogin} />;
  }

  // Render current page content for authenticated technicians
  const renderPageContent = () => {
    switch (currentPage) {
      case 'jobs':
        return (
          <Jobs 
            technician={technician}
            onSelectJob={handleSelectJob}
          />
        );
      
      case 'attachments':
        return (
          <Attachments 
            job={selectedJob}
            onBack={handleBackToJobs}
          />
        );
      
      default:
        return (
          <Jobs 
            technician={technician}
            onSelectJob={handleSelectJob}
          />
        );
    }
  };

  // Simple breadcrumb navigation for technicians
  const getBreadcrumbs = () => {
    return [
      { id: 'jobs', label: 'My Jobs', active: currentPage === 'jobs' || currentPage === 'attachments' },
      { id: 'attachments', label: 'Forms', active: currentPage === 'attachments' }
    ];
  };

  const handleNavigate = (page) => {
    console.log('🧭 Navigating to:', page);
    
    if (page === 'jobs') {
      setSelectedJob(null);
      setCurrentPage('jobs');
    }
    // Technicians can't navigate to attachments without selecting a job first
  };

  return (
    <div className="App">
      <Header 
        user={technician} 
        onLogout={handleLogout}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        breadcrumbs={getBreadcrumbs()}
        userType="technician"
      />
      
      <main className="main-content">
        {renderPageContent()}
      </main>
      
      <Footer />
    </div>
  );
}

export default App;