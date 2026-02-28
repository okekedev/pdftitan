// src/pages/Login/Login.tsx
import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';
import type { Technician, Company } from '../../types';
import './Login.css';

interface LoginProps {
  onLogin: (userData: { technician: Technician; company: Company; environment?: string }) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    const testConnection = async () => {
      try {
        const connected = await apiClient.testConnection();
        if (!connected) {
          console.warn('⚠️ Server connection test failed');
        } else {
          console.log('✅ Server connection successful');
        }
      } catch (err) {
        console.warn('⚠️ Could not test server connection:', err);
      }
    };
    testConnection();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !phoneNumber.trim()) {
      setError('Please enter both your username and phone number');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('👤 Authenticating technician...');

      const result = await apiClient.validateTechnician(username, phoneNumber) as {
        success: boolean;
        technician: Technician;
        company: Company;
        environment?: string;
        error?: string;
      };

      if (result.success) {
        console.log('✅ Technician authenticated:', result.technician.name);
        onLogin({
          technician: result.technician,
          company: result.company,
          environment: result.environment,
        });
      } else {
        setError(result.error ?? 'Authentication failed');
      }
    } catch (err) {
      console.error('❌ Authentication error:', err);
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';

      if (message.includes('No technician found')) {
        setError(`Technician "${username}" not found. Please check your username.`);
      } else if (message.includes('Phone number does not match')) {
        setError('Phone number does not match our records for this technician.');
      } else if (message.includes('ServiceTitan authentication failed')) {
        setError('Failed to connect to ServiceTitan API. Please try again later.');
      } else if (message.includes('404')) {
        setError('Server endpoint not found. Please make sure the server is running.');
      } else if (message.includes('timeout')) {
        setError('Connection timeout. Please try again.');
      } else if (message.includes('connect')) {
        setError('Cannot connect to server. Make sure the server is running on localhost:3004');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) handleLogin();
  };

  return (
    <div className="login-page-layout">
      <header className="login-page-header">
        <div className="login-header-content">
          <div className="login-brand">
            <div className="login-brand-text">
              <h1>Mr. Backflow</h1>
              <p>ServiceTitan PDF Editor</p>
            </div>
          </div>
          <div className="login-status">
            <span className="status-dot online"></span>
            <span>ServiceTitan Connected</span>
          </div>
        </div>
      </header>

      <main className="login-main-content">
        <div className="login-screen">
          <div className="login-container">
            <div className="login-card card">
              <div className="login-header">
                <div className="logo-section">
                  <img src="/web-app-manifest-192x192.png" alt="Mr. Backflow" className="logo-image" />
                </div>
                <h2 className="login-title">Technician Login</h2>
                <p className="login-subtitle">
                  Enter your ServiceTitan credentials to access PDF forms
                </p>
              </div>

              {error && (
                <div className="alert alert-error">
                  <span className="error-icon">⚠️</span>
                  <div className="error-content">
                    <strong>Authentication Error</strong>
                    <p>{error}</p>
                  </div>
                </div>
              )}

              <form className="login-form" onSubmit={(e) => e.preventDefault()}>
                <div className="form-group">
                  <label htmlFor="username" className="form-label">
                    <span className="label-icon">👤</span>
                    Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    className="form-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your ServiceTitan username"
                    disabled={isLoading}
                    onKeyPress={handleKeyPress}
                    autoComplete="username"
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="phoneNumber" className="form-label">
                    <span className="label-icon">📱</span>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phoneNumber"
                    className="form-input"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter your phone number"
                    disabled={isLoading}
                    onKeyPress={handleKeyPress}
                    autoComplete="tel"
                  />
                </div>

                <button
                  type="button"
                  className={`btn btn-lg login-btn ${isLoading ? 'loading' : ''}`}
                  disabled={isLoading || !username.trim() || !phoneNumber.trim()}
                  onClick={handleLogin}
                >
                  {isLoading ? (
                    <>
                      <div className="button-spinner"></div>
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span className="login-btn-icon">🔐</span>
                      <span>Login to Mr. Backflow</span>
                    </>
                  )}
                </button>
              </form>

              <div className="login-help">
                <div className="help-section">
                  <h4>Need Help?</h4>
                  <ul className="help-list">
                    <li>Use your ServiceTitan technician username</li>
                    <li>Enter the phone number associated with your account</li>
                    <li>Contact your administrator if you can't access your account</li>
                  </ul>
                </div>
                <div className="security-note">
                  <span className="security-icon">🔒</span>
                  <p>Your login is secured through ServiceTitan's authentication system</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="login-page-footer">
        <div className="login-footer-content">
          <div className="login-footer-left">
            <div className="login-footer-brand">
              <span className="login-footer-logo">📋</span>
              <div className="login-footer-info">
                <p>
                  © 2025 Built by{' '}
                  <a
                    href="https://sundai.us/"
                    style={{ color: 'white', textDecoration: 'underline' }}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Okeke LLC
                  </a>
                  . Design By{' '}
                  <a
                    href="https://beamish-pastelito-94935e.netlify.app/"
                    style={{ color: 'white', textDecoration: 'underline' }}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Blaine Curren
                  </a>
                </p>
                <p>Powered by ServiceTitan Integration</p>
              </div>
            </div>
          </div>
          <div className="login-footer-right">
            <div className="login-footer-status">
              <span className="footer-status-dot online"></span>
              <span>All Systems Operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
