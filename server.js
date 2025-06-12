// server.js - Simplified TitanPDF Server for Technician-Only Portal
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
    company: SERVER_CONFIG.company.name
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

// Technician Validation Endpoint
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
    
    // Return successful validation
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

// Get Jobs for Specific Technician
app.get('/api/technician/:technicianId/jobs', async (req, res) => {
  try {
    const { technicianId } = req.params;
    
    console.log(`👷 Fetching jobs for technician ${technicianId}...`);
    
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
    
    // Build query to get technician's jobs
    const queryParams = new URLSearchParams({
      pageSize: '200',
      technicianIds: technicianId
    });
    
    // Get jobs from last 60 days to ensure we get active jobs
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    queryParams.set('modifiedOnOrAfter', sixtyDaysAgo);
    
    const url = `https://api-integration.servicetitan.io/jpm/v2/tenant/${tenantId}/jobs?${queryParams}`;
    
    console.log('👷 Making ServiceTitan API call:', url);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ServiceTitan Jobs API error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({
        success: false,
        error: `ServiceTitan API error: ${response.statusText}`
      });
    }

    const data = await response.json();
    console.log(`✅ Raw jobs fetched: ${data.data?.length || 0} jobs`);
    
    // Filter out completed jobs
    const completedStatuses = ['completed', 'done', 'finished', 'closed'];
    const activeJobs = data.data?.filter(job => {
      const status = (job.status || '').toLowerCase();
      return !completedStatuses.includes(status);
    }) || [];
    
    console.log(`✅ Active jobs for technician: ${activeJobs.length} jobs`);
    
    // Transform jobs data for frontend
    const transformedJobs = activeJobs.map(job => ({
      id: job.id,
      number: job.number,
      summary: job.summary || 'No description',
      customer: {
        id: job.customer?.id,
        name: job.customer?.name || 'Unknown Customer'
      },
      location: {
        id: job.location?.id,
        name: job.location?.name || job.location?.address || 'Unknown Location',
        address: job.location?.address
      },
      status: job.status || 'Unknown',
      priority: job.priority || 'Normal',
      jobType: job.jobType?.name || 'General',
      businessUnit: job.businessUnit?.name || 'General',
      scheduledDate: job.scheduledDate,
      startDate: job.startDate,
      endDate: job.endDate,
      assignedTechnicians: job.appointments?.[0]?.assignedTechnicians?.map(tech => ({
        id: tech.id,
        name: tech.name
      })) || [],
      totalAmount: job.total || 0,
      createdOn: job.createdOn,
      modifiedOn: job.modifiedOn
    }));
    
    res.json({
      success: true,
      data: transformedJobs,
      count: transformedJobs.length
    });
    
  } catch (error) {
    console.error('❌ Server-side technician jobs error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching technician jobs'
    });
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
  
  // Find technician by username
  const usernameMatch = username.toLowerCase();
  const matchedTechnician = technicians.find(tech => {
    const loginName = tech.loginName || tech.username || '';
    return loginName.toLowerCase() === usernameMatch;
  });
  
  if (!matchedTechnician) return null;
  
  return {
    id: matchedTechnician.id,
    userId: matchedTechnician.userId || matchedTechnician.id,
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

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'POST /api/technician/validate', 
      'GET /api/technician/:technicianId/jobs'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 TitanPDF Technician Portal Started');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${SERVER_CONFIG.serviceTitan.isIntegration ? 'Integration' : 'Production'}`);
  console.log(`🏢 Company: ${SERVER_CONFIG.company.name}`);
  
  console.log('');
  console.log('🔧 ServiceTitan Configuration:');
  console.log(`   Client ID: ${SERVER_CONFIG.serviceTitan.clientId ? 'Present' : '❌ MISSING'}`);
  console.log(`   Client Secret: ${SERVER_CONFIG.serviceTitan.clientSecret ? 'Present' : '❌ MISSING'}`);
  console.log(`   App Key: ${SERVER_CONFIG.serviceTitan.appKey ? 'Present' : '❌ MISSING'}`);
  console.log(`   Tenant ID: ${SERVER_CONFIG.serviceTitan.tenantId || '❌ MISSING'}`);
  
  console.log('');
  console.log('🔧 Portal Access:');
  console.log('   👤 TECHNICIANS: Log in with ServiceTitan username + phone');
  console.log('   📋 JOBS: Technicians see only their assigned jobs');
  console.log('   📄 FORMS: Access PDF forms for each job');
  
  console.log('');
  console.log('📋 Available Endpoints:');
  console.log('   GET  /health - Server health check');
  console.log('   POST /api/technician/validate - Technician authentication');
  console.log('   GET  /api/technician/:id/jobs - Get jobs for specific technician');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down TitanPDF Technician Portal...');
  process.exit(0);
});