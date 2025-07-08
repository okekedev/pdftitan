// src/pages/PDFEditor.jsx - Final clean version with simplified field types
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
      fontSize: 11, // Default 11px
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
    const currentDate = new Date().toLocaleDateString();
    const newDate = {
      id,
      type: 'date',
      x: x / scale,
      y: y / scale,
      width: 120 / scale,
      height: 25 / scale,
      content: currentDate,
      fontSize: 11, // Default 11px
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
      content: false, // Always start with explicit boolean false
      page: currentPage
    };
    
    setObjects(prev => [...prev, newCheckbox]);
    setSelectedId(id);
    console.log('✅ Added checkbox with content:', newCheckbox.content, typeof newCheckbox.content);
  }, [scale, currentPage]);

  const updateObject = useCallback((id, updates) => {
    setObjects(prev => prev.map(obj => {
      if (obj.id === id) {
        const updated = { ...obj, ...updates };
        
        // Ensure checkbox content is always boolean
        if (updated.type === 'checkbox' && 'content' in updates) {
          updated.content = Boolean(updates.content);
          console.log(`✅ Checkbox ${id} updated to:`, updated.content, typeof updated.content);
        }
        
        return updated;
      }
      return obj;
    }));
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
    addDateObject,
    addCheckboxObject,
    updateObject,
    deleteObject,
    clearAllObjects,
    isRendering
  };
}

