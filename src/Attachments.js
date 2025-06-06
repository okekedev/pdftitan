import React, { useState } from 'react';
import PDFEditor from './PDFEditor';
import './Attachments.css';

function Attachments({ job, onBack }) {
  const [selectedPDF, setSelectedPDF] = useState(null);

  // Mock PDF attachments - only first one is active
  const [attachments] = useState([
    {
      id: 1,
      name: "Backflow Test Report Form",
      type: "Test Report",
      status: "Required",
      active: true,
      pdfPath: "/assets/sample.pdf"
    },
    {
      id: 2,
      name: "USC Foundation Safety Report",
      type: "Safety Form", 
      status: "Required",
      active: false
    },
    {
      id: 3,
      name: "City Compliance Certificate",
      type: "Certificate",
      status: "Optional",
      active: false
    }
  ]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Required': return 'status-required';
      case 'Optional': return 'status-optional';
      case 'Completed': return 'status-completed';
      default: return 'status-default';
    }
  };

  const getFileIcon = (type) => {
    switch (type) {
      case 'Test Report': return '📋';
      case 'Safety Form': return '⚠️';
      case 'Certificate': return '🏆';
      case 'Maintenance': return '🔧';
      default: return '📄';
    }
  };

  const handleOpenPDF = (attachment) => {
    if (attachment.active) {
      setSelectedPDF(attachment);
    }
  };

  const handleClosePDF = () => {
    setSelectedPDF(null);
  };

  const handleSavePDF = (pdfData) => {
    console.log('Saving PDF:', pdfData);
    // Here you would save the PDF data back to ServiceTitan
    setSelectedPDF(null);
  };

  // Show PDF editor if a PDF is selected
  if (selectedPDF) {
    return (
      <PDFEditor
        pdf={selectedPDF}
        job={job}
        onClose={handleClosePDF}
        onSave={handleSavePDF}
      />
    );
  }

  return (
    <div className="attachments-container">
      <div className="attachments-header">
        <div className="header-top">
          <button onClick={onBack} className="back-button">
            ← Back to Jobs
          </button>
          <div className="job-info">
            <h2>PDF Forms - {job.id}</h2>
            <p className="job-details">{job.name}</p>
          </div>
        </div>
      </div>

      <div className="attachments-grid">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className={`attachment-card ${!attachment.active ? 'disabled' : ''}`}
            onClick={() => handleOpenPDF(attachment)}
          >
            <div className="attachment-content">
              <div className="attachment-icon">
                {getFileIcon(attachment.type)}
              </div>
              <h3 className="attachment-name">{attachment.name}</h3>
              <p className="attachment-type">{attachment.type}</p>
              <span className={`status-badge ${getStatusColor(attachment.status)}`}>
                {attachment.status}
              </span>
            </div>

            <div className="attachment-footer">
              <button 
                className={`open-pdf-btn ${!attachment.active ? 'disabled' : ''}`}
                disabled={!attachment.active}
              >
                {attachment.active 
                  ? (attachment.status === 'Completed' ? 'View Form →' : 'Fill Out Form →')
                  : (attachment.status === 'Completed' ? 'View Form' : 'Fill Out Form')
                }
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="attachments-actions">
        <button className="save-all-btn">
          Save All to ServiceTitan
        </button>
      </div>
    </div>
  );
}

export default Attachments;