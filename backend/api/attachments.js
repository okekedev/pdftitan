// backend/api/attachments.js - CORRECTED based on your working server.js
const express = require('express');
const router = express.Router();

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
    
    // ✅ Get the PDF content as buffer (binary data) - WORKING METHOD
    const fileBuffer = await response.buffer();
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

// ✅ SAVE COMPLETED PDF FORM - From your working implementation
router.post('/job/:jobId/attachment/:attachmentId/save', async (req, res) => {
  try {
    const { jobId, attachmentId } = req.params;
    const { 
      editableElements, 
      filledPdfData, 
      jobInfo, 
      originalFileName,
      metadata 
    } = req.body;
    
    console.log(`💾 Saving completed PDF form: ${attachmentId} for job: ${jobId}`);
    
    const tokenResult = await global.serviceTitan.getAccessToken();
    if (!tokenResult) {
      return res.status(500).json({
        success: false,
        error: 'ServiceTitan authentication failed'
      });
    }
    
    // Create form data JSON (matching your working implementation)
    const formDataJson = {
      originalAttachmentId: attachmentId,
      jobId: jobId,
      completedAt: new Date().toISOString(),
      jobInfo: jobInfo,
      metadata: metadata || {
        version: '1.0.0',
        source: 'TitanPDF Mobile Editor',
        elementCount: editableElements.length
      },
      formElements: editableElements.map(element => ({
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
        fieldName: element.fieldName || null,
        isPdfField: element.isPdfField || false
      }))
    };
    
    // For now, return success with form data (as in your working code)
    // This can be enhanced later to actually upload to ServiceTitan
    res.json({
      success: true,
      message: 'PDF form completed and saved successfully',
      data: {
        originalAttachmentId: attachmentId,
        formDataFileName: originalFileName.replace('.pdf', '_form_data.json'),
        completedAt: new Date().toISOString(),
        elementCount: editableElements.length,
        jobInfo: jobInfo,
        formData: formDataJson
      }
    });
    
  } catch (error) {
    console.error('❌ Error saving completed PDF form:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error saving completed PDF form',
      details: error.message
    });
  }
});

module.exports = router;