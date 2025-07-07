// server.js - Fixed ServiceTitan OAuth2 with Correct Endpoints (Updated imports)
const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3004;
const isDevelopment = process.env.NODE_ENV !== 'production';

// ================ SERVICETITAN CLIENT ================
class ServiceTitanClient {
  constructor() {
    this.clientId = process.env.REACT_APP_SERVICETITAN_CLIENT_ID;
    this.clientSecret = process.env.REACT_APP_SERVICETITAN_CLIENT_SECRET;
    this.tenantId = process.env.REACT_APP_SERVICETITAN_TENANT_ID;
    this.appKey = process.env.REACT_APP_SERVICETITAN_APP_KEY;
    this.apiBaseUrl = process.env.REACT_APP_SERVICETITAN_API_BASE_URL;
    
    // Determine the correct OAuth endpoint based on environment
    this.authBaseUrl = this.getAuthBaseUrl();
    
    // Cache token for reuse within same execution
    this.tokenCache = null;
    this.tokenExpiry = null;
    
    // Debug credentials on startup
    this.debugCredentials();
  }

  // Get the correct OAuth endpoint based on API environment
  getAuthBaseUrl() {
    if (!this.apiBaseUrl) {
      return null;
    }
    
    // Check if using integration environment
    if (this.apiBaseUrl.includes('integration')) {
      return 'https://auth-integration.servicetitan.io';
    } else {
      return 'https://auth.servicetitan.io';
    }
  }

  debugCredentials() {
    console.log('🔐 ServiceTitan Credentials Debug:');
    console.log('   API Base URL:', this.apiBaseUrl || '❌ MISSING');
    console.log('   Auth Base URL:', this.authBaseUrl || '❌ MISSING');
    console.log('   Tenant ID:', this.tenantId || '❌ MISSING');
    console.log('   App Key:', this.appKey ? '✅ Set' : '❌ MISSING');
    console.log('   Client ID:', this.clientId ? '✅ Set' : '❌ MISSING');
    console.log('   Client Secret:', this.clientSecret ? '✅ Set' : '❌ MISSING');
    
    // Show what the token URL will be
    if (this.authBaseUrl) {
      console.log('   OAuth Token URL:', `${this.authBaseUrl}/connect/token`);
    }
    
    if (!this.apiBaseUrl || !this.tenantId || !this.appKey || !this.clientId || !this.clientSecret) {
      console.log('❌ CRITICAL: Missing ServiceTitan credentials! Check your .env file.');
    }
    
    // Verify environment consistency
    const isApiIntegration = this.apiBaseUrl?.includes('integration');
    const isAuthIntegration = this.authBaseUrl?.includes('integration');
    if (isApiIntegration !== isAuthIntegration) {
      console.log('⚠️  WARNING: API and Auth environments may not match!');
    }
  }

  // Single method to get authenticated fetch headers
  async getAuthHeaders() {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('Failed to authenticate with ServiceTitan');
    }