// Enhanced Editable Field Component - Adobe-style behavior
function EditableField({ object, scale, selected, editing, onUpdate, onSelect, onStartEdit, onFinishEdit }) {
  const [value, setValue] = useState(object.content || '');
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
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
    cursor: editing ? 'text' : (isDragging ? 'grabbing' : 'grab'),
    userSelect: 'none',
    touchAction: 'none',
    minWidth: object.type === 'checkbox' ? '20px' : '60px',
    minHeight: object.type === 'checkbox' ? '20px' : '25px'
  };

  // Adobe-style click/drag behavior
  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (editing) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    // Check if clicking on resize handle (bottom-right corner)
    if (selected && object.type !== 'checkbox' && 
        offsetX > rect.width - 20 && offsetY > rect.height - 20) {
      setIsResizing(true);
      handleResize(e);
      return;
    }
    
    // Select field if not selected
    if (!selected) {
      onSelect(object.id);
      return;
    }
    
    // Handle double-click for editing/toggling
    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTime;
    if (timeDiff < 300) {
      if (object.type === 'text' || object.type === 'date') {
        onStartEdit(object.id);
        return;
      }
      if (object.type === 'checkbox') {
        // Double-click to toggle checkbox
        const newValue = !object.content;
        onUpdate(object.id, { content: newValue });
        return;
      }
    }
    setLastClickTime(currentTime);
    
    // Start dragging (for all field types including checkbox)
    handleDrag(e);
  };

  const handleDrag = (e) => {
    const canvasWrapper = e.target.closest('.pdf-wrapper');
    const canvas = canvasWrapper?.querySelector('canvas');
    if (!canvas) return;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startFieldX = object.x;
    const startFieldY = object.y;
    
    setIsDragging(true);
    
    const handleMouseMove = (e) => {
      const deltaX = (e.clientX - startX) / scale;
      const deltaY = (e.clientY - startY) / scale;
      
      const newX = Math.max(0, Math.min(canvas.width / scale - object.width, startFieldX + deltaX));
      const newY = Math.max(0, Math.min(canvas.height / scale - object.height, startFieldY + deltaY));
      
      onUpdate(object.id, { x: newX, y: newY });
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleResize = (e) => {
    const canvasWrapper = e.target.closest('.pdf-wrapper');
    if (!canvasWrapper) return;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = object.width;
    const startHeight = object.height;
    
    setIsResizing(true);
    
    const handleMouseMove = (e) => {
      const deltaX = (e.clientX - startX) / scale;
      const deltaY = (e.clientY - startY) / scale;
      
      const newWidth = Math.max(60, startWidth + deltaX);
      const newHeight = Math.max(25, startHeight + deltaY);
      
      onUpdate(object.id, { width: newWidth, height: newHeight });
    };
    
    const handleMouseUp = () => {
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

  // Render field content
  const renderFieldContent = () => {
    switch (object.type) {
      case 'text':
        return editing ? (
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            placeholder="Enter text..."
            autoFocus
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: 'transparent',
              fontSize: `${11 * scale}px`, // ✅ Scale font with zoom level
              color: object.color,
              outline: 'none',
              padding: '4px',
              resize: 'none',
              fontFamily: 'inherit'
            }}
          />
        ) : (
          <div style={{
            padding: '4px',
            fontSize: `${11 * scale}px`, // ✅ Scale font with zoom level
            color: object.color,
            height: '100%',
            width: '100%',
            opacity: object.content ? 1 : 0.6,
            pointerEvents: 'none',
            whiteSpace: 'pre-wrap',
            overflow: 'hidden'
          }}>
            {object.content || 'Double-click to edit'}
          </div>
        );

      case 'date':
        return editing ? (
          <input
            type="date"
            value={object.content ? new Date(object.content).toISOString().split('T')[0] : ''}
            onChange={(e) => {
              const newValue = new Date(e.target.value).toLocaleDateString();
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
              fontSize: `${11 * scale}px`, // ✅ Scale font with zoom level
              outline: 'none',
              padding: '4px'
            }}
          />
        ) : (
          <div style={{
            padding: '4px',
            fontSize: `${11 * scale}px`, // ✅ Scale font with zoom level
            color: object.color,
            height: '100%',
            width: '100%',
            opacity: object.content ? 1 : 0.6,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center'
          }}>
            {object.content || 'Double-click to edit'}
          </div>
        );

      case 'checkbox':
        const isChecked = Boolean(object.content);
        return (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${10 * scale}px`, // ✅ Scale checkbox with zoom level
            fontWeight: 'normal', // ✅ Removed bold
            pointerEvents: 'none', // Let parent handle clicks
            paddingLeft: '1px' // Slight offset to center the X better
          }}>
            {isChecked ? 'X' : '☐'}
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
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#666',
            fontSize: `${12 * scale}px`, // ✅ Scale font with zoom level
            textAlign: 'center',
            pointerEvents: 'none'
          }}>
            Double-click to sign
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div 
      style={fieldStyle}
      onMouseDown={handleMouseDown}
    >
      {renderFieldContent()}
      
      {/* Resize handle - bottom right corner */}
      {selected && !editing && object.type !== 'checkbox' && (
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
  }, [isRendering]);

  // Toolbar actions
  const handleAddTextBox = () => addTextObject(100, 100);
  const handleAddSignature = () => {
    addSignatureObject(100, 100);
    setShowSignatureDialog(true);
  };
  const handleAddDate = () => addDateObject(100, 100);
  const handleAddCheckbox = () => addCheckboxObject(100, 100);

  // Enhanced save with proper data validation
  const handleSave = async () => {
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
            content: Boolean(obj.content) // Ensure boolean
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
      
      const completedFileName = `Completed - ${cleanName}.pdf`;
      
      // Enhanced save data with proper field validation
      const saveData = {
        pdfId: pdf.id,
        serviceTitanId: pdf.serviceTitanId || pdf.id,
        originalFileName: originalName,
        completedFileName: completedFileName,
        editableElements: processedObjects,
        jobInfo: {
          jobId: job.id,
          jobNumber: job.number,
          jobTitle: job.title
        },
        savedAt: new Date().toISOString(),
        fieldSummary: {
          totalFields: processedObjects.length,
          textFields: processedObjects.filter(o => o.type === 'text').length,
          checkboxes: processedObjects.filter(o => o.type === 'checkbox').length,
          checkedBoxes: processedObjects.filter(o => o.type === 'checkbox' && o.content === true).length,
          dates: processedObjects.filter(o => o.type === 'date').length,
          signatures: processedObjects.filter(o => o.type === 'signature').length
        }
      };
      
      console.log('💾 Saving completed form:', {
        fileName: completedFileName,
        fieldCount: processedObjects.length,
        checkboxes: saveData.fieldSummary.checkboxes,
        checkedBoxes: saveData.fieldSummary.checkedBoxes
      });
      
      const result = await onSave(saveData);
      
      if (result && result.success) {
        const fieldStats = result.uploadDetails?.fieldsProcessed || saveData.fieldSummary;
        setSuccessMessage(
          `PDF form has been completed and uploaded to ServiceTitan successfully!\n\n` +
          `Saved as: ${result.fileName}\n\n` +
          `Fields processed:\n` +
          `• Text fields: ${fieldStats.textFields || fieldStats.text || 0}\n` +
          `• Checkboxes: ${fieldStats.checkboxes || 0} (${fieldStats.checkedBoxes || 'unknown'} checked)\n` +
          `• Date fields: ${fieldStats.dates || 0}\n` +
          `• Signatures: ${fieldStats.signatures || 0}`
        );
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

      {/* Toolbar */}
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