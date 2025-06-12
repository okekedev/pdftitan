// server.js - TitanPDF Authentication Server with Role-Based Access
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PROXY_PORT || 3005;

// Server configuration
const SERVER_CONFIG = {
  port: process.env.PROXY_PORT || 3005,
  
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
  
  auth: {
    adminSuperPassword: process.env.ADMIN_SUPER_PASSWORD
  },
  
  company: {
    name: 'MrBackflow TX'
  },
  
  adminRoles: ['Admin', 'Owner', 'FieldManager', 'SalesManager', 'admin', 'owner', 'manager'],
  
  isAdminRole(role) {
    if (typeof role !== 'string') return false;
    return this.adminRoles.some(adminRole => 
      role.toLowerCase().includes(adminRole.toLowerCase())
    );
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
    message: 'TitanPDF Auth Server',
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
      expiresIn: tokenData.expires_in || 900,
      tokenType: tokenData.token_type,
      scope: tokenData.scope
    };
    
  } catch (error) {
    return { 
      success: false, 
      error: 'Network error during ServiceTitan authentication',
      details: error.message 
    };
  }
}

// User Validation Endpoint with Role-Based Access
app.post('/api/user/validate', async (req, res) => {
  try {
    const { name, phone } = req.body;
    
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Both username and phone number are required',
        layer: 'validation'
      });
    }
    
    console.log(`👤 Authenticating user: ${name}`);
    
    // Check server configuration before proceeding
    if (!SERVER_CONFIG.serviceTitan.tenantId) {
      console.error('❌ CRITICAL: Tenant ID not configured on server!');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: Tenant ID not set',
        layer: 'server_config'
      });
    }
    
    if (!SERVER_CONFIG.serviceTitan.appKey) {
      console.error('❌ CRITICAL: App Key not configured on server!');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: App Key not set',
        layer: 'server_config'
      });
    }
    
    // Get ServiceTitan token
    const tokenResult = await authenticateServiceTitan();
    if (!tokenResult.success) {
      return res.status(500).json({
        success: false,
        error: tokenResult.error,
        layer: 'servicetitan'
      });
    }
    
    const accessToken = tokenResult.accessToken;
    
    // Search employees and technicians by USERNAME only
    const [employeesResult, techniciansResult] = await Promise.allSettled([
      searchEmployeesByUsername(name, accessToken, SERVER_CONFIG.serviceTitan.tenantId, SERVER_CONFIG.serviceTitan.appKey),
      searchTechniciansByUsername(name, accessToken, SERVER_CONFIG.serviceTitan.tenantId, SERVER_CONFIG.serviceTitan.appKey)
    ]);
    
    const employees = employeesResult.status === 'fulfilled' ? employeesResult.value : [];
    const technicians = techniciansResult.status === 'fulfilled' ? techniciansResult.value : [];
    
    // Combine and deduplicate results
    const allUsers = [...employees, ...technicians];
    const uniqueUsers = deduplicateUsers(allUsers);
    
    console.log(`🔍 Found ${uniqueUsers.length} users matching username "${name}"`);
    
    if (uniqueUsers.length === 0) {
      const hadPermissionErrors = 
        (employeesResult.status === 'rejected' && employeesResult.reason.message.includes('403')) ||
        (techniciansResult.status === 'rejected' && techniciansResult.reason.message.includes('403'));
        
      if (hadPermissionErrors) {
        return res.status(403).json({
          success: false,
          error: 'Missing required ServiceTitan API permissions',
          layer: 'permissions'
        });
      }
      
      return res.status(404).json({
        success: false,
        error: `No user found with username "${name}"`,
        layer: 'validation'
      });
    }
    
    // Validate phone number match
    const validatedUser = validatePhoneMatch(uniqueUsers, phone);
    
    if (!validatedUser) {
      return res.status(401).json({
        success: false,
        error: 'Phone number does not match our records for this user',
        layer: 'validation',
        foundUsers: uniqueUsers.length
      });
    }
    
    // Determine user access level
    const userAccess = determineUserAccess(validatedUser);
    
    console.log(`🔑 User access determined:`, {
      username: validatedUser.loginName,
      userType: validatedUser.userType,
      role: validatedUser.role,
      accessLevel: userAccess.level,
      isAdmin: userAccess.isAdmin,
      isTechnician: userAccess.isTechnician
    });
    
    // Check if user is denied access
    if (userAccess.level === 'denied') {
      console.log(`❌ Access denied for: ${validatedUser.loginName} (${validatedUser.userType})`);
      return res.status(403).json({
        success: false,
        error: userAccess.message,
        layer: 'authorization',
        userType: validatedUser.userType,
        accessLevel: userAccess.level
      });
    }
    
    console.log(`✅ Authentication successful for: ${validatedUser.loginName} (${userAccess.level})`);
    
    // Ensure company object structure is correct
    const companyData = {
      name: SERVER_CONFIG.company.name,
      tenantId: SERVER_CONFIG.serviceTitan.tenantId,
      appKey: SERVER_CONFIG.serviceTitan.appKey
    };
    
    console.log('📤 Sending company data to frontend:', companyData);
    
    // Return successful validation with role-based access info
    res.json({
      success: true,
      user: validatedUser,
      access: userAccess,
      company: companyData,
      accessToken: accessToken,
      expiresIn: tokenResult.expiresIn,
      environment: SERVER_CONFIG.serviceTitan.isIntegration ? 'Integration' : 'Production'
    });
    
  } catch (error) {
    console.error('❌ User validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during user validation',
      layer: 'server'
    });
  }
});

