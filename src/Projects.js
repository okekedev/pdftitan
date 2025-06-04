import React, { useState } from 'react';
import './Projects.css';

function Projects({ onSelectProject }) {
  // Simple backflow testing project data
  const [projects] = useState([
    {
      id: 1,
      name: "Metro Hospital System",
      address: "1200 Medical Center Dr, Dallas, TX",
      status: "In Progress",
      jobCount: 8
    },
    {
      id: 2,
      name: "City of Dallas - Highland Park",
      address: "Multiple Residential Locations",
      status: "Scheduled", 
      jobCount: 12
    },
    {
      id: 3,
      name: "Texas Manufacturing Corp",
      address: "4500 Industrial Blvd, Dallas, TX",
      status: "In Progress",
      jobCount: 5
    }
  ]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'In Progress': return 'status-progress';
      case 'Scheduled': return 'status-scheduled';
      case 'Completed': return 'status-completed';
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

  return (
    <div className="projects-container">
      <div className="projects-header">
        <h2>Backflow Testing Projects</h2>
        <p>Select a project to view jobs</p>
      </div>

      <div className="projects-grid">
        {projects.map((project) => (
          <div
            key={project.id}
            className="project-card"
            onClick={() => onSelectProject(project)}
          >
            <div className="project-header">
              <h3 className="project-name">{project.name}</h3>
              <span className={`status-badge ${getStatusColor(project.status)}`}>
                {project.status}
              </span>
            </div>

            <div className="project-details">
              <div className="detail-row">
                <span className="detail-label">Address:</span>
                <span className="detail-value">{project.address}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Jobs:</span>
                <span className="detail-value">{project.jobCount} total</span>
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
    </div>
  );
}

export default Projects;