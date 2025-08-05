// src/pages/Attachments/Attachments.jsx - Side-by-Side Layout with Fixed ID Handling
import React, { useState, useEffect } from "react";
import PDFEditor from "../components/PDFEditor/PDFEditor";
import apiClient from "../services/apiClient";

export default function Attachments({ job, onBack }) {
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

        console.log("Loading attachments for job:", job.id);

        const attachmentsData = await apiClient.getJobAttachments(job.id);
        setAttachments(attachmentsData);

        console.log(`Attachments loaded: ${attachmentsData.length} PDFs found`);
      } catch (error) {
        console.error("Error loading attachments:", error);
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

  const handleOpenPDF = (attachment) => {
    console.log(`📖 Opening PDF: ${attachment.name}`);
    console.log("📋 Original attachment data:", attachment);

    const pdfData = {
      ...attachment,
      // Ensure we have both id and serviceTitanId for compatibility
      id: attachment.id || attachment.serviceTitanId,
      serviceTitanId: attachment.serviceTitanId || attachment.id,
    };

    console.log("Processed PDF data for editor:", pdfData);
    console.log(
      "PDF ID:",
      pdfData.id,
      "ServiceTitan ID:",
      pdfData.serviceTitanId
    );

    setSelectedPDF(pdfData);
  };

  // ✅ FIXED: Proper PDF closing
  const handleClosePDF = () => {
    console.log(`Closing PDF editor`);
    setSelectedPDF(null);
  };

  // ✅ FIXED: Remove browser alerts and let PDFEditor handle all UI feedback
  const handleSavePDF = async (pdfData) => {
    try {
      console.log("Saving PDF in Attachments.jsx:", pdfData);

      // ✅ Extract the attachment ID from multiple possible sources
      const attachmentId =
        pdfData.attachmentId ||
        selectedPDF?.serviceTitanId ||
        selectedPDF?.id ||
        pdfData.serviceTitanId ||
        pdfData.pdfId;

      if (!attachmentId) {
        console.error("Missing attachment ID. Available data:", {
          pdfData: Object.keys(pdfData),
          selectedPDF: selectedPDF ? Object.keys(selectedPDF) : "null",
          pdfDataAttachmentId: pdfData.attachmentId,
          selectedPDFServiceTitanId: selectedPDF?.serviceTitanId,
          selectedPDFId: selectedPDF?.id,
        });
        throw new Error(
          "Missing attachment ID - cannot identify which PDF to save"
        );
      }

      console.log("Using attachment ID:", attachmentId, "for job:", job.id);
      console.log("Complete save data:", pdfData);

      // Save the PDF data to ServiceTitan
      const result = await apiClient.saveCompletedPDFForm(
        job.id,
        attachmentId,
        pdfData
      );

      // ✅ FIXED: Let PDFEditor handle success UI - no browser alert
      if (result.success) {
        console.log("✅ PDF saved successfully:", result);
        console.log(`📤 Upload completed: ${result.fileName}`);

        // The PDFEditor will show its custom success popup
        // and then call onClose() which triggers setSelectedPDF(null)
        // No need to manually close here or show alert
        return result; // ✅ Return result to PDFEditor
      }

      return result;
    } catch (error) {
      console.error("❌ Error saving PDF:", error);

      // ✅ FIXED: Remove browser alert for errors too
      // Let PDFEditor handle error display in its custom popup
      throw error; // ✅ Throw error back to PDFEditor for custom error handling
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "Unknown size";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown date";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status) => {
    const statusName = status?.name || status;
    switch (statusName?.toLowerCase()) {
      case "scheduled":
        return "📅";
      case "dispatched":
        return "🚚";
      case "enroute":
        return "🛣️";
      case "working":
        return "🔧";
      case "hold":
        return "⏸️";
      case "done":
        return "✅";
      case "canceled":
        return "❌";
      default:
        return "📋";
    }
  };

  const getStatusClass = (status) => {
    const statusName = status?.name || status;
    switch (statusName?.toLowerCase()) {
      case "scheduled":
        return "status-scheduled";
      case "dispatched":
        return "status-dispatched";
      case "enroute":
        return "status-enroute";
      case "working":
        return "status-working";
      case "hold":
        return "status-hold";
      case "done":
        return "status-done";
      case "canceled":
        return "status-canceled";
      default:
        return "status-default";
    }
  };

  // Use jobDetails if available, otherwise fall back to job prop
  const displayJob = jobDetails || job;
  const displayCustomer = customerData || displayJob.customer;

  // Extract clean job description from title (remove job number if it's duplicated)
  const getJobDescription = () => {
    if (!displayJob.title) return "";

    // Remove job number if it appears at the start of the title
    const jobNumber = displayJob.appointmentNumber || displayJob.number;
    let description = displayJob.title;

    if (jobNumber && description.startsWith(`Job #${jobNumber}`)) {
      description = description
        .replace(`Job #${jobNumber}`, "")
        .replace(/^\s*•\s*/, "")
        .trim();
    }

    return description;
  };

  // Show PDF editor if a PDF is selected
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
      <div className="page-header text-center mb-4">
        <button
          onClick={onBack}
          className="btn btn-secondary mb-4"
          aria-label="Go back to jobs"
        >
          ← Back to Jobs
        </button>

        <h2>Job Details & PDF Forms</h2>

        {/* Customer Name */}
        <h3 className="customer-main-title">
          {displayCustomer?.name || "Customer Information"}
        </h3>
      </div>

      {/* Main Content - Side by Side Layout */}
      <div className="main-content-grid">
        {/* Left Side - Job Details */}
        <div className="job-details-column">
          <div className="job-details-card card">
            {/* Job ID and Status */}
            <div className="job-header-section">
              <h4 className="job-number">
                Job #{displayJob.appointmentNumber || displayJob.number}
              </h4>
              <span
                className={`status-badge ${getStatusClass(displayJob.status)}`}
              >
                {getStatusIcon(displayJob.status)}{" "}
                {displayJob.status?.name || displayJob.status || "Active"}
              </span>
            </div>

            {/* Description */}
            {getJobDescription() && (
              <div className="job-description">
                <h5 className="section-subtitle">📝 Description</h5>
                <div className="description-box">{getJobDescription()}</div>
              </div>
            )}

            {/* Priority */}
            {displayJob.priority && (
              <div className="job-priority">
                <span className="metadata-item">
                  ⚡ Priority: {displayJob.priority}
                </span>
              </div>
            )}

            {/* Loading overlay for job details */}
            {isLoadingJobDetails && (
              <div className="loading-overlay">
                <div className="loading-spinner"></div>
                <span className="text-sm">Loading details...</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - PDF Forms */}
        <div className="pdf-forms-column">
          <div className="pdf-forms-card card">
            <div className="pdf-header">
              <h4>PDF Forms</h4>
              {attachments.length > 0 && (
                <div className="status-message success">
                  ✅ {attachments.length} PDF form
                  {attachments.length !== 1 ? "s" : ""} available
                </div>
              )}
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="loading-content text-center">
                <div className="loading-spinner"></div>
                <p className="text-gray-600">Loading PDF forms...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="alert alert-error">
                <span>❌</span>
                <div>
                  <strong>Unable to Load PDF Forms</strong>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && attachments.length === 0 && (
              <div className="empty-state-compact">
                <div className="empty-icon">📄</div>
                <h5>No PDF Forms</h5>
                <p className="text-gray-600 text-sm">
                  No PDF forms are attached to this job.
                </p>
              </div>
            )}

            {/* PDF List */}
            {!isLoading && !error && attachments.length > 0 && (
              <div className="pdf-list">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="pdf-item"
                    onClick={() => handleOpenPDF(attachment)}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        handleOpenPDF(attachment);
                      }
                    }}
                    aria-label={`Open PDF: ${attachment.name}`}
                  >
                    <div className="pdf-item-header">
                      <div className="pdf-icon">📄</div>
                      <span className="status-badge status-default">PDF</span>
                    </div>

                    <h6 className="pdf-name">{attachment.name}</h6>

                    <div className="pdf-meta">
                      <div className="meta-line">
                        <span className="meta-label">Added:</span>
                        <span>{formatDate(attachment.createdOn)}</span>
                      </div>
                      {attachment.category && (
                        <div className="meta-line">
                          <span className="meta-label">Category:</span>
                          <span>{attachment.category}</span>
                        </div>
                      )}
                      <div className="meta-line">
                        <span className="meta-label">ID:</span>
                        <span className="text-xs">
                          {attachment.serviceTitanId || attachment.id}
                        </span>
                      </div>
                    </div>

                    <button className="btn btn-primary btn-sm pdf-action-btn">
                      Fill Document →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Side-by-side layout styles
