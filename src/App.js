import React, { useState } from 'react';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedTool, setSelectedTool] = useState('select');
  const [pdfElements, setPdfElements] = useState([
    // Sample pre-filled elements
    { id: 1, type: 'text', x: 150, y: 200, content: 'John Smith', fontSize: 14 },
    { id: 2, type: 'text', x: 150, y: 250, content: 'Mike Johnson', fontSize: 14 },
    { id: 3, type: 'checkbox', x: 300, y: 350, checked: true },
    { id: 4, type: 'signature', x: 150, y: 450, content: 'Mike Johnson', width: 120, height: 40 }
  ]);

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'projects', label: 'Projects', icon: '📁' },
    { id: 'jobs', label: 'Jobs', icon: '🔧' },
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'reports', label: 'Reports', icon: '📈' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];

  const renderMainContent = () => {
    switch(currentView) {
      case 'dashboard':
        return (
          <div className="dashboard-content">
            <h2>Dashboard</h2>
            <p>Welcome to TitanPDF - Your PDF management solution for ServiceTitan</p>
            <div className="dashboard-stats">
              <div className="stat-card">
                <h3>Today's Jobs</h3>
                <p className="stat-number">12</p>
              </div>
              <div className="stat-card">
                <h3>Pending PDFs</h3>
                <p className="stat-number">5</p>
              </div>
              <div className="stat-card">
                <h3>Completed Forms</h3>
                <p className="stat-number">8</p>
              </div>
            </div>
          </div>
        );
      case 'projects':
        return (
          <div className="projects-content">
            <div className="projects-header">
              <h2>Projects</h2>
              <p>Select a project to view associated jobs and PDFs</p>
              <div className="projects-filters">
                <input 
                  type="text" 
                  placeholder="Search projects..." 
                  className="search-input"
                />
                <select className="filter-select">
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
            
            <div className="projects-grid">
              {/* Sample project data */}
              {[
                {
                  id: 1,
                  name: "HVAC Installation - Smith Residence",
                  customer: "John Smith",
                  address: "123 Oak Street, Dallas, TX 75201",
                  status: "Active",
                  jobCount: 3,
                  pdfCount: 5,
                  lastActivity: "2 hours ago",
                  priority: "High",
                  technician: "Mike Johnson"
                },
                {
                  id: 2,
                  name: "Plumbing Repair - Downtown Office",
                  customer: "ABC Corporation",
                  address: "456 Main Street, Dallas, TX 75202",
                  status: "Pending",
                  jobCount: 2,
                  pdfCount: 3,
                  lastActivity: "1 day ago",
                  priority: "Medium",
                  technician: "Sarah Davis"
                },
                {
                  id: 3,
                  name: "Electrical Upgrade - Manufacturing Plant",
                  customer: "XYZ Industries",
                  address: "789 Industrial Blvd, Dallas, TX 75203",
                  status: "Active",
                  jobCount: 5,
                  pdfCount: 12,
                  lastActivity: "30 minutes ago",
                  priority: "High",
                  technician: "Robert Wilson"
                },
                {
                  id: 4,
                  name: "AC Maintenance - Retail Center",
                  customer: "Shopping Plaza LLC",
                  address: "321 Commerce Way, Dallas, TX 75204",
                  status: "Completed",
                  jobCount: 1,
                  pdfCount: 2,
                  lastActivity: "3 days ago",
                  priority: "Low",
                  technician: "Lisa Anderson"
                }
              ].map(project => (
                <div key={project.id} className="project-card" onClick={() => setCurrentView('jobs')}>
                  <div className="project-header">
                    <div className="project-title-section">
                      <h3 className="project-name">{project.name}</h3>
                      <span className={`status-badge ${project.status.toLowerCase()}`}>
                        {project.status}
                      </span>
                    </div>
                    <div className={`priority-indicator ${project.priority.toLowerCase()}`}>
                      {project.priority}
                    </div>
                  </div>
                  
                  <div className="project-details">
                    <div className="customer-info">
                      <span className="customer-name">{project.customer}</span>
                      <span className="customer-address">{project.address}</span>
                    </div>
                    
                    <div className="project-stats">
                      <div className="stat-item">
                        <span className="stat-icon">🔧</span>
                        <span className="stat-value">{project.jobCount}</span>
                        <span className="stat-label">Jobs</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-icon">📄</span>
                        <span className="stat-value">{project.pdfCount}</span>
                        <span className="stat-label">PDFs</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="project-footer">
                    <div className="technician-info">
                      <span className="technician-label">Assigned:</span>
                      <span className="technician-name">{project.technician}</span>
                    </div>
                    <div className="last-activity">
                      <span className="activity-label">Updated:</span>
                      <span className="activity-time">{project.lastActivity}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'jobs':
        return (
          <div className="jobs-content">
            <div className="jobs-header">
              <div className="breadcrumb">
                <button 
                  className="breadcrumb-link" 
                  onClick={() => setCurrentView('projects')}
                >
                  Projects
                </button>
                <span className="breadcrumb-separator">›</span>
                <span className="breadcrumb-current">HVAC Installation - Smith Residence</span>
              </div>
              <h2>Job Management</h2>
              <p>Manage jobs and PDF documents for this project</p>
            </div>

            <div className="jobs-list">
              {[
                {
                  id: 1,
                  title: "Initial Site Survey",
                  status: "Completed",
                  technician: "Mike Johnson",
                  scheduledDate: "2025-06-02",
                  completedDate: "2025-06-02",
                  duration: "2 hours",
                  description: "Site assessment and equipment measurements",
                  pdfs: [
                    { id: 1, name: "Site Survey Form.pdf", status: "completed", lastModified: "2 hours ago" },
                    { id: 2, name: "Equipment Specifications.pdf", status: "pending", lastModified: "1 day ago" }
                  ]
                },
                {
                  id: 2,
                  title: "Equipment Installation",
                  status: "In Progress",
                  technician: "Mike Johnson",
                  scheduledDate: "2025-06-04",
                  completedDate: null,
                  duration: "6 hours",
                  description: "Install new HVAC unit and ductwork",
                  pdfs: [
                    { id: 3, name: "Installation Checklist.pdf", status: "pending", lastModified: "30 minutes ago" },
                    { id: 4, name: "Safety Inspection Form.pdf", status: "pending", lastModified: "1 hour ago" },
                    { id: 5, name: "Customer Sign-off.pdf", status: "pending", lastModified: "New" }
                  ]
                },
                {
                  id: 3,
                  title: "Final Testing & Commissioning",
                  status: "Scheduled",
                  technician: "Mike Johnson",
                  scheduledDate: "2025-06-05",
                  completedDate: null,
                  duration: "3 hours",
                  description: "System testing and customer walkthrough",
                  pdfs: [
                    { id: 6, name: "Performance Test Results.pdf", status: "pending", lastModified: "New" },
                    { id: 7, name: "Warranty Documentation.pdf", status: "pending", lastModified: "New" }
                  ]
                }
              ].map(job => (
                <div key={job.id} className="job-card">
                  <div className="job-header">
                    <div className="job-title-section">
                      <h3 className="job-title">{job.title}</h3>
                      <span className={`job-status-badge ${job.status.toLowerCase().replace(' ', '-')}`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="job-meta">
                      <span className="job-date">
                        📅 {job.scheduledDate}
                        {job.completedDate && ` (Completed: ${job.completedDate})`}
                      </span>
                      <span className="job-duration">⏱️ {job.duration}</span>
                    </div>
                  </div>

                  <div className="job-details">
                    <div className="job-info">
                      <p className="job-description">{job.description}</p>
                      <div className="job-technician">
                        <span className="technician-label">Technician:</span>
                        <span className="technician-name">{job.technician}</span>
                      </div>
                    </div>
                  </div>

                  <div className="job-pdfs">
                    <div className="pdfs-header">
                      <h4>PDF Documents ({job.pdfs.length})</h4>
                      <button className="add-pdf-btn">+ Add PDF</button>
                    </div>
                    
                    <div className="pdfs-list">
                      {job.pdfs.map(pdf => (
                        <div key={pdf.id} className="pdf-item">
                          <div className="pdf-info">
                            <div className="pdf-icon">📄</div>
                            <div className="pdf-details">
                              <span className="pdf-name">{pdf.name}</span>
                              <span className="pdf-modified">Modified: {pdf.lastModified}</span>
                            </div>
                          </div>
                          
                          <div className="pdf-status">
                            <span className={`pdf-status-badge ${pdf.status}`}>
                              {pdf.status === 'completed' ? '✓ Completed' : '⏳ Pending'}
                            </span>
                          </div>

                          <div className="pdf-actions">
                            <button className="action-btn view-btn">👁️ View</button>
                            <button 
                              className="action-btn edit-btn"
                              onClick={() => setCurrentView('pdf-editor')}
                            >
                              ✏️ Edit
                            </button>
                            <button className="action-btn download-btn">⬇️ Download</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'pdf-editor':
        return (
          <div className="pdf-editor-content">
            <div className="pdf-editor-header">
              <div className="breadcrumb">
                <button 
                  className="breadcrumb-link" 
                  onClick={() => setCurrentView('projects')}
                >
                  Projects
                </button>
                <span className="breadcrumb-separator">›</span>
                <button 
                  className="breadcrumb-link" 
                  onClick={() => setCurrentView('jobs')}
                >
                  HVAC Installation
                </button>
                <span className="breadcrumb-separator">›</span>
                <span className="breadcrumb-current">Installation Checklist.pdf</span>
              </div>
              
              <div className="editor-title-section">
                <h2>PDF Editor</h2>
                <div className="editor-actions">
                  <button className="action-button save-btn">💾 Save</button>
                  <button className="action-button submit-btn">📤 Submit</button>
                  <button className="action-button close-btn" onClick={() => setCurrentView('jobs')}>✕ Close</button>
                </div>
              </div>
            </div>

            <div className="pdf-editor-workspace">
              {/* Toolbar */}
              <div className="pdf-toolbar">
                <div className="toolbar-section">
                  <h4>Tools</h4>
                  <div className="tool-buttons">
                    {[
                      { id: 'select', icon: '👆', label: 'Select' },
                      { id: 'text', icon: 'T', label: 'Text' },
                      { id: 'signature', icon: '✍️', label: 'Signature' },
                      { id: 'checkbox', icon: '☑️', label: 'Checkbox' },
                      { id: 'date', icon: '📅', label: 'Date' }
                    ].map(tool => (
                      <button
                        key={tool.id}
                        className={`tool-btn ${selectedTool === tool.id ? 'active' : ''}`}
                        onClick={() => setSelectedTool(tool.id)}
                        title={tool.label}
                      >
                        <span className="tool-icon">{tool.icon}</span>
                        <span className="tool-label">{tool.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="toolbar-section">
                  <h4>Quick Fill</h4>
                  <div className="quick-fill-buttons">
                    <button className="quick-fill-btn">👤 Technician Info</button>
                    <button className="quick-fill-btn">🏠 Customer Details</button>
                    <button className="quick-fill-btn">📋 Job Info</button>
                    <button className="quick-fill-btn">📅 Today's Date</button>
                  </div>
                </div>

                <div className="toolbar-section">
                  <h4>Form Fields</h4>
                  <div className="form-info">
                    <div className="field-count">
                      <span className="count-label">Total Fields:</span>
                      <span className="count-value">12</span>
                    </div>
                    <div className="field-count">
                      <span className="count-label">Completed:</span>
                      <span className="count-value completed">8</span>
                    </div>
                    <div className="field-count">
                      <span className="count-label">Remaining:</span>
                      <span className="count-value remaining">4</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PDF Viewer */}
              <div className="pdf-viewer-container">
                <div className="pdf-viewer-header">
                  <div className="document-info">
                    <span className="doc-name">Installation Checklist.pdf</span>
                    <span className="page-info">Page 1 of 2</span>
                  </div>
                  <div className="viewer-controls">
                    <button className="zoom-btn">🔍- 75%</button>
                    <button className="zoom-btn">🔍+ 125%</button>
                    <button className="fit-btn">📏 Fit Width</button>
                  </div>
                </div>

                <div className="pdf-canvas-container">
                  {/* Simulated PDF Document */}
                  <div className="pdf-page">
                    <div className="pdf-content">
                      {/* Document Header */}
                      <div className="doc-header">
                        <h1>HVAC Installation Checklist</h1>
                        <div className="doc-meta">
                          <p><strong>Project:</strong> Smith Residence HVAC Installation</p>
                          <p><strong>Date:</strong> June 4, 2025</p>
                          <p><strong>Technician:</strong> Mike Johnson</p>
                        </div>
                      </div>

                      {/* Form Sections */}
                      <div className="form-section">
                        <h3>Customer Information</h3>
                        <div className="form-row">
                          <label>Customer Name:</label>
                          <div className="form-field" style={{position: 'relative'}}>
                            {pdfElements.filter(el => el.id === 1).map(el => (
                              <div key={el.id} className="pdf-element text-element" style={{
                                left: el.x - 150,
                                top: el.y - 200,
                                fontSize: el.fontSize
                              }}>
                                {el.content}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="form-row">
                          <label>Address:</label>
                          <div className="form-field">123 Oak Street, Dallas, TX 75201</div>
                        </div>
                      </div>

                      <div className="form-section">
                        <h3>Installation Details</h3>
                        <div className="form-row">
                          <label>Lead Technician:</label>
                          <div className="form-field" style={{position: 'relative'}}>
                            {pdfElements.filter(el => el.id === 2).map(el => (
                              <div key={el.id} className="pdf-element text-element" style={{
                                left: el.x - 150,
                                top: el.y - 250,
                                fontSize: el.fontSize
                              }}>
                                {el.content}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="form-row">
                          <label>Equipment Model:</label>
                          <div className="form-field">Carrier 24ACC636A003</div>
                        </div>
                      </div>

                      <div className="form-section">
                        <h3>Safety Checklist</h3>
                        <div className="checklist-item">
                          <div className="checkbox-container" style={{position: 'relative'}}>
                            {pdfElements.filter(el => el.id === 3).map(el => (
                              <div key={el.id} className="pdf-element checkbox-element" style={{
                                left: el.x - 300,
                                top: el.y - 350
                              }}>
                                {el.checked ? '✓' : '☐'}
                              </div>
                            ))}
                          </div>
                          <label>Power disconnected before installation</label>
                        </div>
                        <div className="checklist-item">
                          <div className="checkbox-container">☐</div>
                          <label>Proper PPE worn throughout installation</label>
                        </div>
                        <div className="checklist-item">
                          <div className="checkbox-container">☐</div>
                          <label>Work area properly ventilated</label>
                        </div>
                      </div>

                      <div className="form-section">
                        <h3>Completion Sign-off</h3>
                        <div className="signature-row">
                          <label>Technician Signature:</label>
                          <div className="signature-field" style={{position: 'relative'}}>
                            {pdfElements.filter(el => el.id === 4).map(el => (
                              <div key={el.id} className="pdf-element signature-element" style={{
                                left: el.x - 150,
                                top: el.y - 450,
                                width: el.width,
                                height: el.height
                              }}>
                                {el.content}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="signature-row">
                          <label>Date:</label>
                          <div className="signature-field">June 4, 2025</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="default-content">
            <h2>{currentView.charAt(0).toUpperCase() + currentView.slice(1)}</h2>
            <p>This section is coming soon...</p>
          </div>
        );
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h1 className="app-title">TitanPDF</h1>
          <p className="app-subtitle">ServiceTitan Integration</p>
        </div>
        
        <nav className="sidebar-nav">
          {navigationItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${currentView === item.id ? 'active' : ''}`}
              onClick={() => setCurrentView(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        {/* Top Header */}
        <header className="top-header">
          <div className="header-left">
            <h2 className="page-title">
              {currentView.charAt(0).toUpperCase() + currentView.slice(1)}
            </h2>
          </div>
          
          <div className="header-right">
            <div className="user-info">
              <span className="user-name">John Technician</span>
              <span className="user-role">Field Tech</span>
            </div>
            <button className="logout-btn">Logout</button>
          </div>
        </header>

        {/* Page Content */}
        <main className="page-content">
          {renderMainContent()}
        </main>
      </div>
    </div>
  );
}

export default App;