// api/jobs.js - Enhanced Job-focused API with customer data
const express = require('express');
const router = express.Router();

// Simple in-memory cache for customers (resets on server restart)
let customersCache = {
  data: new Map(),
  lastFetch: null,
  expiryMinutes: 60 // Cache for 60 minutes
};

// ✅ GET TECHNICIAN'S JOBS - Enhanced with customer data
router.get('/technician/:technicianId/jobs', async (req, res) => {
  try {
    const { technicianId } = req.params;
    
    console.log(`📋 Fetching jobs for technician ID: ${technicianId}`);
    
    // Use global serviceTitan date range helper
    const { startDate, endDate } = global.serviceTitan.getDateRange(3);
    
    console.log(`📅 Date Range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
    
    // ✅ USE JOBS API with proper technician and date filtering
    let allJobs = [];
    let page = 1;
    let hasMorePages = true;
    const pageSize = 500;
    
    while (hasMorePages && page <= 20) {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        technicianId: technicianId,  // Jobs where technician is assigned to any appointment
        appointmentStartsOnOrAfter: startDate.toISOString(),  // Jobs with appointments in date range
        appointmentStartsBefore: endDate.toISOString(),
        includeTotal: 'true'
      });
      
      const endpoint = global.serviceTitan.buildTenantUrl('jpm') + `/jobs?${queryParams}`;
      const data = await global.serviceTitan.apiCall(endpoint);
      
      const jobs = data.data || [];
      allJobs = allJobs.concat(jobs);
      
      console.log(`📄 Page ${page}: ${jobs.length} jobs, Total so far: ${allJobs.length}`);
      if (data.totalCount) {
        console.log(`📊 Total jobs in system for this technician: ${data.totalCount}`);
      }
      
      hasMorePages = jobs.length === pageSize && data.hasMore !== false;
      page++;
    }
    
    console.log(`📊 Raw jobs received: ${allJobs.length}`);
    
    // ✅ Get customer data for all unique customer IDs
    const uniqueCustomerIds = [...new Set(allJobs.map(job => job.customerId))];
    const customersData = await getCustomersData(uniqueCustomerIds);

    // ✅ Get location data for all unique location IDs
    const uniqueLocationIds = [...new Set(allJobs.map(job => job.locationId).filter(Boolean))];
    const locationsData = await getLocationsData(uniqueLocationIds);
    
    // ✅ Transform jobs for frontend with customer info and next appointment
    const transformedJobs = await Promise.all(
      allJobs.map(async (job) => {
        try {
          // Get the next/current appointment for this job within our date range
          const appointmentParams = new URLSearchParams({
            jobId: job.id.toString(),
            startsOnOrAfter: startDate.toISOString(),
            startsOnOrBefore: endDate.toISOString(),
            pageSize: '10' // Just get first few appointments
          });
          
          const appointmentEndpoint = global.serviceTitan.buildTenantUrl('jpm') + `/appointments?${appointmentParams}`;
          const appointmentData = await global.serviceTitan.apiCall(appointmentEndpoint);
          const appointments = appointmentData.data || [];
          
          // Find the next upcoming appointment or most recent one
          const sortedAppointments = appointments
            .filter(apt => apt.start) // Must have start time
            .sort((a, b) => new Date(a.start) - new Date(b.start));
          
          const nextAppointment = sortedAppointments[0]; // First (earliest) appointment
          
          // Get customer info from cache
          const customer = customersData.get(job.customerId);

          // Get location info from cache
          const location = locationsData.get(job.locationId);

          // ✅ Shorten job title to max 60 characters
          const originalTitle = global.serviceTitan.cleanJobTitle(job.summary) || `Job #${job.jobNumber}`;
          const shortTitle = originalTitle.length > 60
            ? originalTitle.substring(0, 57) + '...'
            : originalTitle;

          return {
            id: job.id,
            number: job.jobNumber,
            title: shortTitle, // ✅ Shortened title
            status: job.jobStatus,
            priority: job.priority,

            // ✅ Enhanced customer info with billing address
            customer: {
              id: job.customerId,
              name: customer?.name || `Customer #${job.customerId}`,
              address: customer?.address ? {
                street: customer.address.street,
                unit: customer.address.unit,
                city: customer.address.city,
                state: customer.address.state,
                zip: customer.address.zip,
                fullAddress: formatAddress(customer.address)
              } : null
            },

            // ✅ Service location info (where the work is done)
            location: location ? {
              id: location.id,
              name: location.name,
              address: location.address ? {
                street: location.address.street,
                unit: location.address.unit,
                city: location.address.city,
                state: location.address.state,
                zip: location.address.zip,
                fullAddress: formatAddress(location.address)
              } : null
            } : null,
            
            // Next appointment info (for scheduling context)
            nextAppointment: nextAppointment ? {
              id: nextAppointment.id,
              appointmentNumber: nextAppointment.appointmentNumber,
              start: nextAppointment.start,
              end: nextAppointment.end,
              status: nextAppointment.status
            } : null,
            
            // Job metadata
            businessUnitId: job.businessUnitId,
            jobTypeId: job.jobTypeId,
            
            // Timestamps for sorting
            createdOn: job.createdOn,
            modifiedOn: job.modifiedOn,
            completedOn: job.completedOn,
            
            // Additional context (removed total and appointmentCount per request)
            noCharge: job.noCharge,
            invoiceId: job.invoiceId
          };
          
        } catch (appointmentError) {
          console.warn(`⚠️ Could not fetch appointments for job ${job.id}:`, appointmentError.message);

          // Return job without appointment info if appointment fetch fails
          const customer = customersData.get(job.customerId);
          const location = locationsData.get(job.locationId);
          const originalTitle = global.serviceTitan.cleanJobTitle(job.summary) || `Job #${job.jobNumber}`;
          const shortTitle = originalTitle.length > 60
            ? originalTitle.substring(0, 57) + '...'
            : originalTitle;

          return {
            id: job.id,
            number: job.jobNumber,
            title: shortTitle,
            status: job.jobStatus,
            priority: job.priority,
            customer: {
              id: job.customerId,
              name: customer?.name || `Customer #${job.customerId}`,
              address: customer?.address ? {
                street: customer.address.street,
                unit: customer.address.unit,
                city: customer.address.city,
                state: customer.address.state,
                zip: customer.address.zip,
                fullAddress: formatAddress(customer.address)
              } : null
            },
            location: location ? {
              id: location.id,
              name: location.name,
              address: location.address ? {
                street: location.address.street,
                unit: location.address.unit,
                city: location.address.city,
                state: location.address.state,
                zip: location.address.zip,
                fullAddress: formatAddress(location.address)
              } : null
            } : null,
            nextAppointment: null,
            businessUnitId: job.businessUnitId,
            jobTypeId: job.jobTypeId,
            createdOn: job.createdOn,
            modifiedOn: job.modifiedOn,
            completedOn: job.completedOn,
            noCharge: job.noCharge,
            invoiceId: job.invoiceId
          };
        }
      })
    );
    
    // ✅ GROUP BY DATE based on next appointment start time (MOST RECENT FIRST)
    const groupedByDate = groupJobsByDate(transformedJobs, true); // true = most recent first
    
    console.log(`✅ Found ${transformedJobs.length} jobs grouped into ${Object.keys(groupedByDate).length} days`);
    
    res.json({
      success: true,
      data: transformedJobs,           // Flat array of jobs
      groupedByDate: groupedByDate,    // Jobs grouped by appointment date (most recent first)
      count: transformedJobs.length,
      technicianId: parseInt(technicianId),
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        description: '3 days back to today'
      },
      metadata: {
        totalJobsFound: allJobs.length,
        jobsWithAppointments: transformedJobs.filter(j => j.nextAppointment).length,
        jobsWithCustomerData: transformedJobs.filter(j => j.customer.name !== `Customer #${j.customer.id}`).length,
        method: 'Jobs API with customer data and appointment context'
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching technician jobs:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching technician jobs'
    });
  }
});

