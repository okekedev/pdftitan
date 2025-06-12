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
    
    // Return successful validation with role-based access info
    res.json({
      success: true,
      user: validatedUser,
      access: userAccess,
      company: {
        name: SERVER_CONFIG.company.name,
        tenantId: SERVER_CONFIG.serviceTitan.tenantId,
        appKey: SERVER_CONFIG.serviceTitan.appKey
      },
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

// ================== SERVICETITAN API PROXY ENDPOINTS ==================

// ServiceTitan Projects API Proxy
app.get('/api/servicetitan/projects', async (req, res) => {
  try {
    const { tenantId, ...queryParams } = req.query;
    const { authorization, 'st-app-key': appKey } = req.headers;
    
    if (!authorization || !appKey || !tenantId) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required headers or tenant ID',
        layer: 'validation'
      });
    }

    console.log(`📋 Fetching projects for tenant: ${tenantId}`);

    const fetch = (await import('node-fetch')).default;
    
    // Build ServiceTitan API URL for projects
    const url = `https://api-integration.servicetitan.io/jpm/v2/tenant/${tenantId}/projects?${new URLSearchParams(queryParams)}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': authorization,
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
    console.log(`✅ Projects fetched: ${data.data?.length || 0} projects`);
    
    res.json(data);
    
  } catch (error) {
    console.error('❌ Projects proxy error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching projects',
      layer: 'proxy'
    });
  }
});

// ServiceTitan Jobs API Proxy
app.get('/api/servicetitan/jobs', async (req, res) => {
  try {
    const { tenantId, ...queryParams } = req.query;
    const { authorization, 'st-app-key': appKey } = req.headers;
    
    if (!authorization || !appKey || !tenantId) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required headers or tenant ID',
        layer: 'validation'
      });
    }

    console.log(`👷 Fetching jobs for tenant: ${tenantId}`, queryParams);

    const fetch = (await import('node-fetch')).default;
    
    // Build ServiceTitan API URL for jobs
    const url = `https://api-integration.servicetitan.io/jpm/v2/tenant/${tenantId}/jobs?${new URLSearchParams(queryParams)}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': authorization,
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
    console.log(`✅ Jobs fetched: ${data.data?.length || 0} jobs`);
    
    res.json(data);
    
  } catch (error) {
    console.error('❌ Jobs proxy error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching jobs',
      layer: 'proxy'
    });
  }
});

// ServiceTitan Appointments API Proxy (for detailed job scheduling info)
app.get('/api/servicetitan/appointments', async (req, res) => {
  try {
    const { tenantId, ...queryParams } = req.query;
    const { authorization, 'st-app-key': appKey } = req.headers;
    
    if (!authorization || !appKey || !tenantId) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required headers or tenant ID',
        layer: 'validation'
      });
    }

    console.log(`📅 Fetching appointments for tenant: ${tenantId}`);

    const fetch = (await import('node-fetch')).default;
    
    // Build ServiceTitan API URL for appointments
    const url = `https://api-integration.servicetitan.io/jpm/v2/tenant/${tenantId}/appointments?${new URLSearchParams(queryParams)}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': authorization,
        'ST-App-Key': appKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ServiceTitan Appointments API error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({
        success: false,
        error: `ServiceTitan API error: ${response.statusText}`,
        layer: 'servicetitan'
      });
    }

    const data = await response.json();
    console.log(`✅ Appointments fetched: ${data.data?.length || 0} appointments`);
    
    res.json(data);
    
  } catch (error) {
    console.error('❌ Appointments proxy error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching appointments',
      layer: 'proxy'
    });
  }
});

// Test endpoint to validate ServiceTitan API connectivity
app.get('/api/servicetitan/test', async (req, res) => {
  try {
    const { tenantId } = req.query;
    const { authorization, 'st-app-key': appKey } = req.headers;
    
    if (!authorization || !appKey || !tenantId) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required headers or tenant ID for test',
        layer: 'validation'
      });
    }

    console.log(`🧪 Testing ServiceTitan API connectivity for tenant: ${tenantId}`);

    const fetch = (await import('node-fetch')).default;
    
    // Simple test call to business units (lightweight endpoint)
    const url = `https://api-integration.servicetitan.io/settings/v2/tenant/${tenantId}/business-units?pageSize=1`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': authorization,
        'ST-App-Key': appKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ServiceTitan API test failed: ${response.status} - ${errorText}`);
      return res.json({
        success: false,
        connected: false,
        error: `ServiceTitan API test failed: ${response.statusText}`,
        status: response.status
      });
    }

    const data = await response.json();
    console.log(`✅ ServiceTitan API test successful`);
    
    res.json({
      success: true,
      connected: true,
      message: 'ServiceTitan API connectivity verified',
      tenantId: tenantId,
      businessUnitsFound: data.data?.length || 0
    });
    
  } catch (error) {
    console.error('❌ ServiceTitan API test error:', error);
    res.json({ 
      success: false,
      connected: false,
      error: 'Network error testing ServiceTitan API connectivity'
    });
  }
});

// Legacy ServiceTitan OAuth Proxy
app.post('/api/servicetitan/auth', async (req, res) => {
  try {
    const authResult = await authenticateServiceTitan();
    
    if (authResult.success) {
      res.json({
        access_token: authResult.accessToken,
        expires_in: authResult.expiresIn,
        token_type: authResult.tokenType,
        scope: authResult.scope
      });
    } else {
      res.status(authResult.status || 500).json({
        error: authResult.error,
        error_description: authResult.details
      });
    }
    
  } catch (error) {
    res.status(500).json({ 
      error: 'proxy_server_error', 
      error_description: error.message 
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

// Determine user access level - THE KEY FUNCTION
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
      'POST /api/servicetitan/auth',
      'GET /api/servicetitan/projects',
      'GET /api/servicetitan/jobs',
      'GET /api/servicetitan/appointments',
      'GET /api/servicetitan/test'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 TitanPDF Auth Server Started');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${SERVER_CONFIG.serviceTitan.isIntegration ? 'Integration' : 'Production'}`);
  console.log(`🏢 Company: ${SERVER_CONFIG.company.name}`);
  console.log(`🔑 Auth Configured: ${SERVER_CONFIG.auth.adminSuperPassword ? 'Yes' : 'No'}`);
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
  console.log('   POST /api/servicetitan/auth - OAuth proxy');
  console.log('   GET  /api/servicetitan/projects - Fetch projects');
  console.log('   GET  /api/servicetitan/jobs - Fetch jobs');
  console.log('   GET  /api/servicetitan/appointments - Fetch appointments');
  console.log('   GET  /api/servicetitan/test - Test API connectivity');
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