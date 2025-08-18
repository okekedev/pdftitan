/**
 * Draft PDF API routes
 * Handles saving PDFs as drafts and managing draft/completed workflow
 */

const express = require('express');
const googleDriveService = require('../services/googleDriveService');
const fetch = require('node-fetch');

const router = express.Router();


/**
 * Save PDF as draft to Google Drive
 * POST /api/drafts/save
 */
router.post('/save', async (req, res) => {
  try {
    console.log('📝 Saving PDF as draft...');
    const { jobId, attachmentId, fileName, objects } = req.body;

    if (!jobId || !attachmentId || !objects) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: jobId, attachmentId, objects'
      });
    }

    // Download the original PDF from ServiceTitan using our existing infrastructure
    console.log('📥 Downloading original PDF...');
    
    // Use the existing ServiceTitan client to download the PDF
    const downloadUrl = `/job/${jobId}/attachment/${attachmentId}/download`;
    const response = await global.serviceTitan.rawFetch(downloadUrl, {
      headers: {
        'Content-Type': undefined // Let it auto-detect for file downloads
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.statusText}`);
    }

    const originalPdfBuffer = await response.buffer();
    console.log('✅ Original PDF downloaded');

    // Save as draft to Google Drive
    console.log('☁️ Saving to Google Drive...');
    const result = await googleDriveService.savePDFAsDraft(
      originalPdfBuffer,
      objects,
      jobId,
      fileName || 'form.pdf'
    );

    if (result.success) {
      console.log('✅ Draft saved successfully');
      res.json({
        success: true,
        message: 'PDF saved as draft successfully',
        fileId: result.fileId,
        fileName: result.fileName,
        createdTime: result.createdTime
      });
    } else {
      console.error('❌ Failed to save draft');
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to save draft'
      });
    }

  } catch (error) {
    console.error('❌ Error saving draft:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * Get drafts and completed files for a job
 * GET /api/drafts/:jobId
 */
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    console.log(`🔍 Searching for files for job ${jobId}...`);

    const result = await googleDriveService.searchFilesByJobId(jobId);

    if (result.success) {
      res.json({
        success: true,
        drafts: result.drafts,
        completed: result.completed
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to search files',
        drafts: [],
        completed: []
      });
    }

  } catch (error) {
    console.error('❌ Error searching files:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      drafts: [],
      completed: []
    });
  }
});

/**
 * Promote draft to completed
 * POST /api/drafts/:fileId/complete
 */
router.post('/:fileId/complete', async (req, res) => {
  try {
    const { fileId } = req.params;
    console.log(`📤 Promoting draft ${fileId} to completed...`);

    const result = await googleDriveService.promoteToCompleted(fileId);

    if (result.success) {
      console.log('✅ Draft promoted to completed');
      res.json({
        success: true,
        message: 'Draft successfully moved to completed folder'
      });
    } else {
      console.error('❌ Failed to promote draft');
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to promote draft'
      });
    }

  } catch (error) {
    console.error('❌ Error promoting draft:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * Delete a draft
 * DELETE /api/drafts/:fileId
 */
router.delete('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    console.log(`🗑️ Deleting draft ${fileId}...`);

    // Note: Implement delete functionality in googleDriveService if needed
    res.json({
      success: true,
      message: 'Draft deletion not implemented yet'
    });

  } catch (error) {
    console.error('❌ Error deleting draft:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

module.exports = router;