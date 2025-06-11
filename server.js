// server.js - Authentication Server with Real ServiceTitan Integration
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PROXY_PORT || 3005;

// Inline server configuration
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
    name: 'E & J Products LLC'
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
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    message: 'TitanPDF Auth Server',
    environment: SERVER_CONFIG.serviceTitan.isIntegration ? 'Integration' : 'Production',
    features: [
      'User Authentication (username/phone)', 
      'Admin Super Access',
      'ServiceTitan OAuth Proxy',
      'Real ServiceTitan API Integration'
    ],
    config: {
      tenantId: SERVER_CONFIG.serviceTitan.tenantId,
      company: SERVER_CONFIG.company.name,
      authConfigured: !!SERVER_CONFIG.auth.adminSuperPassword
    }
  });
});

// ServiceTitan Authentication Helper
async function authenticateServiceTitan() {
  try {
    console.log('🔐 Authenticating with ServiceTitan...');
    
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
      console.error('❌ ServiceTitan auth failed:', tokenData);
      return { 
        success: false, 
        error: tokenData.error_description || 'ServiceTitan authentication failed',
        status: response.status 
      };
    }

    console.log('✅ ServiceTitan authentication successful');
    console.log('🔍 Token details:', {
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      scope: tokenData.scope // This shows what permissions we actually have
    });
    
    return { 
      success: true, 
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in || 900,
      tokenType: tokenData.token_type,
      scope: tokenData.scope
    };
    
  } catch (error) {
    console.error('❌ ServiceTitan authentication error:', error);
    return { 
      success: false, 
      error: 'Network error during ServiceTitan authentication',
      details: error.message 
    };
  }
}

