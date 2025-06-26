// src/pages/PDFEditor.jsx - Enhanced with ServiceTitan Upload
import React, { useState, useRef, useEffect, useCallback } from 'react';
import sessionManager from '../services/sessionManager';

// Custom hook for PDF operations
function usePDFEditor(pdf, job) {
  const canvasRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [objects, setObjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  // PDF Loading
  const loadPDF = useCallback(async () => {
    try {
      if (!window.pdfjsLib) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }

      const downloadUrl = `/api/job/${job.id}/attachment/${pdf.serviceTitanId || pdf.id}/download`;
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error('Failed to load PDF');

      const arrayBuffer = await response.arrayBuffer();
      const pdfDoc = await window.pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
      
      setPdfDocument(pdfDoc);
      setTotalPages(pdfDoc.numPages);
      setPdfLoaded(true);
      
      console.log(`✅ PDF loaded: ${pdfDoc.numPages} pages`);
    } catch (error) {
      console.error('❌ PDF loading error:', error);
      setPdfError(error.message);
    }
  }, [pdf, job]);

  // Page Rendering
  const renderPage = useCallback(async () => {
    if (!pdfDocument || !canvasRef.current) return;
    
    try {
      const page = await pdfDocument.getPage(currentPage);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      const viewport = page.getViewport({ scale });
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      context.clearRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
    } catch (error) {
      console.error('❌ Page rendering error:', error);
    }
  }, [pdfDocument, currentPage, scale]);

  // Object Management
  const addTextObject = useCallback((x = 100, y = 100) => {
    const id = Date.now().toString();
    const newText = {
      id,
      type: 'text',
      x: x / scale,
      y: y / scale,
      width: 200 / scale,
      height: 30 / scale,
      content: '',
      fontSize: 14,
      color: '#000000',
      page: currentPage,
      lastModified: new Date().toISOString()
    };
    
    setObjects(prev => [...prev, newText]);
    setSelectedId(id);
  }, [scale, currentPage]);

  const addSignatureObject = useCallback((x = 100, y = 100) => {
    const id = Date.now().toString();
    const newSig = {
      id,
      type: 'signature',
      x: x / scale,
      y: y / scale,
      width: 200 / scale,
      height: 80 / scale,
      content: null,
      page: currentPage,
      lastModified: new Date().toISOString()
    };
    
    setObjects(prev => [...prev, newSig]);
    setSelectedId(id);
  }, [scale, currentPage]);

  const updateObject = useCallback((id, updates) => {
    setObjects(prev => prev.map(obj => 
      obj.id === id 
        ? { ...obj, ...updates, lastModified: new Date().toISOString() } 
        : obj
    ));
  }, []);

  const deleteObject = useCallback((id) => {
    setObjects(prev => prev.filter(obj => obj.id !== id));
    setSelectedId(null);
    setEditingId(null);
  }, []);

  const clearAllObjects = useCallback(() => {
    setObjects([]);
    setSelectedId(null);
    setEditingId(null);
  }, []);

  // Auto-fill functionality
  const autoFillTechnicianInfo = useCallback(() => {
    const technician = sessionManager.getCurrentTechnician();
    if (!technician) return;
    
    const technicianFields = objects.filter(obj => 
      obj.type === 'text' && 
      (!obj.content || obj.content.trim() === '') &&
      (obj.fieldName?.toLowerCase().includes('technician') || 
       obj.fieldName?.toLowerCase().includes('tech') ||
       obj.fieldName?.toLowerCase().includes('name'))
    );
    
    if (technicianFields.length > 0) {
      const field = technicianFields[0];
      updateObject(field.id, { content: technician.name });
      console.log(`🔧 Auto-filled technician name: ${technician.name}`);
    }
  }, [objects, updateObject]);

  const autoFillJobInfo = useCallback(() => {
    const jobNumber = job.number || job.appointmentNumber;
    const customerName = job.customer?.name;
    const today = new Date().toLocaleDateString();
    
    // Fill job number fields
    const jobFields = objects.filter(obj => 
      obj.type === 'text' && 
      (!obj.content || obj.content.trim() === '') &&
      (obj.fieldName?.toLowerCase().includes('job') || 
       obj.fieldName?.toLowerCase().includes('number'))
    );
    
    if (jobFields.length > 0 && jobNumber) {
      updateObject(jobFields[0].id, { content: jobNumber });
      console.log(`📋 Auto-filled job number: ${jobNumber}`);
    }
    
    // Fill customer name fields
    const customerFields = objects.filter(obj => 
      obj.type === 'text' && 
      (!obj.content || obj.content.trim() === '') &&
      (obj.fieldName?.toLowerCase().includes('customer') || 
       obj.fieldName?.toLowerCase().includes('client'))
    );
    
    if (customerFields.length > 0 && customerName) {
      updateObject(customerFields[0].id, { content: customerName });
      console.log(`👤 Auto-filled customer name: ${customerName}`);
    }
    
    // Fill date fields
    const dateFields = objects.filter(obj => 
      obj.type === 'text' && 
      (!obj.content || obj.content.trim() === '') &&
      (obj.fieldName?.toLowerCase().includes('date') || 
       obj.fieldName?.toLowerCase().includes('today'))
    );
    
    if (dateFields.length > 0) {
      updateObject(dateFields[0].id, { content: today });
      console.log(`📅 Auto-filled date: ${today}`);
    }
  }, [objects, updateObject, job]);

  useEffect(() => {
    loadPDF();
  }, [loadPDF]);

  useEffect(() => {
    if (pdfDocument) renderPage();
  }, [renderPage, pdfDocument]);

  return {
    canvasRef,
    pdfLoaded,
    pdfError,
    currentPage,
    setCurrentPage,
    totalPages,
    scale,
    setScale,
    objects,
    selectedId,
    setSelectedId,
    editingId,
    setEditingId,
    addTextObject,
    addSignatureObject,
    updateObject,
    deleteObject,
    clearAllObjects,
    autoFillTechnicianInfo,
    autoFillJobInfo
  };
}

