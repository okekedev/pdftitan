// src/pages/Jobs/Jobs.js - Final Simplified Jobs Page
import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';
import './Jobs.css';

function Jobs({ technician, onSelectJob }) {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadJobs = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        console.log(`🔧 Loading active jobs for technician: ${technician?.name}`);
        
        const jobsData = await apiClient.getMyJobs();
        setJobs(jobsData);
        
        console.log(`✅ Loaded ${jobsData.length} active jobs`);
        
      } catch (error) {
        console.error('❌ Error loading jobs:', error);
        const errorInfo = apiClient.handleApiError(error);
        setError(errorInfo.userMessage || `Failed to load your jobs: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (technician) {
      loadJobs();
    }
  }, [technician]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Dispatched': return 'status-dispatched';
      case 'InProgress': return 'status-progress'; // ServiceTitan uses "InProgress" (one word)
      case 'Working': return 'status-working';
      case 'OnHold': return 'status-hold'; // ServiceTitan uses "OnHold" (one word)
      default: return 'status-default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Dispatched': return '🚚';
      case 'InProgress': return '🔧'; // ServiceTitan uses "InProgress" (one word)
      case 'Working': return '⚙️';
      case 'OnHold': return '⏸️'; // ServiceTitan uses "OnHold" (one word)
      default: return '📋';
    }
  };

  const getStatusDisplayName = (status) => {
    switch (status) {
      case 'InProgress': return 'In Progress'; // Display with space for users
      case 'OnHold': return 'On Hold'; // Display with space for users
      case 'Dispatched': return 'Dispatched';
      case 'Working': return 'Working';
      default: return status;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not scheduled';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const jobDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      const diffDays = Math.ceil((jobDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return `Today, ${date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        })}`;
      } else if (diffDays === 1) {
        return `Tomorrow, ${date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        })}`;
      } else if (diffDays === -1) {
        return `Yesterday`;
      } else {
        return date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (error) {
      return 'Invalid date';
    }
  };

  if (isLoading) {
    return (
      <div className="jobs-container">
        <div className="jobs-header">
          <h2>Loading Your Active Jobs...</h2>
          <p>Fetching your active jobs...</p>
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
          <h2>Error Loading Jobs</h2>
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
          <h2>My Active Jobs</h2>
          <p>Technician: {technician?.name}</p>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div style={{
          background: '#fff',
          padding: '3rem',
          borderRadius: '12px',
          textAlign: 'center',
          border: '2px dashed #e9ecef',
          marginTop: '1rem'
        }}>
          <h3 style={{ color: '#666', marginBottom: '1rem' }}>No Active Jobs</h3>
          <p style={{ color: '#999' }}>
            You currently have no active jobs assigned.
          </p>
        </div>
      ) : (
        <div className="jobs-grid">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="job-card"
              onClick={() => onSelectJob(job)}
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
                      {getStatusIcon(job.status)} {job.number}
                    </h3>
                    <h4 className="job-name" style={{ 
                      margin: '0 0 1rem 0',
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#333',
                      lineHeight: '1.3'
                    }}>
                      {job.title}
                    </h4>
                  </div>
                  <div>
                    <span className={`status-badge ${getStatusColor(job.status)}`}>
                      {getStatusDisplayName(job.status)}
                    </span>
                  </div>
                </div>

                <div className="job-details" style={{
                  display: 'grid',
                  gap: '0.5rem',
                  fontSize: '0.9rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666', fontWeight: '500' }}>Customer:</span>
                    <span style={{ color: '#333' }}>{job.customer?.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666', fontWeight: '500' }}>Scheduled:</span>
                    <span style={{ color: '#333' }}>{formatDate(job.scheduledDate)}</span>
                  </div>
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