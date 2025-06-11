import React, { useState, useEffect } from 'react';
import { serviceTitanConfig } from '../../config/serviceTitanConfig';
import apiClient from '../../services/apiClient';
import './Login.css';

function Login({ onLogin }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [configStatus, setConfigStatus] = useState(null);
  
  // Employee authentication form
  const [employeeName, setEmployeeName] = useState('');
  const [employeePhone, setEmployeePhone] = useState('');

  useEffect(() => {
    // Check configuration on component mount
    const checkConfig = () => {
      if (serviceTitanConfig.isConfigured()) {
        setConfigStatus({
          valid: true,
          environment: serviceTitanConfig.environment.name
        });
      } else {
        setConfigStatus({
          valid: false,
          missing: serviceTitanConfig.getMissingConfig()
        });
      }
    };

    checkConfig();
  }, []);

  // User Authentication via ApiClient
  const handleLogin = async () => {
    if (!employeeName.trim() || !employeePhone.trim()) {
      setError('Please enter both your name and phone number');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      console.log('👤 Authenticating user via ApiClient...');
      
      // Use ApiClient instead of direct fetch
      const result = await apiClient.validateUser(employeeName, employeePhone);
      
      if (result.success) {
        // Create user session data
        const userData = {
          employee: result.user,
          company: result.company.name,
          tenantId: result.company.tenantId,
          accessToken: result.accessToken,
          appKey: result.company.appKey,
          isServiceTitanConnected: true,
          environment: result.environment || configStatus.environment,
          authMethod: 'api_client',
          authLayers: {
            employee: true,
            adminSuper: false // Will be updated if admin validates
          }
        };

        console.log('✅ User authenticated:', {
          name: result.user.name,
          type: result.user.userType,
          role: result.user.role
        });
        
        onLogin(userData);
        
      } else {
        // This shouldn't happen since ApiClient throws on non-success
        setError(result.error || 'Authentication failed');
      }
      
    } catch (error) {
      console.error('❌ Authentication error:', error);
      
      // Use ApiClient's error handling
      const errorInfo = apiClient.handleApiError(error);
      
      switch (errorInfo.type) {
        case 'NETWORK':
          setError('Cannot connect to server. Make sure the server is running on localhost:3005');
          break;
        case 'TIMEOUT':
          setError('Connection timeout. Please try again.');
          break;
        case 'AUTH':
          setError('Authentication failed. Please check your credentials.');
          break;
        default:
          // Parse specific server error messages
          if (error.message.includes('User not found')) {
            setError(`User not found. Please check your name and try again.`);
          } else if (error.message.includes('Phone number does not match')) {
            setError('Phone number does not match our records for this user.');
          } else if (error.message.includes('ServiceTitan authentication failed')) {
            setError('Failed to connect to ServiceTitan API. Please try again later.');
          } else {
            setError(errorInfo.userMessage);
          }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Test server connection on mount
  useEffect(() => {
    const testConnection = async () => {
      try {
        const connectionTest = await apiClient.testConnection();
        if (!connectionTest.connected) {
          console.warn('⚠️ Server connection test failed:', connectionTest.error);
        } else {
          console.log('✅ Server connection successful:', connectionTest.serverStatus);
        }
      } catch (error) {
        console.warn('⚠️ Could not test server connection:', error);
      }
    };

    if (configStatus?.valid) {
      testConnection();
    }
  }, [configStatus]);

  if (!configStatus) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>TitanPDF</h1>
            <p>Loading configuration...</p>
          </div>
        </div>
      </div>
    );
  }

  // User Authentication
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>TitanPDF</h1>
          <p>User Login</p>
        </div>
        
        {error && (
          <div className="error-message" style={{
            background: '#ffebee',
            color: '#c62828',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.9rem',
            border: '1px solid #ffcdd2'
          }}>
            ⚠️ {error}
          </div>
        )}

        {!configStatus.valid && (
          <div className="config-error" style={{
            background: '#fff3e0',
            color: '#ef6c00',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.9rem',
            border: '1px solid #ffcc02'
          }}>
            <strong>Configuration Error:</strong><br/>
            Missing environment variables: {configStatus.missing?.join(', ')}
          </div>
        )}
        
        <div className="login-form">
          <div className="form-group">
            <label htmlFor="employeeName">Username or Full Name</label>
            <input
              type="text"
              id="employeeName"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="Enter username or full name"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="employeePhone">Phone Number</label>
            <input
              type="tel"
              id="employeePhone"
              value={employeePhone}
              onChange={(e) => setEmployeePhone(e.target.value)}
              placeholder="(555) 123-4567"
              disabled={isLoading}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
          
          <button 
            type="button" 
            className={`login-btn ${isLoading ? 'loading' : ''} ${!configStatus.valid ? 'disabled' : ''}`}
            disabled={isLoading || !configStatus.valid || !employeeName.trim() || !employeePhone.trim()}
            onClick={handleLogin}
          >
            {isLoading ? 'Authenticating...' : '👤 Login'}
          </button>
        </div>
        
        <div className="login-footer">
          <p>Enter your username (or full name) and phone number to login</p>
          {serviceTitanConfig.app.debugMode && (
            <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#666' }}>
              <p>Debug Mode: Environment = {configStatus.environment}</p>
              <p>Available test users: Christian Okeke, John Smith, Sarah Johnson</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;