import React, { useState } from 'react';
import './Jobs.css';

function Jobs({ project, onSelectJob, onBack }) {
  // Simple job data - only first one is active
  const [jobs] = useState([
    {
      id: "JOB-001247",
      name: "Main Building - Double Check Valve",
      active: true
    },
    {
      id: "JOB-001248", 
      name: "East Wing - Pressure Vacuum Breaker",
      active: false
    },
    {
      id: "JOB-001249",
      name: "Kitchen Area - RPZ Assembly",
      active: false
    }
  ]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return 'status-completed';
      case 'In Progress': return 'status-progress';
      case 'Scheduled': return 'status-scheduled';
      case 'Needs Review': return 'status-review';
      default: return 'status-default';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return 'priority-high';
      case 'Medium': return 'priority-medium';
      case 'Low': return 'priority-low';
      default: return 'priority-default';
    }
  };

  const getDeviceIcon = (deviceType) => {
    if (deviceType.includes('Double Check')) return '🔄';
    if (deviceType.includes('Pressure Vacuum')) return '⚡';
    if (deviceType.includes('RPZ')) return '🎯';
    return '🔧';
  };

  return (
    <div className="jobs-container">
      <div className="jobs-header">
        <div className="header-top">
          <button onClick={onBack} className="back-button">
            ← Back to Projects
          </button>
          <div className="project-info">
            <h2>Select Job - {project.name}</h2>
          </div>
        </div>
      </div>

      <div className="jobs-grid">
        {jobs.map((job) => (
          <div
            key={job.id}
            className={`job-card ${!job.active ? 'disabled' : ''}`}
            onClick={() => job.active && onSelectJob(job)}
          >
            <div className="job-content">
              <h3 className="job-id">{job.id}</h3>
              <h4 className="job-name">{job.name}</h4>
            </div>

            <div className="job-footer">
              <button 
                className={`view-attachments-btn ${!job.active ? 'disabled' : ''}`}
                disabled={!job.active}
              >
                {job.active ? 'View Forms →' : 'View Forms'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Jobs;