// src/components/layout/Header/Header.js - Simplified for Technician Portal
import React from 'react';
import sessionManager from '../../../services/sessionManger';
import './Header.css';

function Header({ user, onLogout, currentPage, onNavigate, breadcrumbs }) {
  const handleLogoClick = () => {
    // Logo click takes technicians back to their jobs
    onNavigate('jobs');
  };

  const canNavigateToItem = (item, index) => {
    // Technicians can navigate to current item or previous items in the breadcrumb
    const currentIndex = breadcrumbs.findIndex(nav => nav.active);
    return index <= currentIndex;
  };

  const getTechnicianName = () => {
    return user?.technician?.name || 'Unknown User';
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <h1 onClick={handleLogoClick} className="logo">
            TitanPDF
          </h1>
          
          <nav className="breadcrumb-nav">
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
        </div>
        
        <div className="header-right">
          <div className="user-info">
            <span className="user-name">{getTechnicianName()}</span>
          </div>
          
          <button onClick={onLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;