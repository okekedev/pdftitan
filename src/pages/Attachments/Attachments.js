// src/pages/Attachments/Attachments.js - SIMPLIFIED: Clean PDF Only Messages
import React, { useState, useEffect } from 'react';
import PDFEditor from '../PDFEditor/PDFEditor';
import apiClient from '../../services/apiClient';
import './Attachments.css';

function Attachments({ job, onBack }) {
  const [selectedPDF, setSelectedPDF] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Load job attachments when component mounts
  useEffect(() => {
    const loadAttachments = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        console.log('📎 Loading attachments for:', {
          jobId: job.id,
          jobNumber: job.number,
          appointmentId: job.appointmentId,
          title: job.title
        });
        
        // ✅ FIXED: Use job.id (which is now the correct jobId from appointment.jobId)
        const attachmentsData = await apiClient.getJobAttachments(job.id);
        
        setAttachments(attachmentsData);
        console.log(`✅ Attachments loaded: ${attachmentsData.length} PDFs found`);
        
      } catch (error) {
        console.error('❌ Error loading attachments:', error);
        const errorInfo = apiClient.handleApiError(error);
        setError(errorInfo.userMessage || `Failed to load attachments: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (job && job.id) {
      loadAttachments();
    }
  }, [job]);

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
    alert(`PDF saved successfully!\n\nJob: ${pdfData.jobInfo.jobNumber}\nElements: ${pdfData.editableElements.length}\nSaved: ${new Date(pdfData.savedAt).toLocaleString()}`);
    
    setSelectedPDF(null);
  };

  const formatFileSize = (bytes) => {
    return apiClient.formatFileSize(bytes);
  };

  const formatDate = (dateString) => {
    return apiClient.formatAttachmentDate(dateString);
  };

  // Show PDF editor if a PDF is selected
  if (selectedPDF) {
    return (
      <PDFEditor
        pdf={selectedPDF}
        job={{
          id: job.id,
          number: job.number,
          title: job.title,
          ...job
        }}
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
              <h2>Save PDF Attachments</h2>
              <p className="job-details">{job.customer?.name || 'Unknown Customer'}</p>
              <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                Job ID: {job.id}
              </div>
            </div>
          </div>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <span>Loading PDF forms...</span>
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
              <h2>Save PDF Attachments</h2>
              <p className="job-details">{job.customer?.name || 'Unknown Customer'}</p>
              <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                Job ID: {job.id}
              </div>
            </div>
          </div>
        </div>
        <div className="error-state">
          <h3>Unable to Load PDF Forms</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </div>
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
            <h2>PDF Forms</h2>
            <p className="job-details">{job.title}</p>
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
              Job ID: {job.id} • Appointment: {job.appointmentNumber}
            </div>
            {attachments.length > 0 && (
              <div style={{ fontSize: '0.9rem', color: '#2ecc71', marginTop: '0.5rem', fontWeight: '500' }}>
                ✅ {attachments.length} PDF form{attachments.length !== 1 ? 's' : ''} found
              </div>
            )}
          </div>
        </div>
      </div>

      {attachments.length === 0 ? (
        // ✅ SIMPLIFIED: Clean "No PDFs" message
        <div className="empty-state">
          <div className="icon">📄</div>
          <h3>No PDF Forms Available</h3>
          <p>
            This appointment does not have any PDF forms attached.<br/>
            PDF forms will appear here when they are uploaded to the job in ServiceTitan.
          </p>
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
            fontSize: '0.85rem',
            color: '#6c757d'
          }}>
            <strong>Note:</strong> Only PDF documents are shown in this portal. Other file types (images, Word docs, etc.) 
            are not displayed but may be available in the main ServiceTitan application.
          </div>
        </div>
      ) : (
        // ✅ SIMPLIFIED: Clean PDF grid
        <>
          <div className="attachments-grid">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="attachment-card"
                onClick={() => handleOpenPDF(attachment)}
              >
                <div className="attachment-content">
                  <div className="attachment-icon" style={{ color: '#e74c3c' }}>
                    📄
                  </div>
                  <h3 className="attachment-name">{attachment.name}</h3>
                  
                  <div className="attachment-meta">
                    {attachment.size > 0 && (
                      <span>Size: {formatFileSize(attachment.size)}</span>
                    )}
                    <span>Added: {formatDate(attachment.createdOn)}</span>
                  </div>
                </div>

                <div className="attachment-footer">
                  <button className="open-pdf-btn">
                    💾 Save PDF →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default Attachments;