// api/appointments.js - Fixed to use global serviceTitan
const express = require('express');
const router = express.Router();

// ✅ GET APPOINTMENTS using global serviceTitan
router.get('/technician/:technicianId/appointments', async (req, res) => {
  try {
    const { technicianId } = req.params;
    
    console.log(`📅 Fetching appointments for technician ID: ${technicianId}`);
    
    const { startDate, endDate } = global.serviceTitan.getDateRange(2);
    
    console.log(`📅 Date Range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
    
    // Fetch appointments with pagination
    let allAppointments = [];
    let page = 1;
    let hasMorePages = true;
    const pageSize = 500;
    
    while (hasMorePages && page <= 20) {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        technicianIds: technicianId,
        startsOnOrAfter: startDate.toISOString(),
        startsOnOrBefore: endDate.toISOString()
      });
      
      const endpoint = global.serviceTitan.buildTenantUrl('jpm') + `/appointments?${queryParams}`;
      const data = await global.serviceTitan.apiCall(endpoint);
      
      const appointments = data.data || [];
      allAppointments = allAppointments.concat(appointments);
      
      hasMorePages = appointments.length === pageSize && data.hasMore !== false;
      page++;
    }
    
    // Filter and transform appointments
    const validAppointments = allAppointments
      .filter(appointment => appointment.assignedTechnician === parseInt(technicianId))
      .map(appointment => ({
        id: appointment.id,
        appointmentNumber: appointment.appointmentNumber,
        jobId: appointment.jobId,
        summary: appointment.summary,
        start: appointment.start,
        end: appointment.end,
        status: appointment.status,
        customerId: appointment.customerId,
        customer: {
          id: appointment.customerId,
          name: `Customer #${appointment.customerId}`
        }
      }))
      .sort((a, b) => new Date(a.start) - new Date(b.start));
    
    // Group by date
    const groupedByDate = groupAppointmentsByDate(validAppointments);
    
    console.log(`✅ Found ${validAppointments.length} appointments grouped into ${Object.keys(groupedByDate).length} days`);
    
    res.json({
      success: true,
      data: validAppointments,
      groupedByDate: groupedByDate,
      count: validAppointments.length,
      technicianId: parseInt(technicianId),
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        description: '2 days back to today'
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching appointments:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error fetching appointments'
    });
  }
});

// Helper function to group appointments by date
function groupAppointmentsByDate(appointments) {
  const grouped = {};
  
  appointments.forEach(appointment => {
    if (!appointment.start) return;
    
    const appointmentDate = new Date(appointment.start);
    const dateKey = appointmentDate.toDateString();
    const displayDate = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    if (!grouped[dateKey]) {
      grouped[dateKey] = {
        date: dateKey,
        displayDate: displayDate,
        dayOfWeek: appointmentDate.toLocaleDateString('en-US', { weekday: 'long' }),
        shortDate: appointmentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        isToday: isToday(appointmentDate),
        isYesterday: isYesterday(appointmentDate),
        isTomorrow: isTomorrow(appointmentDate),
        appointments: []
      };
    }
    
    grouped[dateKey].appointments.push(appointment);
  });
  
  // Sort dates chronologically
  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));
  const sortedGrouped = {};
  
  sortedDates.forEach(dateKey => {
    sortedGrouped[dateKey] = grouped[dateKey];
  });
  
  return sortedGrouped;
}

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