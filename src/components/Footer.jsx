// src/components/Layout/Footer/Footer.jsx - Modern JSX with Global Styles
import React from 'react';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const version = process.env.REACT_APP_VERSION || '2.0.0';
  const buildTime = process.env.REACT_APP_BUILD_TIME;

  const handleLinkClick = (e, section) => {
    e.preventDefault();
    
    // Simple modal or alert for now - you can enhance this later
    switch (section) {
      case 'help':
        alert('For technical support, please contact your ServiceTitan administrator or IT department.');
        break;
      case 'privacy':
        alert('Privacy Policy: TitanPDF operates in compliance with your company\'s data privacy policies. All PDF form data is processed through ServiceTitan\'s secure systems.');
        break;
      case 'terms':
        alert('Terms of Service: TitanPDF is designed for authorized technicians only. Use of this application is subject to your company\'s IT policies and ServiceTitan\'s terms of service.');
        break;
      default:
        break;
    }
  };

  return (
    <footer className="app-footer">
      <div className="footer-container">
        <div className="footer-left">
          <div className="footer-brand">
            <span className="footer-logo">📋</span>
            <div className="footer-info">
              <p className="footer-title">
                &copy; {currentYear} TitanPDF. All rights reserved.
              </p>
              <p className="footer-subtitle">
                Powered by ServiceTitan Integration
              </p>
            </div>
          </div>
        </div>
        
        <div className="footer-right">
          <div className="footer-links">
            <button 
              onClick={(e) => handleLinkClick(e, 'help')}
              className="footer-link"
              aria-label="Get help and support"
            >
              🆘 Help & Support
            </button>
            <button 
              onClick={(e) => handleLinkClick(e, 'privacy')}
              className="footer-link"
              aria-label="View privacy policy"
            >
              🔒 Privacy Policy
            </button>
            <button 
              onClick={(e) => handleLinkClick(e, 'terms')}
              className="footer-link"
              aria-label="View terms of service"
            >
              📋 Terms of Service
            </button>
          </div>
          
          <div className="footer-status">
            <div className="status-info">
              <span className="status-indicator online"></span>
              <span>Connected to ServiceTitan</span>
            </div>
            <div className="version-info">
              <span>v{version}</span>
              {buildTime && (
                <span className="build-time" title={`Built: ${buildTime}`}>
                  • {new Date(buildTime).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Additional Footer-specific styles
const footerStyles = `
.footer-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.footer-logo {
  font-size: 1.2rem;
}

.footer-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.footer-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--gray-300);
  margin: 0;
}

.footer-subtitle {
  font-size: 0.8rem;
  color: var(--gray-400);
  margin: 0;
}

.footer-right {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  align-items: flex-end;
}

.footer-links {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.footer-link {
  background: none;
  border: none;
  color: var(--gray-400);
  font-size: 0.8rem;
  cursor: pointer;
  transition: var(--transition-normal);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
}

.footer-link:hover {
  color: var(--gray-200);
  background: rgba(255, 255, 255, 0.1);
}

.footer-status {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  align-items: flex-end;
}

.status-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 0.8rem;
  color: var(--gray-400);
}

.version-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 0.75rem;
  color: var(--gray-500);
}

.build-time {
  opacity: 0.7;
}

@media (max-width: 768px) {
  .footer-container {
    flex-direction: column;
    gap: var(--spacing-md);
    text-align: center;
  }
  
  .footer-left {
    justify-content: center;
  }
  
  .footer-right {
    align-items: center;
  }
  
  .footer-links {
    justify-content: center;
    gap: var(--spacing-sm);
  }
  
  .footer-link {
    font-size: 0.75rem;
    padding: var(--spacing-xs);
  }
  
  .footer-status {
    align-items: center;
  }
}

@media (max-width: 480px) {
  .footer-links {
    flex-direction: column;
    gap: var(--spacing-xs);
  }
  
  .footer-brand {
    flex-direction: column;
    text-align: center;
  }
  
  .version-info {
    flex-direction: column;
    gap: 2px;
  }
}
`;

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('footer-styles')) {
  const style = document.createElement('style');
  style.id = 'footer-styles';
  style.textContent = footerStyles;
  document.head.appendChild(style);
}