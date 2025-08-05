/**
 * PDFEditor.jsx - Professional PDF Form Editor Component
 * 
 * Features:
 * - Interactive PDF form field editing
 * - Drag & drop field positioning  
 * - Touch/mouse support for tablets and desktop
 * - Real-time form field updates
 * - Professional centered layout with single scrollbar
 * - Optimized rendering to prevent infinite re-renders
 * 
 * @param {Object} pdf - PDF attachment object
 * @param {Object} job - ServiceTitan job object  
 * @param {Function} onClose - Callback when editor is closed
 * @param {Function} onSave - Callback when form is saved
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './PDFEditor.css';

/**
 * Custom hook for PDF operations with optimized dependency management
 * Prevents unnecessary re-renders and provides efficient PDF editing functionality
 */
function usePDFEditor(pdf, job) {
  // Core PDF state
  const canvasRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [isRendering, setIsRendering] = useState(false);

  // Form field state
  const [objects, setObjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  // Memoize stable identifiers to prevent unnecessary re-renders
  const pdfId = useMemo(() => pdf?.serviceTitanId || pdf?.id, [pdf?.serviceTitanId, pdf?.id]);
  const jobId = useMemo(() => job?.id, [job?.id]);

  /**
   * Load PDF document with PDF.js
   * Handles script loading, PDF fetching, and error states
   */
  const loadPDF = useCallback(async () => {
    if (!pdfId || !jobId) return;
    
    try {
      setPdfError(null);
      setPdfLoaded(false);
      setIsRendering(false);
      
      console.log('📄 Loading PDF:', pdfId, 'for job:', jobId);
      
      // Load PDF.js library if not already loaded
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

      // Fetch PDF from ServiceTitan API
      const downloadUrl = `/api/job/${jobId}/attachment/${pdfId}/download`;
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to load PDF: ${response.status} ${response.statusText}`);
      }

      // Parse PDF document
      const arrayBuffer = await response.arrayBuffer();
      const pdfDoc = await window.pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
      
      setPdfDocument(pdfDoc);
      setTotalPages(pdfDoc.numPages);
      setPdfLoaded(true);
      
      console.log(`✅ PDF loaded successfully: ${pdfDoc.numPages} pages`);
    } catch (error) {
      console.error('❌ PDF loading error:', error);
      setPdfError(error.message);
      setPdfLoaded(false);
    }
  }, [pdfId, jobId]);

  /**
   * Render PDF page to canvas
   * Simplified without memoization to prevent dependency loops
   */
  const renderPage = async () => {
    if (!pdfDocument || !canvasRef.current || isRendering || !pdfLoaded) {
      return;
    }
    
    try {
      setIsRendering(true);
      
      const page = await pdfDocument.getPage(currentPage);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      const viewport = page.getViewport({ scale });
      
      // Set canvas dimensions
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Render PDF page
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      console.log(`✅ Page ${currentPage} rendered at ${scale * 100}% scale`);
      
    } catch (error) {
      console.error('❌ Page rendering error:', error);
    } finally {
      setIsRendering(false);
    }
  };

  // Form field creation functions - all optimized and memoized
  
  /**
   * Add text field at specified coordinates
   */
  const addTextObject = useCallback((x = 100, y = 100) => {
    const id = `text_${Date.now()}`;
    const newText = {
      id,
      type: 'text',
      x: x / scale,
      y: y / scale,
      width: 200 / scale,
      height: 30 / scale,
      content: '',
      fontSize: 12,
      color: '#007bff',
      page: currentPage
    };
    
    setObjects(prev => [...prev, newText]);
    setSelectedId(id);
  }, [scale, currentPage]);

  /**
   * Add signature field at specified coordinates
   */
  const addSignatureObject = useCallback((x = 100, y = 100) => {
    const id = `signature_${Date.now()}`;
    const newSignature = {
      id,
      type: 'signature',
      x: x / scale,
      y: y / scale,
      width: 200 / scale,
      height: 80 / scale,
      content: null,
      page: currentPage
    };
    
    setObjects(prev => [...prev, newSignature]);
    setSelectedId(id);
  }, [scale, currentPage]);

  /**
   * Add date field with current date
   */
  const addDateObject = useCallback((x = 100, y = 100) => {
    const id = `date_${Date.now()}`;
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
      fontSize: 12,
      color: '#007bff',
      page: currentPage
    };
    
    setObjects(prev => [...prev, newDate]);
    setSelectedId(id);
  }, [scale, currentPage]);

  /**
   * Add checkbox field (displays as X when checked)
   */
  const addCheckboxObject = useCallback((x = 100, y = 100) => {
    const id = `checkbox_${Date.now()}`;
    const newCheckbox = {
      id,
      type: 'checkbox',
      x: x / scale,
      y: y / scale,
      width: 30 / scale,
      height: 30 / scale,
      content: false,
      fontSize: 18,
      color: '#007bff',
      page: currentPage
    };
    
    setObjects(prev => [...prev, newCheckbox]);
    setSelectedId(id);
  }, [scale, currentPage]);

  // Object management functions
  
  /**
   * Update form field properties
   */
  const updateObject = useCallback((id, updates) => {
    setObjects(prev => prev.map(obj => 
      obj.id === id ? { ...obj, ...updates } : obj
    ));
  }, []);

  /**
   * Delete form field and clear selection
   */
  const deleteObject = useCallback((id) => {
    setObjects(prev => prev.filter(obj => obj.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  }, [selectedId, editingId]);

  /**
   * Clear all form fields
   */
  const clearAllObjects = useCallback(() => {
    setObjects([]);
    setSelectedId(null);
    setEditingId(null);
  }, []);

  // Effect hooks with optimized dependencies
  
  /**
   * Initialize PDF loading when component mounts or IDs change
   * Only loads once to prevent infinite loops
   */
  useEffect(() => {
    let isMounted = true;
    
    const initializePDF = async () => {
      // Only load if we have IDs, no document loaded, and no error
      if (isMounted && pdfId && jobId && !pdfDocument && !pdfLoaded && !pdfError) {
        await loadPDF();
      }
    };
    
    initializePDF();
    
    return () => {
      isMounted = false;
    };
  }, [pdfId, jobId]); // ONLY depend on the IDs, not the state or loadPDF function

  /**
   * Render PDF page when document, page, or scale changes
   * Properly debounced to prevent excessive rendering
   */
  useEffect(() => {
    let isMounted = true;
    let timeoutId;
    
    const doRender = () => {
      if (isMounted && pdfDocument && pdfLoaded && !isRendering) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(renderPage, 100); // Direct function reference
      }
    };
    
    doRender();
    
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [pdfDocument, currentPage, scale, pdfLoaded]); // Remove isRendering and renderPage from deps

  // Return hook interface
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

/**
 * EditableField Component - Interactive form field with drag/resize support
 * 
 * Handles all form field types with professional interaction patterns:
 * - Single click/tap: Select field
 * - Double click/tap: Enter edit mode  
 * - Drag: Move field position
 * - Resize handle: Adjust field size
 */
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
        return Math.max(object.height * scale, object.fontSize * scale * 1.2);
      default:
        return object.height * scale;
    }
  };

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
    color: object.color || '#007bff',
    zIndex: selected ? 1000 : 100
  };

  const handleResize = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    
    const startX = e.touches ? e.touches[0].clientX : e.clientX;
    const startY = e.touches ? e.touches[0].clientY : e.clientY;
    const startWidth = object.width * scale;
    const startHeight = object.height * scale;
    
    const doResize = (moveEvent) => {
      moveEvent.preventDefault();
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
    
    const stopResize = (stopEvent) => {
      if (stopEvent) stopEvent.preventDefault();
      document.removeEventListener('mousemove', doResize);
      document.removeEventListener('mouseup', stopResize);
      document.removeEventListener('touchmove', doResize);
      document.removeEventListener('touchend', stopResize);
    };
    
    document.addEventListener('mousemove', doResize, { passive: false });
    document.addEventListener('mouseup', stopResize);
    document.addEventListener('touchmove', doResize, { passive: false });
    document.addEventListener('touchend', stopResize);
  }, [object.id, object.width, object.height, object.type, scale, onUpdate]);

  const handleInteraction = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    
    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTime;
    
    // Double-click/tap to edit
    if (timeDiff < 400 && selected) {
      onStartEdit(object.id);
      return;
    }
    
    // Single click/tap to select and prepare for drag
    onSelect(object.id);
    setIsDragging(true);
    
    const startX = e.touches ? e.touches[0].clientX : e.clientX;
    const startY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const doDrag = (moveEvent) => {
      moveEvent.preventDefault();
      const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const clientY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
      
      // Only start dragging if mouse/finger has moved significantly
      const deltaX = Math.abs(clientX - startX);
      const deltaY = Math.abs(clientY - startY);
      
      if (deltaX > 3 || deltaY > 3) {
        const canvas = document.querySelector('.pdf-canvas');
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        const newX = Math.max(0, (clientX - rect.left) / scale);
        const newY = Math.max(0, (clientY - rect.top) / scale);
        
        onUpdate(object.id, { x: newX, y: newY });
      }
    };
    
    const stopDrag = (stopEvent) => {
      if (stopEvent) stopEvent.preventDefault();
      setIsDragging(false);
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
      document.removeEventListener('touchmove', doDrag);
      document.removeEventListener('touchend', stopDrag);
    };
    
    document.addEventListener('mousemove', doDrag, { passive: false });
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', doDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);
    
    setLastClickTime(currentTime);
  }, [selected, lastClickTime, onSelect, onStartEdit, object.id, scale, onUpdate]);

  const handleContentChange = (e) => {
    if (object.type === 'checkbox') {
      // Toggle checkbox on any interaction
      const newValue = !Boolean(value);
      setValue(newValue);
      onUpdate(object.id, { content: newValue });
    } else {
      const newValue = e.target.value;
      setValue(newValue);
      onUpdate(object.id, { content: newValue });
    }
  };

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    if (object.type === 'checkbox') {
      const newValue = !Boolean(value);
      setValue(newValue);
      onUpdate(object.id, { content: newValue });
    }
  };

  const handleBlur = () => {
    onFinishEdit();
  };

  const renderFieldContent = () => {
    if (object.type === 'checkbox') {
      return (
        <div 
          className="field-checkbox-display"
          onClick={handleCheckboxClick}
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${object.fontSize * scale}px`,
            fontWeight: 'bold',
            color: '#007bff',
            cursor: 'pointer',
            userSelect: 'none',
            fontFamily: 'monospace'
          }}
        >
          {Boolean(value) ? 'X' : ''}
        </div>
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
          style={{
            position: 'absolute',
            bottom: '-5px',
            right: '-5px',
            width: '12px',
            height: '12px',
            background: '#007bff',
            border: '2px solid white',
            borderRadius: '50%',
            cursor: 'se-resize',
            touchAction: 'none'
          }}
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
      color: '#007bff',
      page: currentPage
    };
    
    setObjects(prev => [...prev, newTimestamp]);
    setSelectedId(id);
  };
  const handleAddCheckbox = () => addCheckboxObject(100, 100);

  const handleSignatureSave = (signatureDataURL) => {
    if (selectedId) {
      updateObject(selectedId, { content: signatureDataURL });
    }
    setShowSignatureDialog(false);
  };

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      
      if (objects.length === 0) {
        setSuccessMessage('No fields to save. Please add some fields to the form first.');
        setShowSuccessPopup(true);
        return;
      }
      
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
        </div>

        <div className="toolbar-center">
          <div className="page-nav">
            <button 
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="btn"
            >
              ← Prev
            </button>
            <span className="page-info">
              Page {currentPage} of {totalPages}
            </span>
            <button 
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="btn"
            >
              Next →
            </button>
          </div>

          <div className="scale-controls">
            <button onClick={() => setScale(Math.max(0.5, scale - 0.1))} className="btn">
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
            <button onClick={() => setScale(Math.min(3, scale + 0.1))} className="btn">
              🔍+
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          <div className="tool-group">
            <span className="tool-group-label">Actions</span>
            <button 
              onClick={clearAllObjects}
              className="btn btn-clear"
              disabled={objects.length === 0}
            >
              🗑️ Clear
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving || objects.length === 0}
              className="btn btn-save"
            >
              {isSaving ? '💾 Save' : '💾 Save'}
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving || objects.length === 0}  
              className="btn btn-upload"
            >
              {isSaving ? '📤 Upload...' : '📤 Upload'}
            </button>
            <button onClick={onClose} className="btn btn-back">
              ← Back
            </button>
          </div>
        </div>
      </div>

      {/* Loading Overlay - Direct in main container */}
      {isRendering && (
        <div className="rendering-overlay">
          <div className="loading-spinner"></div>
          <span>Rendering...</span>
        </div>
      )}
      
      {/* PDF Canvas - Direct in main container */}
      <canvas
        ref={canvasRef}
        className="pdf-canvas"
        onClick={handleCanvasClick}
      />
      
      {/* Form Fields - Direct in main container */}
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
  );
}