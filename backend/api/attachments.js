// backend/api/attachments.js - Complete ServiceTitan Upload Implementation
const express = require('express');
const router = express.Router();

// ✅ GET JOB ATTACHMENTS - Using working endpoint
router.get('/job/:jobId/attachments', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    console.log(`📎 Fetching attachments for job: ${jobId}`);
    
    const tokenResult = await global.serviceTitan.getAccessToken();
    if (!tokenResult) {
      return res.status(500).json({
        success: false,
        error: 'ServiceTitan authentication failed'
      });
    }
    
    const fetch = (await import('node-fetch')).default;
    const tenantId = global.serviceTitan.tenantId;
    const appKey = global.serviceTitan.appKey;
    const accessToken = tokenResult;
    
    // ✅ CORRECT ENDPOINT from your working code
    const attachmentsUrl = `${global.serviceTitan.apiBaseUrl}/forms/v2/tenant/${tenantId}/jobs/${jobId}/attachments`;
    
    const response = await fetch(attachmentsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.json({
          success: true,
          data: [],
          count: 0,
          message: 'No attachments found for this job'
        });
      }
      
      const errorText = await response.text();
      console.error(`❌ ServiceTitan Forms API error: ${response.status} - ${errorText}`);
      throw new Error(`Forms API error: ${response.statusText}`);
    }

    const attachmentsData = await response.json();
    const attachments = attachmentsData.data || [];
    
    // Filter for PDF files only
    const pdfAttachments = attachments.filter(attachment => {
      const fileName = attachment.fileName || attachment.name || '';
      const mimeType = attachment.mimeType || attachment.contentType || '';
      const fileExtension = fileName.toLowerCase().split('.').pop();
      
      return fileExtension === 'pdf' || mimeType.includes('pdf');
    });
    
    // Transform attachments for frontend
    const transformedAttachments = pdfAttachments.map((attachment, index) => {
      const fileName = attachment.fileName || attachment.name || `Document ${index + 1}`;
      const fileNameWithoutExt = fileName.replace(/\.pdf$/i, '');
      
      return {
        id: attachment.id || `attachment_${index}`,
        name: fileNameWithoutExt,
        fileName: fileName,
        type: 'PDF Document',
        status: 'Available',
        active: true,
        size: attachment.size || attachment.fileSize || 0,
        createdOn: attachment.createdOn || attachment.dateCreated || attachment.modifiedOn || new Date().toISOString(),
        downloadUrl: attachment.downloadUrl || attachment.url || null,
        serviceTitanId: attachment.id,
        jobId: jobId,
        mimeType: attachment.mimeType || attachment.contentType || 'application/pdf',
        category: 'PDF Form'
      };
    });
    
    console.log(`✅ Found ${transformedAttachments.length} PDF attachments for job ${jobId}`);
    
    res.json({
      success: true,
      data: transformedAttachments,
      count: transformedAttachments.length,
      jobId: jobId
    });
    
  } catch (error) {
    console.error('❌ Error fetching job attachments:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching job attachments',
      details: error.message
    });
  }
});

