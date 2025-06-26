// backend/api/auth.js - Authentication API
const express = require('express');
const router = express.Router();

// ✅ TECHNICIAN VALIDATION
router.post('/technician/validate', async (req, res) => {
  try {
    const { username, phone } = req.body;
    const { authenticateServiceTitan, searchTechnicianByUsername, validatePhoneMatch } = req.app.locals.helpers;
    
    if (!username || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Both username and phone number are required'
      });
    }
    
    console.log(`🔧 Authenticating technician: ${username}`);
    
    const tokenResult = await authenticateServiceTitan();
    if (!tokenResult.success) {
      return res.status(500).json({
        success: false,
        error: 'ServiceTitan authentication failed'
      });
    }
    
    const technician = await searchTechnicianByUsername(
      username, 
      tokenResult.accessToken
    );
    
    if (!technician) {
      return res.status(404).json({
        success: false,
        error: `No technician found with username "${username}"`
      });
    }
    
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
        name: process.env.COMPANY_NAME || 'MrBackflow TX',
        tenantId: process.env.REACT_APP_SERVICETITAN_TENANT_ID,
        appKey: process.env.REACT_APP_SERVICETITAN_APP_KEY
      },
      accessToken: tokenResult.accessToken,
      environment: process.env.REACT_APP_SERVICETITAN_API_BASE_URL?.includes('integration') ? 'Integration' : 'Production'
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