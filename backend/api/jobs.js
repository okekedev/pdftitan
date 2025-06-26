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
    const { startDate, endDate } = global.serviceTitan.getDateRange(2);
    
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
            
            // ✅ Enhanced customer info with address
            customer: {
              id: job.customerId,
              name: customer?.name || `Customer #${job.customerId}`,
              address: customer?.address ? {
                street: customer.address.street,
                unit: customer.address.unit,
                city: customer.address.city,
                state: customer.address.state,
                zip: customer.address.zip,
                // Format address for display
                fullAddress: formatAddress(customer.address)
              } : null
            },
            
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
        description: '2 days back to today'
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

// ✅ HELPER FUNCTION: Group jobs by date (with sort order option)
function groupJobsByDate(jobs, mostRecentFirst = true) {
  const grouped = {};
  
  jobs.forEach(job => {
    // Use next appointment date for grouping, fallback to job creation date
    const groupingDate = job.nextAppointment?.start 
      ? new Date(job.nextAppointment.start)
      : new Date(job.createdOn);
    
    const dateKey = groupingDate.toDateString();
    const displayDate = groupingDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    if (!grouped[dateKey]) {
      grouped[dateKey] = {
        date: dateKey,
        displayDate: displayDate,
        dayOfWeek: groupingDate.toLocaleDateString('en-US', { weekday: 'long' }),
        shortDate: groupingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        isToday: isToday(groupingDate),
        isYesterday: isYesterday(groupingDate),
        isTomorrow: isTomorrow(groupingDate),
        appointments: [] // Keep this name for backward compatibility with frontend
      };
    }
    
    grouped[dateKey].appointments.push(job); // Actually jobs, but named appointments for compatibility
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

// Helper functions for date comparison
function isToday(date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function isYesterday(date) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
}

function isTomorrow(date) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return date.toDateString() === tomorrow.toDateString();
}

module.exports = router;