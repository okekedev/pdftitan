// src/services/sessionManager.js - Simplified for Technician-Only Portal

class SessionManager {
  constructor() {
    this.sessionKey = 'titanpdf_technician_session';
  }

  // Save technician session after successful login
  setTechnicianSession(userData) {
    console.log('🔧 Setting technician session for:', userData.technician?.name);
    
    const sessionData = {
      technician: userData.technician,
      company: userData.company,
      accessToken: userData.accessToken,
      environment: userData.environment,
      loginTime: Date.now(),
      expiresAt: Date.now() + (8 * 60 * 60 * 1000) // 8 hours
    };
    
    sessionStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
    console.log('✅ Technician session saved');
  }

  // Get current technician session
  getTechnicianSession() {
    try {
      const stored = sessionStorage.getItem(this.sessionKey);
      if (!stored) return null;

      const session = JSON.parse(stored);
      
      // Check if expired
      if (Date.now() > session.expiresAt) {
        this.clearTechnicianSession();
        console.log('⏰ Technician session expired');
        return null;
      }

      return session;
    } catch (error) {
      console.error('❌ Error getting technician session:', error);
      return null;
    }
  }

  // Check if technician is logged in
  isLoggedIn() {
    return this.getTechnicianSession() !== null;
  }

  // Clear session (logout)
  clearTechnicianSession() {
    sessionStorage.removeItem(this.sessionKey);
    console.log('🚪 Technician session cleared');
  }

  // Alias for backward compatibility
  clearSession() {
    this.clearTechnicianSession();
  }

  // Get technician data
  getTechnician() {
    const session = this.getTechnicianSession();
    return session ? session.technician : null;
  }

  // Get company data
  getCompany() {
    const session = this.getTechnicianSession();
    return session ? session.company : null;
  }

  // Get tenant ID
  getTenantId() {
    const company = this.getCompany();
    const tenantId = company ? company.tenantId : null;
    
    if (!tenantId) {
      console.warn('⚠️ Tenant ID not found in session');
    }
    
    return tenantId;
  }

  // Get app key
  getAppKey() {
    const company = this.getCompany();
    const appKey = company ? company.appKey : null;
    
    if (!appKey) {
      console.warn('⚠️ App Key not found in session');
    }
    
    return appKey;
  }

  // Get technician name for display
  getTechnicianName() {
    const technician = this.getTechnician();
    return technician ? technician.name : 'Unknown Technician';
  }

  // Get technician ID
  getTechnicianId() {
    const technician = this.getTechnician();
    return technician ? technician.id : null;
  }

  // Get technician login name
  getTechnicianLoginName() {
    const technician = this.getTechnician();
    return technician ? technician.loginName : null;
  }

  // Get technician email
  getTechnicianEmail() {
    const technician = this.getTechnician();
    return technician ? technician.email : null;
  }

  // Get technician phone
  getTechnicianPhone() {
    const technician = this.getTechnician();
    return technician ? technician.phoneNumber : null;
  }

  // Get ServiceTitan access token
  getServiceTitanToken() {
    const session = this.getTechnicianSession();
    return session ? session.accessToken : null;
  }

  // Get environment info
  getEnvironment() {
    const session = this.getTechnicianSession();
    return session ? session.environment : 'Unknown';
  }

  // Get session info for debugging
  getSessionInfo() {
    const session = this.getTechnicianSession();
    if (!session) {
      return {
        loggedIn: false,
        timeRemaining: 0
      };
    }

    const timeRemaining = Math.round((session.expiresAt - Date.now()) / 1000);
    const company = session.company || {};
    const technician = session.technician || {};
    
    return {
      loggedIn: true,
      technicianName: technician.name || 'Unknown',
      technicianId: technician.id || 'Unknown',
      technicianLoginName: technician.loginName || 'Unknown',
      technicianEmail: technician.email || 'Unknown',
      technicianPhone: technician.phoneNumber || 'Unknown',
      company: company.name || 'Unknown Company',
      tenantId: company.tenantId || 'Unknown',
      appKey: company.appKey ? 'Present' : 'Missing',
      timeRemaining: timeRemaining,
      timeRemainingFormatted: this.formatTime(timeRemaining),
      loginTime: new Date(session.loginTime).toLocaleString(),
      environment: session.environment || 'Unknown'
    };
  }

  // Helper method to format time
  formatTime(seconds) {
    if (seconds <= 0) return '0m';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  // Check if session is about to expire (less than 30 minutes)
  isSessionExpiringSoon() {
    const session = this.getTechnicianSession();
    if (!session) return false;
    
    const timeRemaining = session.expiresAt - Date.now();
    const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds
    
    return timeRemaining < thirtyMinutes;
  }

  // Extend session (refresh expiration time)
  extendSession() {
    const session = this.getTechnicianSession();
    if (session) {
      session.expiresAt = Date.now() + (8 * 60 * 60 * 1000); // Reset to 8 hours
      sessionStorage.setItem(this.sessionKey, JSON.stringify(session));
      console.log('✅ Technician session extended');
      return true;
    }
    return false;
  }

  // Update session with new data
  updateSession(updates) {
    const session = this.getTechnicianSession();
    if (session) {
      const updatedSession = {
        ...session,
        ...updates,
        lastUpdated: Date.now()
      };
      sessionStorage.setItem(this.sessionKey, JSON.stringify(updatedSession));
      console.log('✅ Technician session updated');
      return true;
    }
    return false;
  }

  // Test server connection
  async testServerConnection() {
    try {
      const response = await fetch('http://localhost:3005/health');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return {
        connected: true,
        serverStatus: data.status,
        environment: data.environment,
        message: data.message
      };
    } catch (error) {
      console.error('❌ Server connection test failed:', error);
      return {
        connected: false,
        error: error.message || 'Could not connect to server'
      };
    }
  }

  // Debug method to validate session data integrity
  validateSession() {
    const session = this.getTechnicianSession();
    if (!session) {
      return {
        valid: false,
        errors: ['No session found']
      };
    }

    const errors = [];
    
    if (!session.technician) {
      errors.push('Missing technician data');
    } else {
      if (!session.technician.id) errors.push('Missing technician ID');
      if (!session.technician.name) errors.push('Missing technician name');
      if (!session.technician.loginName) errors.push('Missing technician login name');
    }

    if (!session.company) {
      errors.push('Missing company data');
    } else {
      if (!session.company.tenantId) errors.push('Missing tenant ID');
      if (!session.company.appKey) errors.push('Missing app key');
    }

    if (!session.accessToken) {
      errors.push('Missing access token');
    }

    if (!session.loginTime || !session.expiresAt) {
      errors.push('Missing session timing data');
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      session: session
    };
  }

  // Get authentication status for display
  getAuthStatus() {
    const session = this.getTechnicianSession();
    if (!session) {
      return {
        authenticated: false,
        message: 'Not logged in'
      };
    }

    const validation = this.validateSession();
    if (!validation.valid) {
      return {
        authenticated: false,
        message: 'Invalid session',
        errors: validation.errors
      };
    }

    const timeRemaining = session.expiresAt - Date.now();
    if (timeRemaining <= 0) {
      return {
        authenticated: false,
        message: 'Session expired'
      };
    }

    return {
      authenticated: true,
      message: 'Authenticated',
      technicianName: session.technician.name,
      timeRemaining: this.formatTime(Math.round(timeRemaining / 1000)),
      expiringSoon: this.isSessionExpiringSoon()
    };
  }
}

// Export singleton
const sessionManager = new SessionManager();
export default sessionManager;