// src/pages/PDFEditor/PDFEditor.jsx - Modern JSX with Simplified Interface
import React, { useState, useRef, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';

// Custom hook for PDF operations
function usePDFEditor(pdf, job) {
  const canvasRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [objects, setObjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

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

  // History Management
  const saveToHistory = useCallback((newObjects) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push([...newObjects]);
      return newHistory.slice(-20); // Keep last 20 states
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setObjects(history[historyIndex - 1]);
      setSelectedId(null);
      setEditingId(null);
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setObjects(history[historyIndex + 1]);
      setSelectedId(null);
      setEditingId(null);
    }
  }, [historyIndex, history]);

  // Object Management
  const addTextObject = useCallback((x = 100, y = 100) => {
    const id = Date.now().toString();
    const newText = {
      id,
      type: 'text',
      x: x / scale,
      y: y / scale,
      width: 200 / scale,
      height: 40 / scale,
      content: '',
      fontSize: 16,
      color: '#000000',
      page: currentPage
    };
    
    setObjects(prev => {
      const newObjects = [...prev, newText];
      saveToHistory(newObjects);
      return newObjects;
    });
    setSelectedId(id);
    setEditingId(id);
  }, [scale, currentPage, saveToHistory]);

  const addSignatureObject = useCallback((x = 100, y = 100) => {
    const id = Date.now().toString();
    const newSig = {
      id,
      type: 'signature',
      x: x / scale,
      y: y / scale,
      width: 250 / scale,
      height: 100 / scale,
      content: null,
      page: currentPage
    };
    
    setObjects(prev => {
      const newObjects = [...prev, newSig];
      saveToHistory(newObjects);
      return newObjects;
    });
    setSelectedId(id);
  }, [scale, currentPage, saveToHistory]);

  const updateObject = useCallback((id, updates) => {
    setObjects(prev => prev.map(obj => obj.id === id ? { ...obj, ...updates } : obj));
  }, []);

  const deleteObject = useCallback((id) => {
    setObjects(prev => {
      const newObjects = prev.filter(obj => obj.id !== id);
      saveToHistory(newObjects);
      return newObjects;
    });
    setSelectedId(null);
    setEditingId(null);
  }, [saveToHistory]);

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
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1
  };
}

// Editable Object Component
function EditableObject({ object, scale, selected, editing, onUpdate, onSelect, onStartEdit, onFinishEdit }) {
  const [content, setContent] = useState(object.content || '');
  const [isEditing, setIsEditing] = useState(editing);
  
  useEffect(() => {
    setIsEditing(editing);
    if (editing) {
      setContent(object.content || '');
    }
  }, [editing, object.content]);

  const style = {
    position: 'absolute',
    left: `${object.x * scale}px`,
    top: `${object.y * scale}px`,
    width: `${object.width * scale}px`,
    height: `${object.height * scale}px`,
    cursor: selected ? 'move' : 'pointer',
    zIndex: selected ? 1000 : 100
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
    onUpdate(object.id, { content });
    onFinishEdit();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setContent(object.content || '');
      onFinishEdit();
    }
  };

  if (object.type === 'text') {
    return (
      <div
        style={{
          ...style,
          background: selected ? 'rgba(102, 126, 234, 0.1)' : 'rgba(255, 255, 255, 0.9)',
          border: selected ? '2px solid var(--primary-color)' : '1px solid transparent',
          borderRadius: '4px',
          padding: '8px',
          boxShadow: selected ? '0 0 0 2px rgba(102, 126, 234, 0.2)' : 'none'
        }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {isEditing ? (
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            placeholder="Type here..."
            autoFocus
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              fontSize: `${object.fontSize * scale}px`,
              color: object.color,
              outline: 'none',
              padding: 0,
              margin: 0
            }}
          />
        ) : (
          <span
            style={{
              fontSize: `${object.fontSize * scale}px`,
              color: object.color,
              userSelect: 'none',
              opacity: object.content ? 1 : 0.5
            }}
          >
            {object.content || 'Double-click to edit'}
          </span>
        )}
      </div>
    );
  }

  if (object.type === 'signature') {
    return (
      <div
        style={{
          ...style,
          background: 'rgba(255, 255, 255, 0.95)',
          border: selected ? '2px solid var(--success-color)' : '2px dashed #ccc',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: selected ? '0 0 0 2px rgba(72, 187, 120, 0.2)' : 'none'
        }}
        onClick={handleClick}
      >
        {object.content ? (
          <span style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>
            ✓ Signature Applied
          </span>
        ) : (
          <span style={{ color: '#666', fontSize: '0.9rem' }}>
            Click to add signature
          </span>
        )}
      </div>
    );
  }

  return null;
}

