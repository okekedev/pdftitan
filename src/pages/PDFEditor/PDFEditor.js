// Adobe-Style PDF Editor - Simple, Efficient, Professional
import React, { useState, useRef, useEffect, useCallback } from 'react';

function AdobeStylePDFEditor({ pdf, job, onClose, onSave }) {
  // Core state
  const canvasRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  // Objects and interaction
  const [objects, setObjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [editingId, setEditingId] = useState(null);

  // Initialize PDF
  useEffect(() => {
    loadPDF();
  }, []);

  useEffect(() => {
    if (pdfDocument) renderPage();
  }, [pdfDocument, currentPage, scale]);

  const loadPDF = async () => {
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

      const response = await fetch(`http://localhost:3005/api/job/${job.id}/attachment/${pdf.serviceTitanId}/download`);
      if (!response.ok) throw new Error('Failed to load PDF');

      const arrayBuffer = await response.arrayBuffer();
      const pdfDoc = await window.pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
      
      setPdfDocument(pdfDoc);
      setTotalPages(pdfDoc.numPages);
      setPdfLoaded(true);
    } catch (error) {
      setPdfError(error.message);
    }
  };

  const renderPage = async () => {
    if (!pdfDocument || !canvasRef.current) return;
    
    const page = await pdfDocument.getPage(currentPage);
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const viewport = page.getViewport({ scale });
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    context.clearRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
  };

  // Simple object management
  const createText = (x, y, width = 200, height = 40) => {
    const id = Date.now().toString();
    const newText = {
      id,
      type: 'text',
      x: x / scale,
      y: y / scale,
      width: width / scale,
      height: height / scale,
      content: '',
      fontSize: 16,
      color: '#000000',
      page: currentPage
    };
    setObjects(prev => [...prev, newText]);
    setSelectedId(id);
    setEditingId(id);
    return newText;
  };

  const createSignature = () => {
    const id = Date.now().toString();
    const newSig = {
      id,
      type: 'signature',
      x: 100,
      y: 100,
      width: 250,
      height: 100,
      content: null,
      page: currentPage
    };
    setObjects(prev => [...prev, newSig]);
    setSelectedId(id);
    return newSig;
  };

  const updateObject = (id, updates) => {
    setObjects(prev => prev.map(obj => obj.id === id ? { ...obj, ...updates } : obj));
  };

  const deleteSelected = () => {
    if (selectedId) {
      setObjects(prev => prev.filter(obj => obj.id !== selectedId));
      setSelectedId(null);
      setEditingId(null);
    }
  };

  // Adobe-style interactions
  const handleCanvasMouseDown = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on object
    const clicked = objects.find(obj => {
      if (obj.page !== currentPage) return false;
      const objX = obj.x * scale;
      const objY = obj.y * scale;
      const objW = obj.width * scale;
      const objH = obj.height * scale;
      return x >= objX && x <= objX + objW && y >= objY && y <= objY + objH;
    });

    if (clicked) {
      setSelectedId(clicked.id);
      setEditingId(null);
    } else {
      // Click on empty space - create text box
      createText(x - 100, y - 20);
    }
  }, [objects, currentPage, scale]);

  const handleDoubleClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clicked = objects.find(obj => {
      if (obj.page !== currentPage) return false;
      const objX = obj.x * scale;
      const objY = obj.y * scale;
      const objW = obj.width * scale;
      const objH = obj.height * scale;
      return x >= objX && x <= objX + objW && y >= objY && y <= objY + objH;
    });

    if (clicked && clicked.type === 'text') {
      setEditingId(clicked.id);
    }
  }, [objects, currentPage, scale]);

  // Drag handling
  const startDrag = (type, objectId, e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const obj = objects.find(o => o.id === objectId);
    setDragState({
      type,
      objectId,
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      originalX: obj.x,
      originalY: obj.y,
      originalWidth: obj.width,
      originalHeight: obj.height
    });
  };

  const handleMouseMove = useCallback((e) => {
    if (!dragState) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    const deltaX = (currentX - dragState.startX) / scale;
    const deltaY = (currentY - dragState.startY) / scale;

    if (dragState.type === 'move') {
      updateObject(dragState.objectId, {
        x: dragState.originalX + deltaX,
        y: dragState.originalY + deltaY
      });
    } else if (dragState.type === 'resize') {
      updateObject(dragState.objectId, {
        width: Math.max(50, dragState.originalWidth + deltaX),
        height: Math.max(20, dragState.originalHeight + deltaY)
      });
    }
  }, [dragState, scale]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  // Save
  const handleSave = () => {
    const saveData = {
      pdfId: pdf.id,
      serviceTitanId: pdf.serviceTitanId,
      originalFileName: pdf.fileName || pdf.name,
      editableElements: objects,
      jobInfo: {
        jobId: job.id,
        jobNumber: job.number,
        jobTitle: job.title
      },
      savedAt: new Date().toISOString()
    };
    onSave(saveData);
  };

  // Get current page objects
  const currentObjects = objects.filter(obj => obj.page === currentPage);

  if (pdfError) {
    return (
      <div style={styles.errorContainer}>
        <h3>Error: {pdfError}</h3>
        <button onClick={onClose} style={styles.button}>← Back</button>
      </div>
    );
  }

  if (!pdfLoaded) {
    return (
      <div style={styles.loadingContainer}>
        <h3>Loading PDF...</h3>
        <p>{pdf.name}</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Clean Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <button onClick={onClose} style={styles.backButton}>← Back</button>
          <span style={styles.title}>{pdf.name}</span>
        </div>
        
        <div style={styles.toolbarCenter}>
          <button onClick={createSignature} style={styles.primaryButton}>
            ✍️ Add Signature
          </button>
          
          {totalPages > 1 && (
            <div style={styles.pageControls}>
              <button 
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                style={styles.pageButton}
              >
                ◀
              </button>
              <span style={styles.pageInfo}>{currentPage} / {totalPages}</span>
              <button 
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                style={styles.pageButton}
              >
                ▶
              </button>
            </div>
          )}
          
          <div style={styles.zoomControls}>
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} style={styles.zoomButton}>-</button>
            <span style={styles.zoomDisplay}>{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(2, s + 0.2))} style={styles.zoomButton}>+</button>
          </div>
        </div>
        
        <div style={styles.toolbarRight}>
          {selectedId && (
            <button onClick={deleteSelected} style={styles.deleteButton}>Delete</button>
          )}
          <button onClick={handleSave} style={styles.saveButton}>Save PDF</button>
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        style={styles.canvasContainer}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div style={styles.canvasWrapper}>
          <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onDoubleClick={handleDoubleClick}
            style={styles.canvas}
          />
          
          {/* Render Objects */}
          {currentObjects.map(obj => (
            <ObjectElement
              key={obj.id}
              object={obj}
              scale={scale}
              selected={selectedId === obj.id}
              editing={editingId === obj.id}
              onStartDrag={(type, e) => startDrag(type, obj.id, e)}
              onUpdate={(updates) => updateObject(obj.id, updates)}
              onFinishEdit={() => setEditingId(null)}
            />
          ))}
        </div>
      </div>

      {/* Simple Help */}
      <div style={styles.helpBar}>
        Click anywhere to add text • Double-click text to edit • Drag handles to move/resize
      </div>
    </div>
  );
}