// ✅ SEARCH: Find technician by name
router.get('/technician/search/:name', async (req, res) => {
  try {
    const { name } = req.params;
    console.log(`🔍 Searching for technician: ${name}`);

    const endpoint = global.serviceTitan.buildTenantUrl('settings') + `/technicians?active=True`;
    const data = await global.serviceTitan.apiCall(endpoint);
    const technicians = data.data || [];

    const matches = technicians.filter(tech =>
      tech.name && tech.name.toLowerCase().includes(name.toLowerCase())
    );

    res.json({
      success: true,
      matches: matches.map(t => ({
        id: t.id,
        name: t.name,
        loginName: t.loginName,
        phoneNumber: t.phoneNumber,
        email: t.email
      })),
      count: matches.length
    });
  } catch (error) {
    console.error('❌ Error searching technician:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ DIAGNOSTIC: Check specific job by job NUMBER (not ID)
router.get('/job/number/:jobNumber/diagnose', async (req, res) => {
  try {
    const { jobNumber } = req.params;

    console.log(`🔍 DIAGNOSTIC: Searching for job number: ${jobNumber}`);

    // Search for job by job number
    const searchEndpoint = global.serviceTitan.buildTenantUrl('jpm') + `/jobs?jobNumber=${jobNumber}`;
    const searchData = await global.serviceTitan.apiCall(searchEndpoint);

    if (!searchData.data || searchData.data.length === 0) {
      return res.json({
        success: false,
        found: false,
        message: `Job #${jobNumber} not found in ServiceTitan`,
        jobNumber: jobNumber
      });
    }

    const job = searchData.data[0];
    console.log(`✅ Found job: ${job.id} - ${job.jobNumber}`);

    // Get all appointments for this job (no date filter, no technician filter)
    let appointments = [];
    try {
      const appointmentEndpoint = global.serviceTitan.buildTenantUrl('jpm') + `/appointments?jobId=${job.id}`;
      const appointmentData = await global.serviceTitan.apiCall(appointmentEndpoint);
      appointments = appointmentData.data || [];
      console.log(`📅 Found ${appointments.length} appointments for job ${jobNumber}`);
    } catch (error) {
      console.warn(`⚠️ Could not fetch appointments:`, error.message);
    }

    // Get customer data
    let customer = null;
    try {
      const customersData = await getCustomersData([job.customerId]);
      customer = customersData.get(job.customerId);
    } catch (error) {
      console.warn(`⚠️ Could not fetch customer:`, error.message);
    }

    res.json({
      success: true,
      found: true,
      jobNumber: jobNumber,
      job: {
        id: job.id,
        jobNumber: job.jobNumber,
        title: global.serviceTitan.cleanJobTitle(job.summary),
        status: job.jobStatus,
        priority: job.priority,
        customerId: job.customerId,
        customerName: customer?.name || 'Unknown',
        createdOn: job.createdOn,
        modifiedOn: job.modifiedOn,
        completedOn: job.completedOn
      },
      appointments: appointments.map(apt => ({
        id: apt.id,
        appointmentNumber: apt.appointmentNumber,
        start: apt.start,
        end: apt.end,
        status: apt.status,
        assignedTechnicianIds: apt.assignedTechnicianIds || [],
        assignedTechnicianCount: apt.assignedTechnicianIds ? apt.assignedTechnicianIds.length : 0
      })),
      diagnosis: {
        totalAppointments: appointments.length,
        appointmentsToday: appointments.filter(apt => {
          const aptDate = new Date(apt.start);
          const today = new Date();
          return aptDate.toDateString() === today.toDateString();
        }).length,
        technicianAssignments: appointments.map(apt => ({
          appointmentId: apt.id,
          start: apt.start,
          technicianIds: apt.assignedTechnicianIds || [],
          note: (apt.assignedTechnicianIds && apt.assignedTechnicianIds.length > 0)
            ? `Assigned to ${apt.assignedTechnicianIds.length} technician(s)`
            : 'No technicians assigned'
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error diagnosing job:', error);
    res.status(500).json({
      success: false,
      error: 'Server error diagnosing job',
      details: error.message
    });
  }
});

// ✅ GET SPECIFIC JOB DETAILS (enhanced with customer data)
router.get('/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    console.log(`📋 Fetching job details: ${jobId}`);

    const endpoint = global.serviceTitan.buildTenantUrl('jpm') + `/jobs/${jobId}`;
    const jobData = await global.serviceTitan.apiCall(endpoint);
    
    // Get customer data
    const customersData = await getCustomersData([jobData.customerId]);
    const customer = customersData.get(jobData.customerId);
    
    // Get all appointments for this job
    let jobAppointments = [];
    try {
      const appointmentEndpoint = global.serviceTitan.buildTenantUrl('jpm') + `/appointments?jobId=${jobId}`;
      const appointmentData = await global.serviceTitan.apiCall(appointmentEndpoint);
      jobAppointments = appointmentData.data || [];
    } catch (appointmentError) {
      console.warn(`⚠️ Could not fetch appointments for job ${jobId}:`, appointmentError.message);
    }
    
    const title = global.serviceTitan.cleanJobTitle(jobData.summary);
    
    const transformedJob = {
      id: jobData.id,
      number: jobData.jobNumber,
      title: title,
      status: jobData.jobStatus,
      priority: jobData.priority,
      
      // ✅ Enhanced customer and location with address
      customer: {
        id: jobData.customerId,
        name: customer?.name || `Customer #${jobData.customerId}`,
        address: customer?.address ? {
          street: customer.address.street,
          unit: customer.address.unit,
          city: customer.address.city,
          state: customer.address.state,
          zip: customer.address.zip,
          fullAddress: formatAddress(customer.address)
        } : null
      },
      location: {
        id: jobData.locationId,
        name: `Location #${jobData.locationId}`
      },
      
      // All appointments for this job
      appointments: jobAppointments.map(apt => ({
        id: apt.id,
        appointmentNumber: apt.appointmentNumber,
        start: apt.start,
        end: apt.end,
        status: apt.status,
        specialInstructions: apt.specialInstructions
      })),
      
      // Business context
      businessUnit: jobData.businessUnitId ? {
        id: jobData.businessUnitId,
        name: `Business Unit #${jobData.businessUnitId}`
      } : null,
      
      // Job details
      type: jobData.jobType,
      category: jobData.category,
      duration: jobData.duration,
      
      // Financial
      total: jobData.total,
      noCharge: jobData.noCharge,
      invoiceId: jobData.invoiceId,
      
      // Timestamps
      scheduledDate: jobData.createdOn,
      createdOn: jobData.createdOn,
      modifiedOn: jobData.modifiedOn,
      completedOn: jobData.completedOn,
      
      // Raw ServiceTitan data for advanced use cases
      serviceTitanData: {
        id: jobData.id,
        jobNumber: jobData.jobNumber,
        summary: jobData.summary,
        jobStatus: jobData.jobStatus,
        customerId: jobData.customerId,
        locationId: jobData.locationId,
        businessUnitId: jobData.businessUnitId,
        createdOn: jobData.createdOn,
        modifiedOn: jobData.modifiedOn
      }
    };
    
    console.log(`✅ Job details fetched: ${transformedJob.number} - ${transformedJob.title}`);
    
    res.json({
      success: true,
      data: transformedJob,
      jobId: jobData.id
    });
    
  } catch (error) {
    console.error('❌ Error fetching job details:', error);
    
    if (error.message.includes('404')) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        jobId: req.params.jobId
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching job details',
      jobId: req.params.jobId
    });
  }
});

// ✅ GET APPOINTMENT DETAILS (for diagnostics)
router.get('/appointment/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;

    console.log(`📅 Fetching appointment details: ${appointmentId}`);

    const endpoint = global.serviceTitan.buildTenantUrl('jpm') + `/appointments/${appointmentId}`;
    const appointmentData = await global.serviceTitan.apiCall(endpoint);

    console.log(`✅ Appointment details fetched: ${appointmentData.appointmentNumber}`);

    res.json({
      success: true,
      data: appointmentData
    });

  } catch (error) {
    console.error('❌ Error fetching appointment details:', error);

    if (error.message.includes('404')) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found',
        appointmentId: req.params.appointmentId
      });
    }

    res.status(500).json({
      success: false,
      error: 'Server error fetching appointment details',
      appointmentId: req.params.appointmentId
    });
  }
});

// ✅ GET CUSTOMER DETAILS endpoint
router.get('/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    console.log(`👤 Fetching customer details: ${customerId}`);
    
    const endpoint = global.serviceTitan.buildTenantUrl('crm') + `/customers/${customerId}`;
    const customerData = await global.serviceTitan.apiCall(endpoint);
    
    console.log(`✅ Customer details fetched: ${customerData.name}`);
    
    res.json({
      success: true,
      data: customerData
    });
    
  } catch (error) {
    console.error('❌ Error fetching customer details:', error);
    
    if (error.message.includes('404')) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
        customerId: req.params.customerId
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching customer details',
      customerId: req.params.customerId
    });
  }
});

