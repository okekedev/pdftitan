// src/services/sessionManager.js - Consolidated Session Management
class SessionManager {
  constructor() {
    this.storageKey = 'titanpdf_technician_session';
    this.maxSessionAge = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
  }

  // ================== SESSION MANAGEMENT ==================

  // Save technician session
  setTechnicianSession(userData) {
    try {
      const sessionData = {
        technician: userData.technician,
        company: userData.company,
        environment: userData.environment,
        loginTime: Date.now(),
        userType: 'technician'
      };

      sessionStorage.setItem(this.storageKey, JSON.stringify(sessionData));
      console.log('✅ Technician session saved:', userData.technician.name);
      
      return true;
    } catch (error) {
      console.error('❌ Error saving technician session:', error);
      return false;
    }
  }

  // Get current technician session
  getTechnicianSession() {
    try {
      const sessionData = sessionStorage.getItem(this.storageKey);
      
      if (!sessionData) {
        return null;
      }

      const parsed = JSON.parse(sessionData);
      
      // Check if session is still valid
      if (this.isSessionExpired(parsed)) {
        console.log('⏰ Session expired, clearing...');
        this.clearTechnicianSession();
        return null;
      }

      return parsed;
    } catch (error) {
      console.error('❌ Error reading technician session:', error);
      this.clearTechnicianSession();
      return null;
    }
  }

  // Clear technician session
  clearTechnicianSession() {
    try {
      sessionStorage.removeItem(this.storageKey);
      console.log('🧹 Technician session cleared');
      return true;
    } catch (error) {
      console.error('❌ Error clearing technician session:', error);
      return false;
    }
  }

  // ================== SESSION VALIDATION ==================

  // Check if session is expired
  isSessionExpired(sessionData) {
    if (!sessionData || !sessionData.loginTime) {
      return true;
    }

    const sessionAge = Date.now() - sessionData.loginTime;
    return sessionAge > this.maxSessionAge;
  }

  // Check if technician is logged in
  isLoggedIn() {
    const session = this.getTechnicianSession();
    return session && session.technician && session.technician.id;
  }

  // Refresh session timestamp (extend session)
  refreshSession() {
    const session = this.getTechnicianSession();
    if (session) {
      session.loginTime = Date.now();
      sessionStorage.setItem(this.storageKey, JSON.stringify(session));
      console.log('🔄 Session refreshed');
      return true;
    }
    return false;
  }

  // ================== GETTERS ==================

  // Get current technician info
  getCurrentTechnician() {
    const session = this.getTechnicianSession();
    return session ? session.technician : null;
  }

  // Get current company info
  getCurrentCompany() {
    const session = this.getTechnicianSession();
    return session ? session.company : null;
  }

  // Get technician ID
  getTechnicianId() {
    const technician = this.getCurrentTechnician();
    return technician ? technician.id : null;
  }

  // Get technician name
  getTechnicianName() {
    const technician = this.getCurrentTechnician();
    return technician ? technician.name : null;
  }

  // Get company name
  getCompanyName() {
    const company = this.getCurrentCompany();
    return company ? company.name : null;
  }

  // ================== DEBUGGING & UTILITIES ==================

  // Get session info for debugging
  getSessionInfo() {
    const session = this.getTechnicianSession();
    
    if (!session) {
      return { 
        loggedIn: false,
        message: 'No active session'
      };
    }

    const sessionAge = Date.now() - session.loginTime;
    const remainingTime = this.maxSessionAge - sessionAge;

    return {
      loggedIn: true,
      technicianName: session.technician.name,
      technicianId: session.technician.id,
      companyName: session.company.name,
      environment: session.environment,
      loginTime: new Date(session.loginTime).toLocaleString(),
      sessionAge: this.formatDuration(sessionAge),
      timeRemaining: remainingTime > 0 ? this.formatDuration(remainingTime) : 'Expired',
      isExpired: this.isSessionExpired(session)
    };
  }

  // Format duration in human-readable format
  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Get session status for UI
  getSessionStatus() {
    const session = this.getTechnicianSession();
    
    if (!session) {
      return {
        status: 'not_logged_in',
        message: 'Please log in'
      };
    }

    const sessionAge = Date.now() - session.loginTime;
    const remainingTime = this.maxSessionAge - sessionAge;

    if (remainingTime <= 0) {
      return {
        status: 'expired',
        message: 'Session has expired'
      };
    }

    if (remainingTime < 30 * 60 * 1000) { // Less than 30 minutes
      return {
        status: 'expiring_soon',
        message: 'Session expires soon',
        timeRemaining: this.formatDuration(remainingTime)
      };
    }

    return {
      status: 'active',
      message: 'Session is active',
      timeRemaining: this.formatDuration(remainingTime)
    };
  }

  // ================== AUTO-LOGOUT FUNCTIONALITY ==================

  // Set up auto-logout timer
  setupAutoLogout(callback) {
    const session = this.getTechnicianSession();
    if (!session) return;

    const sessionAge = Date.now() - session.loginTime;
    const remainingTime = this.maxSessionAge - sessionAge;

    if (remainingTime <= 0) {
      callback();
      return;
    }

    setTimeout(() => {
      console.log('⏰ Auto-logout triggered');
      this.clearTechnicianSession();
      callback();
    }, remainingTime);

    console.log(`⏰ Auto-logout set for ${this.formatDuration(remainingTime)}`);
  }

  // ================== STORAGE UTILITIES ==================

  // Get raw session data (for debugging)
  getRawSessionData() {
    try {
      return sessionStorage.getItem(this.storageKey);
    } catch (error) {
      console.error('❌ Error reading raw session data:', error);
      return null;
    }
  }

  // Check if session storage is available
  isStorageAvailable() {
    try {
      const testKey = 'titanpdf_test';
      sessionStorage.setItem(testKey, 'test');
      sessionStorage.removeItem(testKey);
      return true;
    } catch (error) {
      console.error('❌ Session storage not available:', error);
      return false;
    }
  }

  // Clear all TitanPDF related storage
  clearAllStorage() {
    try {
      // Clear session storage
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('titanpdf_')) {
          sessionStorage.removeItem(key);
        }
      });

      // Clear local storage (if any)
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('titanpdf_')) {
          localStorage.removeItem(key);
        }
      });

      console.log('🧹 All TitanPDF storage cleared');
      return true;
    } catch (error) {
      console.error('❌ Error clearing storage:', error);
      return false;
    }
  }
}

// Export singleton instance
const sessionManager = new SessionManager();

// Add development helpers
if (process.env.NODE_ENV === 'development') {
  // Make session manager available globally for debugging
  window.sessionManager = sessionManager;
  
  // Log session info on load
  const sessionInfo = sessionManager.getSessionInfo();
  if (sessionInfo.loggedIn) {
    console.log('🔧 Session Info:', sessionInfo);
  }
}

export default sessionManager;