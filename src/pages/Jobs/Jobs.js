// src/pages/Jobs/Jobs.js - Optimized for Technician-Only Portal
import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';
import './Jobs.css';

function Jobs({ technician, onSelectJob }) {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    dateFilter: 'recent' // recent, today, future, all
  });

  useEffect(() => {
    const loadJobs = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        console.log(`🔧 Loading jobs for technician: ${technician?.name} (filter: ${filters.dateFilter})`);
        
        const jobsData = await apiClient.getMyJobs(filters.dateFilter);
        setJobs(jobsData);
        
        console.log(`✅ Loaded ${jobsData.length} jobs for technician`);
        
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
  }, [technician, filters.dateFilter]);

  const getStatusColor = (status) => {
    return apiClient.getJobStatusColor(status);
  };

  const getJobUrgencyIcon = (job) => {
    return apiClient.getJobUrgencyIcon(job);
  };

  const handleSelectJob = (job) => {
    onSelectJob(job);
  };

  const handleDateFilterChange = (newDateFilter) => {
    setFilters(prev => ({ ...prev, dateFilter: newDateFilter }));
  };

  const filteredJobs = jobs.filter(job => {
    if (filters.status !== 'all' && job.status?.toLowerCase() !== filters.status) {
      return false;
    }
    return true;
  });

  // Get filter description
  const getFilterDescription = (filter) => {
    switch (filter) {
      case 'today': return 'Jobs for today';
      case 'future': return 'Future scheduled jobs';
      case 'recent': 
      default: return 'Recent jobs (last 7 days)';
    }
  };

  if (isLoading) {
    return (
      <div className="jobs-container">
        <div className="jobs-header">
          <h2>Loading Your Jobs...</h2>
          <p>Fetching your assigned jobs from ServiceTitan</p>
        </div>
        <div className="loading-spinner" style={{
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
          <h2>My Jobs</h2>
          <p>Your assigned jobs • {technician?.name}</p>
          <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
            {getFilterDescription(filters.dateFilter)}
          </p>
        </div>

        {/* Enhanced Filters */}
        <div className="jobs-filters" style={{
          display: 'flex',
          gap: '1rem',
          marginTop: '1rem',
          padding: '1rem',
          background: '#f8f9fa',
          borderRadius: '6px',
          flexWrap: 'wrap'
        }}>
          {/* Date Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#333' }}>Time Period</label>
            <select 
              value={filters.dateFilter} 
              onChange={(e) => handleDateFilterChange(e.target.value)}
              style={{
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '0.9rem'
              }}
            >
              <option value="recent">Recent (7 days)</option>
              <option value="today">Today</option>
              <option value="future">Future</option>
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#333' }}>Status</label>
            <select 
              value={filters.status} 
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              style={{
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '0.9rem'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="in progress">In Progress</option>
              <option value="on hold">On Hold</option>
              <option value="dispatched">Dispatched</option>
            </select>
          </div>

          <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', color: '#666', fontSize: '0.9rem' }}>
            {filteredJobs.length} of {jobs.length} jobs
          </div>
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <div style={{
          background: '#fff',
          padding: '3rem',
          borderRadius: '12px',
          textAlign: 'center',
          border: '2px dashed #e9ecef',
          marginTop: '1rem'
        }}>
          <h3 style={{ color: '#666', marginBottom: '1rem' }}>No Jobs Found</h3>
          <p style={{ color: '#999' }}>
            {jobs.length === 0 
              ? `No jobs found for ${getFilterDescription(filters.dateFilter).toLowerCase()}`
              : 'No jobs match the selected filters'
            }
          </p>
          {filters.dateFilter !== 'recent' && (
            <button
              onClick={() => handleDateFilterChange('recent')}
              style={{
                background: '#2ecc71',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                marginTop: '1rem'
              }}
            >
              Show Recent Jobs
            </button>
          )}
        </div>
      ) : (
        <div className="jobs-grid">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="job-card"
              onClick={() => handleSelectJob(job)}
            >
              <div className="job-content">
                <div className="job-header" style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem'
                }}>
                  <div style={{ flex: 1 }}>
                    <h3 className="job-id" style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      margin: '0 0 0.5rem 0'
                    }}>
                      {getJobUrgencyIcon(job)} {job.number}
                    </h3>
                    <h4 className="job-name" style={{ 
                      margin: '0',
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#333',
                      lineHeight: '1.3'
                    }}>
                      {job.title || 'Service Call'}
                    </h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span className={`status-badge ${getStatusColor(job.status)}`}>
                      {job.status || 'Unknown'}
                    </span>
                  </div>
                </div>

                <div className="job-details">
                  <div className="detail-row">
                    <span className="detail-label">Customer</span>
                    <span className="detail-value">{job.customer?.name || 'Unknown Customer'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Location</span>
                    <span className="detail-value">{job.location?.name || 'Unknown Location'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Job Type</span>
                    <span className="detail-value">{job.jobType || 'Service Call'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Scheduled</span>
                    <span className="detail-value">
                      {apiClient.formatJobDate(job.scheduledDate)}
                    </span>
                  </div>
                  {job.businessUnit && (
                    <div className="detail-row">
                      <span className="detail-label">Department</span>
                      <span className="detail-value">{job.businessUnit}</span>
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

      {/* Debug Info for Development */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          background: '#f8f9fa',
          borderRadius: '6px',
          fontSize: '0.8rem',
          color: '#666'
        }}>
          <strong>Debug Info:</strong>
          <br />
          Total Jobs: {jobs.length} | Filtered: {filteredJobs.length} | 
          Date Filter: {filters.dateFilter} | Status Filter: {filters.status}
          <br />
          Technician: {technician?.name} (ID: {technician?.id})
        </div>
      )}
    </div>
  );
}

export default Jobs;