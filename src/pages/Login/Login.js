import React, { useState, useEffect } from 'react';
import serviceTitanAPI from '../../services/serviceTitanAPI';
import { serviceTitanConfig } from '../../config/serviceTitanConfig';
import './Login.css';

function Login({ onLogin }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [configStatus, setConfigStatus] = useState(null);

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

  const handleServiceTitanLogin = async () => {
    if (!configStatus?.valid) {
      setError('ServiceTitan configuration is incomplete. Please check environment variables.');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      console.log('🔐 Testing ServiceTitan connection...');
      const connectionTest = await serviceTitanAPI.testConnection();
      
      if (!connectionTest.success) {
        throw new Error(connectionTest.error);
      }

      // Fetch technician info for user context
      console.log('👨‍🔧 Fetching technician information...');
      const technicians = await serviceTitanAPI.getTechnicians();
      const currentTechnician = technicians.find(tech => tech.active) || technicians[0];

      // Create user data with real ServiceTitan info
      const userData = {
        email: 'technician@ejproducts.com',
        name: currentTechnician?.name || 'ServiceTitan User',
        company: 'E & J Products LLC',
        technicianId: currentTechnician?.id,
        isServiceTitanConnected: true,
        connectionToken: connectionTest.token,
        environment: serviceTitanConfig.isIntegrationEnvironment ? 'Integration' : 'Production'
      };

      console.log('✅ ServiceTitan login successful:', userData);
      onLogin(userData);
      
    } catch (error) {
      console.error('❌ ServiceTitan login failed:', error);
      setError(`Connection failed: ${error.message}`);
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

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>TitanPDF</h1>
          <p>Connect with your ServiceTitan account</p>
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
          <button 
            type="button" 
            className={`login-btn ${isLoading ? 'loading' : ''} ${!configStatus.valid ? 'disabled' : ''}`}
            disabled={isLoading || !configStatus.valid}
            onClick={handleServiceTitanLogin}
          >
            {isLoading ? 'Connecting to ServiceTitan...' : '🔗 Connect with ServiceTitan'}
          </button>
          
          {configStatus.valid && (
            <div className="api-status" style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: '#f8f9fa',
              borderRadius: '6px',
              fontSize: '0.85rem',
              color: '#666',
              border: '1px solid #e9ecef'
            }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>🔧 API Configuration:</strong>
              </div>
              <div>App ID: {serviceTitanConfig.appKey}</div>
              <div>Tenant: {serviceTitanConfig.tenantId}</div>
              <div>Environment: <span style={{
                color: configStatus.environment === 'Integration' ? '#e67e22' : '#27ae60',
                fontWeight: 'bold'
              }}>
                {configStatus.environment} {configStatus.environment === 'Integration' ? '(Development)' : '(Live)'}
              </span></div>
            </div>
          )}
        </div>
        
        <div className="login-footer">
          <p>Using ServiceTitan API for secure authentication</p>
        </div>
      </div>
    </div>
  );
}

export default Login;