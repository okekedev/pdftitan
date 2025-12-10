// api/auth.js - Optimized Authentication with Pagination
const express = require('express');
const router = express.Router();

// Simple in-memory cache for technicians (resets on server restart)
let techniciansCache = {
  data: null,
  lastFetch: null,
  expiryMinutes: 30 // Cache for 30 minutes
};

// ✅ TECHNICIAN VALIDATION using ServiceTitan Technicians API with optimization
router.post('/technician/validate', async (req, res) => {
  try {
    const { username, phone } = req.body;
    
    if (!username || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Both username and phone number are required'
      });
    }
    
    console.log(`🔧 Looking up technician with loginName: ${username}`);
    
    // Get technicians (with caching)
    const technicians = await getAllTechnicians();
    console.log(`📋 Found ${technicians.length} total technicians`);
    
    // Search for technician by loginName (case-insensitive)
    const technician = technicians.find(tech => {
      if (!tech.loginName) return false;
      return tech.loginName.toLowerCase() === username.toLowerCase();
    });
    
    if (!technician) {
      console.log(`❌ No technician found with loginName: ${username}`);
      
      // Debug: Show available loginNames for troubleshooting
      const availableLogins = technicians
        .map(t => t.loginName)
        .filter(Boolean)
        .sort();
      console.log('📋 Available loginNames (first 10):', availableLogins.slice(0, 10));
      
      return res.status(404).json({
        success: false,
        error: `No technician found with username "${username}"`,
        debug: process.env.NODE_ENV === 'development' ? {
          totalTechnicians: technicians.length,
          availableUsernames: availableLogins.slice(0, 5)
        } : undefined
      });
    }
    
    console.log(`✅ Found technician: ${technician.name} (ID: ${technician.id})`);
    console.log(`📱 Technician phone: ${technician.phoneNumber || 'No phone number'}`);
    console.log(`📱 Provided phone: ${phone}`);
    
    // Validate phone number matches (with normalization)
    const phoneMatch = global.serviceTitan.validatePhoneMatch(technician.phoneNumber, phone);
    
    if (!phoneMatch) {
      console.log(`❌ Phone number mismatch for ${username}`);
      console.log(`   Expected: ${global.serviceTitan.normalizePhone(technician.phoneNumber || '')}`);
      console.log(`   Provided: ${global.serviceTitan.normalizePhone(phone)}`);
      return res.status(401).json({
        success: false,
        error: 'Phone number does not match our records for this technician'
      });
    }
    
    console.log(`✅ Phone number verified for technician: ${technician.name}`);
    
    // Check for custom fields (license, gauge info)
    const customFields = technician.customFields || {};
    const hasCustomFields = Object.keys(customFields).length > 0;

    if (hasCustomFields) {
      console.log('📋 Custom fields found:', Object.keys(customFields));
    } else {
      console.log('⚠️  No custom fields found on technician record');
    }

    // Return successful authentication
    res.json({
      success: true,
      technician: {
        id: technician.id,
        userId: technician.userId,
        name: technician.name,
        username: technician.loginName,
        phoneNumber: technician.phoneNumber,
        email: technician.email,
        active: technician.active,
        businessUnitId: technician.businessUnitId,
        mainZoneId: technician.mainZoneId,
        zoneIds: technician.zoneIds,
        roleIds: technician.roleIds,
        team: technician.team,
        isManagedTech: technician.isManagedTech,
        dailyGoal: technician.dailyGoal,
        burdenRate: technician.burdenRate,
        accountLocked: technician.accountLocked,

        // Backflow-specific fields (from custom fields or placeholders)
        bpatLicenseNumber: customFields.bpatLicenseNumber || customFields.licenseNumber || 'BPAT-PLACEHOLDER',
        licenseExpirationDate: customFields.licenseExpirationDate || '2025-12-31',
        gauges: customFields.gauges || [
          {
            id: 'gauge-1',
            type: 'Potable',
            makeModel: 'Placeholder Gauge',
            serialNumber: '000000',
            dateTestedForAccuracy: '2024-01-01'
          }
        ],

        // Include raw custom fields for debugging
        customFields: hasCustomFields ? customFields : null
      },
      company: {
        name: process.env.COMPANY_NAME || 'MrBackflow TX',
        address: process.env.COMPANY_ADDRESS || '126 Country Rd 4577, Boyd, TX 76023',
        phone: process.env.COMPANY_PHONE || '(817) 232-5577',
        tenantId: global.serviceTitan.tenantId,
        appKey: global.serviceTitan.appKey
      },
      environment: global.serviceTitan.apiBaseUrl?.includes('integration') ? 'Integration' : 'Production',
      metadata: {
        totalTechnicians: technicians.length,
        authenticatedAt: new Date().toISOString(),
        cacheUsed: techniciansCache.data !== null
      }
    });
    
  } catch (error) {
    console.error('❌ Technician validation error:', error);
    
    let errorMessage = 'Server error during technician validation';
    let statusCode = 500;
    
    if (error.message.includes('OAuth2 failed') || error.message.includes('Auth failed')) {
      errorMessage = 'Failed to authenticate with ServiceTitan API';
      statusCode = 503;
    } else if (error.message.includes('404')) {
      errorMessage = 'ServiceTitan API endpoint not found';
      statusCode = 503;
    } else if (error.message.includes('403')) {
      errorMessage = 'Not authorized to access ServiceTitan data';
      statusCode = 503;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      ...(process.env.NODE_ENV === 'development' && {
        originalError: error.message
      })
    });
  }
});

// Helper function to get all technicians with caching and pagination
async function getAllTechnicians() {
  // Check cache first
  const now = Date.now();
  const cacheExpiry = techniciansCache.lastFetch + (techniciansCache.expiryMinutes * 60 * 1000);
  
  if (techniciansCache.data && now < cacheExpiry) {
    console.log('🚀 Using cached technicians data');
    return techniciansCache.data;
  }
  
  console.log('📡 Fetching technicians from ServiceTitan API...');
  
  let allTechnicians = [];
  let page = 1;
  let hasMore = true;
  const pageSize = 100; // Get 100 per page for efficiency
  
  while (hasMore && page <= 20) { // Safety limit of 20 pages (2000 technicians max)
    const queryParams = new URLSearchParams({
      active: 'True',
      page: page.toString(),
      pageSize: pageSize.toString(),
      includeTotal: 'true'
    });
    
    const endpoint = `/settings/v2/tenant/${global.serviceTitan.tenantId}/technicians?${queryParams}`;
    console.log(`📡 Fetching page ${page}: ${endpoint}`);
    
    const response = await global.serviceTitan.apiCall(endpoint);
    const technicians = response.data || [];
    
    allTechnicians = allTechnicians.concat(technicians);
    
    console.log(`📄 Page ${page}: ${technicians.length} technicians, Total so far: ${allTechnicians.length}`);
    
    if (response.totalCount) {
      console.log(`📊 Total in system: ${response.totalCount}`);
    }
    
    // Check if there are more pages
    hasMore = response.hasMore && technicians.length === pageSize;
    page++;
  }
  
  console.log(`✅ Fetched ${allTechnicians.length} total technicians`);
  
  // Cache the results
  techniciansCache = {
    data: allTechnicians,
    lastFetch: now,
    expiryMinutes: 30
  };
  
  return allTechnicians;
}

module.exports = router;