// Enhanced Editable Field Component
function EditableField({ object, scale, selected, editing, onUpdate, onSelect, onStartEdit, onFinishEdit }) {
  const [value, setValue] = useState(object.content || '');
  const [isDragging, setIsDragging] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);
  
  useEffect(() => {
    setValue(object.content || '');
  }, [object.content]);

  const calculateTextHeight = () => {
    const lineHeight = Math.max(16, object.fontSize * scale * 1.2);
    const lines = (object.content || '').split('\n').length;
    const textLines = Math.max(1, Math.ceil((object.content || '').length / 25));
    return Math.max(object.height * scale, Math.max(lines, textLines) * lineHeight + 8);
  };

  const fieldStyle = {
    position: 'absolute',
    left: `${object.x * scale}px`,
    top: `${object.y * scale}px`,
    width: `${object.width * scale}px`,
    height: object.type === 'text' ? `${calculateTextHeight()}px` : `${object.height * scale}px`,
    zIndex: selected ? 1000 : 100,
    border: selected ? '2px solid #007bff' : '1px solid rgba(0,0,0,0.2)',
    borderRadius: '4px',
    background: selected ? 'rgba(0, 123, 255, 0.1)' : 'rgba(255, 255, 255, 0.95)',
    cursor: isDragging ? 'grabbing' : 'move',
    userSelect: 'none',
    touchAction: 'none',
    minWidth: '60px',
    minHeight: '25px'
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (editing) return;
    
    if (!selected) {
      onSelect(object.id);
      return;
    }
    
    const canvasWrapper = e.target.closest('.pdf-wrapper');
    if (!canvasWrapper) return;
    
    const initialMouseX = e.clientX;
    const initialMouseY = e.clientY;
    const initialFieldX = object.x;
    const initialFieldY = object.y;
    
    let dragStarted = false;
    let startTime = Date.now();
    
    const handleMouseMove = (e) => {
      const timePassed = Date.now() - startTime;
      const mouseMoved = Math.abs(e.clientX - initialMouseX) > 3 || 
                        Math.abs(e.clientY - initialMouseY) > 3;
      
      if (!dragStarted && (timePassed > 150 || mouseMoved)) {
        dragStarted = true;
        setIsDragging(true);
      }
      
      if (dragStarted) {
        const deltaX = e.clientX - initialMouseX;
        const deltaY = e.clientY - initialMouseY;
        
        const newX = Math.max(0, initialFieldX + (deltaX / scale));
        const newY = Math.max(0, initialFieldY + (deltaY / scale));
        
        onUpdate(object.id, { x: newX, y: newY });
      }
    };
    
    const handleMouseUp = () => {
      if (!dragStarted && object.type === 'text') {
        const currentTime = Date.now();
        const timeDiff = currentTime - lastClickTime;
        
        if (timeDiff < 300) {
          onStartEdit(object.id);
        }
        setLastClickTime(currentTime);
      }
      
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleSave = () => {
    onUpdate(object.id, { content: value });
    onFinishEdit();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  if (object.type === 'text') {
    return (
      <div style={fieldStyle}>
        <div onMouseDown={handleMouseDown} style={{ width: '100%', height: '100%', position: 'relative', cursor: editing ? 'text' : 'move' }}>
          {editing ? (
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              placeholder="Enter text here... (Shift+Enter for new line)"
              autoFocus
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: 'transparent',
                fontSize: `12px`,
                color: object.color,
                outline: 'none',
                padding: '4px',
                cursor: 'text',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: '1.2',
                wordWrap: 'break-word',
                overflow: 'hidden'
              }}
            />
          ) : (
            <div style={{
              padding: '4px',
              fontSize: `12px`,
              color: object.color,
              height: '100%',
              width: '100%',
              opacity: object.content ? 1 : 0.6,
              pointerEvents: 'none',
              lineHeight: '1.2',
              wordWrap: 'break-word',
              whiteSpace: 'pre-wrap',
              overflow: 'hidden'
            }}>
              {object.content || 'Double-click to edit'}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (object.type === 'signature') {
    return (
      <div
        style={{
          ...fieldStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: selected ? '2px solid #28a745' : '2px dashed #ccc',
          background: selected ? 'rgba(40, 167, 69, 0.1)' : 'rgba(255, 255, 255, 0.95)'
        }}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => {
          if (window.showSignatureDialog) {
            window.showSignatureDialog(object.id);
          }
        }}
      >
        {object.content ? (
          <img 
            src={object.content} 
            alt="Signature" 
            style={{ 
              maxWidth: '100%', 
              maxHeight: '100%',
              objectFit: 'contain',
              pointerEvents: 'none'
            }} 
          />
        ) : (
          <span style={{ color: '#666', fontSize: '14px', textAlign: 'center', pointerEvents: 'none' }}>
            Drag to move<br/>Double-click to sign
          </span>
        )}
      </div>
    );
  }

  return null;
}

// Simple Signature Pad Component
function SignatureDialog({ isOpen, onClose, onSave }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setIsEmpty(true);
    }
  }, [isOpen]);

  const getEventPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    if (e.touches && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getEventPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsEmpty(false);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getEventPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  };

  const saveSignature = () => {
    if (isEmpty) {
      alert('Please draw your signature first');
      return;
    }
    const canvas = canvasRef.current;
    const dataURL = canvas.toDataURL('image/png');
    onSave(dataURL);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="signature-overlay">
      <div className="signature-dialog">
        <h3>✍️ Add Your Signature</h3>
        <p>Draw your signature below using your finger or mouse:</p>
        
        <div className="signature-area">
          <canvas
            ref={canvasRef}
            width={400}
            height={200}
            className="signature-canvas"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
        
        <div className="signature-actions">
          <button onClick={clearSignature} className="btn btn-secondary">
            🗑️ Clear
          </button>
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button onClick={saveSignature} className="btn btn-success">
            ✅ Use This Signature
          </button>
        </div>
      </div>
    </div>
  );
}

