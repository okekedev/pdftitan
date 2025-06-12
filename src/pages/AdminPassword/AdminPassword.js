import React, { useState } from 'react';
import apiClient from '../../services/apiClient';
import './AdminPassword.css';

function AdminPassword({ user, onAdminAccessGranted, onBack }) {
  const [adminPassword, setAdminPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdminLogin = async () => {
    if (!adminPassword.trim()) {
      setError('Please enter the admin password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('🔑 Validating admin password...');
      
      const result = await apiClient.validateAdminAccess(adminPassword, user.employee.role, user.employee.loginName);
      
      if (result.success) {
        console.log('✅ Admin access granted:', result);
        
        // Update user session with admin super access
        const updatedUserData = {
          ...user,
          authLayers: {
            ...user.authLayers,
            adminSuper: true
          },
          adminPermissions: result.permissions,
          adminAccessTime: Date.now()
        };

        onAdminAccessGranted(updatedUserData);
        
      } else {
        setError(result.error || 'Invalid admin password');
      }
      
    } catch (error) {
      console.error('❌ Admin authentication error:', error);
      
      if (error.message.includes('401')) {
        // Parse attempts remaining from error message
        if (error.message.includes('attempts remaining')) {
          setError(error.message);
        } else {
          setError('Invalid admin password. Please try again.');
        }
      } else if (error.message.includes('429')) {
        setError('Account temporarily locked due to too many failed attempts. Please wait and try again later.');
      } else if (error.message.includes('403')) {
        setError('You do not have admin privileges.');
      } else if (error.message.includes('500')) {
        setError('Admin access not configured on server.');
      } else {
        setError('Unable to validate admin access. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAdminLogin();
    }
  };

  return (
    <div className="admin-password-container">
      <div className="admin-password-card">
        <div className="admin-password-header">
          <h1>🔐 Admin Access</h1>
          <p>MrBackflow TX - Administrator Verification</p>
        </div>

        <div className="user-info-section">
          <div className="user-details">
            <h3>Welcome, {user.employee.name}</h3>
            <p className="user-role">Role: {user.employee.role}</p>
            <p className="access-level">Access Level: Administrator</p>
          </div>
        </div>

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        <div className="admin-form">
          <div className="form-group">
            <label htmlFor="adminPassword">Admin Password</label>
            <input
              type="password"
              id="adminPassword"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter admin password"
              disabled={isLoading}
              className="admin-password-input"
              autoFocus
            />
          </div>

          <div className="button-group">
            <button 
              onClick={onBack}
              className="back-btn"
              disabled={isLoading}
            >
              ← Back to Login
            </button>
            
            <button 
              onClick={handleAdminLogin}
              className={`admin-login-btn ${isLoading ? 'loading' : ''}`}
              disabled={isLoading || !adminPassword.trim()}
            >
              {isLoading ? 'Verifying...' : '🔑 Access Admin Panel'}
            </button>
          </div>
        </div>

        <div className="admin-footer">
          <p>Enter the administrator password to access the full admin panel</p>
          <div className="security-notice">
            <p>🔒 This is a secure area. Your access is being logged.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPassword;