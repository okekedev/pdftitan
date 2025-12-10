// src/pages/Jobs/Jobs.jsx - Clean version with header breadcrumbs
import React, { useState, useEffect } from "react";
import apiClient from "../../services/apiClient";
import Header from "../../components/Header/Header";
import "./Jobs.css";

export default function Jobs({ technician, onSelectJob, onLogout }) {
  const [groupedJobs, setGroupedJobs] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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
                        <button
                          className="btn-backflow-testing-small"
                          onClick={(e) => {
                            e.stopPropagation();
                            // This will trigger backflow testing for this job
                            // For now, it follows the same flow as clicking the card
                            handleJobSelection(job);
                          }}
                          title="Start Backflow Testing"
                        >
                          Start Backflow Testing
                        </button>
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
    </div>
  );
}