// ✅ WORKING PDF DOWNLOAD
router.get('/job/:jobId/attachment/:attachmentId/download', async (req, res) => {
  try {
    const { jobId, attachmentId } = req.params;
    
    console.log(`📥 Downloading PDF attachment: ${attachmentId} from job: ${jobId}`);
    
    const tokenResult = await global.serviceTitan.getAccessToken();
    if (!tokenResult) {
      return res.status(500).json({
        success: false,
        error: 'ServiceTitan authentication failed'
      });
    }
    
    const fetch = (await import('node-fetch')).default;
    const tenantId = global.serviceTitan.tenantId;
    const appKey = global.serviceTitan.appKey;
    const accessToken = tokenResult;
    
    const downloadUrl = `${global.serviceTitan.apiBaseUrl}/forms/v2/tenant/${tenantId}/jobs/attachment/${attachmentId}`;
    
    console.log(`🔗 Fetching PDF from ServiceTitan: ${downloadUrl}`);
    
    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey
      },
      redirect: 'follow'
    });
    
    if (!response.ok) {
      console.error(`❌ Download failed: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        success: false,
        error: `Failed to download attachment: ${response.statusText}`
      });
    }
    
    const fileBuffer = await response.buffer();
    const contentType = response.headers.get('content-type') || 'application/pdf';
    const finalUrl = response.url;
    
    const isPdfValid = fileBuffer.length > 0 && fileBuffer.toString('ascii', 0, 4) === '%PDF';
    const pdfVersion = isPdfValid ? fileBuffer.toString('ascii', 0, 8) : 'Invalid';
    
    console.log(`📊 PDF Download Analysis:`, {
      success: true,
      fileSize: `${fileBuffer.length} bytes`,
      contentType: contentType,
      finalUrl: finalUrl.includes('blob.core.windows.net') ? '✅ Azure Blob Storage' : 'Other source',
      isPdfValid: isPdfValid ? '✅ Valid PDF' : '❌ Invalid PDF',
      pdfVersion: pdfVersion
    });
    
    if (!isPdfValid) {
      console.error(`❌ Invalid PDF data received for attachment ${attachmentId}`);
      return res.status(500).json({
        success: false,
        error: 'Downloaded file is not a valid PDF'
      });
    }
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': fileBuffer.length,
      'Content-Disposition': `inline; filename="attachment_${attachmentId}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
      'Accept-Ranges': 'bytes'
    });
    
    res.send(fileBuffer);
    
    console.log(`✅ PDF successfully served: ${fileBuffer.length} bytes`);
    
  } catch (error) {
    console.error('❌ Error downloading PDF attachment:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error downloading PDF attachment',
      details: error.message
    });
  }
});

// 🚀 NEW: SERVICETITAN PDF UPLOAD ENDPOINT
router.post('/job/:jobId/attachment/:attachmentId/save', async (req, res) => {
  try {
    const { jobId, attachmentId } = req.params;
    const { 
      editableElements, 
      jobInfo, 
      originalFileName,
      completedFileName,
      metadata 
    } = req.body;
    
    console.log(`💾 Starting PDF upload process for job: ${jobId}`);
    console.log(`📝 Original file: ${originalFileName}`);
    console.log(`📝 Completed file: ${completedFileName}`);
    console.log(`📊 Request body keys:`, Object.keys(req.body));
    console.log(`📊 Form elements received:`, editableElements?.length || 'undefined');
    
    // ✅ Enhanced validation with detailed error messages
    if (!editableElements) {
      console.error('❌ Missing editableElements in request body');
      return res.status(400).json({
        success: false,
        error: 'Missing editableElements data',
        received: Object.keys(req.body),
        expected: ['editableElements', 'jobInfo', 'originalFileName', 'completedFileName']
      });
    }
    
    if (!Array.isArray(editableElements)) {
      console.error('❌ editableElements is not an array:', typeof editableElements);
      return res.status(400).json({
        success: false,
        error: 'editableElements must be an array',
        receivedType: typeof editableElements,
        receivedValue: editableElements
      });
    }
    
    if (editableElements.length === 0) {
      console.error('❌ editableElements array is empty');
      return res.status(400).json({
        success: false,
        error: 'editableElements array is empty - add some form fields before saving'
      });
    }

    if (!jobInfo || !jobInfo.jobId) {
      console.error('❌ Missing or invalid jobInfo');
      return res.status(400).json({
        success: false,
        error: 'Missing job information',
        receivedJobInfo: jobInfo
      });
    }
    
    const tokenResult = await global.serviceTitan.getAccessToken();
    if (!tokenResult) {
      return res.status(500).json({
        success: false,
        error: 'ServiceTitan authentication failed'
      });
    }
    
    // Step 1: Download original PDF
    console.log(`📥 Step 1: Downloading original PDF...`);
    const originalPdfBuffer = await downloadOriginalPDF(jobId, attachmentId);
    
    // Step 2: Generate completed PDF with form data
    console.log(`🔧 Step 2: Generating completed PDF with form data...`);
    const completedPdfBuffer = await generateCompletedPDF(originalPdfBuffer, editableElements);
    
    // Step 3: Upload completed PDF to ServiceTitan
    console.log(`🚀 Step 3: Uploading completed PDF to ServiceTitan...`);
    const uploadResult = await uploadCompletedPDFToServiceTitan(
      jobId, 
      completedPdfBuffer, 
      completedFileName,
      jobInfo,
      metadata
    );
    
    console.log(`✅ PDF upload completed successfully!`);
    
    // Return comprehensive response
    res.json({
      success: true,
      message: `PDF form completed and uploaded successfully as "${completedFileName}"`,
      
      // Upload details
      uploadDetails: {
        method: 'servicetitan_api',
        uploadedAt: new Date().toISOString(),
        serviceTitanId: uploadResult.serviceTitanId,
        fileName: uploadResult.fileName
      },
      
      // Form summary
      formSummary: {
        originalFile: originalFileName,
        completedFile: completedFileName,
        totalFields: editableElements.length,
        filledFields: editableElements.filter(el => el.value && el.value.trim() !== '').length,
        completionPercentage: editableElements.length > 0 
          ? Math.round((editableElements.filter(el => el.value && el.value.trim() !== '').length / editableElements.length) * 100)
          : 0
      },
      
      // Job context
      jobContext: jobInfo,
      
      // Technical details
      technicalDetails: {
        originalSize: originalPdfBuffer?.length || 0,
        completedSize: completedPdfBuffer?.length || 0,
        elementCount: editableElements.length,
        hasSignatures: editableElements.some(el => el.type === 'signature' && el.value),
        hasTextFields: editableElements.some(el => el.type === 'text' && el.value),
        uploadMethod: 'ServiceTitan Forms API v2'
      },
      
      // ServiceTitan response
      serviceTitanResponse: uploadResult
    });
    
  } catch (error) {
    console.error('❌ Error in PDF upload process:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error during PDF upload process',
      details: error.message,
      step: error.step || 'unknown',
      troubleshooting: {
        suggestion: 'Check that all required form data is provided and ServiceTitan API is accessible',
        requiredFields: ['editableElements', 'jobInfo', 'originalFileName', 'completedFileName'],
        timestamp: new Date().toISOString()
      }
    });
  }
});

