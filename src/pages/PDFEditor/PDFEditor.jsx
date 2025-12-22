/**
 * PDFEditor.jsx - Fixed Version with Touch Support and Google Drive Support
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import './PDFEditor.css';

/**
 * Fixed PDF Editor Hook - No infinite re-renders + Google Drive support
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

  // Memoize stable identifiers
  const pdfId = useMemo(() => pdf?.serviceTitanId || pdf?.id, [pdf?.serviceTitanId, pdf?.id]);
  const jobId = useMemo(() => job?.id, [job?.id]);

  /**
   * Get canvas center position - NOT wrapped in useCallback
   */
  const getCanvasCenter = () => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 200, y: 150 };
    
    const centerX = canvas.width / 2 / scale;
    const centerY = canvas.height / 2 / scale;
    
    return { x: centerX, y: centerY };
  };

  /**
   * Load PDF document - Added Google Drive support
   */
  const loadPDF = async () => {
    if (!pdf || pdfLoaded || isRendering) return;
    
    try {
      setIsRendering(true);
      setPdfError(null);
      
      console.log('📖 Loading PDF:', pdf.name);
      
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
      
      let pdfSource;
      
      // NEW: Google Drive file loading
      if (pdf.googleDriveFileId) {
        console.log('🎯 Loading from Google Drive:', pdf.googleDriveFileId);
        
        // Use the drafts download endpoint for Google Drive files
        const downloadUrl = `/api/drafts/download/${pdf.googleDriveFileId}`;
        console.log('🔗 Fetching PDF from Google Drive:', downloadUrl);
        
        const response = await fetch(downloadUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/pdf,*/*' },
          credentials: 'include'
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to load from Google Drive: ${response.status} - ${errorText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const isValidPDF = arrayBuffer.byteLength > 0 && 
                          new Uint8Array(arrayBuffer).slice(0, 4).toString() === '37,80,68,70';
        
        if (!isValidPDF) {
          throw new Error('Downloaded file from Google Drive is not a valid PDF document');
        }
        
        pdfSource = { data: arrayBuffer };
        console.log('✅ PDF loaded from Google Drive, size:', arrayBuffer.byteLength, 'bytes');
        
      } else if (pdf.dataUrl && pdf.dataUrl.startsWith('data:')) {
        console.log('🎯 Using dataUrl source');
        pdfSource = pdf.dataUrl;
        
      } else if (pdf.url || pdf.downloadUrl) {
        console.log('🎯 Using direct URL source');
        const url = pdf.url || pdf.downloadUrl;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        pdfSource = { data: arrayBuffer };
        
      } else if (pdf.serviceTitanId && jobId) {
        console.log('🎯 Using ServiceTitan attachment download');
        
        const downloadUrl = `/api/job/${jobId}/attachment/${pdf.serviceTitanId}/download`;
        console.log('🔗 Fetching PDF:', downloadUrl);
        
        const response = await fetch(downloadUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/pdf,*/*' },
          credentials: 'include'
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${response.statusText}. ${errorText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const isValidPDF = arrayBuffer.byteLength > 0 && 
                          new Uint8Array(arrayBuffer).slice(0, 4).toString() === '37,80,68,70';
        
        if (!isValidPDF) {
          throw new Error('Downloaded file is not a valid PDF document');
        }
        
        pdfSource = { data: arrayBuffer };
        console.log('✅ PDF fetched, size:', arrayBuffer.byteLength, 'bytes');
        
      } else {
        throw new Error('No valid PDF source found');
      }
      
      const loadingTask = pdfjs.getDocument(pdfSource);
      const document = await loadingTask.promise;
      
      setPdfDocument(document);
      setTotalPages(document.numPages);
      setPdfLoaded(true);
      
      console.log(`✅ PDF loaded: ${document.numPages} pages`);
      
    } catch (error) {
      console.error('❌ PDF loading failed:', error);
      setPdfError(error.message || 'Failed to load PDF');
    } finally {
      setIsRendering(false);
    }
  };

  /**
   * Render PDF page - NOT wrapped in useCallback
   */
  const renderPage = async () => {
    if (!pdfDocument || !canvasRef.current || isRendering) return;
    
    try {
      setIsRendering(true);
      
      const page = await pdfDocument.getPage(currentPage);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      const viewport = page.getViewport({ scale });
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      console.log('✅ Page rendered:', { page: currentPage, scale, width: viewport.width, height: viewport.height });
      
    } catch (error) {
      console.error('❌ Page rendering failed:', error);
      setPdfError('Failed to render PDF page');
    } finally {
      setIsRendering(false);
    }
  };

  /**
   * Simple field creation - NOT wrapped in useCallback
   */
  const createField = (type) => {
    const center = getCanvasCenter();
    const id = `${type}_${Date.now()}`;

    // Font sizes - 11px universally
    const fontSize = 11;

    // Default content
    let content = '';
    if (type === 'date') {
      content = new Date().toLocaleDateString('en-US');
    } else if (type === 'timestamp') {
      content = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } else if (type === 'checkbox') {
      content = true;
    } else if (type === 'text') {
      content = ''; // Empty content, placeholder will show
    }

    // Calculate size based on content + right padding for resize handle
    const rightPadding = 20;
    let width, height;

    if (type === 'checkbox') {
      // Checkbox: 11px X + right padding
      width = 11 + rightPadding;
      height = 11;
    } else if (type === 'signature') {
      // Signature: Measure placeholder text
      const placeholderText = 'Click to sign';
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      context.font = `${fontSize}px Arial, sans-serif`;
      const metrics = context.measureText(placeholderText);
      const textWidth = metrics.width;

      // Signature needs more height for drawing
      width = textWidth + rightPadding;
      height = fontSize * 2; // Double height for signature space
    } else {
      // Measure text to get proper width (use placeholder if content is empty)
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      context.font = `${fontSize}px Arial, sans-serif`;
      const textToMeasure = content || 'Text'; // Use placeholder for sizing
      const metrics = context.measureText(textToMeasure);
      const textWidth = metrics.width;

      // Use actual text width + right padding
      width = textWidth + rightPadding;
      height = fontSize;
    }

    const newField = {
      id,
      type,
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
      content,
      fontSize,
      color: '#1e3a8a',
      page: currentPage
    };

    console.log(`✨ Created ${type} field at center:`, { x: newField.x, y: newField.y });

    setObjects(prev => [...prev, newField]);
    setSelectedId(id);
  };

  // Field creation functions - simple functions, not useCallback
  const addTextObject = () => createField('text');
  const addSignatureObject = () => createField('signature');
  const addDateObject = () => createField('date');
  const addTimestampObject = () => createField('timestamp');
  const addCheckboxObject = () => createField('checkbox');

  // Object management - simple functions, not useCallback
  const updateObject = (id, updates) => {
    setObjects(prev => prev.map(obj => obj.id === id ? { ...obj, ...updates } : obj));
  };

  const deleteObject = (id) => {
    setObjects(prev => prev.filter(obj => obj.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  };

  const clearAllObjects = () => {
    setObjects([]);
    setSelectedId(null);
    setEditingId(null);
  };

  // Canvas click handler - simple function, not useCallback
  const handleCanvasClick = () => {
    setSelectedId(null);
    setEditingId(null);
  };

  // Effects - FIXED to prevent infinite re-renders
  useEffect(() => {
    if (pdfId && jobId && !pdfDocument && !pdfLoaded && !pdfError) {
      loadPDF();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfId, jobId]); // Only depend on the stable IDs

  useEffect(() => {
    if (pdfDocument && pdfLoaded && !isRendering) {
      const timeoutId = setTimeout(renderPage, 100);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDocument, currentPage, scale, pdfLoaded]); // Only depend on render parameters

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
    addTimestampObject,
    addCheckboxObject,
    updateObject,
    deleteObject,
    clearAllObjects,
    handleCanvasClick,
    isRendering
  };
}

/**
 * FIXED EditableField - Touch Support Added
 */
function EditableField({ object, scale, selected, editing, onUpdate, onSelect, onStartEdit, onFinishEdit }) {
  const [value, setValue] = useState(object.content || '');
  const [isDragging, setIsDragging] = useState(false);
  
  useEffect(() => {
    setValue(object.content || '');
  }, [object.content]);

  const fieldStyle = {
    position: 'absolute',
    left: `${object.x * scale}px`,
    top: `${object.y * scale}px`,
    width: `${object.width * scale}px`,
    height: `${object.height * scale}px`,
    fontSize: `${object.fontSize * scale}px`,
    color: object.color,
    transition: isDragging ? 'none' : 'left 0.1s ease-out, top 0.1s ease-out'
  };

  const handleMouseDown = (e) => {
    // Don't interfere with text editing - allow normal text interaction
    if (editing || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
      onSelect(object.id);
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    onSelect(object.id);

    // 🔍 TEMP DEBUG: Log field position when selected
    if (object.type === 'text' || object.type === 'date' || object.type === 'checkbox') {
      console.log(`🔍 SELECTED ${object.type.toUpperCase()}:`, {
        id: object.id,
        position: { x: object.x, y: object.y },
        dimensions: { width: object.width, height: object.height },
        content: object.content,
        fontSize: object.fontSize,
        page: object.page
      });
    }

    // Check for double click to edit
    const now = Date.now();
    if (window.lastClickTime && now - window.lastClickTime < 300) {
      onStartEdit(object.id);
      return;
    }
    window.lastClickTime = now;
    
    // Start drag with optimized performance
    setIsDragging(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startObjX = object.x;
    const startObjY = object.y;
    
    // Track if we're actually dragging (moved more than a few pixels)
    let hasMoved = false;
    
    const handleMouseMove = (e) => {
      const deltaX = (e.clientX - startX) / scale;
      const deltaY = (e.clientY - startY) / scale;
      
      // Check if we've moved enough to consider this a drag
      if (!hasMoved && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
        hasMoved = true;
      }
      
      if (hasMoved) {
        const newX = Math.max(0, startObjX + deltaX);
        const newY = Math.max(0, startObjY + deltaY);
        
        // Update position immediately in React state - no transform tricks
        onUpdate(object.id, {
          x: newX,
          y: newY
        });
      }
    };
    
    const handleMouseUp = (e) => {
      setIsDragging(false);

      // Final position update if we moved
      if (hasMoved) {
        const deltaX = (e.clientX - startX) / scale;
        const deltaY = (e.clientY - startY) / scale;
        const finalX = Math.max(0, startObjX + deltaX);
        const finalY = Math.max(0, startObjY + deltaY);

        onUpdate(object.id, {
          x: finalX,
          y: finalY
        });

        // 🔍 TEMP DEBUG: Log final position after drag
        if (object.type === 'text' || object.type === 'date' || object.type === 'checkbox') {
          console.log(`🔍 MOVED ${object.type.toUpperCase()}:`, {
            id: object.id,
            from: { x: startObjX, y: startObjY },
            to: { x: finalX, y: finalY },
            delta: { dx: deltaX, dy: deltaY },
            scale: scale
          });
        }
      }

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove, { passive: false });
      document.removeEventListener('touchend', handleTouchEnd);
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        const touchEvent = { clientX: touch.clientX, clientY: touch.clientY };
        handleMouseMove(touchEvent);
      }
    };

    const handleTouchEnd = (e) => {
      e.preventDefault();
      // Get final touch position from changedTouches for accurate end coordinates
      let finalX = startX;
      let finalY = startY;
      if (e.changedTouches && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        finalX = touch.clientX;
        finalY = touch.clientY;
      }
      handleMouseUp({ clientX: finalX, clientY: finalY });
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  // Touch event handler - improved simulation
  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;

    // Don't interfere with text editing - allow normal text interaction
    if (editing || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
      onSelect(object.id);
      return;
    }

    e.preventDefault(); // Critical - prevents scrolling and default touch behaviors
    e.stopPropagation();
    
    // Convert touch event to same format as mouse event with all necessary properties
    const touch = e.touches[0];
    const touchEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      target: e.target,
      currentTarget: e.currentTarget,
      preventDefault: () => e.preventDefault(),
      stopPropagation: () => e.stopPropagation(),
      type: 'mousedown'
    };
    
    // Use the existing mouse handler logic
    handleMouseDown(touchEvent);
  };

  const handleContentChange = (e) => {
    if (object.type === 'checkbox') {
      // Checkboxes are always checked, no toggling allowed
      return;
    } else {
      const newValue = e.target.value;
      setValue(newValue);

      // Auto-resize to fit content + right padding
      const rightPadding = 20;
      const lines = newValue.split('\n');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      context.font = `${object.fontSize}px Arial, sans-serif`;

      // Find the widest line
      let maxWidth = 0;
      lines.forEach(line => {
        const metrics = context.measureText(line || 'M');
        maxWidth = Math.max(maxWidth, metrics.width);
      });

      // Calculate height based on number of lines
      const lineCount = lines.length;
      const newWidth = maxWidth + rightPadding;
      const newHeight = object.fontSize * lineCount;

      // Always auto-resize to fit content
      onUpdate(object.id, {
        content: newValue,
        width: newWidth,
        height: newHeight
      });
    }
  };

  const renderContent = () => {
    if (object.type === 'checkbox') {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            width: '100%',
            height: '100%',
            fontWeight: 'normal',
            fontSize: '11px', // 11px universally
            color: '#1e3a8a', // Blue
            fontFamily: 'Arial, sans-serif'
          }}
        >
          X
        </div>
      );
    }
    
    if (object.type === 'signature' && object.content) {
      return (
        <img 
          src={object.content} 
          alt="Signature" 
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      );
    }
    
    if (editing) {
      // Date field uses input type="date"
      if (object.type === 'date') {
        return (
          <input
            type="date"
            value={value}
            onChange={handleContentChange}
            onBlur={onFinishEdit}
            autoFocus
            className="field-input"
            style={{ fontSize: `${object.fontSize * scale}px`, lineHeight: 1 }}
          />
        );
      }

      // Timestamp field uses input type="time"
      if (object.type === 'timestamp') {
        return (
          <input
            type="time"
            value={value}
            onChange={handleContentChange}
            onBlur={onFinishEdit}
            autoFocus
            className="field-input"
            style={{ fontSize: `${object.fontSize * scale}px`, lineHeight: 1 }}
          />
        );
      }

      // Text fields use textarea for multi-line support
      return (
        <textarea
          value={value}
          onChange={handleContentChange}
          onBlur={onFinishEdit}
          autoFocus
          placeholder="Text"
          className="field-textarea"
          style={{ fontSize: `${object.fontSize * scale}px`, lineHeight: 1 }}
          rows={1}
        />
      );
    }

    // Determine display content and color
    // Only show placeholder when NOT editing AND field is empty
    let displayContent = value;
    let displayColor = object.color || '#1e3a8a';

    // Debug logging for color
    if (object.type === 'text' || object.type === 'date' || object.type === 'timestamp') {
      console.log(`🎨 Field ${object.id} (${object.type}):`, {
        value: value,
        isEmpty: (!value || value === ''),
        objectColor: object.color,
        displayColor: displayColor
      });
    }

    if (!editing && (!value || value === '')) {
      displayColor = '#60a5fa'; // Light blue for placeholders
      if (object.type === 'text') {
        displayContent = 'Text';
      } else if (object.type === 'signature') {
        displayContent = 'Click to sign';
        displayColor = '#999';
      } else if (object.type === 'date') {
        displayContent = 'Date';
      } else if (object.type === 'timestamp') {
        displayContent = 'Time';
      } else {
        displayContent = `[${object.type}]`;
      }

      console.log(`🎨 Using placeholder color for ${object.type}:`, displayColor);
    }

    return (
      <div
        style={{
          fontSize: `${object.fontSize * scale}px`,
          lineHeight: 1,
          width: '100%',
          height: 'auto',
          textAlign: 'left',
          margin: 0,
          padding: 0,
          whiteSpace: 'pre-wrap', // Preserve newlines in display mode
          wordWrap: 'break-word',
          color: displayColor
        }}
      >
        {displayContent}
      </div>
    );
  };

  return (
    <div
      style={fieldStyle}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}  // NEW: Add touch support
      className={`editable-field field-${object.type} ${selected ? 'selected' : ''}`}
    >
      {renderContent()}

      {/* Resize handle - bottom right corner */}
      {selected && !editing && object.type !== 'checkbox' && (
        <div
          style={{
            position: 'absolute',
            bottom: '-4px',
            right: '-4px',
            width: '20px',
            height: '20px',
            cursor: 'se-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#60a5fa',
            borderRadius: '50%',
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();

            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = object.width;
            const startHeight = object.height;

            const handleMouseMove = (e) => {
              const deltaX = (e.clientX - startX) / scale;
              const deltaY = (e.clientY - startY) / scale;

              const newWidth = Math.max(30, startWidth + deltaX);
              const newHeight = Math.max(15, startHeight + deltaY);

              onUpdate(object.id, {
                width: newWidth,
                height: newHeight
              });
            };

            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        >
          {/* Resize icon - three diagonal dots */}
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ pointerEvents: 'none' }}>
            <circle cx="2" cy="8" r="1" fill="white" />
            <circle cx="5" cy="5" r="1" fill="white" />
            <circle cx="8" cy="2" r="1" fill="white" />
          </svg>
        </div>
      )}
    </div>
  );
}

