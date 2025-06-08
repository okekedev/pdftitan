import React, { useState } from 'react';
import Login from './Login';
import Header from './Header';
import Footer from './Footer';
import Projects from './Projects';
import Jobs from './Jobs';
import Attachments from './Attachments';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('projects');
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);

  const handleLogin = (userData) => {
    setUser(userData);
    setCurrentPage('projects');
  };

  const handleLogout = () => {
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