// 🔧 HELPER FUNCTION: Download original PDF
async function downloadOriginalPDF(jobId, attachmentId) {
  try {
    const fetch = (await import('node-fetch')).default;
    const tenantId = global.serviceTitan.tenantId;
    const appKey = global.serviceTitan.appKey;
    const accessToken = await global.serviceTitan.getAccessToken();
    
    const downloadUrl = `${global.serviceTitan.apiBaseUrl}/forms/v2/tenant/${tenantId}/jobs/attachment/${attachmentId}`;
    
    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey
      },
      redirect: 'follow'
    });
    
    if (!response.ok) {
      const error = new Error(`Failed to download original PDF: ${response.status} ${response.statusText}`);
      error.step = 'download_original';
      throw error;
    }
    
    const fileBuffer = await response.buffer();
    
    // Validate PDF
    const isPdfValid = fileBuffer.length > 0 && fileBuffer.toString('ascii', 0, 4) === '%PDF';
    if (!isPdfValid) {
      const error = new Error('Downloaded file is not a valid PDF');
      error.step = 'download_original';
      throw error;
    }
    
    console.log(`✅ Original PDF downloaded: ${fileBuffer.length} bytes`);
    return fileBuffer;
    
  } catch (error) {
    console.error('❌ Error downloading original PDF:', error);
    error.step = 'download_original';
    throw error;
  }
}

