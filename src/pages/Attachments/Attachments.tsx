// src/pages/Attachments/Attachments.tsx - Redesigned Layout with Drafts Support
import React, { useState, useEffect } from 'react';
import PDFEditor from '../PDFEditor/PDFEditor';
import apiClient from '../../services/apiClient';
import type { Job, Technician } from '../../types';
import './Attachments.css';

interface AttachmentsProps {
  job: Job;
  onBack: () => void;
  onPdfEditorStateChange?: (isOpen: boolean) => void;
  technician: Technician;
  onLogout: () => void;
  onPDFOpen?: () => void;
  onPDFClose?: () => void;
  onStartBackflowTesting?: (job: Job, device?: any, step?: string) => void;
}

export default function Attachments({
  job,
  onBack,
  onPdfEditorStateChange,
  technician,
  onLogout,
  onPDFOpen,
  onPDFClose,
  onStartBackflowTesting,
}: AttachmentsProps) {
  const [selectedPDF, setSelectedPDF] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [jobDetails, setJobDetails] = useState<any>(null);
  const [customerData, setCustomerData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingJobDetails, setIsLoadingJobDetails] = useState(true);
  const [error, setError] = useState('');
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [completedFiles, setCompletedFiles] = useState<any[]>([]);
  const [backflowDevices, setBackflowDevices] = useState<any[]>([]);
  const [backflowTests, setBackflowTests] = useState<Record<string, any>>({});
  const [isLoadingBackflow, setIsLoadingBackflow] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const loadJobDetails = async () => {
      try {
        setIsLoadingJobDetails(true);
        console.log('📋 Loading job details for:', job.id);
        const jobData = await apiClient.getJobDetails(job.id) as any;
        setJobDetails(jobData);
        if (jobData?.customer?.id) {
          try {
            const customerInfo = await apiClient.getCustomerDetails(jobData.customer.id) as any;
            setCustomerData(customerInfo);
            console.log('✅ Customer details loaded:', customerInfo.name);
          } catch (err) {
            console.warn('⚠️ Could not load customer details:', err instanceof Error ? err.message : err);
          }
        }
        console.log('✅ Job details loaded');
      } catch (err) {
        console.error('❌ Error loading job details:', err);
      } finally {
        setIsLoadingJobDetails(false);
      }
    };
    if (job?.id) loadJobDetails();
  }, [job]);

  useEffect(() => {
    const loadAttachments = async () => {
      try {
        setIsLoading(true);
        setError('');
        console.log('📎 Loading attachments for job:', job.id);
        const attachmentsData = await apiClient.getJobAttachments(job.id);
        setAttachments(attachmentsData);
        console.log(`✅ Attachments loaded: ${attachmentsData.length} PDFs found`);
      } catch (err) {
        console.error('❌ Error loading attachments:', err);
        setError(`Failed to load attachments: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsLoading(false);
      }
    };
    if (job?.id) loadAttachments();
  }, [job]);

  useEffect(() => {
    const loadDrafts = async () => {
      try {
        setIsLoadingDrafts(true);
        console.log('📄 Loading drafts for job:', job.id);
        const response = await apiClient.getJobDrafts(job.id);
        setDrafts((response.drafts as any[]) ?? []);
        setCompletedFiles((response.completed as any[]) ?? []);
        console.log(`✅ Drafts loaded: ${(response.drafts as any[])?.length ?? 0} drafts, ${(response.completed as any[])?.length ?? 0} completed`);
      } catch (err) {
        console.error('❌ Error loading drafts:', err);
      } finally {
        setIsLoadingDrafts(false);
      }
    };
    if (job?.id) loadDrafts();
  }, [job]);

  useEffect(() => {
    const loadBackflow = async () => {
      try {
        setIsLoadingBackflow(true);
        const [devRes, testRes] = await Promise.all([
          apiClient.getJobBackflowDevices(job.id),
          apiClient.getJobBackflowTests(job.id),
        ]);
        setBackflowDevices((devRes.data as any[]) ?? []);
        const map: Record<string, any> = {};
        ((testRes.data as any[]) ?? []).forEach((t: any) => { map[t.deviceId] = t; });
        setBackflowTests(map);
      } catch {
        // non-critical
      } finally {
        setIsLoadingBackflow(false);
      }
    };
    if (job?.id) loadBackflow();
  }, [job]);

  useEffect(() => {
    if (onPdfEditorStateChange) onPdfEditorStateChange(selectedPDF !== null);
  }, [selectedPDF, onPdfEditorStateChange]);

  const handleResetTest = async (testId: string) => {
    try {
      await apiClient.deleteBackflowTest(testId);
      setBackflowTests(prev => {
        const updated = { ...prev };
        for (const key of Object.keys(updated)) {
          if (updated[key]?.id === testId) delete updated[key];
        }
        return updated;
      });
    } catch (err) {
      console.error('Failed to reset test', err);
    }
  };

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);
    try {
      await apiClient.generateJobSummaryPDF(job.id, {
        technicianName: technician.name,
        customerName: (job as any).customer?.name ?? '',
      });
      showToast('Summary PDF uploaded to job attachments in ServiceTitan!');
    } catch (err) {
      console.error('Failed to generate summary PDF', err);
      showToast('Failed to generate summary PDF', 'error');
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleOpenPDF = (attachment: any) => {
    console.log(`📖 Opening PDF: ${attachment.name}`);
    const pdfData = {
      ...attachment,
      id: attachment.id || attachment.serviceTitanId,
      serviceTitanId: attachment.serviceTitanId || attachment.id,
    };
    setSelectedPDF(pdfData);
    if (onPDFOpen) onPDFOpen();
  };

  const handleClosePDF = () => {
    console.log('❌ Closing PDF editor');
    setSelectedPDF(null);
    if (onPDFClose) onPDFClose();
  };

  const handleSavePDF = async (pdfData: any) => {
    try {
      console.log('💾 Handling PDF save...');
      let response: any;

      if (selectedPDF?.googleDriveFileId) {
        console.log('🔄 Updating existing draft:', selectedPDF.googleDriveFileId);
        response = await apiClient.updateDraft(
          selectedPDF.googleDriveFileId,
          job.id,
          pdfData.objects ?? [],
          pdfData.fileName
        );
      } else {
        console.log('💾 Saving new draft');
        const attachmentId =
          pdfData.attachmentId ||
          selectedPDF?.serviceTitanId ||
          selectedPDF?.id ||
          pdfData.serviceTitanId ||
          pdfData.pdfId;

        if (!attachmentId) throw new Error('Missing attachment ID - cannot save PDF');

        console.log('🔑 Using attachment ID:', attachmentId);
        response = await apiClient.savePDFAsDraft({
          jobId: job.id,
          attachmentId,
          fileName: selectedPDF?.fileName || selectedPDF?.name || 'form.pdf',
          objects: pdfData.objects ?? [],
        });
      }

      console.log('✅ PDF operation completed:', response);
      const updatedDrafts = await apiClient.getJobDrafts(job.id);
      setDrafts((updatedDrafts.drafts as any[]) ?? []);
      setCompletedFiles((updatedDrafts.completed as any[]) ?? []);
      setSelectedPDF(null);

      return {
        success: true,
        message: selectedPDF?.googleDriveFileId
          ? 'Draft updated successfully'
          : 'PDF saved as draft successfully',
        fileName: (response as any)?.fileName,
        fileId: (response as any)?.fileId,
      };
    } catch (err) {
      console.error('❌ Error handling PDF save:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to save/update PDF',
      };
    }
  };

  const handleEditDraft = (draft: any) => {
    console.log('✏️ Editing saved draft:', draft.name);
    const draftPdfData = {
      id: `draft_${draft.id}`,
      serviceTitanId: `draft_${draft.id}`,
      name: draft.name,
      fileName: draft.name,
      googleDriveFileId: draft.id,
      isDraft: true,
      originalAttachmentId: extractOriginalAttachmentId(draft.name),
      type: 'PDF Document',
      size: draft.size,
      modifiedTime: draft.modifiedTime,
    };
    console.log('📝 Opening draft PDF for editing:', draftPdfData);
    setSelectedPDF(draftPdfData);
  };

  const extractOriginalAttachmentId = (fileName: string): string | null => {
    const patterns = [/(\d+)\.pdf$/i, /attachment[_-](\d+)/i, /id[_-](\d+)/i];
    for (const pattern of patterns) {
      const match = fileName.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handlePromoteToCompleted = async (fileId: string, fileName: string) => {
    const confirmUpload = window.confirm(
      `Is the form "${fileName}" ready to be uploaded to the completed folder?`
    );
    if (!confirmUpload) return;

    try {
      console.log('📤 Promoting draft to completed:', fileId);
      const response = await apiClient.promoteToCompleted(fileId, job.id) as any;

      if (response.success) {
        alert('✅ Form successfully moved to completed folder and uploaded to ServiceTitan!');
        const draftsResponse = await apiClient.getJobDrafts(job.id);
        setDrafts((draftsResponse.drafts as any[]) ?? []);
        setCompletedFiles((draftsResponse.completed as any[]) ?? []);
      } else {
        const errorMsg = response.error ?? 'Unknown error occurred';
        console.error('❌ Failed to promote draft:', errorMsg);
        alert(`Failed to move form to completed folder: ${errorMsg}`);
      }
    } catch (err) {
      console.error('❌ Error promoting draft:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      alert(`Failed to move form: ${errorMessage}`);
    }
  };

  const getStatusClass = (status: any): string => {
    if (!status) return 'status-default';
    const statusName = (status.name || status).toLowerCase();
    return `status-${statusName.replace(/\s+/g, '-')}`;
  };

  const getStatusIcon = (status: any): string => {
    if (!status) return '📋';
    const statusName = (status.name || status).toLowerCase();
    if (statusName.includes('in progress') || statusName.includes('dispatched')) return '🚀';
    if (statusName.includes('completed') || statusName.includes('done')) return '✅';
    if (statusName.includes('scheduled')) return '📅';
    if (statusName.includes('cancelled')) return '❌';
    if (statusName.includes('on hold')) return '⏸️';
    return '📋';
  };

  const formatAddress = (address: any): string | null => {
    if (!address) return null;
    const parts: string[] = [];
    if (address.street) parts.push(address.street);
    const cityStateZip: string[] = [];
    if (address.city) cityStateZip.push(address.city);
    if (address.state) cityStateZip.push(address.state);
    if (address.zip) cityStateZip.push(address.zip);
    if (cityStateZip.length > 0) parts.push(cityStateZip.join(', '));
    return parts.join('\n');
  };

  const displayJob = jobDetails ?? job;
  const displayCustomer = customerData ?? jobDetails?.customer ?? (job as any)?.customer;

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

  if (isLoading) {
    return (
      <div className="attachments-page">
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

  if (error) {
    return (
      <div className="attachments-page">
        <div className="page-container">
          <div className="page-header">
            <button onClick={onBack} className="back-btn">← Back to Jobs</button>
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
      <div className="page-container">
        <div className="page-header">
          <button onClick={onBack} className="back-btn">← Back to Jobs</button>
        </div>

        <div className="main-layout">
          <div className="customer-info-section">
            <div className="section-header">
              <h3>👤 Customer Information</h3>
            </div>
            <div className="customer-details">
              {displayCustomer ? (
                <>
                  <div className="customer-name">{displayCustomer.name ?? 'Unknown Customer'}</div>
                  <div className="job-number">
                    Job #{displayJob.number}
                    <div className={`status-badge ${getStatusClass(displayJob.status)}`}>
                      {getStatusIcon(displayJob.status)}{' '}
                      {displayJob.status?.name ?? displayJob.status ?? 'Unknown'}
                    </div>
                  </div>

                  <div className="customer-info-grid">
                    {displayCustomer.address && (
                      <div className="info-item">
                        <div className="info-icon">📍</div>
                        <div className="info-content">
                          <div className="info-label">Address</div>
                          <div className="info-value">{formatAddress(displayCustomer.address)}</div>
                        </div>
                      </div>
                    )}

                    {displayCustomer.phoneNumbers?.length > 0 && (
                      <div className="info-item">
                        <div className="info-icon">📞</div>
                        <div className="info-content">
                          <div className="info-label">Phone</div>
                          <div className="info-value">{displayCustomer.phoneNumbers[0].number}</div>
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
                          <div className="info-value">{displayJob.technician.name}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon"></div>
                  <h4>Customer Information</h4>
                  <p>{isLoadingJobDetails ? 'Loading customer details...' : 'Customer information not available'}</p>
                </div>
              )}
            </div>
          </div>

          <div className="pdf-forms-section">
            <div className="section-header">
              <h3>Available PDF Forms</h3>
              <button
                className="refresh-btn"
                onClick={async () => {
                  setIsLoading(true);
                  try {
                    const data = await apiClient.getJobAttachments(job.id);
                    setAttachments(data);
                  } finally {
                    setIsLoading(false);
                  }
                }}
                title="Refresh forms"
              >
                ↻
              </button>
            </div>
            <div className="pdf-forms-grid-container">
              <div className="pdf-forms-grid">
                {attachments.length > 0 ? (
                  attachments.map((attachment: any) => {
                    const displayName = attachment.name.replace(/^.*\//, '').replace(/\.pdf$/i, '');
                    return (
                      <div
                        key={attachment.id}
                        className="pdf-form-card"
                        onClick={() => handleOpenPDF(attachment)}
                      >
                        <div className="form-icon">📄</div>
                        <div className="form-name">{displayName}</div>
                        <div className="form-meta"></div>
                        <button
                          className="form-action"
                          onClick={(e) => { e.stopPropagation(); handleOpenPDF(attachment); }}
                        >
                          Edit Form
                        </button>
                      </div>
                    );
                  })
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

        <div className="backflow-section">
          <div className="backflow-section-header">
            <h3>🔧 Backflow Testing</h3>
            <div className="backflow-header-actions">
              {onStartBackflowTesting && (
                <button className="backflow-start-btn" onClick={() => onStartBackflowTesting(job)}>
                  + Add Device
                </button>
              )}
            </div>
          </div>
          <div className="backflow-content">
            {isLoadingBackflow ? (
              <span className="backflow-loading">Loading…</span>
            ) : backflowDevices.length === 0 ? (
              <p className="backflow-empty">No devices added yet.</p>
            ) : (
              <>
                <div className="backflow-device-list">
                  {backflowDevices.map((device: any) => {
                    const test = backflowTests[device.id];
                    const result = test?.testResult;
                    const isTested = !!result;
                    return (
                      <div key={device.id} className={`backflow-device-card ${isTested ? (result === 'Failed' ? 'bdc-failed' : 'bdc-passed') : 'bdc-untested'}`}>
                        <div className="bdc-main">
                          <div className="bdc-title-row">
                            <span className="bdc-type">{device.typeMain || 'Device'}</span>
                            <div className={`bdc-badge ${isTested ? (result === 'Failed' ? 'bdc-badge-fail' : 'bdc-badge-pass') : 'bdc-badge-none'}`}>
                              {isTested ? result : 'Not Tested'}
                            </div>
                          </div>
                          <div className="bdc-details">
                            {device.manufacturerMain && <span><strong>Mfr:</strong> {device.manufacturerMain}</span>}
                            {device.modelMain && device.modelMain !== 'N/A' && <span><strong>Model:</strong> {device.modelMain}</span>}
                            <span><strong>SN:</strong> {device.serialMain || '—'}</span>
                            {device.sizeMain && <span><strong>Size:</strong> {device.sizeMain}</span>}
                            {device.bpaLocation && <span><strong>Location:</strong> {device.bpaLocation}</span>}
                            <span><strong>Last Tested:</strong> {test?.testDateInitial || 'Not tested'}</span>
                          </div>
                        </div>
                        <div className="bdc-actions">
                          {onStartBackflowTesting && (
                            <button className="bdc-btn bdc-btn-edit" onClick={() => onStartBackflowTesting(job, device, 'addDevice')}>
                              Edit Device
                            </button>
                          )}
                          {isTested && test?.id && (
                            <button className="bdc-btn bdc-btn-reset" onClick={() => handleResetTest(test.id)}>
                              Reset Test
                            </button>
                          )}
                          {onStartBackflowTesting && (
                            <button className="bdc-btn bdc-btn-test" onClick={() => onStartBackflowTesting(job, device, 'test')}>
                              {isTested ? 'Re-test' : 'Start Testing'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {Object.values(backflowTests).some((t: any) => t?.testResult) && (
                  <div className="backflow-summary-row">
                    <button
                      className="backflow-summary-btn"
                      onClick={handleGenerateSummary}
                      disabled={generatingSummary}
                    >
                      {generatingSummary ? 'Generating…' : 'Generate Summary'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="bottom-sections">
          <div className="forms-section saved-forms">
            <div className="section-header">
              <h3>Saved Forms ({drafts.length})</h3>
            </div>
            <div className="forms-content">
              {isLoadingDrafts ? (
                <div className="loading">Loading saved forms...</div>
              ) : drafts.length > 0 ? (
                <div className="saved-forms-list">
                  {drafts.map((draft: any) => {
                    const displayName = draft.name.replace(/^Attaches\//, '');
                    return (
                      <div key={draft.id} className="saved-form-item">
                        <div className="form-info">
                          <div className="form-name">📄 {displayName}</div>
                          <div className="form-meta">
                            Saved: {new Date(draft.modifiedTime).toLocaleDateString()}
                            {draft.size && ` • ${Math.round(draft.size / 1024)} KB`}
                          </div>
                        </div>
                        <div className="form-actions">
                          <button className="edit-btn" onClick={() => handleEditDraft(draft)} title="Edit this saved form">
                            ✏️ Edit
                          </button>
                          <button
                            className="upload-btn"
                            onClick={() => handlePromoteToCompleted(draft.id, draft.name)}
                            title="Upload this form to completed folder"
                          >
                            📤 Upload
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">💾</div>
                  <h4>No Saved Forms</h4>
                  <p>Completed forms will be saved here automatically. Start editing a form to see saved versions.</p>
                </div>
              )}
            </div>
          </div>

          <div className="forms-section uploaded-forms">
            <div className="section-header">
              <h3>Uploaded Forms ({completedFiles.length})</h3>
            </div>
            <div className="forms-content">
              {isLoadingDrafts ? (
                <div className="loading">Loading uploaded forms...</div>
              ) : completedFiles.length > 0 ? (
                <div className="uploaded-forms-list">
                  {completedFiles.map((completed: any) => {
                    const displayName = completed.name.replace(/^Attaches\//, '');
                    return (
                      <div key={completed.id} className="uploaded-form-item">
                        <div className="form-info">
                          <div className="form-name">✅ {displayName}</div>
                          <div className="form-meta">
                            Uploaded: {new Date(completed.modifiedTime).toLocaleDateString()}
                            {completed.size && ` • ${Math.round(completed.size / 1024)} KB`}
                          </div>
                        </div>
                        <div className="status-badge completed">✅ Completed</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📤</div>
                  <h4>No Uploaded Forms</h4>
                  <p>Successfully completed and uploaded forms will appear here with upload timestamps.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          background: toast.type === 'success' ? '#1b5e20' : '#b71c1c',
          color: 'white', padding: '14px 20px', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 9999,
          fontSize: '14px', fontWeight: 500, maxWidth: '360px',
        }}>
          {toast.type === 'success' ? '✓ ' : '✕ '}{toast.message}
        </div>
      )}
    </div>
  );
}
