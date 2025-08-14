// src/components/Header.jsx - Clean header component with centered breadcrumb navigation
import React from "react";
import sessionManager from "../../services/sessionManager";
import "./Header.css";

export default function Header({
  user,
  onLogout,
  currentPage,
  onNavigate,
  breadcrumbs = [],
  pageTitle, // New prop for page title
}) {
  const handleLogoClick = () => {
    onNavigate("jobs");
  };

  const canNavigateToItem = (item, index) => {
    const currentIndex = breadcrumbs.findIndex((nav) => nav.active);
    return index <= currentIndex;
  };

  const getTechnicianName = () => {
    return user?.name || sessionManager.getTechnicianName() || "Technician";
  };

  const getSessionStatus = () => {
    const status = sessionManager.getSessionStatus();
    return status;
  };

  const sessionStatus = getSessionStatus();

  return (
    <header className="app-header">
      <div className="header-container">
        <div className="header-left">
          <button
            className="logo-btn"
            onClick={handleLogoClick}
            aria-label="Go to jobs dashboard"
          >
            <img
              src="/web-app-manifest-192x192.png"
              alt="TitanPDF Logo"
              className="logo-image"
            />
            <h1>TitanPDF</h1>
          </button>
        </div>

        {/* Centered breadcrumb navigation or page title */}
        <div className="header-center">
          {pageTitle ? (
            <div className="page-title">
              <h2>{pageTitle}</h2>
            </div>
          ) : (
            breadcrumbs.length > 0 && (
              <nav
                className="breadcrumb-nav"
                aria-label="Navigation breadcrumb"
              >
                {breadcrumbs.map((item, index) => (
                  <React.Fragment key={item.id}>
                    {index > 0 && (
                      <span className="breadcrumb-separator">→</span>
                    )}
                    <button
                      className={`breadcrumb-item ${
                        item.active ? "active" : ""
                      }`}
                      onClick={() =>
                        canNavigateToItem(item, index)
                          ? onNavigate(item.id)
                          : null
                      }
                      disabled={!canNavigateToItem(item, index)}
                      title={
                        canNavigateToItem(item, index)
                          ? `Go to ${item.label}`
                          : "Not available yet"
                      }
                    >
                      {item.label}
                    </button>
                  </React.Fragment>
                ))}
              </nav>
            )
          )}
        </div>

        <div className="header-right">
          <div className="user-info">
            <span className="user-icon"></span>
            <div className="user-details">
              <span className="user-name">{getTechnicianName()}</span>
              <span className="user-role">Technician</span>
            </div>
          </div>

          {/* Session Status Indicator */}
          {/* <div className="session-status" title={sessionStatus.message}>
            <span className={`status-indicator ${sessionStatus.status}`}></span>
            {sessionStatus.status === "expiring_soon" && (
              <span className="session-warning">
                {sessionStatus.timeRemaining}
              </span>
            )}
          </div> */}

          <button
            onClick={onLogout}
            className="logout-btn"
            aria-label="Logout from TitanPDF"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Mobile Navigation (bottom) */}
      <div className="mobile-nav">
        <div className="mobile-nav-items">
          <button
            className={`mobile-nav-btn ${
              currentPage === "jobs" ? "active" : ""
            }`}
            onClick={() => onNavigate("jobs")}
          >
            <span className="mobile-nav-icon">💼</span>
            <span className="mobile-nav-label">Jobs</span>
          </button>
          <button
            className={`mobile-nav-btn ${
              currentPage === "profile" ? "active" : ""
            }`}
            onClick={() => onNavigate("profile")}
          >
            <span className="mobile-nav-icon">👤</span>
            <span className="mobile-nav-label">Profile</span>
          </button>
          <button
            className={`mobile-nav-btn ${
              currentPage === "help" ? "active" : ""
            }`}
            onClick={() => onNavigate("help")}
          >
            <span className="mobile-nav-icon">❓</span>
            <span className="mobile-nav-label">Help</span>
          </button>
          <button className="mobile-nav-btn logout" onClick={onLogout}>
            <span className="mobile-nav-icon">🚪</span>
            <span className="mobile-nav-label">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
