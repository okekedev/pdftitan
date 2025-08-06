/**
 * PDFEditor.jsx - Optimized PDF Form Editor Component
 * 
 * Features:
 * - Interactive PDF form field editing with drag & drop
 * - Touch/mouse support for tablets and desktop
 * - Real-time form field updates
 * - Optimized rendering and state management
 * - Single scrollbar layout
 * 
 * @param {Object} pdf - PDF attachment object
 * @param {Object} job - ServiceTitan job object  
 * @param {Function} onClose - Callback when editor is closed
 * @param {Function} onSave - Callback when form is saved
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './PDFEditor.css';

// Custom hook for PDF operations
function usePDFEditor(pdf, job) {
  const canvasRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [isRendering, setIsRendering] = useState(false);
  const [objects, setObjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [savedSignatures, setSavedSignatures] = useState([]); // Add saved signatures state

  const pdfId = useMemo(() => pdf?.serviceTitanId || pdf?.id, [pdf?.serviceTitanId, pdf?.id]);
  const jobId = useMemo(() => job?.id, [job?.id]);

  // Load PDF document
  const loadPDF = useCallback(async () => {
    if (!pdfId || !jobId) return;
    
    try {
      setPdfError(null);
      setPdfLoaded(false);
      
      console.log('📄 Loading PDF:', pdfId);
      
      // Load PDF.js if not available
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

      // Fetch PDF
      const downloadUrl = `/api/job/${jobId}/attachment/${pdfId}/download`;
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to load PDF: ${response.status}`);
      }

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
  }, [pdfId, jobId]);

  // Render PDF page - Remove isRendering from dependencies to prevent loops
  const renderPage = useCallback(async () => {
    if (!pdfDocument || !canvasRef.current || isRendering || !pdfLoaded) return;
    
    try {
      setIsRendering(true);
      
      const page = await pdfDocument.getPage(currentPage);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      const viewport = page.getViewport({ scale });
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      console.log(`✅ Page ${currentPage} rendered`);
    } catch (error) {
      console.error('❌ Rendering error:', error);
    } finally {
      setIsRendering(false);
    }
  }, [pdfDocument, currentPage, scale, pdfLoaded, isRendering]); // Include isRendering

  // Field creation functions - Create fields in center of visible PDF
  const createField = useCallback((type, x, y, additionalProps = {}) => {
    let centerX, centerY;
    
    // If no specific coordinates provided, use simple center positioning
    if (x === undefined && y === undefined) {
      const canvas = canvasRef.current;
      if (canvas) {
        // Place in center of PDF canvas, accounting for scale
        centerX = (canvas.width / 2) / scale;
        centerY = (canvas.height / 2) / scale;
      } else {
        // Fallback to reasonable center position
        centerX = 300 / scale;
        centerY = 400 / scale;
      }
    } else {
      centerX = (x || 100) / scale;
      centerY = (y || 100) / scale;
    }

    const id = `${type}_${Date.now()}`;
    const baseField = {
      id,
      type,
      x: centerX,
      y: centerY,
      page: currentPage,
      color: '#007bff',
      fontSize: 12
    };

    const fieldConfigs = {
      text: { width: 200, height: 24, content: '' }, // Start with smaller height
      signature: { width: 120, height: 40, content: null }, // Much smaller signature box
      date: { 
        width: 100, 
        height: 24, 
        content: new Date().toLocaleDateString('en-US', {
          year: 'numeric', month: '2-digit', day: '2-digit'
        })
      },
      checkbox: { width: 30, height: 30, content: false, fontSize: 18 },
      timestamp: { 
        width: 150, 
        height: 24,
        content: new Date().toLocaleString('en-US', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hour12: true
        }),
        fontSize: 11
      }
    };

    const newField = { ...baseField, ...fieldConfigs[type], ...additionalProps };
    setObjects(prev => [...prev, newField]);
    setSelectedId(id);
    
    console.log(`Created ${type} field at position:`, { x: centerX, y: centerY, scale });
  }, [scale, currentPage, canvasRef]);

  const updateObject = useCallback((id, updates) => {
    setObjects(prev => prev.map(obj => 
      obj.id === id ? { ...obj, ...updates } : obj
    ));
  }, []);

  const deleteObject = useCallback((id) => {
    setObjects(prev => prev.filter(obj => obj.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  }, [selectedId, editingId]);

  const clearAllObjects = useCallback(() => {
    setObjects([]);
    setSelectedId(null);
    setEditingId(null);
  }, []);

  // Effects - Simplified to prevent re-render loops
  useEffect(() => {
    if (pdfId && jobId && !pdfDocument && !pdfLoaded && !pdfError) {
      loadPDF();
    }
  }, [pdfId, jobId]); // Only stable IDs to prevent loops

  useEffect(() => {
    let timeoutId;
    if (pdfDocument && pdfLoaded && !isRendering) {
      timeoutId = setTimeout(() => {
        renderPage();
      }, 100);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [pdfDocument, currentPage, scale, pdfLoaded]); // Remove renderPage and isRendering to prevent loops

  return {
    canvasRef, pdfLoaded, pdfError, currentPage, setCurrentPage,
    totalPages, scale, setScale, objects, selectedId, setSelectedId,
    editingId, setEditingId, createField, updateObject, deleteObject,
    clearAllObjects, isRendering, savedSignatures, setSavedSignatures
  };
}

// Editable Field Component - Memoized to prevent unnecessary re-renders
const EditableField = React.memo(function EditableField({ object, scale, selected, editing, onUpdate, onSelect, onStartEdit, onFinishEdit }) {
  const [value, setValue] = useState(object.content || '');
  const [isDragging, setIsDragging] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);
  
  useEffect(() => {
    setValue(object.content || '');
  }, [object.content]);

  const fieldStyle = {
    left: `${object.x * scale}px`,
    top: `${object.y * scale}px`,
    width: `${object.width * scale}px`,
    height: `${object.height * scale}px`,
    fontSize: object.fontSize ? `${object.fontSize * scale}px` : '12px',
    color: object.color || '#007bff',
    zIndex: selected ? 1000 : 100,
    position: 'absolute'
  };

  const getFieldClasses = () => {
    const classes = ['form-field', `field-${object.type}`];
    if (selected) classes.push('selected');
    if (isDragging) classes.push('dragging');
    return classes.join(' ');
  };

  const handleInteraction = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    
    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTime;
    
    // Double-click to edit (shorter time window for better UX)
    if (timeDiff < 300 && selected) {
      onStartEdit(object.id);
      return;
    }
    
    // Single click to select
    onSelect(object.id);
    setLastClickTime(currentTime);
    
    // Get the initial mouse/touch position
    const startClientX = e.touches ? e.touches[0].clientX : e.clientX;
    const startClientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Calculate offset within the element (0-1 relative position)
    const elementRect = e.currentTarget.getBoundingClientRect();
    const relativeX = (startClientX - elementRect.left) / elementRect.width;
    const relativeY = (startClientY - elementRect.top) / elementRect.height;
    
    let hasMoved = false;
    
    const handleMove = (moveEvent) => {
      if (!hasMoved) {
        moveEvent.preventDefault();
        const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const clientY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
        
        const deltaX = Math.abs(clientX - startClientX);
        const deltaY = Math.abs(clientY - startClientY);
        
        // Only start dragging after significant movement
        if (deltaX > 3 || deltaY > 3) {
          setIsDragging(true);
          hasMoved = true;
        }
        return;
      }

      // Only prevent default and update position if actively dragging
      moveEvent.preventDefault();
      const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const clientY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const canvas = document.querySelector('.pdf-canvas');
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      
      // Calculate where the element's top-left should be based on cursor position
      // and the relative position within the element where user clicked
      const elementWidth = (object.width || 200) * scale;
      const elementHeight = (object.height || 30) * scale;
      
      const elementLeft = clientX - (elementWidth * relativeX);
      const elementTop = clientY - (elementHeight * relativeY);
      
      // Convert to canvas coordinates
      const newX = (elementLeft - canvasRect.left) / scale;
      const newY = (elementTop - canvasRect.top) / scale;
      
      // Apply minimal constraints
      const minX = -(object.width || 200) * 0.8;
      const maxX = (canvas.width / scale) + (object.width || 200) * 0.8;
      const minY = -(object.height || 30) * 0.8;
      const maxY = (canvas.height / scale) + (object.height || 30) * 0.8;
      
      const constrainedX = Math.max(minX, Math.min(maxX, newX));
      const constrainedY = Math.max(minY, Math.min(maxY, newY));
      
      // Direct update for smoother performance
      onUpdate(object.id, { x: constrainedX, y: constrainedY });
    };
    
    const handleEnd = (endEvent) => {
      if (endEvent) endEvent.preventDefault();
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
    
    document.addEventListener('mousemove', handleMove, { passive: false });
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    
  }, [selected, lastClickTime, onSelect, onStartEdit, object.id, object.width, object.height, scale, onUpdate]); // Include object dimensions for boundary calc

  const handleResize = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    
    const startX = e.touches ? e.touches[0].clientX : e.clientX;
    const startY = e.touches ? e.touches[0].clientY : e.clientY;
    const startWidth = object.width * scale;
    const startHeight = object.height * scale;
    
    const handleMove = (moveEvent) => {
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
    
    const handleEnd = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
    
    document.addEventListener('mousemove', handleMove, { passive: false });
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
  }, [object.id, object.width, object.height, object.type, scale, onUpdate]);

  const handleContentChange = (e) => {
    if (object.type === 'checkbox') {
      const newValue = !Boolean(value);
      setValue(newValue);
      onUpdate(object.id, { content: newValue });
    } else {
      const newValue = e.target.value;
      setValue(newValue);
      onUpdate(object.id, { content: newValue });
      
      // For text fields, trigger height recalculation but maintain position
      if (object.type === 'text') {
        // Update height based on content
        const content = newValue || '';
        const lines = content.split('\n');
        const lineHeight = Math.max(16, (object.fontSize || 12) * 1.4); // Remove scale dependency
        const minHeight = 24;
        const padding = 8;
        
        const contentHeight = Math.max(minHeight, lines.length * lineHeight + padding);
        const newHeight = contentHeight; // Store actual pixel height, not scaled
        
        if (Math.abs((object.height || 24) - newHeight) > 1) {
          onUpdate(object.id, { height: newHeight });
        }
      }
    }
  };

  const renderContent = () => {
    if (object.type === 'checkbox') {
      return (
        <div className="checkbox-display" onClick={(e) => {
          e.stopPropagation();
          handleContentChange({ target: { value: !Boolean(value) } });
        }}>
          {Boolean(value) ? '✓' : ''}
        </div>
      );
    }
    
    if (object.type === 'signature' && object.content) {
      return (
        <img
          src={object.content}
          alt="Signature"
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'contain',
            maxWidth: `${80 * scale}px`, // Limit signature display size
            maxHeight: `${30 * scale}px`
          }}
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
          onBlur={onFinishEdit}
          autoFocus
          placeholder="Enter text..."
          style={{
            minHeight: '24px',
            lineHeight: '1.4'
          }}
        />
      ) : (
        <input
          type={object.type === 'date' ? 'date' : 'text'}
          className="field-input"
          value={value}
          onChange={handleContentChange}
          onBlur={onFinishEdit}
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
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'contain',
                maxWidth: `${80 * scale}px`, // Limit signature display size
                maxHeight: `${30 * scale}px`
              }}
              draggable={false}
            />
          ) : (
            <div style={{ color: '#999', fontSize: '0.7em', textAlign: 'center' }}>
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
      data-field-id={object.id}
      onMouseDown={handleInteraction}
      onTouchStart={handleInteraction}
    >
      {renderContent()}
      
      {selected && !editing && (
        <div
          className="resize-handle"
          onMouseDown={handleResize}
          onTouchStart={handleResize}
        />
      )}
    </div>
  );
});

// Signature Dialog Component - Memoized to prevent re-renders
const SignatureDialog = React.memo(function SignatureDialog({ isOpen, onClose, onSave, savedSignatures, onSaveSignature }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000';
      // Don't fill with white - leave transparent
      ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    // Clear to transparent instead of white
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  };

  const saveSignature = () => {
    if (isEmpty) return;
    const canvas = canvasRef.current;
    // Save as PNG with transparency
    const dataURL = canvas.toDataURL('image/png');
    onSave(dataURL);
  };

  const saveForLater = () => {
    if (isEmpty) return;
    const canvas = canvasRef.current;
    // Save as PNG with transparency
    const dataURL = canvas.toDataURL('image/png');
    const timestamp = new Date().toLocaleString();
    onSaveSignature({
      id: Date.now(),
      dataURL,
      timestamp,
      name: `Signature ${savedSignatures.length + 1}`
    });
    alert('Signature saved for future use!');
  };

  const selectSavedSignature = (signature) => {
    onSave(signature.dataURL);
    setShowSaved(false);
  };

  if (!isOpen) return null;

  return (
    <div className="popup-overlay">
      <div className="popup">
        <h3>Create Signature</h3>
        
        {!showSaved ? (
          <>
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
            <div className="popup-actions">
              <button onClick={onClose} className="btn">
                Cancel
              </button>
              <button onClick={clearSignature} className="btn">
                Clear
              </button>
              <button onClick={saveForLater} className="btn" disabled={isEmpty}>
                💾 Save for Later
              </button>
              {savedSignatures.length > 0 && (
                <button onClick={() => setShowSaved(true)} className="btn">
                  📋 Use Saved ({savedSignatures.length})
                </button>
              )}
              <button onClick={saveSignature} className="btn btn-save" disabled={isEmpty}>
                ✅ Use This Signature
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <h4>Saved Signatures</h4>
              <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                {savedSignatures.map((signature) => (
                  <div key={signature.id} style={{ 
                    border: '1px solid #ddd', 
                    borderRadius: '8px', 
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}>
                    <img 
                      src={signature.dataURL} 
                      alt={signature.name}
                      style={{ 
                        width: '120px', 
                        height: '60px', 
                        objectFit: 'contain',
                        border: '1px solid #eee',
                        borderRadius: '4px'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold' }}>{signature.name}</div>
                      <div style={{ fontSize: '0.8em', color: '#666' }}>{signature.timestamp}</div>
                    </div>
                    <button 
                      onClick={() => selectSavedSignature(signature)}
                      className="btn btn-save"
                      style={{ fontSize: '0.8em' }}
                    >
                      Use This
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="popup-actions">
              <button onClick={() => setShowSaved(false)} className="btn">
                ← Back to Draw
              </button>
              <button onClick={onClose} className="btn">
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

// Main PDF Editor Component
export default function PDFEditor({ pdf, job, onClose, onSave }) {
  const {
    canvasRef, pdfLoaded, pdfError, currentPage, setCurrentPage,
    totalPages, scale, setScale, objects, selectedId, setSelectedId,
    editingId, setEditingId, createField, updateObject, deleteObject,
    clearAllObjects, isRendering, savedSignatures, setSavedSignatures
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
  }, []); // Empty deps to prevent re-renders

  // Memoize toolbar handlers to prevent re-renders
  const toolbarHandlers = useMemo(() => ({
    addText: () => createField('text'),
    addSignature: () => {
      createField('signature');
      setShowSignatureDialog(true);
    },
    addDate: () => createField('date'),
    addTimestamp: () => createField('timestamp'),
    addCheckbox: () => createField('checkbox'),
    prevPage: () => setCurrentPage(Math.max(1, currentPage - 1)),
    nextPage: () => setCurrentPage(Math.min(totalPages, currentPage + 1)),
    zoomOut: () => setScale(Math.max(0.5, scale - 0.1)),
    zoomIn: () => setScale(Math.min(3, scale + 0.1)),
    clearAll: clearAllObjects
  }), [createField, currentPage, totalPages, scale, clearAllObjects, setCurrentPage, setScale]); // Include all dependencies

  const handleAddSignature = toolbarHandlers.addSignature;

  const handleSignatureSave = (signatureDataURL) => {
    if (selectedId) {
      updateObject(selectedId, { content: signatureDataURL });
    }
    setShowSignatureDialog(false);
  };

  const handleSaveSignature = (signatureData) => {
    setSavedSignatures(prev => [...prev, signatureData]);
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
          return { ...obj, content: Boolean(obj.content) };
        }
        return obj;
      });
      
      const originalName = pdf.fileName || pdf.name || 'Document';
      const cleanName = originalName.replace(/\.pdf$/i, '').split('/').pop();
      
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
      
      const result = await onSave(saveData);
      
      if (result && result.success) {
        setSuccessMessage(`✅ Success!\n\nPDF form completed and saved:\n"${result.fileName || cleanName}"\n\nThe completed form has been uploaded to ServiceTitan.`);
        setShowSuccessPopup(true);
      } else {
        throw new Error(result?.error || 'Save failed');
      }
      
    } catch (error) {
      console.error('❌ Save error:', error);
      setSuccessMessage(`❌ Save Failed\n\n${error.message}\n\nPlease try again.`);
      setShowSuccessPopup(true);
    } finally {
      setIsSaving(false);
    }
  }, [objects, pdf, job, totalPages, scale, onSave]);

  const handleSuccessClose = () => {
    setShowSuccessPopup(false);
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
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, deleteObject, handleSave]); // Minimal deps to prevent re-renders

  if (pdfError) {
    return (
      <div className="pdf-editor-page">
        <div className="error-state">
          <h3>Failed to Load PDF</h3>
          <p>{pdfError}</p>
          <button onClick={onClose} className="btn btn-back">
            ← Back to Attachments
          </button>
        </div>
      </div>
    );
  }

  if (!pdfLoaded) {
    return (
      <div className="pdf-editor-page">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <h3>Loading PDF...</h3>
          <p>Please wait while we load your document...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-editor-page">
      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="popup-overlay">
          <div className="popup">
            <div className="popup-icon">
              {successMessage.includes('✅') ? '🎉' : '❌'}
            </div>
            <h3>{successMessage.includes('✅') ? 'PDF Saved Successfully!' : 'Save Error'}</h3>
            <div className="popup-message">{successMessage}</div>
            <div className="popup-actions">
              <button onClick={handleSuccessClose} className="btn btn-save">
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Dialog */}
      <SignatureDialog
        isOpen={showSignatureDialog}
        onClose={() => setShowSignatureDialog(false)}
        onSave={handleSignatureSave}
        savedSignatures={savedSignatures}
        onSaveSignature={handleSaveSignature}
      />

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-section toolbar-left">
          <div className="tool-group">
            <span className="tool-label">Add Fields</span>
            <button onClick={toolbarHandlers.addText} className="btn">
              📝 Text
            </button>
            <button onClick={handleAddSignature} className="btn">
              ✍️ Signature
            </button>
            <button onClick={toolbarHandlers.addDate} className="btn">
              📅 Date
            </button>
            <button onClick={toolbarHandlers.addTimestamp} className="btn">
              🕐 Timestamp
            </button>
            <button onClick={toolbarHandlers.addCheckbox} className="btn">
              ☑️ Checkbox
            </button>
          </div>
        </div>

        <div className="toolbar-section toolbar-center">
          <div className="page-nav">
            <button 
              onClick={toolbarHandlers.prevPage}
              disabled={currentPage <= 1}
              className="btn"
            >
              ← Prev
            </button>
            <span className="page-info">
              Page {currentPage} of {totalPages}
            </span>
            <button 
              onClick={toolbarHandlers.nextPage}
              disabled={currentPage >= totalPages}
              className="btn"
            >
              Next →
            </button>
          </div>

          <div className="scale-controls">
            <button onClick={toolbarHandlers.zoomOut} className="btn">
              🔍-
            </button>
            <button onClick={toolbarHandlers.zoomIn} className="btn">
              🔍+
            </button>
          </div>
        </div>

        <div className="toolbar-section toolbar-right">
          <div className="tool-group">
            <span className="tool-label">Actions</span>
            <button 
              onClick={toolbarHandlers.clearAll}
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
              {isSaving ? '💾 Saving...' : '💾 Save'}
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving || objects.length === 0}  
              className="btn btn-upload"
            >
              {isSaving ? '📤 Uploading...' : '📤 Upload'}
            </button>
            <button onClick={onClose} className="btn btn-back">
              ← Back
            </button>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {isRendering && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <span>Rendering...</span>
        </div>
      )}
      
      {/* PDF Canvas */}
      <canvas
        ref={canvasRef}
        className="pdf-canvas"
        onClick={handleCanvasClick}
      />
      
      {/* Form Fields */}
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