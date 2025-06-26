// backend/api/jobs.js - Jobs API
const express = require('express');
const router = express.Router();

// ✅ GET SPECIFIC JOB DETAILS
router.get('/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { authenticateServiceTitan } = req.app.locals.helpers;
    
    console.log(`📋 Fetching job details: ${jobId}`);
    
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
    const apiBaseUrl = process.env.REACT_APP_SERVICETITAN_API_BASE_URL;
    const accessToken = tokenResult.accessToken;
    
    const jobUrl = `${apiBaseUrl}/jpm/v2/tenant/${tenantId}/jobs/${jobId}`;
    
    const response = await fetch(jobUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
          jobId: jobId
        });
      }
      
      const errorText = await response.text();
      console.error(`❌ ServiceTitan Job API error: ${response.status} - ${errorText}`);
      throw new Error(`API error: ${response.statusText}`);
    }

    const jobData = await response.json();
    
    // Clean up job title
    let title = jobData.summary || 'Service Call';
    title = title.replace(/<[^>]*>/g, ' ')
                 .replace(/&[^;]+;/g, ' ')
                 .replace(/\s+/g, ' ')
                 .trim();
    
    if (title.length > 200) {
      title = title.substring(0, 200) + '...';
    }
    
    if (!title || title.length < 3) {
      title = 'Service Call';
    }
    
    const transformedJob = {
      id: jobData.id,
      number: jobData.jobNumber,
      title: title,
      status: jobData.jobStatus,
      customer: {
        id: jobData.customerId,
        name: `Customer #${jobData.customerId}`
      },
      location: {
        id: jobData.locationId,
        name: `Location #${jobData.locationId}`
      },
      scheduledDate: jobData.createdOn,
      businessUnit: jobData.businessUnitId ? `Business Unit #${jobData.businessUnitId}` : 'General',
      priority: jobData.priority || 'Normal',
      duration: jobData.duration || null
    };
    
    console.log(`✅ Job details fetched: ${transformedJob.number}`);
    
    res.json({
      success: true,
      data: transformedJob
    });
    
  } catch (error) {
    console.error('❌ Error fetching job details:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching job details',
      details: error.message
    });
  }
});

// ✅ GET COMPLETED FORMS FOR A JOB
router.get('/job/:jobId/completed-forms', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { authenticateServiceTitan } = req.app.locals.helpers;
    
    console.log(`📋 Fetching completed forms for job: ${jobId}`);
    
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
    const apiBaseUrl = process.env.REACT_APP_SERVICETITAN_API_BASE_URL;
    const accessToken = tokenResult.accessToken;
    
    // Get all attachments for this job
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
          message: 'No completed forms found for this job'
        });
      }
      throw new Error(`API error: ${response.statusText}`);
    }

    const attachmentsData = await response.json();
    const attachments = attachmentsData.data || [];
    
    // Filter for completed forms (look for our naming pattern)
    const completedForms = attachments.filter(attachment => {
      const fileName = attachment.fileName || attachment.name || '';
      return fileName.includes('_completed_') || fileName.includes('_form_data');
    });
    
    // Transform for frontend
    const transformedForms = completedForms.map(form => ({
      id: form.id,
      fileName: form.fileName,
      type: form.fileName.includes('.json') ? 'Form Data' : 'Completed PDF',
      size: form.size || 0,
      completedAt: form.createdOn || form.modifiedOn,
      downloadUrl: form.downloadUrl,
      serviceTitanId: form.id
    }));
    
    console.log(`✅ Found ${transformedForms.length} completed forms for job ${jobId}`);
    
    res.json({
      success: true,
      data: transformedForms,
      count: transformedForms.length,
      jobId: jobId
    });
    
  } catch (error) {
    console.error('❌ Error fetching completed forms:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching completed forms',
      details: error.message
    });
  }
});

module.exports = router;