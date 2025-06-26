// api/auth.js - Authentication API (Optimized for Serverless)
const express = require('express');
const serviceTitan = require('../utils/serviceTitan');
const router = express.Router();

// ✅ TECHNICIAN VALIDATION
router.post('/technician/validate', async (req, res) => {
  try {
    const { username, phone } = req.body;
    
    if (!username || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Both username and phone number are required'
      });
    }
    
    console.log(`🔧 Authenticating technician: ${username}`);
    
    // Use centralized ServiceTitan client
    const endpoint = serviceTitan.buildTenantUrl('settings') + '/technicians';
    const data = await serviceTitan.apiCall(endpoint);
    
    const technicians = data.data || [];
    const technician = technicians.find(tech => 
      tech.username && tech.username.toLowerCase() === username.toLowerCase()
    );
    
    if (!technician) {
      return res.status(404).json({
        success: false,
        error: `No technician found with username "${username}"`
      });
    }
    
    if (!serviceTitan.validatePhoneMatch(technician.phoneNumber || technician.mobileNumber, phone)) {
      return res.status(401).json({
        success: false,
        error: 'Phone number does not match our records for this technician'
      });
    }
    
    console.log(`✅ Technician authenticated: ${technician.name}`);
    
    res.json({
      success: true,
      technician: {
        id: technician.id,
        name: technician.name,
        username: technician.username,
        phoneNumber: technician.phoneNumber || technician.mobileNumber,
        email: technician.email,
        active: technician.active
      },
      company: {
        name: process.env.COMPANY_NAME || 'MrBackflow TX',
        tenantId: serviceTitan.tenantId,
        appKey: serviceTitan.appKey
      },
      environment: serviceTitan.apiBaseUrl?.includes('integration') ? 'Integration' : 'Production'
    });
    
  } catch (error) {
    console.error('❌ Technician validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during technician validation'
    });
  }
});

module.exports = router;