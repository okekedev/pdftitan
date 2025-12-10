import React, { useState } from 'react';
import './PDFGenerator.css';
import apiClient from '../../../services/apiClient';

export default function PDFGenerator({ devices, testRecords, job, technician, onBack, onComplete }) {
  const [selectedCity, setSelectedCity] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedPDFs, setGeneratedPDFs] = useState([]);
  const [error, setError] = useState(null);
  const [jobNoteSummary, setJobNoteSummary] = useState('');

  const completedDevices = devices.filter(d => testRecords[d.id]?.testResult);
  const failedDevices = completedDevices.filter(d => testRecords[d.id]?.testResult === 'Failed');

  const handleGeneratePDFs = async () => {
    if (!selectedCity) {
      alert('Please select a city/jurisdiction');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      // Generate summary for job notes
      const summary = generateJobNoteSummary();
      setJobNoteSummary(summary);

      // Generate PDFs for each device
      const pdfPromises = completedDevices.map(device => {
        return apiClient.generateBackflowPDF({
          deviceId: device.id,
          testRecordId: testRecords[device.id].id,
          jobId: job.id,
          technicianId: technician.id,
          cityCode: selectedCity
        });
      });

      const results = await Promise.all(pdfPromises);
      setGeneratedPDFs(results.map(r => r.data));

      // Push job note summary to ServiceTitan
      await apiClient.addJobNote(job.id, summary);

      alert('PDFs generated successfully and job notes updated!');
    } catch (err) {
      console.error('Error generating PDFs:', err);
      setError('Failed to generate PDFs. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const generateJobNoteSummary = () => {
    const totalTested = completedDevices.length;
    const totalFailed = failedDevices.length;

    let summary = `Backflow Testing Completed\n`;
    summary += `${totalTested} device${totalTested !== 1 ? 's' : ''} tested`;

    if (totalFailed > 0) {
      summary += `, ${totalFailed} failed:\n\n`;

      failedDevices.forEach(device => {
        const test = testRecords[device.id];
        summary += `- ${device.sizeMain || ''} ${device.manufacturerMain || ''} ${device.modelMain || ''} `;
        summary += `SN ${device.serialMain}`;

        if (test.repairsMain || test.repairsBypass) {
          summary += ` - ${test.repairsMain || test.repairsBypass}`;
        }

        if (test.quoteNeeded) {
          summary += ' (Quote needed)';
        }

        summary += '\n';
      });
    } else {
      summary += '. All devices passed.\n';
    }

    return summary;
  };

  const handleDownloadPDF = async (pdfId) => {
    try {
      window.open(`/api/backflow-pdfs/${pdfId}/download`, '_blank');
    } catch (err) {
      console.error('Error downloading PDF:', err);
      setError('Failed to download PDF');
    }
  };

  const handleComplete = () => {
    onComplete();
  };

  return (
    <div className="pdf-generator-container">
      <div className="generator-header">
        <h3>Generate Forms</h3>
        <p className="generator-hint">
          Select the city/jurisdiction and generate TCEQ or city-specific forms
        </p>
      </div>

      {error && (
        <div className="error-message">
          {error}
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
              {failedDevices.map(device => {
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
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            disabled={generating}
          >
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
          {generating ? 'Generating PDFs...' : 'Generate Forms & Update Job Notes'}
        </button>
      </div>

      {jobNoteSummary && (
        <div className="job-note-preview">
          <h4>Job Note Summary</h4>
          <pre>{jobNoteSummary}</pre>
        </div>
      )}

      {generatedPDFs.length > 0 && (
        <div className="generated-pdfs-section">
          <h4>Generated Forms</h4>
          <div className="pdfs-list">
            {generatedPDFs.map((pdf, index) => (
              <div key={pdf.id || index} className="pdf-item">
                <span className="pdf-name">{pdf.fileName}</span>
                <button
                  onClick={() => handleDownloadPDF(pdf.id)}
                  className="btn btn-primary btn-small"
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="generator-actions">
        <button onClick={onBack} className="btn btn-secondary">
          Back to Devices
        </button>
        {generatedPDFs.length > 0 && (
          <button onClick={handleComplete} className="btn btn-primary">
            Complete & Return to Job
          </button>
        )}
      </div>
    </div>
  );
}