// 🎨 HELPER FUNCTION: Generate completed PDF with form overlays
async function generateCompletedPDF(originalPdfBuffer, editableElements) {
  try {
    // Import PDF-lib for PDF manipulation
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    
    // Load the original PDF
    const pdfDoc = await PDFDocument.load(originalPdfBuffer);
    const pages = pdfDoc.getPages();
    
    // Load a standard font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    console.log(`📄 Processing ${editableElements.length} form elements across ${pages.length} pages`);
    
    // Process each form element
    for (const element of editableElements) {
      if (!element.value || element.value.trim() === '') {
        continue; // Skip empty elements
      }
      
      const pageIndex = (element.page || 1) - 1; // Convert to 0-based index
      if (pageIndex < 0 || pageIndex >= pages.length) {
        console.warn(`⚠️ Element ${element.id} references invalid page ${element.page}`);
        continue;
      }
      
      const page = pages[pageIndex];
      const { width: pageWidth, height: pageHeight } = page.getSize();
      
      if (element.type === 'text' && element.value) {
        // Add text overlay
        const fontSize = element.fontSize || 12;
        const textColor = element.color || '#000000';
        
        // Convert hex color to RGB
        const r = parseInt(textColor.substr(1, 2), 16) / 255;
        const g = parseInt(textColor.substr(3, 2), 16) / 255;
        const b = parseInt(textColor.substr(5, 2), 16) / 255;
        
        // Convert coordinates (PDF coordinates start from bottom-left)
        const x = element.x || 0;
        const y = pageHeight - (element.y || 0) - (element.height || fontSize);
        
        // Handle multi-line text
        const lines = element.value.split('\n');
        const lineHeight = fontSize * 1.2;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.trim()) {
            page.drawText(line, {
              x: x,
              y: y - (i * lineHeight),
              size: fontSize,
              font: font,
              color: rgb(r, g, b)
            });
          }
        }
        
        console.log(`📝 Added text field: "${element.value.substring(0, 20)}..." at (${x}, ${y})`);
        
      } else if (element.type === 'signature' && element.value) {
        // Add signature overlay
        try {
          // The signature is stored as a data URL (data:image/png;base64,...)
          const base64Data = element.value.split(',')[1];
          const imageBytes = Buffer.from(base64Data, 'base64');
          
          // Embed the signature image
          const signatureImage = await pdfDoc.embedPng(imageBytes);
          const signatureDims = signatureImage.scale(1);
          
          // Calculate position (PDF coordinates start from bottom-left)
          const x = element.x || 0;
          const y = pageHeight - (element.y || 0) - (element.height || signatureDims.height);
          const width = element.width || signatureDims.width;
          const height = element.height || signatureDims.height;
          
          page.drawImage(signatureImage, {
            x: x,
            y: y,
            width: width,
            height: height
          });
          
          console.log(`✍️ Added signature at (${x}, ${y}) size ${width}x${height}`);
          
        } catch (sigError) {
          console.warn(`⚠️ Failed to add signature for element ${element.id}:`, sigError.message);
        }
      }
    }
    
    // Add completion metadata to PDF
    const lastPage = pages[pages.length - 1];
    const completionText = `Completed via TitanPDF on ${new Date().toLocaleDateString()}`;
    lastPage.drawText(completionText, {
      x: 50,
      y: 30,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    });
    
    // Generate the completed PDF buffer
    const completedPdfBytes = await pdfDoc.save();
    const completedPdfBuffer = Buffer.from(completedPdfBytes);
    
    console.log(`✅ Completed PDF generated: ${completedPdfBuffer.length} bytes`);
    console.log(`📊 Added ${editableElements.filter(el => el.value && el.value.trim()).length} form elements`);
    
    return completedPdfBuffer;
    
  } catch (error) {
    console.error('❌ Error generating completed PDF:', error);
    error.step = 'generate_pdf';
    throw error;
  }
}

