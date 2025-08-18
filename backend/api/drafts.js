/**
 * Draft PDF API routes
 * Handles saving PDFs as drafts and managing draft/completed workflow
 */

const express = require('express');
const googleDriveService = require('../services/googleDriveService');
// ❌ REMOVED: const fetch = require('node-fetch'); // This was causing the ES module error

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
      fileName
    );

    if (result.success) {
      console.log('✅ PDF saved as draft successfully');
      res.json({
        success: true,
        message: 'PDF saved as draft',
        fileId: result.fileId,
        fileName: result.fileName,
        jobId: result.jobId,
        folderType: result.folderType
      });
    } else {
      console.log('❌ Failed to save PDF as draft:', result.error);
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ Error saving PDF as draft:', error);
    res.status(500).json({
      success: false,
      error: error.message
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
 * Promote a draft to completed
 * POST /api/drafts/:fileId/complete
 */
router.post('/:fileId/complete', async (req, res) => {
  try {
    console.log(`📤 Promoting draft to completed: ${req.params.fileId}`);
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: jobId'
      });
    }

    const result = await googleDriveService.promoteToCompleted(req.params.fileId, jobId);
    
    if (result.success) {
      console.log(`✅ Draft ${req.params.fileId} promoted to completed for job ${jobId}`);
      res.json({
        success: true,
        message: 'Draft promoted to completed',
        fileId: req.params.fileId,
        jobId: jobId
      });
    } else {
      console.log(`❌ Failed to promote draft ${req.params.fileId}:`, result.error);
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ Error promoting draft:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get all job files overview
 * GET /api/drafts/all/jobs
 */
router.get('/all/jobs', async (req, res) => {
  try {
    console.log('📋 Getting all job files overview...');
    
    const result = await googleDriveService.getAllJobFiles();
    
    if (result.success) {
      const draftJobCount = Object.keys(result.drafts).length;
      const completedJobCount = Object.keys(result.completed).length;
      
      console.log(`✅ Retrieved overview: ${draftJobCount} jobs with drafts, ${completedJobCount} jobs with completed files`);
      
      res.json({
        success: true,
        drafts: result.drafts,
        completed: result.completed,
        summary: {
          jobsWithDrafts: draftJobCount,
          jobsWithCompleted: completedJobCount
        }
      });
    } else {
      console.log('❌ Failed to get all job files:', result.error);
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ Error getting all job files:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;