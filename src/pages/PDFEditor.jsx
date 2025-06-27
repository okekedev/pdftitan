// Enhanced PDF Editor with fixed canvas rendering
import React, { useState, useRef, useEffect, useCallback } from 'react';

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
  const [isRendering, setIsRendering] = useState(false); // ✅ NEW: Track rendering state

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

      // Simulate download URL - replace with actual API call
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

  // ✅ FIXED: Page Rendering with proper canvas management
  const renderPage = useCallback(async () => {
    if (!pdfDocument || !canvasRef.current || isRendering) {
      console.log('⏭️ Skipping render - not ready or already rendering');
      return;
    }
    
    try {
      setIsRendering(true); // ✅ Set rendering flag
      
      const page = await pdfDocument.getPage(currentPage);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      const viewport = page.getViewport({ scale });
      
      // ✅ Clear any existing content
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // ✅ Create render context with cleanup
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      // ✅ Wait for render to complete before allowing new renders
      await page.render(renderContext).promise;
      
      console.log(`✅ Page ${currentPage} rendered successfully`);
      
    } catch (error) {
      console.error('❌ Page rendering error:', error);
      // Don't throw here, just log the error
    } finally {
      setIsRendering(false); // ✅ Clear rendering flag
    }
  }, [pdfDocument, currentPage, scale, isRendering]);

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

  const updateObject = useCallback((id, updates) => {
    setObjects(prev => prev.map(obj => obj.id === id ? { ...obj, ...updates } : obj));
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

  // ✅ FIXED: Load PDF only once on mount
  useEffect(() => {
    let isMounted = true;
    
    const initializePDF = async () => {
      if (isMounted) {
        await loadPDF();
      }
    };
    
    initializePDF();
    
    return () => {
      isMounted = false;
    };
  }, [loadPDF]);

  // ✅ FIXED: Render page with proper dependencies and cleanup
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
  }, [pdfDocument, currentPage, scale]); // Removed renderPage and isRendering from deps to avoid loops

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
    isRendering // ✅ Expose rendering state
  };
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

