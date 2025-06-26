// backend/api/appointments.js - Appointments API (2 Days Back to Today Only)
const express = require('express');
const router = express.Router();

// ✅ GET APPOINTMENTS - 2 DAYS BACK TO TODAY ONLY
router.get('/technician/:technicianId/appointments', async (req, res) => {
  try {
    const { technicianId } = req.params;
    const { authenticateServiceTitan } = req.app.locals.helpers;
    
    console.log(`📅 Fetching appointments for technician ID: ${technicianId} (2 days back to today only)`);
    
    const tokenResult = await authenticateServiceTitan();
    if (!tokenResult.success) {
      return res.status(500).json({
        success: false,
        error: 'ServiceTitan authentication failed'
      });
    }
    
    const fetch = (await import('node-fetch')).default;
    const tenantId = process.env.REACT_APP_SERVICETITAN_TENANT_ID;
    const appKey = process.env.REACT_APP_SERVICETITAN_APP_KEY;
    const apiBaseUrl = process.env.REACT_APP_SERVICETITAN_API_BASE_URL;
    const accessToken = tokenResult.accessToken;
    
    // ✅ MODIFIED DATE RANGE: 2 days back to end of today
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 2); // 2 days back
    startDate.setHours(0, 0, 0, 0); // Start of day
    
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999); // End of today
    
    console.log(`📅 Date Range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
    
    let allAppointments = [];
    let page = 1;
    let hasMorePages = true;
    const pageSize = 500;
    
    while (hasMorePages) {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        technicianIds: technicianId,
        startsOnOrAfter: startDate.toISOString(),
        startsOnOrBefore: endDate.toISOString()
      });
      
      const appointmentsUrl = `${apiBaseUrl}/jpm/v2/tenant/${tenantId}/appointments?${queryParams}`;
      
      try {
        const appointmentsResponse = await fetch(appointmentsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'ST-App-Key': appKey,
            'Content-Type': 'application/json'
          }
        });

        if (!appointmentsResponse.ok) {
          const errorText = await appointmentsResponse.text();
          console.error(`❌ ServiceTitan Appointments API error: ${appointmentsResponse.status} - ${errorText}`);
          throw new Error(`API error: ${appointmentsResponse.statusText}`);
        }

        const appointmentsData = await appointmentsResponse.json();
        const pageAppointments = appointmentsData.data || [];
        
        console.log(`📄 Page ${page}: Found ${pageAppointments.length} appointments`);
        
        allAppointments = allAppointments.concat(pageAppointments);
        
        const hasMore = appointmentsData.hasMore || (pageAppointments.length === pageSize);
        
        if (!hasMore || pageAppointments.length === 0) {
          hasMorePages = false;
        } else {
          page++;
          if (page > 10) hasMorePages = false; // Reduced safety limit
          await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
        }
        
      } catch (error) {
        console.error(`❌ Error fetching page ${page}:`, error);
        hasMorePages = false;
      }
    }
    
    console.log(`📊 Total appointments found: ${allAppointments.length}`);
    
    if (allAppointments.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        technicianId: parseInt(technicianId),
        message: 'No appointments found for this technician in the last 2 days'
      });
    }
    
    // ✅ Filter out future appointments at server level (extra safety)
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const filteredAppointments = allAppointments.filter(appointment => {
      if (!appointment.start) return false;
      const appointmentDate = new Date(appointment.start);
      return appointmentDate <= todayEnd; // Only appointments up to end of today
    });
    
    console.log(`🔍 After filtering future appointments: ${filteredAppointments.length} remain`);
    
    // Enrich with customer data
    const enrichedAppointments = await Promise.all(
      filteredAppointments.map(async (appointment) => {
        let customerData = null;
        
        try {
          if (appointment.customerId) {
            const customerUrl = `${apiBaseUrl}/crm/v2/tenant/${tenantId}/customers/${appointment.customerId}`;
            
            const customerResponse = await fetch(customerUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'ST-App-Key': appKey,
                'Content-Type': 'application/json'
              }
            });
            
            if (customerResponse.ok) {
              const customer = await customerResponse.json();
              customerData = {
                id: customer.id,
                name: customer.name || 'Unknown Customer',
                phoneNumber: customer.phoneNumber || null,
                address: customer.address ? {
                  street: customer.address.street || '',
                  city: customer.address.city || '',
                  state: customer.address.state || '',
                  zip: customer.address.zip || '',
                  fullAddress: [
                    customer.address.street,
                    [customer.address.city, customer.address.state].filter(Boolean).join(', '),
                    customer.address.zip
                  ].filter(Boolean).join(' | ') || 'Address not available'
                } : null
              };
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
          
        } catch (error) {
          console.error(`❌ Error fetching customer data for appointment ${appointment.id}:`, error);
        }
        
        return {
          jobId: appointment.jobId,
          appointmentNumber: appointment.appointmentNumber || appointment.number,
          start: appointment.start,
          end: appointment.end,
          arrivalWindowStart: appointment.arrivalWindowStart || null,
          arrivalWindowEnd: appointment.arrivalWindowEnd || null,
          status: appointment.status,
          specialInstructions: appointment.specialInstructions || null,
          
          id: appointment.id,
          customerId: appointment.customerId,
          locationId: appointment.locationId,
          createdOn: appointment.createdOn,
          modifiedOn: appointment.modifiedOn,
          
          assignedToTechnician: true,
          technicianId: parseInt(technicianId),
          
          customer: customerData || {
            id: appointment.customerId,
            name: `Customer #${appointment.customerId}`,
            phoneNumber: null,
            address: null
          }
        };
      })
    );
    
    // Sort by date (oldest to newest)
    const sortedAppointments = enrichedAppointments.sort((a, b) => new Date(a.start) - new Date(b.start));
    
    // Group appointments by day for logging
    const appointmentsByDay = sortedAppointments.reduce((acc, appt) => {
      const day = new Date(appt.start).toLocaleDateString();
      if (!acc[day]) acc[day] = 0;
      acc[day]++;
      return acc;
    }, {});
    
    console.log(`✅ Final results for technician ${technicianId}:`);
    console.log(`📊 Total appointments: ${sortedAppointments.length}`);
    console.log(`📅 Breakdown by day:`, appointmentsByDay);
    
    res.json({
      success: true,
      data: sortedAppointments,
      count: sortedAppointments.length,
      technicianId: parseInt(technicianId),
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        description: '2 days back to today'
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching technician appointments:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching technician appointments'
    });
  }
});

module.exports = router;