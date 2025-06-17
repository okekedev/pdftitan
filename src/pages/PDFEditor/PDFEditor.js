// Enhanced PDF Editor Implementation with Form Support
// This replaces the PDFEditor.js component

import React, { useState, useRef, useEffect } from 'react';
import './PDFEditor.css';

function PDFEditor({ pdf, job, onClose, onSave }) {
  const pdfContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [editableElements, setEditableElements] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [showInstructions, setShowInstructions] = useState(true);
  
  // PDF rendering state
  const [scale, setScale] = useState(1.2);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);

  // Load PDF.js library and render PDF
  useEffect(() => {
    loadPDFLibrary();
  }, []);

  useEffect(() => {
    if (pdfDocument) {
      renderPage(currentPage);
    }
  }, [pdfDocument, currentPage, scale]);

  const loadPDFLibrary = async () => {
    try {
      // Load PDF.js library from CDN
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
      console.log('📄 Loading PDF for editing:', {
        pdfName: pdf.name,
        serviceTitanId: pdf.serviceTitanId,
        jobId: job.id
      });

      // Get PDF data from our server
      const proxyUrl = `http://localhost:3005/api/job/${job.id}/attachment/${pdf.serviceTitanId}/download`;
      
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Load PDF with PDF.js
      const loadingTask = window.pdfjsLib.getDocument(uint8Array);
      const pdfDoc = await loadingTask.promise;
      
      setPdfDocument(pdfDoc);
      setTotalPages(pdfDoc.numPages);
      setPdfLoaded(true);
      
      console.log(`✅ PDF loaded: ${pdfDoc.numPages} pages`);
      
      // Load any existing form fields or annotations
      await loadExistingFormFields(pdfDoc);
      
    } catch (error) {
      console.error('❌ Error loading PDF:', error);
      setPdfError(true);
    }
  };

  const loadExistingFormFields = async (pdfDoc) => {
    try {
      // Get the first page to check for form fields
      const page = await pdfDoc.getPage(1);
      const annotations = await page.getAnnotations();
      
      const formElements = [];
      
      annotations.forEach((annotation, index) => {
        if (annotation.subtype === 'Widget' && annotation.fieldType) {
          // Convert PDF annotation to our editable element format
          const element = {
            id: `pdf_field_${index}`,
            type: annotation.fieldType === 'Tx' ? 'text' : 'signature',
            x: annotation.rect[0] * scale,
            y: (page.view[3] - annotation.rect[3]) * scale, // PDF coordinates are bottom-up
            width: (annotation.rect[2] - annotation.rect[0]) * scale,
            height: (annotation.rect[3] - annotation.rect[1]) * scale,
            value: annotation.fieldValue || '',
            fontSize: 12,
            fontFamily: 'Arial',
            color: '#000000',
            fieldName: annotation.fieldName,
            isPdfField: true,
            page: 1
          };
          formElements.push(element);
        }
      });
      
      if (formElements.length > 0) {
        console.log(`📋 Found ${formElements.length} existing form fields`);
        setEditableElements(formElements);
      }
      
    } catch (error) {
      console.error('❌ Error loading form fields:', error);
    }
  };

  const renderPage = async (pageNum) => {
    if (!pdfDocument || !canvasRef.current) return;
    
    try {
      const page = await pdfDocument.getPage(pageNum);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      const viewport = page.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      console.log(`✅ Rendered page ${pageNum}/${totalPages}`);
      
    } catch (error) {
      console.error(`❌ Error rendering page ${pageNum}:`, error);
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
      page: currentPage,
      isPdfField: false,
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

  const deleteElement = (elementId) => {
    setEditableElements(prev => prev.filter(element => element.id !== elementId));
    setSelectedElement(null);
  };

  const handleSave = async () => {
    if (editableElements.length === 0) {
      alert('Please add some content to the PDF before saving');
      return;
    }

    try {
      console.log('💾 Saving PDF with form data...');
      
      // Create a filled PDF with our form data
      const filledPdfData = await createFilledPDF();
      
      const saveData = {
        pdfId: pdf.id,
        serviceTitanId: pdf.serviceTitanId,
        originalFileName: pdf.fileName,
        editableElements: editableElements,
        filledPdfData: filledPdfData, // Base64 or binary data
        jobInfo: {
          jobId: job.id,
          jobNumber: job.number,
          jobTitle: job.title,
          customerName: job.customer?.name,
          technician: 'Current Technician'
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

  const createFilledPDF = async () => {
    try {
      // This would use a library like PDF-lib to create a new PDF with filled forms
      // For now, we'll return the form data that can be saved to ServiceTitan
      
      const formData = editableElements.map(element => ({
        id: element.id,
        type: element.type,
        value: element.value,
        position: {
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height
        },
        page: element.page,
        fieldName: element.fieldName,
        isPdfField: element.isPdfField
      }));
      
      return {
        type: 'form_data',
        elements: formData,
        metadata: {
          totalPages: totalPages,
          scale: scale,
          savedAt: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('❌ Error creating filled PDF:', error);
      throw error;
    }
  };

  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - translateX) / scale;
    const y = (e.clientY - rect.top - translateY) / scale;
    
    addTextElement(x, y);
  };

  const renderEditableElement = (element) => {
    // Only show elements for current page
    if (element.page !== currentPage) return null;
    
    const commonStyle = {
      position: 'absolute',
      left: `${element.x}px`,
      top: `${element.y}px`,
      width: `${element.width}px`,
      height: `${element.height}px`,
      fontSize: `${element.fontSize}px`,
      fontFamily: element.fontFamily,
      color: element.color,
      zIndex: 20,
      border: selectedElement === element.id ? '2px solid #007bff' : '1px solid #ddd',
      background: 'rgba(255, 255, 255, 0.95)'
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
              borderRadius: '3px',
              padding: '2px 5px'
            }}
            placeholder={element.isPdfField ? element.fieldName : "Enter text..."}
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
            <p>{job.id} - Form Editor {pdfLoaded ? '✅ Ready' : '⏳ Loading...'}</p>
          </div>
        </div>
        
        <div className="header-right">
          <div className="simple-controls">
            {totalPages > 1 && (
              <>
                <button 
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  className="control-btn"
                  disabled={currentPage === 1}
                >
                  ◀ Prev
                </button>
                <span style={{ padding: '0 1rem', color: 'white' }}>
                  {currentPage} / {totalPages}
                </span>
                <button 
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  className="control-btn"
                  disabled={currentPage === totalPages}
                >
                  Next ▶
                </button>
              </>
            )}
            
            <button 
              onClick={addSignatureElement}
              className="control-btn signature-btn"
            >
              ✍️ Add Signature
            </button>
            
            {selectedElement && (
              <button
                onClick={() => deleteElement(selectedElement)}
                className="control-btn delete-btn"
              >
                🗑️ Delete Selected
              </button>
            )}

            <button 
              onClick={() => setScale(scale === 1.2 ? 1.5 : 1.2)}
              className="control-btn zoom-btn"
            >
              🔍 Zoom {Math.round(scale * 100)}%
            </button>
          </div>
          
          <button onClick={handleSave} className="save-btn">💾 Save Completed Form</button>
        </div>
      </div>

      {showInstructions && (
        <div className="touch-instructions">
          <div className="instructions-content">
            <h4>📝 PDF Form Editor</h4>
            <div className="instruction-grid">
              <div className="instruction-item">
                <span className="gesture">👆 Click</span>
                <span className="action">Add text field at clicked location</span>
              </div>
              <div className="instruction-item">
                <span className="gesture">✍️ Signature</span>
                <span className="action">Add signature field (use button above)</span>
              </div>
              <div className="instruction-item">
                <span className="gesture">📝 Fill Fields</span>
                <span className="action">Click any field to edit its content</span>
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
            <span>Page: {currentPage}/{totalPages}</span>
            <span>Fields: {editableElements.filter(e => e.page === currentPage).length}</span>
            <span>PDF: {pdf.name}</span>
          </div>

          <div className="pdf-container">
            <div 
              ref={pdfContainerRef}
              className="pdf-viewer-main"
              style={{ 
                cursor: 'crosshair',
                overflow: 'auto',
                position: 'relative'
              }}
            >
              {pdfError ? (
                <div className="pdf-error-message">
                  <h3>❌ Error Loading PDF</h3>
                  <p>Could not load the PDF document: {pdf.name}</p>
                  <p>Job ID: {job.id}</p>
                </div>
              ) : pdfLoaded ? (
                <div style={{ position: 'relative' }}>
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    style={{
                      display: 'block',
                      border: '1px solid #ddd',
                      cursor: 'crosshair'
                    }}
                  />
                  
                  {/* Render editable elements over the PDF */}
                  {editableElements.map(element => renderEditableElement(element))}
                </div>
              ) : (
                <div className="pdf-placeholder">
                  <div className="placeholder-content">
                    <h3>📄 Loading PDF Form: {pdf.name}</h3>
                    <p>Please wait while we prepare the form for editing...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Enhanced Signature Canvas Component
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
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let x, y;
    if (e.touches) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
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
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let x, y;
    if (e.touches) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
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