// Simple Object Component
function ObjectElement({ object, scale, selected, editing, onStartDrag, onUpdate, onFinishEdit }) {
  const [content, setContent] = useState(object.content || '');

  const style = {
    position: 'absolute',
    left: `${object.x * scale}px`,
    top: `${object.y * scale}px`,
    width: `${object.width * scale}px`,
    height: `${object.height * scale}px`,
    border: selected ? '2px solid #007bff' : '1px solid transparent',
    borderRadius: '4px',
    zIndex: selected ? 1000 : 100
  };

  const handleSave = () => {
    onUpdate({ content });
    onFinishEdit();
  };

  if (object.type === 'text') {
    return (
      <div style={{ ...style, background: 'rgba(255,255,255,0.9)', padding: '8px' }}>
        {editing ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSave();
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: `${object.fontSize * scale}px`,
              color: object.color,
              resize: 'none'
            }}
            autoFocus
            placeholder="Type here..."
          />
        ) : (
          <span style={{ 
            fontSize: `${object.fontSize * scale}px`, 
            color: object.color,
            wordWrap: 'break-word'
          }}>
            {object.content || 'Double-click to edit'}
          </span>
        )}
        
        {/* Simple Handles */}
        {selected && !editing && (
          <>
            <div
              onMouseDown={(e) => { e.stopPropagation(); onStartDrag('move', e); }}
              style={{
                position: 'absolute',
                top: '-8px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '16px',
                height: '16px',
                background: '#28a745',
                border: '2px solid white',
                borderRadius: '50%',
                cursor: 'move'
              }}
            />
            <div
              onMouseDown={(e) => { e.stopPropagation(); onStartDrag('resize', e); }}
              style={{
                position: 'absolute',
                bottom: '-4px',
                right: '-4px',
                width: '12px',
                height: '12px',
                background: '#007bff',
                border: '1px solid white',
                borderRadius: '2px',
                cursor: 'se-resize'
              }}
            />
          </>
        )}
      </div>
    );
  }

  if (object.type === 'signature') {
    return (
      <div style={{ 
        ...style, 
        background: 'rgba(255,255,255,0.95)', 
        border: selected ? '2px solid #28a745' : '2px dashed #ccc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {object.content ? (
          <img src={object.content} alt="Signature" style={{ width: '100%', height: '80%', objectFit: 'contain' }} />
        ) : (
          <div style={{ fontSize: '14px', color: '#666', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>✍️</div>
            <div>Sign here</div>
          </div>
        )}
        
        <SignatureCanvas object={object} scale={scale} onUpdate={onUpdate} />
        
        {selected && (
          <>
            <div
              onMouseDown={(e) => { e.stopPropagation(); onStartDrag('move', e); }}
              style={{
                position: 'absolute',
                top: '-8px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '16px',
                height: '16px',
                background: '#28a745',
                border: '2px solid white',
                borderRadius: '50%',
                cursor: 'move'
              }}
            />
            <div
              onMouseDown={(e) => { e.stopPropagation(); onStartDrag('resize', e); }}
              style={{
                position: 'absolute',
                bottom: '-4px',
                right: '-4px',
                width: '12px',
                height: '12px',
                background: '#28a745',
                border: '1px solid white',
                borderRadius: '2px',
                cursor: 'se-resize'
              }}
            />
          </>
        )}
      </div>
    );
  }

  return null;
}

// Simple Signature Canvas
function SignatureCanvas({ object, scale, onUpdate }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (object.content && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = object.content;
    }
  }, [object.content]);

  const startDrawing = (e) => {
    e.stopPropagation();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    e?.stopPropagation();
    setIsDrawing(false);
    const canvas = canvasRef.current;
    onUpdate({ content: canvas.toDataURL('image/png') });
  };

  const clearSig = (e) => {
    e.stopPropagation();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onUpdate({ content: null });
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        width={object.width * scale}
        height={object.height * scale * 0.8}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          cursor: 'crosshair',
          borderRadius: '4px'
        }}
      />
      {object.content && (
        <button
          onClick={clearSig}
          style={{
            position: 'absolute',
            bottom: '2px',
            right: '2px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            padding: '2px 6px',
            fontSize: '10px',
            borderRadius: '2px',
            cursor: 'pointer'
          }}
        >
          Clear
        </button>
      )}
    </>
  );
}

