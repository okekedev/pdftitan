// server.js - Three-Layer Authentication Server
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PROXY_PORT || 3005;

// Get passwords from environment variables
const COMPANY_ACCESS_PASSWORD = process.env.COMPANY_ACCESS_PASSWORD;
const ADMIN_SUPER_PASSWORD = process.env.ADMIN_SUPER_PASSWORD;

// Company configuration (using env password)
const COMPANY_CONFIG = {
  companyName: 'E & J Products LLC',
  tenantId: process.env.REACT_APP_SERVICETITAN_TENANT_ID,
  clientId: process.env.REACT_APP_SERVICETITAN_CLIENT_ID,
  clientSecret: process.env.REACT_APP_SERVICETITAN_CLIENT_SECRET,
  appKey: process.env.REACT_APP_SERVICETITAN_APP_KEY
};

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004'],
  credentials: true
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    message: 'Three-Layer Auth Server running',
    layers: ['Company Access', 'Employee/Technician Validation', 'Admin Super Access']
  });
});

// Layer 1: Company Authentication
app.post('/api/company/authenticate', async (req, res) => {
  try {
    const { companyCode } = req.body;
    
    console.log('🏢 Layer 1: Company authentication...');
    
    // Validate against environment variable
    if (companyCode !== COMPANY_ACCESS_PASSWORD) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid company access code',
        layer: 'company'
      });
    }
    
    console.log('✅ Company password validated from environment');
    
    // Authenticate with ServiceTitan using company config
    const fetch = (await import('node-fetch')).default;
    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('client_id', COMPANY_CONFIG.clientId);
    formData.append('client_secret', COMPANY_CONFIG.clientSecret);

    const response = await fetch(process.env.REACT_APP_SERVICETITAN_AUTH_URL, {
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
      return res.status(500).json({
        success: false,
        error: 'ServiceTitan authentication failed',
        layer: 'servicetitan'
      });
    }

    console.log('✅ Layer 1 successful:', COMPANY_CONFIG.companyName);
    
    res.json({
      success: true,
      layer: 'company',
      company: {
        name: COMPANY_CONFIG.companyName,
        tenantId: COMPANY_CONFIG.tenantId,
        appKey: COMPANY_CONFIG.appKey
      },
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in
    });
    
  } catch (error) {
    console.error('❌ Layer 1 error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error during company authentication',
      layer: 'server'
    });
  }
});

// Layer 2: Employee/Technician Validation
app.post('/api/user/validate', async (req, res) => {
  try {
    const { name, phone, accessToken, tenantId, appKey } = req.body;
    
    console.log('👤 Layer 2: Validating user:', name);
    
    const fetch = (await import('node-fetch')).default;
    
    // Search both Employees and Technicians APIs
    const [employeeResults, technicianResults] = await Promise.all([
      searchEmployees(name, accessToken, tenantId, appKey, fetch),
      searchTechnicians(name, accessToken, tenantId, appKey, fetch)
    ]);
    
    console.log('🔍 Search results:', {
      employees: employeeResults.length,
      technicians: technicianResults.length
    });
    
    // Combine and deduplicate results
    const allUsers = [...employeeResults, ...technicianResults];
    const uniqueUsers = deduplicateUsers(allUsers);
    
    console.log('📊 Total unique users found:', uniqueUsers.length);
    
    if (uniqueUsers.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found in ServiceTitan',
        layer: 'validation',
        searchedIn: ['employees', 'technicians']
      });
    }
    
    // Validate phone number match
    const validatedUser = validatePhoneMatch(uniqueUsers, phone, name);
    
    if (!validatedUser) {
      return res.status(401).json({
        success: false,
        error: 'Phone number does not match our records for this user',
        layer: 'validation',
        foundUsers: uniqueUsers.length
      });
    }
    
    console.log('✅ Layer 2 successful:', {
      name: validatedUser.name,
      type: validatedUser.userType,
      role: validatedUser.role
    });
    
    res.json({
      success: true,
      layer: 'user',
      user: validatedUser
    });
    
  } catch (error) {
    console.error('❌ Layer 2 error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during user validation',
      layer: 'server'
    });
  }
});

// Layer 3: Admin Super Access Validation
app.post('/api/admin/validate-super-access', async (req, res) => {
  try {
    const { adminPassword, userRole } = req.body;
    
    console.log('🔑 Layer 3: Admin super access validation...');
    
    // Check if user has admin role
    if (!isAdminRole(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'User does not have admin privileges',
        layer: 'authorization',
        userRole: userRole
      });
    }
    
    // Validate admin super password
    if (adminPassword !== ADMIN_SUPER_PASSWORD) {
      return res.status(401).json({
        success: false,
        error: 'Invalid admin super access password',
        layer: 'admin_auth'
      });
    }
    
    console.log('✅ Layer 3 successful: Admin super access granted');
    
    res.json({
      success: true,
      layer: 'admin_super',
      permissions: {
        viewAllJobs: true,
        viewAllProjects: true,
        viewAllEmployees: true,
        adminAccess: true
      },
      message: 'Admin super access granted'
    });
    
  } catch (error) {
    console.error('❌ Layer 3 error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during admin validation',
      layer: 'server'
    });
  }
});

// Helper Functions

