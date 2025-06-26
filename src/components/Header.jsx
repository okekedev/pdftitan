// src/components/Layout/Header/Header.jsx - Modern JSX with Global Styles
import React from 'react';
import sessionManager from '../../../services/sessionManager';

export default function Header({ user, onLogout, currentPage, onNavigate, breadcrumbs = [] }) {
  const handleLogoClick = () => {
    onNavigate('jobs');
  };

  const canNavigateToItem = (item, index) => {
    const currentIndex = breadcrumbs.findIndex(nav => nav.active);
    return index <= currentIndex;
  };

  const getTechnicianName = () => {
    return user?.name || sessionManager.getTechnicianName() || 'Technician';
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
            <span className="logo-icon">📋</span>
            <h1>TitanPDF</h1>
          </button>
          
          {breadcrumbs.length > 0 && (
            <nav className="breadcrumb-nav" aria-label="Navigation breadcrumb">
              {breadcrumbs.map((item, index) => (
                <React.Fragment key={item.id}>
                  {index > 0 && <span className="breadcrumb-separator">→</span>}
                  <button
                    className={`breadcrumb-item ${item.active ? 'active' : ''}`}
                    onClick={() => canNavigateToItem(item, index) ? onNavigate(item.id) : null}
                    disabled={!canNavigateToItem(item, index)}
                    title={canNavigateToItem(item, index) ? `Go to ${item.label}` : 'Not available yet'}
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
            <span className="user-icon">👷</span>
            <div className="user-details">
              <span className="user-name">{getTechnicianName()}</span>
              <span className="user-role">Technician</span>
            </div>
          </div>

          {/* Session Status Indicator */}
          <div className="session-status" title={sessionStatus.message}>
            <span className={`status-indicator ${sessionStatus.status}`}></span>
            {sessionStatus.status === 'expiring_soon' && (
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
            🚪 Logout
          </button>
        </div>
      </div>
    </header>
  );
}

// Additional Header-specific styles (minimal since we use global styles)
const headerStyles = `
.session-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  font-size: 0.8rem;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--gray-400);
}

.status-indicator.active {
  background: var(--success-color);
  box-shadow: 0 0 8px rgba(72, 187, 120, 0.5);
}

.status-indicator.expiring_soon {
  background: var(--warning-color);
  box-shadow: 0 0 8px rgba(237, 137, 54, 0.5);
  animation: pulse 2s infinite;
}

.status-indicator.expired {
  background: var(--error-color);
  box-shadow: 0 0 8px rgba(245, 101, 101, 0.5);
}

.session-warning {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

@media (max-width: 768px) {
  .session-status {
    display: none; /* Hide on mobile to save space */
  }
  
  .session-warning {
    display: none;
  }
}
`;

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('header-styles')) {
  const style = document.createElement('style');
  style.id = 'header-styles';
  style.textContent = headerStyles;
  document.head.appendChild(style);
}