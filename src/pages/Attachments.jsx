// src/pages/Attachments/Attachments.jsx - Modern JSX with Global Styles
import React, { useState, useEffect } from 'react';
import PDFEditor from './PDFEditor';
import apiClient from '../services/apiClient';

export default function Attachments({ job, onBack }) {
  const [selectedPDF, setSelectedPDF] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAttachments = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        console.log('📎 Loading attachments for job:', job.id);
        
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

    if (job?.id) {
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

  const handleSavePDF = async (pdfData) => {
    try {
      console.log('💾 Saving PDF:', pdfData);
      
      // Save the PDF data back to ServiceTitan
      const result = await apiClient.saveCompletedPDFForm(
        pdfData.jobInfo.jobId,
        pdfData.serviceTitanId,
        {
          elements: pdfData.editableElements,
          metadata: {
            savedAt: pdfData.savedAt,
            elementCount: pdfData.editableElements.length
          }
        }
      );
      
      if (result.success) {
        // Show success message
        console.log('✅ PDF saved successfully');
        // You could add a toast notification here
        
        setSelectedPDF(null);
      }
      
    } catch (error) {
      console.error('❌ Error saving PDF:', error);
      // Handle save error - could show error toast
      alert(`Error saving PDF: ${error.message}`);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return 'Unknown size';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
    <div className="page-container">
      {/* Header */}
      <div className="attachments-header">
        <div className="header-actions">
          <button 
            onClick={onBack} 
            className="btn btn-secondary"
            aria-label="Go back to jobs"
          >
            ← Back to Jobs
          </button>
        </div>
        
        <div className="job-info">
          <h2 className="page-title">📎 PDF Forms</h2>
          <div className="job-details">
            <h3 className="job-customer">{job.title}</h3>
            <div className="job-meta">
              <span>Job ID: {job.id}</span>
              <span>•</span>
              <span>Appointment: {job.appointmentNumber}</span>
            </div>
            {attachments.length > 0 && (
              <div className="status-message success">
                ✅ {attachments.length} PDF form{attachments.length !== 1 ? 's' : ''} found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="loading-content text-center">
          <div className="loading-spinner"></div>
          <h3>Loading PDF Forms</h3>
          <p className="text-gray-600">Fetching forms from ServiceTitan...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <>
          <div className="alert alert-error">
            <span>❌</span>
            <div>
              <strong>Unable to Load PDF Forms</strong>
              <p>{error}</p>
            </div>
          </div>
          <div className="text-center mt-4">
            <button 
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              🔄 Try Again
            </button>
          </div>
        </>
      )}

      {/* Empty State */}
      {!isLoading && !error && attachments.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <h3>No PDF Forms Available</h3>
          <p className="text-gray-600">
            This appointment does not have any PDF forms attached.
            <br />
            PDF forms will appear here when they are uploaded to the job in ServiceTitan.
          </p>
          
          <div className="info-box">
            <strong>Note:</strong> Only PDF documents are shown in this portal. 
            Other file types (images, Word docs, etc.) are not displayed but may be 
            available in the main ServiceTitan application.
          </div>
        </div>
      )}

      {/* PDF Grid */}
      {!isLoading && !error && attachments.length > 0 && (
        <div className="attachments-grid grid grid-auto-fit">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="attachment-card card"
              onClick={() => handleOpenPDF(attachment)}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleOpenPDF(attachment);
                }
              }}
              aria-label={`Open PDF: ${attachment.name}`}
            >
              {/* Card Header */}
              <div className="card-header">
                <div className="attachment-icon">
                  📄
                </div>
                <div className="attachment-type">
                  <span className="status-badge status-default">PDF</span>
                </div>
              </div>

              {/* Card Body */}
              <div className="card-body">
                <h4 className="attachment-name font-semibold mb-2">
                  {attachment.name}
                </h4>
                
                <div className="attachment-meta text-sm text-gray-600">
                  {attachment.size > 0 && (
                    <div className="meta-item">
                      <span className="meta-label">Size:</span>
                      <span>{formatFileSize(attachment.size)}</span>
                    </div>
                  )}
                  <div className="meta-item">
                    <span className="meta-label">Added:</span>
                    <span>{formatDate(attachment.createdOn)}</span>
                  </div>
                  {attachment.category && (
                    <div className="meta-item">
                      <span className="meta-label">Category:</span>
                      <span>{attachment.category}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer */}
              <div className="card-footer">
                <button className="btn btn-primary btn-sm">
                  💾 Fill & Save PDF →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Additional Attachments-specific styles
const attachmentsStyles = `
.attachments-header {
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: 2px solid var(--gray-200);
}

.header-actions {
  margin-bottom: var(--spacing-md);
}

.job-info {
  text-align: center;
}

.page-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--gray-800);
  margin-bottom: var(--spacing-sm);
}

.job-customer {
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--gray-700);
  margin-bottom: var(--spacing-xs);
}

.job-meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  font-size: 0.9rem;
  color: var(--gray-600);
  margin-bottom: var(--spacing-sm);
}

.status-message {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 500;
}

.status-message.success {
  background: #f0fff4;
  color: #22543d;
  border: 1px solid #9ae6b4;
}

.empty-state {
  text-align: center;
  padding: var(--spacing-2xl);
  background: var(--white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 2px dashed var(--gray-300);
  margin: var(--spacing-xl) 0;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: var(--spacing-lg);
  opacity: 0.6;
}

.empty-state h3 {
  color: var(--gray-700);
  margin-bottom: var(--spacing-sm);
  font-size: 1.5rem;
}

.info-box {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--gray-100);
  border-radius: var(--radius-md);
  border: 1px solid var(--gray-300);
  font-size: 0.9rem;
  color: var(--gray-700);
  text-align: left;
}

.attachments-grid {
  margin-top: var(--spacing-xl);
}

.attachment-card {
  cursor: pointer;
  transition: all var(--transition-normal);
  border: 2px solid transparent;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.attachment-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--primary-color);
}

.attachment-card:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.attachment-icon {
  font-size: 2.5rem;
  color: var(--error-color);
  margin-bottom: var(--spacing-sm);
}

.attachment-type {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
}

.attachment-name {
  color: var(--gray-800);
  line-height: 1.3;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.attachment-meta {
  flex: 1;
}

.meta-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xs);
}

.meta-label {
  font-weight: 500;
  color: var(--gray-500);
}

.attachment-card .btn {
  transition: var(--transition-normal);
  width: 100%;
}

.attachment-card:hover .btn {
  background: var(--primary-dark);
  transform: translateY(-1px);
}

@media (max-width: 768px) {
  .page-title {
    font-size: 1.6rem;
  }
  
  .job-meta {
    flex-direction: column;
    gap: var(--spacing-xs);
  }
  
  .job-meta span:nth-child(2) {
    display: none; /* Hide separator on mobile */
  }
  
  .empty-state {
    padding: var(--spacing-xl);
  }
  
  .empty-icon {
    font-size: 3rem;
  }
}
`;

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('attachments-styles')) {
  const style = document.createElement('style');
  style.id = 'attachments-styles';
  style.textContent = attachmentsStyles;
  document.head.appendChild(style);
}