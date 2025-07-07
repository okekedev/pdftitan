// Enhanced PDF Editor with fixed positioning and new field types
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

  // ✅ FIXED: Page Rendering with proper canvas management
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

  // ✅ NEW: Add different types of objects
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

  // ✅ NEW: Add date object with current date
  const addDateObject = useCallback((x = 100, y = 100) => {
    const id = Date.now().toString();
    const currentDate = new Date().toLocaleDateString();
    const newDate = {
      id,
      type: 'date',
      x: x / scale,
      y: y / scale,
      width: 120 / scale,
      height: 25 / scale,
      content: currentDate,
      fontSize: 12,
      color: '#000000',
      page: currentPage
    };
    
    setObjects(prev => [...prev, newDate]);
    setSelectedId(id);
  }, [scale, currentPage]);

  // ✅ NEW: Add timestamp object with current date and time
  const addTimestampObject = useCallback((x = 100, y = 100) => {
    const id = Date.now().toString();
    const now = new Date();
    const timestamp = now.toLocaleString();
    const newTimestamp = {
      id,
      type: 'timestamp',
      x: x / scale,
      y: y / scale,
      width: 160 / scale,
      height: 25 / scale,
      content: timestamp,
      fontSize: 12,
      color: '#000000',
      page: currentPage
    };
    
    setObjects(prev => [...prev, newTimestamp]);
    setSelectedId(id);
  }, [scale, currentPage]);

  // ✅ NEW: Add checkbox object
  const addCheckboxObject = useCallback((x = 100, y = 100) => {
    const id = Date.now().toString();
    const newCheckbox = {
      id,
      type: 'checkbox',
      x: x / scale,
      y: y / scale,
      width: 20 / scale,
      height: 20 / scale,
      content: false, // false = unchecked, true = checked
      page: currentPage
    };
    
    setObjects(prev => [...prev, newCheckbox]);
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
  }, [pdfDocument, currentPage, scale]);

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
    addDateObject,        // ✅ NEW
    addTimestampObject,   // ✅ NEW
    addCheckboxObject,    // ✅ NEW
    updateObject,
    deleteObject,
    clearAllObjects,
    isRendering
  };
}

