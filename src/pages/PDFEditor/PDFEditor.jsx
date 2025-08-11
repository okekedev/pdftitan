/**
 * PDFEditor.jsx - Fixed Version with No Infinite Loops
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import './PDFEditor.css';

/**
 * Fixed PDF Editor Hook - No infinite re-renders
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
   * Load PDF document - NOT wrapped in useCallback
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
      
      if (pdf.dataUrl && pdf.dataUrl.startsWith('data:')) {
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
      signature: { width: 250, height: 40, fontSize: 12 },
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
      content = false;
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
 * Simplified EditableField - No useCallback here either
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
    
    // Get the field element for direct manipulation
    const fieldElement = e.currentTarget;
    
    // Disable transitions during drag for immediate response
    fieldElement.style.transition = 'none';
    
    // Store current mouse position for smooth updates
    let currentMouseX = startX;
    let currentMouseY = startY;
    let animationId;
    let finalX = startObjX;
    let finalY = startObjY;
    
    const updatePosition = () => {
      const deltaX = (currentMouseX - startX) / scale;
      const deltaY = (currentMouseY - startY) / scale;
      
      finalX = Math.max(0, startObjX + deltaX);
      finalY = Math.max(0, startObjY + deltaY);
      
      // Use transform for hardware-accelerated movement
      fieldElement.style.transform = `translate(${(finalX - object.x) * scale}px, ${(finalY - object.y) * scale}px) translateZ(0)`;
    };
    
    const handleMouseMove = (e) => {
      currentMouseX = e.clientX;
      currentMouseY = e.clientY;
      
      // Cancel previous animation frame
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      
      // Schedule smooth update on next frame
      animationId = requestAnimationFrame(updatePosition);
    };
    
    const handleMouseUp = (e) => {
      setIsDragging(false);
      
      // Cancel any pending animation
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      
      // Calculate final position one more time to be sure
      const deltaX = (e.clientX - startX) / scale;
      const deltaY = (e.clientY - startY) / scale;
      finalX = Math.max(0, startObjX + deltaX);
      finalY = Math.max(0, startObjY + deltaY);
      
      // Update React state first, THEN reset transform
      onUpdate(object.id, {
        x: finalX,
        y: finalY
      });
      
      // Use a small delay to ensure React has updated before clearing transform
      requestAnimationFrame(() => {
        fieldElement.style.transform = '';
        fieldElement.style.transition = '';
      });
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleContentChange = (e) => {
    const newValue = object.type === 'checkbox' ? !value : e.target.value;
    setValue(newValue);
    onUpdate(object.id, { content: newValue });
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
            cursor: 'pointer',
            fontSize: `${Math.max(16, object.fontSize)}px`,
            color: value ? '#1e3a8a' : '#9ca3af' // Royal blue when checked, gray when unchecked
          }}
          onClick={handleContentChange}
        >
          ✓
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
        <textarea
          value={value}
          onChange={handleContentChange}
          onBlur={onFinishEdit}
          autoFocus
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            background: 'transparent',
            resize: 'none',
            outline: 'none',
            fontSize: `${object.fontSize}px`,
            color: 'inherit',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.2',
            padding: '0',
            margin: '0',
            wordWrap: 'break-word',
            whiteSpace: 'pre-wrap'
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
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        />
      )}
    </div>
  );
}

/**
 * Simple Signature Dialog
 */
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
 * Main PDFEditor Component - Fixed
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

  const currentObjects = objects.filter(obj => obj.page === currentPage);

  const handleAddMySignature = () => {
    if (mySignature) {
      // Use saved signature
      addSignatureObject();
      setTimeout(() => {
        if (selectedId) {
          updateObject(selectedId, { content: mySignature });
        }
      }, 100);
    } else {
      // No saved signature, open dialog to create one
      setSignatureType('my');
      addSignatureObject();
      setShowSignatureDialog(true);
    }
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
      const saveData = {
        objects: objects,
        fileName: `${pdf.name || 'document'}_filled.pdf`,
        attachmentId: pdf.serviceTitanId || pdf.id,
        jobId: job.id
      };
      
      const result = await onSave(saveData);
      
      if (result?.success) {
        alert('PDF saved successfully!');
        onClose();
      } else {
        alert('Save completed but there may have been issues.');
      }
    } catch (error) {
      console.error('Save failed:', error);
      alert(`Save failed: ${error.message}`);
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
      </div>
    );
  }

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      background: '#f5f5f5'
    }}>
      {/* Simple Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 20px',
        background: 'white',
        borderBottom: '1px solid #ddd',
        gap: '10px',
        flexWrap: 'wrap'
      }}>
        <button onClick={addTextObject}>📝 Text</button>
        <button onClick={handleAddMySignature}>
          ✍️ {mySignature ? 'My Signature' : 'Create My Signature'}
        </button>
        <button onClick={handleAddCustomerSignature}>✍️ Customer Signature</button>
        <button onClick={handleAddMyName}>
          👤 {myName ? `My Name (${myName})` : 'Set My Name'}
        </button>
        <button onClick={addDateObject}>📅 Date</button>
        <button onClick={addTimestampObject}>🕐 Timestamp</button>
        <button onClick={addCheckboxObject}>☑️ Checkbox</button>
        
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            ← Prev
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button 
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
          >
            Next →
          </button>
          
          <select 
            value={scale} 
            onChange={(e) => setScale(Number(e.target.value))}
          >
            <option value={0.5}>50%</option>
            <option value={0.75}>75%</option>
            <option value={1.0}>100%</option>
            <option value={1.2}>120%</option>
            <option value={1.5}>150%</option>
          </select>
          
          <button onClick={clearAllObjects} disabled={objects.length === 0}>
            🗑️ Clear
          </button>
          <button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : '💾 Save'}
          </button>
          <button onClick={onClose}>← Back</button>
        </div>
      </div>

      {/* PDF Canvas Container */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '20px',
        position: 'relative'
      }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            style={{
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              display: 'block'
            }}
          />
          
          {/* Render fields */}
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