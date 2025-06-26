// backend/api/attachments.js - Attachments API
const express = require('express');
const router = express.Router();

// ✅ GET JOB ATTACHMENTS
router.get('/job/:jobId/attachments', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { authenticateServiceTitan } = req.app.locals.helpers;
    
    console.log(`📎 Fetching attachments for job: ${jobId}`);
    
    const tokenResult = await authenticateServiceTitan();
    if (!tokenResult.success) {
      return res.status(500).json({
        success: false,
        error: 'ServiceTitan authentication failed'
      });
    }
    
    const fetch = (await import('node-fetch')).default;
    const tenantId = process.env.REACT_APP_SERVICETITAN_TENANT_ID;
    const appKey = process.env.REACT_APP_SERVICETITAN_APP_KEY;
    const apiBaseUrl = process.env.REACT_APP_SERVICETITAN_API_BASE_URL || 'https://api-integration.servicetitan.io';
    const accessToken = tokenResult.accessToken;
    
    const attachmentsUrl = `${apiBaseUrl}/forms/v2/tenant/${tenantId}/jobs/${jobId}/attachments`;
    
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
        mimeType: attachment.mimeType || attachment.contentType || 'application/pdf'
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

// ✅ DOWNLOAD PDF ATTACHMENT
router.get('/job/:jobId/attachment/:attachmentId/download', async (req, res) => {
  try {
    const { jobId, attachmentId } = req.params;
    const { authenticateServiceTitan } = req.app.locals.helpers;
    
    console.log(`📥 Downloading PDF attachment: ${attachmentId} from job: ${jobId}`);
    
    const tokenResult = await authenticateServiceTitan();
    if (!tokenResult.success) {
      return res.status(500).json({
        success: false,
        error: 'ServiceTitan authentication failed'
      });
    }
    
    const fetch = (await import('node-fetch')).default;
    const tenantId = process.env.REACT_APP_SERVICETITAN_TENANT_ID;
    const appKey = process.env.REACT_APP_SERVICETITAN_APP_KEY;
    const apiBaseUrl = process.env.REACT_APP_SERVICETITAN_API_BASE_URL || 'https://api-integration.servicetitan.io';
    const accessToken = tokenResult.accessToken;
    
    // ✅ WORKING PATTERN: ServiceTitan redirects to Azure Blob Storage
    const downloadUrl = `${apiBaseUrl}/forms/v2/tenant/${tenantId}/jobs/attachment/${attachmentId}`;
    
    console.log(`🔗 Fetching PDF from ServiceTitan: ${downloadUrl}`);
    
    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey
      },
      redirect: 'follow' // Follow redirects to Azure Blob Storage
    });
    
    if (!response.ok) {
      console.error(`❌ Download failed: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({
        success: false,
        error: `Failed to download attachment: ${response.statusText}`
      });
    }
    
    // Get the PDF content as buffer (binary data)
    const fileBuffer = await response.buffer();
    const contentType = response.headers.get('content-type') || 'application/pdf';
    const finalUrl = response.url; // Azure Blob URL after redirect
    
    // ✅ VALIDATE THAT WE HAVE A REAL PDF
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
    
    // ✅ Send binary PDF data with proper headers
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

// ✅ SAVE COMPLETED PDF FORM
router.post('/job/:jobId/attachment/:attachmentId/save', async (req, res) => {
  try {
    const { jobId, attachmentId } = req.params;
    const { authenticateServiceTitan } = req.app.locals.helpers;
    const { 
      editableElements, 
      filledPdfData, 
      jobInfo, 
      originalFileName,
      metadata 
    } = req.body;
    
    console.log(`💾 Saving completed PDF form: ${attachmentId} for job: ${jobId}`);
    
    const tokenResult = await authenticateServiceTitan();
    if (!tokenResult.success) {
      return res.status(500).json({
        success: false,
        error: 'ServiceTitan authentication failed'
      });
    }
    
    const fetch = (await import('node-fetch')).default;
    const FormData = require('form-data');
    const tenantId = process.env.REACT_APP_SERVICETITAN_TENANT_ID;
    const appKey = process.env.REACT_APP_SERVICETITAN_APP_KEY;
    const apiBaseUrl = process.env.REACT_APP_SERVICETITAN_API_BASE_URL;
    const accessToken = tokenResult.accessToken;
    
    // Create form data JSON
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
    
    // Save as JSON file
    const jsonFileName = originalFileName.replace('.pdf', '_form_data.json');
    const jsonBlob = JSON.stringify(formDataJson, null, 2);
    
    try {
      // Upload form data to ServiceTitan
      const uploadUrl = `${apiBaseUrl}/forms/v2/tenant/${tenantId}/jobs/${jobId}/attachments`;
      
      const formData = new FormData();
      formData.append('file', Buffer.from(jsonBlob), {
        filename: jsonFileName,
        contentType: 'application/json'
      });
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'ST-App-Key': appKey,
          ...formData.getHeaders()
        },
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        
        console.log(`✅ Form data saved to ServiceTitan: ${result.id || result.attachmentId}`);
        
        res.json({
          success: true,
          message: 'PDF form completed and saved successfully',
          data: {
            originalAttachmentId: attachmentId,
            formDataFileId: result.id || result.attachmentId,
            formDataFileName: jsonFileName,
            completedAt: new Date().toISOString(),
            elementCount: editableElements.length,
            jobInfo: jobInfo
          }
        });
        
      } else {
        const errorText = await response.text();
        console.error(`❌ ServiceTitan upload failed: ${response.status} - ${errorText}`);
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }
      
    } catch (uploadError) {
      console.error('❌ Error uploading to ServiceTitan:', uploadError);
      
      // Fallback: Return the data for client-side handling
      res.json({
        success: true,
        message: 'PDF form completed (saved locally)',
        fallback: true,
        data: {
          originalAttachmentId: attachmentId,
          formData: formDataJson,
          completedAt: new Date().toISOString(),
          note: 'Form data saved locally - ServiceTitan upload failed'
        }
      });
    }
    
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