// User Validation Endpoint - Real ServiceTitan API Integration
app.post('/api/user/validate', async (req, res) => {
  try {
    const { name, phone } = req.body;
    
    // Input validation
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Both name and phone number are required',
        layer: 'validation'
      });
    }
    
    console.log('👤 Validating user via ServiceTitan APIs:', name);
    
    // Get ServiceTitan token first
    const tokenResult = await authenticateServiceTitan();
    if (!tokenResult.success) {
      return res.status(500).json({
        success: false,
        error: tokenResult.error,
        layer: 'servicetitan',
        details: tokenResult.details
      });
    }
    
    const accessToken = tokenResult.accessToken;
    
    // Search both employees and technicians in parallel
    console.log('🔍 Searching ServiceTitan employees and technicians...');
    
    // Try both searches, but handle errors individually
    const [employeesResult, techniciansResult] = await Promise.allSettled([
      searchEmployees(name, accessToken, SERVER_CONFIG.serviceTitan.tenantId, SERVER_CONFIG.serviceTitan.appKey),
      searchTechnicians(name, accessToken, SERVER_CONFIG.serviceTitan.tenantId, SERVER_CONFIG.serviceTitan.appKey)
    ]);
    
    // Extract successful results
    const employees = employeesResult.status === 'fulfilled' ? employeesResult.value : [];
    const technicians = techniciansResult.status === 'fulfilled' ? techniciansResult.value : [];
    
    // Log any errors but don't fail completely
    if (employeesResult.status === 'rejected') {
      console.warn('⚠️ Employee search failed:', employeesResult.reason.message);
    }
    if (techniciansResult.status === 'rejected') {
      console.warn('⚠️ Technician search failed:', techniciansResult.reason.message);
    }
    
    console.log('📊 Search results:', {
      employees: employees.length,
      technicians: technicians.length
    });
    
    // Combine and deduplicate results
    const allUsers = [...employees, ...technicians];
    const uniqueUsers = deduplicateUsers(allUsers);
    
    console.log('👥 Total unique users found:', uniqueUsers.length);
    
    if (uniqueUsers.length === 0) {
      // Check if we had permission errors
      const hadPermissionErrors = 
        (employeesResult.status === 'rejected' && employeesResult.reason.message.includes('403')) ||
        (techniciansResult.status === 'rejected' && techniciansResult.reason.message.includes('403'));
        
      if (hadPermissionErrors) {
        return res.status(403).json({
          success: false,
          error: 'Missing required ServiceTitan API permissions',
          layer: 'permissions',
          details: 'Your ServiceTitan app needs the following scopes: settings:employees:read, settings:technicians:read',
          instructions: [
            '1. Go to ServiceTitan Developer Portal (https://developer.servicetitan.io/)',
            '2. Login to My Apps and edit your application',
            '3. Add required scopes: settings:employees:read, settings:technicians:read',
            '4. Save the app (creates new version)',
            '5. Have your ServiceTitan admin approve the new version'
          ],
          searchResults: {
            employees: employeesResult.status === 'fulfilled' ? 'Success' : 'Permission denied',
            technicians: techniciansResult.status === 'fulfilled' ? 'Success' : 'Permission denied'
          }
        });
      }
      
      return res.status(404).json({
        success: false,
        error: `No user found matching "${name}"`,
        layer: 'validation',
        searchedIn: ['employees', 'technicians'],
        suggestion: 'Try using your full name or username',
        searchResults: {
          employees: employees.length,
          technicians: technicians.length
        }
      });
    }
    
    // Validate phone number match
    const validatedUser = validatePhoneMatch(uniqueUsers, phone, name);
    
    if (!validatedUser) {
      return res.status(401).json({
        success: false,
        error: 'Phone number does not match our records for this user',
        layer: 'validation',
        foundUsers: uniqueUsers.length,
        matchedUsers: uniqueUsers.map(u => ({ name: u.name, loginName: u.loginName })),
        hint: 'Check the phone number format and try again'
      });
    }
    
    console.log('✅ User validation successful:', {
      name: validatedUser.name,
      type: validatedUser.userType,
      role: validatedUser.role
    });
    
    // Return successful validation with user data
    res.json({
      success: true,
      user: validatedUser,
      company: {
        name: SERVER_CONFIG.company.name,
        tenantId: SERVER_CONFIG.serviceTitan.tenantId,
        appKey: SERVER_CONFIG.serviceTitan.appKey
      },
      accessToken: accessToken,
      expiresIn: tokenResult.expiresIn,
      environment: SERVER_CONFIG.serviceTitan.isIntegration ? 'Integration' : 'Production',
      searchResults: {
        totalFound: uniqueUsers.length,
        searchedIn: ['employees', 'technicians']
      }
    });
    
  } catch (error) {
    console.error('❌ User validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during user validation',
      layer: 'server',
      details: error.message
    });
  }
});

// Admin Super Access Validation
app.post('/api/admin/validate-super-access', async (req, res) => {
  try {
    const { adminPassword, userRole } = req.body;
    
    console.log('🔑 Admin super access validation for role:', userRole);
    
    // Check if user has admin role
    if (!SERVER_CONFIG.isAdminRole(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'User does not have admin privileges',
        layer: 'authorization',
        userRole: userRole,
        requiredRoles: SERVER_CONFIG.adminRoles
      });
    }
    
    // Validate admin super password
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
    
    console.log('✅ Admin super access granted for role:', userRole);
    
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
      expiresIn: 8 * 60 * 60 * 1000 // 8 hours
    });
    
  } catch (error) {
    console.error('❌ Admin super access validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during admin validation',
      layer: 'server',
      details: error.message
    });
  }
});

