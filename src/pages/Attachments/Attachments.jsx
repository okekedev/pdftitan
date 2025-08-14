// src/pages/Attachments/Attachments.jsx - Redesigned Layout
import React, { useState, useEffect } from "react";
import PDFEditor from "../PDFEditor/PDFEditor";
import Header from "../../components/Header/Header";
import apiClient from "../../services/apiClient";
import "./Attachments.css";

export default function Attachments({
  job,
  onBack,
  onPdfEditorStateChange,
  technician,
  onLogout,
}) {
  const [selectedPDF, setSelectedPDF] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [jobDetails, setJobDetails] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingJobDetails, setIsLoadingJobDetails] = useState(true);
  const [error, setError] = useState("");

  // Load job details and customer information
  useEffect(() => {
    const loadJobDetails = async () => {
      try {
        setIsLoadingJobDetails(true);

        console.log("📋 Loading job details for:", job.id);

        // Get detailed job information
        const jobData = await apiClient.getJobDetails(job.id);
        setJobDetails(jobData);

        // Get customer information if we have a customer ID
        if (jobData.customer?.id) {
          try {
            const customerInfo = await apiClient.getCustomerDetails(
              jobData.customer.id
            );
            setCustomerData(customerInfo);
            console.log("✅ Customer details loaded:", customerInfo.name);
          } catch (error) {
            console.warn("⚠️ Could not load customer details:", error.message);
            // Don't fail the whole page if customer details fail
          }
        }

        console.log("✅ Job details loaded");
      } catch (error) {
        console.error("❌ Error loading job details:", error);
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
        setError("");

        console.log("📎 Loading attachments for job:", job.id);

        const attachmentsData = await apiClient.getJobAttachments(job.id);
        setAttachments(attachmentsData);

        console.log(
          `✅ Attachments loaded: ${attachmentsData.length} PDFs found`
        );
      } catch (error) {
        console.error("❌ Error loading attachments:", error);
        const errorInfo = apiClient.handleApiError(error);
        setError(
          errorInfo.userMessage ||
            `Failed to load attachments: ${error.message}`
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (job?.id) {
      loadAttachments();
    }
  }, [job]);

  // Notify App component when PDF Editor state changes
  useEffect(() => {
    if (onPdfEditorStateChange) {
      onPdfEditorStateChange(selectedPDF !== null);
    }
  }, [selectedPDF, onPdfEditorStateChange]);

  // PDF handling functions
  const handleOpenPDF = (attachment) => {
    console.log(`📖 Opening PDF: ${attachment.name}`);

    const pdfData = {
      ...attachment,
      id: attachment.id || attachment.serviceTitanId,
      serviceTitanId: attachment.serviceTitanId || attachment.id,
    };

    setSelectedPDF(pdfData);
  };

  const handleClosePDF = () => {
    console.log(`❌ Closing PDF editor`);
    setSelectedPDF(null);
  };

  const handleSavePDF = async (pdfData) => {
    try {
      console.log("💾 Saving PDF in Attachments.jsx:", pdfData);

      const attachmentId =
        pdfData.attachmentId ||
        selectedPDF?.serviceTitanId ||
        selectedPDF?.id ||
        pdfData.serviceTitanId ||
        pdfData.pdfId;

      if (!attachmentId) {
        throw new Error("Missing attachment ID - cannot save PDF");
      }

      console.log("🔑 Using attachment ID:", attachmentId);

      const response = await apiClient.uploadCompletedPDF({
        jobId: job.id,
        attachmentId: attachmentId,
        fileName: pdfData.fileName,
        originalFileName: pdfData.originalFileName,
        fields: pdfData.fields,
        metadata: pdfData.metadata,
      });

      console.log("✅ PDF save response:", response);

      return {
        success: true,
        message: "PDF saved successfully",
        fileName: response.fileName || pdfData.fileName,
        uploadedAt: response.uploadedAt || new Date().toISOString(),
      };
    } catch (error) {
      console.error("❌ Error saving PDF:", error);

      return {
        success: false,
        error: error.message || "Failed to save PDF",
      };
    }
  };

  // Helper functions
  const getStatusClass = (status) => {
    if (!status) return "status-default";
    const statusName = (status.name || status).toLowerCase();
    return `status-${statusName.replace(/\s+/g, "-")}`;
  };

  const getStatusIcon = (status) => {
    if (!status) return "📋";
    const statusName = (status.name || status).toLowerCase();

    if (statusName.includes("in progress") || statusName.includes("dispatched"))
      return "🚀";
    if (statusName.includes("completed") || statusName.includes("done"))
      return "✅";
    if (statusName.includes("scheduled")) return "📅";
    if (statusName.includes("cancelled")) return "❌";
    if (statusName.includes("on hold")) return "⏸️";

    return "📋";
  };

  const formatAddress = (address) => {
    if (!address) return null;

    const parts = [];
    if (address.street) parts.push(address.street);

    const cityStateZip = [];
    if (address.city) cityStateZip.push(address.city);
    if (address.state) cityStateZip.push(address.state);
    if (address.zip) cityStateZip.push(address.zip);

    if (cityStateZip.length > 0) {
      parts.push(cityStateZip.join(", "));
    }

    return parts.join("\n");
  };

  // Create breadcrumbs for header
  const breadcrumbs = [

    {
      id: "attachments",
      label: `Job #${job?.number || "Unknown"} - PDF Forms`,
      active: true,
    },
  ];

  // Determine what data to display
  const displayJob = jobDetails || job;
  const displayCustomer = customerData || jobDetails?.customer || job?.customer;

  // Show PDF Editor if a PDF is selected (no header/footer)
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

  // Loading state
  if (isLoading) {
    return (
      <div className="attachments-page">
        <Header
          user={technician}
          onLogout={onLogout}
          currentPage="attachments"
          onNavigate={onBack}
          breadcrumbs={breadcrumbs}
        />
        <div className="page-container">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <h2>Loading Attachments</h2>
            <p>Fetching PDF documents and job details...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="attachments-page">
        <Header
          user={technician}
          onLogout={onLogout}
          currentPage="attachments"
          onNavigate={onBack}
          breadcrumbs={breadcrumbs}
        />
        <div className="page-container">
          <div className="page-header">
            <button onClick={onBack} className="back-btn">
              ← Back to Jobs
            </button>
          </div>
          <div className="error-message">
            <span>⚠️</span>
            <div>
              <strong>Failed to Load Attachments</strong>
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="attachments-page">
      <Header
        user={technician}
        onLogout={onLogout}
        currentPage="attachments"
        onNavigate={onBack}
        breadcrumbs={breadcrumbs}
      />

      <div className="page-container">
        {/* Back Button */}
        <div className="page-header">
          <button onClick={onBack} className="back-btn">
            ← Back to Jobs
          </button>
        </div>

        {/* Main Content Layout: 33% Customer Info | 66% PDF Forms */}
        <div className="main-layout">
          {/* Customer Information Section (33%) */}
          <div className="customer-info-section">
            <div className="section-header">
              <h3>👤 Customer Information</h3>
            </div>
            <div className="customer-details">
              {displayCustomer ? (
                <>
                  <div className="customer-name">
                    {displayCustomer.name || "Unknown Customer"}
                  </div>
                  <div className="job-number">
                    Job #{displayJob.number}
                    <div
                      className={`status-badge ${getStatusClass(
                        displayJob.status
                      )}`}
                    >
                      {getStatusIcon(displayJob.status)}{" "}
                      {displayJob.status?.name ||
                        displayJob.status ||
                        "Unknown"}
                    </div>
                  </div>

                  <div className="customer-info-grid">
                    {displayCustomer.address && (
                      <div className="info-item">
                        <div className="info-icon">📍</div>
                        <div className="info-content">
                          <div className="info-label">Address</div>
                          <div className="info-value">
                            {formatAddress(displayCustomer.address)}
                          </div>
                        </div>
                      </div>
                    )}

                    {displayCustomer.phoneNumbers &&
                      displayCustomer.phoneNumbers.length > 0 && (
                        <div className="info-item">
                          <div className="info-icon">📞</div>
                          <div className="info-content">
                            <div className="info-label">Phone</div>
                            <div className="info-value">
                              {displayCustomer.phoneNumbers[0].number}
                            </div>
                          </div>
                        </div>
                      )}

                    {displayJob.title && (
                      <div className="info-item">
                        <div className="info-icon">🔧</div>
                        <div className="info-content">
                          <div className="info-label">Job Type</div>
                          <div className="info-value">{displayJob.title}</div>
                        </div>
                      </div>
                    )}

                    {displayJob.technician && (
                      <div className="info-item">
                        <div className="info-icon">👷</div>
                        <div className="info-content">
                          <div className="info-label">Technician</div>
                          <div className="info-value">
                            {displayJob.technician.name}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon"></div>
                  <h4>Customer Information</h4>
                  <p>
                    {isLoadingJobDetails
                      ? "Loading customer details..."
                      : "Customer information not available"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* PDF Forms Section (66%) - 3x2 Scrollable Grid */}
          <div className="pdf-forms-section">
            <div className="section-header">
              <h3>Available PDF Forms</h3>
            </div>
            <div className="pdf-forms-grid-container">
              <div className="pdf-forms-grid">
                {attachments.length > 0 ? (
                  attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="pdf-form-card"
                      onClick={() => handleOpenPDF(attachment)}
                    >
                      <div className="form-icon">📄</div>
                      <div className="form-name">{attachment.name}</div>
                      <div className="form-meta">
                        <span>
                          {attachment.size
                            ? `${Math.round(attachment.size / 1024)} KB`
                            : "Unknown size"}
                        </span>
                        <span>
                          {attachment.uploadedOn
                            ? new Date(
                                attachment.uploadedOn
                              ).toLocaleDateString()
                            : "Unknown date"}
                        </span>
                      </div>
                      <button
                        className="form-action"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenPDF(attachment);
                        }}
                      >
                        ✏️ Edit Form
                      </button>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="pdf-form-card empty-card">
                      <div className="form-icon">📄</div>
                      <div className="form-name">No forms available</div>
                      <div className="form-meta">
                        <span>No PDF attachments</span>
                        <span>found for this job</span>
                      </div>
                    </div>
                    <div className="pdf-form-card empty-card">
                      <div className="form-icon">📄</div>
                      <div className="form-name">Add forms in ServiceTitan</div>
                      <div className="form-meta">
                        <span>Forms will appear</span>
                        <span>here automatically</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Sections: 50% Saved | 50% Uploaded */}
        <div className="bottom-sections">
          {/* Saved Forms Section (50%) */}
          <div className="forms-section saved-forms">
            <div className="section-header">
              <h3>Saved Forms</h3>
            </div>
            <div className="forms-content">
              <div className="empty-state">
                <div className="empty-icon">💾</div>
                <h4>No Saved Forms</h4>
                <p>
                  Completed forms will be saved here automatically. Start
                  editing a form to see saved versions.
                </p>
              </div>
            </div>
          </div>

          {/* Uploaded Forms Section (50%) */}
          <div className="forms-section uploaded-forms">
            <div className="section-header">
              <h3>Uploaded Forms</h3>
            </div>
            <div className="forms-content">
              <div className="empty-state">
                <div className="empty-icon">📤</div>
                <h4>No Uploaded Forms</h4>
                <p>
                  Successfully completed and uploaded forms will appear here
                  with upload timestamps.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
