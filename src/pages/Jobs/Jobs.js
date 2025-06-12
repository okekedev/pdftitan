import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';
import sessionManager from '../../services/sessionManger';
import './Jobs.css';

function Jobs({ project, onSelectJob, onBack }) {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all'
  });

  useEffect(() => {
    const loadUserInfo = () => {
      const user = apiClient.getCurrentUserInfo();
      setUserInfo(user);
    };

    const loadJobs = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        const userInfo = apiClient.getCurrentUserInfo();
        let jobsData = [];

        if (userInfo.isAdmin && project) {
          // Admin viewing jobs for a specific project
          jobsData = await apiClient.getJobsForProject(project.id, {
            active: 'true'
          });
        } else if (userInfo.isAdmin && !project) {
          // Admin viewing all jobs (fallback)
          jobsData = await apiClient.getAllActiveJobs();
        } else if (userInfo.isTechnician) {
          // Technician viewing their assigned jobs
          jobsData = await apiClient.getJobsForTechnician(userInfo.employeeId);
        } else {
          throw new Error('You do not have permission to view jobs');
        }

        // Filter out non-active jobs
        const activeJobs = jobsData.filter(job => 
          apiClient.isJobActive(job.status)
        );

        setJobs(activeJobs);
        
      } catch (error) {
        console.error('❌ Error loading jobs:', error);
        setError(`Failed to load jobs: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserInfo();
    loadJobs();
  }, [project]);

  const getStatusColor = (status) => {
    return apiClient.getJobStatusColor(status);
  };

  const getPriorityColor = (priority) => {
    return apiClient.getPriorityColor(priority);
  };

  const getJobUrgencyIcon = (job) => {
    const urgency = apiClient.getJobUrgency(job);
    switch (urgency) {
      case 'urgent': return '🚨';
      case 'today': return '⏰';
      case 'hold': return '⏸️';
      default: return '📋';
    }
  };

  const handleSelectJob = (job) => {
    onSelectJob(job);
  };

  const filteredJobs = jobs.filter(job => {
    if (filters.status !== 'all' && job.status?.toLowerCase() !== filters.status) {
      return false;
    }
    if (filters.priority !== 'all' && job.priority?.toLowerCase() !== filters.priority) {
      return false;
    }
    return true;
  });

  const getPageTitle = () => {
    if (userInfo?.isTechnician) {
      return 'My Jobs';
    } else if (project) {
      return `Jobs - ${project.name}`;
    } else {
      return 'All Active Jobs';
    }
  };

  const getPageDescription = () => {
    if (userInfo?.isTechnician) {
      return 'Your assigned jobs for the next 7 days';
    } else if (project) {
      return `Active jobs for project ${project.number}`;
    } else {
      return 'All active jobs in the system';
    }
  };

  if (isLoading) {
    return (
      <div className="jobs-container">
        <div className="jobs-header">
          <div className="header-top">
            {onBack && (
              <button onClick={onBack} className="back-button">
                ← Back
              </button>
            )}
            <div className="project-info">
              <h2>Loading Jobs...</h2>
              <p>Fetching jobs from ServiceTitan</p>
            </div>
          </div>
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
      <div className="jobs-container">
        <div className="jobs-header">
          <div className="header-top">
            {onBack && (
              <button onClick={onBack} className="back-button">
                ← Back
              </button>
            )}
            <div className="project-info">
              <h2>Error Loading Jobs</h2>
              <p style={{ color: '#e74c3c' }}>{error}</p>
            </div>
          </div>
        </div>
        <div style={{
          background: '#fff',
          padding: '2rem',
          borderRadius: '8px',
          textAlign: 'center',
          marginTop: '1rem'
        }}>
          <button 
            onClick={() => window.location.reload()}
            style={{
              background: '#2ecc71',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="jobs-container">
      <div className="jobs-header">
        <div className="header-top">
          {onBack && (
            <button onClick={onBack} className="back-button">
              ← Back to Projects
            </button>
          )}
          <div className="project-info">
            <h2>{getPageTitle()}</h2>
            <p>{getPageDescription()}</p>
          </div>
        </div>

        {/* Job Filters */}
        <div className="jobs-filters" style={{
          display: 'flex',
          gap: '1rem',
          marginTop: '1rem',
          padding: '1rem',
          background: '#f8f9fa',
          borderRadius: '6px'
        }}>
          <select 
            value={filters.status} 
            onChange={(e) => setFilters({...filters, status: e.target.value})}
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="in progress">In Progress</option>
            <option value="on hold">On Hold</option>
            <option value="dispatched">Dispatched</option>
          </select>

          <select 
            value={filters.priority} 
            onChange={(e) => setFilters({...filters, priority: e.target.value})}
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <div style={{ marginLeft: 'auto', color: '#666', fontSize: '0.9rem' }}>
            {filteredJobs.length} of {jobs.length} jobs
          </div>
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <div style={{
          background: '#fff',
          padding: '3rem',
          borderRadius: '12px',
          textAlign: 'center',
          border: '2px dashed #e9ecef',
          marginTop: '1rem'
        }}>
          <h3 style={{ color: '#666', marginBottom: '1rem' }}>No Jobs Found</h3>
          <p style={{ color: '#999' }}>
            {userInfo?.isTechnician 
              ? 'No jobs assigned to you at this time'
              : 'No active jobs found for the selected filters'
            }
          </p>
        </div>
      ) : (
        <div className="jobs-grid">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="job-card"
              onClick={() => handleSelectJob(job)}
            >
              <div className="job-content">
                <div className="job-header" style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <h3 className="job-id" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      {getJobUrgencyIcon(job)} {job.number}
                    </h3>
                    <h4 className="job-name">{job.summary}</h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span className={`status-badge ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                    {job.priority && job.priority !== 'Normal' && (
                      <span className={`priority-badge ${getPriorityColor(job.priority)}`}>
                        {job.priority}
                      </span>
                    )}
                  </div>
                </div>

                <div className="job-details">
                  <div className="detail-row">
                    <span className="detail-label">Customer</span>
                    <span className="detail-value">{job.customer.name}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Location</span>
                    <span className="detail-value">{job.location.name}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Job Type</span>
                    <span className="detail-value">{job.jobType}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Scheduled</span>
                    <span className="detail-value">
                      {apiClient.formatJobDate(job.scheduledDate)}
                    </span>
                  </div>
                  {job.assignedTechnicians.length > 0 && (
                    <div className="detail-row">
                      <span className="detail-label">Technician</span>
                      <span className="detail-value">
                        {job.assignedTechnicians.map(tech => tech.name).join(', ')}
                      </span>
                    </div>
                  )}
                  {userInfo?.isAdmin && job.project && (
                    <div className="detail-row">
                      <span className="detail-label">Project</span>
                      <span className="detail-value">{job.project.name}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="job-footer">
                <button className="view-attachments-btn">
                  View Forms →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Jobs;