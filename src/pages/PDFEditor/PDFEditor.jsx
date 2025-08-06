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
   * Load PDF document with optimized error handling
   */
  const loadPDF = useCallback(async () => {
    if (!pdf || pdfLoaded || isRendering) return;
    
    try {
      setIsRendering(true);
      setPdfError(null);
      
      console.log('📖 Loading PDF:', pdf.name);
      
      // Import PDF.js dynamically to avoid SSR issues
      const pdfjs = await import('pdfjs-dist');
      
      // Set worker path for PDF.js
      pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
      
      // Determine PDF source based on available data
      let pdfSource;
      
      if (pdf.dataUrl && pdf.dataUrl.startsWith('data:')) {
        // Handle data URLs (base64 encoded PDFs)
        pdfSource = pdf.dataUrl;
      } else if (pdf.url || pdf.downloadUrl) {
        // Handle regular URLs
        const url = pdf.url || pdf.downloadUrl;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        pdfSource = { data: arrayBuffer };
      } else {
        throw new Error('No valid PDF source found');
      }
      
      // Load PDF document
      const loadingTask = pdfjs.getDocument(pdfSource);
      const document = await loadingTask.promise;
      
      setPdfDocument(document);
      setTotalPages(document.numPages);
      setPdfLoaded(true);
      
      console.log(`✅ PDF loaded successfully: ${document.numPages} pages`);
      
    } catch (error) {
      console.error('❌ PDF loading failed:', error);
      setPdfError(error.message || 'Failed to load PDF');
    } finally {
      setIsRendering(false);
    }
  }, [pdf, pdfLoaded, isRendering]);

  /**
   * Render PDF page to canvas with proper scaling
   */
  const renderPage = useCallback(async () => {
    if (!pdfDocument || !canvasRef.current || isRendering) return;
    
    try {
      setIsRendering(true);
      
      const page = await pdfDocument.getPage(currentPage);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Calculate viewport with scale
      const viewport = page.getViewport({ scale });
      
      // Set canvas dimensions
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      
      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Render page
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
    } catch (error) {
      console.error('❌ Page rendering failed:', error);
      setPdfError('Failed to render PDF page');
    } finally {
      setIsRendering(false);
    }
  }, [pdfDocument, currentPage, scale, isRendering]);

  // Form field creation functions
  
  /**
   * Add text field to current page
   */
  const addTextObject = useCallback((x = 100, y = 100) => {
    const id = `text_${Date.now()}`;
    const newText = {
      id,
      type: 'text',
      x: x / scale,
      y: y / scale,
      width: 200 / scale,
      height: 60 / scale,
      content: '',
      fontSize: 12,
      color: '#007bff',
      page: currentPage
    };
    
    setObjects(prev => [...prev, newText]);
    setSelectedId(id);
  }, [scale, currentPage]);

  /**
   * Add signature field to current page
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
  const [dragStartPosition, setDragStartPosition] = useState({ x: 0, y: 0 });
  const fieldRef = useRef(null);
  
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

  // Get canvas bounds with proper error checking
  const getCanvasBounds = () => {
    const canvas = document.querySelector('.pdf-canvas');
    if (!canvas) {
      console.warn('Canvas not found for drag operation');
      return null;
    }
    return canvas.getBoundingClientRect();
  };

  // Extract coordinates from mouse or touch event
  const getEventCoordinates = (e) => {
    if (e.touches && e.touches.length > 0) {
      return {
        clientX: e.touches[0].clientX,
        clientY: e.touches[0].clientY
      };
    }
    return {
      clientX: e.clientX,
      clientY: e.clientY
    };
  };

  const handleResize = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    
    const coords = getEventCoordinates(e);
    const startWidth = object.width * scale;
    const startHeight = object.height * scale;
    
    const doResize = (moveEvent) => {
      moveEvent.preventDefault();
      const currentCoords = getEventCoordinates(moveEvent);
      
      const deltaX = currentCoords.clientX - coords.clientX;
      const deltaY = currentCoords.clientY - coords.clientY;
      
      const newWidth = Math.max(object.type === 'checkbox' ? 20 : 60, startWidth + deltaX);
      const newHeight = Math.max(object.type === 'checkbox' ? 20 : 24, startHeight + deltaY);
      
      onUpdate(object.id, {
        width: newWidth / scale,
        height: newHeight / scale
      });
    };
    
    const stopResize = (stopEvent) => {
      if (stopEvent) stopEvent.preventDefault();
      
      // Remove all event listeners
      document.removeEventListener('mousemove', doResize);
      document.removeEventListener('mouseup', stopResize);
      document.removeEventListener('touchmove', doResize, { passive: false });
      document.removeEventListener('touchend', stopResize);
      
      // Re-enable text selection
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };
    
    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    
    // Add event listeners with proper passive settings
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
    document.addEventListener('touchmove', doResize, { passive: false });
    document.addEventListener('touchend', stopResize);
  }, [object.id, object.width, object.height, object.type, scale, onUpdate]);

  const handleInteraction = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    
    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTime;
    const coords = getEventCoordinates(e);
    
    // Double-click/tap to edit
    if (timeDiff < 400 && selected && !isDragging) {
      onStartEdit(object.id);
      return;
    }
    
    // Single click/tap to select and prepare for drag
    onSelect(object.id);
    setLastClickTime(currentTime);
    
    // Store initial drag position
    const canvasBounds = getCanvasBounds();
    if (!canvasBounds) return;
    
    const initialX = (coords.clientX - canvasBounds.left) / scale;
    const initialY = (coords.clientY - canvasBounds.top) / scale;
    
    setDragStartPosition({ x: initialX, y: initialY });
    
    // Calculate offset from mouse to field's top-left corner
    const offsetX = initialX - object.x;
    const offsetY = initialY - object.y;
    
    let hasStartedDragging = false;
    
    const doDrag = (moveEvent) => {
      moveEvent.preventDefault();
      
      const currentCoords = getEventCoordinates(moveEvent);
      const canvasBounds = getCanvasBounds();
      if (!canvasBounds) return;
      
      // Calculate how far we've moved from start
      const currentX = (currentCoords.clientX - canvasBounds.left) / scale;
      const currentY = (currentCoords.clientY - canvasBounds.top) / scale;
      
      const deltaX = Math.abs(currentX - dragStartPosition.x);
      const deltaY = Math.abs(currentY - dragStartPosition.y);
      
      // Only start dragging if we've moved significantly (reduces accidental drags)
      if (deltaX > 3 || deltaY > 3) {
        if (!hasStartedDragging) {
          setIsDragging(true);
          hasStartedDragging = true;
          
          // Prevent text selection during drag
          document.body.style.userSelect = 'none';
          document.body.style.webkitUserSelect = 'none';
        }
        
        // Calculate new position accounting for the offset
        const newX = Math.max(0, currentX - offsetX);
        const newY = Math.max(0, currentY - offsetY);
        
        // Constrain to canvas bounds
        const maxX = (canvasBounds.width / scale) - object.width;
        const maxY = (canvasBounds.height / scale) - object.height;
        
        const constrainedX = Math.min(Math.max(0, newX), Math.max(0, maxX));
        const constrainedY = Math.min(Math.max(0, newY), Math.max(0, maxY));
        
        onUpdate(object.id, { 
          x: constrainedX, 
          y: constrainedY 
        });
      }
    };
    
    const stopDrag = (stopEvent) => {
      if (stopEvent) stopEvent.preventDefault();
      
      // Clean up drag state
      setIsDragging(false);
      hasStartedDragging = false;
      
      // Remove all event listeners
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
      document.removeEventListener('touchmove', doDrag, { passive: false });
      document.removeEventListener('touchend', stopDrag);
      
      // Re-enable text selection
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };
    
    // Add event listeners with proper passive settings
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', doDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);
    
  }, [selected, lastClickTime, onSelect, onStartEdit, object.id, object.x, object.y, object.width, object.height, scale, onUpdate, isDragging, dragStartPosition]);

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      // Ensure all event listeners are cleaned up when component unmounts
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };
  }, []);

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
          {Boolean(value) ? '✓' : ''}
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
          style={{ pointerEvents: 'auto' }}
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
          style={{ pointerEvents: 'auto' }}
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
      ref={fieldRef}
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
            touchAction: 'none',
            zIndex: 1001
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
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const savedFileName = `${cleanName}@@${timestamp}-filled.pdf`;
      
      const saveData = {
        objects: processedObjects,
        fileName: savedFileName,
        originalFileName: originalName,
        attachmentId: pdf.serviceTitanId || pdf.id,
        serviceTitanId: pdf.serviceTitanId || pdf.id,
        pdfId: pdf.serviceTitanId || pdf.id,
        jobId: job.id
      };
      
      console.log('💾 Attempting to save PDF with data:', saveData);
      
      const result = await onSave(saveData);
      
      if (result && result.success) {
        setSuccessMessage(`✅ PDF saved successfully!\n\nSaved as: ${savedFileName}\n\nThe completed form has been saved and is ready for processing.`);
      } else {
        setSuccessMessage('❌ Save completed but there may have been issues. Please check the attachments list to verify your changes were saved.');
      }
      
    } catch (error) {
      console.error('❌ Save failed:', error);
      setSuccessMessage(`❌ Failed to save PDF: ${error.message || 'Unknown error occurred'}`);
    } finally {
      setIsSaving(false);
      setShowSuccessPopup(true);
    }
  }, [objects, pdf, job, onSave]);

  const handleSuccessClose = () => {
    setShowSuccessPopup(false);
    setSuccessMessage('');
    
    if (successMessage.includes('✅')) {
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
            <select 
              value={scale} 
              onChange={(e) => setScale(Number(e.target.value))}
            >
              <option value={0.5}>50%</option>
              <option value={0.75}>75%</option>
              <option value={1.0}>100%</option>
              <option value={1.2}>120%</option>
              <option value={1.5}>150%</option>
              <option value={2.0}>200%</option>
            </select>
          </div>
        </div>
        
        <div className="toolbar-right">
          <div className="tool-group">
            <span className="tool-group-label">Actions</span>
            <button 
              onClick={clearAllObjects}
              disabled={objects.length === 0}
              className="btn btn-clear"
            >
              🗑️ Clear All
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving || objects.length === 0}
              className="btn btn-save"
            >
              {isSaving ? '💾 Saving...' : '💾 Save'}
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