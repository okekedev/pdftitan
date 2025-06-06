import React, { useState, useRef, useEffect } from 'react';
import './PDFEditor.css';

function PDFEditor({ pdf, job, onClose, onSave }) {
  const pdfContainerRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [formFields, setFormFields] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // Auto-fill data from ServiceTitan
  const autoFillData = {
    'job_id': job.id,
    'job_name': job.name,
    'technician': 'Mike Rodriguez',
    'test_date': new Date().toLocaleDateString(),
    'customer': 'Metro Hospital System',
    'date': new Date().toLocaleDateString(),
    'technician_name': 'Mike Rodriguez'
  };

  // Load PDF.js library and PDF document
  useEffect(() => {
    const loadPDF = async () => {
      try {
        // Load PDF.js library
        if (!window.pdfjsLib) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            loadPDFDocument();
          };
          document.head.appendChild(script);
        } else {
          loadPDFDocument();
        }
      } catch (error) {
        console.error('Error loading PDF.js:', error);
        setPdfError(true);
      }
    };

    const loadPDFDocument = async () => {
      try {
        const response = await fetch('/assets/sample.pdf');
        if (!response.ok) {
          setPdfError(true);
          return;
        }

        const arrayBuffer = await response.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
        
        setPdfDocument(pdf);
        setTotalPages(pdf.numPages);
        setPdfLoaded(true);

        // Load first page and detect form fields
        await loadPage(pdf, 1);
      } catch (error) {
        console.error('Error loading PDF document:', error);
        setPdfError(true);
      }
    };

    loadPDF();
  }, []);

  const loadPage = async (pdf, pageNumber) => {
    try {
      const page = await pdf.getPage(pageNumber);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      const viewport = page.getViewport({ scale: 1.5 });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // Get form fields (annotations)
      const annotations = await page.getAnnotations();
      const detectedFields = {};

      annotations.forEach((annotation, index) => {
        if (annotation.subtype === 'Widget' && annotation.fieldName) {
          const fieldName = annotation.fieldName.toLowerCase();
          
          // Auto-fill if we have matching data
          let value = '';
          Object.keys(autoFillData).forEach(key => {
            if (fieldName.includes(key) || key.includes(fieldName)) {
              value = autoFillData[key];
            }
          });

          detectedFields[annotation.fieldName] = {
            name: annotation.fieldName,
            type: annotation.fieldType || 'text',
            value: value,
            rect: annotation.rect,
            page: pageNumber,
            readonly: !!value // Auto-filled fields are readonly
          };
        }
      });

      setFormFields(prev => ({ ...prev, ...detectedFields }));

      // Display the rendered page
      if (pdfContainerRef.current) {
        pdfContainerRef.current.innerHTML = '';
        pdfContainerRef.current.appendChild(canvas);
        
        // Add interactive form fields
        addInteractiveFields(detectedFields, viewport);
      }

    } catch (error) {
      console.error('Error loading page:', error);
    }
  };

  const addInteractiveFields = (fields, viewport) => {
    Object.values(fields).forEach(field => {
      const fieldElement = document.createElement(field.type === 'choice' ? 'select' : 'input');
      
      if (field.type === 'choice') {
        // Add dropdown options
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select...';
        fieldElement.appendChild(defaultOption);
        
        ['Pass', 'Fail', 'Needs Repair'].forEach(option => {
          const optionElement = document.createElement('option');
          optionElement.value = option;
          optionElement.textContent = option;
          fieldElement.appendChild(optionElement);
        });
      } else {
        fieldElement.type = field.type === 'signature' ? 'text' : 'text';
        fieldElement.placeholder = field.readonly ? 'Auto-filled' : `Enter ${field.name}`;
      }

      fieldElement.value = field.value;
      fieldElement.disabled = field.readonly;
      fieldElement.className = `pdf-form-field ${field.readonly ? 'readonly' : 'editable'}`;
      
      // Position field based on PDF coordinates
      fieldElement.style.position = 'absolute';
      fieldElement.style.left = `${field.rect[0]}px`;
      fieldElement.style.top = `${viewport.height - field.rect[3]}px`;
      fieldElement.style.width = `${field.rect[2] - field.rect[0]}px`;
      fieldElement.style.height = `${field.rect[3] - field.rect[1]}px`;
      
      fieldElement.addEventListener('change', (e) => {
        setFormFields(prev => ({
          ...prev,
          [field.name]: { ...field, value: e.target.value }
        }));
      });

      pdfContainerRef.current.appendChild(fieldElement);
    });
  };

  const handleSave = () => {
    // Validate required fields
    const requiredFields = Object.values(formFields).filter(field => 
      !field.readonly && !field.value && 
      (field.name.includes('serial') || field.name.includes('result'))
    );

    if (requiredFields.length > 0) {
      alert('Please fill out all required fields');
      return;
    }

    onSave({
      pdfId: pdf.id,
      formFields: formFields,
      savedAt: new Date().toISOString()
    });
  };

  const nextPage = () => {
    if (currentPage < totalPages && pdfDocument) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      loadPage(pdfDocument, newPage);
    }
  };

  const prevPage = () => {
    if (currentPage > 1 && pdfDocument) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      loadPage(pdfDocument, newPage);
    }
  };

  if (pdfError) {
    return (
      <div className="pdf-editor-container">
        <div className="pdf-editor-header">
          <div className="header-left">
            <button onClick={onClose} className="close-btn">
              ← Back
            </button>
            <div className="pdf-info">
              <h2>{pdf.name}</h2>
              <p>PDF Loading Error</p>
            </div>
          </div>
        </div>
        <div className="pdf-error-message">
          <h3>PDF Could Not Be Loaded</h3>
          <p>Please ensure the PDF file exists at: <code>/assets/sample.pdf</code></p>
          <p>The PDF should contain fillable form fields for automatic detection.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-editor-container">
      <div className="pdf-editor-header">
        <div className="header-left">
          <button onClick={onClose} className="close-btn">
            ← Back
          </button>
          <div className="pdf-info">
            <h2>{pdf.name}</h2>
            <p>{job.id} - Interactive PDF Form</p>
          </div>
        </div>
        
        <div className="header-right">
          {totalPages > 1 && (
            <div className="page-controls">
              <button onClick={prevPage} disabled={currentPage === 1} className="page-btn">
                ← Prev
              </button>
              <span className="page-info">
                Page {currentPage} of {totalPages}
              </span>
              <button onClick={nextPage} disabled={currentPage === totalPages} className="page-btn">
                Next →
              </button>
            </div>
          )}
          
          <button onClick={handleSave} className="save-btn">
            Save Form
          </button>
        </div>
      </div>

      <div className="pdf-editor-content">
        {!pdfLoaded ? (
          <div className="pdf-loading">
            <div className="loading-spinner"></div>
            <p>Loading PDF and detecting form fields...</p>
          </div>
        ) : (
          <div className="pdf-viewer-container">
            <div className="pdf-canvas-container" ref={pdfContainerRef}>
              {/* PDF canvas and form fields will be rendered here */}
            </div>
            
            <div className="form-fields-info">
              <h4>Detected Form Fields:</h4>
              <div className="fields-list">
                {Object.values(formFields).map(field => (
                  <div key={field.name} className={`field-info ${field.readonly ? 'auto-filled' : 'editable'}`}>
                    <span className="field-name">{field.name}</span>
                    <span className="field-status">
                      {field.readonly ? '✓ Auto-filled' : field.value ? '✓ Completed' : '⚠ Required'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PDFEditor;
