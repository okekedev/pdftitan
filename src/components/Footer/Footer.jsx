// src/components/Footer.jsx - Clean footer component with external CSS
import React from 'react';
import './Footer.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const version = process.env.REACT_APP_VERSION || '2.0.0';
  const buildTime = process.env.REACT_APP_BUILD_TIME;

  const handleLinkClick = (e, section) => {
    e.preventDefault();
    
    // Enhanced modals with more comprehensive information
    switch (section) {
      case 'help':
        alert(`Technical Support & Help

For technical assistance with TitanPDF:

🛠️ Technical Issues:
• Contact your ServiceTitan administrator
• Email: support@servicetitan.com
• Phone: 1-855-737-8482

📚 User Guide:
• PDF editing and form completion
• Digital signature creation
• ServiceTitan integration help

🔧 Common Issues:
• Login problems
• PDF loading errors
• Form submission issues

For immediate assistance, please have your technician ID and job details ready.`);
        break;
      case 'privacy':
        alert(`Privacy Policy & Data Security

TitanPDF Privacy Overview:

🔒 Data Protection:
• All PDF data is encrypted in transit and at rest
• Information processed through ServiceTitan's secure systems
• Compliance with industry-standard security practices

📋 Data Usage:
• PDF forms and signatures are stored securely
• Customer data handled per ServiceTitan's privacy policy
• No third-party data sharing without consent

🛡️ Your Rights:
• Access to your data
• Data correction requests
• Deletion requests (where applicable)

For detailed privacy information, please refer to ServiceTitan's Privacy Policy or contact your administrator.`);
        break;
      case 'terms':
        alert(`Terms of Service

TitanPDF Usage Terms:

👤 Authorized Users:
• Designed for ServiceTitan technicians only
• Proper login credentials required
• Unauthorized access is prohibited

📋 Acceptable Use:
• Professional use for job-related PDF forms only
• Accurate completion of customer information
• Proper handling of sensitive data

⚖️ Compliance:
• Subject to your company's IT policies
• ServiceTitan Terms of Service apply
• Local data protection regulations

🚫 Prohibited Activities:
• Sharing login credentials
• Misuse of customer data  
• Unauthorized form modifications

Violation of these terms may result in account suspension or termination.`);
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
                © {currentYear} TitanPDF. All rights reserved.
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
              Help & Support
            </button>
            <button 
              onClick={(e) => handleLinkClick(e, 'privacy')}
              className="footer-link"
              aria-label="View privacy policy"
            >
              Privacy Policy
            </button>
            <button 
              onClick={(e) => handleLinkClick(e, 'terms')}
              className="footer-link"
              aria-label="View terms of service"
            >
              Terms of Service
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