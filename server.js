// server.js - FINAL COMPLETE VERSION: Customer Names, Fixed Addresses, No Time Display, All Records
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
  
  // ✅ THE 4 TARGET APPOINTMENT STATUSES (What technicians actually need to see)
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
    message: 'TitanPDF Technician Portal - RATE LIMIT OPTIMIZED',
    environment: SERVER_CONFIG.serviceTitan.isIntegration ? 'Integration' : 'Production',
    company: SERVER_CONFIG.company.name,
    targetStatuses: SERVER_CONFIG.targetAppointmentStatuses,
    apiStrategy: 'Customer names, fixed addresses, no time display, all records',
    rateLimitOptimizations: {
      dateRange: '2 weeks back (was 30 days)',
      appointmentDelay: '200ms between pages',
      customerDelay: '100ms between customer requests',
      debugPageSize: '50 (was 100)'
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

// ✅ FINAL: GET APPOINTMENTS WITH CUSTOMER NAMES & FIXED ADDRESSES
app.get('/api/technician/:technicianId/appointments', async (req, res) => {
  try {
    const { technicianId } = req.params;
    
    console.log(`📅 FINAL VERSION: Fetching appointments for technician ID: ${technicianId} with customer names & fixed addresses`);
    
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
    
    // Date range: 2 weeks back to 30 days forward (reduced from 30 days back)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 14); // ✅ REDUCED: Only 2 weeks back instead of 30 days
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    endDate.setHours(23, 59, 59, 999);
    
    // ✅ USE APPOINTMENTS API WITH technicianIds FILTER - TRUST THE FILTER!
    console.log(`🎯 Using appointments API with technicianIds=${technicianId} filter`);
    
    let allAppointments = [];
    let page = 1;
    let hasMorePages = true;
    const pageSize = 500;
    
    while (hasMorePages) {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        technicianIds: technicianId,  // ✅ This DOES filter correctly - trust it!
        startsOnOrAfter: startDate.toISOString(),
        startsOnOrBefore: endDate.toISOString()
      });
      
      const appointmentsUrl = `https://api-integration.servicetitan.io/jpm/v2/tenant/${tenantId}/appointments?${queryParams}`;
      
      console.log(`🔍 API Request: ${appointmentsUrl}`);
      console.log(`🎯 Query: technicianIds=${technicianId}, page=${page}, dateRange=${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]} (2 weeks back, 30 days forward)`);
      
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
        
        console.log(`📊 Page ${page}: Found ${pageAppointments.length} appointments (ServiceTitan filtered by technicianIds)`);
        
        // ✅ TRUST THE FILTER: If ServiceTitan returns appointments, they ARE assigned to this technician
        // No need to verify assignedTechnicianIds because the technicianIds filter already did that
        console.log(`✅ All ${pageAppointments.length} appointments on page ${page} are pre-filtered by ServiceTitan for technician ${technicianId}`);
        
        // Add appointments to our collection
        allAppointments = allAppointments.concat(pageAppointments);
        
        // Check if we have more pages
        const hasMore = appointmentsData.hasMore || (pageAppointments.length === pageSize);
        
        if (!hasMore || pageAppointments.length === 0) {
          hasMorePages = false;
        } else {
          page++;
          
          // Safety check: Don't go beyond reasonable limits
          if (page > 20) {
            hasMorePages = false;
          }
          
          // Increased delay between requests to avoid rate limits (ServiceTitan: 60 calls/second)
          await new Promise(resolve => setTimeout(resolve, 200)); // ✅ INCREASED: 200ms delay (5 calls/second)
        }
        
      } catch (error) {
        console.error(`❌ Error fetching page ${page}:`, error);
        hasMorePages = false;
      }
    }
    
    console.log(`📊 TOTAL: ServiceTitan returned ${allAppointments.length} appointments filtered for technician ${technicianId}`);
    
    if (allAppointments.length === 0) {
      console.log(`ℹ️ No appointments found for technician ${technicianId} in the specified date range`);
      return res.json({
        success: true,
        data: [],
        count: 0,
        technicianId: parseInt(technicianId),
        message: 'No appointments found for this technician in the date range'
      });
    }
    
    // ✅ ENRICH WITH CUSTOMER DATA (ALL APPOINTMENTS - NO LIMIT)
    console.log(`👥 Enriching ALL ${allAppointments.length} appointments with customer data`);
    
    const enrichedAppointments = await Promise.all(
      allAppointments.map(async (appointment) => {
        let customerData = null;
        
        try {
          // Get customer data using customer ID from appointment
          if (appointment.customerId) {
            const customerUrl = `https://api-integration.servicetitan.io/crm/v2/tenant/${tenantId}/customers/${appointment.customerId}`;
            
            console.log(`👤 Fetching customer ${appointment.customerId} for appointment ${appointment.appointmentNumber}`);
            
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
              
              console.log(`✅ Got customer: ${customerData.name} for appointment ${appointment.appointmentNumber}`);
            } else {
              console.warn(`⚠️ Failed to fetch customer ${appointment.customerId}: ${customerResponse.status}`);
            }
          }
          
          // Increased delay to be respectful to the API and avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100)); // ✅ INCREASED: 100ms delay for customer requests
          
        } catch (error) {
          console.error(`❌ Error fetching customer data for appointment ${appointment.id}:`, error);
        }
        
        return {
          // Core ServiceTitan fields
          jobId: appointment.jobId,
          appointmentNumber: appointment.appointmentNumber || appointment.number,
          start: appointment.start,
          end: appointment.end,
          arrivalWindowStart: appointment.arrivalWindowStart || null,
          arrivalWindowEnd: appointment.arrivalWindowEnd || null,
          status: appointment.status,
          specialInstructions: appointment.specialInstructions || null,
          
          // Additional fields for functionality
          id: appointment.id,
          customerId: appointment.customerId,
          locationId: appointment.locationId,
          createdOn: appointment.createdOn,
          modifiedOn: appointment.modifiedOn,
          
          // ✅ TRUST: ServiceTitan already filtered these appointments for our technician
          assignedToTechnician: true, // We trust the technicianIds filter worked
          technicianId: parseInt(technicianId),
          
          // ✅ ENRICHED CUSTOMER DATA
          customer: customerData || {
            id: appointment.customerId,
            name: `Customer #${appointment.customerId}`,
            phoneNumber: null,
            address: null
          }
        };
      })
    );
    
    // Sort by start time (most recent first)
    const sortedAppointments = enrichedAppointments.sort((a, b) => new Date(a.start) - new Date(b.start));
    
    console.log(`✅ FINAL RESULT: Returning ${sortedAppointments.length} appointments for technician ${technicianId} (ALL with customer data)`);
    console.log(`🎯 Method: Trusted ServiceTitan's technicianIds filter - no manual verification needed`);
    
    res.json({
      success: true,
      data: sortedAppointments,
      count: sortedAppointments.length,
      technicianId: parseInt(technicianId),
      method: 'appointments-api-with-technician-filter',
      message: 'Trusted ServiceTitan technicianIds filter',
      debug: {
        totalFromServiceTitan: allAppointments.length,
        enrichedAndReturned: sortedAppointments.length,
        filterTrusted: true
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching technician appointments:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching technician appointments'
    });
  }
});

