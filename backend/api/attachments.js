// backend/api/attachments.js - CORRECTED with proper try-catch syntax
const express = require('express');
const router = express.Router();

// Import pdf-lib using CommonJS (Node.js compatible)
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

// GET JOB ATTACHMENTS
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

// PDF DOWNLOAD ENDPOINT
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
    
    const arrayBuffer = await response.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'application/pdf';
    
    const isPdfValid = fileBuffer.length > 0 && fileBuffer.toString('ascii', 0, 4) === '%PDF';
    
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

// ENHANCED PDF SAVE with FIXED positioning and support for all field types
router.post('/job/:jobId/attachment/:attachmentId/save', async (req, res) => {
  try {
    const { jobId, attachmentId } = req.params;
    const { 
      editableElements, 
      jobInfo, 
      originalFileName,
      metadata 
    } = req.body;
    
    console.log(`💾 Saving completed PDF form: ${attachmentId} for job: ${jobId}`);
    console.log(`📊 Form elements received: ${editableElements?.length || 0}`);
    
    if (!editableElements || editableElements.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No form elements provided'
      });
    }
    
    // Step 1: Download the original PDF
    console.log(`📥 Step 1: Downloading original PDF...`);
    
    const tokenResult = await global.serviceTitan.getAccessToken();
    if (!tokenResult) {
      throw new Error('ServiceTitan authentication failed');
    }
    
    const fetch = (await import('node-fetch')).default;
    const tenantId = global.serviceTitan.tenantId;
    const appKey = global.serviceTitan.appKey;
    const accessToken = tokenResult;
    
    const downloadUrl = `${global.serviceTitan.apiBaseUrl}/forms/v2/tenant/${tenantId}/jobs/attachment/${attachmentId}`;
    
    const pdfResponse = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey
      },
      redirect: 'follow'
    });
    
    if (!pdfResponse.ok) {
      throw new Error(`Failed to download original PDF: ${pdfResponse.statusText}`);
    }
    
    const originalPdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    console.log(`✅ Original PDF downloaded: ${originalPdfBuffer.length} bytes`);
    
    // Step 2: Create filled PDF using pdf-lib with FIXED positioning
    console.log(`🔧 Step 2: Generating completed PDF with form data...`);
    
    let filledPdfBytes;
    let completedFileName;
    
    try {
      // Load the original PDF
      const pdfDoc = await PDFDocument.load(originalPdfBuffer);
      const pages = pdfDoc.getPages();
      
      // Embed fonts
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // Group elements by page for better processing
      const elementsByPage = {};
      editableElements.forEach(element => {
        const pageNum = element.page || 1;
        if (!elementsByPage[pageNum]) {
          elementsByPage[pageNum] = [];
        }
        elementsByPage[pageNum].push(element);
      });
      
      // Process each page
      Object.keys(elementsByPage).forEach(pageNumStr => {
        const pageNum = parseInt(pageNumStr);
        const pageIndex = pageNum - 1; // Convert to 0-based index
        
        if (pageIndex >= 0 && pageIndex < pages.length) {
          const page = pages[pageIndex];
          const pageHeight = page.getHeight();
          const pageWidth = page.getWidth();
          
          console.log(`📄 Processing page ${pageNum}: ${pageWidth}x${pageHeight} points`);
          
          elementsByPage[pageNumStr].forEach((element, index) => {
            try {
              // FIXED: Proper coordinate conversion
              // PDF coordinates: (0,0) is bottom-left
              // Editor coordinates: (0,0) is top-left
              // Formula: pdfY = pageHeight - editorY - elementHeight
              
              const editorX = element.x || 0;
              const editorY = element.y || 0;
              const elementWidth = element.width || 100;
              const elementHeight = element.height || 20;
              
              // Convert editor coordinates to PDF coordinates
              const pdfX = editorX;
              const pdfY = pageHeight - editorY - elementHeight;
              
              console.log(`   [${index}] ${element.type}: Editor(${editorX.toFixed(1)}, ${editorY.toFixed(1)}) → PDF(${pdfX.toFixed(1)}, ${pdfY.toFixed(1)})`);
              
              // Handle different field types
              switch (element.type) {
                case 'text':
                  if (element.content && element.content.trim()) {
                    const fontSize = Math.max(8, Math.min(element.fontSize || 12, 20));
                    const textColor = rgb(0, 0, 0);
                    
                    // Handle multi-line text
                    const lines = element.content.toString().split('\n');
                    const lineHeight = fontSize * 1.2;
                    
                    lines.forEach((line, lineIndex) => {
                      if (line.trim()) {
                        const lineY = pdfY - (lineIndex * lineHeight);
                        
                        // Ensure text doesn't go below page bounds
                        if (lineY > 0) {
                          page.drawText(line, {
                            x: Math.max(0, Math.min(pdfX, pageWidth - 50)),
                            y: Math.max(10, lineY),
                            size: fontSize,
                            font: font,
                            color: textColor,
                            maxWidth: Math.min(elementWidth, pageWidth - pdfX - 10)
                          });
                        }
                      }
                    });
                  }
                  break;
                  
                case 'date':
                case 'timestamp':
                  if (element.content) {
                    const fontSize = Math.max(8, Math.min(element.fontSize || 12, 16));
                    
                    page.drawText(element.content.toString(), {
                      x: Math.max(0, Math.min(pdfX, pageWidth - 50)),
                      y: Math.max(10, pdfY),
                      size: fontSize,
                      font: font,
                      color: rgb(0, 0, 0),
                      maxWidth: Math.min(elementWidth, pageWidth - pdfX - 10)
                    });
                  }
                  break;
                  
                case 'checkbox':
                  // Draw checkbox
                  const checkboxSize = Math.min(elementWidth, elementHeight, 20);
                  const checkboxX = Math.max(0, Math.min(pdfX, pageWidth - checkboxSize));
                  const checkboxY = Math.max(10, pdfY);
                  
                  // Draw checkbox border
                  page.drawRectangle({
                    x: checkboxX,
                    y: checkboxY,
                    width: checkboxSize,
                    height: checkboxSize,
                    borderColor: rgb(0, 0, 0),
                    borderWidth: 1.5
                  });
                  
                  // Draw check mark if checked
                  if (element.content === true) {
                    const checkMarkSize = checkboxSize * 0.6;
                    const checkMarkX = checkboxX + (checkboxSize - checkMarkSize) / 2;
                    const checkMarkY = checkboxY + (checkboxSize - checkMarkSize) / 2;
                    
                    page.drawText('✓', {
                      x: checkMarkX,
                      y: checkMarkY,
                      size: checkMarkSize,
                      font: boldFont,
                      color: rgb(0, 0, 0)
                    });
                  }
                  break;
                  
                case 'signature':
                  if (element.content) {
                    page.drawText('[SIGNATURE APPLIED]', {
                      x: Math.max(0, Math.min(pdfX, pageWidth - 100)),
                      y: Math.max(10, pdfY),
                      size: 10,
                      font: boldFont,
                      color: rgb(0, 0, 1)
                    });
                    
                    // Draw a border around signature area
                    page.drawRectangle({
                      x: Math.max(0, Math.min(pdfX, pageWidth - elementWidth)),
                      y: Math.max(10, pdfY),
                      width: Math.min(elementWidth, pageWidth - pdfX - 10),
                      height: Math.min(elementHeight, 40),
                      borderColor: rgb(0, 0, 1),
                      borderWidth: 1
                    });
                  }
                  break;
                  
                default:
                  console.warn(`   ⚠️ Unknown element type: ${element.type}`);
              }
              
            } catch (elementError) {
              console.error(`   ❌ Error processing element ${index} (${element.type}):`, elementError.message);
            }
          });
        } else {
          console.warn(`⚠️ Page ${pageNum} not found in PDF (has ${pages.length} pages)`);
        }
      });
      
      // Generate the completed PDF
      filledPdfBytes = await pdfDoc.save();
      console.log(`✅ Completed PDF generated: ${filledPdfBytes.length} bytes`);
      
      // Clean up filename
      let cleanFileName = (originalFileName || 'Form').replace(/\.pdf$/i, '');
      
      if (cleanFileName.includes('/')) {
        cleanFileName = cleanFileName.split('/').pop();
      }
      
      cleanFileName = cleanFileName.replace(/@@\d+.*$/, match => {
        const atMatch = match.match(/@@\d+/);
        return atMatch ? atMatch[0] : '';
      });
      
      completedFileName = `Completed - ${cleanFileName}.pdf`;
      
    } catch (pdfError) {
      console.error('❌ Error generating completed PDF:', pdfError);
      throw new Error(`PDF generation failed: ${pdfError.message}`);
    }
    
    // Step 3: Upload the completed PDF back to ServiceTitan
    console.log(`📤 Step 3: Uploading completed PDF to ServiceTitan...`);
    
    try {
      // Create multipart form data for file upload
      const boundary = '----TitanPDFBoundary' + Date.now();
      const fileBuffer = Buffer.from(filledPdfBytes);
      
      // Build multipart form data manually
      const formParts = [];
      
      // Add file part
      formParts.push(`--${boundary}\r\n`);
      formParts.push(`Content-Disposition: form-data; name="file"; filename="${completedFileName}"\r\n`);
      formParts.push(`Content-Type: application/pdf\r\n\r\n`);
      
      // Add metadata parts
      const metaParts = [
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="name"\r\n\r\n`,
        `${completedFileName}\r\n`,
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="description"\r\n\r\n`,
        `Completed form with ${editableElements.length} filled fields\r\n`,
        `--${boundary}--\r\n`
      ];
      
      // Combine all parts
      const formPrefix = Buffer.from(formParts.join(''), 'utf8');
      const formSuffix = Buffer.from(metaParts.join(''), 'utf8');
      const formBody = Buffer.concat([formPrefix, fileBuffer, formSuffix]);
      
      // ServiceTitan Forms API upload endpoint
      const uploadUrl = `${global.serviceTitan.apiBaseUrl}/forms/v2/tenant/${tenantId}/jobs/${jobId}/attachments`;
      
      console.log(`🔗 Uploading to: ${uploadUrl}`);
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'ST-App-Key': appKey,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': formBody.length.toString()
        },
        body: formBody
      });
      
      if (uploadResponse.ok) {
        const uploadResult = await uploadResponse.json();
        console.log(`✅ Successfully uploaded "${completedFileName}" to ServiceTitan!`);
        
        // Return success response
        res.json({
          success: true,
          message: `PDF form completed and uploaded to ServiceTitan successfully`,
          fileName: completedFileName,
          fileSize: filledPdfBytes.length,
          elementsProcessed: editableElements.length,
          uploadDetails: {
            serviceTitanId: uploadResult.id || 'Unknown',
            uploadedAt: new Date().toISOString(),
            originalFileName: originalFileName
          }
        });
        
      } else {
        const errorText = await uploadResponse.text();
        console.error(`❌ ServiceTitan upload failed: ${uploadResponse.status} - ${errorText}`);
        
        res.status(500).json({
          success: false,
          error: `ServiceTitan upload failed: ${uploadResponse.status}`,
          details: errorText,
          fileName: completedFileName
        });
      }
      
    } catch (uploadError) {
      console.error('❌ Error uploading to ServiceTitan:', uploadError);
      
      res.status(500).json({
        success: false,
        error: 'Error uploading to ServiceTitan',
        details: uploadError.message,
        fileName: completedFileName
      });
    }
    
  } catch (error) {
    console.error('❌ Error in PDF upload process:', error);
    
    // Enhanced error response
    const errorResponse = {
      success: false,
      error: 'Server error processing PDF form',
      details: error.message,
      step: error.message.includes('download') ? 'download_pdf' : 
            error.message.includes('PDF generation') ? 'generate_pdf' : 
            error.message.includes('authentication') ? 'authentication' : 'unknown'
    };
    
    res.status(500).json(errorResponse);
  }
});