// Clean Styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#f5f5f5',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  toolbar: {
    background: 'white',
    borderBottom: '1px solid #ddd',
    padding: '12px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  toolbarCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  title: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333'
  },
  button: {
    padding: '8px 16px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    background: 'white',
    cursor: 'pointer',
    fontSize: '14px'
  },
  backButton: {
    padding: '8px 16px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    background: 'white',
    cursor: 'pointer',
    fontSize: '14px'
  },
  primaryButton: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '4px',
    background: '#007bff',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  saveButton: {
    padding: '8px 20px',
    border: 'none',
    borderRadius: '4px',
    background: '#28a745',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  deleteButton: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '4px',
    background: '#dc3545',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px'
  },
  pageControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#f8f9fa',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #ddd'
  },
  pageButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '2px'
  },
  pageInfo: {
    fontSize: '14px',
    fontWeight: '500',
    minWidth: '60px',
    textAlign: 'center'
  },
  zoomControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: '#f8f9fa',
    padding: '4px',
    borderRadius: '4px',
    border: '1px solid #ddd'
  },
  zoomButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '2px',
    fontSize: '14px'
  },
  zoomDisplay: {
    fontSize: '12px',
    fontWeight: '500',
    minWidth: '50px',
    textAlign: 'center'
  },
  canvasContainer: {
    flex: 1,
    overflow: 'auto',
    padding: '20px',
    display: 'flex',
    justifyContent: 'center'
  },
  canvasWrapper: {
    position: 'relative',
    background: 'white',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    borderRadius: '4px'
  },
  canvas: {
    display: 'block',
    borderRadius: '4px'
  },
  helpBar: {
    background: '#f8f9fa',
    borderTop: '1px solid #ddd',
    padding: '8px 20px',
    fontSize: '13px',
    color: '#666',
    textAlign: 'center'
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#f5f5f5',
    gap: '20px'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#f5f5f5'
  }
};

export default AdobeStylePDFEditor;