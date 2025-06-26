// src/pages/PDFEditor/PDFEditor.jsx - Simple, User-Friendly PDF Editor
import React, { useState, useRef, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';

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

  // PDF Loading
  const loadPDF = useCallback(async () => {
    try {
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

      const downloadUrl = apiClient.getAttachmentDownloadUrl(job.id, pdf.serviceTitanId || pdf.id);
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
    if (!pdfDocument || !canvasRef.current) return;
    
    try {
      const page = await pdfDocument.getPage(currentPage);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      const viewport = page.getViewport({ scale });
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      context.clearRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
    } catch (error) {
      console.error('❌ Page rendering error:', error);
    }
  }, [pdfDocument, currentPage, scale]);

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
    setEditingId(id);
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

  useEffect(() => {
    loadPDF();
  }, [loadPDF]);

  useEffect(() => {
    if (pdfDocument) renderPage();
  }, [renderPage, pdfDocument]);

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
    clearAllObjects
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

// Simple Editable Field Component
function EditableField({ object, scale, selected, editing, onUpdate, onSelect, onStartEdit, onFinishEdit }) {
  const [value, setValue] = useState(object.content || '');
  
  useEffect(() => {
    setValue(object.content || '');
  }, [object.content]);

  const style = {
    position: 'absolute',
    left: `${object.x * scale}px`,
    top: `${object.y * scale}px`,
    width: `${object.width * scale}px`,
    height: `${object.height * scale}px`,
    zIndex: selected ? 1000 : 100,
    border: selected ? '3px solid #007bff' : '2px solid transparent',
    borderRadius: '4px',
    background: selected ? 'rgba(0, 123, 255, 0.1)' : 'rgba(255, 255, 255, 0.95)',
    cursor: 'pointer'
  };

  const handleClick = (e) => {
    e.stopPropagation();
    onSelect(object.id);
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (object.type === 'text') {
      onStartEdit(object.id);
    }
  };

  const handleSave = () => {
    onUpdate(object.id, { content: value });
    onFinishEdit();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  if (object.type === 'text') {
    return (
      <div style={style} onClick={handleClick} onDoubleClick={handleDoubleClick}>
        {editing ? (
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleSave}
            onKeyPress={handleKeyPress}
            placeholder="Enter text here..."
            autoFocus
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: 'transparent',
              fontSize: `${Math.max(12, object.fontSize * scale)}px`,
              color: object.color,
              outline: 'none',
              padding: '2px'
            }}
          />
        ) : (
          <div style={{
            padding: '2px',
            fontSize: `${Math.max(12, object.fontSize * scale)}px`,
            color: object.color,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            opacity: object.content ? 1 : 0.6
          }}>
            {object.content || 'Click to edit text'}
          </div>
        )}
      </div>
    );
  }

  if (object.type === 'signature') {
    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: selected ? '3px solid #28a745' : '2px dashed #ccc',
          background: selected ? 'rgba(40, 167, 69, 0.1)' : 'rgba(255, 255, 255, 0.95)'
        }}
        onClick={handleClick}
      >
        {object.content ? (
          <img 
            src={object.content} 
            alt="Signature" 
            style={{ 
              maxWidth: '100%', 
              maxHeight: '100%',
              objectFit: 'contain'
            }} 
          />
        ) : (
          <span style={{ color: '#666', fontSize: '14px', textAlign: 'center' }}>
            Click to add<br/>signature
          </span>
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
    clearAllObjects
  } = usePDFEditor(pdf, job);

  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(true);

  const currentObjects = objects.filter(obj => obj.page === currentPage);

  const handleCanvasClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    addTextObject(x, y);
  }, [addTextObject, canvasRef]);

  const handleAddSignature = () => {
    addSignatureObject(100, 100);
    setShowSignatureDialog(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const saveData = {
        pdfId: pdf.id,
        serviceTitanId: pdf.serviceTitanId || pdf.id,
        originalFileName: pdf.fileName || pdf.name,
        editableElements: objects,
        jobInfo: {
          jobId: job.id,
          jobNumber: job.number,
          jobTitle: job.title
        },
        savedAt: new Date().toISOString()
      };
      
      await onSave(saveData);
    } catch (error) {
      console.error('❌ Save error:', error);
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
            disabled={isSaving}
            className="btn btn-success btn-lg"
          >
            {isSaving ? '💾 Saving...' : '💾 Save Completed Form'}
          </button>
        </div>
      </div>

      {/* Help Instructions */}
      {showHelp && (
        <div className="help-banner">
          <div className="help-content">
            <h4>📝 How to Fill This Form:</h4>
            <div className="help-steps">
              <span>1️⃣ Click anywhere to add text</span>
              <span>2️⃣ Use "Add Signature" button</span>
              <span>3️⃣ Click fields to edit them</span>
              <span>4️⃣ Save when done</span>
            </div>
            <button onClick={() => setShowHelp(false)} className="help-close">
              Got it! ✕
            </button>
          </div>
        </div>
      )}

      {/* Simple Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <button 
            onClick={handleAddSignature}
            className="btn btn-primary"
          >
            ✍️ Add Signature
          </button>
          {selectedId && (
            <button
              onClick={() => deleteObject(selectedId)}
              className="btn btn-error"
            >
              🗑️ Delete Selected
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

        <div className="toolbar-center">
          {totalPages > 1 && (
            <div className="page-controls">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
                className="btn btn-ghost"
              >
                ← Prev
              </button>
              <span className="page-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
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
            >
              🔍-
            </button>
            <span className="zoom-level">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale(prev => Math.min(2, prev + 0.2))}
              className="btn btn-ghost"
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
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="pdf-canvas"
              style={{
                cursor: 'crosshair',
                maxWidth: '100%',
                height: 'auto'
              }}
            />

            {/* Render Editable Fields */}
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
        )}
      </div>

      {/* Signature Dialog */}
      <SignatureDialog
        isOpen={showSignatureDialog}
        onClose={() => setShowSignatureDialog(false)}
        onSave={handleSignatureSave}
      />

      {/* Floating Help Button */}
      {!showHelp && (
        <button 
          onClick={() => setShowHelp(true)}
          className="help-float-btn"
          title="Show help"
        >
          ❓
        </button>
      )}
    </div>
  );
}

// Simple, clean styles
const editorStyles = `
.pdf-editor-simple {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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

.help-banner {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: white;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e9ecef;
}

.help-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.help-steps {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.help-steps span {
  background: rgba(255,255,255,0.2);
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.9rem;
}

.help-close {
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  cursor: pointer;
  font-weight: bold;
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

.pdf-wrapper {
  position: relative;
  background: white;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  border-radius: 8px;
  overflow: hidden;
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

.help-float-btn {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #007bff;
  color: white;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0,123,255,0.3);
  z-index: 1000;
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
  
  .help-steps {
    justify-content: center;
  }
  .signature-dialog {
    margin: 1rem;
    width: auto;
  }
}
`;

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('simple-pdf-editor-styles')) {
  const style = document.createElement('style');
  style.id = 'simple-pdf-editor-styles';
  style.textContent = editorStyles;
  document.head.appendChild(style);
}