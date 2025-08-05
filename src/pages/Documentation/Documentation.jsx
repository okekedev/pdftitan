// src/pages/Documentation/Documentation.jsx - Fixed import and added initialSection support
import React, { useState, useEffect } from 'react';
import './Documentation.css'; // ✅ FIXED: Changed from './Help.css' to './Documentation.css'

export default function Documentation({ onBack, initialSection = 'support' }) {
  const [activeSection, setActiveSection] = useState(initialSection);

  // ✅ ADDED: Handle initialSection prop changes
  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

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
              <p>Ensure all required fields are completed before saving. If the problem persists, try refreshing the page and re-entering the data.</p>
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
                <li>Click on any PDF attachment to edit</li>
                <li>Fill out forms and add signatures as needed</li>
                <li>Save your changes when complete</li>
              </ol>
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
              <h4>Browser Compatibility</h4>
              <ul>
                <li>Use Chrome, Firefox, Safari, or Edge</li>
                <li>Ensure JavaScript is enabled</li>
                <li>Clear browser cache if experiencing issues</li>
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
          <p>Information about data protection and privacy practices</p>
        </div>
      </div>

      <div className="content-single">
        <div className="privacy-card">
          <h3>🛡️ Data Protection</h3>
          <p>TitanPDF is committed to protecting your privacy and securing your data. All information is handled in accordance with industry best practices and ServiceTitan's comprehensive privacy policies.</p>
          
          <div className="security-grid">
            <div className="security-item">
              <h4>Encryption</h4>
              <p>All data is encrypted in transit using TLS/SSL protocols and encrypted at rest using industry-standard encryption methods.</p>
            </div>
            <div className="security-item">
              <h4>Access Control</h4>
              <p>Only authorized technicians with valid ServiceTitan credentials can access job-related PDF forms and customer information.</p>
            </div>
            <div className="security-item">
              <h4>Data Minimization</h4>
              <p>We only collect and process the minimum amount of data necessary to provide PDF editing functionality for your jobs.</p>
            </div>
            <div className="security-item">
              <h4>Secure Storage</h4>
              <p>All PDF forms and customer data are stored securely within ServiceTitan's infrastructure with appropriate backup and recovery procedures.</p>
            </div>
          </div>
        </div>

        <div className="privacy-card">
          <h3>📊 Information We Process</h3>
          <div className="info-categories">
            <div className="info-category">
              <h4>Job Information</h4>
              <ul>
                <li>Job numbers and descriptions</li>
                <li>Scheduled dates and times</li>
                <li>Service location addresses</li>
                <li>Job status and priority</li>
              </ul>
            </div>
            <div className="info-category">
              <h4>Customer Data</h4>
              <ul>
                <li>Customer names and contact information</li>
                <li>Service addresses</li>
                <li>Information entered in PDF forms</li>
                <li>Digital signatures on completed forms</li>
              </ul>
            </div>
            <div className="info-category">
              <h4>Technician Data</h4>
              <ul>
                <li>ServiceTitan user credentials</li>
                <li>Technician name and ID</li>
                <li>Job assignments and completions</li>
                <li>Form completion timestamps</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="privacy-card">
          <h3>⚖️ Your Rights</h3>
          <div className="rights-grid">
            <div className="info-category">
              <h4>Access Rights</h4>
              <ul>
                <li>View your processed personal data</li>
                <li>Request copies of completed forms</li>
                <li>Access job-related information</li>
              </ul>
            </div>
            <div className="info-category">
              <h4>Correction Rights</h4>
              <ul>
                <li>Update incorrect information</li>
                <li>Modify completed forms when possible</li>
                <li>Request data corrections</li>
              </ul>
            </div>
            <div className="info-category">
              <h4>Deletion Rights</h4>
              <ul>
                <li>Request deletion of personal data</li>
                <li>Remove completed forms (subject to business requirements)</li>
                <li>Withdraw consent where applicable</li>
              </ul>
            </div>
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
          <h3>👤 Authorized Use</h3>
          <p>TitanPDF is designed exclusively for authorized ServiceTitan technicians to complete job-related PDF forms. Access is restricted to users with valid ServiceTitan credentials and appropriate job assignments.</p>
          
          <div className="compliance-grid">
            <div className="info-category">
              <h4>Permitted Activities</h4>
              <ul>
                <li>Completing PDF forms for assigned jobs</li>
                <li>Adding digital signatures to customer documents</li>
                <li>Editing form fields with accurate information</li>
                <li>Saving completed forms to job records</li>
              </ul>
            </div>
            <div className="info-category">
              <h4>User Responsibilities</h4>
              <ul>
                <li>Maintain confidentiality of login credentials</li>
                <li>Provide accurate and truthful information</li>
                <li>Use the system only for business purposes</li>
                <li>Report security concerns immediately</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="terms-card">
          <h3>🚫 Prohibited Activities</h3>
          <div className="violation-levels">
            <div className="violation-level">
              <h4>Unauthorized Access</h4>
              <p>Attempting to access data, jobs, or customer information not assigned to you or sharing login credentials with others.</p>
            </div>
            <div className="violation-level">
              <h4>Data Misuse</h4>
              <p>Using customer information for personal purposes, copying data for unauthorized use, or sharing confidential information.</p>
            </div>
            <div className="violation-level">
              <h4>System Abuse</h4>
              <p>Attempting to circumvent security measures, introducing malware, or using the system in ways that could harm performance or data integrity.</p>
            </div>
          </div>
        </div>

        <div className="terms-card">
          <h3>⚖️ Compliance & Legal</h3>
          <p>Your use of TitanPDF is subject to your company's IT policies, ServiceTitan's Terms of Service, and applicable local, state, and federal regulations. This includes data protection laws, privacy regulations, and industry-specific compliance requirements.</p>
          
          <div className="compliance-grid">
            <div className="info-category">
              <h4>Data Protection</h4>
              <ul>
                <li>GDPR compliance for EU customers</li>
                <li>CCPA compliance for California residents</li>
                <li>HIPAA considerations where applicable</li>
                <li>SOX compliance for financial data</li>
              </ul>
            </div>
            <div className="info-category">
              <h4>Business Compliance</h4>
              <ul>
                <li>Company-specific IT policies</li>
                <li>Industry regulations and standards</li>
                <li>Professional licensing requirements</li>
                <li>Customer contract obligations</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="terms-card">
          <h3>📝 Agreement Updates</h3>
          <p>These terms may be updated periodically to reflect changes in functionality, legal requirements, or business practices. Users will be notified of significant changes through ServiceTitan's standard communication channels. Continued use of TitanPDF constitutes acceptance of any revised terms.</p>
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