async function searchEmployees(name, accessToken, tenantId, appKey, fetch) {
  try {
    const url = `https://api-integration.servicetitan.io/settings/v2/tenant/${tenantId}/employees?name=${encodeURIComponent(name)}&active=True&pageSize=100`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('❌ Employee API failed:', response.status);
      return [];
    }

    const data = await response.json();
    
    return (data.data || []).map(emp => ({
      id: emp.id,
      userId: emp.userId,
      name: emp.name,
      email: emp.email,
      phoneNumber: emp.phoneNumber,
      role: emp.role?.value || emp.role || 'Employee',
      roleIds: emp.roleIds || [],
      active: emp.active,
      userType: 'employee',
      loginName: emp.loginName,
      businessUnitId: emp.businessUnitId,
      permissions: emp.permissions || [],
      accountLocked: emp.accountLocked
    }));
    
  } catch (error) {
    console.error('❌ Employee search error:', error);
    return [];
  }
}

async function searchTechnicians(name, accessToken, tenantId, appKey, fetch) {
  try {
    const url = `https://api-integration.servicetitan.io/settings/v2/tenant/${tenantId}/technicians?name=${encodeURIComponent(name)}&active=True&pageSize=100`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ST-App-Key': appKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('❌ Technician API failed:', response.status);
      return [];
    }

    const data = await response.json();
    
    return (data.data || []).map(tech => ({
      id: tech.id,
      userId: tech.userId,
      name: tech.name,
      email: tech.email,
      phoneNumber: tech.phoneNumber,
      role: 'Technician',
      roleIds: tech.roleIds || [],
      active: tech.active,
      userType: 'technician',
      loginName: tech.loginName,
      businessUnitId: tech.businessUnitId,
      permissions: tech.permissions || [],
      accountLocked: tech.accountLocked,
      // Technician-specific fields
      mainZoneId: tech.mainZoneId,
      zoneIds: tech.zoneIds,
      dailyGoal: tech.dailyGoal,
      isManagedTech: tech.isManagedTech,
      team: tech.team
    }));
    
  } catch (error) {
    console.error('❌ Technician search error:', error);
    return [];
  }
}

function deduplicateUsers(users) {
  const seen = new Set();
  return users.filter(user => {
    // Use userId as unique identifier (both APIs have this)
    const key = user.userId;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function validatePhoneMatch(users, inputPhone, inputName) {
  const normalizedInputPhone = normalizePhone(inputPhone);
  
  for (const user of users) {
    const normalizedUserPhone = normalizePhone(user.phoneNumber || '');
    
    // Check name similarity and exact phone match
    if (namesMatch(inputName, user.name) && normalizedInputPhone === normalizedUserPhone) {
      return user;
    }
  }
  
  return null;
}

function normalizePhone(phone) {
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length === 11 && digitsOnly.startsWith('1') 
    ? digitsOnly.substring(1) 
    : digitsOnly;
}

function namesMatch(inputName, userName) {
  const normalize = (name) => name.toLowerCase().trim().replace(/[^a-z\s]/g, '');
  const normalizedInput = normalize(inputName);
  const normalizedUser = normalize(userName);
  
  // Exact match
  if (normalizedInput === normalizedUser) return true;
  
  // Contains match (either direction)
  if (normalizedUser.includes(normalizedInput) || normalizedInput.includes(normalizedUser)) {
    return true;
  }
  
  // Split name parts and check for matches
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

function isAdminRole(role) {
  // Check for admin roles from Employee API
  const adminRoles = [
    'Admin',
    'Owner', 
    'FieldManager',
    'SalesManager',
    'admin',
    'owner',
    'manager'
  ];
  
  if (typeof role === 'string') {
    return adminRoles.some(adminRole => 
      role.toLowerCase().includes(adminRole.toLowerCase())
    );
  }
  
  return false;
}

// Original ServiceTitan OAuth proxy (keeping for backward compatibility)
app.post('/api/servicetitan/auth', async (req, res) => {
  try {
    console.log('🔐 Legacy OAuth proxy...');
    
    const fetch = (await import('node-fetch')).default;
    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('client_id', process.env.REACT_APP_SERVICETITAN_CLIENT_ID);
    formData.append('client_secret', process.env.REACT_APP_SERVICETITAN_CLIENT_SECRET);

    const response = await fetch(process.env.REACT_APP_SERVICETITAN_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: formData
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ ServiceTitan auth failed:', data);
      return res.status(response.status).json(data);
    }

    console.log('✅ Legacy OAuth successful');
    res.json(data);
    
  } catch (error) {
    console.error('❌ Legacy OAuth error:', error);
    res.status(500).json({ error: 'Proxy server error', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Three-Layer Auth Server running on http://localhost:${PORT}`);
  console.log(`🏢 Layer 1: Company Access (Password from env: ${COMPANY_ACCESS_PASSWORD ? 'SET' : 'NOT SET'})`);
  console.log(`👤 Layer 2: Employee/Technician Validation (dual API search)`);
  console.log(`🔑 Layer 3: Admin Super Access (Password from env: ${ADMIN_SUPER_PASSWORD ? 'SET' : 'NOT SET'})`);
});

/*
THREE-LAYER AUTHENTICATION FLOW:

Layer 1: Company Access
- Password: MrBackflow25!
- Validates company access
- Gets ServiceTitan token

Layer 2: Employee/Technician Validation  
- Searches BOTH APIs simultaneously
- Validates name + phone match
- Returns user with role information

Layer 3: Admin Super Access
- Password: Seeall25!
- Only for users with admin roles
- Grants access to see all jobs

API ENDPOINTS:
POST /api/company/authenticate        - Layer 1
POST /api/user/validate              - Layer 2  
POST /api/admin/validate-super-access - Layer 3

SUPPORTED USER TYPES:
- Employees (all roles including Admin, Owner, Manager)
- Technicians (all technician roles)
- Deduplication by userId for users in both systems

ADMIN ROLES DETECTED:
- Admin, Owner, FieldManager, SalesManager, etc.
*/