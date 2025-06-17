// server.js - COMPLETE VERSION WITH PDF DOWNLOAD ENDPOINTS
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PROXY_PORT || 3005;

// Server configuration
const SERVER_CONFIG = {
  port: PORT,
  
  cors: {
    origins: [
      'http://localhost:3000',
      'http://localhost:3002', 
      'http://localhost:3003',
      'http://localhost:3004'
    ],
    credentials: true
  },
  
  serviceTitan: {
    clientId: process.env.REACT_APP_SERVICETITAN_CLIENT_ID,
    clientSecret: process.env.REACT_APP_SERVICETITAN_CLIENT_SECRET,
    appKey: process.env.REACT_APP_SERVICETITAN_APP_KEY,
    tenantId: process.env.REACT_APP_SERVICETITAN_TENANT_ID,
    authUrl: process.env.REACT_APP_SERVICETITAN_AUTH_URL,
    apiBaseUrl: process.env.REACT_APP_SERVICETITAN_API_BASE_URL,
    isIntegration: process.env.REACT_APP_SERVICETITAN_API_BASE_URL?.includes('integration')
  },
  
  company: {
    name: 'MrBackflow TX'
  },
  
  // Target appointment statuses
  targetAppointmentStatuses: ['Scheduled', 'Dispatched', 'Enroute', 'Working'],
  
  validate() {
    const required = [
      'REACT_APP_SERVICETITAN_CLIENT_ID',
      'REACT_APP_SERVICETITAN_CLIENT_SECRET', 
      'REACT_APP_SERVICETITAN_APP_KEY',
      'REACT_APP_SERVICETITAN_TENANT_ID'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    return { isValid: missing.length === 0, missing };
  }
};

// Validate configuration on startup
const configValidation = SERVER_CONFIG.validate();
if (!configValidation.isValid) {
  console.error('❌ Missing required environment variables:', configValidation.missing);
  console.error('💡 Add these to your .env file and restart the server');
  process.exit(1);
}

// Middleware setup
app.use(cors({
  origin: SERVER_CONFIG.cors.origins,
  credentials: SERVER_CONFIG.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'ST-App-Key']
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    message: 'TitanPDF Technician Portal - WITH PDF DOWNLOAD SUPPORT',
    environment: SERVER_CONFIG.serviceTitan.isIntegration ? 'Integration' : 'Production',
    company: SERVER_CONFIG.company.name,
    targetStatuses: SERVER_CONFIG.targetAppointmentStatuses,
    apiStrategy: 'Using correct ServiceTitan Forms API endpoint',
    fixes: {
      attachmentsEndpoint: 'forms/v2/tenant/{tenant}/jobs/{jobId}/attachments',
      pdfDownloadEndpoint: '/api/job/{jobId}/attachment/{attachmentId}/download',
      enhancedLogging: true,
      comprehensiveDebug: true,
      jobIdAnalysis: true,
      pdfProxySupport: true
    }
  });
});

// ServiceTitan Authentication Helper
async function authenticateServiceTitan() {
  try {
    const fetch = (await import('node-fetch')).default;
    const config = SERVER_CONFIG.serviceTitan;
    
    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('client_id', config.clientId);
    formData.append('client_secret', config.clientSecret);

    const response = await fetch(config.authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: formData
    });

    const tokenData = await response.json();
    
    if (!response.ok) {
      return { 
        success: false, 
        error: tokenData.error_description || 'ServiceTitan authentication failed',
        status: response.status 
      };
    }
    
    return { 
      success: true, 
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in || 900
    };
    
  } catch (error) {
    return { 
      success: false, 
      error: 'Network error during ServiceTitan authentication',
      details: error.message 
    };
  }
}

// ✅ TECHNICIAN VALIDATION
app.post('/api/technician/validate', async (req, res) => {
  try {
    const { username, phone } = req.body;
    
    if (!username || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Both username and phone number are required'
      });
    }
    
    console.log(`🔧 Authenticating technician: ${username}`);
    
    // Get ServiceTitan token
    const tokenResult = await authenticateServiceTitan();
    if (!tokenResult.success) {
      return res.status(500).json({
        success: false,
        error: 'ServiceTitan authentication failed'
      });
    }
    
    // Search for technician by username
    const technician = await searchTechnicianByUsername(
      username, 
      tokenResult.accessToken, 
      SERVER_CONFIG.serviceTitan.tenantId, 
      SERVER_CONFIG.serviceTitan.appKey
    );
    
    if (!technician) {
      return res.status(404).json({
        success: false,
        error: `No technician found with username "${username}"`
      });
    }
    
    // Validate phone number
    if (!validatePhoneMatch(technician, phone)) {
      return res.status(401).json({
        success: false,
        error: 'Phone number does not match our records for this technician'
      });
    }
    
    console.log(`✅ Technician authenticated: ${technician.name}`);
    
    res.json({
      success: true,
      technician: technician,
      company: {
        name: SERVER_CONFIG.company.name,
        tenantId: SERVER_CONFIG.serviceTitan.tenantId,
        appKey: SERVER_CONFIG.serviceTitan.appKey
      },
      accessToken: tokenResult.accessToken,
      environment: SERVER_CONFIG.serviceTitan.isIntegration ? 'Integration' : 'Production'
    });
    
  } catch (error) {
    console.error('❌ Technician validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during technician validation'
    });
  }
});

