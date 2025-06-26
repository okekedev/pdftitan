// src/pages/Jobs/Jobs.js - Simplified with Server-Side Date Grouping
import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';
import './Jobs.css';

function Jobs({ technician, onSelectJob }) {
  const [groupedAppointments, setGroupedAppointments] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAppointments = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        console.log(`🔧 Loading appointments for technician: ${technician?.name}`);
        
        // Server now returns appointments already grouped by date
        const response = await apiClient.getMyAppointments();
        
        // Use the pre-grouped data from server
        setGroupedAppointments(response.groupedByDate || {});
        
        console.log(`✅ Loaded appointments grouped into ${Object.keys(response.groupedByDate || {}).length} days`);
        
      } catch (error) {
        console.error('❌ Error loading appointments:', error);
        setError(`Failed to load appointments: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (technician?.id) {
      loadAppointments();
    }
  }, [technician]);

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
    switch (statusName?.toLowerCase()) {
      case 'scheduled': return '📅';
      case 'dispatched': return '🚚';
      case 'enroute': return '🛣️';
      case 'working': return '🔧';
      case 'hold': return '⏸️';
      case 'done': return '✅';
      case 'canceled': return '❌';
      default: return '📋';
    }
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleJobSelection = (appointment) => {
    const jobData = {
      id: appointment.jobId,
      number: appointment.appointmentNumber,
      title: appointment.customer?.name || 'Unknown Customer',
      appointmentId: appointment.id,
      appointmentNumber: appointment.appointmentNumber,
      start: appointment.start,
      status: appointment.status,
      customer: appointment.customer
    };

    console.log('🔧 Selected job:', jobData);
    onSelectJob(jobData);
  };

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="loading-spinner">Loading appointments...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
        <h3>Error Loading Appointments</h3>
        <p>{error}</p>
      </div>
    );
  }

  const dateKeys = Object.keys(groupedAppointments);
  
  if (dateKeys.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h3>No Appointments Found</h3>
        <p>No appointments found for the last 2 days.</p>
      </div>
    );
  }

  return (
    <div className="jobs-container">
      <div className="jobs-header">
        <h2>📅 Your Appointments</h2>
        <p>Showing appointments from 2 days ago to today</p>
      </div>

      {/* ✅ RENDER APPOINTMENTS GROUPED BY DATE */}
      {dateKeys.map(dateKey => {
        const dateGroup = groupedAppointments[dateKey];
        const { displayDate, isToday, isYesterday, appointments } = dateGroup;
        
        return (
          <div key={dateKey} className="date-section">
            {/* Date Header */}
            <div className="date-header">
              <h3>
                {isToday && '🎯 '}
                {isYesterday && '⏮️ '}
                {displayDate}
                {isToday && ' (Today)'}
                {isYesterday && ' (Yesterday)'}
              </h3>
              <span className="appointment-count">
                {appointments.length} appointment{appointments.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Appointments for this date */}
            <div className="appointments-grid">
              {appointments.map(appointment => (
                <div
                  key={appointment.id}
                  className={`appointment-card ${getStatusColor(appointment.status)}`}
                  onClick={() => handleJobSelection(appointment)}
                >
                  <div className="appointment-header">
                    <span className="appointment-number">
                      #{appointment.appointmentNumber}
                    </span>
                    <span className={`status-badge ${getStatusColor(appointment.status)}`}>
                      {getStatusIcon(appointment.status)} {appointment.status?.name || appointment.status}
                    </span>
                  </div>

                  <div className="appointment-details">
                    <div className="customer-name">
                      {appointment.customer?.name || 'Unknown Customer'}
                    </div>
                    
                    <div className="appointment-time">
                      🕐 {formatTime(appointment.start)}
                      {appointment.end && ` - ${formatTime(appointment.end)}`}
                    </div>

                    {appointment.summary && (
                      <div className="appointment-summary">
                        {appointment.summary.length > 100 
                          ? appointment.summary.substring(0, 100) + '...' 
                          : appointment.summary
                        }
                      </div>
                    )}
                  </div>

                  <div className="appointment-footer">
                    <small>Job ID: {appointment.jobId}</small>
                    <button className="select-button">
                      View Forms →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Jobs;