// Admin Super Access Validation
app.post('/api/admin/validate-super-access', async (req, res) => {
  try {
    const { adminPassword, userRole } = req.body;
    
    if (!SERVER_CONFIG.isAdminRole(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'User does not have admin privileges',
        layer: 'authorization'
      });
    }
    
    if (!SERVER_CONFIG.auth.adminSuperPassword) {
      return res.status(500).json({
        success: false,
        error: 'Admin super access not configured on server',
        layer: 'config'
      });
    }
    
    if (adminPassword !== SERVER_CONFIG.auth.adminSuperPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid admin super access password',
        layer: 'admin_auth'
      });
    }
    
    res.json({
      success: true,
      layer: 'admin_super',
      permissions: {
        viewAllJobs: true,
        viewAllProjects: true,
        viewAllEmployees: true,
        viewAllCustomers: true,
        adminAccess: true,
        superAdminAccess: true
      },
      message: 'Admin super access granted',
      expiresIn: 8 * 60 * 60 * 1000
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error during admin validation',
      layer: 'server'
    });
  }
});

// ✅ CLEAN: Server-side projects endpoint
app.get('/api/projects', async (req, res) => {
  try {
    console.log('📋 Fetching projects server-side...');
    
    // Get fresh ServiceTitan token
    const tokenResult = await authenticateServiceTitan();
    if (!tokenResult.success) {
      return res.status(500).json({
        success: false,
        error: 'ServiceTitan authentication failed',
        layer: 'servicetitan'
      });
    }
    
    const fetch = (await import('node-fetch')).default;
    const tenantId = SERVER_CONFIG.serviceTitan.tenantId;
    const appKey = SERVER_CONFIG.serviceTitan.appKey;
    const accessToken = tokenResult.accessToken;
    
    // Build query parameters - get active projects only
    const queryParams = new URLSearchParams({
      pageSize: '100',
      active: 'true'
    });
    
    // ✅ REMOVED: Restrictive date filter - get all active projects
    const url = `https://api-integration.servicetitan.io/jpm/v2/tenant/${tenantId}/projects?${queryParams}`;
    
    console.log('📋 Making ServiceTitan API call:', url);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ServiceTitan Projects API error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({
        success: false,
        error: `ServiceTitan API error: ${response.statusText}`,
        layer: 'servicetitan'
      });
    }

    const data = await response.json();
    console.log(`✅ Projects fetched server-side: ${data.data?.length || 0} projects`);
    
    // Transform projects data for frontend
    const transformedProjects = data.data?.map(project => ({
      id: project.id,
      name: project.name || `Project ${project.number}`,
      number: project.number,
      customer: project.customer?.name || 'Unknown Customer',
      location: project.location?.address || 'Unknown Location', 
      status: project.status || 'Unknown',
      priority: project.priority || 'Normal',
      startDate: project.startDate,
      endDate: project.endDate,
      businessUnit: project.businessUnit?.name || 'General',
      totalJobs: project.jobCount || 0,
      summary: project.summary
    })) || [];
    
    res.json({
      success: true,
      data: transformedProjects,
      count: transformedProjects.length
    });
    
  } catch (error) {
    console.error('❌ Server-side projects error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching projects',
      layer: 'server'
    });
  }
});

