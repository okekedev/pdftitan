import React, { useState, useEffect } from 'react';
import sessionManager from './services/sessionManger';
import apiClient from './services/apiClient';
import Login from './pages/Login/Login';
import AdminPassword from './pages/AdminPassword/AdminPassword';
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
      
      // Set appropriate initial page based on user access level
      const access = existingSession.user.access;
      const userInfo = apiClient.getCurrentUserInfo();
      
      console.log('🎯 User access info:', {
        isAdmin: userInfo.isAdmin,
        isTechnician: userInfo.isTechnician,
        nextScreen: access?.nextScreen
      });

      // Route based on user type and admin access
      if (userInfo.isAdmin && !sessionManager.hasAdminSuperAccess()) {
        // Admin needs to authenticate with super password
        setCurrentPage('admin-password');
      } else if (userInfo.isAdmin && sessionManager.hasAdminSuperAccess()) {
        // Admin with super access goes to projects
        setCurrentPage('projects');
      } else if (userInfo.isTechnician) {
        // Technicians go directly to their jobs (no projects view)
        setCurrentPage('jobs');
      } else {
        // Default fallback
        setCurrentPage('projects');
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
    const userInfo = apiClient.getCurrentUserInfo();
    
    if (userInfo.isAdmin) {
      // Admin users need to enter admin password first
      setCurrentPage('admin-password');
    } else if (userInfo.isTechnician) {
      // Technicians go straight to jobs (no projects view)
      setCurrentPage('jobs');
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
    
    // Admin with super access goes to projects
    setCurrentPage('projects');
  };

  const handleBackToLogin = () => {
    console.log('🚪 Returning to login');
    setCurrentPage('login');
    setUser(null);
    setSelectedProject(null);
    setSelectedJob(null);
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
    const userInfo = apiClient.getCurrentUserInfo();
    
    console.log('🧭 Navigating to:', page, 'User type:', userInfo);
    
    // Validate navigation permissions
    if (page === 'projects' && userInfo.isTechnician) {
      // Technicians should not access projects page
      console.log('❌ Technicians cannot access projects page');
      return;
    }
    
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
    console.log('📋 Project selected:', project.name);
    setSelectedProject(project);
    setCurrentPage('jobs');
  };

  const handleSelectJob = (job) => {
    console.log('👷 Job selected:', job.number);
    setSelectedJob(job);
    setCurrentPage('attachments');
  };

  const handleBackToProjects = () => {
    const userInfo = apiClient.getCurrentUserInfo();
    
    if (userInfo.isTechnician) {
      // Technicians don't have a projects view, so "back" means back to jobs
      setSelectedJob(null);
      setCurrentPage('jobs');
    } else {
      // Admins go back to projects
      setSelectedProject(null);
      setSelectedJob(null);
      setCurrentPage('projects');
    }
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

  // Get current user info for determining available navigation
  const userInfo = apiClient.getCurrentUserInfo();
  
  // Render current page content for authenticated users
  const renderPageContent = () => {
    switch (currentPage) {
      case 'projects':
        // Only admins should see projects
        if (!userInfo.isAdmin) {
          return (
            <div className="page-container">
              <div className="coming-soon">
                <h3>Access Denied</h3>
                <p>You do not have permission to view projects.</p>
              </div>
            </div>
          );
        }
        return <Projects onSelectProject={handleSelectProject} />;
      
      case 'jobs':
        return (
          <Jobs 
            project={selectedProject} // null for technicians, project object for admins
            onSelectJob={handleSelectJob}
            onBack={userInfo.isAdmin ? handleBackToProjects : null} // Technicians don't have back
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
        // Default based on user type
        if (userInfo.isTechnician) {
          return (
            <Jobs 
              project={null}
              onSelectJob={handleSelectJob}
              onBack={null}
            />
          );
        } else {
          return <Projects onSelectProject={handleSelectProject} />;
        }
    }
  };

  // Determine breadcrumb navigation based on user type
  const getBreadcrumbs = () => {
    if (userInfo.isTechnician) {
      // Technicians only see: Jobs -> Attachments
      return [
        { id: 'jobs', label: 'My Jobs', active: currentPage === 'jobs' || currentPage === 'attachments' },
        { id: 'attachments', label: 'Forms', active: currentPage === 'attachments' }
      ];
    } else {
      // Admins see: Projects -> Jobs -> Attachments
      return [
        { id: 'projects', label: 'Projects', active: currentPage === 'projects' || currentPage === 'jobs' || currentPage === 'attachments' },
        { id: 'jobs', label: 'Jobs', active: currentPage === 'jobs' || currentPage === 'attachments' },
        { id: 'attachments', label: 'Forms', active: currentPage === 'attachments' }
      ];
    }
  };

  return (
    <div className="App">
      <Header 
        user={user} 
        onLogout={handleLogout}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        breadcrumbs={getBreadcrumbs()}
        userInfo={userInfo}
      />
      
      <main className="main-content">
        {renderPageContent()}
      </main>
      
      <Footer />
    </div>
  );
}

export default App;