// Enhanced Editable Field Component with all field types and FIXED positioning
function EditableField({ object, scale, selected, editing, onUpdate, onSelect, onStartEdit, onFinishEdit }) {
  const [value, setValue] = useState(object.content || '');
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);
  
  useEffect(() => {
    setValue(object.content || '');
  }, [object.content]);

  // ✅ FIXED: Better height calculation for different field types
  const calculateFieldHeight = () => {
    switch (object.type) {
      case 'text':
        const lineHeight = Math.max(16, object.fontSize * scale * 1.2);
        const lines = (object.content || '').split('\n').length;
        const textLines = Math.max(1, Math.ceil((object.content || '').length / 25));
        return Math.max(object.height * scale, Math.max(lines, textLines) * lineHeight + 8);
      case 'checkbox':
        return Math.max(20, object.height * scale);
      default:
        return object.height * scale;
    }
  };

  const fieldStyle = {
    position: 'absolute',
    left: `${object.x * scale}px`,
    top: `${object.y * scale}px`,
    width: `${object.width * scale}px`,
    height: `${calculateFieldHeight()}px`,
    zIndex: selected ? 1000 : 100,
    border: selected ? '2px solid #007bff' : '1px solid rgba(0,0,0,0.2)',
    borderRadius: '4px',
    background: selected ? 'rgba(0, 123, 255, 0.1)' : 'rgba(255, 255, 255, 0.95)',
    cursor: isDragging ? 'grabbing' : 'move',
    userSelect: 'none',
    touchAction: 'none',
    minWidth: object.type === 'checkbox' ? '20px' : '60px',
    minHeight: object.type === 'checkbox' ? '20px' : '25px'
  };

  // Handle mouse down for dragging (same as before but with better coordinate handling)
  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (editing) return;
    
    const fieldRect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - fieldRect.left;
    const offsetY = e.clientY - fieldRect.top;
    
    // Check for resize handle
    if (selected && offsetX > fieldRect.width - 15 && offsetY > fieldRect.height - 15) {
      setIsResizing(true);
      return;
    }
    
    if (!selected) {
      onSelect(object.id);
      return;
    }
    
    // ✅ IMPROVED: Better drag handling with canvas bounds
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
        // ✅ FIXED: Better coordinate calculation
        const canvasRect = canvasWrapper.getBoundingClientRect();
        const canvas = canvasWrapper.querySelector('canvas');
        
        if (canvas) {
          // Get mouse position relative to canvas
          const mouseX = e.clientX - canvasRect.left;
          const mouseY = e.clientY - canvasRect.top;
          
          // Convert to PDF coordinates and constrain to canvas bounds
          const newX = Math.max(0, Math.min((canvas.width / scale) - object.width, mouseX / scale));
          const newY = Math.max(0, Math.min((canvas.height / scale) - object.height, mouseY / scale));
          
          onUpdate(object.id, { x: newX, y: newY });
        }
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
      setIsResizing(false);
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

  // ✅ NEW: Render different field types
  const renderFieldContent = () => {
    switch (object.type) {
      case 'text':
        return editing ? (
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
        );

      case 'date':
      case 'timestamp':
        return editing ? (
          <input
            type={object.type === 'date' ? 'date' : 'datetime-local'}
            value={object.type === 'date' 
              ? (object.content ? new Date(object.content).toISOString().split('T')[0] : '') 
              : (object.content ? new Date(object.content).toISOString().slice(0, 16) : '')
            }
            onChange={(e) => {
              const newValue = object.type === 'date' 
                ? new Date(e.target.value).toLocaleDateString()
                : new Date(e.target.value).toLocaleString();
              setValue(newValue);
              onUpdate(object.id, { content: newValue });
            }}
            onBlur={handleSave}
            autoFocus
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: 'transparent',
              fontSize: '12px',
              color: object.color,
              outline: 'none',
              padding: '4px'
            }}
          />
        ) : (
          <div style={{
            padding: '4px',
            fontSize: '12px',
            color: object.color,
            height: '100%',
            width: '100%',
            opacity: object.content ? 1 : 0.6,
            pointerEvents: 'none',
            lineHeight: '1.2',
            display: 'flex',
            alignItems: 'center'
          }}>
            📅 {object.content || (object.type === 'date' ? 'Click to set date' : 'Click to set timestamp')}
          </div>
        );

      case 'checkbox':
        return (
          <div 
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              userSelect: 'none',
              pointerEvents: 'auto', // ✅ Allow checkbox clicks
              position: 'relative',
              zIndex: 10 // ✅ Put checkbox above drag handle
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onUpdate(object.id, { content: !object.content });
            }}
          >
            {object.content ? '✓' : '☐'}
          </div>
        );

      case 'signature':
        return object.content ? (
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
        );

      default:
        return null;
    }
  };

  return (
    <div style={fieldStyle}>
      {/* ✅ UPDATED: Smarter drag handle that doesn't interfere with checkbox clicks */}
      <div
        className="drag-handle"
        onMouseDown={(e) => {
          // ✅ For checkboxes, only handle drag from edges, not center
          if (object.type === 'checkbox') {
            const rect = e.currentTarget.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const distanceFromCenter = Math.sqrt(
              Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2)
            );
            
            // If clicking near center of checkbox, let the checkbox handle it
            if (distanceFromCenter < 15) {
              return;
            }
          }
          
          handleMouseDown(e);
        }}
        style={{
          position: 'absolute',
          top: '-10px',
          left: '-10px',
          right: '-10px',
          bottom: '-10px',
          cursor: editing ? 'text' : (object.type === 'checkbox' ? 'move' : 'move'),
          zIndex: 1,
          // Visual indicator when selected
          border: selected ? '2px dashed rgba(0, 123, 255, 0.3)' : 'none',
          borderRadius: '8px'
        }}
        title={`${object.type} field - ${object.type === 'checkbox' ? 'Click center to toggle, drag edges to move' : 'Click to select, drag to move'}${object.type === 'text' ? ', double-click to edit' : ''}`}
      />
      
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          pointerEvents: editing || object.type === 'checkbox' ? 'auto' : 'none' // ✅ Allow interaction for editing or checkboxes
        }}
      >
        {renderFieldContent()}
      </div>
      
      {/* Resize handle for non-checkbox fields */}
      {selected && !editing && object.type !== 'checkbox' && (
        <div
          style={{
            position: 'absolute',
            bottom: '-4px',
            right: '-4px',
            width: '12px',
            height: '12px',
            background: object.type === 'signature' ? '#28a745' : '#007bff',
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
            
            const canvasWrapper = e.target.closest('.pdf-wrapper');
            if (!canvasWrapper) return;
            
            const canvasRect = canvasWrapper.getBoundingClientRect();
            
            const handleMouseMove = (e) => {
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

// Simple Signature Pad Component (unchanged)
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

// Main PDF Editor Component with enhanced toolbar
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
    addDateObject,        // ✅ NEW
    addTimestampObject,   // ✅ NEW
    addCheckboxObject,    // ✅ NEW
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

  // ✅ NEW: Enhanced toolbar actions
  const handleAddTextBox = () => addTextObject(100, 100);
  const handleAddSignature = () => {
    addSignatureObject(100, 100);
    setShowSignatureDialog(true);
  };
  const handleAddDate = () => addDateObject(100, 100);
  const handleAddTimestamp = () => addTimestampObject(100, 100);
  const handleAddCheckbox = () => addCheckboxObject(100, 100);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const originalName = pdf.fileName || pdf.name || 'Document';
      let cleanName = originalName.replace(/\.pdf$/i, '');
      
      if (cleanName.includes('/')) {
        cleanName = cleanName.split('/').pop();
      }
      
      cleanName = cleanName.replace(/@@\d+.*$/, match => {
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
    const filled = objects.filter(obj => {
      if (obj.type === 'checkbox') return true; // Checkboxes are always "complete"
      return obj.content && obj.content.toString().trim() !== '';
    }).length;
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
            disabled={isSaving || isRendering}
            className="btn btn-success btn-lg"
          >
            {isSaving ? '💾 Saving...' : '💾 Save Completed Form'}
          </button>
        </div>
      </div>

      {/* ✅ ENHANCED: Expanded Toolbar with new field types */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <div className="tool-group">
            <span className="tool-group-label">Add Fields:</span>
            <button 
              onClick={handleAddTextBox}
              className="btn btn-primary"
              disabled={isRendering}
              title="Add text input field"
            >
              📝 Text
            </button>
            <button 
              onClick={handleAddSignature}
              className="btn btn-primary"
              disabled={isRendering}
              title="Add signature field"
            >
              ✍️ Signature
            </button>
            <button 
              onClick={handleAddDate}
              className="btn btn-primary"
              disabled={isRendering}
              title="Add current date"
            >
              📅 Date
            </button>
            <button 
              onClick={handleAddTimestamp}
              className="btn btn-primary"
              disabled={isRendering}
              title="Add current date and time"
            >
              🕐 Timestamp
            </button>
            <button 
              onClick={handleAddCheckbox}
              className="btn btn-primary"
              disabled={isRendering}
              title="Add checkbox"
            >
              ☐ Checkbox
            </button>
          </div>
          
          {selectedId && (
            <div className="tool-group">
              <button
                onClick={() => deleteObject(selectedId)}
                className="btn btn-error"
                disabled={isRendering}
              >
                🗑️ Delete Selected
              </button>
            </div>
          )}
          
          {objects.length > 0 && (
            <div className="tool-group">
              <button
                onClick={clearAllObjects}
                className="btn btn-warning"
                disabled={isRendering}
              >
                🧹 Clear All
              </button>
            </div>
          )}
        </div>

        <div className="toolbar-center">
          {totalPages > 1 && (
            <div className="page-controls">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage <= 1 || isRendering}
                className="btn btn-ghost"
              >
                ← Prev
              </button>
              <span className="page-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages || isRendering}
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
              disabled={isRendering}
            >
              🔍-
            </button>
            <span className="zoom-level">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale(prev => Math.min(2, prev + 0.2))}
              className="btn btn-ghost"
              disabled={isRendering}
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
                cursor: isRendering ? 'wait' : 'default',
                maxWidth: '100%',
                height: 'auto',
                opacity: isRendering ? 0.7 : 1
              }}
            />

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

      {/* Success Popup */}
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