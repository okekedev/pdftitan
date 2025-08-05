// src/pages/PDFEditor.jsx - CLEANED VERSION with external CSS
import React, { useState, useRef, useEffect, useCallback } from 'react';
import './PDFEditor.css';

// Custom hook for PDF operations with proper canvas management
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
  const [isRendering, setIsRendering] = useState(false);

  // PDF Loading
  const loadPDF = useCallback(async () => {
    try {
      setPdfError(null);
      setPdfLoaded(false);
      
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
    if (!pdfDocument || !canvasRef.current || isRendering) {
      return;
    }
    
    try {
      setIsRendering(true);
      
      const page = await pdfDocument.getPage(currentPage);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      const viewport = page.getViewport({ scale });
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      console.log(`✅ Page ${currentPage} rendered successfully`);
      
    } catch (error) {
      console.error('❌ Page rendering error:', error);
    } finally {
      setIsRendering(false);
    }
  }, [pdfDocument, currentPage, scale, isRendering]);

  // Add different types of objects
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
      fontSize: 11,
      color: '#000000',
      page: currentPage
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
      page: currentPage
    };
    
    setObjects(prev => [...prev, newSig]);
    setSelectedId(id);
  }, [scale, currentPage]);

  const addDateObject = useCallback((x = 100, y = 100) => {
    const id = Date.now().toString();
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const newDate = {
      id,
      type: 'date',
      x: x / scale,
      y: y / scale,
      width: 100 / scale,
      height: 24 / scale,
      content: today,
      fontSize: 11,
      color: '#000000',
      page: currentPage
    };
    
    setObjects(prev => [...prev, newDate]);
    setSelectedId(id);
  }, [scale, currentPage]);

  const addCheckboxObject = useCallback((x = 100, y = 100) => {
    const id = Date.now().toString();
    const newCheckbox = {
      id,
      type: 'checkbox',
      x: x / scale,
      y: y / scale,
      width: 20 / scale,
      height: 20 / scale,
      content: false,
      page: currentPage
    };
    
    setObjects(prev => [...prev, newCheckbox]);
    setSelectedId(id);
  }, [scale, currentPage]);

  // Update object properties
  const updateObject = useCallback((id, updates) => {
    setObjects(prev => prev.map(obj => 
      obj.id === id ? { ...obj, ...updates } : obj
    ));
  }, []);

  // Delete object
  const deleteObject = useCallback((id) => {
    setObjects(prev => prev.filter(obj => obj.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  }, [selectedId, editingId]);

  // Clear all objects
  const clearAllObjects = useCallback(() => {
    setObjects([]);
    setSelectedId(null);
    setEditingId(null);
  }, []);

  // Initialize PDF loading
  useEffect(() => {
    let isMounted = true;
    
    const initializePDF = async () => {
      if (isMounted && pdf && job) {
        await loadPDF();
      }
    };
    
    initializePDF();
    
    return () => {
      isMounted = false;
    };
  }, [loadPDF, pdf, job]);

  // Handle page rendering when dependencies change
  useEffect(() => {
    let isMounted = true;
    
    const doRender = async () => {
      if (isMounted && pdfDocument && !isRendering) {
        await renderPage();
      }
    };
    
    doRender();
    
    return () => {
      isMounted = false;
    };
  }, [pdfDocument, currentPage, scale, isRendering, renderPage]);

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
    setObjects,
    selectedId,
    setSelectedId,
    editingId,
    setEditingId,
    addTextObject,
    addSignatureObject,
    addDateObject,
    addCheckboxObject,
    updateObject,
    deleteObject,
    clearAllObjects,
    isRendering
  };
}

