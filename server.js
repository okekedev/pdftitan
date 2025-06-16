// server.js - Complete TitanPDF Technician Portal with Pagination
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
  
  // ✅ THE 4 TARGET JOB STATUSES (Exact names from ServiceTitan API)
  targetJobStatuses: ['Dispatched', 'InProgress', 'Working', 'OnHold'],
  
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
    targetStatuses: SERVER_CONFIG.targetJobStatuses
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

// ✅ GET ALL JOBS FOR TECHNICIAN WITH PAGINATION
app.get('/api/technician/:technicianId/jobs', async (req, res) => {
  try {
    const { technicianId } = req.params;
    
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
    
    // Date range: Past month
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    oneMonthAgo.setHours(0, 0, 0, 0);
    
    // ✅ PAGINATION: Get all jobs in batches of 500
    let allJobs = [];
    let page = 1;
    let hasMorePages = true;
    const pageSize = 500;
    
    while (hasMorePages) {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        technicianIds: technicianId,
        createdOnOrAfter: oneMonthAgo.toISOString(),
        modifiedOnOrAfter: oneMonthAgo.toISOString()
      });
      
      const jobsUrl = `https://api-integration.servicetitan.io/jpm/v2/tenant/${tenantId}/jobs?${queryParams}`;
      
      try {
        const jobsResponse = await fetch(jobsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'ST-App-Key': appKey,
            'Content-Type': 'application/json'
          }
        });

        if (!jobsResponse.ok) {
          const errorText = await jobsResponse.text();
          console.error(`❌ ServiceTitan Jobs API error on page ${page}: ${jobsResponse.status} - ${errorText}`);
          throw new Error(`API error: ${jobsResponse.statusText}`);
        }

        const jobsData = await jobsResponse.json();
        const pageJobs = jobsData.data || [];
        
        // Add jobs to our collection
        allJobs = allJobs.concat(pageJobs);
        
        // Check if we have more pages
        const hasMore = jobsData.hasMore || (pageJobs.length === pageSize);
        
        if (!hasMore || pageJobs.length === 0) {
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
    
    // ✅ FILTER FOR TARGET STATUSES
    const activeJobs = allJobs.filter(job => {
      return SERVER_CONFIG.targetJobStatuses.includes(job.jobStatus);
    });
    
    // ✅ TRANSFORM JOBS
    const transformedJobs = activeJobs.map(job => {
      let title = job.summary || 'Service Call';
      title = title.replace(/<[^>]*>/g, ' ')
                   .replace(/&[^;]+;/g, ' ')
                   .replace(/\s+/g, ' ')
                   .trim();
      
      if (title.length > 100) {
        title = title.substring(0, 100) + '...';
      }
      
      if (!title || title.length < 3) {
        title = 'Service Call';
      }
      
      return {
        id: job.id,
        number: job.jobNumber,
        title: title,
        status: job.jobStatus,
        customer: {
          id: job.customerId,
          name: `Customer #${job.customerId}`
        },
        location: {
          id: job.locationId,
          name: `Location #${job.locationId}`
        },
        scheduledDate: job.createdOn,
        businessUnit: job.businessUnitId ? `Business Unit #${job.businessUnitId}` : 'General'
      };
    }).sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate));
    
    res.json({
      success: true,
      data: transformedJobs,
      count: transformedJobs.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching technician jobs:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching technician jobs'
    });
  }
});

// ✅ QUICK DEBUG: Check what jobs we're actually getting
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
    
    // Same query as main endpoint but for 30 days
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    oneMonthAgo.setHours(0, 0, 0, 0);
    
    const queryParams = new URLSearchParams({
      pageSize: '100',
      technicianIds: technicianId,
      createdOnOrAfter: oneMonthAgo.toISOString(),
      modifiedOnOrAfter: oneMonthAgo.toISOString()
    });
    
    const url = `https://api-integration.servicetitan.io/jpm/v2/tenant/${tenantId}/jobs?${queryParams}`;
    
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
    const jobs = data.data || [];
    
    // Quick analysis
    const statusCounts = {};
    jobs.forEach(job => {
      const status = job.jobStatus || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    const targetJobs = jobs.filter(job => 
      SERVER_CONFIG.targetJobStatuses.includes(job.jobStatus)
    );
    
    res.json({
      success: true,
      message: 'Quick job check',
      query: {
        technicianId,
        dateFrom: oneMonthAgo.toISOString(),
        pageSize: 100
      },
      results: {
        totalJobs: jobs.length,
        statusBreakdown: statusCounts,
        targetStatuses: SERVER_CONFIG.targetJobStatuses,
        targetJobsFound: targetJobs.length,
        targetJobIds: targetJobs.map(j => ({ id: j.id, number: j.jobNumber, status: j.jobStatus }))
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
  console.log(`🎯 Target Job Statuses: ${SERVER_CONFIG.targetJobStatuses.join(', ')}`);
  console.log('');
  console.log('📋 Endpoints:');
  console.log('   GET  /health');
  console.log('   POST /api/technician/validate');
  console.log('   GET  /api/technician/:id/jobs');
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 TitanPDF Technician Portal terminated');
  process.exit(0);
});