// ✅ CLEAN: Server-side jobs endpoint - Get all non-completed jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const { projectId, technicianId } = req.query;
    
    console.log('👷 Fetching jobs server-side...', { projectId, technicianId });
    
    // Get fresh ServiceTitan token
    const tokenResult = await authenticateServiceTitan();
    if (!tokenResult.success) {
      return res.status(500).json({
        success: false,
        error: 'ServiceTitan authentication failed',
        layer: 'servicetitan'
      });
    }
    
    const fetch = (await import('node-fetch')).default;
    const tenantId = SERVER_CONFIG.serviceTitan.tenantId;
    const appKey = SERVER_CONFIG.serviceTitan.appKey;
    const accessToken = tokenResult.accessToken;
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      pageSize: '200' // Increased to get more jobs
    });
    
    if (projectId) {
      queryParams.set('projectId', projectId);
    }
    
    if (technicianId) {
      queryParams.set('technicianId', technicianId);
    }
    
    // ✅ FIXED: Remove restrictive date filters - get all jobs regardless of date
    // Only filter by modification date to get recently updated jobs
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    queryParams.set('modifiedOnOrAfter', thirtyDaysAgo);
    
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
        error: `ServiceTitan API error: ${response.statusText}`,
        layer: 'servicetitan'
      });
    }

    const data = await response.json();
    console.log(`✅ Raw jobs fetched: ${data.data?.length || 0} jobs`);
    
    // ✅ FIXED: Filter out completed jobs on the server side
    const completedStatuses = ['completed', 'done', 'finished', 'closed'];
    const activeJobs = data.data?.filter(job => {
      const status = (job.status || '').toLowerCase();
      return !completedStatuses.includes(status);
    }) || [];
    
    console.log(`✅ Active (non-completed) jobs: ${activeJobs.length} jobs`);
    
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
      project: job.project ? {
        id: job.project.id,
        name: job.project.name
      } : null,
      totalAmount: job.total || 0,
      hasEstimate: job.hasEstimate || false,
      hasInvoice: job.hasInvoice || false,
      tags: job.tags || [],
      createdOn: job.createdOn,
      modifiedOn: job.modifiedOn
    }));
    
    res.json({
      success: true,
      data: transformedJobs,
      count: transformedJobs.length
    });
    
  } catch (error) {
    console.error('❌ Server-side jobs error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching jobs',
      layer: 'server'
    });
  }
});

