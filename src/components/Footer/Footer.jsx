// src/components/Footer/Footer.jsx - Updated footer component with navigation
import React from 'react';
import './Footer.css';

export default function Footer({ onShowDocumentation }) {
  const currentYear = new Date().getFullYear();
  const version = process.env.REACT_APP_VERSION || '2.0.0';
  const buildTime = process.env.REACT_APP_BUILD_TIME;

  // Navigation function - NO MORE ALERTS!
  const handleLinkClick = (section) => {
    if (onShowDocumentation) {
      onShowDocumentation(section);
    } else {
      console.warn('Footer: onShowDocumentation prop not provided');
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
                © {currentYear} Built by{" "}
                <a
                  href="https://sundai.us/"
                  className="footer-link-external"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Okeke LLC
                </a>
                . Design By{" "}
                <a
                  href="https://beamish-pastelito-94935e.netlify.app/"
                  className="footer-link-external"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Blaine Curren
                </a>
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
              onClick={() => handleLinkClick('support')}
              className="footer-link"
              aria-label="Get help and support"
            >
              🆘 Support
            </button>
            <button 
              onClick={() => handleLinkClick('privacy')}
              className="footer-link"
              aria-label="View privacy policy"
            >
              🔒 Privacy
            </button>
            <button 
              onClick={() => handleLinkClick('terms')}
              className="footer-link"
              aria-label="View terms of service"
            >
              📄 Terms
            </button>
          </div>
          
          <div className="footer-status">
            <div className="status-info">
              <span className="status-indicator online"></span>
              <span>Connected to ServiceTitan</span>
            </div>
            {version && (
              <div className="version-info">
                <span>v{version}</span>
                {buildTime && (
                  <span className="build-time" title={`Built: ${buildTime}`}>
                    • {new Date(buildTime).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}