// UTILITY: Get PDF Info
router.get('/job/:jobId/attachment/:attachmentId/info', async (req, res) => {
  try {
    const { jobId, attachmentId } = req.params;
    
    const tokenResult = await global.serviceTitan.getAccessToken();
    if (!tokenResult) {
      throw new Error('ServiceTitan authentication failed');
    }
    
    const fetch = (await import('node-fetch')).default;
    const tenantId = global.serviceTitan.tenantId;
    const appKey = global.serviceTitan.appKey;
    const accessToken = tokenResult;
    
    const downloadUrl = `${global.serviceTitan.apiBaseUrl}/forms/v2/tenant/${tenantId}/jobs/attachment/${attachmentId}`;
    
    const pdfResponse = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey
      },
      redirect: 'follow'
    });
    
    if (!pdfResponse.ok) {
      throw new Error(`Failed to download PDF: ${pdfResponse.statusText}`);
    }
    
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    
    // Analyze PDF with pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const form = pdfDoc.getForm();
    
    const pdfInfo = {
      success: true,
      fileSize: pdfBuffer.length,
      pageCount: pages.length,
      title: pdfDoc.getTitle() || 'Untitled',
      pages: pages.map((page, index) => ({
        number: index + 1,
        width: page.getWidth(),
        height: page.getHeight(),
        rotation: page.getRotation().angle
      })),
      positioningInfo: {
        coordinateOrigin: 'PDF uses bottom-left (0,0), web editor uses top-left (0,0)',
        conversionMethod: 'pdfY = pageHeight - editorY - elementHeight',
        supportedFieldTypes: ['text', 'signature', 'date', 'timestamp', 'checkbox']
      }
    };
    
    res.json(pdfInfo);
    
  } catch (error) {
    console.error('❌ Error analyzing PDF:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error analyzing PDF',
      details: error.message
    });
  }
});

module.exports = router;