// ServiceTitan API Helper Functions
async function searchEmployeesByUsername(username, accessToken, tenantId, appKey) {
  const fetch = (await import('node-fetch')).default;
  
  const listUrl = `https://api-integration.servicetitan.io/settings/v2/tenant/${tenantId}/employees?active=True&pageSize=200`;
  
  const response = await fetch(listUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'ST-App-Key': appKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Employee list API failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const employees = data.data || [];
  
  // ONLY match against username/loginName
  const usernameMatch = username.toLowerCase();
  const matchedEmployees = employees.filter(emp => {
    const loginName = emp.loginName || emp.username || '';
    return loginName.toLowerCase() === usernameMatch;
  });
  
  return matchedEmployees.map(emp => ({
    id: emp.id,
    userId: emp.userId || emp.id,
    name: emp.name,
    email: emp.email,
    phoneNumber: emp.phoneNumber,
    role: emp.role || 'Employee',
    active: emp.active,
    userType: 'employee',
    loginName: emp.loginName || emp.username,
    businessUnitId: emp.businessUnitId
  }));
}

async function searchTechniciansByUsername(username, accessToken, tenantId, appKey) {
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
  
  // ONLY match against username/loginName
  const usernameMatch = username.toLowerCase();
  const matchedTechnicians = technicians.filter(tech => {
    const loginName = tech.loginName || tech.username || '';
    return loginName.toLowerCase() === usernameMatch;
  });
  
  return matchedTechnicians.map(tech => ({
    id: tech.id,
    userId: tech.userId || tech.id,
    name: tech.name,
    email: tech.email,
    phoneNumber: tech.phoneNumber,
    role: 'Technician',
    active: tech.active,
    userType: 'technician',
    loginName: tech.loginName || tech.username,
    businessUnitId: tech.businessUnitId
  }));
}

function deduplicateUsers(users) {
  const seen = new Set();
  return users.filter(user => {
    const key = user.userId || `${user.loginName}_${user.email}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function validatePhoneMatch(users, inputPhone) {
  const normalizedInputPhone = normalizePhone(inputPhone);
  
  for (const user of users) {
    const normalizedUserPhone = normalizePhone(user.phoneNumber || '');
    
    if (normalizedInputPhone === normalizedUserPhone) {
      return user;
    }
  }
  
  return null;
}

function normalizePhone(phone) {
  if (!phone) return '';
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length === 11 && digitsOnly.startsWith('1') 
    ? digitsOnly.substring(1) 
    : digitsOnly;
}

// Determine user access level
function determineUserAccess(user) {
  const username = user.loginName || '';
  const role = user.role || '';
  const userType = user.userType || '';
  
  console.log(`🔍 Determining access for:`, {
    username,
    role,
    userType
  });
  
  // Special admin users
  const adminUsernames = ['okekec21', 'mrbackflowllc', 'admin'];
  
  // Admin roles in ServiceTitan
  const adminRoles = ['Admin', 'Owner', 'Manager', 'Office Manager'];
  
  // Check if user is admin by username or role
  const isAdminByUsername = adminUsernames.some(adminUser => 
    username.toLowerCase() === adminUser.toLowerCase()
  );
  
  const isAdminByRole = adminRoles.some(adminRole => 
    role.toLowerCase().includes(adminRole.toLowerCase())
  );
  
  const isAdmin = isAdminByUsername || isAdminByRole;
  const isTechnician = userType === 'technician';
  
  console.log(`🎯 Access check:`, {
    isAdminByUsername,
    isAdminByRole,
    isAdmin,
    isTechnician
  });
  
  // Only allow admins and technicians to login
  if (!isAdmin && !isTechnician) {
    return {
      level: 'denied',
      isAdmin: false,
      isTechnician: false,
      permissions: {},
      nextScreen: 'denied',
      message: 'Access denied - Only administrators and technicians can use this application'
    };
  }
  
  let accessLevel;
  let permissions;
  let nextScreen;
  let message;
  
  if (isAdmin) {
    accessLevel = 'admin';
    permissions = {
      viewAllJobs: true,
      viewAllProjects: true,
      viewCompanyForms: true,
      manageUsers: true,
      accessAdminFeatures: true,
      needsCompanyCode: true
    };
    nextScreen = 'company_code';
    message = 'Admin access granted - enter company code to continue';
  } else if (isTechnician) {
    accessLevel = 'technician';
    permissions = {
      viewMyJobs: true,
      viewMyProjects: false,
      viewCompanyForms: false,
      manageUsers: false,
      accessAdminFeatures: false,
      needsCompanyCode: false
    };
    nextScreen = 'jobs';
    message = 'Technician access - redirecting to your jobs';
  }
  
  const result = {
    level: accessLevel,
    isAdmin: isAdmin,
    isTechnician: isTechnician,
    permissions: permissions,
    nextScreen: nextScreen,
    message: message
  };
  
  console.log(`✅ Access determined:`, result);
  
  return result;
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
      'POST /api/user/validate', 
      'POST /api/admin/validate-super-access',
      'GET /api/projects',
      'GET /api/jobs'
    ]
  });
});

// Start server with enhanced logging
app.listen(PORT, () => {
  console.log('🚀 TitanPDF Auth Server Started');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${SERVER_CONFIG.serviceTitan.isIntegration ? 'Integration' : 'Production'}`);
  console.log(`🏢 Company: ${SERVER_CONFIG.company.name}`);
  console.log(`🔑 Auth Configured: ${SERVER_CONFIG.auth.adminSuperPassword ? 'Yes' : 'No'}`);
  
  // Debug ServiceTitan configuration
  console.log('');
  console.log('🔧 ServiceTitan Configuration:');
  console.log(`   Client ID: ${SERVER_CONFIG.serviceTitan.clientId ? 'Present' : '❌ MISSING'}`);
  console.log(`   Client Secret: ${SERVER_CONFIG.serviceTitan.clientSecret ? 'Present' : '❌ MISSING'}`);
  console.log(`   App Key: ${SERVER_CONFIG.serviceTitan.appKey ? 'Present' : '❌ MISSING'}`);
  console.log(`   Tenant ID: ${SERVER_CONFIG.serviceTitan.tenantId || '❌ MISSING'}`);
  console.log(`   Auth URL: ${SERVER_CONFIG.serviceTitan.authUrl || '❌ MISSING'}`);
  console.log(`   API Base URL: ${SERVER_CONFIG.serviceTitan.apiBaseUrl || '❌ MISSING'}`);
  
  console.log('');
  console.log('🔐 Access Levels:');
  console.log('   👤 ADMIN: okekec21, mrbackflowllc → Company Code Screen');
  console.log('   🔧 TECHNICIAN: technician users → Jobs Screen');
  console.log('   ❌ DENIED: regular employees → Access Denied');
  console.log('');
  console.log('📋 Available Endpoints:');
  console.log('   GET  /health - Server health check');
  console.log('   POST /api/user/validate - Username + phone authentication');
  console.log('   POST /api/admin/validate-super-access - Admin validation');
  console.log('   GET  /api/projects - Get all active projects');
  console.log('   GET  /api/jobs - Get all non-completed jobs (no date restriction)');
  console.log('   GET  /api/jobs?projectId=123 - Get jobs for specific project');
  console.log('   GET  /api/jobs?technicianId=456 - Get jobs for specific technician');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down TitanPDF Auth Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 TitanPDF Auth Server terminated');
  process.exit(0);
});