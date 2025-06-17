// Adobe-Style PDF Editor - Double-click to Create, Click to Select, Drag to Move/Resize
import React, { useState, useRef, useEffect } from 'react';
import './PDFEditor.css';

function PDFEditor({ pdf, job, onClose, onSave }) {
  const pdfContainerRef = useRef(null);
  const canvasRef = useRef(null);
  
  // PDF state
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  
  // Editor state
  const [editableElements, setEditableElements] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  
  // Interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // PDF rendering
  const [scale, setScale] = useState(1.0);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });

  // Click tracking for double-click
  const [clickCount, setClickCount] = useState(0);
  const [clickTimer, setClickTimer] = useState(null);

  useEffect(() => {
    loadPDFLibrary();
    return () => {
      if (clickTimer) clearTimeout(clickTimer);
    };
  }, []);

  useEffect(() => {
    if (pdfDocument) {
      renderPage(currentPage);
    }
  }, [pdfDocument, currentPage]);

  const loadPDFLibrary = async () => {
    try {
      if (!window.pdfjsLib) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          loadPDF();
        };
        document.head.appendChild(script);
      } else {
        loadPDF();
      }
    } catch (error) {
      console.error('❌ Error loading PDF.js library:', error);
      setPdfError(true);
    }
  };

  const loadPDF = async () => {
    try {
      console.log('📄 Loading PDF for editing:', pdf.name);

      const proxyUrl = `http://localhost:3005/api/job/${job.id}/attachment/${pdf.serviceTitanId}/download`;
      
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      const loadingTask = window.pdfjsLib.getDocument(uint8Array);
      const pdfDoc = await loadingTask.promise;
      
      setPdfDocument(pdfDoc);
      setTotalPages(pdfDoc.numPages);
      setPdfLoaded(true);
      
      console.log(`✅ PDF loaded: ${pdfDoc.numPages} pages`);
      
    } catch (error) {
      console.error('❌ Error loading PDF:', error);
      setPdfError(true);
    }
  };

  const renderPage = async (pageNum) => {
    if (!pdfDocument || !canvasRef.current) return;
    
    try {
      const page = await pdfDocument.getPage(pageNum);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Calculate scale to fit container width with padding
      const container = pdfContainerRef.current;
      const containerWidth = container.clientWidth - 60; // More padding for centering
      const pageViewport = page.getViewport({ scale: 1 });
      const calculatedScale = Math.min(containerWidth / pageViewport.width, 1.5);
      
      setScale(calculatedScale);
      
      const viewport = page.getViewport({ scale: calculatedScale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      setPdfDimensions({ width: viewport.width, height: viewport.height });
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      console.log(`✅ Rendered page ${pageNum}/${totalPages} at ${Math.round(calculatedScale * 100)}% scale`);
      
    } catch (error) {
      console.error(`❌ Error rendering page ${pageNum}:`, error);
    }
  };

  // Handle canvas clicks (single and double-click)
  const handleCanvasClick = (e) => {
    if (isDragging || isResizing) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if clicking on an existing element
    const clickedElement = findElementAtPosition(x, y);
    
    if (clickedElement) {
      // Single click on element = select it
      setSelectedElement(clickedElement.id);
      return;
    }
    
    // Click on empty space - handle double-click detection
    setClickCount(prev => prev + 1);
    
    if (clickTimer) clearTimeout(clickTimer);
    
    const timer = setTimeout(() => {
      if (clickCount === 1) {
        // Single click on empty space = deselect
        setSelectedElement(null);
      }
      setClickCount(0);
    }, 300);
    
    setClickTimer(timer);
    
    // Check for double-click
    if (clickCount === 1) {
      // Double-click on empty space = create text field
      createTextField(x - 75, y - 12, 150, 25);
      setClickCount(0);
      if (clickTimer) clearTimeout(clickTimer);
    }
  };

  const handleMouseDown = (e, elementId) => {
    e.stopPropagation();
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const element = editableElements.find(el => el.id === elementId);
    if (!element) return;
    
    setSelectedElement(elementId);
    
    // Check if clicking on a resize handle
    const handle = getResizeHandle(x, y, element);
    
    if (handle) {
      setIsResizing(true);
      setResizeHandle(handle);
      document.body.style.cursor = getResizeCursor(handle);
    } else {
      // Start dragging the element
      setIsDragging(true);
      setDragOffset({
        x: x - element.x,
        y: y - element.y
      });
      document.body.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging && !isResizing) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (isDragging && selectedElement) {
      // Move element
      const newX = Math.max(0, Math.min(x - dragOffset.x, pdfDimensions.width - 20));
      const newY = Math.max(0, Math.min(y - dragOffset.y, pdfDimensions.height - 20));
      
      updateElement(selectedElement, {
        x: newX,
        y: newY
      });
    } else if (isResizing && selectedElement && resizeHandle) {
      // Resize element
      const element = editableElements.find(el => el.id === selectedElement);
      if (element) {
        const newBounds = calculateResize(element, x, y, resizeHandle);
        updateElement(selectedElement, newBounds);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
    setDragOffset({ x: 0, y: 0 });
    document.body.style.cursor = 'default';
  };

  // Add global mouse event listeners
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, selectedElement, dragOffset, resizeHandle]);

  const createTextField = (x, y, width, height) => {
    const newElement = {
      id: `element_${Date.now()}`,
      type: 'text',
      x: Math.max(0, Math.min(x, pdfDimensions.width - width)),
      y: Math.max(0, Math.min(y, pdfDimensions.height - height)),
      width,
      height,
      value: '',
      fontSize: Math.max(12, Math.min(height - 4, 18)),
      fontFamily: 'Arial',
      color: '#000000',
      page: currentPage,
      isPdfField: false,
      created: new Date().toISOString()
    };

    setEditableElements(prev => [...prev, newElement]);
    setSelectedElement(newElement.id);
  };

  const createSignatureField = () => {
    const centerX = Math.max(0, pdfDimensions.width / 2 - 100);
    const centerY = Math.max(0, pdfDimensions.height / 2 - 40);
    
    const newElement = {
      id: `element_${Date.now()}`,
      type: 'signature',
      x: centerX,
      y: centerY,
      width: 200,
      height: 80,
      value: '',
      page: currentPage,
      isPdfField: false,
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

  const deleteSelectedElement = () => {
    if (selectedElement) {
      setEditableElements(prev => prev.filter(element => element.id !== selectedElement));
      setSelectedElement(null);
    }
  };

  // Helper functions
  const findElementAtPosition = (x, y) => {
    return editableElements
      .filter(el => el.page === currentPage)
      .reverse()
      .find(element => 
        x >= element.x && 
        x <= element.x + element.width &&
        y >= element.y && 
        y <= element.y + element.height
      );
  };

  const getResizeHandle = (x, y, element) => {
    const handleSize = 8;
    const { x: ex, y: ey, width, height } = element;
    
    // Check corners first (they take priority)
    if (x >= ex + width - handleSize && y >= ey + height - handleSize) return 'se';
    if (x <= ex + handleSize && y >= ey + height - handleSize) return 'sw';
    if (x >= ex + width - handleSize && y <= ey + handleSize) return 'ne';
    if (x <= ex + handleSize && y <= ey + handleSize) return 'nw';
    
    // Check edges
    if (Math.abs(x - (ex + width)) <= handleSize/2 && y >= ey + handleSize && y <= ey + height - handleSize) return 'e';
    if (Math.abs(x - ex) <= handleSize/2 && y >= ey + handleSize && y <= ey + height - handleSize) return 'w';
    if (Math.abs(y - (ey + height)) <= handleSize/2 && x >= ex + handleSize && x <= ex + width - handleSize) return 's';
    if (Math.abs(y - ey) <= handleSize/2 && x >= ex + handleSize && x <= ex + width - handleSize) return 'n';
    
    return null;
  };

  const getResizeCursor = (handle) => {
    switch (handle) {
      case 'nw': case 'se': return 'nw-resize';
      case 'ne': case 'sw': return 'ne-resize';
      case 'n': case 's': return 'n-resize';
      case 'e': case 'w': return 'e-resize';
      default: return 'default';
    }
  };

  const calculateResize = (element, x, y, handle) => {
    const { x: ex, y: ey, width, height } = element;
    const minSize = 20;
    let newBounds = { ...element };
    
    switch (handle) {
      case 'se':
        newBounds.width = Math.max(minSize, x - ex);
        newBounds.height = Math.max(minSize, y - ey);
        break;
      case 'sw':
        newBounds.x = Math.min(x, ex + width - minSize);
        newBounds.width = Math.max(minSize, ex + width - x);
        newBounds.height = Math.max(minSize, y - ey);
        break;
      case 'ne':
        newBounds.width = Math.max(minSize, x - ex);
        newBounds.y = Math.min(y, ey + height - minSize);
        newBounds.height = Math.max(minSize, ey + height - y);
        break;
      case 'nw':
        newBounds.x = Math.min(x, ex + width - minSize);
        newBounds.y = Math.min(y, ey + height - minSize);
        newBounds.width = Math.max(minSize, ex + width - x);
        newBounds.height = Math.max(minSize, ey + height - y);
        break;
      case 'e':
        newBounds.width = Math.max(minSize, x - ex);
        break;
      case 'w':
        newBounds.x = Math.min(x, ex + width - minSize);
        newBounds.width = Math.max(minSize, ex + width - x);
        break;
      case 's':
        newBounds.height = Math.max(minSize, y - ey);
        break;
      case 'n':
        newBounds.y = Math.min(y, ey + height - minSize);
        newBounds.height = Math.max(minSize, ey + height - y);
        break;
    }
    
    return newBounds;
  };

  const handleSave = async () => {
    if (editableElements.length === 0) {
      alert('Please add some fields to the PDF before saving');
      return;
    }

    try {
      console.log('💾 Saving PDF with form data...');
      
      const saveData = {
        pdfId: pdf.id,
        serviceTitanId: pdf.serviceTitanId,
        originalFileName: pdf.fileName,
        editableElements: editableElements,
        jobInfo: {
          jobId: job.id,
          jobNumber: job.number,
          jobTitle: job.title,
          customerName: job.customer?.name
        },
        savedAt: new Date().toISOString(),
        pageCount: totalPages
      };
      
      onSave(saveData);
      
    } catch (error) {
      console.error('❌ Error saving PDF:', error);
      alert('Error saving PDF. Please try again.');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelectedElement();
    } else if (e.key === 'Escape') {
      setSelectedElement(null);
    }
  };

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement]);

  const renderElement = (element) => {
    if (element.page !== currentPage) return null;
    
    const isSelected = selectedElement === element.id;
    
    const elementStyle = {
      position: 'absolute',
      left: `${element.x}px`,
      top: `${element.y}px`,
      width: `${element.width}px`,
      height: `${element.height}px`,
      border: isSelected ? '2px solid #007bff' : '1px solid #ccc',
      borderRadius: '2px',
      background: 'rgba(255, 255, 255, 0.95)',
      fontSize: `${element.fontSize}px`,
      fontFamily: element.fontFamily,
      color: element.color,
      zIndex: isSelected ? 1000 : 100,
      cursor: 'grab',
      userSelect: 'none'
    };

    if (element.type === 'text') {
      return (
        <input
          key={element.id}
          type="text"
          value={element.value}
          onChange={(e) => updateElement(element.id, { value: e.target.value })}
          onMouseDown={(e) => handleMouseDown(e, element.id)}
          style={{
            ...elementStyle,
            padding: '2px 4px',
            outline: 'none',
            cursor: 'text'
          }}
          placeholder="Text field"
        />
      );
    } else if (element.type === 'signature') {
      return (
        <div
          key={element.id}
          onMouseDown={(e) => handleMouseDown(e, element.id)}
          style={{
            ...elementStyle,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            border: isSelected ? '2px solid #007bff' : '2px dashed #999',
            cursor: 'grab'
          }}
        >
          <SignatureCanvas
            elementId={element.id}
            value={element.value}
            onUpdate={(signatureData) => updateElement(element.id, { value: signatureData })}
            width={element.width - 8}
            height={element.height - 20}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateElement(element.id, { value: '' });
            }}
            style={{
              fontSize: '10px',
              padding: '1px 4px',
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
    }
    
    return null;
  };

  const renderResizeHandles = () => {
    const element = editableElements.find(el => el.id === selectedElement);
    if (!element || element.page !== currentPage) return null;
    
    const handleSize = 8;
    const handleStyle = {
      position: 'absolute',
      width: `${handleSize}px`,
      height: `${handleSize}px`,
      background: '#007bff',
      border: '1px solid white',
      borderRadius: '1px',
      zIndex: 1001
    };
    
    return (
      <>
        {/* Corner handles */}
        <div style={{ ...handleStyle, left: `${element.x - handleSize/2}px`, top: `${element.y - handleSize/2}px`, cursor: 'nw-resize' }} />
        <div style={{ ...handleStyle, left: `${element.x + element.width - handleSize/2}px`, top: `${element.y - handleSize/2}px`, cursor: 'ne-resize' }} />
        <div style={{ ...handleStyle, left: `${element.x - handleSize/2}px`, top: `${element.y + element.height - handleSize/2}px`, cursor: 'sw-resize' }} />
        <div style={{ ...handleStyle, left: `${element.x + element.width - handleSize/2}px`, top: `${element.y + element.height - handleSize/2}px`, cursor: 'se-resize' }} />
        
        {/* Edge handles */}
        <div style={{ ...handleStyle, left: `${element.x + element.width/2 - handleSize/2}px`, top: `${element.y - handleSize/2}px`, cursor: 'n-resize' }} />
        <div style={{ ...handleStyle, left: `${element.x + element.width/2 - handleSize/2}px`, top: `${element.y + element.height - handleSize/2}px`, cursor: 's-resize' }} />
        <div style={{ ...handleStyle, left: `${element.x - handleSize/2}px`, top: `${element.y + element.height/2 - handleSize/2}px`, cursor: 'w-resize' }} />
        <div style={{ ...handleStyle, left: `${element.x + element.width - handleSize/2}px`, top: `${element.y + element.height/2 - handleSize/2}px`, cursor: 'e-resize' }} />
      </>
    );
  };

  return (
    <div className="pdf-editor-container">
      {/* Header */}
      <div className="pdf-editor-header">
        <div className="header-left">
          <button onClick={onClose} className="close-btn">← Back</button>
          <div className="pdf-info">
            <h2>{pdf.name || 'PDF Form'}</h2>
            <p>Job {job.number} - Double-click to add fields</p>
          </div>
        </div>
        
        <div className="header-right">
          <button 
            onClick={createSignatureField}
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
            onClick={() => setShowHelp(!showHelp)}
            className="control-btn help-btn"
          >
            ❓ Help
          </button>
          
          <button onClick={handleSave} className="save-btn">
            💾 Save Form ({editableElements.filter(e => e.page === currentPage).length} fields)
          </button>
        </div>
      </div>

      {/* Help Panel */}
      {showHelp && (
        <div className="help-panel">
          <h4>🖱️ How to Use (Like Adobe Acrobat)</h4>
          <div className="help-items">
            <div className="help-item">
              <span className="gesture">Double-Click Empty Space</span>
              <span className="action">Create text field</span>
            </div>
            <div className="help-item">
              <span className="gesture">Single Click Field</span>
              <span className="action">Select field (shows corners)</span>
            </div>
            <div className="help-item">
              <span className="gesture">Drag Field</span>
              <span className="action">Move field</span>
            </div>
            <div className="help-item">
              <span className="gesture">Drag Blue Corners</span>
              <span className="action">Resize field</span>
            </div>
            <div className="help-item">
              <span className="gesture">Delete Key</span>
              <span className="action">Delete selected field</span>
            </div>
          </div>
        </div>
      )}

      {/* PDF Content */}
      <div className="pdf-editor-content">
        {totalPages > 1 && (
          <div className="page-controls">
            <button 
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="page-btn"
            >
              ◀ Prev
            </button>
            <span className="page-info">Page {currentPage} of {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="page-btn"
            >
              Next ▶
            </button>
          </div>
        )}

        <div 
          ref={pdfContainerRef}
          className="pdf-container-centered"
        >
          {pdfError ? (
            <div className="pdf-error">
              <h3>❌ Error Loading PDF</h3>
              <p>Could not load: {pdf.name}</p>
            </div>
          ) : pdfLoaded ? (
            <div className="pdf-wrapper">
              {/* PDF Canvas */}
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                style={{
                  display: 'block',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                  cursor: 'default'
                }}
              />
              
              {/* Overlay for elements */}
              <div
                className="pdf-overlay"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${pdfDimensions.width}px`,
                  height: `${pdfDimensions.height}px`,
                  pointerEvents: 'none',
                  userSelect: 'none'
                }}
              >
                {/* Editable Elements */}
                <div style={{ pointerEvents: 'auto' }}>
                  {editableElements.map(element => renderElement(element))}
                </div>
                
                {/* Resize Handles */}
                <div style={{ pointerEvents: 'auto' }}>
                  {renderResizeHandles()}
                </div>
              </div>
            </div>
          ) : (
            <div className="pdf-loading">
              <div className="loading-spinner"></div>
              <p>Loading PDF: {pdf.name}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Signature Canvas Component
function SignatureCanvas({ elementId, value, onUpdate, width, height }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (value && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, width, height);
      img.src = value;
    }
  }, [value, width, height]);

  const startDrawing = (e) => {
    e.stopPropagation();
    setIsDrawing(true);
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    e.stopPropagation();
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    e.stopPropagation();
    
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const signatureData = canvas.toDataURL('image/png');
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
      style={{
        border: '1px solid #ddd',
        borderRadius: '3px',
        background: 'white',
        cursor: 'crosshair'
      }}
    />
  );
}

export default PDFEditor;