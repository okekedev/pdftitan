import React, { useState } from 'react';
import './PDFGenerator.css';
import apiClient from '../../../services/apiClient';
import sessionManager from '../../../services/sessionManager';

interface PDFGeneratorProps {
  devices: any[];
  testRecords: Record<string, any>;
  job: any;
  technician: any;
  onBack: () => void;
  onComplete: () => void;
}

export default function PDFGenerator({ devices, testRecords, job, technician, onBack, onComplete }: PDFGeneratorProps) {
  const [selectedCity, setSelectedCity] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedPDFs, setGeneratedPDFs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const completedDevices = devices.filter((d: any) => testRecords[d.id]?.testResult);
  const failedDevices = completedDevices.filter((d: any) => testRecords[d.id]?.testResult === 'Failed');

  const generateJobNoteSummary = (): string => {
    const totalTested = completedDevices.length;
    const totalFailed = failedDevices.length;
    let summary = `Backflow Testing Completed\n${totalTested} device${totalTested !== 1 ? 's' : ''} tested`;

    if (totalFailed > 0) {
      summary += `, ${totalFailed} failed:\n\n`;
      failedDevices.forEach((device: any) => {
        const test = testRecords[device.id];
        summary += `- ${device.sizeMain ?? ''} ${device.manufacturerMain ?? ''} ${device.modelMain ?? ''} SN ${device.serialMain}`;
        if (test.repairsMain || test.repairsBypass) summary += ` - ${test.repairsMain ?? test.repairsBypass}`;
        if (test.quoteNeeded) summary += ' (Quote needed)';
        summary += '\n';
      });
    } else {
      summary += '. All devices passed.\n';
    }
    return summary;
  };

  const handleGeneratePDFs = async () => {
    if (!selectedCity) { alert('Please select a city/jurisdiction'); return; }
    setGenerating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const company = sessionManager.getCurrentCompany() || {};

      const pdfPromises = completedDevices.map((device: any) =>
        apiClient.generateBackflowPDF({
          deviceId: device.id,
          testRecordId: testRecords[device.id].id,
          jobId: job.id,
          cityCode: selectedCity,
          technician: technician,
          company: company,
          customerName: job.customer?.name || '',
          serviceAddress: job.location?.address?.fullAddress || '',
        })
      );
      const results = await Promise.all(pdfPromises);
      const pdfs = (results as any[]).map((r: any) => r.data);
      setGeneratedPDFs(pdfs);

      const summary = generateJobNoteSummary();
      await apiClient.addJobNote(job.id, summary);

      const uploadedCount = pdfs.filter((p: any) => p.serviceTitanAttachmentId).length;
      setSuccessMessage(
        `${pdfs.length} TCEQ form${pdfs.length !== 1 ? 's' : ''} generated and uploaded to ServiceTitan.` +
        (uploadedCount < pdfs.length
          ? ` (${pdfs.length - uploadedCount} upload${pdfs.length - uploadedCount !== 1 ? 's' : ''} failed — check job attachments)`
          : '') +
        ' Job notes updated.'
      );
    } catch (err) {
      console.error('Error generating PDFs:', err);
      setError('Failed to generate PDFs. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="pdf-generator-container">
      <div className="generator-header">
        <h3>Generate Forms</h3>
        <p className="generator-hint">Select the city/jurisdiction and upload TCEQ forms to ServiceTitan</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {successMessage && (
        <div className="success-message" style={{ background: '#d1fae5', color: '#065f46', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #6ee7b7' }}>
          {successMessage}
        </div>
      )}

      <div className="summary-section">
        <h4>Testing Summary</h4>
        <div className="summary-stats">
          <div className="stat-card">
            <span className="stat-number">{completedDevices.length}</span>
            <span className="stat-label">Devices Tested</span>
          </div>
          <div className="stat-card stat-passed">
            <span className="stat-number">{completedDevices.length - failedDevices.length}</span>
            <span className="stat-label">Passed</span>
          </div>
          {failedDevices.length > 0 && (
            <div className="stat-card stat-failed">
              <span className="stat-number">{failedDevices.length}</span>
              <span className="stat-label">Failed</span>
            </div>
          )}
        </div>

        {failedDevices.length > 0 && (
          <div className="failed-devices-list">
            <h5>Failed Devices:</h5>
            <ul>
              {failedDevices.map((device: any) => {
                const test = testRecords[device.id];
                return (
                  <li key={device.id}>
                    {device.sizeMain} {device.manufacturerMain} {device.modelMain} SN {device.serialMain}
                    {test.quoteNeeded && <span className="quote-flag"> (Quote Needed)</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="form-selection-section">
        <h4>Select City/Jurisdiction</h4>
        <div className="city-selector">
          <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} disabled={generating}>
            <option value="">Select City...</option>
            <option value="TCEQ">TCEQ (State Form)</option>
            <option value="FORT_WORTH">Fort Worth</option>
            <option value="WEATHERFORD">Weatherford</option>
            <option value="HUDSON_OAKS">Hudson Oaks</option>
            <option value="PARKER_COUNTY_SUD">Parker County SUD</option>
            <option value="WILLOW_PARK">Willow Park</option>
            <option value="ALEDO">Aledo</option>
            <option value="SPRINGTOWN">Springtown</option>
            <option value="POOLVILLE">Poolville</option>
          </select>
        </div>

        <button
          onClick={handleGeneratePDFs}
          disabled={!selectedCity || generating || completedDevices.length === 0}
          className="btn btn-success btn-large"
        >
          {generating ? 'Uploading to ServiceTitan...' : 'Complete Testing & Upload to ServiceTitan'}
        </button>
      </div>

      {generatedPDFs.length > 0 && (
        <div className="generated-pdfs-section">
          <h4>Generated Forms</h4>
          <div className="pdfs-list">
            {generatedPDFs.map((pdf: any, index: number) => (
              <div key={pdf.id ?? index} className="pdf-item">
                <span className="pdf-name">{pdf.fileName}</span>
                {pdf.serviceTitanAttachmentId ? (
                  <span style={{ color: '#10b981', fontSize: '0.875rem' }}>Uploaded to ServiceTitan</span>
                ) : (
                  <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>Upload failed</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="generator-actions">
        <button onClick={onBack} className="btn btn-secondary">Back to Devices</button>
        {generatedPDFs.length > 0 && (
          <button onClick={onComplete} className="btn btn-primary">Complete & Return to Job</button>
        )}
      </div>
    </div>
  );
}
