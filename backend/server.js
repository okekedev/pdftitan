// backend/server.js - Unified Server (API + Static Files)
const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Import API modules
const authAPI = require('./api/auth');
const appointmentsAPI = require('./api/appointments');
const jobsAPI = require('./api/jobs');
const attachmentsAPI = require('./api/attachments');

const app = express();
const PORT = process.env.PORT || 3005;
const isDevelopment = process.env.NODE_ENV !== 'production';

// Debug: Environment check
console.log('🔍 TitanPDF Environment Check:');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('ServiceTitan Tenant ID:', process.env.REACT_APP_SERVICETITAN_TENANT_ID ? '✅ Set' : '❌ Missing');
console.log('ServiceTitan App Key:', process.env.REACT_APP_SERVICETITAN_APP_KEY ? '✅ Set' : '❌ Missing');
console.log('ServiceTitan API Base URL:', process.env.REACT_APP_SERVICETITAN_API_BASE_URL ? '✅ Set' : '❌ Missing');

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS configuration (development only)
if (isDevelopment) {
  app.use(cors({
    origin: [
      'http://localhost:3000',  // React dev server
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

// Add helper functions to app.locals for API routes
app.locals.helpers = {
  // ServiceTitan OAuth Authentication
  authenticateServiceTitan: async () => {
    try {
      const fetch = (await import('node-fetch')).default;
      const FormData = require('form-data');
      
      const clientId = process.env.REACT_APP_SERVICETITAN_CLIENT_ID;
      const clientSecret = process.env.REACT_APP_SERVICETITAN_CLIENT_SECRET;
      const tenantId = process.env.REACT_APP_SERVICETITAN_TENANT_ID;
      const apiBaseUrl = process.env.REACT_APP_SERVICETITAN_API_BASE_URL || 'https://api-integration.servicetitan.io';
      
      if (!clientId || !clientSecret || !tenantId) {
        console.error('❌ Missing ServiceTitan credentials');
        return { success: false, error: 'Missing credentials' };
      }
      
      const tokenUrl = `${apiBaseUrl}/connect/token`;
      
      const formData = new FormData();
      formData.append('grant_type', 'client_credentials');
      formData.append('client_id', clientId);
      formData.append('client_secret', clientSecret);
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ ServiceTitan auth failed: ${response.status} - ${errorText}`);
        return { success: false, error: `Auth failed: ${response.statusText}` };
      }
      
      const tokenData = await response.json();
      
      console.log('✅ ServiceTitan authentication successful');
      return {
        success: true,
        accessToken: tokenData.access_token,
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in
      };
      
    } catch (error) {
      console.error('❌ ServiceTitan auth error:', error);
      return { success: false, error: error.message };
    }
  },

  // Search for technician by username
  searchTechnicianByUsername: async (username, accessToken) => {
    try {
      const fetch = (await import('node-fetch')).default;
      const tenantId = process.env.REACT_APP_SERVICETITAN_TENANT_ID;
      const appKey = process.env.REACT_APP_SERVICETITAN_APP_KEY;
      const apiBaseUrl = process.env.REACT_APP_SERVICETITAN_API_BASE_URL;
      
      // Search technicians endpoint
      const searchUrl = `${apiBaseUrl}/settings/v2/tenant/${tenantId}/technicians`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'ST-App-Key': appKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`❌ Technician search failed: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      const technicians = data.data || [];
      
      // Find technician by username (case-insensitive)
      const technician = technicians.find(tech => 
        tech.username && tech.username.toLowerCase() === username.toLowerCase()
      );
      
      if (technician) {
        return {
          id: technician.id,
          name: technician.name,
          username: technician.username,
          phoneNumber: technician.phoneNumber || technician.mobileNumber,
          email: technician.email,
          active: technician.active
        };
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ Error searching technician:', error);
      return null;
    }
  },

  // Validate phone number match
  validatePhoneMatch: (technician, inputPhone) => {
    if (!technician.phoneNumber || !inputPhone) {
      return false;
    }
    
    // Normalize phone numbers (remove all non-digits)
    const normalizePhone = (phone) => phone.replace(/\D/g, '');
    
    const techPhone = normalizePhone(technician.phoneNumber);
    const userPhone = normalizePhone(inputPhone);
    
    // Compare last 10 digits (handles country codes)
    const techLast10 = techPhone.slice(-10);
    const userLast10 = userPhone.slice(-10);
    
    return techLast10 === userLast10;
  }
};

// API Routes (always available)
app.use('/api', authAPI);
app.use('/api', appointmentsAPI);
app.use('/api', jobsAPI);
app.use('/api', attachmentsAPI);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'TitanPDF Backend API',
    mode: isDevelopment ? 'development' : 'production',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    serviceIntegration: {
      serviceTitan: {
        configured: !!(process.env.REACT_APP_SERVICETITAN_TENANT_ID && 
                      process.env.REACT_APP_SERVICETITAN_APP_KEY),
        baseUrl: process.env.REACT_APP_SERVICETITAN_API_BASE_URL
      }
    }
  });
});

// Static files and SPA routing (production only)
if (!isDevelopment) {
  // Serve built React app from ../build directory
  const buildPath = path.join(__dirname, '../build');
  app.use(express.static(buildPath));
  
  // All non-API routes serve the React app (SPA routing)
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
  
  console.log('🏭 Production mode: Serving static React app from ../build');
} else {
  // Development mode: API-only server
  app.get('/', (req, res) => {
    res.json({
      message: 'TitanPDF API Server (Development Mode)',
      note: 'Run your React dev server separately for hot reload',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        technicianValidate: 'POST /api/technician/validate',
        technicianAppointments: 'GET /api/technician/:id/appointments',
        jobDetails: 'GET /api/job/:jobId',
        jobAttachments: 'GET /api/job/:jobId/attachments',
        downloadAttachment: 'GET /api/job/:jobId/attachment/:attachmentId/download',
        saveAttachment: 'POST /api/job/:jobId/attachment/:attachmentId/save',
        completedForms: 'GET /api/job/:jobId/completed-forms'
      }
    });
  });
  
  console.log('🛠️ Development mode: API-only server');
  console.log('🔥 Run your React app separately for hot reload');
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(isDevelopment && { details: error.message })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 TitanPDF Unified Server');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🌍 Mode: ${isDevelopment ? 'Development' : 'Production'}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log('');
  
  if (isDevelopment) {
    console.log('🔥 Development mode active');
    console.log('📋 Available API Endpoints:');
    console.log('   GET  /health');
    console.log('   POST /api/technician/validate');
    console.log('   GET  /api/technician/:id/appointments');
    console.log('   GET  /api/job/:jobId');
    console.log('   GET  /api/job/:jobId/attachments');
    console.log('   GET  /api/job/:jobId/attachment/:attachmentId/download');
    console.log('   POST /api/job/:jobId/attachment/:attachmentId/save');
    console.log('   GET  /api/job/:jobId/completed-forms');
    console.log('');
    console.log('📱 Frontend Commands:');
    console.log('   npm start     - Start React dev server (port 3000)');
    console.log('   npm run build - Build React app for production');
  } else {
    console.log('🏭 Production mode: Serving React app + API');
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