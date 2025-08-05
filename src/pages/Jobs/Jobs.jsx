// src/pages/Jobs/Jobs.jsx - Enhanced for job-focused API with customer data
import React, { useState, useEffect } from "react";
import apiClient from "../../services/apiClient";

export default function Jobs({ technician, onSelectJob }) {
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
    // ✅ Simplified job data structure
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

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="loading-content text-center">
          <div className="loading-spinner"></div>
          <h2>Loading Your Jobs</h2>
          <p className="text-gray-600">
            Fetching your latest job assignments...
          </p>
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
    );
  }

  const dateKeys = Object.keys(groupedJobs);

  if (dateKeys.length === 0) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h2>No Jobs Found</h2>
          <p className="text-gray-600">No jobs found for the last 2 days.</p>
          <button
            className="btn btn-primary mt-3"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header text-center mb-4">
        <h2> Your Jobs</h2>
        <p className="text-gray-600">
          Showing jobs from 2 days ago to today •{" "}
          <strong>
            {Object.values(groupedJobs).reduce(
              (total, group) => total + group.appointments.length,
              0
            )}
          </strong>{" "}
          total jobs
        </p>
      </div>

      {/* Date-Grouped Jobs */}
      <div className="jobs-timeline">
        {dateKeys.map((dateKey, index) => {
          const dateGroup = groupedJobs[dateKey];
          const {
            displayDate,
            isToday,
            isYesterday,
            appointments: jobs,
          } = dateGroup; // Note: still called "appointments" for API compatibility

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
                  <span className="job-count status-badge status-default">
                    {jobs.length} job{jobs.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Jobs Grid */}
              <div className="jobs-grid grid grid-auto-fit">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="job-card card"
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
                        {/* ✅ Customer Name where Job ID was */}
                        <h4 className="customer-name font-bold text-lg">
                          {job.customer?.name || "Unknown Customer"}
                        </h4>
                        <span className="job-number">#{job.number}</span>
                        {job.priority && job.priority !== "Normal" && (
                          <span
                            className="priority-indicator"
                            title={`Priority: ${job.priority}`}
                          >
                            {getPriorityIcon(job.priority)}
                          </span>
                        )}
                      </div>
                      <span
                        className={`status-badge ${getStatusClass(job.status)}`}
                      >
                        {getStatusIcon(job.status)} {job.status}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="card-body">
                      <div className="job-info">
                        {/* ✅ Shorter job title */}
                        <h5 className="job-title font-semibold mb-2">
                          {job.title}
                        </h5>

                        {/* ✅ Customer address below title */}
                        {job.customer?.address?.fullAddress && (
                          <div className="customer-address text-gray-600 mb-3">
                            📍 {job.customer.address.fullAddress}
                          </div>
                        )}

                        {/* ✅ Centered next appointment info (removed $ amount and appointment count) */}
                        {job.nextAppointment && (
                          <div className="next-appointment-centered text-center">
                            <div className="appointment-time text-gray-700 font-medium">
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
                      <div className="job-metadata">
                        <small className="text-gray-500">
                          Job ID: {job.id}
                        </small>
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
  );
}

// Enhanced Jobs-specific styles
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

.jobs-timeline {
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

.job-count {
  background: rgba(255, 255, 255, 0.2) !important;
  color: var(--white) !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
}

.jobs-grid {
  margin-left: 30px; /* Align with timeline */
}

.job-card {
  cursor: pointer;
  transition: all var(--transition-normal);
  border: 2px solid transparent;
}

.job-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--primary-color);
}

.job-card:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.job-identifier {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.customer-name {
  color: var(--gray-800);
  line-height: 1.2;
  margin: 0;
  font-size: 1.1rem;
}

.job-number {
  font-size: 0.9rem;
  color: var(--gray-600);
  font-weight: 500;
}

.priority-indicator {
  font-size: 1.2rem;
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
}

.job-title {
  color: var(--gray-700);
  line-height: 1.3;
  font-size: 1rem;
}

.customer-address {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
  font-size: 0.9rem;
  line-height: 1.4;
}

.next-appointment-centered {
  padding: var(--spacing-sm);
  background: var(--gray-100);
  border-radius: var(--radius-md);
  border: 1px solid var(--gray-200);
}

.appointment-time {
  margin-bottom: var(--spacing-xs);
  font-size: 0.9rem;
}

.appointment-status-badge {
  font-size: 0.75rem;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.job-metadata {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.view-forms-btn .btn {
  transition: var(--transition-normal);
}

.job-card:hover .view-forms-btn .btn {
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
  
  .jobs-grid {
    margin-left: 0;
  }
  
  .date-indicator {
    display: none;
  }
  
  .job-identifier {
    text-align: left;
  }
  
  .customer-name {
    font-size: 1rem;
  }
  
  .next-appointment-centered {
    padding: var(--spacing-xs);
  }
}
`;

// Inject styles
if (
  typeof document !== "undefined" &&
  !document.getElementById("jobs-styles")
) {
  const style = document.createElement("style");
  style.id = "jobs-styles";
  style.textContent = jobsStyles;
  document.head.appendChild(style);
}