// ✅ HELPER FUNCTION: Get customers data with caching
async function getCustomersData(customerIds) {
  const customersMap = new Map();
  const uncachedIds = [];
  
  // Check cache first
  const now = Date.now();
  const cacheExpiry = customersCache.lastFetch + (customersCache.expiryMinutes * 60 * 1000);
  const cacheValid = customersCache.lastFetch && now < cacheExpiry;
  
  customerIds.forEach(id => {
    if (cacheValid && customersCache.data.has(id)) {
      customersMap.set(id, customersCache.data.get(id));
    } else {
      uncachedIds.push(id);
    }
  });
  
  // Fetch uncached customers
  if (uncachedIds.length > 0) {
    console.log(`👥 Fetching customer data for ${uncachedIds.length} customers`);
    
    try {
      // Use CRM export API to get customer data
      const endpoint = global.serviceTitan.buildTenantUrl('crm') + '/export/customers';
      const customerData = await global.serviceTitan.apiCall(endpoint);
      const customers = customerData.data || [];
      
      console.log(`✅ Fetched ${customers.length} customers from CRM API`);
      
      // Update cache
      customers.forEach(customer => {
        customersCache.data.set(customer.id, customer);
        if (uncachedIds.includes(customer.id)) {
          customersMap.set(customer.id, customer);
        }
      });
      
      customersCache.lastFetch = now;
      
    } catch (error) {
      console.warn(`⚠️ Could not fetch customer data:`, error.message);
    }
  }
  
  return customersMap;
}