// 🚀 HELPER FUNCTION: Upload completed PDF to ServiceTitan
async function uploadCompletedPDFToServiceTitan(jobId, pdfBuffer, fileName, jobInfo, metadata) {
  try {
    const fetch = (await import('node-fetch')).default;
    
    const tenantId = global.serviceTitan.tenantId;
    const appKey = global.serviceTitan.appKey;
    const accessToken = await global.serviceTitan.getAccessToken();
    
    // ✅ SERVICETITAN UPLOAD ENDPOINT from API documentation
    const uploadUrl = `${global.serviceTitan.apiBaseUrl}/forms/v2/tenant/${tenantId}/jobs/${jobId}/attachments`;
    
    console.log(`🚀 Uploading to ServiceTitan: ${uploadUrl}`);
    console.log(`📄 File: ${fileName} (${pdfBuffer.length} bytes)`);
    
    // ✅ Use built-in FormData (consistent with our download approach)
    const formData = new FormData();
    
    // Create a Blob from the PDF buffer for FormData
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
    
    // Add the PDF file as binary data
    formData.append('file', pdfBlob, fileName);
    
    console.log(`📤 Uploading ${fileName} to ServiceTitan...`);
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey
        // ✅ Don't set Content-Type - let FormData set it with boundary
      },
      body: formData
    });
    
    console.log(`📡 ServiceTitan upload response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ServiceTitan upload failed: ${response.status} - ${errorText}`);
      
      // Try to parse error details
      let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = errorJson.title || errorJson.detail || errorText;
        console.error(`❌ ServiceTitan error details:`, errorJson);
      } catch (e) {
        // Error wasn't JSON
      }
      
      const error = new Error(`ServiceTitan upload failed: ${response.status} - ${errorDetails}`);
      error.step = 'upload_to_servicetitan';
      error.statusCode = response.status;
      throw error;
    }
    
    // Parse the successful response
    const uploadResult = await response.json();
    
    console.log(`✅ ServiceTitan upload successful!`);
    console.log(`📋 ServiceTitan response:`, uploadResult);
    
    return {
      success: true,
      serviceTitanId: uploadResult.id || 'unknown',
      fileName: uploadResult.fileName || fileName,
      uploadedAt: new Date().toISOString(),
      jobId: jobId,
      tenantId: tenantId,
      originalResponse: uploadResult
    };
    
  } catch (error) {
    console.error('❌ Error uploading to ServiceTitan:', error);
    error.step = 'upload_to_servicetitan';
    throw error;
  }
}

// 📄 GET SAVED FORMS for a job (future enhancement)
router.get('/job/:jobId/saved-forms', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // This could query ServiceTitan for attachments that start with "Completed -"
    const attachments = await getAllJobAttachments(jobId);
    
    const savedForms = attachments.filter(attachment => 
      (attachment.fileName || attachment.name || '').startsWith('Completed -')
    );
    
    res.json({
      success: true,
      data: savedForms,
      count: savedForms.length,
      jobId: jobId,
      message: savedForms.length > 0 
        ? `Found ${savedForms.length} completed forms`
        : 'No completed forms found for this job'
    });
    
  } catch (error) {
    console.error('❌ Error fetching saved forms:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching saved forms',
      details: error.message
    });
  }
});

// 🔧 HELPER: Get all attachments for a job (including completed ones)
async function getAllJobAttachments(jobId) {
  const fetch = (await import('node-fetch')).default;
  const tenantId = global.serviceTitan.tenantId;
  const appKey = global.serviceTitan.appKey;
  const accessToken = await global.serviceTitan.getAccessToken();
  
  const attachmentsUrl = `${global.serviceTitan.apiBaseUrl}/forms/v2/tenant/${tenantId}/jobs/${jobId}/attachments`;
  
  const response = await fetch(attachmentsUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'ST-App-Key': appKey,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch attachments: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data || [];
}

// 🔍 DEBUG: Test endpoint to validate request structure
router.post('/debug/save-data', (req, res) => {
  console.log('🔍 DEBUG: Received save data');
  console.log('📋 Request headers:', req.headers);
  console.log('📋 Request body keys:', Object.keys(req.body));
  console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
  
  res.json({
    success: true,
    message: 'Debug data received',
    received: {
      headers: req.headers,
      bodyKeys: Object.keys(req.body),
      editableElementsCount: req.body.editableElements?.length || 0,
      editableElementsType: typeof req.body.editableElements,
      jobInfo: req.body.jobInfo,
      originalFileName: req.body.originalFileName,
      completedFileName: req.body.completedFileName
    }
  });
});

module.exports = router;