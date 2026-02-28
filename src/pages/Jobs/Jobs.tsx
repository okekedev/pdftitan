// src/pages/Jobs/Jobs.tsx - Clean version with header breadcrumbs
import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';
import type { Technician, Job } from '../../types';
import './Jobs.css';

interface JobsProps {
  technician: Technician;
  onSelectJob: (job: Job) => void;
  onStartBackflowTesting: (job: Job) => void;
  onLogout: () => void;
}

interface DateGroup {
  displayDate: string;
  isToday: boolean;
  isYesterday: boolean;
  appointments: Job[];
}

const STATUS_ORDER: Record<string, number> = {
  inprogress: 1,
  'in progress': 1,
  working: 1,
  arrived: 1,
  dispatched: 2,
  scheduled: 3,
  hold: 4,
  completed: 5,
  done: 5,
  canceled: 6,
  cancelled: 6,
};

function sortJobsByStatus(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => {
    const aOrder = STATUS_ORDER[a.status?.toLowerCase() ?? ''] ?? 7;
    const bOrder = STATUS_ORDER[b.status?.toLowerCase() ?? ''] ?? 7;
    return aOrder - bOrder;
  });
}

function getTestedTime(jobId: number | string): string | null {
  try {
    const raw = localStorage.getItem('mrbackflow_tested_today');
    if (!raw) return null;
    const stored = JSON.parse(raw) as Record<string, Record<string, string>>;
    const today = new Date().toISOString().split('T')[0];
    return stored[today]?.[String(jobId)] ?? null;
  } catch {
    return null;
  }
}

