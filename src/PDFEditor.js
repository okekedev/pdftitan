import React, { useState, useRef } from 'react';
import './PDFEditor.css';

function PDFEditor({ pdf, job, onClose, onSave }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Pre-populated data from the work order
  const [prefilledData] = useState({
    workOrderNumber: job.workOrderNumber,
    deviceType: job.deviceType,
    location: job.location,
    technician: job.technician,
    testDate: new Date().toLocaleDateString(),
    customerName: "Metro Hospital System", // Would come from API
    address: "1200 Medical Center Dr, Dallas, TX"
  });

  // Data that technician needs to fill out
  const [technicianData, setTechnicianData] = useState({
    serialNumber: '',
    inletPressure: '',
    outletPressure: '',
    testResult: '',
    issuesFound: '',
    notes: '',
    technicianSignature: false
  });

  const handleInputChange = (field, value) => {
    setTechnicianData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    // Simple validation - just check if main fields are filled
    if (!technicianData.serialNumber || !technicianData.testResult) {
      alert('Please fill out Serial Number and Test Result');
      return;
    }

    onSave({
      pdfId: pdf.id,
      prefilledData,
      technicianData,
      savedAt: new Date().toISOString()
    });
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setTechnicianData(prev => ({ ...prev, technicianSignature: true }));
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTechnicianData(prev => ({ ...prev, technicianSignature: false }));
  };

  return (
    <div className="pdf-editor-container">
      <div className="pdf-editor-header">
        <div className="header-left">
          <button onClick={onClose} className="close-btn">
            ← Back
          </button>
          <div className="pdf-info">
            <h2>{pdf.name}</h2>
            <p>{job.workOrderNumber}</p>
          </div>
        </div>
        
        <button onClick={handleSave} className="save-btn">
          Save Form
        </button>
      </div>

      <div className="pdf-editor-content">
        <div className="form-container">
          
          {/* Pre-filled section - read only */}
          <div className="form-section prefilled">
            <h3>Work Order Information</h3>
            <div className="readonly-grid">
              <div className="readonly-field">
                <label>Work Order #:</label>
                <span>{prefilledData.workOrderNumber}</span>
              </div>
              <div className="readonly-field">
                <label>Device Type:</label>
                <span>{prefilledData.deviceType}</span>
              </div>
              <div className="readonly-field">
                <label>Location:</label>
                <span>{prefilledData.location}</span>
              </div>
              <div className="readonly-field">
                <label>Technician:</label>
                <span>{prefilledData.technician}</span>
              </div>
              <div className="readonly-field">
                <label>Test Date:</label>
                <span>{prefilledData.testDate}</span>
              </div>
              <div className="readonly-field">
                <label>Customer:</label>
                <span>{prefilledData.customerName}</span>
              </div>
            </div>
          </div>

          {/* Technician input section */}
          <div className="form-section technician-input">
            <h3>Complete Your Testing Information</h3>
            
            <div className="input-grid">
              <div className="input-field">
                <label>Device Serial Number *</label>
                <input
                  type="text"
                  value={technicianData.serialNumber}
                  onChange={(e) => handleInputChange('serialNumber', e.target.value)}
                  placeholder="Enter serial number"
                />
              </div>

              <div className="input-field">
                <label>Inlet Pressure (PSI)</label>
                <input
                  type="number"
                  value={technicianData.inletPressure}
                  onChange={(e) => handleInputChange('inletPressure', e.target.value)}
                  placeholder="0.0"
                />
              </div>

              <div className="input-field">
                <label>Outlet Pressure (PSI)</label>
                <input
                  type="number"
                  value={technicianData.outletPressure}
                  onChange={(e) => handleInputChange('outletPressure', e.target.value)}
                  placeholder="0.0"
                />
              </div>

              <div className="input-field">
                <label>Test Result *</label>
                <select
                  value={technicianData.testResult}
                  onChange={(e) => handleInputChange('testResult', e.target.value)}
                >
                  <option value="">Select result</option>
                  <option value="Pass">Pass</option>
                  <option value="Fail">Fail</option>
                  <option value="Needs Repair">Needs Repair</option>
                </select>
              </div>

              <div className="input-field full-width">
                <label>Issues Found (if any)</label>
                <input
                  type="text"
                  value={technicianData.issuesFound}
                  onChange={(e) => handleInputChange('issuesFound', e.target.value)}
                  placeholder="Describe any issues found"
                />
              </div>

              <div className="input-field full-width">
                <label>Additional Notes</label>
                <textarea
                  value={technicianData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Any additional notes or observations"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Signature section */}
          <div className="form-section signature-section">
            <h3>Technician Signature</h3>
            <div className="signature-container">
              <canvas
                ref={canvasRef}
                width={400}
                height={150}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="signature-canvas"
              />
              <div className="signature-actions">
                <button type="button" onClick={clearSignature} className="clear-btn">
                  Clear Signature
                </button>
                {technicianData.technicianSignature && (
                  <span className="signature-status">✓ Signed</span>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default PDFEditor;