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
      pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
      
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
    
    // Simple default sizes
    const fieldConfigs = {
      text: { width: 200, height: 30, fontSize: 11 },
      signature: { width: 180, height: 35, fontSize: 12 }, // Reduced width from 250 to 180
      date: { width: 120, height: 30, fontSize: 11 },
      timestamp: { width: 150, height: 30, fontSize: 11 },
      checkbox: { width: 30, height: 30, fontSize: 18 }
    };
    
    const config = fieldConfigs[type] || fieldConfigs.text;
    
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
      content = true; // Default to checked (true) instead of unchecked (false)
    }
    
    const newField = {
      id,
      type,
      x: center.x - config.width / 2 / scale, // Center horizontally
      y: center.y - config.height / 2 / scale, // Center vertically
      width: config.width / scale,
      height: config.height / scale,
      content,
      fontSize: config.fontSize,
      color: '#1e3a8a', // Royal blue color
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
    fontSize: `${object.fontSize}px`, // Fixed font size, not scaled
    color: object.color,
    border: editing ? '2px solid #1e3a8a' : 'none',
    background: 'transparent',
    cursor: isDragging ? 'grabbing' : editing ? 'text' : 'grab',
    zIndex: selected ? 1000 : 100,
    borderRadius: '4px',
    padding: '4px',
    boxSizing: 'border-box',
    userSelect: editing ? 'text' : 'none',
    fontFamily: 'Arial, sans-serif',
    lineHeight: '1.2',
    // Smooth transitions when not dragging
    transition: isDragging ? 'none' : 'left 0.1s ease-out, top 0.1s ease-out',
    // Force hardware acceleration for smoother performance
    transform: 'translateZ(0)',
    willChange: isDragging ? 'transform' : 'auto'
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    onSelect(object.id);
    
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
      onUpdate(object.id, { content: newValue });
    }
  };

  const renderContent = () => {
    if (object.type === 'checkbox') {
      return (
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            fontWeight: 'bold',
            fontSize: `${Math.max(16, object.fontSize)}px`,
            color: '#1e3a8a' // Always blue since always checked
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
      return object.type === 'text' ? (
        <input
          type="text"
          value={value}
          onChange={handleContentChange}
          onBlur={onFinishEdit}
          autoFocus
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: `${object.fontSize}px`,
            color: 'inherit',
            fontFamily: 'Arial, sans-serif',
            padding: '0',
            margin: '0'
          }}
        />
      ) : (
        <input
          type={object.type === 'date' ? 'date' : 'text'}
          value={value}
          onChange={handleContentChange}
          onBlur={onFinishEdit}
          autoFocus
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: `${object.fontSize}px`,
            color: 'inherit',
            fontFamily: 'Arial, sans-serif',
            padding: '0',
            margin: '0'
          }}
        />
      );
    }
    
    return (
      <div style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-start',
        fontSize: `${object.fontSize}px`,
        fontFamily: 'Arial, sans-serif',
        lineHeight: '1.2',
        wordWrap: 'break-word',
        whiteSpace: 'pre-wrap',
        padding: '0'
      }}>
        {object.type === 'signature' && !object.content ? (
          <span style={{ color: '#999', fontSize: '0.8em' }}>Click to sign</span>
        ) : (
          value || `[${object.type}]`
        )}
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
      
      {selected && !editing && (
        <div
          style={{
            position: 'absolute',
            bottom: '-6px',
            right: '-6px',
            width: '12px',
            height: '12px',
            background: '#1e3a8a',
            border: '2px solid white',
            borderRadius: '50%',
            cursor: 'se-resize'
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
              const newHeight = Math.max(20, startHeight + deltaY);
              
              onUpdate(object.id, {
                width: newWidth,
                height: newHeight
              });
            };
            
            const handleMouseUp = () => {
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
              handleMouseUp();
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
          }}
          onTouchStart={(e) => {  // NEW: Touch support for resize handle
            e.stopPropagation();
            e.preventDefault();
            
            const startX = e.touches[0].clientX;
            const startY = e.touches[0].clientY;
            const startWidth = object.width;
            const startHeight = object.height;
            
            const handleTouchMove = (e) => {
              e.preventDefault();
              if (e.touches && e.touches.length > 0) {
                const deltaX = (e.touches[0].clientX - startX) / scale;
                const deltaY = (e.touches[0].clientY - startY) / scale;
                
                const newWidth = Math.max(30, startWidth + deltaX);
                const newHeight = Math.max(20, startHeight + deltaY);
                
                onUpdate(object.id, {
                  width: newWidth,
                  height: newHeight
                });
              }
            };
            
            const handleTouchEnd = (e) => {
              e.preventDefault();
              document.removeEventListener('touchmove', handleTouchMove);
              document.removeEventListener('touchend', handleTouchEnd);
            };
            
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
          }}
        />
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
          style={{ 
            border: '1px solid #ccc', 
            display: 'block', 
            margin: '10px 0',
            background: 'transparent'
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          // Touch events for signature canvas - improved handling
          onTouchStart={(e) => {
            if (!e.touches || e.touches.length === 0) return;
            e.preventDefault();
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
    // Only start drag scrolling if clicking on the container itself (not on fields or canvas)
    if (e.target === containerRef.current || e.target.closest('.pdf-canvas-wrapper')) {
      setIsDraggingContainer(true);
      const startX = e.clientX;
      const startY = e.clientY;
      const startScrollLeft = containerRef.current.scrollLeft;
      const startScrollTop = containerRef.current.scrollTop;

      const handleMouseMove = (e) => {
        if (!isDraggingContainer) return;
        
        const deltaX = startX - e.clientX;
        const deltaY = startY - e.clientY;
        
        containerRef.current.scrollLeft = startScrollLeft + deltaX;
        containerRef.current.scrollTop = startScrollTop + deltaY;
      };

      const handleMouseUp = () => {
        setIsDraggingContainer(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove, { passive: false });
        document.removeEventListener('touchend', handleTouchEnd);
      };

      const handleTouchMove = (e) => {
        if (!isDraggingContainer || !e.touches || e.touches.length === 0) return;
        e.preventDefault();
        
        const deltaX = startX - e.touches[0].clientX;
        const deltaY = startY - e.touches[0].clientY;
        
        containerRef.current.scrollLeft = startScrollLeft + deltaX;
        containerRef.current.scrollTop = startScrollTop + deltaY;
      };

      const handleTouchEnd = (e) => {
        e.preventDefault();
        handleMouseUp();
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }
  };

  const handleContainerTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    
    // Only start drag scrolling if touching the container itself (not on fields or canvas)
    if (e.target === containerRef.current || e.target.closest('.pdf-canvas-wrapper')) {
      e.preventDefault();
      const touchEvent = {
        clientX: e.touches[0].clientX,
        clientY: e.touches[0].clientY,
        target: e.target
      };
      handleContainerMouseDown(touchEvent);
    }
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
      // Use saved name
      const center = canvasRef.current ? {
        x: canvasRef.current.width / 2 / scale - 100,
        y: canvasRef.current.height / 2 / scale - 15
      } : { x: 200, y: 150 };
      
      const id = `text_${Date.now()}`;
      const nameField = {
        id,
        type: 'text',
        x: center.x,
        y: center.y,
        width: 200 / scale,
        height: 30 / scale,
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
        
        // Add the name field
        const center = canvasRef.current ? {
          x: canvasRef.current.width / 2 / scale - 100,
          y: canvasRef.current.height / 2 / scale - 15
        } : { x: 200, y: 150 };
        
        const id = `text_${Date.now()}`;
        const nameField = {
          id,
          type: 'text',
          x: center.x,
          y: center.y,
          width: 200 / scale,
          height: 30 / scale,
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
      alert('Please add some fields to the form first.');
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Debug: Log checkbox objects before saving
      const checkboxes = objects.filter(obj => obj.type === 'checkbox');
      console.log('📊 Checkbox objects before save:', checkboxes);
      checkboxes.forEach(cb => {
        console.log(`Checkbox ${cb.id}: content=${cb.content} (${typeof cb.content})`);
      });
      
      const saveData = {
        objects: objects,
        fileName: `${pdf.name || 'document'}_filled.pdf`,
        attachmentId: pdf.serviceTitanId || pdf.id,
        jobId: job.id
      };
      
      const result = await onSave(saveData);
      
      if (result?.success) {
        alert('PDF saved as draft successfully!');
        onClose();
      } else {
        alert('Draft save completed but there may have been issues.');
      }
    } catch (error) {
      console.error('Save failed:', error);
      alert(`Draft save failed: ${error.message}`);
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
            
            <button className="pdf-btn action" onClick={clearAllObjects} disabled={objects.length === 0}>
              🗑️ Clear
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
        <div className="pdf-canvas-wrapper">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onTouchStart={(e) => {  // Touch support for canvas
              if (!e.touches || e.touches.length === 0) return;
              e.preventDefault();
              e.stopPropagation();
              handleCanvasClick();
            }}
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
    </div>
  );
}