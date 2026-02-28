import React, { useState } from 'react';
import sessionManager from '../../services/sessionManager';
import type { Technician, Breadcrumb } from '../../types';
import './Header.css';

interface HeaderProps {
  user: Technician | null;
  onLogout: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
  breadcrumbs?: Breadcrumb[];
  pageTitle?: string;
}

export default function Header({
  user,
  onLogout,
  currentPage,
  onNavigate,
  breadcrumbs = [],
  pageTitle,
}: HeaderProps) {
  const [collapsed, setCollapsed] = useState(true);

  const handleLogoClick = () => onNavigate('jobs');

  const canNavigateToItem = (_item: Breadcrumb, index: number) => {
    const currentIndex = breadcrumbs.findIndex((nav) => nav.active);
    return index <= currentIndex;
  };

  const getTechnicianName = () =>
    user?.name ?? sessionManager.getTechnicianName() ?? 'Technician';

  if (collapsed) {
    return (
      <header className="app-header app-header--collapsed">
        <div className="header-collapsed-bar">
          <span className="collapsed-label">Mr. Backflow</span>
          <button
            className="expand-btn"
            onClick={() => setCollapsed(false)}
            aria-label="Expand header"
          >
            ▼
          </button>
        </div>
      </header>
    );
  }

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
              alt="Mr. Backflow Logo"
              className="logo-image"
            />
            <span className="logo-title">Mr. Backflow</span>
          </button>
        </div>

        <div className="header-center">
          {pageTitle ? (
            <div className="page-title">
              <span>{pageTitle}</span>
            </div>
          ) : (
            breadcrumbs.length > 0 && (
              <nav className="breadcrumb-nav" aria-label="Navigation breadcrumb">
                {breadcrumbs.map((item, index) => (
                  <React.Fragment key={item.id}>
                    {index > 0 && <span className="breadcrumb-separator">›</span>}
                    <button
                      className={`breadcrumb-item ${item.active ? 'active' : ''}`}
                      onClick={() =>
                        canNavigateToItem(item, index) ? onNavigate(item.id) : undefined
                      }
                      disabled={!canNavigateToItem(item, index)}
                      title={
                        canNavigateToItem(item, index)
                          ? `Go to ${item.label}`
                          : 'Not available yet'
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
            <span className="user-name">{getTechnicianName()}</span>
          </div>

          <button onClick={onLogout} className="logout-btn" aria-label="Logout">
            Logout
          </button>

          <button
            className="collapse-btn"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse header"
            title="Collapse header for more workspace"
          >
            ▲
          </button>
        </div>
      </div>

      <div className="mobile-nav">
        <div className="mobile-nav-items">
          <button
            className={`mobile-nav-btn ${currentPage === 'jobs' ? 'active' : ''}`}
            onClick={() => onNavigate('jobs')}
          >
            <span className="mobile-nav-icon">💼</span>
            <span className="mobile-nav-label">Jobs</span>
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
