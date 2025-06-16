// src/pages/Jobs/Jobs.js - FIXED: Correct Job ID Passing
import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';
import './Jobs.css';

function Jobs({ technician, onSelectJob }) {
  const [allAppointments, setAllAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter states - DEFAULT TO WORKING STATUS WITH ALL DATES
  const [statusFilter, setStatusFilter] = useState('Working');
  const [dateRangeFilter, setDateRangeFilter] = useState('all'); // Default to all dates
  const [availableStatuses, setAvailableStatuses] = useState([]);

  useEffect(() => {
    const loadAppointments = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        console.log(`🔧 Loading all appointments for technician: ${technician?.name} (ID: ${technician?.id})`);
        
        // Get all appointments (30 days back, all statuses) - server handles customer data fetching
        const appointmentsData = await apiClient.getMyAppointments();
        
        setAllAppointments(appointmentsData);
        
        // Get available statuses for filter dropdown
        const statuses = apiClient.getAvailableStatuses(appointmentsData);
        setAvailableStatuses(statuses);
        
        console.log(`✅ Loaded ${appointmentsData.length} total appointments for ${technician?.name}`);
        console.log(`📊 Available statuses: ${statuses.join(', ')}`);
        
      } catch (error) {
        console.error('❌ Error loading appointments:', error);
        const errorInfo = apiClient.handleApiError(error);
        setError(errorInfo.userMessage || `Failed to load your appointments: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (technician && technician.id) {
      loadAppointments();
    }
  }, [technician]);

  // Apply filters whenever appointments or filters change
  useEffect(() => {
    let filtered = allAppointments;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(appointment => {
        const status = appointment.status?.name || appointment.status;
        return status?.toLowerCase() === statusFilter.toLowerCase();
      });
    }

    // Apply date range filter
    filtered = apiClient.filterAppointmentsByDateRange(filtered, dateRangeFilter);

    setFilteredAppointments(filtered);
    
    console.log(`🔍 Applied filters - Status: ${statusFilter}, Range: ${dateRangeFilter}, Results: ${filtered.length}`);
  }, [allAppointments, statusFilter, dateRangeFilter]);

  const getStatusColor = (status) => {
    const statusName = status?.name || status;
    switch (statusName?.toLowerCase()) {
      case 'scheduled': return 'status-scheduled';
      case 'dispatched': return 'status-dispatched';
      case 'enroute': return 'status-enroute';
      case 'working': return 'status-working';
      case 'hold': return 'status-hold';
      case 'done': return 'status-done';
      case 'canceled': return 'status-canceled';
      default: return 'status-default';
    }
  };

  const getStatusIcon = (status) => {
    const statusName = status?.name || status;
    return apiClient.getAppointmentStatusIcon(statusName);
  };

  const getStatusDisplayName = (status) => {
    return status?.name || status || 'Unknown';
  };

  const formatDate = (dateString) => {
    return apiClient.formatAppointmentDate(dateString);
  };

  // ✅ FIXED: Handle job selection with correct job ID
  const handleJobSelection = (appointment) => {
    console.log('🔧 DEBUG - Raw appointment data:', {
      appointmentId: appointment.id,
      appointmentNumber: appointment.appointmentNumber,
      jobId: appointment.jobId,
      customerName: appointment.customer?.name,
      allKeys: Object.keys(appointment)
    });

    // ✅ CRITICAL: Make sure we're using appointment.jobId, not appointment.id
    const correctJobId = appointment.jobId;
    
    if (!correctJobId) {
      console.error('❌ ERROR: No jobId found in appointment!', appointment);
      alert('Error: This appointment has no associated job ID. Cannot load forms.');
      return;
    }

    const jobData = {
      id: correctJobId, // ✅ MUST be appointment.jobId
      number: appointment.appointmentNumber,
      title: appointment.customer?.name || 'Unknown Customer',
      
      // Keep appointment data for reference
      appointmentId: appointment.id,
      appointmentNumber: appointment.appointmentNumber,
      
      // Include other needed data
      start: appointment.start,
      status: appointment.status,
      customer: appointment.customer
    };

    console.log('🔧 FINAL CHECK - Data being passed to Attachments:', {
      correctJobId: correctJobId,
      jobDataId: jobData.id,
      appointmentId: jobData.appointmentId,
      title: jobData.title,
      shouldMatch: correctJobId === jobData.id ? '✅ MATCH' : '❌ MISMATCH'
    });

    onSelectJob(jobData);
  };

  if (isLoading) {
    return (
      <div className="jobs-container">
        <div className="jobs-header">
          <h2>Loading Your Appointments...</h2>
          <p>Fetching appointments for {technician?.name}...</p>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '200px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e9ecef',
            borderTop: '4px solid #2ecc71',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="jobs-container">
        <div className="jobs-header">
          <h2>Error Loading Appointments</h2>
          <p style={{ color: '#e74c3c' }}>{error}</p>
        </div>
        <div style={{
          background: '#fff',
          padding: '2rem',
          borderRadius: '8px',
          textAlign: 'center',
          marginTop: '1rem'
        }}>
          <button 
            onClick={() => window.location.reload()}
            style={{
              background: '#2ecc71',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="jobs-container">
      <div className="jobs-header">
        <div className="project-info">
          <h2>My Appointments</h2>
          <p>Technician: {technician?.name}</p>
        </div>
        
        {/* Filters */}
        <div className="filters-container" style={{
          display: 'flex',
          gap: '1rem',
          marginTop: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div className="filter-group">
            <label style={{ fontSize: '0.9rem', fontWeight: '500', marginRight: '0.5rem' }}>
              Status:
            </label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '0.9rem'
              }}
            >
              <option value="all">All Statuses</option>
              {availableStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label style={{ fontSize: '0.9rem', fontWeight: '500', marginRight: '0.5rem' }}>
              Date Range:
            </label>
            <select 
              value={dateRangeFilter} 
              onChange={(e) => setDateRangeFilter(e.target.value)}
              style={{
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '0.9rem'
              }}
            >
              <option value="all">All Dates</option>
              <option value="today-tomorrow">Today & Tomorrow</option>
              <option value="today">Today Only</option>
              <option value="tomorrow">Tomorrow Only</option>
              <option value="this-week">This Week</option>
            </select>
          </div>
          
          <div className="results-info" style={{
            marginLeft: 'auto',
            fontSize: '0.9rem',
            color: '#666'
          }}>
            Showing {filteredAppointments.length} of {allAppointments.length} appointments
          </div>
        </div>
      </div>

      {filteredAppointments.length === 0 ? (
        <div style={{
          background: '#fff',
          padding: '3rem',
          borderRadius: '12px',
          textAlign: 'center',
          border: '2px dashed #e9ecef',
          marginTop: '1rem'
        }}>
          <h3 style={{ color: '#666', marginBottom: '1rem' }}>
            No Appointments Found
          </h3>
          <p style={{ color: '#999' }}>
            No appointments match your current filters.<br/>
            Try adjusting the status or date range filters above.
          </p>
        </div>
      ) : (
        <div className="jobs-grid">
          {filteredAppointments.map((appointment) => (
            <div
              key={appointment.id}
              className="job-card"
              onClick={() => handleJobSelection(appointment)} // ✅ FIXED: Use new handler
            >
              <div className="job-content">
                <div className="job-header">
                  <div style={{ flex: 1 }}>
                    <h3 className="job-id" style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      margin: '0 0 0.5rem 0',
                      fontSize: '1.1rem',
                      fontWeight: '700',
                      color: '#2ecc71'
                    }}>
                      {getStatusIcon(appointment.status)} {appointment.customer?.name || 'Unknown Customer'}
                    </h3>
                    <h4 className="job-name" style={{ 
                      margin: '0 0 1rem 0',
                      fontSize: '0.9rem',
                      fontWeight: '500',
                      color: '#666',
                      lineHeight: '1.3'
                    }}>
                      Appointment #{appointment.appointmentNumber}
                    </h4>
                  </div>
                  <div>
                    <span className={`status-badge ${getStatusColor(appointment.status)}`}>
                      {getStatusDisplayName(appointment.status)}
                    </span>
                  </div>
                </div>

                <div className="job-details" style={{
                  display: 'grid',
                  gap: '0.5rem',
                  fontSize: '0.9rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666', fontWeight: '500' }}>Job ID:</span>
                    <span style={{ color: '#333' }}>{appointment.jobId}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666', fontWeight: '500' }}>Date:</span>
                    <span style={{ color: '#333' }}>{formatDate(appointment.start)}</span>
                  </div>
                  {appointment.customer?.address && (
                    <div style={{ 
                      gridColumn: '1 / -1',
                      marginTop: '0.75rem',
                      padding: '0.75rem',
                      background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                      borderRadius: '8px',
                      border: '1px solid #dee2e6',
                      borderLeft: '4px solid #2ecc71'
                    }}>
                      <div style={{ 
                        fontSize: '0.8rem', 
                        color: '#495057', 
                        marginBottom: '0.5rem',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        📍 Service Address
                      </div>
                      <div style={{ 
                        fontSize: '0.9rem', 
                        color: '#212529',
                        fontWeight: '500',
                        lineHeight: '1.4',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}>
                        {appointment.customer.address.fullAddress}
                      </div>
                    </div>
                  )}
                  {appointment.specialInstructions && (
                    <div style={{ 
                      gridColumn: '1 / -1',
                      marginTop: '0.75rem',
                      padding: '0.75rem',
                      background: 'linear-gradient(135deg, #fff8e1 0%, #ffeaa7 30%)',
                      borderRadius: '8px',
                      border: '1px solid #f39c12',
                      borderLeft: '4px solid #f39c12'
                    }}>
                      <div style={{ 
                        fontSize: '0.8rem', 
                        color: '#b8860b', 
                        marginBottom: '0.5rem',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        ⚠️ Special Instructions
                      </div>
                      <div style={{ 
                        fontSize: '0.9rem', 
                        color: '#8b4513',
                        fontWeight: '500',
                        lineHeight: '1.4',
                        fontStyle: 'italic'
                      }}>
                        {appointment.specialInstructions.length > 80 
                          ? `${appointment.specialInstructions.substring(0, 80)}...`
                          : appointment.specialInstructions
                        }
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="job-footer">
                <button className="view-attachments-btn">
                  View Forms →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

export default Jobs;