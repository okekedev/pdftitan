import React, { useState, useEffect } from 'react';
import sessionManager from './services/sessionManager';
import Header from './components/Header/Header';
import Login from './pages/Login/Login';
import Jobs from './pages/Jobs/Jobs';
import Attachments from './pages/Attachments/Attachments';
import Documentation from './pages/Documentation/Documentation';
import BackflowTesting from './pages/BackflowTesting/BackflowTesting';
import type { Technician, Job, Breadcrumb } from './types';
import './App.css';

export default function App() {
  // ===== CORE STATE =====
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('jobs');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // ===== SESSION MANAGEMENT =====
  useEffect(() => {
    const existingSession = sessionManager.getTechnicianSession();
    if (existingSession) {
      setTechnician(existingSession.technician);
      setCurrentPage('jobs');
    }
    setIsLoading(false);
  }, []);

  // ===== AUTH HANDLERS =====
  const handleLogin = (userData: { technician: Technician; company: { id?: number; name: string }; environment?: string }) => {
    sessionManager.setTechnicianSession(userData);
    setTechnician(userData.technician);
    setCurrentPage('jobs');
  };

  const handleLogout = () => {
    sessionManager.clearTechnicianSession();
    setTechnician(null);
    setSelectedJob(null);
    setCurrentPage('jobs');
  };

  // ===== NAVIGATION HANDLERS =====
  const handleSelectJob = (job: Job) => {
    setSelectedJob(job);
    setCurrentPage('attachments');
  };

  const handleBackToJobs = () => {
    setSelectedJob(null);
    setCurrentPage('jobs');
  };

  const handleStartBackflowTesting = (job: Job) => {
    setSelectedJob(job);
    setCurrentPage('backflow-testing');
  };

  const handleNavigate = (page: string) => {
    if (page === 'jobs') {
      handleBackToJobs();
    } else if (page === 'documentation') {
      setCurrentPage('documentation');
    }
  };

  // ===== BREADCRUMBS =====
  const getBreadcrumbs = (): Breadcrumb[] => {
    switch (currentPage) {
      case 'jobs':
        return [{ id: 'jobs', label: 'Your Jobs', active: true }];
      case 'attachments':
        return [{ id: 'attachments', label: `Job #${selectedJob?.number ?? 'Unknown'} - PDF Forms`, active: true }];
      case 'backflow-testing':
        return [
          { id: 'jobs', label: 'Jobs', active: false },
          { id: 'backflow-testing', label: `Backflow Testing - Job #${selectedJob?.number ?? 'Unknown'}`, active: true },
        ];
      case 'documentation':
        return [{ id: 'documentation', label: 'Documentation', active: true }];
      default:
        return [];
    }
  };

  // ===== LOADING STATE =====
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>Loading Mr. Backflow...</h2>
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
      <Header
        user={technician}
        onLogout={handleLogout}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        breadcrumbs={getBreadcrumbs()}
      />
      <main className="app-main">
        {currentPage === 'jobs' && (
          <Jobs
            technician={technician}
            onSelectJob={handleSelectJob}
            onStartBackflowTesting={handleStartBackflowTesting}
            onLogout={handleLogout}
          />
        )}

        {currentPage === 'attachments' && selectedJob && (
          <Attachments
            job={selectedJob}
            onBack={handleBackToJobs}
            technician={technician}
            onLogout={handleLogout}
          />
        )}

        {currentPage === 'backflow-testing' && selectedJob && (
          <BackflowTesting
            job={selectedJob}
            technician={technician}
            onBack={handleBackToJobs}
            onLogout={handleLogout}
          />
        )}

        {currentPage === 'documentation' && (
          <Documentation onBack={() => handleNavigate('jobs')} onLogout={handleLogout} />
        )}
      </main>
    </div>
  );
}
