import React, { useState } from 'react';
import './Jobs.css';

function Jobs({ project, onSelectJob, onBack }) {
  // Simple backflow testing job data
  const [jobs] = useState([
    {
      id: 1,
      workOrderNumber: "WO-001247",
      deviceType: "Double Check Valve",
      location: "Main Building",
      status: "Scheduled",
      technician: "Mike Rodriguez"
    },
    {
      id: 2,
      workOrderNumber: "WO-001248", 
      deviceType: "Pressure Vacuum Breaker",
      location: "East Wing",
      status: "In Progress",
      technician: "Sarah Chen"
    },
    {
      id: 3,
      workOrderNumber: "WO-001249",
      deviceType: "RPZ Assembly",
      location: "Kitchen Area",
      status: "Completed",
      technician: "Mike Rodriguez"
    },
    {
      id: 4,
      workOrderNumber: "WO-001250",
      deviceType: "Double Check Valve",
      location: "Fire Line",
      status: "Needs Review",
      technician: "David Kim"
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
            <h2>{project.name}</h2>
            <p>Select a job to view PDF forms</p>
          </div>
        </div>
      </div>

      <div className="jobs-grid">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="job-card"
            onClick={() => onSelectJob(job)}
          >
            <div className="job-header">
              <div className="job-title">
                <span className="device-icon">{getDeviceIcon(job.deviceType)}</span>
                <div>
                  <h3 className="work-order">{job.workOrderNumber}</h3>
                  <p className="device-type">{job.deviceType}</p>
                </div>
              </div>
              <span className={`status-badge ${getStatusColor(job.status)}`}>
                {job.status}
              </span>
            </div>

            <div className="job-details">
              <div className="detail-row">
                <span className="detail-label">Location:</span>
                <span className="detail-value">{job.location}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Technician:</span>
                <span className="detail-value">{job.technician}</span>
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
    </div>
  );
}

export default Jobs;