// 🚀 NEW: Enhanced Progress Dialog for ServiceTitan Upload
function SaveProgressDialog({ isOpen, progress, status, onClose, error }) {
  if (!isOpen) return null;

  const steps = [
    { id: 1, label: 'Validating form data', icon: '📝' },
    { id: 2, label: 'Downloading original PDF', icon: '📥' },
    { id: 3, label: 'Generating completed PDF', icon: '🔧' },
    { id: 4, label: 'Uploading to ServiceTitan', icon: '🚀' }
  ];

  return (
    <div className="progress-overlay">
      <div className="progress-dialog">
        <h3>💾 Saving Your Completed Form</h3>
        <p>Uploading to ServiceTitan as "Completed - {status.fileName || 'Document'}"</p>
        
        <div className="progress-steps">
          {steps.map((step) => (
            <div 
              key={step.id}
              className={`progress-step ${
                progress >= step.id ? 'completed' : 
                progress === step.id - 1 ? 'active' : ''
              }`}
            >
              <span className="step-icon">
                {progress >= step.id ? '✅' : 
                 progress === step.id - 1 ? '⏳' : 
                 error && progress === step.id - 1 ? '❌' : '⏸️'}
              </span>
              <span className="step-text">{step.label}</span>
            </div>
          ))}
        </div>
        
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div 
              className={`progress-fill ${error ? 'error' : ''}`}
              style={{ width: `${(progress / 4) * 100}%` }}
            />
          </div>
          <span className="progress-text">
            {error ? 'Upload Failed' : `${Math.round((progress / 4) * 100)}% Complete`}
          </span>
        </div>
        
        <div className="status-message">
          <p className={error ? 'error-message' : ''}>{status.message || status}</p>
          {error && (
            <div className="error-details">
              <p><strong>Error:</strong> {error}</p>
              <p><small>Please try again or contact support if the problem persists.</small></p>
            </div>
          )}
        </div>
        
        {(progress >= 4 || error) && (
          <div className="completion-actions">
            <button onClick={onClose} className={`btn btn-lg ${error ? 'btn-secondary' : 'btn-success'}`}>
              {error ? '← Back to Editor' : '🎉 Done! Go Back to Forms'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Main PDF Editor Component
export default function PDFEditor({ pdf, job, onClose, onSave }) {
  const {
    canvasRef,
    pdfLoaded,
    pdfError,
    currentPage,
    setCurrentPage,
    totalPages,
    scale,
    setScale,
    objects,
    selectedId,
    setSelectedId,
    editingId,
    setEditingId,
    addTextObject,
    addSignatureObject,
    updateObject,
    deleteObject,
    clearAllObjects,
    autoFillTechnicianInfo,
    autoFillJobInfo
  } = usePDFEditor(pdf, job);

  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureTargetId, setSignatureTargetId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveStatus, setSaveStatus] = useState({ message: '', fileName: '' });
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const currentObjects = objects.filter(obj => obj.page === currentPage);

  // Make signature dialog available globally for EditableField
  useEffect(() => {
    window.showSignatureDialog = (objectId) => {
      setSignatureTargetId(objectId);
      setShowSignatureDialog(true);
    };
    
    return () => {
      window.showSignatureDialog = null;
    };
  }, []);

  const handleCanvasClick = useCallback((e) => {
    setSelectedId(null);
    setEditingId(null);
  }, []);

  const handleAddTextBox = () => {
    addTextObject(100, 100);
  };

  const handleAddSignature = () => {
    const sigObject = addSignatureObject(100, 100);
    setSignatureTargetId(selectedId);
    setShowSignatureDialog(true);
  };

  // 🚀 Enhanced save with ServiceTitan upload
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setShowSaveDialog(true);
      setSaveProgress(0);
      setSaveError(null);
      
      const technician = sessionManager.getCurrentTechnician();
      const filledObjects = objects.filter(obj => obj.content && obj.content.trim() !== '');
      
      // Step 1: Validate form data
      setSaveStatus({ 
        message: 'Validating form data and checking completion...', 
        fileName: pdf.fileName || pdf.name 
      });
      await new Promise(resolve => setTimeout(resolve, 500));
      setSaveProgress(1);
      
      if (filledObjects.length === 0) {
        throw new Error('Please fill out at least one field before saving');
      }
      
      // Step 2: Prepare upload data
      setSaveStatus({ 
        message: 'Preparing completed PDF for upload...', 
        fileName: pdf.fileName || pdf.name 
      });
      await new Promise(resolve => setTimeout(resolve, 300));
      setSaveProgress(2);
      
      const originalName = pdf.fileName || pdf.name || 'Document.pdf';
      const cleanOriginalName = originalName.replace(/\.pdf$/i, '');
      const completedFileName = `Completed - ${cleanOriginalName}.pdf`;
      
      const saveData = {
        editableElements: objects.map(obj => ({
          id: obj.id,
          type: obj.type,
          x: obj.x,
          y: obj.y,
          width: obj.width,
          height: obj.height,
          content: obj.content || '',
          value: obj.content || '', // Backend expects 'value' field
          fontSize: obj.fontSize || 12,
          color: obj.color || '#000000',
          page: obj.page || 1,
          fieldName: obj.fieldName || null,
          isPdfField: obj.isPdfField || false,
          filled: !!(obj.content && obj.content.trim() !== ''),
          lastModified: obj.lastModified || new Date().toISOString()
        })),
        jobInfo: {
          jobId: job.id,
          jobNumber: job.number || job.appointmentNumber,
          jobTitle: job.title,
          technicianId: technician?.id,
          technicianName: technician?.name,
          customerName: job.customer?.name,
          customerAddress: job.customer?.address?.fullAddress
        },
        originalFileName: originalName,
        completedFileName: completedFileName,
        metadata: {
          completionPercentage: Math.round((filledObjects.length / objects.length) * 100),
          totalFields: objects.length,
          filledFields: filledObjects.length,
          hasSignatures: objects.some(obj => obj.type === 'signature' && obj.content),
          hasTextFields: objects.some(obj => obj.type === 'text' && obj.content),
          deviceInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            timestamp: new Date().toISOString()
          }
        }
      };
      
      console.log('📋 Save data being sent:', {
        editableElementsCount: saveData.editableElements.length,
        filledElementsCount: saveData.editableElements.filter(el => el.value && el.value.trim()).length,
        jobInfo: saveData.jobInfo,
        fileName: saveData.completedFileName
      });
      
      // Step 4: Upload to ServiceTitan
      setSaveStatus({ 
        message: `Uploading "${completedFileName}" to ServiceTitan...`, 
        fileName: completedFileName 
      });
      setSaveProgress(3);
      
      console.log('💾 Uploading completed form to ServiceTitan:', completedFileName);
      console.log('📋 Full save data:', saveData);
      
      const result = await onSave(saveData);
      
      setSaveProgress(4);
      setSaveStatus({ 
        message: `✅ Successfully uploaded "${completedFileName}" to ServiceTitan!`, 
        fileName: completedFileName 
      });
      
      // Auto-close after success
      setTimeout(() => {
        setShowSaveDialog(false);
        setIsSaving(false);
      }, 2000);
      
    } catch (error) {
      console.error('❌ Save error:', error);
      setSaveError(error.message);
      setSaveStatus({ 
        message: 'Upload failed - please try again', 
        fileName: pdf.fileName || pdf.name 
      });
    }
  };

  const handleSignatureSave = (signatureData) => {
    if (signatureTargetId) {
      updateObject(signatureTargetId, { content: signatureData });
    }
    setSignatureTargetId(null);
  };

  const getCompletionStatus = () => {
    const total = objects.length;
    const filled = objects.filter(obj => obj.content && obj.content.trim() !== '').length;
    return { total, filled, percentage: total > 0 ? Math.round((filled / total) * 100) : 0 };
  };

  const handleQuickFill = () => {
    autoFillTechnicianInfo();
    autoFillJobInfo();
  };

  if (pdfError) {
    return (
      <div className="pdf-editor-error">
        <div className="error-content">
          <h2>❌ Cannot Load PDF</h2>
          <p>{pdfError}</p>
          <button onClick={onClose} className="btn btn-primary">
            ← Back to Forms
          </button>
        </div>
      </div>
    );
  }

  const completion = getCompletionStatus();
  const canSave = completion.filled > 0;

  return (
    <div className="pdf-editor-enhanced">
      {/* Header */}
      <div className="editor-header">
        <div className="header-left">
          <button onClick={onClose} className="btn btn-secondary">
            ← Back
          </button>
          <div className="pdf-info">
            <h2>{pdf.fileName || pdf.name}</h2>
            <p>Job #{job.number} - {job.customer?.name}</p>
          </div>
        </div>
        
        <div className="header-center">
          <div className="completion-status">
            <div className="completion-bar">
              <div 
                className="completion-fill" 
                style={{ width: `${completion.percentage}%` }}
              />
            </div>
            <span className="completion-text">
              {completion.filled}/{completion.total} fields completed ({completion.percentage}%)
            </span>
          </div>
        </div>
        
        <div className="header-right">
          <button 
            onClick={handleSave}
            disabled={isSaving || !canSave}
            className={`btn btn-lg ${canSave ? 'btn-success' : 'btn-secondary'}`}
            title={canSave ? 'Upload completed form to ServiceTitan' : 'Fill at least one field to save'}
          >
            {isSaving ? '🚀 Uploading...' : '🚀 Upload to ServiceTitan'}
          </button>
        </div>
      </div>

      {/* Enhanced Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <button onClick={handleAddTextBox} className="btn btn-primary">
            📝 Add Text
          </button>
          <button onClick={handleAddSignature} className="btn btn-primary">
            ✍️ Add Signature
          </button>
          <button onClick={handleQuickFill} className="btn btn-info">
            ⚡ Quick Fill
          </button>
          {selectedId && (
            <button onClick={() => deleteObject(selectedId)} className="btn btn-error">
              🗑️ Delete
            </button>
          )}
          {objects.length > 0 && (
            <button onClick={clearAllObjects} className="btn btn-warning">
              🧹 Clear All
            </button>
          )}
        </div>

        <div className="toolbar-center">
          {totalPages > 1 && (
            <div className="page-controls">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
                className="btn btn-ghost"
              >
                ← Prev
              </button>
              <span className="page-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                className="btn btn-ghost"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        <div className="toolbar-right">
          <div className="zoom-controls">
            <button
              onClick={() => setScale(prev => Math.max(0.8, prev - 0.2))}
              className="btn btn-ghost"
            >
              🔍-
            </button>
            <span className="zoom-level">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale(prev => Math.min(2, prev + 0.2))}
              className="btn btn-ghost"
            >
              🔍+
            </button>
          </div>
        </div>
      </div>

      {/* PDF Canvas */}
      <div className="pdf-container">
        {!pdfLoaded && (
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <h3>Loading PDF Form...</h3>
            <p>Please wait while we prepare your form...</p>
          </div>
        )}
        
        {pdfLoaded && (
          <div className="pdf-wrapper">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="pdf-canvas"
              style={{
                cursor: 'default',
                maxWidth: '100%',
                height: 'auto'
              }}
            />

            {/* Render Editable Fields */}
            {currentObjects.map(obj => (
              <EditableField
                key={obj.id}
                object={obj}
                scale={scale}
                selected={selectedId === obj.id}
                editing={editingId === obj.id}
                onUpdate={updateObject}
                onSelect={setSelectedId}
                onStartEdit={setEditingId}
                onFinishEdit={() => setEditingId(null)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Signature Dialog */}
      <SignatureDialog
        isOpen={showSignatureDialog}
        onClose={() => {
          setShowSignatureDialog(false);
          setSignatureTargetId(null);
        }}
        onSave={handleSignatureSave}
      />

      {/* Enhanced Save Progress Dialog */}
      <SaveProgressDialog
        isOpen={showSaveDialog}
        progress={saveProgress}
        status={saveStatus}
        error={saveError}
        onClose={() => {
          setShowSaveDialog(false);
          setIsSaving(false);
          setSaveError(null);
        }}
      />
    </div>
  );
}

// Enhanced styles with ServiceTitan branding
const editorStyles = `
.pdf-editor-enhanced {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.editor-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-bottom: 2px solid #e9ecef;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.pdf-info h2 {
  margin: 0;
  font-size: 1.2rem;
  color: white;
}

.pdf-info p {
  margin: 0;
  color: rgba(255,255,255,0.9);
  font-size: 0.9rem;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 0 2rem;
}

.completion-status {
  background: rgba(255,255,255,0.2);
  padding: 0.75rem 1.5rem;
  border-radius: 25px;
  border: 1px solid rgba(255,255,255,0.3);
}

.completion-bar {
  width: 200px;
  height: 8px;
  background: rgba(255,255,255,0.3);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.completion-fill {
  height: 100%;
  background: linear-gradient(90deg, #4ade80 0%, #22c55e 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.completion-text {
  font-size: 0.9rem;
  font-weight: 600;
  color: white;
  text-align: center;
  display: block;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.editor-toolbar {
  background: white;
  border-bottom: 1px solid #e9ecef;
  padding: 0.75rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.toolbar-left, .toolbar-center, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.page-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #f8f9fa;
  padding: 0.5rem 1rem;
  border-radius: 25px;
  border: 1px solid #dee2e6;
}

.page-info {
  font-weight: 600;
  color: #495057;
  min-width: 120px;
  text-align: center;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f8f9fa;
  padding: 0.5rem 1rem;
  border-radius: 25px;
  border: 1px solid #dee2e6;
}

.zoom-level {
  min-width: 60px;
  text-align: center;
  font-weight: 600;
  color: #495057;
}

.pdf-container {
  flex: 1;
  overflow: auto;
  padding: 2rem;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: #e9ecef;
}

.pdf-wrapper {
  position: relative;
  background: white;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  border-radius: 8px;
  overflow: hidden;
}

.pdf-canvas {
  display: block;
}

.loading-content {
  text-align: center;
  padding: 4rem 2rem;
  color: #6c757d;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 1rem;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.signature-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.signature-dialog {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 16px 64px rgba(0,0,0,0.2);
  max-width: 90%;
  max-height: 90%;
  width: 500px;
}

.signature-dialog h3 {
  margin: 0 0 1rem 0;
  color: #333;
}

.signature-area {
  border: 3px dashed #dee2e6;
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
  background: #f8f9fa;
}

.signature-canvas {
  display: block;
  width: 100%;
  background: white;
  border-radius: 4px;
  cursor: crosshair;
  touch-action: none;
}

.signature-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.progress-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000;
}

.progress-dialog {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 20px 80px rgba(0,0,0,0.3);
  max-width: 90%;
  width: 500px;
  text-align: center;
}

.progress-dialog h3 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.5rem;
}

.progress-steps {
  margin: 2rem 0;
}

.progress-step {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  margin: 0.5rem 0;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.progress-step.completed {
  background: #f0fff4;
  border: 1px solid #22c55e;
}

.progress-step.active {
  background: #fef3c7;
  border: 1px solid #f59e0b;
}

.step-icon {
  font-size: 1.2rem;
  min-width: 24px;
}

.step-text {
  flex: 1;
  text-align: left;
  font-weight: 500;
}

.progress-bar-container {
  margin: 2rem 0;
}

.progress-bar {
  width: 100%;
  height: 12px;
  background: #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 6px;
  transition: width 0.3s ease;
}

.progress-fill.error {
  background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
}

.progress-text {
  font-weight: 600;
  color: #374151;
}

.status-message {
  margin: 1.5rem 0;
}

.error-message {
  color: #dc2626;
}

.error-details {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
  text-align: left;
}

.completion-actions {
  margin-top: 2rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
  font-size: 0.9rem;
}

.btn-primary { 
  background: #667eea; 
  color: white; 
}

.btn-primary:hover { 
  background: #5a67d8; 
  transform: translateY(-1px); 
}

.btn-secondary { 
  background: #6c757d; 
  color: white; 
}

.btn-secondary:hover { 
  background: #5a6268; 
}

.btn-success { 
  background: #22c55e; 
  color: white; 
}

.btn-success:hover { 
  background: #16a34a; 
  transform: translateY(-1px); 
}

.btn-error { 
  background: #ef4444; 
  color: white; 
}

.btn-error:hover { 
  background: #dc2626; 
}

.btn-warning { 
  background: #f59e0b; 
  color: white; 
}

.btn-warning:hover { 
  background: #d97706; 
}

.btn-info { 
  background: #06b6d4; 
  color: white; 
}

.btn-info:hover { 
  background: #0891b2; 
}

.btn-ghost { 
  background: transparent; 
  color: #6c757d; 
  border: 1px solid #dee2e6; 
}

.btn-ghost:hover { 
  background: #f8f9fa; 
}

.btn-lg { 
  padding: 0.75rem 1.5rem; 
  font-size: 1rem; 
}

.btn:hover:not(:disabled) { 
  box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
}

.btn:disabled { 
  opacity: 0.6; 
  cursor: not-allowed; 
  transform: none !important; 
  box-shadow: none !important; 
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .editor-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .header-left, .header-right {
    justify-content: center;
  }
  
  .header-center {
    padding: 0;
  }
  
  .completion-bar {
    width: 150px;
  }
  
  .editor-toolbar {
    flex-direction: column;
    gap: 1rem;
  }
  
  .toolbar-left, .toolbar-center, .toolbar-right {
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .signature-dialog, .progress-dialog {
    margin: 1rem;
    width: auto;
  }
}

@media (max-width: 480px) {
  .pdf-container {
    padding: 1rem;
  }
  
  .btn {
    font-size: 0.8rem;
    padding: 0.4rem 0.8rem;
  }
  
  .btn-lg {
    font-size: 0.9rem;
    padding: 0.6rem 1.2rem;
  }
}
`;

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('pdf-editor-enhanced-styles')) {
  const style = document.createElement('style');
  style.id = 'pdf-editor-enhanced-styles';
  style.textContent = editorStyles;
  document.head.appendChild(style);
}