// Enhanced Editable Field Component with proper touch support
function EditableField({ object, scale, selected, editing, onUpdate, onSelect, onStartEdit, onFinishEdit }) {
  const [value, setValue] = useState(object.content || '');
  const [isDragging, setIsDragging] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);
  
  useEffect(() => {
    setValue(object.content || '');
  }, [object.content]);

  const calculateFieldHeight = () => {
    switch (object.type) {
      case 'text':
        const lineHeight = Math.max(16, object.fontSize * scale * 1.2);
        const lines = (object.content || '').split('\n').length;
        return Math.max(object.height * scale, lines * lineHeight + 8);
      case 'checkbox':
        return Math.max(20, object.height * scale);
      default:
        return object.height * scale;
    }
  };

  // Field styling with CSS classes
  const getFieldClasses = () => {
    const baseClasses = ['editable-field'];
    
    baseClasses.push(`field-${object.type}`);
    
    if (selected) baseClasses.push('selected');
    if (isDragging) baseClasses.push('dragging');
    
    return baseClasses.join(' ');
  };

  const fieldStyle = {
    left: `${object.x * scale}px`,
    top: `${object.y * scale}px`,
    width: `${object.width * scale}px`,
    height: `${calculateFieldHeight()}px`,
    fontSize: object.fontSize ? `${object.fontSize * scale}px` : undefined,
    color: object.color || '#000000',
    zIndex: selected ? 1000 : 100
  };

  // Handle position updates
  const handleDrag = useCallback((e) => {
    if (!isDragging) return;
    
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const canvas = document.querySelector('.pdf-canvas');
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const newX = Math.max(0, (clientX - rect.left) / scale);
    const newY = Math.max(0, (clientY - rect.top) / scale);
    
    onUpdate(object.id, { x: newX, y: newY });
  }, [isDragging, scale, onUpdate, object.id]);

  // Handle resize
  const handleResize = useCallback((e) => {
    e.stopPropagation();
    
    const startX = e.touches ? e.touches[0].clientX : e.clientX;
    const startY = e.touches ? e.touches[0].clientY : e.clientY;
    const startWidth = object.width * scale;
    const startHeight = object.height * scale;
    
    const doResize = (moveEvent) => {
      const currentX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
      
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      
      const newWidth = Math.max(object.type === 'checkbox' ? 20 : 60, startWidth + deltaX);
      const newHeight = Math.max(object.type === 'checkbox' ? 20 : 24, startHeight + deltaY);
      
      onUpdate(object.id, {
        width: newWidth / scale,
        height: newHeight / scale
      });
    };
    
    const stopResize = () => {
      document.removeEventListener('mousemove', doResize);
      document.removeEventListener('mouseup', stopResize);
      document.removeEventListener('touchmove', doResize);
      document.removeEventListener('touchend', stopResize);
    };
    
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
    document.addEventListener('touchmove', doResize);
    document.addEventListener('touchend', stopResize);
  }, [object.id, object.width, object.height, object.type, scale, onUpdate]);

  // Handle click/touch events
  const handleInteraction = useCallback((e) => {
    e.stopPropagation();
    
    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTime;
    
    if (timeDiff < 300 && selected) {
      // Double click/tap - start editing
      onStartEdit(object.id);
    } else {
      // Single click/tap - select
      onSelect(object.id);
      
      // Start drag
      setIsDragging(true);
      
      const stopDrag = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', handleDrag);
        document.removeEventListener('touchend', stopDrag);
      };
      
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', stopDrag);
      document.addEventListener('touchmove', handleDrag);
      document.addEventListener('touchend', stopDrag);
    }
    
    setLastClickTime(currentTime);
  }, [selected, lastClickTime, onSelect, onStartEdit, object.id, handleDrag]);

  // Handle content changes
  const handleContentChange = (e) => {
    const newValue = object.type === 'checkbox' ? e.target.checked : e.target.value;
    setValue(newValue);
    onUpdate(object.id, { content: newValue });
  };

  // Handle blur (finish editing)
  const handleBlur = () => {
    onFinishEdit();
  };

  // Render field content based on type
  const renderFieldContent = () => {
    if (object.type === 'checkbox') {
      return (
        <input
          type="checkbox"
          className="field-checkbox-input"
          checked={Boolean(value)}
          onChange={handleContentChange}
          onBlur={handleBlur}
          autoFocus={editing}
        />
      );
    }
    
    if (object.type === 'signature' && object.content) {
      return (
        <img
          src={object.content}
          alt="Signature"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          draggable={false}
        />
      );
    }
    
    if (editing) {
      return object.type === 'text' ? (
        <textarea
          className="field-input"
          value={value}
          onChange={handleContentChange}
          onBlur={handleBlur}
          autoFocus
          placeholder="Enter text..."
        />
      ) : (
        <input
          type={object.type === 'date' ? 'date' : 'text'}
          className="field-input"
          value={value}
          onChange={handleContentChange}
          onBlur={handleBlur}
          autoFocus
          placeholder={`Enter ${object.type}...`}
        />
      );
    }
    
    // Display mode
    return (
      <div className="field-display">
        {object.type === 'signature' ? (
          object.content ? (
            <img
              src={object.content}
              alt="Signature"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              draggable={false}
            />
          ) : (
            <div style={{ color: '#999', fontSize: '0.8em', textAlign: 'center' }}>
              Click to sign
            </div>
          )
        ) : (
          value || `[${object.type}]`
        )}
      </div>
    );
  };

  return (
    <div
      className={getFieldClasses()}
      style={fieldStyle}
      onMouseDown={handleInteraction}
      onTouchStart={handleInteraction}
    >
      {renderFieldContent()}
      
      {selected && !editing && (
        <div
          className="field-resize-handle"
          onMouseDown={handleResize}
          onTouchStart={handleResize}
        />
      )}
    </div>
  );
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
    if (!isDrawing) return;
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
    if (isEmpty) return;
    const canvas = canvasRef.current;
    const dataURL = canvas.toDataURL('image/png');
    onSave(dataURL);
  };

  if (!isOpen) return null;

  return (
    <div className="signature-dialog-overlay">
      <div className="signature-dialog">
        <h3>Create Signature</h3>
        <canvas
          ref={canvasRef}
          className="signature-canvas"
          width={450}
          height={200}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <div className="signature-actions">
          <button onClick={onClose} className="btn-cancel">
            Cancel
          </button>
          <button onClick={clearSignature} className="btn-clear-signature">
            Clear
          </button>
          <button onClick={saveSignature} className="btn-use-signature">
            ✅ Use This Signature
          </button>
        </div>
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
    setObjects,
    selectedId,
    setSelectedId,
    editingId,
    setEditingId,
    addTextObject,
    addSignatureObject,
    addDateObject,
    addCheckboxObject,
    updateObject,
    deleteObject,
    clearAllObjects,
    isRendering
  } = usePDFEditor(pdf, job);

  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const currentObjects = objects.filter(obj => obj.page === currentPage);

  const handleCanvasClick = useCallback((e) => {
    if (isRendering) return;
    setSelectedId(null);
    setEditingId(null);
  }, [isRendering, setSelectedId, setEditingId]);

  // Toolbar actions
  const handleAddTextBox = () => addTextObject(100, 100);
  const handleAddSignature = () => {
    addSignatureObject(100, 100);
    setShowSignatureDialog(true);
  };
  const handleAddDate = () => addDateObject(100, 100);
  const handleAddTimestamp = () => {
    const now = new Date();
    const timestamp = now.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    const id = Date.now().toString();
    const newTimestamp = {
      id,
      type: 'timestamp',
      x: 100 / scale,
      y: 100 / scale,
      width: 150 / scale,
      height: 24 / scale,
      content: timestamp,
      fontSize: 11,
      color: '#000000',
      page: currentPage
    };
    
    setObjects(prev => [...prev, newTimestamp]);
    setSelectedId(id);
  };
  const handleAddCheckbox = () => addCheckboxObject(100, 100);

  // Handle signature save
  const handleSignatureSave = (signatureDataURL) => {
    if (selectedId) {
      updateObject(selectedId, { content: signatureDataURL });
    }
    setShowSignatureDialog(false);
  };

  // Enhanced save with proper data validation
  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      
      // Validate that we have fields to save
      if (objects.length === 0) {
        setSuccessMessage('No fields to save. Please add some fields to the form first.');
        setShowSuccessPopup(true);
        return;
      }
      
      // Validate checkboxes are properly formatted
      const processedObjects = objects.map(obj => {
        if (obj.type === 'checkbox') {
          return {
            ...obj,
            content: Boolean(obj.content)
          };
        }
        return obj;
      });
      
      const originalName = pdf.fileName || pdf.name || 'Document';
      let cleanName = originalName.replace(/\.pdf$/i, '');
      
      if (cleanName.includes('/')) {
        cleanName = cleanName.split('/').pop();
      }
      
      cleanName = cleanName.replace(/@@\d+.*$/, match => {
        const atMatch = match.match(/@@\d+/);
        return atMatch ? atMatch[0] : '';
      });
      
      const saveData = {
        fileName: `${cleanName}_completed.pdf`,
        originalFileName: originalName,
        attachmentId: pdf.serviceTitanId || pdf.id,
        jobId: job.id,
        fields: processedObjects,
        metadata: {
          totalPages,
          currentScale: scale,
          completedAt: new Date().toISOString(),
          technicianId: job.technician?.id,
          customerName: job.customer?.name
        }
      };
      
      console.log('📋 Preparing to save PDF with data:', saveData);
      
      const result = await onSave(saveData);
      
      if (result && result.success) {
        setSuccessMessage(`✅ Success!\n\nPDF form completed and saved:\n"${result.fileName || cleanName}"\n\nThe completed form has been uploaded to ServiceTitan.`);
        setShowSuccessPopup(true);
      } else {
        throw new Error(result?.error || 'Save failed - no response from server');
      }
      
    } catch (error) {
      console.error('❌ Save error:', error);
      setSuccessMessage(`❌ Save Failed\n\n${error.message}\n\nPlease try again or contact support if the problem persists.`);
      setShowSuccessPopup(true);
    } finally {
      setIsSaving(false);
    }
  }, [objects, pdf, job, totalPages, scale, onSave]);

  // Handle success popup close
  const handleSuccessClose = () => {
    setShowSuccessPopup(false);
    setSuccessMessage('');
    
    if (successMessage.includes('✅ Success!')) {
      onClose();
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' && selectedId) {
        deleteObject(selectedId);
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
        setEditingId(null);
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault();
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, deleteObject, handleSave, setSelectedId, setEditingId]);

  // Render main component
  if (pdfError) {
    return (
      <div className="pdf-editor-simple">
        <div className="pdf-error">
          <h3>Failed to Load PDF</h3>
          <p>{pdfError}</p>
          <button onClick={onClose} className="btn-close">
            ← Back to Attachments
          </button>
        </div>
      </div>
    );
  }

  if (!pdfLoaded) {
    return (
      <div className="pdf-editor-simple">
        <div className="pdf-loading">
          <div className="loading-spinner"></div>
          <p>Loading PDF...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-editor-simple">
      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="success-popup-overlay">
          <div className="success-popup">
            <div className="success-icon">
              {successMessage.includes('✅') ? '🎉' : '❌'}
            </div>
            <h3>{successMessage.includes('✅') ? 'PDF Saved Successfully!' : 'Save Error'}</h3>
            <div className="success-message">{successMessage}</div>
            <button onClick={handleSuccessClose} className="success-ok-btn">
              OK
            </button>
          </div>
        </div>
      )}

      {/* Signature Dialog */}
      <SignatureDialog
        isOpen={showSignatureDialog}
        onClose={() => setShowSignatureDialog(false)}
        onSave={handleSignatureSave}
      />

      {/* Header */}
      <div className="editor-header">
        <div className="pdf-info">
          <h2>📝 {pdf.fileName || pdf.name || 'PDF Form'}</h2>
          <p>Job #{job.number} • {job.customer?.name || 'Customer'}</p>
        </div>
        <div className="completion-status">
          {objects.length} field{objects.length !== 1 ? 's' : ''} added
        </div>
      </div>

      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <div className="tool-group">
            <span className="tool-group-label">Add Fields</span>
            <button onClick={handleAddTextBox} className="btn btn-text">
              📝 Text
            </button>
            <button onClick={handleAddSignature} className="btn btn-signature">
              ✍️ Signature
            </button>
            <button onClick={handleAddDate} className="btn btn-date">
              📅 Date
            </button>
            <button onClick={handleAddTimestamp} className="btn btn-timestamp">
              🕐 Timestamp
            </button>
            <button onClick={handleAddCheckbox} className="btn btn-checkbox">
              ☑️ Checkbox
            </button>
          </div>

          <div className="tool-group">
            <span className="tool-group-label">Actions</span>
            <button 
              onClick={clearAllObjects}
              className="btn btn-clear"
              disabled={objects.length === 0}
            >
              🗑️ Clear All
            </button>
          </div>
        </div>

        <div className="toolbar-center">
          <div className="page-nav">
            <button 
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              ← Prev
            </button>
            <span className="page-info">
              Page {currentPage} of {totalPages}
            </span>
            <button 
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
            >
              Next →
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          <div className="scale-controls">
            <button onClick={() => setScale(Math.max(0.5, scale - 0.1))}>
              🔍-
            </button>
            <select
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
            >
              <option value={0.5}>50%</option>
              <option value={0.75}>75%</option>
              <option value={1}>100%</option>
              <option value={1.2}>120%</option>
              <option value={1.5}>150%</option>
              <option value={2}>200%</option>
            </select>
            <button onClick={() => setScale(Math.min(3, scale + 0.1))}>
              🔍+
            </button>
          </div>

          <div className="tool-group">
            <button 
              onClick={handleSave}
              disabled={isSaving || objects.length === 0}
              className="btn btn-save"
            >
              {isSaving ? '💾 Saving...' : '💾 Save PDF'}
            </button>
            <button onClick={onClose} className="btn btn-close">
              ← Back
            </button>
          </div>
        </div>
      </div>

      {/* PDF Container */}
      <div className="pdf-container">
        <div className="pdf-wrapper">
          {isRendering && (
            <div className="rendering-overlay">
              <div className="loading-spinner"></div>
              <span>Rendering...</span>
            </div>
          )}
          
          <canvas
            ref={canvasRef}
            className="pdf-canvas"
            onClick={handleCanvasClick}
          />
          
          {/* Render editable fields */}
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
      </div>
    </div>
  );
}