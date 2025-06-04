import React, { useState } from 'react';
import PDFEditor from './PDFEditor';
import './Attachments.css';

function Attachments({ job, onBack }) {
  const [selectedPDF, setSelectedPDF] = useState(null);

  // Mock PDF attachments specific to backflow testing
  const [attachments] = useState([
    {
      id: 1,
      name: "Backflow Test Report Form",
      type: "Test Report",
      status: "Required",
      size: "2.3 MB",
      lastModified: "2025-06-04",
      description: "Standard backflow prevention device test report"
    },
    {
      id: 2,
      name: "USC Foundation Safety Report",
      type: "Safety Form",
      status: "Required",
      size: "1.8 MB",
      lastModified: "2025-06-04",
      description: "University of Southern California Foundation safety compliance form"
    },
    {
      id: 3,
      name: "City Compliance Certificate",
      type: "Certificate",
      status: "Optional",
      size: "1.2 MB",
      lastModified: "2025-06-03",
      description: "Municipal water department compliance certificate"
    },
    {
      id: 4,
      name: "Device Maintenance Log",
      type: "Maintenance",
      status: "Completed",
      size: "950 KB",
      lastModified: "2025-06-02",
      description: "Historical maintenance and repair log"
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
    setSelectedPDF(attachment);
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
            <h2>PDF Forms - {job.workOrderNumber}</h2>
            <p className="job-details">{job.deviceType} • {job.location}</p>
          </div>
        </div>
      </div>

      <div className="attachments-grid">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="attachment-card"
            onClick={() => handleOpenPDF(attachment)}
          >
            <div className="attachment-header">
              <div className="attachment-info">
                <span className="file-icon">{getFileIcon(attachment.type)}</span>
                <div>
                  <h3 className="attachment-name">{attachment.name}</h3>
                  <p className="attachment-type">{attachment.type}</p>
                </div>
              </div>
              <span className={`status-badge ${getStatusColor(attachment.status)}`}>
                {attachment.status}
              </span>
            </div>

            <div className="attachment-description">
              <p>{attachment.description}</p>
            </div>

            <div className="attachment-details">
              <div className="detail-row">
                <span className="detail-label">Size:</span>
                <span className="detail-value">{attachment.size}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Last Modified:</span>
                <span className="detail-value">{attachment.lastModified}</span>
              </div>
            </div>

            <div className="attachment-footer">
              <button className="open-pdf-btn">
                {attachment.status === 'Completed' ? 'View Form' : 'Fill Out Form'} →
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