import React, { useState } from 'react';
import './Projects.css';

function Projects({ onSelectProject }) {
  // Simple project data - only first one is active
  const [projects] = useState([
    {
      id: "PRJ-2025-001",
      name: "Metro Hospital System",
      active: true
    },
    {
      id: "PRJ-2025-002", 
      name: "City of Dallas - Highland Park",
      active: false
    },
    {
      id: "PRJ-2025-003",
      name: "Texas Manufacturing Corp",
      active: false
    }
  ]);

  return (
    <div className="projects-container">
      <div className="projects-header">
        <h2>Select Project</h2>
      </div>

      <div className="projects-grid">
        {projects.map((project) => (
          <div
            key={project.id}
            className={`project-card ${!project.active ? 'disabled' : ''}`}
            onClick={() => project.active && onSelectProject(project)}
          >
            <div className="project-content">
              <h3 className="project-id">{project.id}</h3>
              <h4 className="project-name">{project.name}</h4>
            </div>

            <div className="project-footer">
              <button 
                className={`view-jobs-btn ${!project.active ? 'disabled' : ''}`}
                disabled={!project.active}
              >
                {project.active ? 'View Jobs →' : 'View Jobs'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Projects;