// src/pages/PDFEditor.jsx - COMPLETE FILE with transparent fields and touch support
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

// ✅ FIXED: Enhanced Editable Field Component with proper touch support for iPad
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

  // ✅ FIXED: More transparent styling with no grey borders
  const fieldStyle = {
    position: 'absolute',
    left: `${object.x * scale}px`,
    top: `${object.y * scale}px`,
    width: `${object.width * scale}px`,
    height: `${calculateFieldHeight()}px`,
    zIndex: selected ? 1000 : 100,
    // ✅ FIXED: Only show border when selected, no border otherwise
    border: selected ? '2px solid #007bff' : 'none',
    borderRadius: '4px',
    // ✅ FIXED: Much more transparent background (5% vs 95% previously)
    background: selected ? 'rgba(0, 123, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
    cursor: editing ? 'text' : (isDragging ? 'grabbing' : 'grab'),
    userSelect: 'none',
    touchAction: 'none',
    minWidth: object.type === 'checkbox' ? '20px' : '60px',
    minHeight: object.type === 'checkbox' ? '20px' : '20px'
  };

  const handleInteractionStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const now = Date.now();
    const isDoubleClick = now - lastClickTime < 300;
    setLastClickTime(now);
    
    if (isDoubleClick && object.type !== 'checkbox') {
      onStartEdit(object.id);
      return;
    }

    if (object.type === 'checkbox') {
      onUpdate(object.id, { content: !object.content });
      return;
    }

    onSelect(object.id);
  }, [object, onUpdate, onSelect, onStartEdit, lastClickTime]);

  const handleSave = () => {
    onUpdate(object.id, { content: value });
    onFinishEdit();
  };

  const renderFieldContent = () => {
    switch (object.type) {
      case 'text':
        return editing ? (
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setValue(object.content || '');
                onFinishEdit();
              }
            }}
            autoFocus
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: 'transparent',
              fontSize: `${(object.fontSize || 11) * scale}px`,
              color: object.color,
              outline: 'none',
              resize: 'none',
              padding: '4px',
              fontFamily: 'inherit'
            }}
          />
        ) : (
          <div style={{
            padding: '4px',
            fontSize: `${(object.fontSize || 11) * scale}px`,
            color: object.color,
            height: '100%',
            width: '100%',
            opacity: object.content ? 1 : 0.6,
            pointerEvents: 'none',
            whiteSpace: 'pre-wrap',
            overflow: 'hidden'
          }}>
            {object.content || 'Double-tap to edit'}
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
              fontSize: `${11 * scale}px`,
              outline: 'none',
              padding: '4px'
            }}
          />
        ) : (
          <div style={{
            padding: '4px',
            fontSize: `${11 * scale}px`,
            color: object.color,
            height: '100%',
            width: '100%',
            opacity: object.content ? 1 : 0.6,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center'
          }}>
            {object.content || 'Double-tap to edit'}
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
            fontSize: `${10 * scale}px`,
            fontWeight: 'normal',
            pointerEvents: 'none',
            paddingLeft: '1px'
          }}>
            {/* ✅ CHANGED: Always show X instead of conditional display */}
            {'X'}
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
            fontSize: `${12 * scale}px`,
            textAlign: 'center',
            pointerEvents: 'none'
          }}>
            Double-tap to sign
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div 
      style={fieldStyle}
      // ✅ NEW: Add both mouse and touch event handlers
      onMouseDown={handleInteractionStart}
      onTouchStart={handleInteractionStart}
      // ✅ NEW: Subtle hover effect for better UX
      onMouseEnter={(e) => {
        if (!selected) {
          e.target.style.background = 'rgba(255, 255, 255, 0.15)';
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.target.style.background = 'rgba(255, 255, 255, 0.05)';
        }
      }}
    >
      {renderFieldContent()}
      
      {/* ✅ ENHANCED: Resize handle with touch support */}
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

