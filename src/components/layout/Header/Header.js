import React from 'react';
import './Header.css';

function Header({ user, onLogout, currentPage, onNavigate }) {
  const breadcrumbs = [
    { id: 'projects', label: 'Projects', active: currentPage === 'projects' },
    { id: 'jobs', label: 'Jobs', active: currentPage === 'jobs' },
    { id: 'attachments', label: 'Attachments', active: currentPage === 'attachments' }
  ];

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <h1 onClick={() => onNavigate('projects')} className="logo">
            TitanPDF
          </h1>
          
          <nav className="breadcrumb-nav">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.id}>
                {index > 0 && <span className="breadcrumb-separator">→</span>}
                <button
                  className={`breadcrumb-item ${crumb.active ? 'active' : ''}`}
                  onClick={() => onNavigate(crumb.id)}
                  disabled={!crumb.active && index > 0} // Only allow navigation to current or previous steps
                >
                  {crumb.label}
                </button>
              </React.Fragment>
            ))}
          </nav>
        </div>
        
        <div className="header-right">
          <div className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="user-company">{user.company}</span>
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