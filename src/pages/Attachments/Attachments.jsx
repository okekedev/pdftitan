// src/pages/Attachments.jsx - Cleaned and optimized
import React, { useState, useEffect } from 'react';
import PDFEditor from '../PDFEditor/PDFEditor';
import apiClient from '../../services/apiClient';
import './Attachments.css';

export default function Attachments({ job, onBack }) {
  const [selectedPDF, setSelectedPDF] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [jobDetails, setJobDetails] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingJobDetails, setIsLoadingJobDetails] = useState(true);
  const [error, setError] = useState('');

  // Load job details and customer information
  useEffect(() => {
    const loadJobDetails = async () => {
      try {
        setIsLoadingJobDetails(true);
        
        console.log('📋 Loading job details for:', job.id);
        
        // Get detailed job information
        const jobData = await apiClient.getJobDetails(job.id);
        setJobDetails(jobData);
        
        // Get customer information if we have a customer ID
        if (jobData.customer?.id) {
          try {
            const customerInfo = await apiClient.getCustomerDetails(jobData.customer.id);
            setCustomerData(customerInfo);
            console.log('✅ Customer details loaded:', customerInfo.name);
          } catch (error) {
            console.warn('⚠️ Could not load customer details:', error.message);
            // Don't fail the whole page if customer details fail
          }
        }
        
        console.log('✅ Job details loaded');
        
      } catch (error) {
        console.error('❌ Error loading job details:', error);
        // Don't set error state for job details - use the data we have from props
      } finally {
        setIsLoadingJobDetails(false);
      }
    };

    if (job?.id) {
      loadJobDetails();
    }
  }, [job]);

  // Load attachments
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

  // Proper PDF opening with ID handling
  const handleOpenPDF = (attachment) => {
    console.log(`📖 Opening PDF: ${attachment.name}`);
    console.log('📋 Original attachment data:', attachment);
    
    // Ensure the attachment has the required IDs
    const pdfData = {
      ...attachment,
      // Ensure we have both id and serviceTitanId for compatibility
      id: attachment.id || attachment.serviceTitanId,
      serviceTitanId: attachment.serviceTitanId || attachment.id
    };
    
    console.log('📋 Processed PDF data for editor:', pdfData);
    console.log('🔑 PDF ID:', pdfData.id, 'ServiceTitan ID:', pdfData.serviceTitanId);
    
    setSelectedPDF(pdfData);
  };

  // Proper PDF closing
  const handleClosePDF = () => {
    console.log(`❌ Closing PDF editor`);
    setSelectedPDF(null);
  };

  // Remove browser alerts and let PDFEditor handle all UI feedback
  const handleSavePDF = async (pdfData) => {
    try {
      console.log('💾 Saving PDF in Attachments.jsx:', pdfData);
      
      // Extract the attachment ID from multiple possible sources
      const attachmentId = pdfData.attachmentId || 
                          selectedPDF?.serviceTitanId || 
                          selectedPDF?.id ||
                          pdfData.serviceTitanId ||
                          pdfData.pdfId;
      
      if (!attachmentId) {
        console.error('❌ Missing attachment ID. Available data:', {
          pdfData: Object.keys(pdfData),
          selectedPDF: selectedPDF ? Object.keys(selectedPDF) : 'null',
          pdfDataAttachmentId: pdfData.attachmentId,
          selectedPDFServiceTitanId: selectedPDF?.serviceTitanId,
          selectedPDFId: selectedPDF?.id
        });
        throw new Error('Missing attachment ID - cannot identify which PDF to save');
      }
      
      console.log('🔗 Using attachment ID:', attachmentId, 'for job:', job.id);
      console.log('📋 Complete save data:', pdfData);
      
      // Save the PDF data to ServiceTitan
      const result = await apiClient.saveCompletedPDFForm(
        job.id,
        attachmentId,
        pdfData
      );
      
      // Let PDFEditor handle success UI - no browser alert
      if (result.success) {
        console.log('✅ PDF saved successfully:', result);
        console.log(`📤 Upload completed: ${result.fileName}`);
        
        // The PDFEditor will show its custom success popup
        // and then call onClose() which triggers setSelectedPDF(null)
        // No need to manually close here or show alert
        return result; // Return result to PDFEditor
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Error saving PDF:', error);
      
      // Remove browser alert for errors too
      // Let PDFEditor handle error display in its custom popup
      throw error; // Throw error back to PDFEditor for custom error handling
    }
  };

  // Utility functions - only include what's actually used
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

  const getStatusIcon = (status) => {
    const statusName = status?.name || status;
    switch (statusName?.toLowerCase()) {
      case 'scheduled': return '📅';
      case 'dispatched': return '🚚';
      case 'enroute': return '🛣️';
      case 'working': return '🔧';
      case 'hold': return '⏸️';
      case 'done': return '✅';
      case 'canceled': return '❌';
      default: return '📋';
    }
  };

  const getStatusClass = (status) => {
    const statusName = status?.name || status;
    switch (statusName?.toLowerCase()) {
      case 'scheduled': return 'status-scheduled';
      case 'dispatched': return 'status-dispatched';
      case 'enroute': return 'status-enroute';
      case 'working': return 'status-working';
      case 'hold': return 'status-hold';
      case 'done': return 'status-done';
      case 'canceled': return 'status-canceled';
      default: return 'status-default';
    }
  };

  // Use jobDetails if available, otherwise fall back to job prop
  const displayJob = jobDetails || job;
  const displayCustomer = customerData || displayJob.customer;

  // Extract clean job description from title (remove job number if it's duplicated)
  const getJobDescription = (job) => {
    if (!job) return '';
    
    const title = job.summary || job.title || '';
    const jobNumber = job.number || job.jobNumber || '';
    
    // Remove job number from title if it's at the beginning
    if (jobNumber && title.startsWith(jobNumber)) {
      return title.replace(jobNumber, '').replace(/^[-\s]+/, '').trim();
    }
    
    return title;
  };

  // Show PDF Editor if a PDF is selected
  if (selectedPDF) {
    return (
      <PDFEditor
        pdf={selectedPDF}
        job={displayJob}
        onClose={handleClosePDF}
        onSave={handleSavePDF}
      />
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <button 
          onClick={onBack} 
          className="back-btn"
          aria-label="Back to jobs"
        >
          ← Back to Jobs
        </button>
        <h2>📎 Job Attachments</h2>
        <div className="spacer"></div>
      </div>

      {/* Main Content Grid */}
      <div className="main-content-grid">
        {/* Job Information (Left Column) */}
        <div className="job-info-column">
          <div className="card job-info-card">
            {/* Job Header */}
            <div className="job-header-section">
              <div className="job-number-badge">
                <span className="job-number">#{displayJob.number}</span>
                <div className={`status-badge ${getStatusClass(displayJob.status)}`}>
                  <span className="status-icon">{getStatusIcon(displayJob.status)}</span>
                  <span className="status-text">{displayJob.status?.name || displayJob.status || 'Unknown'}</span>
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div className="customer-section">
              <div className="section-header">
                <h4>👤 Customer</h4>
              </div>
              
              {displayCustomer ? (
                <div className="customer-info">
                  <h3 className="customer-main-title">{displayCustomer.name}</h3>
                  
                  {displayCustomer.address && (
                    <div className="customer-location">
                      <div className="location-header">
                        <span className="location-icon">📍</span>
                        <span className="location-label">Service Address</span>
                      </div>
                      <div className="location-details">
                        <div className="address-line">{displayCustomer.address.street}</div>
                        <div className="city-state-zip">
                          {displayCustomer.address.city}, {displayCustomer.address.state} {displayCustomer.address.zip}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {displayCustomer.phoneNumbers?.length > 0 && (
                    <div className="contact-info">
                      <div className="contact-item">
                        <span className="contact-icon">📞</span>
                        <span className="contact-value">{displayCustomer.phoneNumbers[0].number}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="customer-loading">
                  {isLoadingJobDetails ? (
                    <div className="loading-text">Loading customer details...</div>
                  ) : (
                    <div className="no-customer">Customer information not available</div>
                  )}
                </div>
              )}
            </div>

            {/* Job Description */}
            <div className="job-description">
              <div className="section-header">
                <h4>📋 Job Details</h4>
              </div>
              <p className="job-summary">{getJobDescription(displayJob) || 'No description available'}</p>
              
              {/* Job Metadata */}
              <div className="job-metadata">
                {displayJob.scheduledStart && (
                  <div className="metadata-item">
                    🕐 Scheduled: {formatDate(displayJob.scheduledStart)}
                  </div>
                )}
                {displayJob.businessUnit?.name && (
                  <div className="metadata-item">
                    🏢 {displayJob.businessUnit.name}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* PDF Forms (Right Column) */}
        <div className="pdf-forms-column">
          <div className="card pdf-forms-card">
            <div className="pdf-header">
              <h4>📄 PDF Forms</h4>
              <div className="status-message success">
                <span>✅</span>
                <span>Ready to edit forms</span>
              </div>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="loading-overlay">
                <div className="loading-spinner"></div>
                <div className="loading-text">Loading PDF attachments...</div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="error-message">
                <span>❌</span>
                <span>{error}</span>
              </div>
            )}

            {/* PDF List */}
            {!isLoading && !error && (
              <div className="pdf-list">
                {attachments.length > 0 ? (
                  attachments.map((attachment) => (
                    <div
                      key={attachment.id || attachment.serviceTitanId}
                      className="pdf-item"
                      onClick={() => handleOpenPDF(attachment)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleOpenPDF(attachment);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open PDF: ${attachment.name}`}
                    >
                      <div className="pdf-item-header">
                        <span className="pdf-icon">📄</span>
                      </div>
                      
                      <div className="pdf-name">{attachment.name}</div>
                      
                      <div className="pdf-meta">
                        {attachment.createdOn && (
                          <div className="meta-line">
                            <span className="meta-label">Added:</span>
                            <span>{formatDate(attachment.createdOn)}</span>
                          </div>
                        )}
                        {attachment.size && (
                          <div className="meta-line">
                            <span className="meta-label">Size:</span>
                            <span>{formatFileSize(attachment.size)}</span>
                          </div>
                        )}
                      </div>
                      
                      <button className="pdf-action-btn btn-primary">
                        Open & Edit PDF
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-state-compact">
                    <div className="empty-icon">📄</div>
                    <h5>No PDF Forms Found</h5>
                    <p>This job doesn't have any PDF attachments that can be edited.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Utility function for file size formatting - only include if actually used
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return 'Unknown size';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}