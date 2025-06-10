import React, { useState, useEffect } from 'react';
import sessionManager from './services/sessionManger'; // Add this import
import Login from './pages/Login/Login';
import Header from './components/layout/Header/Header';
import Footer from './components/layout/Footer/Footer';
import Projects from './pages/Projects/Projects';
import Jobs from './pages/Jobs/Jobs';
import Attachments from './pages/Attachments/Attachments';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const [currentPage, setCurrentPage] = useState('projects');
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);

  // Add useEffect to check for existing session
  useEffect(() => {
    console.log('🔍 Checking for existing user session...');
    
    const existingSession = sessionManager.getUserSession();
    if (existingSession) {
      console.log('✅ Found existing session:', existingSession.user.email);
      setUser(existingSession.user);
    } else {
      console.log('❌ No existing session found');
    }
    
    setIsLoading(false);
  }, []);

  const handleLogin = (userData) => {
    console.log('👤 User logged in:', userData.email);
    
    // Save to session storage
    sessionManager.setUserSession(userData);
    
    setUser(userData);
    setCurrentPage('projects');
  };

  const handleLogout = () => {
    console.log('🚪 Logging out user');
    
    // Clear session storage
    sessionManager.clearSession();
    
    setUser(null);
    setSelectedProject(null);
    setSelectedJob(null);
    setCurrentPage('projects');
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

  // Render current page content
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