// Enhanced Editable Field Component with drag, resize, and multi-line text support
function EditableField({ object, scale, selected, editing, onUpdate, onSelect, onStartEdit, onFinishEdit }) {
  const [value, setValue] = useState(object.content || '');
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [lastClickTime, setLastClickTime] = useState(0);
  
  useEffect(() => {
    setValue(object.content || '');
  }, [object.content]);

  // Calculate proper height for multi-line text
  const calculateTextHeight = () => {
    const lineHeight = Math.max(16, object.fontSize * scale * 1.2);
    const lines = (object.content || '').split('\n').length;
    const textLines = Math.max(1, Math.ceil((object.content || '').length / 25)); // Rough wrap estimation
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

  // Handle mouse down for dragging
  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (editing) return;
    
    // Get coordinates for resize handle check
    const fieldRect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - fieldRect.left;
    const offsetY = e.clientY - fieldRect.top;
    
    // Check if clicking on resize handle (only if already selected)
    if (selected && offsetX > fieldRect.width - 15 && offsetY > fieldRect.height - 15) {
      setIsResizing(true);
      setResizeHandle('se');
      return;
    }
    
    // If not selected, just select it
    if (!selected) {
      onSelect(object.id);
      return;
    }
    
    // If already selected, start drag preparation
    const canvasWrapper = e.target.closest('.pdf-wrapper');
    if (!canvasWrapper) return;
    
    // Store the mouse position and field position at the start
    const initialMouseX = e.clientX;
    const initialMouseY = e.clientY;
    const initialFieldX = object.x;
    const initialFieldY = object.y;
    
    // Set up drag detection with a small delay
    let dragStarted = false;
    let startTime = Date.now();
    
    const handleMouseMove = (e) => {
      // Start dragging after 150ms or if mouse moved significantly
      const timePassed = Date.now() - startTime;
      const mouseMoved = Math.abs(e.clientX - (fieldRect.left + offsetX)) > 3 || 
                        Math.abs(e.clientY - (fieldRect.top + offsetY)) > 3;
      
      if (!dragStarted && (timePassed > 150 || mouseMoved)) {
        dragStarted = true;
        setIsDragging(true);
      }
      
      if (dragStarted) {
        const currentCanvasRect = canvasWrapper.getBoundingClientRect();
        
        // Calculate how much the mouse has moved since drag started
        const deltaX = e.clientX - initialMouseX;
        const deltaY = e.clientY - initialMouseY;
        
        // Apply that movement to the field's initial position
        const newX = Math.max(0, initialFieldX + (deltaX / scale));
        const newY = Math.max(0, initialFieldY + (deltaY / scale));
        
        onUpdate(object.id, { x: newX, y: newY });
      }
    };
    
    const handleMouseUp = () => {
      // If we didn't drag and this was a quick click, check for double-click
      if (!dragStarted && object.type === 'text') {
        const currentTime = Date.now();
        const timeDiff = currentTime - lastClickTime;
        
        if (timeDiff < 300) {
          // Double-click detected
          onStartEdit(object.id);
        }
        setLastClickTime(currentTime);
      }
      
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle touch events
  const handleTouchStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (editing) return;
    
    const touch = e.touches[0];
    const fieldRect = e.currentTarget.getBoundingClientRect();
    const offsetX = touch.clientX - fieldRect.left;
    const offsetY = touch.clientY - fieldRect.top;
    
    // If not selected, just select it
    if (!selected) {
      onSelect(object.id);
      return;
    }
    
    // If already selected, prepare for drag
    const canvasWrapper = e.target.closest('.pdf-wrapper');
    if (!canvasWrapper) return;
    
    // Store the touch position and field position at the start
    const initialTouchX = touch.clientX;
    const initialTouchY = touch.clientY;
    const initialFieldX = object.x;
    const initialFieldY = object.y;
    
    // For touch, start dragging after a short delay
    let dragStarted = false;
    const startTime = Date.now();
    
    const handleTouchMove = (e) => {
      if (!dragStarted) {
        const timePassed = Date.now() - startTime;
        if (timePassed > 200) { // 200ms delay for touch
          dragStarted = true;
          setIsDragging(true);
        }
      }
      
      if (dragStarted && e.touches[0]) {
        e.preventDefault();
        const touch = e.touches[0];
        
        // Calculate how much the touch has moved since drag started
        const deltaX = touch.clientX - initialTouchX;
        const deltaY = touch.clientY - initialTouchY;
        
        // Apply that movement to the field's initial position
        const newX = Math.max(0, initialFieldX + (deltaX / scale));
        const newY = Math.max(0, initialFieldY + (deltaY / scale));
        
        onUpdate(object.id, { x: newX, y: newY });
      }
    };
    
    const handleTouchEnd = (e) => {
      // Check for double-tap on text elements
      if (!dragStarted && object.type === 'text') {
        const currentTime = Date.now();
        const timeDiff = currentTime - lastClickTime;
        
        if (timeDiff < 300) {
          onStartEdit(object.id);
        }
        setLastClickTime(currentTime);
      }
      
      setIsDragging(false);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    setIsDragging(false);
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
        {/* Main field area */}
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            cursor: editing ? 'text' : 'move'
          }}
        >
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
        
        {/* Resize handle */}
        {selected && !editing && (
          <div
            style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              width: '12px',
              height: '12px',
              background: '#007bff',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'se-resize',
              zIndex: 1001,
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsResizing(true);
              setResizeHandle('se');
              
              // Get proper coordinates for resize
              const canvasWrapper = e.target.closest('.pdf-wrapper');
              if (!canvasWrapper) return;
              
              const canvasRect = canvasWrapper.getBoundingClientRect();
              
              const handleMouseMove = (e) => {
                // Calculate new size based on mouse position relative to field's top-left
                const fieldLeft = object.x * scale + canvasRect.left;
                const fieldTop = object.y * scale + canvasRect.top;
                
                const newWidth = Math.max(60, (e.clientX - fieldLeft) / scale);
                const newHeight = Math.max(25, (e.clientY - fieldTop) / scale);
                onUpdate(object.id, { width: newWidth, height: newHeight });
              };
              
              const handleMouseUp = () => {
                setIsResizing(false);
                setResizeHandle(null);
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
        onTouchStart={handleTouchStart}
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
        
        {/* Resize handle for signatures too */}
        {selected && (
          <div
            style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              width: '12px',
              height: '12px',
              background: '#28a745',
              border: '2px solid white',
              borderRadius: '50%',
              cursor: 'se-resize',
              zIndex: 1001,
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsResizing(true);
              
              // Get proper coordinates for resize
              const canvasWrapper = e.target.closest('.pdf-wrapper');
              if (!canvasWrapper) return;
              
              const canvasRect = canvasWrapper.getBoundingClientRect();
              
              const handleMouseMove = (e) => {
                // Calculate new size based on mouse position relative to field's top-left
                const fieldLeft = object.x * scale + canvasRect.left;
                const fieldTop = object.y * scale + canvasRect.top;
                
                const newWidth = Math.max(60, (e.clientX - fieldLeft) / scale);
                const newHeight = Math.max(25, (e.clientY - fieldTop) / scale);
                onUpdate(object.id, { width: newWidth, height: newHeight });
              };
              
              const handleMouseUp = () => {
                setIsResizing(false);
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

  return null;
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
  }, [isRendering]);

  const handleAddTextBox = () => {
    addTextObject(100, 100);
  };

  const handleAddSignature = () => {
    addSignatureObject(100, 100);
    setShowSignatureDialog(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // ✅ REMOVE FOLDER PATH and clean up filename
      const originalName = pdf.fileName || pdf.name || 'Document';
      let cleanName = originalName.replace(/\.pdf$/i, ''); // Remove .pdf extension
      
      // Remove folder path prefix (e.g., "Attaches/" from "Attaches/S2502270659@@3-...")
      if (cleanName.includes('/')) {
        cleanName = cleanName.split('/').pop(); // Get everything after the last slash
      }
      
      // Remove everything after @@X pattern (e.g., remove "-_Gy1Go5m29TYQ~I8RbKS" from "S2502270659@@3-_Gy1Go5m29TYQ~I8RbKS")
      cleanName = cleanName.replace(/@@\d+.*$/, match => {
        // Keep just the @@X part, remove everything after it
        const atMatch = match.match(/@@\d+/);
        return atMatch ? atMatch[0] : '';
      });
      
      const completedFileName = `Completed - ${cleanName}.pdf`;
      
      const saveData = {
        pdfId: pdf.id,
        serviceTitanId: pdf.serviceTitanId || pdf.id,
        originalFileName: originalName,
        completedFileName: completedFileName,
        editableElements: objects,
        jobInfo: {
          jobId: job.id,
          jobNumber: job.number,
          jobTitle: job.title
        },
        savedAt: new Date().toISOString()
      };
      
      console.log('💾 Saving completed form as:', completedFileName);
      const result = await onSave(saveData);
      
      // ✅ Show custom UI popup instead of browser alert
      if (result && result.success) {
        setSuccessMessage(`PDF form has been completed and uploaded to ServiceTitan successfully!\n\nSaved as: ${result.fileName}`);
        setShowSuccessPopup(true);
      } else {
        setSuccessMessage(`Failed to upload PDF form to ServiceTitan. Please try again or contact support.`);
        setShowSuccessPopup(true);
      }
      
    } catch (error) {
      console.error('❌ Save error:', error);
      setSuccessMessage(`Failed to save PDF form: ${error.message}\n\nPlease try again.`);
      setShowSuccessPopup(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignatureSave = (signatureData) => {
    if (selectedId) {
      updateObject(selectedId, { content: signatureData });
    }
  };

  const getCompletionStatus = () => {
    const total = objects.length;
    const filled = objects.filter(obj => obj.content && obj.content.trim() !== '').length;
    return { total, filled, percentage: total > 0 ? Math.round((filled / total) * 100) : 0 };
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

  return (
    <div className="pdf-editor-simple">
      {/* Header */}
      <div className="editor-header">
        <div className="header-left">
          <button onClick={onClose} className="btn btn-secondary">
            ← Back
          </button>
          <div className="pdf-info">
            <h2>{pdf.fileName || pdf.name}</h2>
            <p>Job #{job.number}</p>
          </div>
        </div>
        
        <div className="header-right">
          <div className="completion-status">
            <span>Progress: {completion.filled}/{completion.total} fields ({completion.percentage}%)</span>
          </div>
          <button 
            onClick={handleSave}
            disabled={isSaving || isRendering} // ✅ Disable if rendering
            className="btn btn-success btn-lg"
          >
            {isSaving ? '💾 Saving...' : '💾 Save Completed Form'}
          </button>
        </div>
      </div>

      {/* Simple Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <button 
            onClick={handleAddTextBox}
            className="btn btn-primary"
            disabled={isRendering} // ✅ Disable if rendering
          >
            📝 Add Text Box
          </button>
          <button 
            onClick={handleAddSignature}
            className="btn btn-primary"
            disabled={isRendering} // ✅ Disable if rendering
          >
            ✍️ Add Signature
          </button>
          {selectedId && (
            <button
              onClick={() => deleteObject(selectedId)}
              className="btn btn-error"
              disabled={isRendering} // ✅ Disable if rendering
            >
              🗑️ Delete Selected
            </button>
          )}
          {objects.length > 0 && (
            <button
              onClick={clearAllObjects}
              className="btn btn-warning"
              disabled={isRendering} // ✅ Disable if rendering
            >
              🧹 Clear All
            </button>
          )}
        </div>

        <div className="toolbar-center">
          {totalPages > 1 && (
            <div className="page-controls">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage <= 1 || isRendering} // ✅ Disable if rendering
                className="btn btn-ghost"
              >
                ← Prev
              </button>
              <span className="page-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages || isRendering} // ✅ Disable if rendering
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
              disabled={isRendering} // ✅ Disable if rendering
            >
              🔍-
            </button>
            <span className="zoom-level">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale(prev => Math.min(2, prev + 0.2))}
              className="btn btn-ghost"
              disabled={isRendering} // ✅ Disable if rendering
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
            {/* ✅ Show rendering indicator */}
            {isRendering && (
              <div className="rendering-overlay">
                <div className="loading-spinner"></div>
                <span>Rendering page...</span>
              </div>
            )}
            
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="pdf-canvas"
              style={{
                cursor: isRendering ? 'wait' : 'default', // ✅ Show wait cursor when rendering
                maxWidth: '100%',
                height: 'auto',
                opacity: isRendering ? 0.7 : 1 // ✅ Dim canvas when rendering
              }}
            />

            {/* Render Editable Fields only when not rendering */}
            {!isRendering && currentObjects.map(obj => (
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

      {/* Custom Success Popup */}
      {showSuccessPopup && (
        <div className="success-popup-overlay">
          <div className="success-popup">
            <div className="success-icon">✅</div>
            <h3>Upload Complete</h3>
            <p className="success-message">{successMessage}</p>
            <button 
              onClick={() => setShowSuccessPopup(false)}
              className="btn btn-primary success-ok-btn"
            >
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
    </div>
  );
}

// ✅ Enhanced styles with rendering overlay and custom success popup
const editorStyles = `
.pdf-editor-simple {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.success-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000;
  backdrop-filter: blur(2px);
}

.success-popup {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  max-width: 400px;
  width: 90%;
  text-align: center;
  animation: successPopupAppear 0.3s ease-out;
}

.success-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  animation: successIconBounce 0.6s ease-out;
}

.success-popup h3 {
  margin: 0 0 1rem 0;
  color: #2d3748;
  font-size: 1.5rem;
  font-weight: 600;
}

.success-message {
  color: #4a5568;
  line-height: 1.5;
  margin-bottom: 1.5rem;
  white-space: pre-line;
}

.success-ok-btn {
  padding: 0.75rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  min-width: 100px;
}

@keyframes successPopupAppear {
  from {
    opacity: 0;
    transform: scale(0.8) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes successIconBounce {
  0% { transform: scale(0); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.pdf-wrapper {
  position: relative;
  background: white;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  border-radius: 8px;
  overflow: hidden;
}

.rendering-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  z-index: 1500;
}

.rendering-overlay .loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.editor-header {
  background: white;
  border-bottom: 2px solid #e9ecef;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.pdf-info h2 {
  margin: 0;
  font-size: 1.2rem;
  color: #333;
}

.pdf-info p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

.completion-status {
  background: #e3f2fd;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  color: #1976d2;
  border: 1px solid #bbdefb;
}

.editor-toolbar {
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  padding: 0.75rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
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
  background: white;
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
  background: white;
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
  border-top: 4px solid #007bff;
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
}

.btn-primary { background: #007bff; color: white; }
.btn-secondary { background: #6c757d; color: white; }
.btn-success { background: #28a745; color: white; }
.btn-error { background: #dc3545; color: white; }
.btn-warning { background: #ffc107; color: #333; }
.btn-ghost { background: transparent; color: #6c757d; border: 1px solid #dee2e6; }

.btn-lg { padding: 0.75rem 1.5rem; font-size: 1.1rem; }

.btn:hover:not(:disabled) { transform: translateY(-1px); opacity: 0.9; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

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
  
  .editor-toolbar {
    flex-direction: column;
    gap: 1rem;
  }
  
  .toolbar-left, .toolbar-center, .toolbar-right {
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .signature-dialog {
    margin: 1rem;
    width: auto;
  }
}
`;

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('pdf-editor-styles')) {
  const style = document.createElement('style');
  style.id = 'pdf-editor-styles';
  style.textContent = editorStyles;
  document.head.appendChild(style);
}