// src/pages/Jobs/Jobs.jsx - Modern JSX with Global Styles
import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';

export default function Jobs({ technician, onSelectJob }) {
  const [groupedAppointments, setGroupedAppointments] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAppointments = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        console.log(`🔧 Loading appointments for technician: ${technician?.name}`);
        
        const response = await apiClient.getMyAppointments();
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

  const getStatusClass = (status) => {
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
      <div className="page-container">
        <div className="loading-content text-center">
          <div className="loading-spinner"></div>
          <h2>Loading Your Appointments</h2>
          <p className="text-gray-600">Fetching your latest job assignments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="alert alert-error">
          <span>❌</span>
          <div>
            <strong>Error Loading Appointments</strong>
            <p>{error}</p>
          </div>
        </div>
        <div className="text-center mt-4">
          <button 
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  const dateKeys = Object.keys(groupedAppointments);
  
  if (dateKeys.length === 0) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <h2>No Appointments Found</h2>
          <p className="text-gray-600">
            No appointments found for the last 2 days.
          </p>
          <button 
            className="btn btn-primary mt-3"
            onClick={() => window.location.reload()}
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header text-center mb-4">
        <h2>📅 Your Appointments</h2>
        <p className="text-gray-600">
          Showing appointments from 2 days ago to today • {' '}
          <strong>
            {Object.values(groupedAppointments).reduce((total, group) => total + group.appointments.length, 0)}
          </strong> total appointments
        </p>
      </div>

      {/* Date-Grouped Appointments */}
      <div className="appointments-timeline">
        {dateKeys.map((dateKey, index) => {
          const dateGroup = groupedAppointments[dateKey];
          const { displayDate, isToday, isYesterday, appointments } = dateGroup;
          
          return (
            <div key={dateKey} className="date-section">
              {/* Date Header */}
              <div className="date-header">
                <div className="date-indicator">
                  <div className={`date-dot ${isToday ? 'today' : isYesterday ? 'yesterday' : 'past'}`}></div>
                  {index < dateKeys.length - 1 && <div className="date-line"></div>}
                </div>
                <div className="date-info">
                  <h3 className="date-title">
                    {isToday && '🎯 '}
                    {isYesterday && '⏮️ '}
                    {displayDate}
                    {isToday && ' (Today)'}
                    {isYesterday && ' (Yesterday)'}
                  </h3>
                  <span className="appointment-count status-badge status-default">
                    {appointments.length} appointment{appointments.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Appointments Grid */}
              <div className="appointments-grid grid grid-auto-fit">
                {appointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="appointment-card card"
                    onClick={() => handleJobSelection(appointment)}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleJobSelection(appointment);
                      }
                    }}
                  >
                    {/* Card Header */}
                    <div className="card-header">
                      <div className="appointment-number">
                        <span className="font-bold text-lg">#{appointment.appointmentNumber}</span>
                      </div>
                      <span className={`status-badge ${getStatusClass(appointment.status)}`}>
                        {getStatusIcon(appointment.status)} {appointment.status?.name || appointment.status}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="card-body">
                      <div className="customer-info mb-3">
                        <h4 className="customer-name font-semibold text-lg mb-1">
                          {appointment.customer?.name || 'Unknown Customer'}
                        </h4>
                        
                        <div className="appointment-time text-gray-600 mb-2">
                          🕐 {formatTime(appointment.start)}
                          {appointment.end && ` - ${formatTime(appointment.end)}`}
                        </div>

                        {appointment.summary && (
                          <p className="appointment-summary text-sm text-gray-600">
                            {appointment.summary.length > 120 
                              ? appointment.summary.substring(0, 120) + '...' 
                              : appointment.summary
                            }
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="card-footer">
                      <small className="text-gray-500">
                        Job ID: {appointment.jobId}
                      </small>
                      <div className="view-forms-btn">
                        <span className="btn btn-sm btn-primary">
                          📎 View Forms →
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Additional Jobs-specific styles
const jobsStyles = `
.page-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 var(--spacing-xl);
}

.page-header h2 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--gray-800);
  margin-bottom: var(--spacing-sm);
}

.empty-state {
  text-align: center;
  padding: var(--spacing-2xl) var(--spacing-xl);
  background: var(--white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 2px dashed var(--gray-300);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: var(--spacing-lg);
  opacity: 0.6;
}

.empty-state h2 {
  color: var(--gray-700);
  margin-bottom: var(--spacing-sm);
}

.appointments-timeline {
  position: relative;
}

.date-section {
  margin-bottom: var(--spacing-2xl);
}

.date-header {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.date-indicator {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 1;
}

.date-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--gray-400);
  border: 3px solid var(--white);
  box-shadow: var(--shadow-sm);
}

.date-dot.today {
  background: var(--success-color);
  box-shadow: 0 0 0 4px rgba(72, 187, 120, 0.2);
}

.date-dot.yesterday {
  background: var(--warning-color);
}

.date-dot.past {
  background: var(--gray-400);
}

.date-line {
  width: 2px;
  height: 60px;
  background: var(--gray-300);
  margin-top: var(--spacing-xs);
}

.date-info {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  color: var(--white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.date-title {
  font-size: 1.3rem;
  font-weight: 600;
  margin: 0;
}

.appointment-count {
  background: rgba(255, 255, 255, 0.2) !important;
  color: var(--white) !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
}

.appointments-grid {
  margin-left: 30px; /* Align with timeline */
}

.appointment-card {
  cursor: pointer;
  transition: all var(--transition-normal);
  border: 2px solid transparent;
}

.appointment-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--primary-color);
}

.appointment-card:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.appointment-number {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.customer-name {
  color: var(--gray-800);
  line-height: 1.3;
}

.appointment-time {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 0.9rem;
}

.appointment-summary {
  line-height: 1.4;
}

.view-forms-btn .btn {
  transition: var(--transition-normal);
}

.appointment-card:hover .view-forms-btn .btn {
  background: var(--primary-dark);
  transform: translateX(2px);
}

@media (max-width: 768px) {
  .page-container {
    padding: 0 var(--spacing-md);
  }
  
  .date-header {
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  
  .date-info {
    flex-direction: column;
    gap: var(--spacing-sm);
    text-align: center;
  }
  
  .appointments-grid {
    margin-left: 0;
  }
  
  .date-indicator {
    display: none;
  }
}
`;

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('jobs-styles')) {
  const style = document.createElement('style');
  style.id = 'jobs-styles';
  style.textContent = jobsStyles;
  document.head.appendChild(style);
}