export default function Jobs({ technician, onSelectJob, onStartBackflowTesting, onLogout }: JobsProps) {
  const [groupedJobs, setGroupedJobs] = useState<Record<string, DateGroup>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pendingJob, setPendingJob] = useState<Job | null>(null);

  useEffect(() => {
    const loadJobs = async () => {
      try {
        setIsLoading(true);
        setError('');
        console.log(`🔧 Loading jobs for technician: ${technician?.name}`);
        const response = await apiClient.getMyJobs();
        const grouped = (response.groupedByDate as Record<string, DateGroup>) ?? {};
        setGroupedJobs(grouped);
        // Auto-expand today only
        const todayKey = Object.keys(grouped).find((k) => grouped[k].isToday);
        setExpandedDates(new Set(todayKey ? [todayKey] : Object.keys(grouped).slice(0, 1)));
        console.log(`✅ Loaded jobs grouped into ${Object.keys(grouped).length} days`);
      } catch (err) {
        console.error('❌ Error loading jobs:', err);
        setError(`Failed to load jobs: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (technician?.id) loadJobs();
  }, [technician]);

  const handlePasswordSubmit = () => {
    if (passwordInput === '4533') {
      setShowPasswordDialog(false);
      setPasswordInput('');
      setPasswordError('');
      if (onStartBackflowTesting && pendingJob) {
        onStartBackflowTesting(pendingJob);
      }
      setPendingJob(null);
    } else {
      setPasswordError('Incorrect password. To edit PDF forms, use the "View Forms" button.');
    }
  };

  const handlePasswordCancel = () => {
    setShowPasswordDialog(false);
    setPasswordInput('');
    setPasswordError('');
    setPendingJob(null);
  };

  const getStatusIcon = (status: string | undefined): string => {
    switch (status?.toLowerCase()) {
      case 'scheduled': return '📅';
      case 'dispatched': return '🚚';
      case 'inprogress':
      case 'in progress':
      case 'working': return '🔧';
      case 'hold': return '⏸️';
      case 'completed':
      case 'done': return '✅';
      case 'canceled':
      case 'cancelled': return '❌';
      default: return '📋';
    }
  };

  const getStatusClass = (status: string | undefined): string => {
    switch (status?.toLowerCase()) {
      case 'scheduled': return 'status-scheduled';
      case 'dispatched': return 'status-dispatched';
      case 'inprogress':
      case 'in progress':
      case 'working': return 'status-working';
      case 'hold': return 'status-hold';
      case 'completed':
      case 'done': return 'status-done';
      case 'canceled':
      case 'cancelled': return 'status-canceled';
      default: return 'status-default';
    }
  };

  const getPriorityIcon = (priority: string | undefined): string => {
    switch (priority?.toLowerCase()) {
      case 'urgent': return '🚨';
      case 'high': return '🔴';
      case 'normal': return '🟡';
      case 'low': return '🟢';
      default: return '🟡';
    }
  };

  const formatTime = (dateString: string | undefined): string => {
    if (!dateString) return 'No time set';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const toggleDate = (dateKey: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  const handleJobSelection = (job: Job) => {
    const jobData: Job = {
      id: job.id,
      number: job.number,
      title: job.title,
      status: job.status,
      priority: job.priority,
      customer: job.customer,
      nextAppointment: job.nextAppointment,
    };
    console.log('🔧 Selected job:', jobData);
    onSelectJob(jobData);
  };

  if (isLoading) {
    return (
      <div className="jobs-page">
        <div className="page-container">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <h2>Loading Your Jobs</h2>
            <p>Fetching your latest job assignments...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="jobs-page">
        <div className="page-container">
          <div className="alert alert-error">
            <span>❌</span>
            <div>
              <strong>Error Loading Jobs</strong>
              <p>{error}</p>
            </div>
          </div>
          <div className="text-center mt-4">
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              🔄 Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const dateKeys = Object.keys(groupedJobs);

  if (dateKeys.length === 0) {
    return (
      <div className="jobs-page">
        <div className="page-container">
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h2>No Jobs Found</h2>
            <p>No jobs found for the last 3 days.</p>
            <button className="btn btn-primary mt-3" onClick={() => window.location.reload()}>
              Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="jobs-page">
      <div className="page-container">
        <div className="jobs-timeline">
          {dateKeys.map((dateKey) => {
            const dateGroup = groupedJobs[dateKey];
            const { displayDate, isToday, isYesterday, appointments: rawJobs } = dateGroup;
            const isExpanded = expandedDates.has(dateKey);
            const jobs = sortJobsByStatus(rawJobs);

            return (
              <div key={dateKey} className={`date-section ${isToday ? 'date-section--today' : ''}`}>
                <button
                  className={`date-header date-header--btn ${isExpanded ? 'expanded' : 'collapsed'}`}
                  onClick={() => toggleDate(dateKey)}
                  aria-expanded={isExpanded}
                >
                  <div className="date-header-left">
                    <span className={`date-chevron ${isExpanded ? 'open' : ''}`}>›</span>
                    <span className="date-title">
                      {isToday ? 'Today' : isYesterday ? 'Yesterday' : displayDate}
                    </span>
                    {isToday && <span className="today-badge">Today</span>}
                  </div>
                  <span className="job-count">
                    {jobs.length} job{jobs.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {isExpanded && (
                <div className="jobs-grid">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className={`job-card${getTestedTime(job.id) ? ' job-card--tested' : ''}`}
                      onClick={() => handleJobSelection(job)}
                      role="button"
                      tabIndex={0}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') handleJobSelection(job);
                      }}
                    >
                      {getTestedTime(job.id) && (
                        <div className="tested-today-banner">
                          Tested today at {getTestedTime(job.id)}
                        </div>
                      )}
                      <div className="card-header">
                        <div className="job-identifier">
                          <h4 className="customer-name">{job.customer?.name ?? 'Unknown Customer'}</h4>
                          {job.location?.name && (
                            <p className="location-name">📍 {job.location.name}</p>
                          )}
                          <span className="job-number">#{job.number}</span>
                        </div>
                        <span className={`status-badge ${getStatusClass(job.status)}`}>
                          {getStatusIcon(job.status)} {job.status}
                        </span>
                        {job.priority && job.priority !== 'Normal' && (
                          <span className="priority-indicator" title={`Priority: ${job.priority}`}>
                            {getPriorityIcon(job.priority)}
                          </span>
                        )}
                      </div>

                      <div className="card-body">
                        <div className="job-info">
                          <h5 className="job-title">{job.title}</h5>

                          {job.location?.address?.fullAddress && (
                            <div className="customer-address">
                              📍 {job.location.address.fullAddress}
                            </div>
                          )}

                          {job.nextAppointment && (
                            <div className="next-appointment-centered">
                              <div className="appointment-time">
                                {formatTime(job.nextAppointment.start)}
                                {job.nextAppointment.end && ` - ${formatTime(job.nextAppointment.end)}`}
                              </div>
                              {job.nextAppointment.status && (
                                <span className={`appointment-status-badge ${getStatusClass(job.nextAppointment.status)}`}>
                                  {job.nextAppointment.status}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="card-footer">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            const jobData: Job = {
                              id: job.id,
                              number: job.number,
                              title: job.title,
                              status: job.status,
                              priority: job.priority,
                              customer: job.customer,
                              nextAppointment: job.nextAppointment,
                            };
                            if (import.meta.env.DEV) {
                              setPendingJob(jobData);
                              setShowPasswordDialog(true);
                              setPasswordInput('');
                              setPasswordError('');
                            } else {
                              if (onStartBackflowTesting) onStartBackflowTesting(jobData);
                            }
                          }}
                          title="Start Testing"
                        >
                          <span className="btn btn-sm btn-success">Start</span>
                        </div>
                        <div className="view-forms-btn">
                          <span className="btn btn-sm btn-primary">View Forms →</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showPasswordDialog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 10000,
        }}>
          <div style={{
            backgroundColor: 'white', padding: '2rem', borderRadius: '12px',
            maxWidth: '400px', width: '90%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#333' }}>
              🔐 Dev Access Required
            </h3>
            <p style={{ margin: '0 0 1.5rem 0', color: '#666', fontSize: '0.9rem' }}>
              What's the password to start backflow testing?
            </p>
            <p style={{ margin: '0 0 1rem 0', color: '#0052cc', fontSize: '0.85rem', fontStyle: 'italic' }}>
              💡 Note: To edit PDF forms, use the "View Forms" button.
            </p>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordSubmit(); }}
              placeholder="Enter password"
              autoFocus
              style={{
                width: '100%', padding: '0.75rem', fontSize: '1rem',
                border: passwordError ? '2px solid #ef4444' : '2px solid #e0e0e0',
                borderRadius: '8px', marginBottom: '0.5rem', boxSizing: 'border-box',
              }}
            />
            {passwordError && (
              <p style={{ margin: '0 0 1rem 0', color: '#ef4444', fontSize: '0.85rem' }}>
                ❌ {passwordError}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button onClick={handlePasswordCancel} style={{
                flex: 1, padding: '0.75rem', fontSize: '1rem',
                backgroundColor: '#f3f4f6', color: '#333', border: 'none',
                borderRadius: '8px', cursor: 'pointer', fontWeight: '500',
              }}>
                Cancel
              </button>
              <button onClick={handlePasswordSubmit} style={{
                flex: 1, padding: '0.75rem', fontSize: '1rem',
                backgroundColor: '#0052cc', color: 'white', border: 'none',
                borderRadius: '8px', cursor: 'pointer', fontWeight: '500',
              }}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
