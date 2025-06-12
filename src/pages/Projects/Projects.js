import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';
import sessionManager from '../../services/sessionManger';
import './Projects.css';

function Projects({ onSelectProject }) {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    const loadUserInfo = () => {
      const user = apiClient.getCurrentUserInfo();
      setUserInfo(user);
    };

    const loadProjects = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        const userInfo = apiClient.getCurrentUserInfo();
        
        if (userInfo.isAdmin) {
          // Admins see all active projects
          const projectsData = await apiClient.getProjects({
            active: 'true'
          });
          setProjects(projectsData);
        } else if (userInfo.isTechnician) {
          // Technicians go directly to their jobs, no projects view
          // This should not happen due to routing, but handle gracefully
          setError('Technicians should see jobs directly, not projects');
        } else {
          setError('You do not have permission to view projects');
        }
        
      } catch (error) {
        console.error('❌ Error loading projects:', error);
        setError(`Failed to load projects: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserInfo();
    loadProjects();
  }, []);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'status-completed';
      case 'in progress': return 'status-progress';
      case 'scheduled': return 'status-scheduled';
      case 'on hold': return 'status-hold';
      default: return 'status-default';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': 
      case 'urgent': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return 'priority-default';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not scheduled';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleSelectProject = (project) => {
    onSelectProject(project);
  };

  if (isLoading) {
    return (
      <div className="projects-container">
        <div className="projects-header">
          <h2>Loading Projects...</h2>
          <p>Fetching active projects from ServiceTitan</p>
        </div>
        <div className="loading-spinner" style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '200px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e9ecef',
            borderTop: '4px solid #2ecc71',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="projects-container">
        <div className="projects-header">
          <h2>Error Loading Projects</h2>
          <p style={{ color: '#e74c3c' }}>{error}</p>
        </div>
        <div style={{
          background: '#fff',
          padding: '2rem',
          borderRadius: '8px',
          textAlign: 'center',
          marginTop: '1rem'
        }}>
          <p>Please check your connection and try again.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              background: '#2ecc71',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              cursor: 'pointer',
              marginTop: '1rem'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="projects-container">
      <div className="projects-header">
        <h2>Active Projects</h2>
        <p>
          {userInfo?.isAdmin ? 'All company projects' : 'Your assigned projects'} • 
          {projects.length} project{projects.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {projects.length === 0 ? (
        <div style={{
          background: '#fff',
          padding: '3rem',
          borderRadius: '12px',
          textAlign: 'center',
          border: '2px dashed #e9ecef'
        }}>
          <h3 style={{ color: '#666', marginBottom: '1rem' }}>No Active Projects</h3>
          <p style={{ color: '#999' }}>
            {userInfo?.isAdmin 
              ? 'No active projects found in ServiceTitan'
              : 'No projects assigned to you at this time'
            }
          </p>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <div
              key={project.id}
              className="project-card"
              onClick={() => handleSelectProject(project)}
            >
              <div className="project-header">
                <div className="project-info">
                  <h3 className="project-name">{project.name}</h3>
                  <p style={{ color: '#666', fontSize: '0.9rem', margin: '0.25rem 0' }}>
                    {project.number}
                  </p>
                </div>
                <div className="project-badges">
                  <span className={`status-badge ${getStatusColor(project.status)}`}>
                    {project.status || 'Active'}
                  </span>
                  {project.priority && project.priority !== 'Normal' && (
                    <span className={`priority-badge ${getPriorityColor(project.priority)}`}>
                      {project.priority}
                    </span>
                  )}
                </div>
              </div>

              <div className="project-details">
                <div className="detail-row">
                  <span className="detail-label">Customer</span>
                  <span className="detail-value">{project.customer}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Location</span>
                  <span className="detail-value">{project.location}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Business Unit</span>
                  <span className="detail-value">{project.businessUnit}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Start Date</span>
                  <span className="detail-value">{formatDate(project.startDate)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Jobs</span>
                  <span className="detail-value">{project.totalJobs || 0} jobs</span>
                </div>
              </div>

              <div className="project-footer">
                <button className="view-jobs-btn">
                  View Jobs →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Projects;