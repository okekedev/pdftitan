// server.js - Complete TitanPDF Technician Portal with Job Attachments
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
    message: 'TitanPDF Technician Portal',
    environment: SERVER_CONFIG.serviceTitan.isIntegration ? 'Integration' : 'Production',
    company: SERVER_CONFIG.company.name,
    targetStatuses: SERVER_CONFIG.targetAppointmentStatuses
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

// ✅ GET ALL APPOINTMENTS FOR TECHNICIAN WITH CUSTOMER DATA
app.get('/api/technician/:technicianId/appointments', async (req, res) => {
  try {
    const { technicianId } = req.params;
    
    console.log(`📅 Fetching appointments SPECIFICALLY for technician ID: ${technicianId}`);
    
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
    
    // Date range: 30 days back to 30 days forward
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    endDate.setHours(23, 59, 59, 999);
    
    // ✅ PAGINATION: Get all appointments in batches of 500
    let allAppointments = [];
    let page = 1;
    let hasMorePages = true;
    const pageSize = 500;
    
    while (hasMorePages) {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        technicianIds: technicianId,  // ✅ CRITICAL: Filter by specific technician only
        startsOnOrAfter: startDate.toISOString(),
        startsOnOrBefore: endDate.toISOString()
      });
      
      const appointmentsUrl = `https://api-integration.servicetitan.io/jpm/v2/tenant/${tenantId}/appointments?${queryParams}`;
      
      console.log(`🔍 API Request URL: ${appointmentsUrl}`);
      console.log(`🎯 Query Parameters: technicianIds=${technicianId}, page=${page}, pageSize=${pageSize}`);
      
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
        
        // ✅ VERIFY TECHNICIAN FILTERING - Check if appointments are actually for our technician
        const technicianCheck = pageAppointments.filter(apt => {
          // Check if this appointment has our technician assigned
          const hasOurTechnician = apt.assignedTechnicianIds && apt.assignedTechnicianIds.includes(parseInt(technicianId));
          if (!hasOurTechnician) {
            console.warn(`⚠️ Appointment ${apt.id} does not have technician ${technicianId} assigned. AssignedTechnicians: ${apt.assignedTechnicianIds}`);
          }
          return hasOurTechnician;
        });
        
        console.log(`✅ Verified ${technicianCheck.length} of ${pageAppointments.length} appointments belong to technician ${technicianId}`);
        
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
          
          // Small delay between requests to be respectful to the API
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`❌ Error fetching page ${page}:`, error);
        hasMorePages = false;
      }
    }
    
    console.log(`📊 TOTAL: Found ${allAppointments.length} appointments for technician ${technicianId}`);
    
    // ✅ DOUBLE-CHECK: Verify all appointments are for our technician
    const verifiedAppointments = allAppointments.filter(appointment => {
      // Additional verification that appointment belongs to our technician
      const belongsToTechnician = appointment.assignedTechnicianIds && 
                                 appointment.assignedTechnicianIds.includes(parseInt(technicianId));
      
      if (!belongsToTechnician) {
        console.warn(`⚠️ Filtering out appointment ${appointment.id} - not assigned to technician ${technicianId}`);
        console.warn(`   Assigned technicians: ${appointment.assignedTechnicianIds}`);
      }
      
      return belongsToTechnician;
    });
    
    console.log(`🔒 FILTERED: ${verifiedAppointments.length} appointments verified for technician ${technicianId}`);
    
    // ✅ GET CUSTOMER DATA FOR VERIFIED APPOINTMENTS ONLY
    const enrichedAppointments = await Promise.all(
      verifiedAppointments.slice(0, 50).map(async (appointment) => { // Limit to 50 for performance
        let customerData = null;
        
        try {
          // Get customer data using customer ID from appointment
          if (appointment.customerId) {
            const customerUrl = `https://api-integration.servicetitan.io/crm/v2/tenant/${tenantId}/customers/${appointment.customerId}`;
            
            console.log(`🔍 Fetching customer ${appointment.customerId} for appointment ${appointment.appointmentNumber}`);
            
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
                    customer.address.city,
                    customer.address.state,
                    customer.address.zip
                  ].filter(Boolean).join(', ') || 'Address not available'
                } : null
              };
              
              console.log(`✅ Got customer: ${customerData.name} for appointment ${appointment.appointmentNumber}`);
            } else {
              console.warn(`⚠️ Failed to fetch customer ${appointment.customerId}: ${customerResponse.status}`);
            }
          }
          
          // Small delay to be respectful to the API
          await new Promise(resolve => setTimeout(resolve, 100));
          
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
          assignedTechnicianIds: appointment.assignedTechnicianIds,
          
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
    
    console.log(`✅ FINAL: Returning ${sortedAppointments.length} appointments for technician ${technicianId}`);
    
    res.json({
      success: true,
      data: sortedAppointments,
      count: sortedAppointments.length,
      technicianId: parseInt(technicianId),
      debug: {
        totalFound: allAppointments.length,
        afterFiltering: verifiedAppointments.length,
        returned: sortedAppointments.length
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

// ✅ NEW: GET JOB ATTACHMENTS/DOCUMENTS (PDF Forms)
app.get('/api/job/:jobId/attachments', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    console.log(`📎 Fetching attachments for job: ${jobId}`);
    
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
    
    // ServiceTitan Job Attachments API endpoint
    const attachmentsUrl = `https://api-integration.servicetitan.io/jpm/v2/tenant/${tenantId}/jobs/${jobId}/attachments`;
    
    const response = await fetch(attachmentsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Job not found or no attachments
        return res.json({
          success: true,
          data: [],
          count: 0,
          message: 'No attachments found for this job'
        });
      }
      
      const errorText = await response.text();
      console.error(`❌ ServiceTitan Attachments API error: ${response.status} - ${errorText}`);
      throw new Error(`API error: ${response.statusText}`);
    }

    const attachmentsData = await response.json();
    const attachments = attachmentsData.data || [];
    
    // ✅ FILTER FOR PDF FILES ONLY
    const pdfAttachments = attachments.filter(attachment => {
      const fileName = attachment.fileName || attachment.name || '';
      return fileName.toLowerCase().endsWith('.pdf');
    });
    
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
        size: attachment.size || 0,
        createdOn: attachment.createdOn || new Date().toISOString(),
        downloadUrl: attachment.downloadUrl || null,
        serviceTitanId: attachment.id,
        jobId: jobId
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
      error: 'Server error fetching job attachments'
    });
  }
});

