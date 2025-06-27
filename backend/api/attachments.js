// backend/api/attachments.js - FIXED with proper pdf-lib integration and manual form data
const express = require('express');
const router = express.Router();

// ✅ Import pdf-lib using CommonJS (Node.js compatible)
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

// ✅ GET JOB ATTACHMENTS - Using working endpoint from your server.js
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
    
    // Filter for PDF files only (matching your working code logic)
    const pdfAttachments = attachments.filter(attachment => {
      const fileName = attachment.fileName || attachment.name || '';
      const mimeType = attachment.mimeType || attachment.contentType || '';
      const fileExtension = fileName.toLowerCase().split('.').pop();
      
      return fileExtension === 'pdf' || mimeType.includes('pdf');
    });
    
    // Transform attachments for frontend (matching your working format)
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
        category: 'PDF Form' // Add category for frontend display
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

// ✅ WORKING PDF DOWNLOAD - Exact copy from your working server.js
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
    
    // ✅ WORKING PATTERN: ServiceTitan redirects to Azure Blob Storage
    // This is the EXACT working endpoint from your server.js
    const downloadUrl = `${global.serviceTitan.apiBaseUrl}/forms/v2/tenant/${tenantId}/jobs/attachment/${attachmentId}`;
    
    console.log(`🔗 Fetching PDF from ServiceTitan: ${downloadUrl}`);
    
    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey
      },
      redirect: 'follow' // ✅ CRITICAL: Follow redirects to Azure Blob Storage
    });
    
    if (!response.ok) {
      console.error(`❌ Download failed: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        success: false,
        error: `Failed to download attachment: ${response.statusText}`
      });
    }
    
    // ✅ Get the PDF content as buffer (binary data) - FIXED DEPRECATION
    const arrayBuffer = await response.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'application/pdf';
    const finalUrl = response.url; // Azure Blob URL after redirect
    
    // ✅ VALIDATE THAT WE HAVE A REAL PDF - WORKING VALIDATION
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
    
    // ✅ Send binary PDF data with proper headers - WORKING HEADERS
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': fileBuffer.length,
      'Content-Disposition': `inline; filename="attachment_${attachmentId}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
      'Accept-Ranges': 'bytes'
    });
    
    // Send the raw binary PDF data
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

