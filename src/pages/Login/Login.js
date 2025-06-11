import React, { useState, useEffect } from 'react';
import { serviceTitanConfig } from '../../config/serviceTitanConfig';
import apiClient from '../../services/apiClient';
import './Login.css';

function Login({ onLogin }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [configStatus, setConfigStatus] = useState(null);
  
  // Updated form labels for clarity
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

  // User Authentication via ApiClient - Updated for role-based auth
  const handleLogin = async () => {
    if (!username.trim() || !phoneNumber.trim()) {
      setError('Please enter both your username and phone number');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      console.log('👤 Authenticating user via ApiClient...');
      
      // Use ApiClient with updated field names
      const result = await apiClient.validateUser(username, phoneNumber);
      
      if (result.success) {
        console.log('🔍 Server response:', result);
        
        // Ensure access object exists
        const access = result.access || {
          level: 'unknown',
          isAdmin: false,
          isTechnician: false,
          nextScreen: 'jobs',
          permissions: {}
        };
        
        // Create user session data with new role-based structure
        const userData = {
          employee: result.user,
          access: access, // Role-based access info with fallback
          company: result.company?.name || 'Unknown Company',
          tenantId: result.company?.tenantId || '',
          accessToken: result.accessToken,
          appKey: result.company?.appKey || '',
          isServiceTitanConnected: true,
          environment: result.environment || configStatus.environment,
          authMethod: 'api_client',
          authLayers: {
            employee: true,
            adminSuper: false
          }
        };

        console.log('✅ User authenticated:', {
          name: result.user?.name || 'Unknown',
          username: result.user?.loginName || 'Unknown',
          type: result.user?.userType || 'Unknown',
          role: result.user?.role || 'Unknown',
          accessLevel: access.level,
          nextScreen: access.nextScreen
        });
        
        onLogin(userData);
        
      } else {
        setError(result.error || 'Authentication failed');
      }
      
    } catch (error) {
      console.error('❌ Authentication error:', error);
      
      // Enhanced error handling for new role-based responses
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
        case 'PERMISSION':
          setError('Access denied. Only administrators and technicians can use this application.');
          break;
        default:
          // Parse specific server error messages with better error handling
          console.log('🔍 Full error object:', error);
          
          if (error.message.includes('No user found with username')) {
            setError(`Username "${username}" not found. Please check your username and try again.`);
          } else if (error.message.includes('Phone number does not match')) {
            setError('Phone number does not match our records for this user.');
          } else if (error.message.includes('Access denied')) {
            setError('Access denied - Only administrators and technicians can use this application');
          } else if (error.message.includes('ServiceTitan authentication failed')) {
            setError('Failed to connect to ServiceTitan API. Please try again later.');
          } else if (error.message.includes('404')) {
            setError('Server endpoint not found. Please make sure the server is running and try again.');
          } else {
            setError(errorInfo.userMessage || error.message || 'An unexpected error occurred');
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
          <p>MrBackflow TX - User Login</p>
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
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your ServiceTitan username"
              disabled={isLoading}
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
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
          
          <button 
            type="button" 
            className={`login-btn ${isLoading ? 'loading' : ''} ${!configStatus.valid ? 'disabled' : ''}`}
            disabled={isLoading || !configStatus.valid || !username.trim() || !phoneNumber.trim()}
            onClick={handleLogin}
          >
            {isLoading ? 'Authenticating...' : '🔐 Login'}
          </button>
        </div>
        
        <div className="login-footer">
          <p>Enter your ServiceTitan username and phone number to login</p>
          <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
            Access is restricted to administrators and technicians only
          </p>
          {serviceTitanConfig.app.debugMode && (
            <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#666' }}>
              <p>Debug Mode: Environment = {configStatus.environment}</p>
              <p>Test admin: okekec21 | Test technicians: davehofmann, John_cox</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;