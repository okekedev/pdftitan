// src/pages/Help.jsx - Comprehensive help page with Support, Privacy, and Terms
import React, { useState } from 'react';
import './Help.css';

export default function Help({ onBack }) {
  const [activeSection, setActiveSection] = useState('support');

  const handleSectionChange = (section) => {
    setActiveSection(section);
  };

  const renderSupportSection = () => (
    <div className="help-section-content">
      <div className="section-header">
        <div className="section-icon">🛠️</div>
        <div className="section-title">
          <h2>Technical Support & Help</h2>
          <p>Get assistance with TitanPDF and ServiceTitan integration</p>
        </div>
      </div>

      <div className="content-grid">
        <div className="support-card">
          <div className="card-header">
            <span className="card-icon">📞</span>
            <h3>Contact Support</h3>
          </div>
          <div className="card-content">
            <div className="contact-item">
              <strong>ServiceTitan Support</strong>
              <p>Phone: <a href="tel:1-855-737-8482">1-855-737-8482</a></p>
              <p>Email: <a href="mailto:support@servicetitan.com">support@servicetitan.com</a></p>
            </div>
            <div className="contact-item">
              <strong>Business Hours</strong>
              <p>Monday - Friday: 6:00 AM - 6:00 PM PST</p>
              <p>Saturday: 8:00 AM - 5:00 PM PST</p>
            </div>
          </div>
        </div>

        <div className="support-card">
          <div className="card-header">
            <span className="card-icon">❓</span>
            <h3>Common Issues</h3>
          </div>
          <div className="card-content">
            <div className="faq-item">
              <h4>Login Problems</h4>
              <p>Ensure you're using your ServiceTitan technician username and the phone number associated with your account. Contact your administrator if credentials don't work.</p>
            </div>
            <div className="faq-item">
              <h4>PDF Loading Errors</h4>
              <p>Check your internet connection and try refreshing the page. If PDFs won't load, contact support with the job number.</p>
            </div>
            <div className="faq-item">
              <h4>Form Submission Issues</h4>
              <p>Ensure all required fields are completed before saving. Check that signatures are properly placed and visible.</p>
            </div>
          </div>
        </div>

        <div className="support-card">
          <div className="card-header">
            <span className="card-icon">📚</span>
            <h3>User Guide</h3>
          </div>
          <div className="card-content">
            <div className="guide-item">
              <h4>Getting Started</h4>
              <ol>
                <li>Log in with your ServiceTitan credentials</li>
                <li>Select a job from your job list</li>
                <li>Choose a PDF form to edit</li>
                <li>Fill out the form using the editing tools</li>
                <li>Save and upload to ServiceTitan</li>
              </ol>
            </div>
            <div className="guide-item">
              <h4>PDF Editing Features</h4>
              <ul>
                <li><strong>Text Fields:</strong> Click to add text anywhere on the form</li>
                <li><strong>Signatures:</strong> Draw digital signatures with your mouse or touch</li>
                <li><strong>Dates:</strong> Automatically insert current date and time</li>
                <li><strong>Checkboxes:</strong> Mark completed items or selections</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="support-card">
          <div className="card-header">
            <span className="card-icon">🔧</span>
            <h3>Troubleshooting</h3>
          </div>
          <div className="card-content">
            <div className="troubleshoot-item">
              <h4>Before Contacting Support</h4>
              <ul>
                <li>Clear your browser cache and cookies</li>
                <li>Try using a different browser (Chrome, Firefox, Safari)</li>
                <li>Check your internet connection</li>
                <li>Ensure pop-ups are allowed for this site</li>
                <li>Have your technician ID and job details ready</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPrivacySection = () => (
    <div className="help-section-content">
      <div className="section-header">
        <div className="section-icon">🔒</div>
        <div className="section-title">
          <h2>Privacy Policy & Data Security</h2>
          <p>How we protect and handle your information</p>
        </div>
      </div>

      <div className="content-single">
        <div className="privacy-card">
          <h3>Data Protection Overview</h3>
          <p>TitanPDF is committed to protecting your privacy and ensuring the security of your personal and customer data. This policy outlines how we collect, use, and protect information within our application.</p>
        </div>

        <div className="privacy-card">
          <h3>🛡️ Security Measures</h3>
          <div className="security-grid">
            <div className="security-item">
              <h4>Encryption</h4>
              <p>All data transmitted between your device and ServiceTitan servers is encrypted using industry-standard TLS/SSL protocols.</p>
            </div>
            <div className="security-item">
              <h4>Secure Storage</h4>
              <p>PDF forms and signatures are stored securely within ServiceTitan's infrastructure, which maintains SOC 2 Type II compliance.</p>
            </div>
            <div className="security-item">
              <h4>Access Control</h4>
              <p>Only authorized technicians with valid ServiceTitan credentials can access the system and customer data.</p>
            </div>
            <div className="security-item">
              <h4>Data Integrity</h4>
              <p>All form submissions are logged and tracked to ensure data integrity and provide audit trails.</p>
            </div>
          </div>
        </div>

        <div className="privacy-card">
          <h3>📋 Information We Process</h3>
          <div className="info-categories">
            <div className="info-category">
              <h4>Technician Information</h4>
              <ul>
                <li>ServiceTitan username and authentication details</li>
                <li>Phone number for account verification</li>
                <li>Job assignments and work history</li>
              </ul>
            </div>
            <div className="info-category">
              <h4>Customer Information</h4>
              <ul>
                <li>Customer names and service addresses</li>
                <li>Job details and service descriptions</li>
                <li>PDF form data and digital signatures</li>
              </ul>
            </div>
            <div className="info-category">
              <h4>Technical Information</h4>
              <ul>
                <li>Device type and browser information</li>
                <li>IP addresses and access logs</li>
                <li>Application usage and performance data</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="privacy-card">
          <h3>🔐 Your Rights</h3>
          <div className="rights-grid">
            <div className="right-item">
              <h4>Access</h4>
              <p>You have the right to access your personal data stored in the system.</p>
            </div>
            <div className="right-item">
              <h4>Correction</h4>
              <p>You can request corrections to inaccurate or incomplete data.</p>
            </div>
            <div className="right-item">
              <h4>Deletion</h4>
              <p>You may request deletion of personal data where legally permissible.</p>
            </div>
            <div className="right-item">
              <h4>Notification</h4>
              <p>We will notify you of any data breaches that may affect your information.</p>
            </div>
          </div>
        </div>

        <div className="privacy-card">
          <h3>📞 Privacy Contact</h3>
          <p>For privacy-related questions or concerns, please contact:</p>
          <div className="contact-info">
            <p><strong>ServiceTitan Privacy Office</strong></p>
            <p>Email: <a href="mailto:privacy@servicetitan.com">privacy@servicetitan.com</a></p>
            <p>Phone: <a href="tel:1-855-737-8482">1-855-737-8482</a></p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTermsSection = () => (
    <div className="help-section-content">
      <div className="section-header">
        <div className="section-icon">📄</div>
        <div className="section-title">
          <h2>Terms of Service</h2>
          <p>Usage terms and conditions for TitanPDF</p>
        </div>
      </div>

      <div className="content-single">
        <div className="terms-card">
          <h3>Agreement Overview</h3>
          <p>By using TitanPDF, you agree to these terms of service. These terms govern your use of the application and outline your rights and responsibilities as a user.</p>
        </div>

        <div className="terms-card">
          <h3>👤 Authorized Users</h3>
          <div className="terms-section">
            <h4>Eligibility</h4>
            <ul>
              <li>TitanPDF is designed exclusively for ServiceTitan technicians</li>
              <li>Valid ServiceTitan login credentials are required</li>
              <li>Users must be authorized employees of ServiceTitan customer companies</li>
              <li>Unauthorized access attempts are prohibited and may result in legal action</li>
            </ul>
          </div>
        </div>

        <div className="terms-card">
          <h3>📋 Acceptable Use Policy</h3>
          <div className="terms-section">
            <h4>Permitted Uses</h4>
            <ul>
              <li>Professional completion of job-related PDF forms</li>
              <li>Digital signature creation for service documentation</li>
              <li>Customer information entry for legitimate business purposes</li>
              <li>Integration with ServiceTitan workflows and processes</li>
            </ul>
            <h4>Prohibited Activities</h4>
            <ul>
              <li>Sharing login credentials with unauthorized individuals</li>
              <li>Accessing customer data for non-business purposes</li>
              <li>Attempting to circumvent security measures</li>
              <li>Using the system for fraudulent or illegal activities</li>
              <li>Modifying or tampering with PDF forms beyond intended use</li>
            </ul>
          </div>
        </div>

        <div className="terms-card">
          <h3>⚖️ Compliance Requirements</h3>
          <div className="compliance-grid">
            <div className="compliance-item">
              <h4>Company IT Policies</h4>
              <p>Users must comply with their employer's IT and data security policies when using TitanPDF.</p>
            </div>
            <div className="compliance-item">
              <h4>ServiceTitan Terms</h4>
              <p>All ServiceTitan Terms of Service and licensing agreements apply to TitanPDF usage.</p>
            </div>
            <div className="compliance-item">
              <h4>Data Protection Laws</h4>
              <p>Users must comply with applicable data protection regulations including GDPR, CCPA, and local privacy laws.</p>
            </div>
            <div className="compliance-item">
              <h4>Industry Standards</h4>
              <p>Maintain compliance with relevant industry standards and best practices for your trade.</p>
            </div>
          </div>
        </div>

        <div className="terms-card">
          <h3>🚫 Consequences of Violations</h3>
          <div className="violation-levels">
            <div className="violation-level">
              <h4>Minor Violations</h4>
              <p>Warning notifications and required training on proper usage</p>
            </div>
            <div className="violation-level">
              <h4>Serious Violations</h4>
              <p>Temporary account suspension and mandatory security review</p>
            </div>
            <div className="violation-level">
              <h4>Severe Violations</h4>
              <p>Permanent account termination and potential legal action</p>
            </div>
          </div>
        </div>

        <div className="terms-card">
          <h3>📞 Questions About Terms</h3>
          <p>If you have questions about these terms of service, please contact:</p>
          <div className="contact-info">
            <p><strong>ServiceTitan Legal Department</strong></p>
            <p>Email: <a href="mailto:legal@servicetitan.com">legal@servicetitan.com</a></p>
            <p>Phone: <a href="tel:1-855-737-8482">1-855-737-8482</a></p>
          </div>
        </div>

        <div className="terms-card">
          <h3>📅 Effective Date</h3>
          <p>These terms are effective as of January 1, 2024, and may be updated periodically. Continued use of TitanPDF constitutes acceptance of any revised terms.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="help-page">
      {/* Header */}
      <div className="help-header">
        <div className="help-header-content">
          <button onClick={onBack} className="back-button">
            ← Back
          </button>
          <div className="help-title">
            <h1>TitanPDF Help Center</h1>
            <p>Support, Privacy, and Terms Information</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="help-navigation">
        <div className="nav-container">
          <button
            className={`nav-button ${activeSection === 'support' ? 'active' : ''}`}
            onClick={() => handleSectionChange('support')}
          >
            <span className="nav-icon">🛠️</span>
            <span className="nav-text">Support</span>
          </button>
          <button
            className={`nav-button ${activeSection === 'privacy' ? 'active' : ''}`}
            onClick={() => handleSectionChange('privacy')}
          >
            <span className="nav-icon">🔒</span>
            <span className="nav-text">Privacy</span>
          </button>
          <button
            className={`nav-button ${activeSection === 'terms' ? 'active' : ''}`}
            onClick={() => handleSectionChange('terms')}
          >
            <span className="nav-icon">📄</span>
            <span className="nav-text">Terms</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="help-content">
        <div className="content-container">
          {activeSection === 'support' && renderSupportSection()}
          {activeSection === 'privacy' && renderPrivacySection()}
          {activeSection === 'terms' && renderTermsSection()}
        </div>
      </div>
    </div>
  );
}