// ✅ ENHANCED PDF SAVE with pdf-lib Integration and Manual Form Data
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
    
    // ✅ Step 1: Download the original PDF
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
    
    // ✅ Step 2: Create filled PDF using pdf-lib
    console.log(`🔧 Step 2: Generating completed PDF with form data...`);
    
    try {
      // Load the original PDF
      const pdfDoc = await PDFDocument.load(originalPdfBuffer);
      const pages = pdfDoc.getPages();
      
      // Embed a standard font
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // Process each form element
      editableElements.forEach((element, index) => {
        const pageIndex = (element.page || 1) - 1; // Convert to 0-based index
        
        if (pageIndex >= 0 && pageIndex < pages.length) {
          const page = pages[pageIndex];
          const pageHeight = page.getHeight();
          
          // Convert coordinates (PDF uses bottom-left origin, your editor uses top-left)
          const pdfX = element.x || 0;
          const pdfY = pageHeight - (element.y || 0) - (element.height || 20);
          
          console.log(`   [${index}] Processing ${element.type} element on page ${element.page}: "${element.content || 'empty'}"`);
          
          if (element.type === 'text' && element.content) {
            // Add text to PDF
            const fontSize = Math.max(8, Math.min(element.fontSize || 12, 20)); // Reasonable font size
            const textColor = element.color === '#000000' ? rgb(0, 0, 0) : rgb(0, 0, 0); // Default to black
            
            page.drawText(element.content.toString(), {
              x: pdfX,
              y: pdfY,
              size: fontSize,
              font: font,
              color: textColor,
              maxWidth: element.width || 200
            });
          } else if (element.type === 'signature' && element.content) {
            // For signatures, add a text placeholder (you can enhance this later with actual image embedding)
            page.drawText('[SIGNATURE]', {
              x: pdfX,
              y: pdfY,
              size: 10,
              font: boldFont,
              color: rgb(0, 0, 1) // Blue color for signature placeholder
            });
            
            // TODO: Embed actual signature image using pdfDoc.embedPng() when element.content is a data URI
          }
        }
      });
      
      // ✅ Step 3: Generate the completed PDF
      const filledPdfBytes = await pdfDoc.save();
      console.log(`✅ Completed PDF generated: ${filledPdfBytes.length} bytes`);
      
      // ✅ Step 4: Upload the completed PDF back to ServiceTitan
      // ✅ FIXED: Remove folder path and clean up filename
      let cleanFileName = (originalFileName || 'Form').replace(/\.pdf$/i, ''); // Remove .pdf extension
      
      // Remove folder path prefix (e.g., "Attaches/" from "Attaches/S2502270659@@3-...")
      if (cleanFileName.includes('/')) {
        cleanFileName = cleanFileName.split('/').pop(); // Get everything after the last slash
      }
      
      // Remove everything after @@X pattern (e.g., remove "-_Gy1Go5m29TYQ~I8RbKS" from "S2502270659@@3-_Gy1Go5m29TYQ~I8RbKS")
      cleanFileName = cleanFileName.replace(/@@\d+.*$/, match => {
        // Keep just the @@X part, remove everything after it
        const atMatch = match.match(/@@\d+/);
        return atMatch ? atMatch[0] : '';
      });
      
      const completedFileName = `Completed - ${cleanFileName}.pdf`;
      
      console.log(`📤 Step 4: Uploading completed PDF to ServiceTitan...`);
      
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
          console.log(`📊 Upload details:`, uploadResult);
          
          // ✅ Return success response instead of downloading file
          res.json({
            success: true,
            message: `PDF form completed and uploaded to ServiceTitan successfully`,
            fileName: completedFileName,
            fileSize: filledPdfBytes.length,
            uploadDetails: {
              serviceTitanId: uploadResult.id || 'Unknown',
              uploadedAt: new Date().toISOString(),
              originalFileName: originalFileName
            }
          });
          
          console.log(`✅ Success response sent for: ${completedFileName}`);
          
        } else {
          const errorText = await uploadResponse.text();
          console.error(`❌ ServiceTitan upload failed: ${uploadResponse.status} - ${errorText}`);
          
          // Return error response instead of downloading file
          res.status(500).json({
            success: false,
            error: `ServiceTitan upload failed: ${uploadResponse.status}`,
            details: errorText,
            fileName: completedFileName
          });
          
          console.log(`❌ Upload failed for: ${completedFileName}`);
        }
        
      } catch (uploadError) {
        console.error('❌ Error uploading to ServiceTitan:', uploadError);
        
        // Return error response instead of downloading file
        res.status(500).json({
          success: false,
          error: 'Error uploading to ServiceTitan',
          details: uploadError.message,
          fileName: completedFileName
        });
        
        console.log(`❌ Upload error for: ${completedFileName}`);
      }
      
    } catch (pdfError) {
      console.error('❌ Error generating completed PDF:', pdfError);
      throw new Error(`PDF generation failed: ${pdfError.message}`);
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

// ✅ UTILITY: Get PDF Info (bonus endpoint for debugging)
router.get('/job/:jobId/attachment/:attachmentId/info', async (req, res) => {
  try {
    const { jobId, attachmentId } = req.params;
    
    // Download the PDF first
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
      author: pdfDoc.getAuthor() || 'Unknown',
      subject: pdfDoc.getSubject() || 'N/A',
      creator: pdfDoc.getCreator() || 'Unknown',
      producer: pdfDoc.getProducer() || 'Unknown',
      creationDate: pdfDoc.getCreationDate()?.toISOString() || null,
      modificationDate: pdfDoc.getModificationDate()?.toISOString() || null,
      hasForm: !!form,
      formFields: form ? form.getFields().map(field => ({
        name: field.getName(),
        type: field.constructor.name
      })) : [],
      pages: pages.map((page, index) => ({
        number: index + 1,
        width: page.getWidth(),
        height: page.getHeight(),
        rotation: page.getRotation().angle
      }))
    };
    
    console.log(`📊 PDF Analysis for ${attachmentId}:`, pdfInfo);
    
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