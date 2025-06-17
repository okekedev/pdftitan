import React, { useState, useRef, useEffect } from 'react';
import './PDFEditor.css';

function PDFEditor({ pdf, job, onClose, onSave }) {
  const pdfContainerRef = useRef(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [editableElements, setEditableElements] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [showInstructions, setShowInstructions] = useState(true);
  
  // Touch and zoom state
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const [lastTouchCenter, setLastTouchCenter] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Load PDF when component mounts
  useEffect(() => {
    loadPDF();
  }, [pdf]);

  const loadPDF = async () => {
    try {
      console.log('📄 Loading PDF:', {
        pdfName: pdf.name,
        pdfId: pdf.id,
        downloadUrl: pdf.downloadUrl,
        serviceTitanId: pdf.serviceTitanId,
        jobId: job.id
      });

      // ✅ FIRST: Try our server proxy endpoint (most reliable)
      if (pdf.serviceTitanId && job.id) {
        console.log('🔗 Attempting to fetch PDF from server proxy...');
        
        const proxyUrl = `http://localhost:3005/api/job/${job.id}/attachment/${pdf.serviceTitanId}/download`;
        
        try {
          const response = await fetch(proxyUrl);
          if (response.ok) {
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            setPdfUrl(blobUrl);
            setPdfLoaded(true);
            console.log('✅ PDF loaded via server proxy:', pdf.name);
            return;
          } else {
            console.warn('⚠️ Server proxy failed:', response.status, response.statusText);
          }
        } catch (proxyError) {
          console.warn('⚠️ Server proxy error:', proxyError);
        }
      }

      // SECOND: Try direct ServiceTitan download URL (if available)
      if (pdf.downloadUrl) {
        console.log('🔗 Trying ServiceTitan download URL:', pdf.downloadUrl);
        
        try {
          // Test if the URL is accessible
          const response = await fetch(pdf.downloadUrl, { method: 'HEAD' });
          if (response.ok) {
            setPdfUrl(pdf.downloadUrl);
            setPdfLoaded(true);
            console.log('✅ PDF loaded via direct URL:', pdf.name);
            return;
          } else {
            console.warn('⚠️ Direct URL failed:', response.status);
          }
        } catch (directError) {
          console.warn('⚠️ Direct URL error:', directError);
        }
      }

      // FALLBACK: Use sample PDF
      console.log('📋 All methods failed, falling back to sample PDF...');
      const response = await fetch('/assets/sample.pdf');
      if (response.ok) {
        setPdfUrl('/assets/sample.pdf');
        setPdfLoaded(true);
        console.log('✅ Sample PDF loaded as fallback');
        
        // Show user that we're using a sample
        setTimeout(() => {
          alert(`⚠️ Could not load the actual PDF "${pdf.name}". Showing sample PDF for demonstration.`);
        }, 1000);
      } else {
        throw new Error('Sample PDF not found');
      }

    } catch (error) {
      console.error('❌ Error loading PDF:', error);
      setPdfError(true);
    }
  };

  // Touch gesture handlers
  const getDistance = (touch1, touch2) => {
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) + 
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  };

  const getCenter = (touch1, touch2) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  };

  const handleTouchStart = (e) => {
    const touches = e.touches;
    
    if (touches.length === 1) {
      // Single touch - start dragging
      setIsDragging(true);
      setDragStart({
        x: touches[0].clientX - translateX,
        y: touches[0].clientY - translateY
      });
    } else if (touches.length === 2) {
      // Two touches - prepare for zoom or add text
      const distance = getDistance(touches[0], touches[1]);
      const center = getCenter(touches[0], touches[1]);
      setLastTouchDistance(distance);
      setLastTouchCenter(center);
      setIsDragging(false);
    } else if (touches.length === 3) {
      // Three touches - delete mode
      e.preventDefault();
      setIsDragging(false);
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    const touches = e.touches;
    
    if (touches.length === 1 && isDragging) {
      // Single touch - pan/drag
      setTranslateX(touches[0].clientX - dragStart.x);
      setTranslateY(touches[0].clientY - dragStart.y);
    } else if (touches.length === 2) {
      // Two touches - pinch to zoom
      const distance = getDistance(touches[0], touches[1]);
      const center = getCenter(touches[0], touches[1]);
      
      if (lastTouchDistance > 0) {
        const scaleChange = distance / lastTouchDistance;
        const newScale = Math.max(0.5, Math.min(3, scale * scaleChange));
        setScale(newScale);
      }
      
      setLastTouchDistance(distance);
      setLastTouchCenter(center);
    }
  };

  const handleTouchEnd = (e) => {
    const touches = e.changedTouches;
    
    if (touches.length === 1 && e.touches.length === 0) {
      // Single touch ended
      setIsDragging(false);
    } else if (touches.length === 2 && e.touches.length === 0) {
      // Two touches ended - add text box
      const rect = pdfContainerRef.current.getBoundingClientRect();
      const x = (lastTouchCenter.x - rect.left - translateX) / scale;
      const y = (lastTouchCenter.y - rect.top - translateY) / scale;
      
      addTextElement(x, y);
      setLastTouchDistance(0);
    } else if (touches.length === 3) {
      // Three touches ended - delete selected element
      if (selectedElement) {
        deleteElement(selectedElement);
      }
    }
  };

  const addTextElement = (x, y) => {
    const newElement = {
      id: `element_${Date.now()}`,
      type: 'text',
      x: x - 75,
      y: y - 12,
      width: 150,
      height: 25,
      value: '',
      fontSize: 12,
      fontFamily: 'Arial',
      color: '#000000',
      created: new Date().toISOString()
    };

    setEditableElements(prev => [...prev, newElement]);
    setSelectedElement(newElement.id);
  };

  const addSignatureElement = () => {
    const newElement = {
      id: `element_${Date.now()}`,
      type: 'signature',
      x: 100,
      y: 100,
      width: 200,
      height: 80,
      value: '',
      fontSize: 12,
      fontFamily: 'Arial',
      color: '#000000',
      created: new Date().toISOString()
    };

    setEditableElements(prev => [...prev, newElement]);
    setSelectedElement(newElement.id);
  };

  const updateElement = (elementId, updates) => {
    setEditableElements(prev => 
      prev.map(element => 
        element.id === elementId ? { ...element, ...updates } : element
      )
    );
  };

  const deleteElement = (elementId) => {
    setEditableElements(prev => prev.filter(element => element.id !== elementId));
    setSelectedElement(null);
  };

  const deleteSelectedElement = () => {
    if (selectedElement) {
      deleteElement(selectedElement);
    }
  };

  const resetZoom = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  };

  const handleSave = () => {
    if (editableElements.length === 0) {
      alert('Please add some content to the PDF before saving');
      return;
    }

    onSave({
      pdfId: pdf.id,
      editableElements: editableElements,
      jobInfo: {
        jobId: job.id,
        jobName: job.title || job.name,
        technician: 'Current Technician',
        date: new Date().toLocaleDateString()
      },
      savedAt: new Date().toISOString()
    });
  };

  const renderEditableElement = (element) => {
    const commonStyle = {
      position: 'absolute',
      left: `${element.x}px`,
      top: `${element.y}px`,
      width: `${element.width}px`,
      height: `${element.height}px`,
      fontSize: `${element.fontSize}px`,
      fontFamily: element.fontFamily,
      color: element.color,
      zIndex: 10,
      transform: `scale(${1 / scale})`,
      transformOrigin: 'top left'
    };

    const handleElementClick = (e) => {
      e.stopPropagation();
      setSelectedElement(element.id);
    };

    switch (element.type) {
      case 'text':
        return (
          <input
            key={element.id}
            type="text"
            value={element.value}
            onChange={(e) => updateElement(element.id, { value: e.target.value })}
            onClick={handleElementClick}
            className={`editable-element text-element ${selectedElement === element.id ? 'selected' : ''}`}
            style={{
              ...commonStyle,
              background: 'rgba(255, 255, 255, 0.95)',
              border: selectedElement === element.id ? '2px solid #007bff' : '1px solid #ddd',
              borderRadius: '3px',
              padding: '2px 5px'
            }}
            placeholder="Tap to type..."
          />
        );

      case 'signature':
        return (
          <div
            key={element.id}
            onClick={handleElementClick}
            className={`editable-element signature-element ${selectedElement === element.id ? 'selected' : ''}`}
            style={{
              ...commonStyle,
              background: 'rgba(255, 255, 255, 0.95)',
              border: selectedElement === element.id ? '2px solid #007bff' : '2px dashed #ddd',
              borderRadius: '5px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '5px'
            }}
          >
            <SignatureCanvas
              elementId={element.id}
              value={element.value}
              onUpdate={(signatureData) => updateElement(element.id, { value: signatureData })}
              width={element.width - 10}
              height={element.height - 30}
              scale={scale}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateElement(element.id, { value: '' });
              }}
              style={{
                fontSize: '10px',
                padding: '2px 5px',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                marginTop: '2px'
              }}
            >
              Clear
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="pdf-editor-container">
      <div className="pdf-editor-header">
        <div className="header-left">
          <button onClick={onClose} className="close-btn">← Back</button>
          <div className="pdf-info">
            <h2>{pdf.name || 'PDF Document'}</h2>
            <p>{job.id} - PDF Editor {pdfLoaded ? '✅ Loaded' : '⏳ Loading...'}</p>
          </div>
        </div>
        
        <div className="header-right">
          <div className="simple-controls">
            <button 
              onClick={addSignatureElement}
              className="control-btn signature-btn"
            >
              ✍️ Add Signature
            </button>
            
            {selectedElement && (
              <button
                onClick={deleteSelectedElement}
                className="control-btn delete-btn"
              >
                🗑️ Delete Selected
              </button>
            )}

            <button 
              onClick={resetZoom}
              className="control-btn zoom-btn"
            >
              🔍 Reset Zoom
            </button>

            <button 
              onClick={() => setShowInstructions(!showInstructions)}
              className="control-btn help-btn"
            >
              ❓ Help
            </button>
          </div>
          
          <button onClick={handleSave} className="save-btn">💾 Save PDF</button>
        </div>
      </div>

      {showInstructions && (
        <div className="touch-instructions">
          <div className="instructions-content">
            <h4>📱 Touch Controls</h4>
            <div className="instruction-grid">
              <div className="instruction-item">
                <span className="gesture">👆 1 Touch</span>
                <span className="action">Move & pan around document</span>
              </div>
              <div className="instruction-item">
                <span className="gesture">✌️ 2 Touches</span>
                <span className="action">Pinch to zoom / Tap to add text</span>
              </div>
              <div className="instruction-item">
                <span className="gesture">👌 3 Touches</span>
                <span className="action">Delete selected element</span>
              </div>
            </div>
            <button onClick={() => setShowInstructions(false)} className="close-instructions">
              Got it! ×
            </button>
          </div>
        </div>
      )}

      <div className="pdf-editor-content">
        <div className="pdf-editor-workspace">
          
          <div className="zoom-info">
            <span>Zoom: {Math.round(scale * 100)}%</span>
            <span>Elements: {editableElements.length}</span>
            <span>PDF: {pdf.name}</span>
          </div>

          <div className="pdf-container">
            <div 
              ref={pdfContainerRef}
              className="pdf-viewer-main"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ 
                cursor: 'grab',
                overflow: 'hidden',
                touchAction: 'none'
              }}
            >
              <div 
                className="pdf-content-wrapper"
                style={{
                  transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                  transformOrigin: '0 0',
                  transition: isDragging ? 'none' : 'transform 0.1s ease'
                }}
              >
                {pdfError ? (
                  <div className="pdf-error-message">
                    <h3>❌ Error Loading PDF</h3>
                    <p>Could not load the PDF document: {pdf.name}</p>
                    <p>Job ID: {job.id}</p>
                    <code>PDF ID: {pdf.id}</code>
                  </div>
                ) : pdfLoaded && pdfUrl ? (
                  <div className="pdf-content">
                    <embed
                      src={pdfUrl}
                      type="application/pdf"
                      width="800px"
                      height="1000px"
                      style={{ 
                        pointerEvents: 'none',
                        display: 'block'
                      }}
                    />
                  </div>
                ) : (
                  <div className="pdf-placeholder">
                    <div className="placeholder-content">
                      <h3>📄 Loading PDF: {pdf.name}</h3>
                      <p>Please wait while we load the document...</p>
                      <div className="placeholder-form">
                        <div className="placeholder-section">Job ID: {job.id}</div>
                        <div className="placeholder-section">PDF ID: {pdf.id}</div>
                        <div className="placeholder-section">ServiceTitan ID: {pdf.serviceTitanId}</div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Render all editable elements */}
                {editableElements.map(element => renderEditableElement(element))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// Signature Canvas Component
function SignatureCanvas({ elementId, value, onUpdate, width, height, scale }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (value && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
    }
  }, [value]);

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let x, y;
    if (e.touches) {
      x = (e.touches[0].clientX - rect.left) / scale;
      y = (e.touches[0].clientY - rect.top) / scale;
    } else {
      x = (e.clientX - rect.left) / scale;
      y = (e.clientY - rect.top) / scale;
    }
    
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2 / scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let x, y;
    if (e.touches) {
      x = (e.touches[0].clientX - rect.left) / scale;
      y = (e.touches[0].clientY - rect.top) / scale;
    } else {
      x = (e.clientX - rect.left) / scale;
      y = (e.clientY - rect.top) / scale;
    }
    
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const signatureData = canvas.toDataURL();
    onUpdate(signatureData);
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
      style={{
        border: '1px solid #ddd',
        borderRadius: '3px',
        background: 'white',
        cursor: 'crosshair',
        touchAction: 'none'
      }}
    />
  );
}

export default PDFEditor;