// Signature Dialog Component
function SignatureDialog({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, []);

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const saveSignature = () => {
    if (!hasSignature) return;
    
    const canvas = canvasRef.current;
    const signatureData = canvas.toDataURL('image/png');
    onSave(signatureData);
  };

  return (
    <div className="signature-dialog-overlay">
      <div className="signature-dialog">
        <h3>Add Your Signature</h3>
        <canvas
          ref={canvasRef}
          width={400}
          height={200}
          style={{
            border: '2px solid #ddd',
            borderRadius: '8px',
            cursor: 'crosshair',
            background: 'white'
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
        <div className="signature-dialog-actions">
          <button onClick={onCancel} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={clearSignature} className="btn btn-outline">
            Clear
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
            {isSaving ? '⏳ Saving...' : '💾 Save Form'}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <div className="tool-group">
            <span className="tool-group-label">Add Fields:</span>
            <button onClick={handleAddTextBox} className="btn btn-outline tool-btn">
              📝 Text
            </button>
            <button onClick={handleAddCheckbox} className="btn btn-outline tool-btn">
              ☑️ Checkbox
            </button>
            <button onClick={handleAddDate} className="btn btn-outline tool-btn">
              📅 Date
            </button>
            <button onClick={handleAddSignature} className="btn btn-outline tool-btn">
              ✏️ Signature
            </button>
          </div>
        </div>

        <div className="toolbar-center">
          <div className="tool-group">
            <span className="tool-group-label">Page:</span>
            <button 
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="btn btn-outline"
            >
              ← Prev
            </button>
            <span className="page-info">
              {currentPage} of {totalPages}
            </span>
            <button 
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="btn btn-outline"
            >
              Next →
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          <div className="tool-group">
            <span className="tool-group-label">View:</span>
            <button 
              onClick={() => setScale(Math.max(0.5, scale - 0.1))}
              disabled={scale <= 0.5}
              className="btn btn-outline"
            >
              🔍−
            </button>
            <span className="zoom-info">{Math.round(scale * 100)}%</span>
            <button 
              onClick={() => setScale(Math.min(2.0, scale + 0.1))}
              disabled={scale >= 2.0}
              className="btn btn-outline"
            >
              🔍+
            </button>
          </div>
          
          {selectedId && (
            <button 
              onClick={() => deleteObject(selectedId)}
              className="btn btn-danger"
            >
              🗑️ Delete
            </button>
          )}
          
          {objects.length > 0 && (
            <button 
              onClick={clearAllObjects}
              className="btn btn-warning"
            >
              🧹 Clear All
            </button>
          )}
        </div>
      </div>

      {/* PDF Container */}
      <div className="pdf-container">
        <div className="pdf-viewer">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              background: 'white',
              cursor: 'default'
            }}
          />
          
          {/* Render editable fields */}
          {pdfLoaded && currentObjects.map(object => (
            <EditableField
              key={object.id}
              object={object}
              scale={scale}
              selected={selectedId === object.id}
              editing={editingId === object.id}
              onUpdate={updateObject}
              onSelect={setSelectedId}
              onStartEdit={setEditingId}
              onFinishEdit={() => setEditingId(null)}
            />
          ))}
        </div>
      </div>

      {/* Loading overlay */}
      {isRendering && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Rendering PDF...</p>
        </div>
      )}

      {/* Signature Dialog */}
      {showSignatureDialog && (
        <SignatureDialog
          onSave={(signatureData) => {
            handleSignatureSave(signatureData);
            setShowSignatureDialog(false);
          }}
          onCancel={() => setShowSignatureDialog(false)}
        />
      )}

      {/* Success/Error Popup */}
      {showSuccessPopup && (
        <div className="popup-overlay">
          <div className="popup-content">
            <h3>Save Complete</h3>
            <pre className="popup-message">{successMessage}</pre>
            <div className="popup-actions">
              <button 
                onClick={() => {
                  setShowSuccessPopup(false);
                  onClose();
                }}
                className="btn btn-primary"
              >
                ✅ Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}