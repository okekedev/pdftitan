import React, { useState, useEffect } from 'react';
import { serviceTitanConfig } from '../../config/serviceTitanConfig';
import './Login.css';

function Login({ onLogin }) {
  const [step, setStep] = useState('company'); // 'company' or 'employee'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [configStatus, setConfigStatus] = useState(null);
  const [companyAuth, setCompanyAuth] = useState(null);
  
  // Company authentication form
  const [companyCode, setCompanyCode] = useState('');
  
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

  // Step 1: Company Authentication via Server
  const handleCompanyLogin = async () => {
    if (!configStatus?.valid) {
      setError('ServiceTitan configuration is incomplete. Check environment variables.');
      return;
    }

    if (!companyCode.trim()) {
      setError('Please enter the company access code');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      console.log('🏢 Authenticating company via server...');
      
      // Call server endpoint for company authentication
      const response = await fetch('http://localhost:3005/api/company/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyCode: companyCode
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Company authenticated:', result.company.name);
        setCompanyAuth(result);
        setStep('employee'); // Move to employee login
      } else {
        setError(result.error || 'Company authentication failed');
      }
      
    } catch (error) {
      console.error('❌ Company authentication error:', error);
      if (error.message.includes('Failed to fetch')) {
        setError('Cannot connect to server. Make sure the proxy server is running on localhost:3005');
      } else {
        setError(`Company authentication failed: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Employee/Technician Validation via Server
  const handleEmployeeLogin = async () => {
    if (!employeeName.trim() || !employeePhone.trim()) {
      setError('Please enter both your name and phone number');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      console.log('👤 Validating employee via server...');
      
      // Call server endpoint for employee validation
      const response = await fetch('http://localhost:3005/api/user/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: employeeName,
          phone: employeePhone,
          accessToken: companyAuth.accessToken,
          tenantId: companyAuth.company.tenantId,
          appKey: companyAuth.company.appKey
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Create comprehensive user session data
        const userData = {
          employee: result.user,
          company: companyAuth.company.name,
          tenantId: companyAuth.company.tenantId,
          accessToken: companyAuth.accessToken,
          appKey: companyAuth.company.appKey,
          isServiceTitanConnected: true,
          environment: configStatus.environment,
          authMethod: 'three_layer_auth',
          authLayers: {
            company: true,
            employee: true,
            adminSuper: false // Will be updated if admin validates
          }
        };

        console.log('✅ Employee validated:', {
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
          default:
            setError(result.error || 'Employee validation failed');
        }
      }
      
    } catch (error) {
      console.error('❌ Employee validation error:', error);
      if (error.message.includes('Failed to fetch')) {
        setError('Cannot connect to server. Make sure the proxy server is running on localhost:3005');
      } else {
        setError(`Employee validation failed: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const goBack = () => {
    setStep('company');
    setCompanyAuth(null);
    setError('');
    setEmployeeName('');
    setEmployeePhone('');
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

  // Step 1: Company Authentication
  if (step === 'company') {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>TitanPDF</h1>
            <p>Company Access Authentication</p>
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
              <label htmlFor="companyCode">Company Access Code</label>
              <input
                type="password"
                id="companyCode"
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value)}
                placeholder="Enter company access code"
                disabled={isLoading}
                onKeyPress={(e) => e.key === 'Enter' && handleCompanyLogin()}
              />
            </div>
            
            <button 
              type="button" 
              className={`login-btn ${isLoading ? 'loading' : ''} ${!configStatus.valid ? 'disabled' : ''}`}
              disabled={isLoading || !configStatus.valid || !companyCode.trim()}
              onClick={handleCompanyLogin}
            >
              {isLoading ? 'Connecting to ServiceTitan...' : '🏢 Connect Company'}
            </button>
          </div>
          
          <div className="login-footer">
            <p>Enter your company access code to continue</p>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Employee Authentication
  if (step === 'employee') {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>TitanPDF</h1>
            <p>Employee/Technician Login</p>
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

          <div className="success-message" style={{
            background: '#e8f5e8',
            color: '#2e7d32',
            padding: '0.75rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.9rem',
            border: '1px solid #4caf50'
          }}>
            ✅ Company authenticated
          </div>
          
          <div className="login-form">
            <div className="form-group">
              <label htmlFor="employeeName">Your Name</label>
              <input
                type="text"
                id="employeeName"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="John Smith"
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
                onKeyPress={(e) => e.key === 'Enter' && handleEmployeeLogin()}
              />
            </div>
            
            <div className="button-group" style={{ display: 'flex', gap: '1rem' }}>
              <button 
                type="button" 
                className="back-btn"
                onClick={goBack}
                disabled={isLoading}
                style={{
                  flex: 1,
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '14px',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                ← Back
              </button>
              
              <button 
                type="button" 
                className={`login-btn ${isLoading ? 'loading' : ''}`}
                disabled={isLoading || !employeeName.trim() || !employeePhone.trim()}
                onClick={handleEmployeeLogin}
                style={{ flex: 2 }}
              >
                {isLoading ? 'Validating...' : '👤 Login'}
              </button>
            </div>
          </div>
          
          <div className="login-footer">
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default Login;