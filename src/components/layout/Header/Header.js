import React from 'react';
import apiClient from '../../../services/apiClient';
import sessionManager from '../../../services/sessionManger';
import './Header.css';

function Header({ user, onLogout, currentPage, onNavigate, breadcrumbs, userInfo }) {
  // Get user info if not provided
  const currentUserInfo = userInfo || apiClient.getCurrentUserInfo();
  
  // Use provided breadcrumbs or create default based on user type
  const navigationItems = breadcrumbs || getDefaultBreadcrumbs(currentUserInfo, currentPage);

  function getDefaultBreadcrumbs(userInfo, currentPage) {
    if (userInfo?.isTechnician) {
      // Technicians only see: Jobs -> Attachments
      return [
        { id: 'jobs', label: 'My Jobs', active: currentPage === 'jobs' || currentPage === 'attachments' },
        { id: 'attachments', label: 'Forms', active: currentPage === 'attachments' }
      ];
    } else {
      // Admins see: Projects -> Jobs -> Attachments
      return [
        { id: 'projects', label: 'Projects', active: currentPage === 'projects' || currentPage === 'jobs' || currentPage === 'attachments' },
        { id: 'jobs', label: 'Jobs', active: currentPage === 'jobs' || currentPage === 'attachments' },
        { id: 'attachments', label: 'Forms', active: currentPage === 'attachments' }
      ];
    }
  }

  const handleLogoClick = () => {
    // Logo click behavior based on user type
    if (currentUserInfo?.isTechnician) {
      // Technicians go to jobs page
      onNavigate('jobs');
    } else {
      // Admins go to projects page
      onNavigate('projects');
    }
  };

  const canNavigateToItem = (item, index) => {
    // Users can navigate to current item or previous items in the breadcrumb
    const currentIndex = navigationItems.findIndex(nav => nav.active);
    return index <= currentIndex;
  };

  const getUserDisplayInfo = () => {
    // Get user display information from the session structure
    const employeeName = user?.employee?.name || user?.name || 'Unknown User';
    const companyName = user?.company?.name || user?.company || 'Unknown Company';
    
    return {
      name: employeeName,
      company: companyName
    };
  };

  const getNavigationDescription = () => {
    if (currentUserInfo?.isTechnician) {
      return 'Technician Portal';
    } else if (currentUserInfo?.isAdmin) {
      return sessionManager?.hasAdminSuperAccess() ? 'Admin Portal' : 'Administrator';
    } else {
      return 'User Portal';
    }
  };

  const userDisplayInfo = getUserDisplayInfo();

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <h1 onClick={handleLogoClick} className="logo">
            TitanPDF
          </h1>
          
          <nav className="breadcrumb-nav">
            {navigationItems.map((item, index) => (
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
            <span className="user-name">{userDisplayInfo.name}</span>
            <span className="user-company">
              {getNavigationDescription()} • {userDisplayInfo.company}
            </span>
          </div>
          
          {/* Admin Status Indicator */}
          {currentUserInfo?.isAdmin && (
            <div className="admin-status" style={{
              background: 'rgba(46, 204, 113, 0.2)',
              color: '#27ae60',
              padding: '0.25rem 0.75rem',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: '600',
              border: '1px solid rgba(46, 204, 113, 0.3)'
            }}>
              🔑 Admin
            </div>
          )}
          
          {/* Technician Status Indicator */}
          {currentUserInfo?.isTechnician && (
            <div className="technician-status" style={{
              background: 'rgba(52, 152, 219, 0.2)',
              color: '#2980b9',
              padding: '0.25rem 0.75rem',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: '600',
              border: '1px solid rgba(52, 152, 219, 0.3)'
            }}>
              🔧 Technician
            </div>
          )}
          
          <button onClick={onLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;