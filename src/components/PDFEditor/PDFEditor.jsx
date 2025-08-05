// src/pages/PDFEditor.jsx - Clean PDF Editor Component (ESLint Fixed)
import React, { useState, useRef, useEffect, useCallback } from 'react';

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
    const newDate = {
      id,
      type: 'date',
      x: x / scale,
      y: y / scale,
      width: 120 / scale,
      height: 30 / scale,
      content: new Date().toLocaleDateString(),
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

  const updateObject = useCallback((id, updates) => {
    setObjects(prev => prev.map(obj => 
      obj.id === id ? { ...obj, ...updates } : obj
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

  // Initialize PDF on component mount
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
  }, [loadPDF, pdf, job]); // ✅ Fixed: Added missing dependencies

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
  }, [pdfDocument, currentPage, scale, renderPage, isRendering]); // ✅ Fixed: Added missing dependencies

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

// Enhanced Editable Field Component
function EditableField({ object, scale, selected, editing, onUpdate, onSelect, onStartEdit, onFinishEdit }) {
  const [value, setValue] = useState(object.content || '');
  const [lastClickTime, setLastClickTime] = useState(0); // ✅ Removed unused variables
  
  useEffect(() => {
    setValue(object.content || '');
  }, [object.content]);

  const fieldStyle = {
    position: 'absolute',
    left: `${object.x * scale}px`,
    top: `${object.y * scale}px`,
    width: `${object.width * scale}px`,
    height: `${object.height * scale}px`,
    zIndex: selected ? 1000 : 100,
    border: selected ? '2px solid #007bff' : '1px solid rgba(0,0,0,0.2)',
    borderRadius: '4px',
    background: selected ? 'rgba(0, 123, 255, 0.1)' : 'rgba(255, 255, 255, 0.8)',
    cursor: editing ? 'text' : 'grab',
    userSelect: 'none',
    minWidth: object.type === 'checkbox' ? '20px' : '60px',
    minHeight: object.type === 'checkbox' ? '20px' : '30px'
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const currentTime = Date.now();
    const isDoubleClick = currentTime - lastClickTime < 300;
    setLastClickTime(currentTime);
    
    if (isDoubleClick && !editing) {
      onStartEdit(object.id);
      return;
    }
    
    onSelect(object.id);
    
    const startX = e.clientX - object.x * scale;
    const startY = e.clientY - object.y * scale;
    
    const handleMouseMove = (e) => {
      const newX = (e.clientX - startX) / scale;
      const newY = (e.clientY - startY) / scale;
      onUpdate(object.id, { x: Math.max(0, newX), y: Math.max(0, newY) });
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleValueChange = (newValue) => {
    setValue(newValue);
    onUpdate(object.id, { content: newValue });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && object.type !== 'text') {
      onFinishEdit();
      e.preventDefault();
    } else if (e.key === 'Escape') {
      setValue(object.content || '');
      onFinishEdit();
    }
  };

  const renderFieldContent = () => {
    if (editing) {
      switch (object.type) {
        case 'text':
          return (
            <textarea
              value={value}
              onChange={(e) => handleValueChange(e.target.value)}
              onBlur={onFinishEdit}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: 'transparent',
                resize: 'none',
                fontSize: `${Math.max(10, object.fontSize * scale)}px`,
                color: object.color,
                outline: 'none',
                fontFamily: 'Arial, sans-serif'
              }}
              autoFocus
            />
          );
        case 'checkbox':
          return (
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleValueChange(e.target.checked)}
              onBlur={onFinishEdit}
              style={{
                width: '100%',
                height: '100%',
                cursor: 'pointer'
              }}
              autoFocus
            />
          );
        case 'date':
          return (
            <input
              type="date"
              value={value}
              onChange={(e) => handleValueChange(e.target.value)}
              onBlur={onFinishEdit}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: 'transparent',
                fontSize: `${Math.max(10, object.fontSize * scale)}px`,
                color: object.color,
                outline: 'none'
              }}
              autoFocus
            />
          );
        default:
          return (
            <input
              type="text"
              value={value}
              onChange={(e) => handleValueChange(e.target.value)}
              onBlur={onFinishEdit}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: 'transparent',
                fontSize: `${Math.max(10, object.fontSize * scale)}px`,
                color: object.color,
                outline: 'none',
                fontFamily: 'Arial, sans-serif'
              }}
              autoFocus
            />
          );
      }
    } else {
      // Display mode
      switch (object.type) {
        case 'text':
          return (
            <div style={{
              fontSize: `${Math.max(10, object.fontSize * scale)}px`,
              color: object.color,
              fontFamily: 'Arial, sans-serif',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              padding: '2px'
            }}>
              {object.content || 'Click to edit'}
            </div>
          );
        case 'checkbox':
          return (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 'bold'
            }}>
              {Boolean(object.content) ? '✓' : '☐'}
            </div>
          );
        case 'signature':
          return (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: '#666',
              fontStyle: 'italic'
            }}>
              {object.content ? 'Signature' : 'Click to sign'}
            </div>
          );
        case 'date':
          return (
            <div style={{
              fontSize: `${Math.max(10, object.fontSize * scale)}px`,
              color: object.color,
              fontFamily: 'Arial, sans-serif',
              padding: '2px'
            }}>
              {object.content || new Date().toLocaleDateString()}
            </div>
          );
        default:
          return (
            <div style={{
              fontSize: `${Math.max(10, object.fontSize * scale)}px`,
              color: object.color,
              fontFamily: 'Arial, sans-serif',
              padding: '2px'
            }}>
              {object.content || 'Click to edit'}
            </div>
          );
      }
    }
  };

  return (
    <div
      style={fieldStyle}
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()}
    >
      {renderFieldContent()}
      {selected && (
        <div style={{
          position: 'absolute',
          top: '-10px',
          right: '-10px',
          background: '#dc3545',
          color: 'white',
          borderRadius: '50%',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          cursor: 'pointer',
          zIndex: 1001
        }}
        onClick={(e) => {
          e.stopPropagation();
          onUpdate(object.id, null, 'delete');
        }}>
          ×
        </div>
      )}
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

  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const currentObjects = objects.filter(obj => obj.page === currentPage);

  // ✅ Fixed: Added missing dependencies
  const handleCanvasClick = useCallback((e) => {
    if (isRendering) return;
    setSelectedId(null);
    setEditingId(null);
  }, [isRendering, setSelectedId, setEditingId]);

  // Toolbar actions
  const handleAddTextBox = () => addTextObject(100, 100);
  const handleAddSignature = () => addSignatureObject(100, 100);
  const handleAddDate = () => addDateObject(100, 100);
  const handleAddCheckbox = () => addCheckboxObject(100, 100);

  // Enhanced save with proper data validation
  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      if (objects.length === 0) {
        setSuccessMessage('No fields to save. Please add some fields to the form first.');
        setShowSuccessPopup(true);
        return;
      }
      
      const processedObjects = objects.map(obj => {
        if (obj.type === 'checkbox') {
          return { ...obj, content: Boolean(obj.content) };
        }
        return obj;
      });
      
      const originalName = pdf.fileName || pdf.name || 'Document';
      let cleanName = originalName.replace(/\.pdf$/i, '');
      
      if (cleanName.includes('/')) {
        cleanName = cleanName.split('/').pop();
      }
      
      const saveData = {
        attachmentId: pdf.serviceTitanId || pdf.id,
        jobId: job.id,
        fileName: cleanName,
        editableElements: processedObjects,
        totalPages: totalPages
      };
      
      console.log('💾 Saving PDF with data:', saveData);
      
      const result = await onSave(saveData);
      
      if (result && result.success) {
        setSuccessMessage(`PDF saved successfully as "${result.fileName}"`);
        setShowSuccessPopup(true);
        
        setTimeout(() => {
          setShowSuccessPopup(false);
          onClose();
        }, 2000);
      }
      
    } catch (error) {
      console.error('❌ Error saving PDF:', error);
      setSuccessMessage(`Error saving PDF: ${error.message}`);
      setShowSuccessPopup(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleObjectUpdate = (id, updates, action) => {
    if (action === 'delete') {
      deleteObject(id);
    } else {
      updateObject(id, updates);
    }
  };

  // Loading state
  if (!pdfLoaded && !pdfError) {
    return (
      <div className="pdf-editor-loading">
        <div className="loading-spinner"></div>
        <p>Loading PDF Editor...</p>
      </div>
    );
  }

  // Error state
  if (pdfError) {
    return (
      <div className="pdf-editor-error">
        <div className="alert alert-error">
          <span>⚠️</span>
          <div>
            <strong>PDF Loading Error</strong>
            <p>{pdfError}</p>
          </div>
        </div>
        <button onClick={onClose} className="btn btn-secondary">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="pdf-editor-container">
      {/* Success Popup */}
      {showSuccessPopup && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          zIndex: 2000,
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <h3 style={{ color: '#28a745', marginBottom: '10px' }}>✅ Success!</h3>
          <p>{successMessage}</p>
        </div>
      )}

      {/* Header */}
      <div className="pdf-editor-header" style={{
        background: '#f8f9fa',
        padding: '15px 20px',
        borderBottom: '1px solid #dee2e6',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h3 style={{ margin: 0, color: '#495057' }}>PDF Editor</h3>
          <p style={{ margin: '5px 0 0 0', color: '#6c757d', fontSize: '14px' }}>
            {pdf?.name || 'Unknown PDF'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleSave} className="btn btn-success" disabled={isSaving}>
            {isSaving ? 'Saving...' : '💾 Save PDF'}
          </button>
          <button onClick={onClose} className="btn btn-secondary">
            ❌ Close
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="pdf-toolbar" style={{
        background: '#fff',
        padding: '10px 20px',
        borderBottom: '1px solid #dee2e6',
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <button onClick={handleAddTextBox} className="btn btn-sm">
          📝 Add Text
        </button>
        <button onClick={handleAddCheckbox} className="btn btn-sm">
          ☐ Add Checkbox
        </button>
        <button onClick={handleAddDate} className="btn btn-sm">
          📅 Add Date
        </button>
        <button onClick={handleAddSignature} className="btn btn-sm">
          ✏️ Add Signature
        </button>
        
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
          {totalPages > 1 && (
            <>
              <button 
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="btn btn-sm"
              >
                ← Prev
              </button>
              <span style={{ fontSize: '14px' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="btn btn-sm"
              >
                Next →
              </button>
            </>
          )}
          
          <select 
            value={scale} 
            onChange={(e) => setScale(parseFloat(e.target.value))}
            style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value={0.8}>80%</option>
            <option value={1.0}>100%</option>
            <option value={1.2}>120%</option>
            <option value={1.5}>150%</option>
            <option value={2.0}>200%</option>
          </select>
          
          {objects.length > 0 && (
            <button onClick={clearAllObjects} className="btn btn-sm btn-warning">
              🗑️ Clear All
            </button>
          )}
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="pdf-viewer" style={{
        flex: 1,
        background: '#f5f5f5',
        position: 'relative',
        overflow: 'auto',
        padding: '20px'
      }}>
        <div style={{
          position: 'relative',
          display: 'inline-block',
          background: 'white',
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
          margin: '0 auto'
        }}>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            style={{
              display: 'block',
              cursor: 'crosshair'
            }}
          />
          
          {/* Overlay for editable fields */}
          {currentObjects.map(obj => (
            <EditableField
              key={obj.id}
              object={obj}
              scale={scale}
              selected={selectedId === obj.id}
              editing={editingId === obj.id}
              onUpdate={handleObjectUpdate}
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