/**
 * Signature Options Dialog
 */
function SignatureOptionsDialog({ isOpen, onClose, onUseExisting, onReplace, onCreateNew, hasExistingSignature }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '400px',
        width: '90%'
      }}>
        <h3>My Signature Options</h3>
        <p>What would you like to do?</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '20px 0' }}>
          {hasExistingSignature && (
            <button 
              onClick={onUseExisting}
              style={{
                padding: '12px 16px',
                backgroundColor: '#1e3a8a',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              ✍️ Use My Existing Signature
            </button>
          )}
          
          <button 
            onClick={onReplace}
            style={{
              padding: '12px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔄 {hasExistingSignature ? 'Replace My Signature' : 'Create My Signature'}
          </button>
          
          <button 
            onClick={onCreateNew}
            style={{
              padding: '12px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ➕ Create New Signature Field
          </button>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function SignatureDialog({ isOpen, onClose, onSave, signatureType }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      // Make background transparent instead of white
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000';
    }
  }, [isOpen]);

  const startDrawing = (e) => {
    setIsDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const saveSignature = () => {
    const dataURL = canvasRef.current.toDataURL('image/png');
    onSave(dataURL);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '500px',
        width: '90%'
      }}>
        <h3>{signatureType === 'my' ? 'Create My Signature' : 'Customer Signature'}</h3>
        {signatureType === 'my' && (
          <p style={{ fontSize: '14px', color: '#666', margin: '0 0 10px 0' }}>
            This signature will be saved for future use.
          </p>
        )}
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="signature-canvas"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          // Touch events for signature canvas - fixed scrolling interference
          onTouchStart={(e) => {
            if (!e.touches || e.touches.length === 0) return;
            e.preventDefault();
            e.stopPropagation(); // Prevent container drag-scroll
            const touch = e.touches[0];
            const rect = canvasRef.current.getBoundingClientRect();
            const mouseEvent = {
              clientX: touch.clientX,
              clientY: touch.clientY,
              target: e.target,
              preventDefault: () => e.preventDefault(),
              stopPropagation: () => e.stopPropagation()
            };
            startDrawing(mouseEvent);
          }}
          onTouchMove={(e) => {
            if (!e.touches || e.touches.length === 0) return;
            e.preventDefault();
            e.stopPropagation(); // Prevent container drag-scroll
            const touch = e.touches[0];
            const mouseEvent = {
              clientX: touch.clientX,
              clientY: touch.clientY,
              target: e.target,
              preventDefault: () => e.preventDefault(),
              stopPropagation: () => e.stopPropagation()
            };
            draw(mouseEvent);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent container drag-scroll
            stopDrawing();
          }}
        />
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Cancel</button>
          <button onClick={() => {
            const ctx = canvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }}>Clear</button>
          <button onClick={saveSignature}>Save</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Main PDFEditor Component - Touch Support Added
 */
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
    addTimestampObject,
    addCheckboxObject,
    updateObject,
    deleteObject,
    clearAllObjects,
    handleCanvasClick,
    isRendering
  } = usePDFEditor(pdf, job);

  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [showSignatureOptions, setShowSignatureOptions] = useState(false);
  const [signatureType, setSignatureType] = useState('customer'); // 'my' or 'customer'
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'saving', 'success', 'error'
  const [saveMessage, setSaveMessage] = useState('');
  const [mySignature, setMySignature] = useState(() => {
    // Load saved signature from localStorage
    return localStorage.getItem('mySignature') || null;
  });
  const [myName, setMyName] = useState(() => {
    // Load saved name from localStorage
    return localStorage.getItem('myName') || '';
  });

  // Drag scrolling state
  const [isDraggingContainer, setIsDraggingContainer] = useState(false);
  const containerRef = useRef(null);

  const currentObjects = objects.filter(obj => obj.page === currentPage);

  // Drag scrolling handlers
  const handleContainerMouseDown = (e) => {
    // Don't interfere with form field interactions
    const isFormField = e.target.closest('.editable-field');
    if (isFormField) return;

    // Don't interfere with signature canvas interactions
    const isSignatureCanvas = e.target.tagName === 'CANVAS' || e.target.closest('canvas');
    if (isSignatureCanvas) return;

    // Start drag scrolling
    e.preventDefault();
    setIsDraggingContainer(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startScrollLeft = containerRef.current.scrollLeft;
    const startScrollTop = containerRef.current.scrollTop;

    let hasMoved = false;

    const handleMouseMove = (e) => {
      const deltaX = startX - e.clientX;
      const deltaY = startY - e.clientY;
      
      // Check if we've moved enough to consider this a drag
      if (!hasMoved && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
        hasMoved = true;
      }
      
      if (hasMoved) {
        containerRef.current.scrollLeft = startScrollLeft + deltaX;
        containerRef.current.scrollTop = startScrollTop + deltaY;
      }
    };

    const handleMouseUp = () => {
      setIsDraggingContainer(false);
      
      // If we didn't move much, treat it as a click to deselect fields
      if (!hasMoved && (e.target === canvasRef.current || e.target.classList.contains('pdf-canvas'))) {
        handleCanvasClick();
      }
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove, { passive: false });
      document.removeEventListener('touchend', handleTouchEnd);
    };

    const handleTouchMove = (e) => {
      if (!e.touches || e.touches.length === 0) return;
      e.preventDefault();
      
      const deltaX = startX - e.touches[0].clientX;
      const deltaY = startY - e.touches[0].clientY;
      
      // Check if we've moved enough to consider this a drag
      if (!hasMoved && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
        hasMoved = true;
      }
      
      if (hasMoved) {
        containerRef.current.scrollLeft = startScrollLeft + deltaX;
        containerRef.current.scrollTop = startScrollTop + deltaY;
      }
    };

    const handleTouchEnd = (e) => {
      e.preventDefault();
      
      // If we didn't move much, treat it as a tap to deselect fields
      if (!hasMoved && (e.target === canvasRef.current || e.target.classList.contains('pdf-canvas'))) {
        handleCanvasClick();
      }
      
      handleMouseUp();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  const handleContainerTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    
    // Don't interfere with form field interactions
    const isFormField = e.target.closest('.editable-field');
    if (isFormField) return;
    
    // Don't interfere with signature canvas interactions
    const isSignatureCanvas = e.target.tagName === 'CANVAS' || e.target.closest('canvas');
    if (isSignatureCanvas) return;
    
    // Convert touch event to mouse-like event and handle it
    const touchEvent = {
      clientX: e.touches[0].clientX,
      clientY: e.touches[0].clientY,
      target: e.target,
      preventDefault: () => e.preventDefault()
    };
    handleContainerMouseDown(touchEvent);
  };

  const handleAddMySignature = () => {
    if (mySignature) {
      // Show options dialog
      setShowSignatureOptions(true);
    } else {
      // No saved signature, create one directly
      setSignatureType('my');
      addSignatureObject();
      setShowSignatureDialog(true);
    }
  };

  const handleUseExistingSignature = () => {
    addSignatureObject();
    setShowSignatureOptions(false);
    
    // Use the selectedId that was just set by addSignatureObject
    setTimeout(() => {
      if (mySignature) {
        // Get the most recently created signature object and update it
        setObjects(prev => {
          return prev.map(obj => {
            // Find the signature object that was just created (it will be selected)
            if (obj.type === 'signature' && obj.page === currentPage && !obj.content) {
              return { ...obj, content: mySignature };
            }
            return obj;
          });
        });
      }
    }, 10);
  };

  const handleReplaceSignature = () => {
    setSignatureType('my');
    addSignatureObject();
    setShowSignatureDialog(true);
    setShowSignatureOptions(false);
  };

  const handleCreateNewSignatureField = () => {
    addSignatureObject();
    setSignatureType('customer');
    setShowSignatureDialog(true);
    setShowSignatureOptions(false);
  };

  const handleAddCustomerSignature = () => {
    setSignatureType('customer');
    addSignatureObject();
    setShowSignatureDialog(true);
  };

  const handleAddMyName = () => {
    if (myName) {
      // Measure the name text + right padding
      const fontSize = 11;
      const rightPadding = 20;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      context.font = `${fontSize}px Arial, sans-serif`;
      const metrics = context.measureText(myName);
      const textWidth = metrics.width;

      const width = textWidth + rightPadding;
      const height = fontSize;

      const center = canvasRef.current ? {
        x: canvasRef.current.width / 2 / scale - width / 2,
        y: canvasRef.current.height / 2 / scale - height / 2
      } : { x: 200, y: 150 };

      const id = `text_${Date.now()}`;
      const nameField = {
        id,
        type: 'text',
        x: center.x,
        y: center.y,
        width,
        height,
        content: myName,
        fontSize: 11,
        color: '#1e3a8a',
        page: currentPage
      };

      setObjects(prev => [...prev, nameField]);
      setSelectedId(id);
    } else {
      // No saved name, prompt to enter it
      const name = prompt('Enter your name to save for future use:');
      if (name) {
        setMyName(name);
        localStorage.setItem('myName', name);

        // Measure the name text + right padding
        const fontSize = 11;
        const rightPadding = 20;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${fontSize}px Arial, sans-serif`;
        const metrics = context.measureText(name);
        const textWidth = metrics.width;

        const width = textWidth + rightPadding;
        const height = fontSize;

        const center = canvasRef.current ? {
          x: canvasRef.current.width / 2 / scale - width / 2,
          y: canvasRef.current.height / 2 / scale - height / 2
        } : { x: 200, y: 150 };

        const id = `text_${Date.now()}`;
        const nameField = {
          id,
          type: 'text',
          x: center.x,
          y: center.y,
          width,
          height,
          content: name,
          fontSize: 11,
          color: '#1e3a8a',
          page: currentPage
        };

        setObjects(prev => [...prev, nameField]);
        setSelectedId(id);
      }
    }
  };

  const handleSignatureSave = (signatureDataURL) => {
    if (selectedId) {
      updateObject(selectedId, { content: signatureDataURL });
    }
    
    // Save "My Signature" to localStorage
    if (signatureType === 'my') {
      setMySignature(signatureDataURL);
      localStorage.setItem('mySignature', signatureDataURL);
    }
    // Customer signatures are not saved
    
    setShowSignatureDialog(false);
    setSignatureType('customer');
  };

  const handleSave = async () => {
    if (objects.length === 0) {
      setSaveStatus('error');
      setSaveMessage('Please add some fields to the form first');
      setTimeout(() => setSaveStatus(null), 2000);
      return;
    }

    setIsSaving(true);
    setSaveStatus('saving');
    setSaveMessage('Saving draft...');

    try {
      // 🔍 TEMP DEBUG: Log all objects before saving
      console.log('🔍 ===== SAVE OPERATION STARTED =====');
      console.log('🔍 Total objects to save:', objects.length);

      objects.forEach(obj => {
        console.log(`🔍 FRONTEND SENDING ${obj.type.toUpperCase()}:`, {
          id: obj.id,
          position: { x: obj.x, y: obj.y },
          dimensions: { width: obj.width, height: obj.height },
          content: obj.content,
          fontSize: obj.fontSize,
          color: obj.color,
          page: obj.page,
          type: obj.type
        });
      });

      const saveData = {
        objects: objects,
        fileName: `${pdf.name || 'document'}_filled.pdf`,
        attachmentId: pdf.serviceTitanId || pdf.id,
        jobId: job.id
      };

      console.log('🔍 Save data prepared:', {
        objectCount: saveData.objects.length,
        fileName: saveData.fileName,
        attachmentId: saveData.attachmentId,
        jobId: saveData.jobId
      });

      const result = await onSave(saveData);

      if (result?.success) {
        setSaveStatus('success');
        setSaveMessage('Draft saved successfully!');
        // Close after brief success message
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        setSaveStatus('error');
        setSaveMessage('Save completed but there may have been issues');
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch (error) {
      console.error('Save failed:', error);
      setSaveStatus('error');
      setSaveMessage(`Save failed: ${error.message}`);
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, deleteObject, setSelectedId, setEditingId]);

  if (pdfError) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h3>Failed to Load PDF</h3>
        <p>{pdfError}</p>
        <button onClick={onClose}>← Back to Attachments</button>
      </div>
    );
  }

  if (!pdfLoaded) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading PDF...</div>
        {pdf.googleDriveFileId && <p>Loading draft from Google Drive...</p>}
      </div>
    );
  }

  return (
    <div className="pdf-editor-container">
      {/* Centered Toolbar */}
      <div className="pdf-editor-toolbar">
        <div className="toolbar-content">
          {pdf.googleDriveFileId && (
            <span style={{ 
              backgroundColor: '#1e3a8a', 
              color: 'white', 
              padding: '4px 8px', 
              borderRadius: '4px', 
              fontSize: '12px',
              marginRight: '10px'
            }}>
              📝 Editing Draft
            </span>
          )}
          
          <button className="pdf-btn form-element" onClick={addTextObject}>📝 Text</button>
          <button className="pdf-btn form-element" onClick={handleAddMySignature}>
            ✍️ {mySignature ? 'My Signature' : 'Create My Signature'}
          </button>
          <button className="pdf-btn form-element" onClick={handleAddCustomerSignature}>✍️ Customer Signature</button>
          <button className="pdf-btn form-element" onClick={handleAddMyName}>
            👤 {myName ? `My Name (${myName})` : 'Set My Name'}
          </button>
          <button className="pdf-btn form-element" onClick={addDateObject}>📅 Date</button>
          <button className="pdf-btn form-element" onClick={addTimestampObject}>🕐 Timestamp</button>
          <button className="pdf-btn form-element" onClick={addCheckboxObject}>☑️ Checkbox</button>
          
          <div className="toolbar-controls">
            <button 
              className="pdf-btn navigation"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              ← Prev
            </button>
            <span className="page-info">Page {currentPage} of {totalPages}</span>
            <button 
              className="pdf-btn navigation"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
            >
              Next →
            </button>
            
            <select 
              className="scale-select"
              value={scale} 
              onChange={(e) => setScale(Number(e.target.value))}
            >
              <option value={0.5}>50%</option>
              <option value={0.75}>75%</option>
              <option value={1.0}>100%</option>
              <option value={1.2}>120%</option>
              <option value={1.5}>150%</option>
            </select>
            
            <button 
              className="pdf-btn action" 
              onClick={() => deleteObject(selectedId)} 
              disabled={!selectedId}
              title="Delete selected element"
            >
              🗑️ Delete
            </button>
            <button className="pdf-btn action" onClick={clearAllObjects} disabled={objects.length === 0}>
              🗑️ Clear All
            </button>
            <button className="pdf-btn save" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving Draft...' : '💾 Save as Draft'}
            </button>
            <button className="pdf-btn navigation" onClick={onClose}>← Back</button>
          </div>
        </div>
      </div>

      {/* Centered PDF Canvas Container */}
      <div 
        ref={containerRef}
        className={`pdf-canvas-container ${isDraggingContainer ? 'dragging' : ''}`}
        onMouseDown={handleContainerMouseDown}
        onTouchStart={handleContainerTouchStart}
      >
        {/* Scroll Hint Label */}
        <div className="scroll-hint">
          📄 Drag to scroll
        </div>
        <div className="pdf-canvas-wrapper">
          <canvas
            ref={canvasRef}
            className="pdf-canvas"
            style={{ 
              opacity: isRendering ? 0.7 : 1,
              transition: 'opacity 0.2s ease'
            }}
          />
          
          {/* Render fields - positions remain relative to canvas */}
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

      {/* Signature Options Dialog */}
      <SignatureOptionsDialog
        isOpen={showSignatureOptions}
        onClose={() => setShowSignatureOptions(false)}
        onUseExisting={handleUseExistingSignature}
        onReplace={handleReplaceSignature}
        onCreateNew={handleCreateNewSignatureField}
        hasExistingSignature={!!mySignature}
      />

      {/* Signature Dialog */}
      <SignatureDialog
        isOpen={showSignatureDialog}
        onClose={() => setShowSignatureDialog(false)}
        onSave={handleSignatureSave}
        signatureType={signatureType}
      />

      {/* Save Status Overlay */}
      {saveStatus && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem 3rem',
            borderRadius: '12px',
            textAlign: 'center',
            minWidth: '300px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          }}>
            {saveStatus === 'saving' && (
              <>
                <div style={{
                  width: '50px',
                  height: '50px',
                  border: '4px solid #f3f3f3',
                  borderTop: '4px solid #0052cc',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 1rem',
                }}></div>
                <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#333' }}>
                  {saveMessage}
                </div>
              </>
            )}
            {saveStatus === 'success' && (
              <>
                <div style={{
                  fontSize: '3rem',
                  color: '#10b981',
                  marginBottom: '0.5rem',
                }}>✓</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#333' }}>
                  {saveMessage}
                </div>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <div style={{
                  fontSize: '3rem',
                  color: '#ef4444',
                  marginBottom: '0.5rem',
                }}>✕</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#333' }}>
                  {saveMessage}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}