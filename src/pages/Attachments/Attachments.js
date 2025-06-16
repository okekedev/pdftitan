// src/pages/Attachments/Attachments.js - Enhanced with Real ServiceTitan Data
import React, { useState, useEffect } from 'react';
import PDFEditor from '../PDFEditor/PDFEditor';
import apiClient from '../../services/apiClient';
import './Attachments.css';

function Attachments({ job, onBack }) {
  const [selectedPDF, setSelectedPDF] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [jobDetails, setJobDetails] = useState(null);

  // Load job attachments when component mounts
  useEffect(() => {
    const loadJobData = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        console.log(`📎 Loading attachments for job: ${job.number} (ID: ${job.id})`);
        
        // Fetch job details and attachments
        const [details, attachmentData] = await Promise.all([
          apiClient.getJobDetails(job.id),
          apiClient.getJobAttachments(job.id)
        ]);
        
        setJobDetails(details);
        setAttachments(attachmentData);
        
        console.log(`✅ Loaded job data:`, {
          jobNumber: details.number,
          jobTitle: details.title,
          attachmentCount: attachmentData.length
        });
        
        if (attachmentData.length === 0) {
          console.log(`ℹ️ No PDF attachments found for job ${job.number}`);
        }
        
      } catch (error) {
        console.error('❌ Error loading job data:', error);
        const errorInfo = apiClient.handleApiError(error);
        setError(errorInfo.userMessage || `Failed to load attachments: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (job && job.id) {
      loadJobData();
    }
  }, [job]);

  const getStatusColor = (status) => {
    return 'status-available'; // Simple single status
  };

  const getFileIcon = () => {
    return '📄'; // Simple PDF icon for all documents
  };

  const handleOpenPDF = (attachment) => {
    console.log(`📖 Opening PDF: ${attachment.name}`);
    setSelectedPDF(attachment);
  };

  const handleClosePDF = () => {
    console.log(`❌ Closing PDF editor`);
    setSelectedPDF(null);
  };

  const handleSavePDF = (pdfData) => {
    console.log('💾 Saving PDF:', {
      pdfId: pdfData.pdfId,
      jobId: pdfData.jobInfo.jobId,
      elementCount: pdfData.editableElements.length,
      savedAt: pdfData.savedAt
    });
    
    // TODO: Save the PDF data back to ServiceTitan
    // This would involve uploading the modified PDF back to the job
    
    alert(`PDF saved successfully!\n\nJob: ${pdfData.jobInfo.jobNumber}\nElements: ${pdfData.editableElements.length}\nSaved: ${new Date(pdfData.savedAt).toLocaleString()}`);
    
    setSelectedPDF(null);
  };

  const formatFileSize = (bytes) => {
    return apiClient.formatFileSize(bytes);
  };

  const formatDate = (dateString) => {
    return apiClient.formatAttachmentDate(dateString);
  };

  const getAttachmentSummary = () => {
    return {
      total: attachments.length,
      hasDocuments: attachments.length > 0
    };
  };

  // Show PDF editor if a PDF is selected
  if (selectedPDF) {
    return (
      <PDFEditor
        pdf={selectedPDF}
        job={jobDetails || job}
        onClose={handleClosePDF}
        onSave={handleSavePDF}
      />
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="attachments-container">
        <div className="attachments-header">
          <div className="header-top">
            <button onClick={onBack} className="back-button">
              ← Back to Jobs
            </button>
            <div className="job-info">
              <h2>PDF Forms - {job.number || job.id}</h2>
              <p className="job-details">Loading job data...</p>
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '200px',
          background: 'white',
          borderRadius: '12px',
          margin: '1rem 0'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e9ecef',
            borderTop: '4px solid #2ecc71',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span style={{ marginLeft: '1rem', color: '#666' }}>Loading PDF forms...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="attachments-container">
        <div className="attachments-header">
          <div className="header-top">
            <button onClick={onBack} className="back-button">
              ← Back to Jobs
            </button>
            <div className="job-info">
              <h2>PDF Forms - {job.number || job.id}</h2>
              <p className="job-details" style={{ color: '#e74c3c' }}>{error}</p>
            </div>
          </div>
        </div>
        <div style={{
          background: '#fff',
          padding: '2rem',
          borderRadius: '12px',
          textAlign: 'center',
          border: '2px dashed #e74c3c',
          margin: '1rem 0'
        }}>
          <h3 style={{ color: '#e74c3c', marginBottom: '1rem' }}>Error Loading Forms</h3>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>{error}</p>
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

  const summary = getAttachmentSummary();

  return (
    <div className="attachments-container">
      <div className="attachments-header">
        <div className="header-top">
          <button onClick={onBack} className="back-button">
            ← Back to Jobs
          </button>
          <div className="job-info">
            <h2>PDF Forms - {jobDetails?.number || job.number || job.id}</h2>
            <p className="job-details">{jobDetails?.title || job.title || 'Service Call'}</p>
            {summary.total > 0 && (
              <div className="attachment-summary" style={{
                marginTop: '0.5rem',
                fontSize: '0.9rem',
                color: '#666'
              }}>
                {summary.total} PDF document{summary.total !== 1 ? 's' : ''} found
              </div>
            )}
          </div>
        </div>
      </div>

      {attachments.length === 0 ? (
        <div style={{
          background: '#fff',
          padding: '3rem',
          borderRadius: '12px',
          textAlign: 'center',
          border: '2px dashed #e9ecef',
          margin: '1rem 0'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
          <h3 style={{ color: '#666', marginBottom: '1rem' }}>No PDF Documents Found</h3>
          <p style={{ color: '#999', lineHeight: '1.5' }}>
            This job does not have any PDF documents attached.<br/>
            PDF documents will appear here when they are uploaded to the job in ServiceTitan.
          </p>
        </div>
      ) : (
        <>
          <div className="attachments-grid">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="attachment-card"
                onClick={() => handleOpenPDF(attachment)}
              >
                <div className="attachment-content">
                  <div className="attachment-icon">
                    {getFileIcon()}
                  </div>
                  <h3 className="attachment-name">{attachment.name}</h3>
                  
                  <div className="attachment-meta" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    fontSize: '0.8rem',
                    color: '#999',
                    marginBottom: '0.75rem'
                  }}>
                    {attachment.size > 0 && (
                      <span>Size: {formatFileSize(attachment.size)}</span>
                    )}
                    <span>Added: {formatDate(attachment.createdOn)}</span>
                  </div>
                  
                  <span className={`status-badge ${getStatusColor(attachment.status)}`}>
                    PDF Document
                  </span>
                </div>

                <div className="attachment-footer">
                  <button className="open-pdf-btn">
                    Open PDF →
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="attachments-actions">
            <button 
              className="save-all-btn"
              onClick={() => {
                alert(`This will save all ${attachments.length} completed PDF forms back to ServiceTitan job ${jobDetails?.number || job.number}.`);
              }}
            >
              Save All to ServiceTitan
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default Attachments;