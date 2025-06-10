import React from 'react';
import './Footer.css';

function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-left">
          <p>&copy; 2025 TitanPDF. All rights reserved.</p>
          <p className="footer-subtitle">Integrated with ServiceTitan</p>
        </div>
        
        <div className="footer-right">
          <div className="footer-links">
            <a href="#help" className="footer-link">Help & Support</a>
            <a href="#privacy" className="footer-link">Privacy Policy</a>
            <a href="#terms" className="footer-link">Terms of Service</a>
          </div>
          
          <div className="footer-version">
            <span>Version 1.0.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;