// Simple Signature Dialog Component
function SignatureDialog({ isOpen, onClose, onSave }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000';
    }
  }, [isOpen]);

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    const dataURL = canvas.toDataURL();
    onSave(dataURL);
    clearSignature();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="signature-dialog-overlay">
      <div className="signature-dialog card">
        <div className="card-header">
          <h3 className="card-title">Add Your Signature</h3>
          <button 
            onClick={onClose}
            className="btn btn-sm btn-ghost"
            aria-label="Close signature dialog"
          >
            ✕
          </button>
        </div>
        
        <div className="card-body">
          <p className="text-gray-600 mb-3">Draw your signature in the box below:</p>
          
          <div className="signature-canvas-container">
            <canvas
              ref={canvasRef}
              width={400}
              height={200}
              className="signature-canvas"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
          </div>
        </div>
        
        <div className="card-footer">
          <button 
            onClick={clearSignature}
            className="btn btn-secondary"
          >
            🗑️ Clear
          </button>
          <button 
            onClick={saveSignature}
            className="btn btn-primary"
          >
            ✓ Save Signature
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
    updateObject,
    deleteObject,
    undo,
    redo,
    canUndo,
    canRedo
  } = usePDFEditor(pdf, job);

  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [tool, setTool] = useState('select');
  const [isSaving, setIsSaving] = useState(false);

  const currentObjects = objects.filter(obj => obj.page === currentPage);

  const handleCanvasClick = useCallback((e) => {
    if (tool === 'text') {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      addTextObject(x, y);
      setTool('select');
    } else if (tool === 'signature') {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      addSignatureObject(x, y);
      setShowSignatureDialog(true);
      setTool('select');
    } else {
      setSelectedId(null);
      setEditingId(null);
    }
  }, [tool, addTextObject, addSignatureObject, canvasRef, setSelectedId, setEditingId]);

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

  if (pdfError) {
    return (
      <div className="page-container">
        <div className="alert alert-error">
          <span>❌</span>
          <div>
            <strong>Error Loading PDF</strong>
            <p>{pdfError}</p>
          </div>
        </div>
        <div className="text-center mt-4">
          <button onClick={onClose} className="btn btn-primary">
            ← Back to Forms
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-editor">
      {/* Header */}
      <div className="pdf-editor-header">
        <div className="header-left">
          <button onClick={onClose} className="btn btn-secondary">
            ← Back to Forms
          </button>
          <div className="pdf-info">
            <h2 className="pdf-title">{pdf.fileName || pdf.name}</h2>
            <p className="job-info">Job #{job.number} - {job.title}</p>
          </div>
        </div>
        
        <div className="header-right">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-success btn-lg"
          >
            {isSaving ? (
              <>
                <div className="button-spinner"></div>
                Saving...
              </>
            ) : (
              <>
                💾 Save PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="pdf-toolbar">
        <div className="toolbar-section">
          <div className="tool-group">
            <button
              className={`btn btn-sm ${tool === 'select' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTool('select')}
              title="Select and move objects"
            >
              🔲 Select
            </button>
            <button
              className={`btn btn-sm ${tool === 'text' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTool('text')}
              title="Add text field"
            >
              📝 Add Text
            </button>
            <button
              className={`btn btn-sm ${tool === 'signature' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTool('signature')}
              title="Add signature field"
            >
              ✍️ Signature
            </button>
          </div>
        </div>

        <div className="toolbar-section">
          <div className="tool-group">
            <button 
              onClick={undo} 
              disabled={!canUndo}
              className="btn btn-sm btn-ghost"
              title="Undo"
            >
              ↶ Undo
            </button>
            <button 
              onClick={redo} 
              disabled={!canRedo}
              className="btn btn-sm btn-ghost"
              title="Redo"
            >
              ↷ Redo
            </button>
          </div>
        </div>

        <div className="toolbar-section">
          <div className="tool-group">
            <button
              onClick={() => setScale(prev => Math.max(0.5, prev - 0.1))}
              className="btn btn-sm btn-ghost"
              title="Zoom out"
            >
              🔍-
            </button>
            <span className="zoom-level">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale(prev => Math.min(3, prev + 0.1))}
              className="btn btn-sm btn-ghost"
              title="Zoom in"
            >
              🔍+
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="pdf-content">
        {/* Page Controls */}
        <div className="page-controls">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage <= 1}
            className="btn btn-sm btn-ghost"
          >
            ← Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage >= totalPages}
            className="btn btn-sm btn-ghost"
          >
            Next →
          </button>
        </div>

        {/* PDF Canvas */}
        <div className="pdf-canvas-container">
          {!pdfLoaded && (
            <div className="loading-content">
              <div className="loading-spinner"></div>
              <p>Loading PDF...</p>
            </div>
          )}
          
          <div className="pdf-canvas-wrapper" style={{ display: pdfLoaded ? 'block' : 'none' }}>
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="pdf-canvas"
              style={{
                cursor: tool === 'text' ? 'crosshair' : tool === 'signature' ? 'crosshair' : 'default'
              }}
            />

            {/* Render Objects */}
            {currentObjects.map(obj => (
              <EditableObject
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
        </div>

        {/* Selection Actions */}
        {selectedId && (
          <div className="selection-actions">
            <button
              onClick={() => setEditingId(selectedId)}
              className="btn btn-sm btn-primary"
            >
              ✏️ Edit
            </button>
            {objects.find(obj => obj.id === selectedId)?.type === 'signature' && (
              <button
                onClick={() => setShowSignatureDialog(true)}
                className="btn btn-sm btn-success"
              >
                ✍️ Add Signature
              </button>
            )}
            <button
              onClick={() => deleteObject(selectedId)}
              className="btn btn-sm btn-error"
            >
              🗑️ Delete
            </button>
          </div>
        )}
      </div>

      {/* Signature Dialog */}
      <SignatureDialog
        isOpen={showSignatureDialog}
        onClose={() => setShowSignatureDialog(false)}
        onSave={handleSignatureSave}
      />
    </div>
  );
}

// PDF Editor specific styles
const pdfEditorStyles = `
.pdf-editor {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--gray-100);
}

.pdf-editor-header {
  background: var(--white);
  border-bottom: 2px solid var(--gray-200);
  padding: var(--spacing-md) var(--spacing-lg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-sm);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
}

.pdf-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.pdf-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--gray-800);
  margin: 0;
}

.job-info {
  font-size: 0.9rem;
  color: var(--gray-600);
  margin: 0;
}

.pdf-toolbar {
  background: var(--gray-50);
  border-bottom: 1px solid var(--gray-300);
  padding: var(--spacing-sm) var(--spacing-lg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.tool-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs);
  background: var(--white);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.zoom-level {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--gray-700);
  min-width: 60px;
  text-align: center;
}

.pdf-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-controls {
  background: var(--white);
  border-bottom: 1px solid var(--gray-300);
  padding: var(--spacing-sm) var(--spacing-lg);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-md);
}

.page-info {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--gray-700);
  min-width: 120px;
  text-align: center;
}

.pdf-canvas-container {
  flex: 1;
  overflow: auto;
  background: var(--gray-200);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: var(--spacing-lg);
}

.pdf-canvas-wrapper {
  position: relative;
  background: var(--white);
  box-shadow: var(--shadow-xl);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.pdf-canvas {
  display: block;
  max-width: 100%;
  height: auto;
}

.selection-actions {
  position: fixed;
  bottom: var(--spacing-lg);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--gray-300);
  z-index: 1000;
}

.signature-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.signature-dialog {
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow: auto;
}

.signature-canvas-container {
  border: 2px solid var(--gray-300);
  border-radius: var(--radius-md);
  background: var(--white);
  display: flex;
  justify-content: center;
  padding: var(--spacing-sm);
}

.signature-canvas {
  cursor: crosshair;
  border-radius: var(--radius-sm);
  max-width: 100%;
  height: auto;
}

@media (max-width: 768px) {
  .pdf-editor-header {
    flex-direction: column;
    gap: var(--spacing-md);
    align-items: stretch;
  }
  
  .header-left {
    flex-direction: column;
    gap: var(--spacing-sm);
    align-items: stretch;
  }
  
  .pdf-toolbar {
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  
  .toolbar-section {
    justify-content: center;
  }
  
  .selection-actions {
    left: var(--spacing-md);
    right: var(--spacing-md);
    transform: none;
    justify-content: center;
  }
  
  .signature-dialog {
    width: 95%;
    margin: var(--spacing-md);
  }
}
`;

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('pdf-editor-styles')) {
  const style = document.createElement('style');
  style.id = 'pdf-editor-styles';
  style.textContent = pdfEditorStyles;
  document.head.appendChild(style);
}