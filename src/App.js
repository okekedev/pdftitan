import React, { useState, useEffect } from 'react';
import sessionManager from './services/sessionManger';
import Login from './pages/Login/Login';
import AdminPassword from './pages/AdminPassword/AdminPassword'; // NEW
import Header from './components/layout/Header/Header';
import Footer from './components/layout/Footer/Footer';
import Projects from './pages/Projects/Projects';
import Jobs from './pages/Jobs/Jobs';
import Attachments from './pages/Attachments/Attachments';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('projects');
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);

  // Check for existing session on app load
  useEffect(() => {
    console.log('🔍 Checking for existing user session...');
    
    const existingSession = sessionManager.getUserSession();
    if (existingSession) {
      console.log('✅ Found existing session:', existingSession.user.employee?.name);
      setUser(existingSession.user);
      
      // Set appropriate page based on user access level
      const access = existingSession.user.access;
      if (access && access.nextScreen === 'company_code') {
        setCurrentPage('admin-password'); // Admin needs password first
      } else if (access && access.nextScreen === 'jobs') {
        setCurrentPage('projects'); // Technicians go to projects
      }
    } else {
      console.log('❌ No existing session found');
    }
    
    setIsLoading(false);
  }, []);

  const handleLogin = (userData) => {
    console.log('👤 User logged in:', userData.employee?.name);
    console.log('🔑 Access level:', userData.access?.level);
    console.log('🎯 Next screen:', userData.access?.nextScreen);
    
    // Save to session storage
    sessionManager.setUserSession(userData);
    
    setUser(userData);
    
    // Route user based on their access level
    if (userData.access?.nextScreen === 'company_code') {
      // Admin users need to enter admin password first
      setCurrentPage('admin-password');
    } else if (userData.access?.nextScreen === 'jobs') {
      // Technicians go straight to projects/jobs
      setCurrentPage('projects');
    } else {
      // Fallback
      setCurrentPage('projects');
    }
  };

  const handleAdminAccessGranted = (updatedUserData) => {
    console.log('🔑 Admin access granted for:', updatedUserData.employee?.name);
    
    // Update session with admin super access
    sessionManager.setUserSession(updatedUserData);
    setUser(updatedUserData);
    
    // Now admin can access projects (company code screen removed for now)
    setCurrentPage('projects');
  };

  const handleBackToLogin = () => {
    console.log('🚪 Returning to login');
    setCurrentPage('login');
    setUser(null);
    sessionManager.clearSession();
  };

  const handleLogout = () => {
    console.log('🚪 Logging out user');
    
    // Clear session storage
    sessionManager.clearSession();
    
    setUser(null);
    setSelectedProject(null);
    setSelectedJob(null);
    setCurrentPage('login');
  };

  const handleNavigate = (page) => {
    setCurrentPage(page);
    
    // Reset downstream selections when navigating up the hierarchy
    if (page === 'projects') {
      setSelectedProject(null);
      setSelectedJob(null);
    } else if (page === 'jobs') {
      setSelectedJob(null);
    }
  };

  const handleSelectProject = (project) => {
    setSelectedProject(project);
    setCurrentPage('jobs');
  };

  const handleSelectJob = (job) => {
    setSelectedJob(job);
    setCurrentPage('attachments');
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

  // Show login page if user is not logged in
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Show admin password page if admin hasn't authenticated yet
  if (currentPage === 'admin-password') {
    return (
      <AdminPassword 
        user={user}
        onAdminAccessGranted={handleAdminAccessGranted}
        onBack={handleBackToLogin}
      />
    );
  }

  // Render current page content for authenticated users
  const renderPageContent = () => {
    switch (currentPage) {
      case 'projects':
        return <Projects onSelectProject={handleSelectProject} />;
      
      case 'jobs':
        return (
          <Jobs 
            project={selectedProject}
            onSelectJob={handleSelectJob}
            onBack={() => handleNavigate('projects')}
          />
        );
      
      case 'attachments':
        return (
          <Attachments 
            job={selectedJob}
            onBack={() => handleNavigate('jobs')}
          />
        );
      
      default:
        return <Projects onSelectProject={handleSelectProject} />;
    }
  };

  return (
    <div className="App">
      <Header 
        user={user} 
        onLogout={handleLogout}
        currentPage={currentPage}
        onNavigate={handleNavigate}
      />
      
      <main className="main-content">
        {renderPageContent()}
      </main>
      
      <Footer />
    </div>
  );
}

export default App;