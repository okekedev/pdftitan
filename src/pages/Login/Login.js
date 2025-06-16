// src/pages/Login/Login.js - Simplified for Technicians Only
import React, { useState, useEffect } from 'react';
import { serviceTitanConfig } from '../../config/serviceTitanConfig';
import apiClient from '../../services/apiClient';
import './Login.css';

function Login({ onLogin }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [configStatus, setConfigStatus] = useState(null);
  
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

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

  // Simplified Technician Authentication
  const handleLogin = async () => {
    if (!username.trim() || !phoneNumber.trim()) {
      setError('Please enter both your username and phone number');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      console.log('👤 Authenticating technician...');
      
      const result = await apiClient.validateTechnician(username, phoneNumber);
      
      if (result.success) {
        console.log('✅ Technician authenticated:', result.technician.name);
        
        // Create simplified user session for technician
        const userData = {
          technician: result.technician,
          company: result.company,
          accessToken: result.accessToken,
          environment: result.environment || configStatus.environment,
          loginTime: Date.now(),
          userType: 'technician'
        };

        console.log('🔧 Session data structure:', {
          technicianName: userData.technician.name,
          technicianId: userData.technician.id,
          companyName: userData.company.name,
          tenantId: userData.company.tenantId,
          hasAppKey: !!userData.company.appKey,
          hasAccessToken: !!userData.accessToken
        });

        onLogin(userData);
        
      } else {
        setError(result.error || 'Authentication failed');
      }
      
    } catch (error) {
      console.error('❌ Authentication error:', error);
      
      // Enhanced error handling for technician-specific responses
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
        case 'NOT_FOUND':
          if (error.message.includes('No technician found')) {
            setError(`Technician "${username}" not found. Please check your username.`);
          } else if (error.message.includes('Endpoint not found')) {
            setError('Server endpoint not found. Please make sure the server is running.');
          } else {
            setError('Resource not found. Please try again.');
          }
          break;
        case 'PERMISSION':
          setError('This portal is for technicians only. Please contact your administrator if you need access.');
          break;
        case 'SERVER_ERROR':
          setError('Server error occurred. Please try again later.');
          break;
        default:
          // Parse specific server error messages
          if (error.message.includes('No technician found')) {
            setError(`Technician "${username}" not found. Please check your username and try again.`);
          } else if (error.message.includes('Phone number does not match')) {
            setError('Phone number does not match our records for this technician.');
          } else if (error.message.includes('ServiceTitan authentication failed')) {
            setError('Failed to connect to ServiceTitan API. Please try again later.');
          } else if (error.message.includes('404')) {
            setError('Server endpoint not found. Please make sure the server is running and try again.');
          } else if (error.message.includes('Both username and phone number are required')) {
            setError('Please enter both your username and phone number.');
          } else {
            setError(errorInfo.userMessage || error.message || 'An unexpected error occurred');
          }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

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

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>TitanPDF</h1>
          <p>Technician Portal - MrBackflow TX</p>
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
            <label htmlFor="username">Technician Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your ServiceTitan username"
              disabled={isLoading}
              onKeyPress={handleKeyPress}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phoneNumber">Phone Number</label>
            <input
              type="tel"
              id="phoneNumber"
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
            className={`login-btn ${isLoading ? 'loading' : ''} ${!configStatus.valid ? 'disabled' : ''}`}
            disabled={isLoading || !configStatus.valid || !username.trim() || !phoneNumber.trim()}
            onClick={handleLogin}
          >
            {isLoading ? 'Authenticating...' : '🔧 Login as Technician'}
          </button>
        </div>
        
        <div className="login-footer">
          <p>Enter your ServiceTitan technician credentials to access your jobs</p>
          <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
            Only technicians can access this portal
          </p>
          {serviceTitanConfig.app.debugMode && (
            <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#666' }}>
              <p>Debug Mode: Environment = {configStatus.environment}</p>
              <p>Test technicians: davehofmann, John_cox</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;