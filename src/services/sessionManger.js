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
      appKey: userData.appKey,
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
    return company ? company.tenantId : null;
  }

  // Get app key
  getAppKey() {
    const company = this.getCompany();
    return company ? company.appKey : null;
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

  // Get ServiceTitan access token
  getServiceTitanToken() {
    const session = this.getTechnicianSession();
    return session ? session.accessToken : null;
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
    
    return {
      loggedIn: true,
      technicianName: session.technician?.name || 'Unknown',
      technicianId: session.technician?.id || 'Unknown',
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
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  // Test server connection
  async testServerConnection() {
    try {
      const response = await fetch('http://localhost:3005/health');
      const data = await response.json();
      return {
        connected: true,
        serverStatus: data.status,
        environment: data.environment
      };
    } catch (error) {
      console.error('❌ Server connection test failed:', error);
      return {
        connected: false,
        error: 'Could not connect to server'
      };
    }
  }
}

// Export singleton
const sessionManager = new SessionManager();
export default sessionManager;