    return {
      'Authorization': `Bearer ${token}`,
      'ST-App-Key': this.appKey,
      'Content-Type': 'application/json'
    };
  }

  // ServiceTitan OAuth2 Client Credentials flow
  async getAccessToken() {
    // Return cached token if still valid
    if (this.tokenCache && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      console.log('🔄 Using cached ServiceTitan token');
      return this.tokenCache;
    }

    try {
      const fetch = (await import('node-fetch')).default;
      
      if (!this.clientId || !this.clientSecret || !this.authBaseUrl) {
        throw new Error('Missing ServiceTitan OAuth credentials');
      }
      
      // ServiceTitan OAuth2 Token Endpoint (separate from API endpoints)
      const tokenUrl = `${this.authBaseUrl}/connect/token`;
      
      console.log('🔑 Requesting ServiceTitan OAuth2 token...');
      console.log('   Token URL:', tokenUrl);
      console.log('   Client ID:', this.clientId);
      console.log('   Grant Type: client_credentials');
      
      // OAuth2 Client Credentials request
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', this.clientId);
      params.append('client_secret', this.clientSecret);
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });
      
      console.log('📡 OAuth2 response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ OAuth2 error response:', errorText);
        
        // Try to parse error for better debugging
        try {
          const errorJson = JSON.parse(errorText);
          console.log('❌ OAuth2 error details:', errorJson);
          
          // Provide specific error messages based on common issues
          if (errorJson.error === 'invalid_client') {
            throw new Error(`Invalid Client ID or Secret - check your credentials for tenant ${this.tenantId}`);
          } else if (errorJson.error === 'unauthorized_client') {
            throw new Error(`Client not authorized - ensure app is approved for tenant ${this.tenantId}`);
          }
        } catch (e) {
          // Error text wasn't JSON
        }
        
        throw new Error(`OAuth2 failed: ${response.status} - ${errorText}`);
      }
      
      const tokenData = await response.json();
      console.log('✅ ServiceTitan OAuth2 token received');
      console.log('   Token Type:', tokenData.token_type);
      console.log('   Expires In:', tokenData.expires_in, 'seconds (15 minutes)');
      console.log('   Scope:', tokenData.scope || 'default');
      
      // Cache token with 5 minute buffer before expiry (ServiceTitan tokens last 900 seconds)
      this.tokenCache = tokenData.access_token;
      this.tokenExpiry = Date.now() + ((tokenData.expires_in - 300) * 1000);
      
      return this.tokenCache;
      
    } catch (error) {
      console.error('❌ ServiceTitan OAuth2 error:', error);
      throw error;
    }
  }

  // Centralized API call method
  async apiCall(endpoint, options = {}) {
    const fetch = (await import('node-fetch')).default;
    const headers = await this.getAuthHeaders();
    
    const url = `${this.apiBaseUrl}${endpoint}`;
    console.log('📡 ServiceTitan API call:', url);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    });

    console.log('📡 API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ ServiceTitan API error:', response.status, errorText);
      
      // Try to parse error for better debugging
      try {
        const errorJson = JSON.parse(errorText);
        console.log('❌ API error details:', errorJson);
      } catch (e) {
        // Error text wasn't JSON
      }
      
      throw new Error(`API call failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ API call successful, returned', Array.isArray(result.data) ? `${result.data.length} items` : 'data');
    
    return result;
  }

  // Raw fetch method for file downloads
  async rawFetch(endpoint, options = {}) {
    const fetch = (await import('node-fetch')).default;
    const headers = await this.getAuthHeaders();
    
    // Remove Content-Type for file downloads if undefined
    if (options.headers && options.headers['Content-Type'] === undefined) {
      delete headers['Content-Type'];
    }
    
    const url = `${this.apiBaseUrl}${endpoint}`;
    
    return fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    });
  }

  // Utility methods
  buildTenantUrl(service) {
    return `/${service}/v2/tenant/${this.tenantId}`;
  }

  normalizePhone(phone) {
    return phone ? phone.replace(/\D/g, '') : '';
  }

  validatePhoneMatch(techPhone, userPhone) {
    if (!techPhone || !userPhone) {
      console.log('📱 Phone validation: Missing phone number(s)');
      return false;
    }
    
    const techNorm = this.normalizePhone(techPhone).slice(-10);
    const userNorm = this.normalizePhone(userPhone).slice(-10);
    
    console.log(`📱 Phone comparison: "${techNorm}" vs "${userNorm}"`);
    
    // Must have at least 10 digits
    if (techNorm.length < 10 || userNorm.length < 10) {
      console.log('📱 Phone validation: Phone number too short');
      return false;
    }
    
    const match = techNorm === userNorm;
    console.log(`📱 Phone match result: ${match}`);
    
    return match;
  }

  // Date range helpers
  getDateRange(daysBack = 2) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    return { startDate, endDate };
  }

  // Clean HTML from job titles
  cleanJobTitle(title) {
    if (!title) return 'Service Call';
    
    let cleaned = title.replace(/<[^>]*>/g, ' ')
                      .replace(/&[^;]+;/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim();
    
    if (cleaned.length > 200) {
      cleaned = cleaned.substring(0, 200) + '...';
    }
    
    if (!cleaned || cleaned.length < 3) {
      cleaned = 'Service Call';
    }
    
    return cleaned;
  }
}

// Create ServiceTitan client instance and make it available globally for API modules
global.serviceTitan = new ServiceTitanClient();

// Debug: Environment check
console.log('🔍 TitanPDF Environment Check:');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('ServiceTitan Tenant ID:', process.env.REACT_APP_SERVICETITAN_TENANT_ID ? '✅ Set' : '❌ Missing');
console.log('ServiceTitan App Key:', process.env.REACT_APP_SERVICETITAN_APP_KEY ? '✅ Set' : '❌ Missing');
console.log('ServiceTitan API Base URL:', process.env.REACT_APP_SERVICETITAN_API_BASE_URL ? '✅ Set' : '❌ Missing');
console.log('ServiceTitan Client ID:', process.env.REACT_APP_SERVICETITAN_CLIENT_ID ? '✅ Set' : '❌ Missing');
console.log('ServiceTitan Client Secret:', process.env.REACT_APP_SERVICETITAN_CLIENT_SECRET ? '✅ Set' : '❌ Missing');

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS configuration (development only)
if (isDevelopment) {
  app.use(cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',  // React dev server
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004'
    ],
    credentials: true
  }));
  console.log('🛠️ Development mode: CORS enabled for React dev server');
} else {
  console.log('🏭 Production mode: No CORS needed (same-origin)');
}

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ✅ FIXED: Import API modules AFTER setting up global serviceTitan
const authAPI = require('./api/auth');
const jobsAPI = require('./api/jobs'); // ✅ Changed from appointments to jobs
const attachmentsAPI = require('./api/attachments');

// ✅ FIXED: API Routes - removed old appointments API, using jobs API
app.use('/api', authAPI);
app.use('/api', jobsAPI); // ✅ Jobs API handles both job listing and job details
app.use('/api', attachmentsAPI);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'TitanPDF Backend API (Job-Focused Architecture)',
    mode: isDevelopment ? 'development' : 'production',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    architecture: 'Server + ServiceTitan Client + Job-Focused API',
    serviceIntegration: {
      configured: !!(
        process.env.REACT_APP_SERVICETITAN_TENANT_ID && 
        process.env.REACT_APP_SERVICETITAN_APP_KEY &&
        process.env.REACT_APP_SERVICETITAN_CLIENT_ID &&
        process.env.REACT_APP_SERVICETITAN_CLIENT_SECRET
      ),
      apiBaseUrl: process.env.REACT_APP_SERVICETITAN_API_BASE_URL,
      authBaseUrl: global.serviceTitan?.authBaseUrl,
      environment: process.env.REACT_APP_SERVICETITAN_API_BASE_URL?.includes('integration') ? 'Integration' : 'Production'
    }
  });
});

// Static files and SPA routing (production only)
if (!isDevelopment) {
  const buildPath = path.join(__dirname, '../build');
  app.use(express.static(buildPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
  
  console.log('🏭 Production mode: Serving static React app from ../build');
} else {
  app.get('/', (req, res) => {
    res.json({
      message: 'TitanPDF API Server (Development Mode) - Job-Focused Architecture',
      note: 'Run your React dev server separately for hot reload',
      version: '2.0.0',
      architecture: 'Server + ServiceTitan Client + Job-Focused API',
      improvements: [
        'Job-focused API instead of appointment-focused',
        'Fixed OAuth2 endpoints (auth-integration.servicetitan.io vs api-integration.servicetitan.io)',
        'Proper client credentials flow implementation',
        'Better error handling for OAuth2 responses',
        'Environment-specific OAuth endpoint detection'
      ],
      endpoints: {
        health: 'GET /health',
        technicianValidate: 'POST /api/technician/validate',
        technicianJobs: 'GET /api/technician/:id/jobs', // ✅ Updated endpoint name
        jobDetails: 'GET /api/job/:jobId',
        jobAttachments: 'GET /api/job/:jobId/attachments',
        downloadAttachment: 'GET /api/job/:jobId/attachment/:attachmentId/download',
        saveAttachment: 'POST /api/job/:jobId/attachment/:attachmentId/save'
      }
    });
  });
  
  console.log('🛠️ Development mode: API-only server with job-focused architecture');
  console.log('🔥 Run your React app separately for hot reload');
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(isDevelopment && { details: error.message, stack: error.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    availableEndpoints: [
      'GET /health',
      'POST /api/technician/validate',
      'GET /api/technician/:id/jobs',  // ✅ Updated endpoint documentation
      'GET /api/job/:jobId',
      'GET /api/job/:jobId/attachments',
      'GET /api/job/:jobId/attachment/:attachmentId/download',
      'POST /api/job/:jobId/attachment/:attachmentId/save'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 TitanPDF Server with Job-Focused Architecture');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🌍 Mode: ${isDevelopment ? 'Development' : 'Production'}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log('🎯 Architecture: Server + ServiceTitan Client + Job-Focused API');
  console.log('');
  
  if (isDevelopment) {
    console.log('🔥 Development mode active');
    console.log('📋 Available API Endpoints:');
    console.log('   GET  /health');
    console.log('   POST /api/technician/validate');
    console.log('   GET  /api/technician/:id/jobs');  // ✅ Updated endpoint name
    console.log('   GET  /api/job/:jobId');
    console.log('   GET  /api/job/:jobId/attachments');
    console.log('   GET  /api/job/:jobId/attachment/:attachmentId/download');
    console.log('   POST /api/job/:jobId/attachment/:attachmentId/save');
    console.log('');
    console.log('🎯 Job-Focused Improvements:');
    console.log('   ✅ Renamed appointments API to jobs API');
    console.log('   ✅ Job-centric data model and endpoints');
    console.log('   ✅ Better business logic alignment');
    console.log('   ✅ Simplified frontend integration');
  } else {
    console.log('🏭 Production mode: Serving React app + API (Job-Focused)');
    console.log('📱 App available at: http://localhost:' + PORT);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down TitanPDF server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});