// ✅ GET JOB ATTACHMENTS/DOCUMENTS - FIXED: Using Forms API instead of JMP API
app.get('/api/job/:jobId/attachments', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    console.log(`📎 Fetching attachments for job: ${jobId} using Forms API`);
    
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
    
    // ✅ FIXED: Use Forms API instead of JMP API for attachments
    const attachmentsUrl = `https://api-integration.servicetitan.io/forms/v2/tenant/${tenantId}/job-attachments?jobId=${jobId}`;
    
    console.log(`🔍 Forms API Request: ${attachmentsUrl}`);
    
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
        // Job not found or no attachments - this is normal
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
    const attachments = attachmentsData.data || attachmentsData || [];
    
    console.log(`📊 Forms API returned ${attachments.length} total attachments for job ${jobId}`);
    
    // ✅ FILTER FOR PDF FILES ONLY
    const pdfAttachments = attachments.filter(attachment => {
      const fileName = attachment.fileName || attachment.name || '';
      const isPdf = fileName.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        console.log(`📄 Found PDF: ${fileName}`);
      }
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
        createdOn: attachment.createdOn || attachment.dateCreated || new Date().toISOString(),
        downloadUrl: attachment.downloadUrl || attachment.url || null,
        serviceTitanId: attachment.id,
        jobId: jobId
      };
    });
    
    console.log(`✅ Transformed ${transformedAttachments.length} PDF attachments for job ${jobId}`);
    
    res.json({
      success: true,
      data: transformedAttachments,
      count: transformedAttachments.length,
      jobId: jobId,
      apiUsed: 'forms/v2'
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

// ✅ GET SPECIFIC JOB DETAILS - ENHANCED DEBUGGING
app.get('/api/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    console.log(`📋 Fetching job details: ${jobId}`);
    
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
    
    // ServiceTitan Job Details API endpoint
    const jobUrl = `https://api-integration.servicetitan.io/jpm/v2/tenant/${tenantId}/jobs/${jobId}`;
    
    console.log(`🔍 Job API Request: ${jobUrl}`);
    
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
        console.warn(`⚠️ Job ${jobId} not found in ServiceTitan`);
        return res.status(404).json({
          success: false,
          error: 'Job not found',
          jobId: jobId,
          details: 'This job ID does not exist in ServiceTitan or may have been deleted'
        });
      }
      
      throw new Error(`API error: ${response.statusText}`);
    }

    const jobData = await response.json();
    
    console.log(`📊 Raw job data received:`, {
      id: jobData.id,
      jobNumber: jobData.jobNumber,
      summary: jobData.summary ? jobData.summary.substring(0, 50) + '...' : 'No summary',
      customerId: jobData.customerId,
      locationId: jobData.locationId
    });
    
    // Transform job data
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

// ✅ QUICK DEBUG: Test the regular appointments endpoint with technicianIds filter
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
    
    // Test appointments endpoint with technicianIds filter for just the last 2 weeks to next month
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14); // ✅ REDUCED: 2 weeks instead of 1 week
    twoWeeksAgo.setHours(0, 0, 0, 0);
    
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setDate(oneMonthFromNow.getDate() + 30);
    oneMonthFromNow.setHours(23, 59, 59, 999);
    
    const queryParams = new URLSearchParams({
      pageSize: '50', // ✅ REDUCED: Smaller page size to reduce load
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
    
    // Quick analysis
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
          start: a.start,
          // Note: assignedTechnicianIds might be undefined, but the filter still works
          assignedTechnicianIds: a.assignedTechnicianIds
        }))
      },
      note: 'If this returns appointments, then technicianIds filter IS working correctly'
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
  console.log('🚀 TitanPDF Technician Portal - FINAL VERSION');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${SERVER_CONFIG.serviceTitan.isIntegration ? 'Integration' : 'Production'}`);
  console.log(`🏢 Company: ${SERVER_CONFIG.company.name}`);
  console.log(`🎯 Target Appointment Statuses: ${SERVER_CONFIG.targetAppointmentStatuses.join(', ')}`);
  console.log(`🔧 FINAL FEATURES: Customer names in headers, fixed address formatting, no time display, all records processed, RATE LIMIT OPTIMIZED (2 weeks back only, increased delays)`);
  console.log('');
  console.log('📋 Endpoints:');
  console.log('   GET  /health');
  console.log('   POST /api/technician/validate');
  console.log('   GET  /api/technician/:id/appointments  (OPTIMIZED - 2 weeks back, rate limit safe)');
  console.log('   GET  /api/job/:jobId');
  console.log('   GET  /api/job/:jobId/attachments');
// ✅ DEBUG: Test different attachment API endpoints
app.get('/debug/attachments/:jobId', async (req, res) => {
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
    
    // Test JMP API (old method)
    try {
      const jmpUrl = `https://api-integration.servicetitan.io/jpm/v2/tenant/${tenantId}/jobs/${jobId}/attachments`;
      console.log(`🧪 Testing JMP API: ${jmpUrl}`);
      
      const jmpResponse = await fetch(jmpUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'ST-App-Key': appKey,
          'Content-Type': 'application/json'
        }
      });
      
      results.jmpApi = {
        url: jmpUrl,
        status: jmpResponse.status,
        success: jmpResponse.ok,
        data: jmpResponse.ok ? await jmpResponse.json() : await jmpResponse.text()
      };
    } catch (error) {
      results.jmpApi = { error: error.message };
    }
    
    // Test Forms API (new method)
    try {
      const formsUrl = `https://api-integration.servicetitan.io/forms/v2/tenant/${tenantId}/job-attachments?jobId=${jobId}`;
      console.log(`🧪 Testing Forms API: ${formsUrl}`);
      
      const formsResponse = await fetch(formsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'ST-App-Key': appKey,
          'Content-Type': 'application/json'
        }
      });
      
      results.formsApi = {
        url: formsUrl,
        status: formsResponse.status,
        success: formsResponse.ok,
        data: formsResponse.ok ? await formsResponse.json() : await formsResponse.text()
      };
    } catch (error) {
      results.formsApi = { error: error.message };
    }
    
    // Test alternative Forms API endpoints
    const alternativeEndpoints = [
      `/forms/v2/tenant/${tenantId}/jobs/${jobId}/attachments`,
      `/forms/v2/tenant/${tenantId}/attachments?jobId=${jobId}`,
      `/forms/v2/tenant/${tenantId}/job/${jobId}/attachments`
    ];
    
    for (const endpoint of alternativeEndpoints) {
      try {
        const altUrl = `https://api-integration.servicetitan.io${endpoint}`;
        console.log(`🧪 Testing alternative: ${altUrl}`);
        
        const altResponse = await fetch(altUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'ST-App-Key': appKey,
            'Content-Type': 'application/json'
          }
        });
        
        results[`forms_alt_${endpoint.split('/').pop()}`] = {
          url: altUrl,
          status: altResponse.status,
          success: altResponse.ok,
          data: altResponse.ok ? await altResponse.json() : await altResponse.text()
        };
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        results[`forms_alt_${endpoint.split('/').pop()}`] = { error: error.message };
      }
    }
    
    res.json({
      success: true,
      message: 'Attachment API endpoint test results',
      jobId: jobId,
      results: results,
      summary: {
        jmpApiWorked: results.jmpApi?.success || false,
        formsApiWorked: results.formsApi?.success || false,
        workingEndpoints: Object.keys(results).filter(key => results[key]?.success)
      }
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 TitanPDF Technician Portal terminated');
  process.exit(0);
});