// ✅ GET APPOINTMENTS WITH CUSTOMER NAMES & ADDRESSES
app.get('/api/technician/:technicianId/appointments', async (req, res) => {
  try {
    const { technicianId } = req.params;
    
    console.log(`📅 Fetching appointments for technician ID: ${technicianId} with customer data`);
    
    // Get fresh ServiceTitan token
    const tokenResult = await authenticateServiceTitan();
    if (!tokenResult.success) {
      return res.status(500).json({
        success: false,
        error: 'ServiceTitan authentication failed'
      });
    }
    
    const fetch = (await import('node-fetch')).default;
    const tenantId = SERVER_CONFIG.serviceTitan.tenantId;
    const appKey = SERVER_CONFIG.serviceTitan.appKey;
    const accessToken = tokenResult.accessToken;
    
    // Date range: 2 weeks back to 30 days forward
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 14);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    endDate.setHours(23, 59, 59, 999);
    
    // Use appointments API with technicianIds filter
    console.log(`🎯 Using appointments API with technicianIds=${technicianId} filter`);
    
    let allAppointments = [];
    let page = 1;
    let hasMorePages = true;
    const pageSize = 500;
    
    while (hasMorePages) {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        technicianIds: technicianId,
        startsOnOrAfter: startDate.toISOString(),
        startsOnOrBefore: endDate.toISOString()
      });
      
      const appointmentsUrl = `https://api-integration.servicetitan.io/jpm/v2/tenant/${tenantId}/appointments?${queryParams}`;
      
      console.log(`🔍 API Request: ${appointmentsUrl}`);
      
      try {
        const appointmentsResponse = await fetch(appointmentsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'ST-App-Key': appKey,
            'Content-Type': 'application/json'
          }
        });

        if (!appointmentsResponse.ok) {
          const errorText = await appointmentsResponse.text();
          console.error(`❌ ServiceTitan Appointments API error on page ${page}: ${appointmentsResponse.status} - ${errorText}`);
          throw new Error(`API error: ${appointmentsResponse.statusText}`);
        }

        const appointmentsData = await appointmentsResponse.json();
        const pageAppointments = appointmentsData.data || [];
        
        console.log(`📊 Page ${page}: Found ${pageAppointments.length} appointments`);
        
        allAppointments = allAppointments.concat(pageAppointments);
        
        const hasMore = appointmentsData.hasMore || (pageAppointments.length === pageSize);
        
        if (!hasMore || pageAppointments.length === 0) {
          hasMorePages = false;
        } else {
          page++;
          
          if (page > 20) {
            hasMorePages = false;
          }
          
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
      } catch (error) {
        console.error(`❌ Error fetching page ${page}:`, error);
        hasMorePages = false;
      }
    }
    
    console.log(`📊 TOTAL: ${allAppointments.length} appointments for technician ${technicianId}`);
    
    if (allAppointments.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        technicianId: parseInt(technicianId),
        message: 'No appointments found for this technician in the date range'
      });
    }
    
    // Enrich with customer data
    console.log(`👥 Enriching ALL ${allAppointments.length} appointments with customer data`);
    
    const enrichedAppointments = await Promise.all(
      allAppointments.map(async (appointment) => {
        let customerData = null;
        
        try {
          if (appointment.customerId) {
            const customerUrl = `https://api-integration.servicetitan.io/crm/v2/tenant/${tenantId}/customers/${appointment.customerId}`;
            
            const customerResponse = await fetch(customerUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'ST-App-Key': appKey,
                'Content-Type': 'application/json'
              }
            });
            
            if (customerResponse.ok) {
              const customer = await customerResponse.json();
              customerData = {
                id: customer.id,
                name: customer.name || 'Unknown Customer',
                phoneNumber: customer.phoneNumber || null,
                address: customer.address ? {
                  street: customer.address.street || '',
                  city: customer.address.city || '',
                  state: customer.address.state || '',
                  zip: customer.address.zip || '',
                  fullAddress: [
                    customer.address.street,
                    [customer.address.city, customer.address.state].filter(Boolean).join(', '),
                    customer.address.zip
                  ].filter(Boolean).join(' | ') || 'Address not available'
                } : null
              };
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`❌ Error fetching customer data for appointment ${appointment.id}:`, error);
        }
        
        return {
          jobId: appointment.jobId,
          appointmentNumber: appointment.appointmentNumber || appointment.number,
          start: appointment.start,
          end: appointment.end,
          arrivalWindowStart: appointment.arrivalWindowStart || null,
          arrivalWindowEnd: appointment.arrivalWindowEnd || null,
          status: appointment.status,
          specialInstructions: appointment.specialInstructions || null,
          
          id: appointment.id,
          customerId: appointment.customerId,
          locationId: appointment.locationId,
          createdOn: appointment.createdOn,
          modifiedOn: appointment.modifiedOn,
          
          assignedToTechnician: true,
          technicianId: parseInt(technicianId),
          
          customer: customerData || {
            id: appointment.customerId,
            name: `Customer #${appointment.customerId}`,
            phoneNumber: null,
            address: null
          }
        };
      })
    );
    
    const sortedAppointments = enrichedAppointments.sort((a, b) => new Date(a.start) - new Date(b.start));
    
    console.log(`✅ Returning ${sortedAppointments.length} appointments for technician ${technicianId}`);
    
    res.json({
      success: true,
      data: sortedAppointments,
      count: sortedAppointments.length,
      technicianId: parseInt(technicianId),
      method: 'appointments-api-with-technician-filter'
    });
    
  } catch (error) {
    console.error('❌ Error fetching technician appointments:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching technician appointments'
    });
  }
});

