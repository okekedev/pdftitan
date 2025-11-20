/**
 * Draft PDF API routes
 * Handles saving PDFs as drafts and managing draft/completed workflow
 */

const express = require('express');
const googleDriveService = require('../services/googleDriveService');

const router = express.Router();

/**
 * Save PDF as draft to Google Drive
 * POST /api/drafts/save
 */
router.post('/save', async (req, res) => {
  try {
    console.log('📝 Saving PDF as draft...');
    const { jobId, attachmentId, fileName, objects } = req.body;

    // 🔍 Log all received objects with their colors
    console.log('🔍 ===== BACKEND RECEIVED OBJECTS =====');
    console.log('🔍 Total objects received:', objects?.length || 0);
    if (objects && Array.isArray(objects)) {
      objects.forEach((obj, index) => {
        console.log(`🔍 BACKEND RECEIVED ${obj.type?.toUpperCase()} #${index + 1}:`, {
          id: obj.id,
          type: obj.type,
          position: { x: obj.x, y: obj.y },
          dimensions: { width: obj.width, height: obj.height },
          content: obj.content,
          fontSize: obj.fontSize,
          color: obj.color,
          page: obj.page
        });
      });
    }

    if (!jobId || !attachmentId || !objects) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: jobId, attachmentId, objects'
      });
    }

    // ✅ FIXED: Download the original PDF from ServiceTitan using the correct API endpoint
    console.log('📥 Downloading original PDF...');
    
    const tokenResult = await global.serviceTitan.getAccessToken();
    if (!tokenResult) {
      throw new Error('ServiceTitan authentication failed');
    }
    
    const fetch = (await import('node-fetch')).default;
    const tenantId = global.serviceTitan.tenantId;
    const appKey = global.serviceTitan.appKey;
    const accessToken = tokenResult;
    
    // ✅ FIXED: Use the same endpoint format as the working attachment download
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
      throw new Error(`Failed to download PDF: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const originalPdfBuffer = Buffer.from(arrayBuffer);
    
    // Validate PDF
    const isPdfValid = originalPdfBuffer.length > 0 && originalPdfBuffer.toString('ascii', 0, 4) === '%PDF';
    
    if (!isPdfValid) {
      console.error(`❌ Invalid PDF data received for attachment ${attachmentId}`);
      throw new Error('Downloaded file is not a valid PDF');
    }
    
    console.log(`✅ Original PDF downloaded: ${originalPdfBuffer.length} bytes`);

    // Save as draft to Google Drive
    console.log('☁️ Saving to Google Drive...');
    const result = await googleDriveService.savePDFAsDraft(
      originalPdfBuffer,
      objects,
      jobId,
      fileName
    );

    if (result.success) {
      console.log('✅ PDF saved as draft successfully');
      res.json({
        success: true,
        message: 'PDF saved as draft',
        fileId: result.fileId,
        fileName: result.fileName,
        driveUrl: result.driveUrl
      });
    } else {
      throw new Error(result.error || 'Failed to save PDF as draft');
    }

  } catch (error) {
    console.error('❌ Error saving PDF as draft:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save PDF as draft',
      details: error.message
    });
  }
});

/**
 * Update existing draft in Google Drive
 * PUT /api/drafts/update/:fileId
 */
router.put('/update/:fileId', async (req, res) => {
  try {
    console.log(`🔄 Updating existing draft: ${req.params.fileId}`);
    const { jobId, objects, fileName } = req.body;
    const fileId = req.params.fileId;

    if (!jobId || !objects) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: jobId, objects'
      });
    }

    // Download the existing PDF from Google Drive
    console.log('📥 Downloading existing draft from Google Drive...');
    const downloadResult = await googleDriveService.downloadFile(fileId);
    
    if (!downloadResult.success) {
      throw new Error(`Failed to download existing draft: ${downloadResult.error}`);
    }
    
    const originalPdfBuffer = downloadResult.data;
    console.log(`✅ Downloaded existing draft: ${originalPdfBuffer.length} bytes`);

    // Generate new filled PDF with updated form fields
    console.log('🔧 Generating updated PDF with new form fields...');
    const filledPdfBuffer = await googleDriveService.generateFilledPDF(originalPdfBuffer, objects);
    
    // Update the file in Google Drive (replace the existing file)
    console.log('💾 Updating file in Google Drive...');
    const updateResult = await googleDriveService.updateFile(fileId, filledPdfBuffer, fileName);
    
    if (!updateResult.success) {
      throw new Error(`Failed to update file in Google Drive: ${updateResult.error}`);
    }

    console.log('✅ Draft updated successfully in Google Drive');
    
    res.json({
      success: true,
      message: 'Draft updated successfully',
      fileId: fileId,
      fileName: updateResult.fileName || fileName
    });

  } catch (error) {
    console.error('❌ Error updating draft:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update draft',
      details: error.message
    });
  }
});

/**
 * Get drafts and completed files for a specific job
 * GET /api/drafts/:jobId
 */
router.get('/:jobId', async (req, res) => {
  try {
    console.log(`🔍 Getting files for job: ${req.params.jobId}`);
    
    const result = await googleDriveService.getFilesByJobId(req.params.jobId);
    
    if (result.success) {
      console.log(`✅ Retrieved files for job ${req.params.jobId}: ${result.drafts.length} drafts, ${result.completed.length} completed`);
      res.json({
        success: true,
        jobId: result.jobId,
        drafts: result.drafts,
        completed: result.completed
      });
    } else {
      console.log(`❌ Failed to get files for job ${req.params.jobId}:`, result.error);
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ Error getting job files:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ✅ FIXED: Download PDF from Google Drive for editing
 * GET /api/drafts/download/:fileId
 */
router.get('/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    console.log(`📥 Downloading PDF from Google Drive: ${fileId}`);
    
    // Download file from Google Drive
    const result = await googleDriveService.downloadFile(fileId);
    
    if (!result.success) {
      console.log(`❌ Failed to download file ${fileId}:`, result.error);
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    const pdfBuffer = result.data;
    
    if (!pdfBuffer) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    // Validate it's a PDF
    const isPdfValid = pdfBuffer.length > 0 && pdfBuffer.toString('ascii', 0, 4) === '%PDF';
    
    if (!isPdfValid) {
      return res.status(400).json({
        success: false,
        error: 'Downloaded file is not a valid PDF'
      });
    }
    
    // Set appropriate headers
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Cache-Control': 'private, no-cache'
    });
    
    res.send(pdfBuffer);
    console.log(`✅ PDF downloaded from Google Drive: ${pdfBuffer.length} bytes`);
    
  } catch (error) {
    console.error('❌ Error downloading PDF from Google Drive:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download PDF from Google Drive',
      details: error.message
    });
  }
});

/**
 * Get Google Drive file metadata
 * GET /api/drafts/info/:fileId
 */
router.get('/info/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    console.log(`🔍 Getting Google Drive file metadata: ${fileId}`);
    
    const metadata = await googleDriveService.getFileMetadata(fileId);
    
    if (!metadata) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    res.json({
      success: true,
      data: metadata
    });
    
  } catch (error) {
    console.error('❌ Error getting Google Drive file metadata:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get file metadata',
      details: error.message
    });
  }
});

/**
 * Promote a draft to completed + Upload to ServiceTitan
 * POST /api/drafts/:fileId/complete
 * 
 * This endpoint now does 3 things:
 * 1. Moves file from Google Drive drafts to completed folder
 * 2. Downloads the completed PDF from Google Drive
 * 3. Uploads the completed PDF to ServiceTitan
 */
router.post('/:fileId/complete', async (req, res) => {
  try {
    console.log(`📤 Processing complete upload workflow for draft: ${req.params.fileId}`);
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: jobId'
      });
    }

    const fileId = req.params.fileId;

    // Step 1: Move draft to completed folder in Google Drive
    console.log('📁 Step 1: Moving to completed folder...');
    const promoteResult = await googleDriveService.promoteToCompleted(fileId, jobId);
    
    if (!promoteResult.success) {
      throw new Error(`Failed to move to completed folder: ${promoteResult.error}`);
    }
    
    console.log('✅ Step 1 complete: Moved to completed folder');

    // Step 2: Download the completed PDF from Google Drive
    console.log('📥 Step 2: Downloading completed PDF from Google Drive...');
    const downloadResult = await googleDriveService.downloadFile(fileId);
    
    if (!downloadResult.success) {
      throw new Error(`Failed to download completed PDF from Google Drive: ${downloadResult.error}`);
    }
    
    const pdfBuffer = downloadResult.data;
    console.log(`✅ Step 2 complete: Downloaded ${pdfBuffer.length} bytes from Google Drive`);

    // Step 3: Upload to ServiceTitan
    console.log('📤 Step 3: Uploading to ServiceTitan...');

    // Get file metadata from Google Drive
    const fileMetadata = await googleDriveService.getFileMetadata(fileId);
    let fileName = fileMetadata?.name || 'Completed Form.pdf';
    console.log('Original filename from Google Drive:', fileName);

    // Remove "Attaches/" prefix if present
    fileName = fileName.replace(/^Attaches\//, '');

    // Remove "Completed - " prefix if it already exists (to avoid duplication)
    fileName = fileName.replace(/^Completed\s*-\s*/i, '');
    console.log('Filename after removing prefixes:', fileName);

    // Add "Completed - " prefix to the filename
    const completedFileName = `Completed - ${fileName}`;
    const finalFileName = completedFileName.endsWith('.pdf') ? completedFileName : `${completedFileName}.pdf`;
    console.log('Final filename for upload:', finalFileName);
    
    const serviceTitanUpload = await uploadToServiceTitan(jobId, pdfBuffer, finalFileName);
    
    if (!serviceTitanUpload.success) {
      // If ServiceTitan upload fails, we should probably move the file back to drafts
      console.error('❌ ServiceTitan upload failed, considering rollback...');
      throw new Error(`ServiceTitan upload failed: ${serviceTitanUpload.error}`);
    }
    
    console.log('✅ Step 3 complete: Uploaded to ServiceTitan');

    // Return success response
    res.json({
      success: true,
      message: 'Form completed and uploaded successfully',
      workflow: {
        googleDriveMove: '✅ Moved to completed folder',
        googleDriveDownload: '✅ Downloaded from Google Drive',
        serviceTitanUpload: '✅ Uploaded to ServiceTitan'
      },
      fileId: fileId,
      fileName: finalFileName,
      uploadedAt: new Date().toISOString(),
      serviceTitanDetails: serviceTitanUpload.details
    });

  } catch (error) {
    console.error('❌ Error in complete upload workflow:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete upload workflow',
      details: error.message,
      step: error.message.includes('move') ? 'google_drive_move' :
            error.message.includes('download') ? 'google_drive_download' :
            error.message.includes('ServiceTitan') ? 'servicetitan_upload' : 'unknown'
    });
  }
});

/**
 * HELPER FUNCTION: Upload PDF to ServiceTitan
 * Uses the same logic as the existing attachments save endpoint
 */
async function uploadToServiceTitan(jobId, pdfBuffer, fileName) {
  try {
    // Get ServiceTitan authentication
    const tokenResult = await global.serviceTitan.getAccessToken();
    if (!tokenResult) {
      throw new Error('ServiceTitan authentication failed');
    }

    const fetch = (await import('node-fetch')).default;
    const tenantId = global.serviceTitan.tenantId;
    const appKey = global.serviceTitan.appKey;
    const accessToken = tokenResult;

    // Create multipart form data for file upload (same as attachments.js)
    const boundary = '----TitanPDFBoundary' + Date.now();
    
    // Build multipart form data manually
    const formParts = [];
    
    // Add file part
    formParts.push(`--${boundary}\r\n`);
    formParts.push(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`);
    formParts.push(`Content-Type: application/pdf\r\n\r\n`);
    
    // Add metadata parts
    const metaParts = [
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="name"\r\n\r\n`,
      `${fileName}\r\n`,
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="description"\r\n\r\n`,
      `Completed PDF form uploaded from TitanPDF\r\n`,
      `--${boundary}--\r\n`
    ];
    
    // Combine all parts
    const formPrefix = Buffer.from(formParts.join(''), 'utf8');
    const formSuffix = Buffer.from(metaParts.join(''), 'utf8');
    const formBody = Buffer.concat([formPrefix, pdfBuffer, formSuffix]);
    
    // ServiceTitan Forms API upload endpoint (same as attachments.js)
    const uploadUrl = `${global.serviceTitan.apiBaseUrl}/forms/v2/tenant/${tenantId}/jobs/${jobId}/attachments`;
    
    console.log(`🔗 Uploading to ServiceTitan: ${uploadUrl}`);
    
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
      console.log(`✅ Successfully uploaded "${fileName}" to ServiceTitan!`);
      
      return {
        success: true,
        details: {
          serviceTitanId: uploadResult.id || 'Unknown',
          uploadedAt: new Date().toISOString(),
          fileName: fileName,
          fileSize: pdfBuffer.length
        }
      };
    } else {
      const errorText = await uploadResponse.text();
      console.error(`❌ ServiceTitan upload failed: ${uploadResponse.status} - ${errorText}`);
      
      return {
        success: false,
        error: `ServiceTitan upload failed: ${uploadResponse.status}`,
        details: errorText
      };
    }

  } catch (error) {
    console.error('❌ Error uploading to ServiceTitan:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = router;