// api/jobs.js - Jobs API (Optimized for Serverless)
const express = require('express');
const serviceTitan = require('../utils/serviceTitan');
const router = express.Router();

// ✅ GET SPECIFIC JOB DETAILS
router.get('/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    console.log(`📋 Fetching job details: ${jobId}`);
    
    const endpoint = serviceTitan.buildTenantUrl('jpm') + `/jobs/${jobId}`;
    const jobData = await serviceTitan.apiCall(endpoint);
    
    // Use utility method to clean job title
    const title = serviceTitan.cleanJobTitle(jobData.summary);
    
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
      businessUnit: jobData.businessUnitId ? {
        id: jobData.businessUnitId,
        name: `Business Unit #${jobData.businessUnitId}`
      } : null,
      
      // Additional job details
      priority: jobData.priority,
      type: jobData.jobType,
      category: jobData.category,
      duration: jobData.duration,
      
      // Raw ServiceTitan data for advanced use cases
      serviceTitanData: {
        id: jobData.id,
        jobNumber: jobData.jobNumber,
        summary: jobData.summary,
        jobStatus: jobData.jobStatus,
        customerId: jobData.customerId,
        locationId: jobData.locationId,
        businessUnitId: jobData.businessUnitId,
        createdOn: jobData.createdOn,
        modifiedOn: jobData.modifiedOn
      }
    };
    
    console.log(`✅ Job details fetched: ${transformedJob.number} - ${transformedJob.title}`);
    
    res.json({
      success: true,
      data: transformedJob,
      jobId: jobData.id
    });
    
  } catch (error) {
    console.error('❌ Error fetching job details:', error);
    
    if (error.message.includes('404')) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        jobId: req.params.jobId
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching job details',
      jobId: req.params.jobId
    });
  }
});

// ✅ GET COMPLETED FORMS FOR A JOB (Optional endpoint)
router.get('/job/:jobId/completed-forms', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    console.log(`📋 Fetching completed forms for job: ${jobId}`);
    
    const endpoint = serviceTitan.buildTenantUrl('forms') + `/jobs/${jobId}/completed-forms`;
    
    try {
      const formsData = await serviceTitan.apiCall(endpoint);
      const forms = formsData.data || [];
      
      console.log(`✅ Found ${forms.length} completed forms for job ${jobId}`);
      
      res.json({
        success: true,
        data: forms,
        count: forms.length,
        jobId: jobId
      });
      
    } catch (error) {
      if (error.message.includes('404')) {
        return res.json({
          success: true,
          data: [],
          count: 0,
          message: 'No completed forms found for this job',
          jobId: jobId
        });
      }
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error fetching completed forms:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching completed forms',
      jobId: req.params.jobId
    });
  }
});

module.exports = router;