// ✅ FIXED: GET JOB ATTACHMENTS - Using Correct ServiceTitan Forms API Endpoint
app.get('/api/job/:jobId/attachments', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    console.log(`📎 Fetching attachments for job: ${jobId} using CORRECT Forms API endpoint`);
    
    // Get fresh ServiceTitan token
    const tokenResult = await authenticateServiceTitan();
    if (!tokenResult.success) {
      return res.status(500).json({
        success: false,
        error: 'ServiceTitan authentication failed'
      });
    }
    
    const fetch = (await import('node-fetch')).default;
    const tenantId = SERVER_CONFIG.serviceTitan.tenantId;
    const appKey = SERVER_CONFIG.serviceTitan.appKey;
    const accessToken = tokenResult.accessToken;
    
    // ✅ CORRECT: Use the proper Forms API endpoint from ServiceTitan documentation
    const attachmentsUrl = `https://api-integration.servicetitan.io/forms/v2/tenant/${tenantId}/jobs/${jobId}/attachments`;
    
    console.log(`🔍 CORRECT Forms API Request: ${attachmentsUrl}`);
    
    const response = await fetch(attachmentsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ServiceTitan Forms API error: ${response.status} - ${errorText}`);
      
      if (response.status === 404) {
        console.log(`ℹ️ No attachments found for job ${jobId} in Forms API`);
        return res.json({
          success: true,
          data: [],
          count: 0,
          message: 'No attachments found for this job'
        });
      }
      
      throw new Error(`Forms API error: ${response.statusText}`);
    }

    const attachmentsData = await response.json();
    console.log(`📊 Raw attachments response:`, {
      hasData: !!attachmentsData.data,
      isArray: Array.isArray(attachmentsData.data),
      dataLength: attachmentsData.data?.length,
      totalCount: attachmentsData.totalCount,
      hasMore: attachmentsData.hasMore
    });
    
    const attachments = attachmentsData.data || [];
    
    console.log(`📊 Forms API returned ${attachments.length} total attachments for job ${jobId}`);
    
    // ✅ FILTER FOR PDF FILES ONLY and log each file type found
    const pdfAttachments = attachments.filter(attachment => {
      const fileName = attachment.fileName || attachment.name || '';
      const mimeType = attachment.mimeType || attachment.contentType || '';
      const fileExtension = fileName.toLowerCase().split('.').pop();
      
      // Check both filename and mime type for PDFs
      const isPdf = fileExtension === 'pdf' || mimeType.includes('pdf');
      
      console.log(`📄 File: ${fileName} | Type: ${mimeType} | Extension: ${fileExtension} | Is PDF: ${isPdf}`);
      
      return isPdf;
    });
    
    console.log(`📄 Filtered to ${pdfAttachments.length} PDF attachments`);
    
    // ✅ TRANSFORM ATTACHMENTS FOR FRONTEND
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
    
    console.log(`✅ Transformed ${transformedAttachments.length} PDF attachments for job ${jobId}`);
    
    if (transformedAttachments.length > 0) {
      console.log(`📋 Sample attachment:`, {
        name: transformedAttachments[0].name,
        fileName: transformedAttachments[0].fileName,
        size: transformedAttachments[0].size,
        hasDownloadUrl: !!transformedAttachments[0].downloadUrl
      });
    }
    
    res.json({
      success: true,
      data: transformedAttachments,
      count: transformedAttachments.length,
      jobId: jobId,
      apiUsed: 'forms/v2/jobs/{jobId}/attachments',
      apiFixed: true
    });
    
  } catch (error) {
    console.error('❌ Error fetching job attachments from Forms API:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching job attachments from Forms API',
      details: error.message
    });
  }
});

// ✅ NEW: PDF Download Proxy Endpoint
app.get('/api/job/:jobId/attachment/:attachmentId/download', async (req, res) => {
  try {
    const { jobId, attachmentId } = req.params;
    
    console.log(`📥 Downloading PDF attachment: ${attachmentId} from job: ${jobId}`);
    
    // Get fresh ServiceTitan token
    const tokenResult = await authenticateServiceTitan();
    if (!tokenResult.success) {
      return res.status(500).json({
        success: false,
        error: 'ServiceTitan authentication failed'
      });
    }
    
    const fetch = (await import('node-fetch')).default;
    const tenantId = SERVER_CONFIG.serviceTitan.tenantId;
    const appKey = SERVER_CONFIG.serviceTitan.appKey;
    const accessToken = tokenResult.accessToken;
    
    // First, get the attachment details to find the download URL
    const attachmentDetailsUrl = `https://api-integration.servicetitan.io/forms/v2/tenant/${tenantId}/jobs/${jobId}/attachments`;
    
    console.log(`🔍 Getting attachment details: ${attachmentDetailsUrl}`);
    
    const attachmentResponse = await fetch(attachmentDetailsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey,
        'Content-Type': 'application/json'
      }
    });

    if (!attachmentResponse.ok) {
      throw new Error(`Failed to get attachment details: ${attachmentResponse.status}`);
    }

    const attachmentData = await attachmentResponse.json();
    const attachments = attachmentData.data || [];
    
    // Find the specific attachment
    const targetAttachment = attachments.find(att => 
      att.id == attachmentId || 
      att.id === parseInt(attachmentId)
    );
    
    if (!targetAttachment) {
      console.error(`❌ Attachment ${attachmentId} not found in job ${jobId}`);
      return res.status(404).json({
        success: false,
        error: 'Attachment not found'
      });
    }
    
    console.log(`📄 Found attachment:`, {
      id: targetAttachment.id,
      fileName: targetAttachment.fileName,
      mimeType: targetAttachment.mimeType,
      hasDownloadUrl: !!targetAttachment.downloadUrl
    });
    
    // Try to download the actual file
    let downloadUrl = targetAttachment.downloadUrl;
    
    if (!downloadUrl) {
      // If no direct download URL, try alternative ServiceTitan endpoints
      const alternativeUrls = [
        `https://api-integration.servicetitan.io/forms/v2/tenant/${tenantId}/attachments/${attachmentId}/download`,
        `https://api-integration.servicetitan.io/forms/v2/tenant/${tenantId}/attachments/${attachmentId}`,
        `https://api-integration.servicetitan.io/files/v2/tenant/${tenantId}/attachments/${attachmentId}/download`
      ];
      
      for (const altUrl of alternativeUrls) {
        try {
          console.log(`🧪 Trying alternative URL: ${altUrl}`);
          
          const altResponse = await fetch(altUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'ST-App-Key': appKey
            }
          });
          
          if (altResponse.ok) {
            downloadUrl = altUrl;
            console.log(`✅ Found working download URL: ${altUrl}`);
            break;
          }
        } catch (error) {
          console.log(`❌ Alternative URL failed: ${altUrl}`);
        }
      }
    }
    
    if (!downloadUrl) {
      console.error(`❌ No download URL found for attachment ${attachmentId}`);
      return res.status(404).json({
        success: false,
        error: 'No download URL available for this attachment'
      });
    }
    
    // Download the file from ServiceTitan
    console.log(`📥 Downloading from: ${downloadUrl}`);
    
    const fileResponse = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey
      }
    });
    
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.status} ${fileResponse.statusText}`);
    }
    
    // Get the file content
    const fileBuffer = await fileResponse.buffer();
    
    console.log(`✅ Downloaded ${fileBuffer.length} bytes for ${targetAttachment.fileName}`);
    
    // Set appropriate headers
    res.set({
      'Content-Type': targetAttachment.mimeType || 'application/pdf',
      'Content-Length': fileBuffer.length,
      'Content-Disposition': `inline; filename="${targetAttachment.fileName}"`,
      'Cache-Control': 'private, max-age=3600'
    });
    
    // Send the file
    res.send(fileBuffer);
    
  } catch (error) {
    console.error('❌ Error downloading PDF attachment:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error downloading PDF attachment',
      details: error.message
    });
  }
});

// ✅ GET SPECIFIC JOB DETAILS
app.get('/api/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    console.log(`📋 Fetching job details: ${jobId}`);
    
    const tokenResult = await authenticateServiceTitan();
    if (!tokenResult.success) {
      return res.status(500).json({
        success: false,
        error: 'ServiceTitan authentication failed'
      });
    }
    
    const fetch = (await import('node-fetch')).default;
    const tenantId = SERVER_CONFIG.serviceTitan.tenantId;
    const appKey = SERVER_CONFIG.serviceTitan.appKey;
    const accessToken = tokenResult.accessToken;
    
    const jobUrl = `https://api-integration.servicetitan.io/jpm/v2/tenant/${tenantId}/jobs/${jobId}`;
    
    const response = await fetch(jobUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ServiceTitan Job API error: ${response.status} - ${errorText}`);
      
      if (response.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
          jobId: jobId
        });
      }
      
      throw new Error(`API error: ${response.statusText}`);
    }

    const jobData = await response.json();
    
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
    
    console.log(`✅ Job details fetched: ${transformedJob.number} - ${transformedJob.title}`);
    
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

// ✅ DEBUG: Test attachment download capabilities
app.get('/debug/attachment-download/:jobId/:attachmentId', async (req, res) => {
  try {
    const { jobId, attachmentId } = req.params;
    
    const tokenResult = await authenticateServiceTitan();
    if (!tokenResult.success) {
      return res.status(500).json({ success: false, error: 'Auth failed' });
    }
    
    const fetch = (await import('node-fetch')).default;
    const tenantId = SERVER_CONFIG.serviceTitan.tenantId;
    const appKey = SERVER_CONFIG.serviceTitan.appKey;
    const accessToken = tokenResult.accessToken;
    
    // Get attachment details
    const attachmentDetailsUrl = `https://api-integration.servicetitan.io/forms/v2/tenant/${tenantId}/jobs/${jobId}/attachments`;
    
    const attachmentResponse = await fetch(attachmentDetailsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey,
        'Content-Type': 'application/json'
      }
    });

    if (!attachmentResponse.ok) {
      throw new Error(`Failed to get attachment details: ${attachmentResponse.status}`);
    }

    const attachmentData = await attachmentResponse.json();
    const attachments = attachmentData.data || [];
    
    const targetAttachment = attachments.find(att => att.id == attachmentId);
    
    if (!targetAttachment) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found'
      });
    }
    
    // Test various download URLs
    const testUrls = [
      targetAttachment.downloadUrl,
      `https://api-integration.servicetitan.io/forms/v2/tenant/${tenantId}/attachments/${attachmentId}/download`,
      `https://api-integration.servicetitan.io/forms/v2/tenant/${tenantId}/attachments/${attachmentId}`,
      `https://api-integration.servicetitan.io/files/v2/tenant/${tenantId}/attachments/${attachmentId}/download`,
      `https://api-integration.servicetitan.io/files/v2/tenant/${tenantId}/attachments/${attachmentId}`
    ].filter(Boolean);
    
    const results = {};
    
    for (const url of testUrls) {
      try {
        console.log(`🧪 Testing download URL: ${url}`);
        
        const testResponse = await fetch(url, {
          method: 'HEAD', // Just check headers, don't download
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'ST-App-Key': appKey
          }
        });
        
        results[url] = {
          status: testResponse.status,
          success: testResponse.ok,
          contentType: testResponse.headers.get('content-type'),
          contentLength: testResponse.headers.get('content-length'),
          headers: Object.fromEntries(testResponse.headers.entries())
        };
        
      } catch (error) {
        results[url] = {
          error: error.message
        };
      }
    }
    
    res.json({
      success: true,
      message: 'Attachment download URL test results',
      jobId: jobId,
      attachmentId: attachmentId,
      attachment: {
        id: targetAttachment.id,
        fileName: targetAttachment.fileName,
        mimeType: targetAttachment.mimeType,
        size: targetAttachment.size,
        downloadUrl: targetAttachment.downloadUrl
      },
      testResults: results,
      workingUrls: Object.keys(results).filter(url => results[url].success),
      recommendation: Object.keys(results).find(url => results[url].success) || 'No working download URLs found'
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ COMPREHENSIVE DEBUG: Job ID Extraction and Validation
app.get('/debug/job-analysis/:technicianId', async (req, res) => {
  try {
    const { technicianId } = req.params;
    
    console.log(`🔍 DEBUGGING: Job ID extraction for technician ${technicianId}`);
    
    const tokenResult = await authenticateServiceTitan();
    if (!tokenResult.success) {
      return res.status(500).json({ success: false, error: 'Auth failed' });
    }
    
    const fetch = (await import('node-fetch')).default;
    const tenantId = SERVER_CONFIG.serviceTitan.tenantId;
    const appKey = SERVER_CONFIG.serviceTitan.appKey;
    const accessToken = tokenResult.accessToken;
    
    // Get first 10 appointments for this technician
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setDate(oneMonthFromNow.getDate() + 30);
    
    const queryParams = new URLSearchParams({
      pageSize: '10', // Just first 10 for debugging
      technicianIds: technicianId,
      startsOnOrAfter: twoWeeksAgo.toISOString(),
      startsOnOrBefore: oneMonthFromNow.toISOString()
    });
    
    const appointmentsUrl = `https://api-integration.servicetitan.io/jpm/v2/tenant/${tenantId}/appointments?${queryParams}`;
    
    const appointmentsResponse = await fetch(appointmentsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey,
        'Content-Type': 'application/json'
      }
    });

    if (!appointmentsResponse.ok) {
      throw new Error(`Appointments API failed: ${appointmentsResponse.status}`);
    }

    const appointmentsData = await appointmentsResponse.json();
    const appointments = appointmentsData.data || [];
    
    console.log(`📊 Found ${appointments.length} appointments for analysis`);
    
    // Analyze each appointment's job ID
    const analysis = [];
    
    for (const appointment of appointments.slice(0, 5)) { // Test first 5
      const appointmentAnalysis = {
        appointmentId: appointment.id,
        appointmentNumber: appointment.appointmentNumber || appointment.number,
        jobIdFromAppointment: appointment.jobId,
        rawAppointmentData: {
          id: appointment.id,
          jobId: appointment.jobId,
          appointmentNumber: appointment.appointmentNumber,
          number: appointment.number,
          start: appointment.start,
          customerId: appointment.customerId,
          locationId: appointment.locationId
        }
      };
      
      // Test if this job ID exists in Jobs API
      if (appointment.jobId) {
        try {
          console.log(`🧪 Testing job ID ${appointment.jobId} from appointment ${appointment.id}`);
          
          const jobUrl = `https://api-integration.servicetitan.io/jpm/v2/tenant/${tenantId}/jobs/${appointment.jobId}`;
          
          const jobResponse = await fetch(jobUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'ST-App-Key': appKey,
              'Content-Type': 'application/json'
            }
          });
          
          appointmentAnalysis.jobApiTest = {
            url: jobUrl,
            status: jobResponse.status,
            success: jobResponse.ok,
            error: jobResponse.ok ? null : await jobResponse.text()
          };
          
          if (jobResponse.ok) {
            const jobData = await jobResponse.json();
            appointmentAnalysis.jobDetails = {
              jobNumber: jobData.jobNumber,
              summary: jobData.summary?.substring(0, 100) + '...',
              customerId: jobData.customerId,
              locationId: jobData.locationId,
              createdOn: jobData.createdOn
            };
            console.log(`✅ Job ${appointment.jobId} EXISTS: ${jobData.jobNumber}`);
          } else {
            console.log(`❌ Job ${appointment.jobId} NOT FOUND: ${jobResponse.status}`);
          }
          
        } catch (error) {
          appointmentAnalysis.jobApiTest = {
            error: error.message
          };
          console.log(`❌ Error testing job ${appointment.jobId}: ${error.message}`);
        }
        
        // Test attachments for this job ID
        try {
          console.log(`📎 Testing attachments for job ID ${appointment.jobId}`);
          
          const attachmentsUrl = `https://api-integration.servicetitan.io/forms/v2/tenant/${tenantId}/jobs/${appointment.jobId}/attachments`;
          
          const attachmentsResponse = await fetch(attachmentsUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'ST-App-Key': appKey,
              'Content-Type': 'application/json'
            }
          });
          
          appointmentAnalysis.attachmentsApiTest = {
            url: attachmentsUrl,
            status: attachmentsResponse.status,
            success: attachmentsResponse.ok
          };
          
          if (attachmentsResponse.ok) {
            const attachmentsData = await attachmentsResponse.json();
            appointmentAnalysis.attachmentsApiTest.attachmentCount = attachmentsData.data?.length || 0;
            appointmentAnalysis.attachmentsApiTest.hasAttachments = (attachmentsData.data?.length || 0) > 0;
            
            if (attachmentsData.data?.length > 0) {
              appointmentAnalysis.attachmentsApiTest.sampleAttachments = attachmentsData.data.slice(0, 3).map(att => ({
                id: att.id,
                fileName: att.fileName || att.name,
                mimeType: att.mimeType || att.contentType,
                size: att.size || att.fileSize
              }));
              console.log(`✅ Job ${appointment.jobId} has ${attachmentsData.data.length} attachments`);
            } else {
              console.log(`⚠️ Job ${appointment.jobId} has 0 attachments`);
            }
          } else {
            appointmentAnalysis.attachmentsApiTest.error = await attachmentsResponse.text();
            console.log(`❌ Attachments API failed for job ${appointment.jobId}: ${attachmentsResponse.status}`);
          }
          
        } catch (error) {
          appointmentAnalysis.attachmentsApiTest = {
            error: error.message
          };
          console.log(`❌ Error testing attachments for job ${appointment.jobId}: ${error.message}`);
        }
        
      } else {
        appointmentAnalysis.jobApiTest = {
          error: 'No jobId found in appointment'
        };
        console.log(`❌ Appointment ${appointment.id} has no jobId`);
      }
      
      analysis.push(appointmentAnalysis);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Summary analysis
    const summary = {
      totalAppointmentsAnalyzed: analysis.length,
      appointmentsWithJobId: analysis.filter(a => a.jobIdFromAppointment).length,
      appointmentsWithoutJobId: analysis.filter(a => !a.jobIdFromAppointment).length,
      validJobIds: analysis.filter(a => a.jobApiTest?.success).length,
      invalidJobIds: analysis.filter(a => a.jobApiTest && !a.jobApiTest.success).length,
      jobsWithAttachments: analysis.filter(a => a.attachmentsApiTest?.hasAttachments).length,
      jobsWithoutAttachments: analysis.filter(a => a.attachmentsApiTest?.success && !a.attachmentsApiTest?.hasAttachments).length,
      attachmentErrors: analysis.filter(a => a.attachmentsApiTest && !a.attachmentsApiTest.success).length
    };
    
    // Recommendations
    const recommendations = [];
    
    if (summary.appointmentsWithoutJobId > 0) {
      recommendations.push(`⚠️ ${summary.appointmentsWithoutJobId} appointments have no jobId - this is unusual`);
    }
    
    if (summary.invalidJobIds > 0) {
      recommendations.push(`❌ ${summary.invalidJobIds} job IDs from appointments don't exist in Jobs API - data inconsistency`);
    }
    
    if (summary.validJobIds > 0 && summary.jobsWithAttachments === 0) {
      recommendations.push(`📎 All ${summary.validJobIds} valid jobs have 0 attachments - jobs may not have PDF documents`);
    }
    
    if (summary.jobsWithAttachments > 0) {
      recommendations.push(`✅ Found ${summary.jobsWithAttachments} jobs with attachments - system is working!`);
    }
    
    if (summary.attachmentErrors > 0) {
      recommendations.push(`❌ ${summary.attachmentErrors} attachment API calls failed - check permissions`);
    }
    
    res.json({
      success: true,
      message: 'Job ID extraction and validation analysis',
      technicianId: technicianId,
      summary: summary,
      recommendations: recommendations,
      analysis: analysis,
      conclusion: {
        jobIdExtractionWorking: summary.appointmentsWithJobId > 0,
        jobApiWorking: summary.validJobIds > 0,
        attachmentsApiWorking: summary.jobsWithAttachments > 0 || summary.jobsWithoutAttachments > 0,
        mainIssue: summary.invalidJobIds > 0 ? 'Job IDs from appointments dont exist in Jobs API' :
                   summary.jobsWithAttachments === 0 ? 'Jobs exist but have no attachments' :
                   'System working correctly'
      }
    });
    
  } catch (error) {
    console.error('❌ Debug analysis failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ✅ SIMPLE DEBUG: Quick appointment data check
app.get('/debug/appointment-raw/:technicianId', async (req, res) => {
  try {
    const { technicianId } = req.params;
    
    const tokenResult = await authenticateServiceTitan();
    if (!tokenResult.success) {
      return res.status(500).json({ success: false, error: 'Auth failed' });
    }
    
    const fetch = (await import('node-fetch')).default;
    const tenantId = SERVER_CONFIG.serviceTitan.tenantId;
    const appKey = SERVER_CONFIG.serviceTitan.appKey;
    const accessToken = tokenResult.accessToken;
    
    const queryParams = new URLSearchParams({
      pageSize: '5',
      technicianIds: technicianId
    });
    
    const url = `https://api-integration.servicetitan.io/jpm/v2/tenant/${tenantId}/appointments?${queryParams}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API failed: ${response.status}`);
    }

    const data = await response.json();
    const appointments = data.data || [];
    
    res.json({
      success: true,
      message: 'Raw appointment data (first 5)',
      technicianId: technicianId,
      count: appointments.length,
      rawAppointments: appointments.map(appointment => ({
        id: appointment.id,
        appointmentNumber: appointment.appointmentNumber,
        number: appointment.number,
        jobId: appointment.jobId,
        customerId: appointment.customerId,
        locationId: appointment.locationId,
        start: appointment.start,
        status: appointment.status,
        assignedTechnicianIds: appointment.assignedTechnicianIds,
        allFields: Object.keys(appointment)
      })),
      fieldAnalysis: {
        hasJobId: appointments.filter(a => a.jobId).length,
        missingJobId: appointments.filter(a => !a.jobId).length,
        uniqueJobIds: [...new Set(appointments.map(a => a.jobId).filter(Boolean))],
        commonFields: appointments.length > 0 ? Object.keys(appointments[0]) : []
      }
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ ENHANCED DEBUG: Test ALL possible attachment endpoints
app.get('/debug/attachments-comprehensive/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const tokenResult = await authenticateServiceTitan();
    if (!tokenResult.success) {
      return res.status(500).json({ success: false, error: 'Auth failed' });
    }
    
    const fetch = (await import('node-fetch')).default;
    const tenantId = SERVER_CONFIG.serviceTitan.tenantId;
    const appKey = SERVER_CONFIG.serviceTitan.appKey;
    const accessToken = tokenResult.accessToken;
    
    const results = {};
    
    // Test all known attachment endpoints
    const endpoints = [
      // Forms API endpoints
      {
        name: 'forms_jobs_attachments',
        url: `https://api-integration.servicetitan.io/forms/v2/tenant/${tenantId}/jobs/${jobId}/attachments`,
        description: '✅ CORRECT: Official Forms API endpoint (from documentation)'
      },
      {
        name: 'forms_job_attachments_query',
        url: `https://api-integration.servicetitan.io/forms/v2/tenant/${tenantId}/job-attachments?jobId=${jobId}`,
        description: '❌ WRONG: Alternative Forms API with query parameter (was being used)'
      },
      {
        name: 'forms_attachments_query',
        url: `https://api-integration.servicetitan.io/forms/v2/tenant/${tenantId}/attachments?jobId=${jobId}`,
        description: 'Forms API attachments with query'
      },
      
      // JMP API endpoints
      {
        name: 'jmp_jobs_attachments',
        url: `https://api-integration.servicetitan.io/jpm/v2/tenant/${tenantId}/jobs/${jobId}/attachments`,
        description: 'JMP API jobs attachments'
      },
      
      // Other possible endpoints
      {
        name: 'files_api',
        url: `https://api-integration.servicetitan.io/files/v2/tenant/${tenantId}/jobs/${jobId}/attachments`,
        description: 'Files API (if it exists)'
      }
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🧪 Testing: ${endpoint.description}`);
        console.log(`📡 URL: ${endpoint.url}`);
        
        const response = await fetch(endpoint.url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'ST-App-Key': appKey,
            'Content-Type': 'application/json'
          }
        });
        
        const responseText = await response.text();
        let responseData;
        
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = responseText;
        }
        
        results[endpoint.name] = {
          url: endpoint.url,
          description: endpoint.description,
          status: response.status,
          success: response.ok,
          hasData: response.ok && responseData?.data?.length > 0,
          dataCount: responseData?.data?.length || 0,
          totalCount: responseData?.totalCount,
          hasMore: responseData?.hasMore,
          sampleData: response.ok && responseData?.data?.length > 0 ? {
            firstItem: responseData.data[0],
            allItems: responseData.data.map(item => ({
              id: item.id,
              name: item.fileName || item.name,
              type: item.mimeType || item.contentType,
              size: item.size || item.fileSize
            }))
          } : null,
          rawResponse: typeof responseData === 'string' ? responseData.substring(0, 500) : null
        };
        
        if (response.ok && responseData?.data?.length > 0) {
          console.log(`✅ SUCCESS: ${endpoint.name} found ${responseData.data.length} attachments`);
        } else if (response.ok) {
          console.log(`⚠️ EMPTY: ${endpoint.name} - Status ${response.status} but no data`);
        } else {
          console.log(`❌ FAILED: ${endpoint.name} - Status ${response.status}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        results[endpoint.name] = { 
          url: endpoint.url,
          description: endpoint.description,
          error: error.message 
        };
        console.log(`❌ ERROR: ${endpoint.name} - ${error.message}`);
      }
    }
    
    // Summary
    const workingEndpoints = Object.keys(results).filter(key => results[key]?.success && results[key]?.hasData);
    const partialEndpoints = Object.keys(results).filter(key => results[key]?.success && !results[key]?.hasData);
    const failedEndpoints = Object.keys(results).filter(key => !results[key]?.success);
    
    res.json({
      success: true,
      message: 'Comprehensive attachment API endpoint test results',
      jobId: jobId,
      fix: {
        status: 'APPLIED',
        correctEndpoint: 'forms/v2/tenant/{tenant}/jobs/{jobId}/attachments',
        previousWrongEndpoint: 'forms/v2/tenant/{tenant}/job-attachments?jobId={jobId}'
      },
      summary: {
        workingWithData: workingEndpoints,
        workingButEmpty: partialEndpoints,
        failed: failedEndpoints,
        recommendation: workingEndpoints.length > 0 ? 
          `✅ SUCCESS: ${workingEndpoints[0]} returned ${results[workingEndpoints[0]]?.dataCount} attachments` :
          partialEndpoints.length > 0 ?
          `⚠️ ENDPOINTS WORK BUT NO DATA: Job ${jobId} may have no attachments` :
          '❌ NO WORKING ENDPOINTS: Check job ID or API permissions'
      },
      results: results
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ QUICK DEBUG: Test the appointments endpoint
app.get('/debug/appointments-filter/:technicianId', async (req, res) => {
  try {
    const { technicianId } = req.params;
    
    const tokenResult = await authenticateServiceTitan();
    if (!tokenResult.success) {
      return res.status(500).json({ success: false, error: 'Auth failed' });
    }
    
    const fetch = (await import('node-fetch')).default;
    const tenantId = SERVER_CONFIG.serviceTitan.tenantId;
    const appKey = SERVER_CONFIG.serviceTitan.appKey;
    const accessToken = tokenResult.accessToken;
    
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    twoWeeksAgo.setHours(0, 0, 0, 0);
    
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setDate(oneMonthFromNow.getDate() + 30);
    oneMonthFromNow.setHours(23, 59, 59, 999);
    
    const queryParams = new URLSearchParams({
      pageSize: '50',
      technicianIds: technicianId,
      startsOnOrAfter: twoWeeksAgo.toISOString(),
      startsOnOrBefore: oneMonthFromNow.toISOString()
    });
    
    const url = `https://api-integration.servicetitan.io/jpm/v2/tenant/${tenantId}/appointments?${queryParams}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return res.status(500).json({ 
        success: false, 
        error: 'API call failed', 
        status: response.status,
        details: await response.text()
      });
    }

    const data = await response.json();
    const appointments = data.data || [];
    
    const statusCounts = {};
    appointments.forEach(appointment => {
      const status = appointment.status?.name || appointment.status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    res.json({
      success: true,
      message: 'Appointments API test with technicianIds filter',
      query: {
        technicianId,
        dateFrom: twoWeeksAgo.toISOString(),
        dateTo: oneMonthFromNow.toISOString(),
        pageSize: 50
      },
      results: {
        totalAppointments: appointments.length,
        statusBreakdown: statusCounts,
        sampleAppointments: appointments.slice(0, 5).map(a => ({ 
          id: a.id, 
          number: a.appointmentNumber || a.number,
          status: a.status?.name || a.status,
          jobId: a.jobId,
          start: a.start
        }))
      }
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ServiceTitan Helper Functions
async function searchTechnicianByUsername(username, accessToken, tenantId, appKey) {
  const fetch = (await import('node-fetch')).default;
  
  const listUrl = `https://api-integration.servicetitan.io/settings/v2/tenant/${tenantId}/technicians?active=True&pageSize=200`;
  
  const response = await fetch(listUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'ST-App-Key': appKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Technician list API failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const technicians = data.data || [];
  
  const usernameMatch = username.toLowerCase();
  const matchedTechnician = technicians.find(tech => {
    const loginName = tech.loginName || tech.username || '';
    return loginName.toLowerCase() === usernameMatch;
  });
  
  if (!matchedTechnician) return null;
  
  return {
    id: matchedTechnician.id,
    name: matchedTechnician.name,
    email: matchedTechnician.email,
    phoneNumber: matchedTechnician.phoneNumber,
    active: matchedTechnician.active,
    loginName: matchedTechnician.loginName || matchedTechnician.username,
    businessUnitId: matchedTechnician.businessUnitId
  };
}

function validatePhoneMatch(technician, inputPhone) {
  const normalizedInputPhone = normalizePhone(inputPhone);
  const normalizedTechPhone = normalizePhone(technician.phoneNumber || '');
  
  return normalizedInputPhone === normalizedTechPhone;
}

function normalizePhone(phone) {
  if (!phone) return '';
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length === 11 && digitsOnly.startsWith('1') 
    ? digitsOnly.substring(1) 
    : digitsOnly;
}

// Error handling
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 TitanPDF Technician Portal - COMPLETE WITH PDF DOWNLOAD SUPPORT');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${SERVER_CONFIG.serviceTitan.isIntegration ? 'Integration' : 'Production'}`);
  console.log(`🏢 Company: ${SERVER_CONFIG.company.name}`);
  console.log(`🎯 Target Statuses: ${SERVER_CONFIG.targetAppointmentStatuses.join(', ')}`);
  console.log('');
  console.log('🔧 FIXES APPLIED:');
  console.log('   ✅ CORRECT: /forms/v2/tenant/{tenant}/jobs/{jobId}/attachments');
  console.log('   ❌ WRONG:   /forms/v2/tenant/{tenant}/job-attachments?jobId={jobId}');
  console.log('');
  console.log('📋 Production Endpoints:');
  console.log('   GET  /health');
  console.log('   POST /api/technician/validate');
  console.log('   GET  /api/technician/:id/appointments');
  console.log('   GET  /api/job/:jobId');
  console.log('   GET  /api/job/:jobId/attachments  (🔧 FIXED)');
  console.log('   GET  /api/job/:jobId/attachment/:attachmentId/download  (🆕 NEW PDF DOWNLOAD)');
  console.log('');
  console.log('🧪 Debug Endpoints:');
  console.log('   GET  /debug/appointment-raw/:technicianId');
  console.log('   GET  /debug/job-analysis/:technicianId');
  console.log('   GET  /debug/attachments-comprehensive/:jobId');
  console.log('   GET  /debug/appointments-filter/:technicianId');
  console.log('   GET  /debug/attachment-download/:jobId/:attachmentId  (🆕 TEST PDF DOWNLOAD)');
  console.log('');
  console.log('📄 PDF DOWNLOAD SYSTEM:');
  console.log('   ✅ Server proxy for PDF downloads from ServiceTitan');
  console.log('   ✅ Multiple fallback download URL attempts');
  console.log('   ✅ Proper file headers and content-type handling');
  console.log('   ✅ Debug endpoint to test attachment download capabilities');
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 TitanPDF Technician Portal terminated');
  process.exit(0);
});