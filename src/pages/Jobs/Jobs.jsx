// src/pages/Jobs/Jobs.jsx - Clean version with header breadcrumbs
import React, { useState, useEffect } from "react";
import apiClient from "../../services/apiClient";
import Header from "../../components/Header/Header";
import "./Jobs.css";

export default function Jobs({ technician, onSelectJob, onStartBackflowTesting, onLogout }) {
  const [groupedJobs, setGroupedJobs] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pendingJob, setPendingJob] = useState(null);

  useEffect(() => {
    const loadJobs = async () => {
      try {
        setIsLoading(true);
        setError("");

        console.log(`🔧 Loading jobs for technician: ${technician?.name}`);

        // ✅ Updated to use job-focused API
        const response = await apiClient.getMyJobs();
        setGroupedJobs(response.groupedByDate || {});

        console.log(
          `✅ Loaded jobs grouped into ${
            Object.keys(response.groupedByDate || {}).length
          } days`
        );
      } catch (error) {
        console.error("❌ Error loading jobs:", error);
        setError(`Failed to load jobs: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (technician?.id) {
      loadJobs();
    }
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

  const getStatusIcon = (status) => {
    const statusName = status?.toLowerCase?.() || status;
    switch (statusName) {
      case "scheduled":
        return "📅";
      case "dispatched":
        return "🚚";
      case "inprogress":
      case "in progress":
        return "🔧";
      case "working":
        return "🔧";
      case "hold":
        return "⏸️";
      case "completed":
      case "done":
        return "✅";
      case "canceled":
      case "cancelled":
        return "❌";
      default:
        return "📋";
    }
  };

  const getStatusClass = (status) => {
    const statusName = status?.toLowerCase?.() || status;
    switch (statusName) {
      case "scheduled":
        return "status-scheduled";
      case "dispatched":
        return "status-dispatched";
      case "inprogress":
      case "in progress":
      case "working":
        return "status-working";
      case "hold":
        return "status-hold";
      case "completed":
      case "done":
        return "status-done";
      case "canceled":
      case "cancelled":
        return "status-canceled";
      default:
        return "status-default";
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority?.toLowerCase()) {
      case "urgent":
        return "🚨";
      case "high":
        return "🔴";
      case "normal":
        return "🟡";
      case "low":
        return "🟢";
      default:
        return "🟡";
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return "No time set";
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleJobSelection = (job) => {
    const jobData = {
      id: job.id,
      number: job.number,
      title: job.title,
      status: job.status,
      priority: job.priority,
      customer: job.customer,
      nextAppointment: job.nextAppointment,
    };

    console.log("🔧 Selected job:", jobData);
    onSelectJob(jobData);
  };

  // Create breadcrumbs for header - Jobs page is the base, so just show current page
  const totalJobs = Object.values(groupedJobs).reduce(
    (total, group) => total + group.appointments.length,
    0
  );

  const breadcrumbs = [
    { 
      id: 'jobs', 
      label: `Your Jobs (${totalJobs} jobs)`, 
      active: true 
    }
  ];

  if (isLoading) {
    return (
      <div className="jobs-page">
        <Header 
          user={technician} 
          onLogout={onLogout} 
          currentPage="jobs"
          onNavigate={() => {}}
          breadcrumbs={breadcrumbs}
        />
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
        <Header 
          user={technician} 
          onLogout={onLogout} 
          currentPage="jobs"
          onNavigate={() => {}}
          breadcrumbs={breadcrumbs}
        />
        <div className="page-container">
          <div className="alert alert-error">
            <span>❌</span>
            <div>
              <strong>Error Loading Jobs</strong>
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
      </div>
    );
  }

  const dateKeys = Object.keys(groupedJobs);

  if (dateKeys.length === 0) {
    return (
      <div className="jobs-page">
        <Header 
          user={technician} 
          onLogout={onLogout} 
          currentPage="jobs"
          onNavigate={() => {}}
          breadcrumbs={breadcrumbs}
        />
        <div className="page-container">
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h2>No Jobs Found</h2>
            <p>No jobs found for the last 2 days.</p>
            <button
              className="btn btn-primary mt-3"
              onClick={() => window.location.reload()}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="jobs-page">
      <Header 
        user={technician} 
        onLogout={onLogout} 
        currentPage="jobs"
        onNavigate={() => {}}
        breadcrumbs={breadcrumbs}
      />
      <div className="page-container">
        {/* Date-Grouped Jobs */}
        <div className="jobs-timeline">
          {dateKeys.map((dateKey, index) => {
            const dateGroup = groupedJobs[dateKey];
            const {
              displayDate,
              isToday,
              isYesterday,
              appointments: jobs,
            } = dateGroup;

            return (
              <div key={dateKey} className="date-section">
                {/* Date Header */}
                <div className="date-header">
                  <div className="date-indicator">
                    <div
                      className={`date-dot ${
                        isToday ? "today" : isYesterday ? "yesterday" : "past"
                      }`}
                    ></div>
                    {index < dateKeys.length - 1 && (
                      <div className="date-line"></div>
                    )}
                  </div>
                  <div className="date-info">
                    <h3 className="date-title">
                      {isToday && "🎯 "}
                      {isYesterday && "⏮ "}
                      {displayDate}
                      {isToday && " (Today)"}
                      {isYesterday && " (Yesterday)"}
                    </h3>
                    <span className="job-count">
                      {jobs.length} job{jobs.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Jobs Grid */}
                <div className="jobs-grid">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className="job-card"
                      onClick={() => handleJobSelection(job)}
                      role="button"
                      tabIndex={0}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          handleJobSelection(job);
                        }
                      }}
                    >
                      {/* Card Header */}
                      <div className="card-header">
                        <div className="job-identifier">
                          <h4 className="customer-name">
                            {job.customer?.name || "Unknown Customer"}
                          </h4>
                          <span className="job-number">#{job.number}</span>
                        </div>
                        <span
                          className={`status-badge ${getStatusClass(job.status)}`}
                        >
                          {getStatusIcon(job.status)} {job.status}
                        </span>
                        {job.priority && job.priority !== "Normal" && (
                          <span
                            className="priority-indicator"
                            title={`Priority: ${job.priority}`}
                          >
                            {getPriorityIcon(job.priority)}
                          </span>
                        )}
                      </div>

                      {/* Card Body */}
                      <div className="card-body">
                        <div className="job-info">
                          <h5 className="job-title">{job.title}</h5>

                          {job.customer?.address?.fullAddress && (
                            <div className="customer-address">
                              📍 {job.customer.address.fullAddress}
                            </div>
                          )}

                          {job.nextAppointment && (
                            <div className="next-appointment-centered">
                              <div className="appointment-time">
                                {formatTime(job.nextAppointment.start)}
                                {job.nextAppointment.end &&
                                  ` - ${formatTime(job.nextAppointment.end)}`}
                              </div>
                              {job.nextAppointment.status && (
                                <span
                                  className={`appointment-status-badge ${getStatusClass(
                                    job.nextAppointment.status
                                  )}`}
                                >
                                  {job.nextAppointment.status}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="card-footer">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();

                            const jobData = {
                              id: job.id,
                              number: job.number,
                              title: job.title,
                              status: job.status,
                              priority: job.priority,
                              customer: job.customer,
                              nextAppointment: job.nextAppointment,
                            };

                            // Password prompt for dev environment
                            if (process.env.NODE_ENV === 'development') {
                              setPendingJob(jobData);
                              setShowPasswordDialog(true);
                              setPasswordInput('');
                              setPasswordError('');
                            } else {
                              // In production, go directly to backflow testing
                              if (onStartBackflowTesting) {
                                onStartBackflowTesting(jobData);
                              }
                            }
                          }}
                          title="Start Testing"
                        >
                          <span className="btn btn-sm btn-success">
                            Start
                          </span>
                        </div>
                        <div className="view-forms-btn">
                          <span className="btn btn-sm btn-primary">
                            View Forms →
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

      {/* Password Dialog */}
      {showPasswordDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handlePasswordSubmit();
                }
              }}
              placeholder="Enter password"
              autoFocus
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: passwordError ? '2px solid #ef4444' : '2px solid #e0e0e0',
                borderRadius: '8px',
                marginBottom: '0.5rem',
                boxSizing: 'border-box',
              }}
            />
            {passwordError && (
              <p style={{ margin: '0 0 1rem 0', color: '#ef4444', fontSize: '0.85rem' }}>
                ❌ {passwordError}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                onClick={handlePasswordCancel}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  fontSize: '1rem',
                  backgroundColor: '#f3f4f6',
                  color: '#333',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  fontSize: '1rem',
                  backgroundColor: '#0052cc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}