// ✅ HELPER FUNCTION: Get locations data with caching
async function getLocationsData(locationIds) {
  const locationsMap = new Map();

  if (locationIds.length === 0) {
    return locationsMap;
  }

  console.log(`📍 Fetching location data for ${locationIds.length} locations`);

  try {
    // Fetch locations one by one (ServiceTitan doesn't have bulk location export)
    for (const locationId of locationIds) {
      try {
        const endpoint = global.serviceTitan.buildTenantUrl('crm') + `/locations/${locationId}`;
        const location = await global.serviceTitan.apiCall(endpoint);
        locationsMap.set(locationId, location);
      } catch (error) {
        console.warn(`⚠️ Could not fetch location ${locationId}:`, error.message);
      }
    }

    console.log(`✅ Fetched ${locationsMap.size} locations successfully`);
  } catch (error) {
    console.warn(`⚠️ Error fetching location data:`, error.message);
  }

  return locationsMap;
}

// ✅ HELPER FUNCTION: Format address for display
function formatAddress(address) {
  if (!address) return null;
  
  const parts = [];
  
  // Street address
  if (address.street) {
    let streetPart = address.street;
    if (address.unit) {
      streetPart += ` ${address.unit}`;
    }
    parts.push(streetPart);
  }
  
  // City, State ZIP
  const cityStateZip = [];
  if (address.city) cityStateZip.push(address.city);
  if (address.state) cityStateZip.push(address.state);
  if (address.zip) cityStateZip.push(address.zip);
  
  if (cityStateZip.length > 0) {
    parts.push(cityStateZip.join(', '));
  }
  
  return parts.join(', ');
}