// ✅ NEW: GET SPECIFIC JOB DETAILS
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
          error: 'Job not found'
        });
      }
      
      const errorText = await response.text();
      console.error(`❌ ServiceTitan Job API error: ${response.status} - ${errorText}`);
      throw new Error(`API error: ${response.statusText}`);
    }

    const jobData = await response.json();
    
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
    
    console.log(`✅ Job details fetched: ${transformedJob.number}`);
    
    res.json({
      success: true,
      data: transformedJob
    });
    
  } catch (error) {
    console.error('❌ Error fetching job details:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching job details'
    });
  }
});

// ✅ QUICK DEBUG: Check what appointments we're actually getting
app.get('/debug/quick-check/:technicianId', async (req, res) => {
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
    
    // Same query as main endpoint but for past week to next month
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    oneWeekAgo.setHours(0, 0, 0, 0);
    
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setDate(oneMonthFromNow.getDate() + 30);
    oneMonthFromNow.setHours(23, 59, 59, 999);
    
    const queryParams = new URLSearchParams({
      pageSize: '100',
      technicianIds: technicianId,
      startsOnOrAfter: oneWeekAgo.toISOString(),
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
      return res.status(500).json({ success: false, error: 'API call failed' });
    }

    const data = await response.json();
    const appointments = data.data || [];
    
    // Quick analysis
    const statusCounts = {};
    appointments.forEach(appointment => {
      const status = appointment.status?.name || appointment.status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    const targetAppointments = appointments.filter(appointment => {
      const status = appointment.status?.name || appointment.status;
      return SERVER_CONFIG.targetAppointmentStatuses.includes(status);
    });
    
    res.json({
      success: true,
      message: 'Quick appointment check',
      query: {
        technicianId,
        dateFrom: oneWeekAgo.toISOString(),
        dateTo: oneMonthFromNow.toISOString(),
        pageSize: 100
      },
      results: {
        totalAppointments: appointments.length,
        statusBreakdown: statusCounts,
        targetStatuses: SERVER_CONFIG.targetAppointmentStatuses,
        targetAppointmentsFound: targetAppointments.length,
        targetAppointmentDetails: targetAppointments.map(a => ({ 
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
  console.log('🚀 TitanPDF Technician Portal');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${SERVER_CONFIG.serviceTitan.isIntegration ? 'Integration' : 'Production'}`);
  console.log(`🏢 Company: ${SERVER_CONFIG.company.name}`);
  console.log(`🎯 Target Appointment Statuses: ${SERVER_CONFIG.targetAppointmentStatuses.join(', ')}`);
  console.log('');
  console.log('📋 Endpoints:');
  console.log('   GET  /health');
  console.log('   POST /api/technician/validate');
  console.log('   GET  /api/technician/:id/appointments');
  console.log('   GET  /api/job/:jobId');
  console.log('   GET  /api/job/:jobId/attachments');
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 TitanPDF Technician Portal terminated');
  process.exit(0);
});