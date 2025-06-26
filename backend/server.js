// server.js - Optimized Unified Server (Serverless Ready)
const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Import optimized API modules
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
console.log('ServiceTitan Client ID:', process.env.REACT_APP_SERVICETITAN_CLIENT_ID ? '✅ Set' : '❌ Missing');
console.log('ServiceTitan Client Secret:', process.env.REACT_APP_SERVICETITAN_CLIENT_SECRET ? '✅ Set' : '❌ Missing');

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

// API Routes - No more app.locals.helpers needed!
app.use('/api', authAPI);
app.use('/api', appointmentsAPI);
app.use('/api', jobsAPI);
app.use('/api', attachmentsAPI);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'TitanPDF Backend API (Optimized)',
    mode: isDevelopment ? 'development' : 'production',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    serviceIntegration: {
      serviceTitan: {
        configured: !!(
          process.env.REACT_APP_SERVICETITAN_TENANT_ID && 
          process.env.REACT_APP_SERVICETITAN_APP_KEY &&
          process.env.REACT_APP_SERVICETITAN_CLIENT_ID &&
          process.env.REACT_APP_SERVICETITAN_CLIENT_SECRET
        ),
        baseUrl: process.env.REACT_APP_SERVICETITAN_API_BASE_URL,
        environment: process.env.REACT_APP_SERVICETITAN_API_BASE_URL?.includes('integration') ? 'Integration' : 'Production'
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
      message: 'TitanPDF API Server (Development Mode) - Optimized',
      note: 'Run your React dev server separately for hot reload',
      version: '2.0.0',
      optimization: 'Serverless Ready',
      endpoints: {
        health: 'GET /health',
        
        // Authentication
        technicianValidate: 'POST /api/technician/validate',
        
        // Appointments
        technicianAppointments: 'GET /api/technician/:id/appointments',
        
        // Jobs
        jobDetails: 'GET /api/job/:jobId',
        completedForms: 'GET /api/job/:jobId/completed-forms',
        
        // Attachments
        jobAttachments: 'GET /api/job/:jobId/attachments',
        downloadAttachment: 'GET /api/job/:jobId/attachment/:attachmentId/download',
        saveAttachment: 'POST /api/job/:jobId/attachment/:attachmentId/save',
        generatePDF: 'POST /api/job/:jobId/attachment/:attachmentId/generate-pdf'
      },
      improvements: [
        'Centralized ServiceTitan client with token caching',
        'Eliminated duplicate authentication logic',
        'Removed app.locals.helpers dependency',
        'Optimized for serverless deployment',
        'Better error handling and logging',
        'Reduced bundle size per endpoint'
      ]
    });
  });
  
  console.log('🛠️ Development mode: API-only server (Optimized)');
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
      'GET /api/technician/:id/appointments',
      'GET /api/job/:jobId',
      'GET /api/job/:jobId/completed-forms',
      'GET /api/job/:jobId/attachments',
      'GET /api/job/:jobId/attachment/:attachmentId/download',
      'POST /api/job/:jobId/attachment/:attachmentId/save',
      'POST /api/job/:jobId/attachment/:attachmentId/generate-pdf'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 TitanPDF Optimized Server');
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
    console.log('   GET  /api/job/:jobId/completed-forms');
    console.log('   GET  /api/job/:jobId/attachments');
    console.log('   GET  /api/job/:jobId/attachment/:attachmentId/download');
    console.log('   POST /api/job/:jobId/attachment/:attachmentId/save');
    console.log('   POST /api/job/:jobId/attachment/:attachmentId/generate-pdf');
    console.log('');
    console.log('🎯 Optimizations Applied:');
    console.log('   ✅ Centralized ServiceTitan client');
    console.log('   ✅ Token caching within execution context');
    console.log('   ✅ Eliminated duplicate authentication logic');
    console.log('   ✅ Removed app.locals.helpers dependency');
    console.log('   ✅ Optimized for serverless deployment');
    console.log('   ✅ Better error handling and logging');
    console.log('');
    console.log('📱 Frontend Commands:');
    console.log('   npm start     - Start React dev server (port 3000)');
    console.log('   npm run build - Build React app for production');
  } else {
    console.log('🏭 Production mode: Serving React app + API (Optimized)');
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