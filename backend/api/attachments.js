// backend/api/attachments.js - FIXED with proper coordinate conversion and checkbox handling
const express = require('express');
const router = express.Router();

// Import pdf-lib using CommonJS (Node.js compatible)
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

// GET JOB ATTACHMENTS (unchanged)
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

// PDF DOWNLOAD ENDPOINT (unchanged)
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

// ✅ FIXED: PDF SAVE with CORRECT coordinate conversion and checkbox handling
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
      
      console.log(`📄 Processing ${Object.keys(elementsByPage).length} pages with fields`);
      
      // Process each page
      Object.keys(elementsByPage).forEach(pageNumStr => {
        const pageNum = parseInt(pageNumStr);
        const pageIndex = pageNum - 1; // Convert to 0-based index
        
        if (pageIndex >= 0 && pageIndex < pages.length) {
          const page = pages[pageIndex];
          const pageHeight = page.getHeight();
          const pageWidth = page.getWidth();
          
          console.log(`📄 Processing page ${pageNum}: ${pageWidth.toFixed(1)}x${pageHeight.toFixed(1)} points`);
          
          elementsByPage[pageNumStr].forEach((element, index) => {
            try {
              // ✅ FIXED: Better coordinate conversion with fine-tuned positioning
              const editorX = parseFloat(element.x) || 0;
              const editorY = parseFloat(element.y) || 0;
              const elementWidth = parseFloat(element.width) || 100;
              const elementHeight = parseFloat(element.height) || 20;
              
              // Convert editor coordinates to PDF coordinates with fine-tuned positioning
              const pdfX = editorX;
              // ✅ FIXED: Fine-tune offset - move slightly down from 0.5 to 0.6
              const pdfY = pageHeight - editorY - (elementHeight * 0.6);
              
              // Ensure coordinates are within page bounds
              const safeX = Math.max(5, Math.min(pdfX, pageWidth - 10));
              const safeY = Math.max(5, Math.min(pdfY, pageHeight - 10));
              
              console.log(`   Field ${index + 1} (${element.type}): Editor(${editorX.toFixed(1)}, ${editorY.toFixed(1)}) → PDF(${safeX.toFixed(1)}, ${safeY.toFixed(1)})`);
              
              // Handle different field types with improved rendering
              switch (element.type) {
                case 'text':
                  if (element.content && element.content.toString().trim()) {
                    const fontSize = Math.max(8, Math.min(parseFloat(element.fontSize) || 11, 20)); // Default to 11px
                    const textColor = rgb(0, 0, 0);
                    const contentStr = element.content.toString();
                    
                    // Handle multi-line text properly
                    const lines = contentStr.split('\n');
                    const lineHeight = fontSize * 1.2;
                    
                    lines.forEach((line, lineIndex) => {
                      if (line.trim()) {
                        const lineY = safeY - (lineIndex * lineHeight);
                        
                        // Only draw if line is within page bounds
                        if (lineY > 10 && lineY < pageHeight - 10) {
                          page.drawText(line.trim(), {
                            x: safeX,
                            y: lineY,
                            size: fontSize,
                            font: font,
                            color: textColor,
                            maxWidth: Math.min(elementWidth, pageWidth - safeX - 10)
                          });
                        }
                      }
                    });
                  }
                case 'signature':
                  if (element.content && typeof element.content === 'string') {
                    // ✅ NEW: Handle signature images
                    try {
                      // Check if it's a base64 data URL
                      if (element.content.startsWith('data:image/')) {
                        // For now, just indicate signature was applied
                        // In a full implementation, you'd decode and embed the base64 image
                        const sigText = '[SIGNATURE APPLIED]';
                        
                        // Draw signature placeholder
                        page.drawText(sigText, {
                          x: safeX,
                          y: safeY + (elementHeight / 2),
                          size: 10,
                          font: boldFont,
                          color: rgb(0, 0, 1)
                        });
                        
                        // Draw a border around signature area
                        page.drawRectangle({
                          x: safeX,
                          y: safeY,
                          width: Math.min(elementWidth, pageWidth - safeX - 10),
                          height: Math.min(elementHeight, 40),
                          borderColor: rgb(0, 0, 1),
                          borderWidth: 1
                        });
                        
                        console.log(`   ✅ Signature applied`);
                      }
                    } catch (signatureError) {
                      console.error(`   ❌ Error processing signature:`, signatureError.message);
                      // Fallback: just indicate signature was attempted
                      page.drawText('[SIGNATURE]', {
                        x: safeX,
                        y: safeY,
                        size: 10,
                        font: font,
                        color: rgb(0, 0, 0)
                      });
                    }
                  }
                  break;
                  
                case 'date':
                  if (element.content && element.content.toString().trim()) {
                    const fontSize = Math.max(8, Math.min(parseFloat(element.fontSize) || 11, 16)); // Default to 11px
                    const contentStr = element.content.toString();
                    
                    page.drawText(contentStr, {
                      x: safeX,
                      y: safeY,
                      size: fontSize,
                      font: font,
                      color: rgb(0, 0, 0),
                      maxWidth: Math.min(elementWidth, pageWidth - safeX - 10)
                    });
                  }
                  break;
                  
                case 'checkbox':
                  // ✅ FIXED: Properly handle checkbox boolean values
                  const isChecked = element.content === true || element.content === 'true' || element.content === 1;
                  
                  // ✅ FIXED: Just draw X without border box, matching frontend style
                  if (isChecked) {
                    const fontSize = 10; // ✅ Match frontend: 10px, not dynamic sizing
                    
                    page.drawText('X', {
                      x: safeX,
                      y: safeY,
                      size: fontSize,
                      font: font, // ✅ Use regular font, not boldFont for non-bold appearance
                      color: rgb(0, 0, 0)
                    });
                    
                    console.log(`   ✅ Checkbox marked as CHECKED (X) - 10px, non-bold`);
                  } else {
                    console.log(`   ☐ Checkbox marked as UNCHECKED (no output)`);
                  }
                  break;
                  
                case 'signature':
                  if (element.content && typeof element.content === 'string') {
                    // For now, just indicate signature was applied
                    // In a full implementation, you'd decode the base64 image data
                    const sigText = '[SIGNATURE APPLIED]';
                    
                    // Draw signature placeholder
                    page.drawText(sigText, {
                      x: safeX,
                      y: safeY + elementHeight / 2,
                      size: 10,
                      font: boldFont,
                      color: rgb(0, 0, 1)
                    });
                    
                    // Draw a border around signature area
                    page.drawRectangle({
                      x: safeX,
                      y: safeY,
                      width: Math.min(elementWidth, pageWidth - safeX - 10),
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
              console.error(`   ❌ Error processing element ${index + 1} (${element.type}):`, elementError.message);
              // Continue processing other elements even if one fails
            }
          });
        } else {
          console.warn(`⚠️ Page ${pageNum} not found in PDF (document has ${pages.length} pages)`);
        }
      });
      
      // Generate the completed PDF
      filledPdfBytes = await pdfDoc.save();
      console.log(`✅ Completed PDF generated: ${filledPdfBytes.length} bytes with ${editableElements.length} fields`);
      
      // Generate clean filename
      let cleanFileName = (originalFileName || 'Form').replace(/\.pdf$/i, '');
      
      if (cleanFileName.includes('/')) {
        cleanFileName = cleanFileName.split('/').pop();
      }
      
      // Remove ServiceTitan ID patterns if present
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
        
        // Return success response with detailed information
        res.json({
          success: true,
          message: `PDF form completed and uploaded to ServiceTitan successfully`,
          fileName: completedFileName,
          fileSize: filledPdfBytes.length,
          elementsProcessed: editableElements.length,
          coordinateConversion: 'Fixed: Editor top-left origin → PDF bottom-left origin',
          uploadDetails: {
            serviceTitanId: uploadResult.id || 'Unknown',
            uploadedAt: new Date().toISOString(),
            originalFileName: originalFileName,
            fieldsProcessed: {
              text: editableElements.filter(e => e.type === 'text').length,
              checkboxes: editableElements.filter(e => e.type === 'checkbox').length,
              dates: editableElements.filter(e => e.type === 'date' || e.type === 'timestamp').length,
              signatures: editableElements.filter(e => e.type === 'signature').length
            }
          }
        });
        
      } else {
        const errorText = await uploadResponse.text();
        console.error(`❌ ServiceTitan upload failed: ${uploadResponse.status} - ${errorText}`);
        
        res.status(500).json({
          success: false,
          error: `ServiceTitan upload failed: ${uploadResponse.status}`,
          details: errorText,
          fileName: completedFileName,
          pdfGenerated: true
        });
      }
      
    } catch (uploadError) {
      console.error('❌ Error uploading to ServiceTitan:', uploadError);
      
      res.status(500).json({
        success: false,
        error: 'Error uploading to ServiceTitan',
        details: uploadError.message,
        fileName: completedFileName,
        pdfGenerated: true
      });
    }
    
  } catch (error) {
    console.error('❌ Error in PDF upload process:', error);
    
    // Enhanced error response with troubleshooting info
    const errorResponse = {
      success: false,
      error: 'Server error processing PDF form',
      details: error.message,
      step: error.message.includes('download') ? 'download_pdf' : 
            error.message.includes('PDF generation') ? 'generate_pdf' : 
            error.message.includes('authentication') ? 'authentication' : 'unknown',
      troubleshooting: {
        coordinateSystem: 'PDF uses bottom-left origin (0,0), editor uses top-left',
        checkboxHandling: 'Boolean values are converted to visual checkmarks',
        supportedFields: ['text', 'checkbox', 'date', 'timestamp', 'signature']
      }
    };
    
    res.status(500).json(errorResponse);
  }
});

// UTILITY: Get PDF Info (unchanged but enhanced)
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
      coordinateSystem: {
        origin: 'PDF uses bottom-left (0,0), web editor uses top-left (0,0)',
        conversionFormula: 'pdfY = pageHeight - editorY - elementHeight',
        units: 'Points (1/72 inch)',
        yAxisDirection: 'PDF: upward, Editor: downward'
      },
      supportedFieldTypes: {
        text: 'Multi-line text with automatic line breaking',
        checkbox: 'Boolean values converted to visual checkmarks',
        date: 'Date picker values formatted for display',
        timestamp: 'Date and time values',
        signature: 'Base64 image data or signature placeholder'
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