// Test API permissions endpoint
app.get('/api/test-permissions', async (req, res) => {
  try {
    console.log('🧪 Testing ServiceTitan API permissions...');
    
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
    const fetch = (await import('node-fetch')).default;
    
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'ST-App-Key': SERVER_CONFIG.serviceTitan.appKey,
      'Content-Type': 'application/json'
    };
    
    const results = {};
    
    // Test different API endpoints
    const endpoints = [
      {
        name: 'employees',
        url: `https://api-integration.servicetitan.io/settings/v2/tenant/${SERVER_CONFIG.serviceTitan.tenantId}/employees?pageSize=1`
      },
      {
        name: 'technicians', 
        url: `https://api-integration.servicetitan.io/settings/v2/tenant/${SERVER_CONFIG.serviceTitan.tenantId}/technicians?pageSize=1`
      },
      {
        name: 'business-units',
        url: `https://api-integration.servicetitan.io/settings/v2/tenant/${SERVER_CONFIG.serviceTitan.tenantId}/business-units`
      },
      {
        name: 'user-roles',
        url: `https://api-integration.servicetitan.io/settings/v2/tenant/${SERVER_CONFIG.serviceTitan.tenantId}/user-roles`
      },
      {
        name: 'tag-types',
        url: `https://api-integration.servicetitan.io/settings/v2/tenant/${SERVER_CONFIG.serviceTitan.tenantId}/tag-types`
      }
    ];
    
    // Test each endpoint
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Testing: ${endpoint.name}`);
        const response = await fetch(endpoint.url, { headers });
        
        if (response.ok) {
          const data = await response.json();
          results[endpoint.name] = {
            status: 'SUCCESS',
            statusCode: response.status,
            dataCount: data.data ? data.data.length : 'N/A'
          };
          console.log(`✅ ${endpoint.name}: SUCCESS (${data.data ? data.data.length : 0} items)`);
        } else {
          const errorText = await response.text();
          results[endpoint.name] = {
            status: 'FAILED',
            statusCode: response.status,
            error: errorText
          };
          console.log(`❌ ${endpoint.name}: FAILED (${response.status})`);
        }
      } catch (error) {
        results[endpoint.name] = {
          status: 'ERROR',
          error: error.message
        };
        console.log(`💥 ${endpoint.name}: ERROR (${error.message})`);
      }
    }
    
    // Return comprehensive results
    res.json({
      success: true,
      tokenScope: tokenResult.scope,
      environment: SERVER_CONFIG.serviceTitan.isIntegration ? 'Integration' : 'Production',
      tenantId: SERVER_CONFIG.serviceTitan.tenantId,
      results: results,
      summary: {
        total: endpoints.length,
        successful: Object.values(results).filter(r => r.status === 'SUCCESS').length,
        failed: Object.values(results).filter(r => r.status === 'FAILED').length,
        errors: Object.values(results).filter(r => r.status === 'ERROR').length
      }
    });
    
  } catch (error) {
    console.error('❌ Permission test error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during permission testing',
      details: error.message
    });
  }
});

// Legacy ServiceTitan OAuth Proxy (for backward compatibility)
app.post('/api/servicetitan/auth', async (req, res) => {
  try {
    console.log('🔐 Legacy OAuth proxy request...');
    
    const authResult = await authenticateServiceTitan();
    
    if (authResult.success) {
      console.log('✅ Legacy OAuth proxy successful');
      res.json({
        access_token: authResult.accessToken,
        expires_in: authResult.expiresIn,
        token_type: authResult.tokenType,
        scope: authResult.scope
      });
    } else {
      console.error('❌ Legacy OAuth proxy failed:', authResult.error);
      res.status(authResult.status || 500).json({
        error: authResult.error,
        error_description: authResult.details
      });
    }
    
  } catch (error) {
    console.error('❌ Legacy OAuth proxy error:', error);
    res.status(500).json({ 
      error: 'proxy_server_error', 
      error_description: error.message 
    });
  }
});

// ServiceTitan API Helper Functions with Enhanced Debug Logging

async function searchEmployees(name, accessToken, tenantId, appKey) {
  try {
    console.log('👥 Searching employees in ServiceTitan...');
    console.log('🔍 Debug - Request details:', {
      tenantId,
      appKey: appKey ? `${appKey.substring(0, 10)}...` : 'MISSING',
      accessToken: accessToken ? `${accessToken.substring(0, 20)}...` : 'MISSING'
    });
    
    const fetch = (await import('node-fetch')).default;
    
    // Step 1: Get list of all active employees
    const listUrl = `https://api-integration.servicetitan.io/settings/v2/tenant/${tenantId}/employees?active=True&pageSize=200`;
    console.log('📡 Making request to:', listUrl);
    
    const requestHeaders = {
      'Authorization': `Bearer ${accessToken}`,
      'ST-App-Key': appKey,
      'Content-Type': 'application/json'
    };
    
    console.log('📋 Request headers:', {
      'Authorization': `Bearer ${accessToken.substring(0, 20)}...`,
      'ST-App-Key': appKey,
      'Content-Type': 'application/json'
    });
    
    const listResponse = await fetch(listUrl, {
      headers: requestHeaders
    });

    console.log('📡 Response status:', listResponse.status);

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error('❌ Employee list API failed:', listResponse.status, errorText);
      
      // Parse the error response to understand what's wrong
      try {
        const errorJson = JSON.parse(errorText);
        console.error('📋 Parsed error:', errorJson);
        
        // Check if it's a scope/permission error
        if (errorJson.title && errorJson.title.includes('Scope validation failed')) {
          console.error('🔒 PERMISSION ERROR: Missing API scope for employees');
          console.error('💡 Your app needs: settings:employees:read scope');
        }
      } catch (e) {
        console.error('📋 Raw error text:', errorText);
      }
      
      throw new Error(`Employee list API failed: ${listResponse.status} - ${errorText}`);
    }

    const listData = await listResponse.json();
    const employees = listData.data || [];
    
    console.log(`📋 Found ${employees.length} total employees`);
    
    // Step 2: Filter employees by name match
    const nameMatch = name.toLowerCase();
    const matchedEmployees = employees.filter(emp => {
      if (!emp.name) return false;
      const empName = emp.name.toLowerCase();
      return empName.includes(nameMatch) || nameMatch.includes(empName);
    });
    
    console.log(`🎯 Found ${matchedEmployees.length} employees matching "${name}"`);
    
    if (matchedEmployees.length === 0) {
      return [];
    }
    
    // Step 3: Get detailed information for each matched employee (simplified for now)
    console.log('📝 Using basic employee information (details API may need additional scope)');
    
    const employeeDetails = matchedEmployees.slice(0, 10).map(emp => ({
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
    
    console.log(`📊 Successfully processed ${employeeDetails.length} employees`);
    return employeeDetails;
    
  } catch (error) {
    console.error('❌ Employee search error:', error);
    throw error;
  }
}

async function searchTechnicians(name, accessToken, tenantId, appKey) {
  try {
    console.log('🔧 Searching technicians in ServiceTitan...');
    
    const fetch = (await import('node-fetch')).default;
    
    // Step 1: Get list of all active technicians
    const listUrl = `https://api-integration.servicetitan.io/settings/v2/tenant/${tenantId}/technicians?active=True&pageSize=200`;
    console.log('📡 Making request to:', listUrl);
    
    const requestHeaders = {
      'Authorization': `Bearer ${accessToken}`,
      'ST-App-Key': appKey,
      'Content-Type': 'application/json'
    };
    
    const listResponse = await fetch(listUrl, {
      headers: requestHeaders
    });

    console.log('📡 Response status:', listResponse.status);

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error('❌ Technician list API failed:', listResponse.status, errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        console.error('📋 Parsed error:', errorJson);
        
        if (errorJson.title && errorJson.title.includes('Scope validation failed')) {
          console.error('🔒 PERMISSION ERROR: Missing API scope for technicians');
          console.error('💡 Your app needs: settings:technicians:read scope');
        }
      } catch (e) {
        console.error('📋 Raw error text:', errorText);
      }
      
      throw new Error(`Technician list API failed: ${listResponse.status} - ${errorText}`);
    }

    const listData = await listResponse.json();
    const technicians = listData.data || [];
    
    console.log(`🔧 Found ${technicians.length} total technicians`);
    
    // Step 2: Filter technicians by name match
    const nameMatch = name.toLowerCase();
    const matchedTechnicians = technicians.filter(tech => {
      if (!tech.name) return false;
      const techName = tech.name.toLowerCase();
      return techName.includes(nameMatch) || nameMatch.includes(techName);
    });
    
    console.log(`🎯 Found ${matchedTechnicians.length} technicians matching "${name}"`);
    
    if (matchedTechnicians.length === 0) {
      return [];
    }
    
    // Step 3: Use basic technician information
    const technicianDetails = matchedTechnicians.slice(0, 10).map(tech => ({
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
    
    console.log(`📊 Successfully processed ${technicianDetails.length} technicians`);
    return technicianDetails;
    
  } catch (error) {
    console.error('❌ Technician search error:', error);
    throw error;
  }
}

// Helper function to remove duplicates
function deduplicateUsers(users) {
  const seen = new Set();
  return users.filter(user => {
    const key = user.userId || `${user.name}_${user.email}`;
    if (seen.has(key)) {
      console.log(`🔄 Removing duplicate user: ${user.name}`);
      return false;
    }
    seen.add(key);
    return true;
  });
}

// Enhanced phone validation function
function validatePhoneMatch(users, inputPhone, inputName) {
  const normalizedInputPhone = normalizePhone(inputPhone);
  
  console.log('📞 Validating phone match:', {
    inputPhone,
    normalizedInput: normalizedInputPhone,
    candidateCount: users.length
  });
  
  for (const user of users) {
    const normalizedUserPhone = normalizePhone(user.phoneNumber || '');
    
    const isUserIdMatch = user.loginName && 
      user.loginName.toLowerCase() === inputName.toLowerCase();
    const isNameMatch = namesMatch(inputName, user.name);
    
    console.log('🔍 Checking user:', {
      userName: user.name,
      userLogin: user.loginName,
      userPhone: user.phoneNumber,
      normalizedUserPhone,
      isUserIdMatch,
      isNameMatch,
      phoneMatch: normalizedInputPhone === normalizedUserPhone
    });
    
    if ((isUserIdMatch || isNameMatch) && normalizedInputPhone === normalizedUserPhone) {
      console.log('✅ Phone validation successful for:', user.name);
      return user;
    }
  }
  
  console.log('❌ No phone match found');
  return null;
}

// Enhanced phone normalization
function normalizePhone(phone) {
  if (!phone) return '';
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length === 11 && digitsOnly.startsWith('1') 
    ? digitsOnly.substring(1) 
    : digitsOnly;
}

// Enhanced name matching
function namesMatch(inputName, userName) {
  if (!inputName || !userName) return false;
  
  const normalize = (name) => name.toLowerCase().trim().replace(/[^a-z\s]/g, '');
  const normalizedInput = normalize(inputName);
  const normalizedUser = normalize(userName);
  
  if (normalizedInput === normalizedUser) return true;
  if (normalizedUser.includes(normalizedInput) || normalizedInput.includes(normalizedUser)) {
    return true;
  }
  
  const inputParts = normalizedInput.split(' ').filter(p => p.length > 2);
  const userParts = normalizedUser.split(' ').filter(p => p.length > 2);
  
  for (const inputPart of inputParts) {
    for (const userPart of userParts) {
      if (inputPart === userPart || inputPart.includes(userPart) || userPart.includes(inputPart)) {
        return true;
      }
    }
  }
  
  return false;
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
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
      'POST /api/servicetitan/auth'
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
  console.log(`🎯 Tenant ID: ${SERVER_CONFIG.serviceTitan.tenantId}`);
  console.log('🔧 ServiceTitan Integration: REAL API CALLS ENABLED');
  console.log('');
  console.log('📋 Available Endpoints:');
  console.log('   GET  /health - Server health check');
  console.log('   POST /api/user/validate - User authentication via ServiceTitan APIs'); 
  console.log('   POST /api/admin/validate-super-access - Admin validation');
  console.log('   POST /api/servicetitan/auth - OAuth proxy');
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