// ✅ HELPER FUNCTION: Get priority score for sorting (lower = higher priority)
function getJobPriorityScore(job) {
  const status = job.status?.toLowerCase() || '';
  const appointmentStatus = job.nextAppointment?.status?.toLowerCase() || '';

  // Highest priority: Arrived/Working
  if (status.includes('arrived') || appointmentStatus.includes('arrived')) return 1;
  if (status.includes('working') || status.includes('inprogress') || status.includes('in progress')) return 2;

  // High priority: Dispatched
  if (status.includes('dispatched') || appointmentStatus.includes('dispatched')) return 3;

  // Medium priority: Scheduled but not yet dispatched
  if (status.includes('scheduled') || appointmentStatus.includes('scheduled')) return 4;

  // Lower priority: Completed/Done
  if (status.includes('completed') || status.includes('done')) return 6;

  // Lowest priority: Canceled/Hold
  if (status.includes('canceled') || status.includes('cancelled')) return 8;
  if (status.includes('hold')) return 7;

  // Default
  return 5;
}

// ✅ HELPER FUNCTION: Group jobs by date (with sort order option)
// Uses Central Time for date grouping to match user's timezone
function groupJobsByDate(jobs, mostRecentFirst = true) {
  const grouped = {};

  jobs.forEach(job => {
    // Use next appointment date for grouping, fallback to job creation date
    const groupingDate = job.nextAppointment?.start
      ? new Date(job.nextAppointment.start)
      : new Date(job.createdOn);
    // Convert to Central Time for date grouping
    const centralDate = toCentralTime(groupingDate);
    const dateKey = centralDate.toDateString();
    const displayDate = centralDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Chicago'
    });

    if (!grouped[dateKey]) {
      grouped[dateKey] = {
        date: dateKey,
        displayDate: displayDate,
        dayOfWeek: centralDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' }),
        shortDate: centralDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' }),
        isToday: isTodayCentral(groupingDate),
        isYesterday: isYesterdayCentral(groupingDate),
        isTomorrow: isTomorrowCentral(groupingDate),
        appointments: [] // Keep this name for backward compatibility with frontend
      };
    }

    grouped[dateKey].appointments.push(job); // Actually jobs, but named appointments for compatibility
  });

  // ✅ Sort jobs within each date group by priority (Arrived/Dispatched first)
  Object.keys(grouped).forEach(dateKey => {
    grouped[dateKey].appointments.sort((a, b) => {
      const scoreA = getJobPriorityScore(a);
      const scoreB = getJobPriorityScore(b);

      if (scoreA !== scoreB) {
        return scoreA - scoreB; // Lower score = higher priority
      }

      // If same priority, sort by appointment start time
      const timeA = a.nextAppointment?.start ? new Date(a.nextAppointment.start).getTime() : 0;
      const timeB = b.nextAppointment?.start ? new Date(b.nextAppointment.start).getTime() : 0;
      return timeA - timeB;
    });
  });
  // ✅ Sort dates chronologically (most recent first or oldest first)
  const sortedDates = Object.keys(grouped).sort((a, b) => {
    const dateA = new Date(a);
    const dateB = new Date(b);
    return mostRecentFirst ? dateB - dateA : dateA - dateB;
  });

  const sortedGrouped = {};
  sortedDates.forEach(dateKey => {
    sortedGrouped[dateKey] = grouped[dateKey];
  });

  return sortedGrouped;
}

// Helper function to convert to Central Time
function toCentralTime(date) {
  // Convert to Central Time (America/Chicago)
  const centralString = date.toLocaleString('en-US', { timeZone: 'America/Chicago' });
  return new Date(centralString);
}

// Helper functions for date comparison (using Central Time)
function isTodayCentral(date) {
  const todayCentral = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const dateCentral = new Date(date.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  return dateCentral.toDateString() === todayCentral.toDateString();
}

function isYesterdayCentral(date) {
  const todayCentral = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const yesterdayCentral = new Date(todayCentral);
  yesterdayCentral.setDate(yesterdayCentral.getDate() - 1);
  const dateCentral = new Date(date.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  return dateCentral.toDateString() === yesterdayCentral.toDateString();
}

function isTomorrowCentral(date) {
  const todayCentral = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const tomorrowCentral = new Date(todayCentral);
  tomorrowCentral.setDate(tomorrowCentral.getDate() + 1);
  const dateCentral = new Date(date.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  return dateCentral.toDateString() === tomorrowCentral.toDateString();
}

module.exports = router;