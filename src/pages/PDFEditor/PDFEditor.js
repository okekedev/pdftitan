import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Provider,
  defaultTheme,
  ActionBar,
  Item,
  Button,
  ButtonGroup,
  TextField,
  Dialog,
  Content,
  Header,
  Heading,
  Text,
  Flex,
  View,
  Divider,
  ProgressBar,
  AlertDialog
} from '@adobe/react-spectrum';
import Edit from '@spectrum-icons/workflow/Edit';
import Delete from '@spectrum-icons/workflow/Delete';
import SaveFloppy from '@spectrum-icons/workflow/SaveFloppy';
import Close from '@spectrum-icons/workflow/Close';
import ZoomIn from '@spectrum-icons/workflow/ZoomIn';
import ZoomOut from '@spectrum-icons/workflow/ZoomOut';
import ChevronLeft from '@spectrum-icons/workflow/ChevronLeft';
import ChevronRight from '@spectrum-icons/workflow/ChevronRight';
import TextAdd from '@spectrum-icons/workflow/TextAdd';
import Draw from '@spectrum-icons/workflow/Draw';
import Move from '@spectrum-icons/workflow/Move';
import Undo from '@spectrum-icons/workflow/Undo';
import Redo from '@spectrum-icons/workflow/Redo';

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
  }, [pdf, job]);

  // Page Rendering
  const renderPage = useCallback(async () => {
    if (!pdfDocument || !canvasRef.current) return;
    
    const page = await pdfDocument.getPage(currentPage);
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const viewport = page.getViewport({ scale });
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    context.clearRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
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
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setObjects(history[historyIndex + 1]);
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

  const addSignatureObject = useCallback(() => {
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
    
    setObjects(prev => {
      const newObjects = [...prev, newSig];
      saveToHistory(newObjects);
      return newObjects;
    });
    setSelectedId(id);
  }, [currentPage, saveToHistory]);

  const updateObject = useCallback((id, updates) => {
    setObjects(prev => {
      const newObjects = prev.map(obj => obj.id === id ? { ...obj, ...updates } : obj);
      return newObjects;
    });
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

  if (object.type === 'text') {
    return (
      <div
        style={{
          ...style,
          background: selected ? 'rgba(0, 123, 255, 0.1)' : 'rgba(255, 255, 255, 0.9)',
          border: selected ? '2px solid var(--spectrum-global-color-blue-500)' : '1px solid transparent',
          borderRadius: '4px',
          padding: '8px',
          boxShadow: selected ? '0 0 0 2px rgba(0, 123, 255, 0.2)' : 'none'
        }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {editing ? (
          <TextField
            value={content}
            onChange={setContent}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSave();
              }
            }}
            autoFocus
            placeholder="Type here..."
            inputProps={{
              style: {
                fontSize: `${object.fontSize * scale}px`,
                color: object.color,
                border: 'none',
                background: 'transparent'
              }
            }}
          />
        ) : (
          <Text
            style={{
              fontSize: `${object.fontSize * scale}px`,
              color: object.color,
              userSelect: 'none',
              opacity: object.content ? 1 : 0.5
            }}
          >
            {object.content || 'Double-click to edit'}
          </Text>
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
          border: selected ? '2px solid var(--spectrum-global-color-green-500)' : '2px dashed #ccc',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: selected ? '0 0 0 2px rgba(40, 167, 69, 0.2)' : 'none'
        }}
        onClick={handleClick}
      >
        {object.content ? (
          <Text>✓ Signature Applied</Text>
        ) : (
          <Text UNSAFE_style={{ color: '#666' }}>Click to add signature</Text>
        )}
      </div>
    );
  }

  return null;
}

// Signature Dialog Component
function SignatureDialog({ isOpen, onClose, onSave }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

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
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onDismiss={onClose}>
      <Heading>Add Signature</Heading>
      <Header>
        <Text>Draw your signature below</Text>
      </Header>
      <Content>
        <View
          borderWidth="thin"
          borderColor="gray-300"
          borderRadius="medium"
          padding="size-200"
          backgroundColor="gray-50"
        >
          <canvas
            ref={canvasRef}
            width={400}
            height={200}
            style={{
              cursor: 'crosshair',
              display: 'block',
              background: 'white',
              borderRadius: '4px'
            }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
          />
        </View>
        <Flex direction="row" gap="size-100" marginTop="size-200">
          <Button variant="secondary" onPress={clearSignature}>
            Clear
          </Button>
          <Button variant="cta" onPress={saveSignature}>
            Save Signature
          </Button>
        </Flex>
      </Content>
    </Dialog>
  );
}

// Main PDF Editor Component
function SpectrumPDFEditor({ pdf, job, onClose, onSave }) {
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

  const currentObjects = objects.filter(obj => obj.page === currentPage);

  const handleCanvasClick = useCallback((e) => {
    if (tool === 'text') {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      addTextObject(x, y);
      setTool('select');
    } else {
      setSelectedId(null);
      setEditingId(null);
    }
  }, [tool, addTextObject, canvasRef, setSelectedId, setEditingId]);

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

  const handleSignatureSave = (signatureData) => {
    if (selectedId) {
      updateObject(selectedId, { content: signatureData });
    }
  };

  if (pdfError) {
    return (
      <Provider theme={defaultTheme}>
        <View padding="size-400">
          <AlertDialog
            title="Error Loading PDF"
            variant="error"
            primaryActionLabel="Close"
            onPrimaryAction={onClose}
          >
            {pdfError}
          </AlertDialog>
        </View>
      </Provider>
    );
  }

  return (
    <Provider theme={defaultTheme}>
      <View
        height="100vh"
        backgroundColor="gray-100"
        UNSAFE_style={{ display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <View
          backgroundColor="gray-900"
          paddingX="size-300"
          paddingY="size-200"
          UNSAFE_style={{ color: 'white' }}
        >
          <Flex direction="row" alignItems="center" justifyContent="space-between">
            <Flex direction="row" alignItems="center" gap="size-200">
              <Button variant="secondary" onPress={onClose}>
                <Close />
                <Text>Close</Text>
              </Button>
              <View>
                <Heading level={3} margin={0} UNSAFE_style={{ color: 'white' }}>
                  {pdf.fileName || pdf.name}
                </Heading>
                <Text UNSAFE_style={{ color: 'rgba(255,255,255,0.8)' }}>
                  Job #{job.number} - {job.title}
                </Text>
              </View>
            </Flex>
            <Button variant="cta" onPress={handleSave}>
              <SaveFloppy />
              <Text>Save PDF</Text>
            </Button>
          </Flex>
        </View>

        {/* Toolbar */}
        <View backgroundColor="gray-50" borderBottomWidth="thin" borderBottomColor="gray-300">
          <Flex direction="row" alignItems="center" justifyContent="space-between" padding="size-200">
            <ButtonGroup>
              <Button
                variant={tool === 'select' ? 'cta' : 'secondary'}
                onPress={() => setTool('select')}
              >
                <Move />
                <Text>Select</Text>
              </Button>
              <Button
                variant={tool === 'text' ? 'cta' : 'secondary'}
                onPress={() => setTool('text')}
              >
                <TextAdd />
                <Text>Add Text</Text>
              </Button>
              <Button
                variant="secondary"
                onPress={() => {
                  addSignatureObject();
                  setShowSignatureDialog(true);
                }}
              >
                <Draw />
                <Text>Signature</Text>
              </Button>
            </ButtonGroup>

            <Flex direction="row" alignItems="center" gap="size-100">
              <ButtonGroup>
                <Button variant="secondary" onPress={undo} isDisabled={!canUndo}>
                  <Undo />
                </Button>
                <Button variant="secondary" onPress={redo} isDisabled={!canRedo}>
                  <Redo />
                </Button>
              </ButtonGroup>
              <Divider orientation="vertical" size="S" />
              <ButtonGroup>
                <Button
                  variant="secondary"
                  onPress={() => setScale(prev => Math.max(0.5, prev - 0.1))}
                >
                  <ZoomOut />
                </Button>
                <Text>{Math.round(scale * 100)}%</Text>
                <Button
                  variant="secondary"
                  onPress={() => setScale(prev => Math.min(3, prev + 0.1))}
                >
                  <ZoomIn />
                </Button>
              </ButtonGroup>
            </Flex>
          </Flex>
        </View>

        {/* Content Area */}
        <View flex={1} backgroundColor="gray-200" overflow="auto">
          {/* Page Controls */}
          <View backgroundColor="white" borderBottomWidth="thin" borderBottomColor="gray-300">
            <Flex direction="row" alignItems="center" justifyContent="center" padding="size-200" gap="size-200">
              <Button
                variant="secondary"
                onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                isDisabled={currentPage <= 1}
              >
                <ChevronLeft />
              </Button>
              <Text>
                Page {currentPage} of {totalPages}
              </Text>
              <Button
                variant="secondary"
                onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                isDisabled={currentPage >= totalPages}
              >
                <ChevronRight />
              </Button>
            </Flex>
          </View>

          {/* PDF Canvas */}
          <View padding="size-400" UNSAFE_style={{ display: 'flex', justifyContent: 'center' }}>
            <View
              position="relative"
              backgroundColor="white"
              UNSAFE_style={{
                display: 'inline-block',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                borderRadius: '8px',
                overflow: 'hidden'
              }}
            >
              {!pdfLoaded && (
                <View padding="size-800">
                  <ProgressBar label="Loading PDF..." isIndeterminate />
                </View>
              )}
              
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                style={{
                  display: pdfLoaded ? 'block' : 'none',
                  cursor: tool === 'text' ? 'crosshair' : 'default'
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
            </View>
          </View>
        </View>

        {/* Selection Action Bar */}
        {selectedId && (
          <ActionBar
            isEmphasized
            selectedItemCount="single"
            onAction={(action) => {
              if (action === 'delete') {
                deleteObject(selectedId);
              } else if (action === 'edit') {
                setEditingId(selectedId);
              } else if (action === 'signature') {
                setShowSignatureDialog(true);
              }
            }}
          >
            <Item key="edit" textValue="Edit">
              <Edit />
              <Text>Edit</Text>
            </Item>
            <Item key="signature" textValue="Add Signature">
              <Draw />
              <Text>Add Signature</Text>
            </Item>
            <Item key="delete" textValue="Delete">
              <Delete />
              <Text>Delete</Text>
            </Item>
          </ActionBar>
        )}

        {/* Signature Dialog */}
        <SignatureDialog
          isOpen={showSignatureDialog}
          onClose={() => setShowSignatureDialog(false)}
          onSave={handleSignatureSave}
        />
      </View>
    </Provider>
  );
}

export default SpectrumPDFEditor;