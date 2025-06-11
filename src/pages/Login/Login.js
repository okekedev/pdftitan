import React, { useState, useEffect } from 'react';
import { serviceTitanConfig } from '../../config/serviceTitanConfig';
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
          environment: serviceTitanConfig.isIntegrationEnvironment ? 'Integration' : 'Production'
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

  // User Authentication via Server
  const handleLogin = async () => {
    if (!employeeName.trim() || !employeePhone.trim()) {
      setError('Please enter both your name and phone number');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      console.log('👤 Authenticating user via server...');
      
      // Call server endpoint for user validation
      console.log('🔍 Sending request to: http://localhost:3005/api/user/validate');
      const response = await fetch('http://localhost:3005/api/user/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: employeeName,
          phone: employeePhone
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Create user session data
        const userData = {
          employee: result.user,
          company: result.company.name,
          tenantId: result.company.tenantId,
          accessToken: result.accessToken,
          appKey: result.company.appKey,
          isServiceTitanConnected: true,
          environment: configStatus.environment,
          authMethod: 'simplified_auth',
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
        // Show specific error based on what failed
        switch (result.layer) {
          case 'validation':
            setError(`${result.error} (Searched: ${result.searchedIn?.join(', ') || 'employees & technicians'})`);
            break;
          case 'servicetitan':
            setError('Failed to connect to ServiceTitan API. Please try again later.');
            break;
          default:
            setError(result.error || 'Authentication failed');
        }
      }
      
    } catch (error) {
      console.error('❌ Authentication error:', error);
      if (error.message.includes('Failed to fetch')) {
        setError('Cannot connect to server. Make sure the proxy server is running on localhost:3005');
      } else {
        setError(`Authentication failed: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
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
        </div>
      </div>
    </div>
  );
}

export default Login;