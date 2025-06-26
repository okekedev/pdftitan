// api/attachments.js - Attachments API (Optimized for Serverless)
const express = require('express');
const serviceTitan = require('../utils/serviceTitan');
const router = express.Router();

// ✅ GET JOB ATTACHMENTS
router.get('/job/:jobId/attachments', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    console.log(`📎 Fetching attachments for job: ${jobId}`);
    
    const endpoint = serviceTitan.buildTenantUrl('forms') + `/jobs/${jobId}/attachments`;
    
    try {
      const attachmentsData = await serviceTitan.apiCall(endpoint);
      const attachments = attachmentsData.data || [];
      
      // Filter for PDF files only
      const pdfAttachments = attachments.filter(attachment => {
        const fileName = attachment.fileName || attachment.name || '';
        const mimeType = attachment.mimeType || attachment.contentType || '';
        const fileExtension = fileName.toLowerCase().split('.').pop();
        
        return fileExtension === 'pdf' || mimeType === 'application/pdf';
      });
      
      // Transform attachments for frontend
      const transformedAttachments = pdfAttachments.map(attachment => ({
        id: attachment.id,
        serviceTitanId: attachment.id,
        name: attachment.fileName || attachment.name || 'Unnamed PDF',
        fileName: attachment.fileName || attachment.name,
        mimeType: attachment.mimeType || attachment.contentType || 'application/pdf',
        size: attachment.size || 0,
        sizeFormatted: attachment.size ? `${Math.round(attachment.size / 1024)} KB` : 'Unknown size',
        createdOn: attachment.createdOn || attachment.uploadedOn,
        modifiedOn: attachment.modifiedOn,
        jobId: jobId,
        downloadUrl: `/api/job/${jobId}/attachment/${attachment.id}/download`,
        canEdit: true,
        category: attachment.category || 'PDF Form',
        
        // Additional metadata
        uploadedBy: attachment.uploadedBy,
        description: attachment.description,
        tags: attachment.tags || []
      }));
      
      console.log(`✅ Found ${transformedAttachments.length} PDF attachments out of ${attachments.length} total attachments`);
      
      res.json({
        success: true,
        data: transformedAttachments,
        count: transformedAttachments.length,
        totalAttachments: attachments.length,
        jobId: jobId
      });
      
    } catch (error) {
      if (error.message.includes('404')) {
        return res.json({
          success: true,
          data: [],
          count: 0,
          message: 'No attachments found for this job',
          jobId: jobId
        });
      }
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error fetching job attachments:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching job attachments',
      jobId: req.params.jobId
    });
  }
});

// ✅ DOWNLOAD ATTACHMENT
router.get('/job/:jobId/attachment/:attachmentId/download', async (req, res) => {
  try {
    const { jobId, attachmentId } = req.params;
    
    console.log(`📥 Downloading attachment: ${attachmentId} for job: ${jobId}`);
    
    const endpoint = serviceTitan.buildTenantUrl('forms') + `/jobs/${jobId}/attachments/${attachmentId}/download`;
    
    // Use raw fetch for file downloads
    const response = await serviceTitan.rawFetch(endpoint, {
      headers: {
        'Content-Type': undefined // Let ServiceTitan set the content type
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Download failed: ${response.status} - ${errorText}`);
    }
    
    // Get content type and filename from response headers
    const contentType = response.headers.get('content-type') || 'application/pdf';
    const contentDisposition = response.headers.get('content-disposition');
    
    let filename = `attachment-${attachmentId}.pdf`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '');
      }
    }
    
    // Stream the file back to client
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // If response has content-length, set it
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    
    console.log(`✅ Streaming attachment: ${filename} (${contentType})`);
    
    response.body.pipe(res);
    
  } catch (error) {
    console.error('❌ Error downloading attachment:', error);
    
    if (error.message.includes('404')) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found',
        jobId: req.params.jobId,
        attachmentId: req.params.attachmentId
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Server error downloading attachment',
      jobId: req.params.jobId,
      attachmentId: req.params.attachmentId
    });
  }
});

// ✅ SAVE COMPLETED PDF FORM
router.post('/job/:jobId/attachment/:attachmentId/save', async (req, res) => {
  try {
    const { jobId, attachmentId } = req.params;
    const formData = req.body;
    
    console.log(`💾 Saving completed PDF form: ${attachmentId} for job: ${jobId}`);
    
    // Validate required data
    if (!formData || typeof formData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Form data is required'
      });
    }
    
    const endpoint = serviceTitan.buildTenantUrl('forms') + `/jobs/${jobId}/attachments/${attachmentId}/save`;
    
    const result = await serviceTitan.apiCall(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    
    console.log(`✅ PDF form saved successfully for attachment: ${attachmentId}`);
    
    res.json({
      success: true,
      data: result,
      jobId: jobId,
      attachmentId: attachmentId,
      message: 'PDF form saved successfully'
    });
    
  } catch (error) {
    console.error('❌ Error saving PDF form:', error);
    
    if (error.message.includes('400')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid form data provided',
        jobId: req.params.jobId,
        attachmentId: req.params.attachmentId
      });
    }
    
    if (error.message.includes('404')) {
      return res.status(404).json({
        success: false,
        error: 'Job or attachment not found',
        jobId: req.params.jobId,
        attachmentId: req.params.attachmentId
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Server error saving PDF form',
      jobId: req.params.jobId,
      attachmentId: req.params.attachmentId
    });
  }
});

// ✅ GENERATE FILLED PDF (Optional endpoint)
router.post('/job/:jobId/attachment/:attachmentId/generate-pdf', async (req, res) => {
  try {
    const { jobId, attachmentId } = req.params;
    const formData = req.body;
    
    console.log(`📄 Generating filled PDF: ${attachmentId} for job: ${jobId}`);
    
    if (!formData || typeof formData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Form data is required'
      });
    }
    
    const endpoint = serviceTitan.buildTenantUrl('forms') + `/jobs/${jobId}/attachments/${attachmentId}/generate-pdf`;
    
    const response = await serviceTitan.rawFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PDF generation failed: ${response.status} - ${errorText}`);
    }
    
    // Stream the generated PDF back to client
    const contentType = response.headers.get('content-type') || 'application/pdf';
    const filename = `filled-form-${attachmentId}-${Date.now()}.pdf`;
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    
    console.log(`✅ Streaming generated PDF: ${filename}`);
    
    response.body.pipe(res);
    
  } catch (error) {
    console.error('❌ Error generating filled PDF:', error);
    
    if (error.message.includes('400')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid form data for PDF generation',
        jobId: req.params.jobId,
        attachmentId: req.params.attachmentId
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Server error generating filled PDF',
      jobId: req.params.jobId,
      attachmentId: req.params.attachmentId
    });
  }
});

module.exports = router;