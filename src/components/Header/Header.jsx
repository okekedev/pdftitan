// src/components/Header.jsx - Clean header component with external CSS
import React from "react";
import sessionManager from "../services/sessionManager";
import './Header.css';

export default function Header({
  user,
  onLogout,
  currentPage,
  onNavigate,
  breadcrumbs = [],
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

          {breadcrumbs.length > 0 && (
            <nav className="breadcrumb-nav" aria-label="Navigation breadcrumb">
              {breadcrumbs.map((item, index) => (
                <React.Fragment key={item.id}>
                  {index > 0 && <span className="breadcrumb-separator">→</span>}
                  <button
                    className={`breadcrumb-item ${item.active ? "active" : ""}`}
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
          <div className="session-status" title={sessionStatus.message}>
            <span className={`status-indicator ${sessionStatus.status}`}></span>
            {sessionStatus.status === "expiring_soon" && (
              <span className="session-warning">
                {sessionStatus.timeRemaining}
              </span>
            )}
          </div>

          <button
            onClick={onLogout}
            className="logout-btn"
            aria-label="Logout from TitanPDF"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}