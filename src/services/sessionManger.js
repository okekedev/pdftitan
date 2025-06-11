// src/services/sessionManager.js - Optimized Session Manager
// Session storage for user authentication

class SessionManager {
  constructor() {
    this.sessionKey = 'titanpdf_user_session';
  }

  // Save user session after successful login
  setUserSession(userData) {
    const sessionData = {
      user: userData,
      employee: userData.employee, // Store employee info separately for easy access
      company: userData.company,
      authLayers: userData.authLayers || {
        employee: true,
        adminSuper: false
      },
      loginTime: Date.now(),
      expiresAt: Date.now() + (8 * 60 * 60 * 1000) // 8 hours
    };
    
    sessionStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
    console.log('✅ User session saved for:', userData.employee?.name || 'Unknown');
  }

  // Get current user session
  getUserSession() {
    try {
      const stored = sessionStorage.getItem(this.sessionKey);
      if (!stored) return null;

      const session = JSON.parse(stored);
      
      // Check if expired
      if (Date.now() > session.expiresAt) {
        this.clearSession();
        console.log('⏰ Session expired');
        return null;
      }

      return session;
    } catch (error) {
      console.error('❌ Error getting session:', error);
      return null;
    }
  }

  // Check if user is logged in
  isLoggedIn() {
    return this.getUserSession() !== null;
  }

  // Clear session (logout)
  clearSession() {
    sessionStorage.removeItem(this.sessionKey);
    console.log('🚪 Session cleared');
  }

  // Get user data
  getUser() {
    const session = this.getUserSession();
    return session ? session.user : null;
  }

  // Get employee data
  getEmployee() {
    const session = this.getUserSession();
    return session ? session.employee : null;
  }

  // Get employee name for display
  getEmployeeName() {
    const employee = this.getEmployee();
    return employee ? employee.name : 'Unknown User';
  }

  // Get employee role
  getEmployeeRole() {
    const employee = this.getEmployee();
    return employee ? employee.role : 'Unknown';
  }

  // Get user type (employee or technician)
  getUserType() {
    const employee = this.getEmployee();
    return employee ? employee.userType : 'unknown';
  }

  // Check if user has admin role
  isAdmin() {
    const employee = this.getEmployee();
    if (!employee || !employee.role) return false;
    
    const adminRoles = ['Admin', 'Owner', 'FieldManager', 'SalesManager'];
    return adminRoles.some(role => 
      employee.role.toLowerCase().includes(role.toLowerCase())
    );
  }

  // Check if user has admin super access
  hasAdminSuperAccess() {
    const session = this.getUserSession();
    return session && session.authLayers && session.authLayers.adminSuper;
  }

  // Enable admin super access (after validation)
  enableAdminSuperAccess() {
    const session = this.getUserSession();
    if (session && this.isAdmin()) {
      session.authLayers.adminSuper = true;
      session.adminSuperAccessTime = Date.now();
      sessionStorage.setItem(this.sessionKey, JSON.stringify(session));
      console.log('🔑 Admin super access enabled for:', session.employee.name);
      return true;
    }
    return false;
  }

  // Validate admin super access via ApiClient
  async validateAdminSuperAccess(adminPassword) {
    const session = this.getUserSession();
    if (!session || !this.isAdmin()) {
      return {
        success: false,
        error: 'User does not have admin privileges'
      };
    }

    try {
      // Import apiClient here to avoid circular dependency
      const apiClient = (await import('./apiClient')).default;
      
      const result = await apiClient.validateAdminAccess(adminPassword, session.employee.role);
      
      if (result.success) {
        this.enableAdminSuperAccess();
        return {
          success: true,
          permissions: result.permissions,
          message: result.message
        };
      } else {
        return {
          success: false,
          error: result.error,
          layer: result.layer
        };
      }
      
    } catch (error) {
      console.error('❌ Admin super access validation error:', error);
      return {
        success: false,
        error: 'Unable to validate admin access'
      };
    }
  }

  // Check if user has ServiceTitan access token
  hasValidServiceTitanAccess() {
    const session = this.getUserSession();
    return session && session.user && session.user.accessToken;
  }

  // Get ServiceTitan access token
  getServiceTitanToken() {
    const session = this.getUserSession();
    return session?.user?.accessToken || null;
  }

  // Get ServiceTitan app key (Note: This is now server-side only)
  getServiceTitanAppKey() {
    console.warn('⚠️ AppKey is now server-side only. This method is deprecated.');
    return null;
  }

  // Get tenant ID (Note: This is now server-side only)
  getTenantId() {
    console.warn('⚠️ TenantId is now server-side only. This method is deprecated.');
    return null;
  }

  // Update session with new data
  updateSession(updates) {
    const session = this.getUserSession();
    if (session) {
      const updatedSession = {
        ...session,
        user: { ...session.user, ...updates },
        lastUpdated: Date.now()
      };
      sessionStorage.setItem(this.sessionKey, JSON.stringify(updatedSession));
      console.log('✅ Session updated');
    }
  }

  // Get authentication status
  getAuthStatus() {
    const session = this.getUserSession();
    if (!session) {
      return {
        loggedIn: false,
        layers: {
          employee: false,
          adminSuper: false
        }
      };
    }

    return {
      loggedIn: true,
      layers: session.authLayers || {
        employee: true,
        adminSuper: false
      },
      employeeName: session.employee?.name || 'Unknown',
      employeeRole: session.employee?.role || 'Unknown',
      userType: session.employee?.userType || 'unknown',
      company: session.company || 'Unknown',
      isAdmin: this.isAdmin(),
      hasAdminSuper: this.hasAdminSuperAccess()
    };
  }

  // Get session info for debugging
  getSessionInfo() {
    const session = this.getUserSession();
    if (!session) {
      return {
        loggedIn: false,
        timeRemaining: 0
      };
    }

    const timeRemaining = Math.round((session.expiresAt - Date.now()) / 1000);
    return {
      loggedIn: true,
      employeeName: session.employee?.name || 'Unknown',
      employeeEmail: session.employee?.email || 'Unknown',
      employeeRole: session.employee?.role || 'Unknown',
      userType: session.employee?.userType || 'unknown',
      company: session.company || 'Unknown',
      timeRemaining: timeRemaining,
      timeRemainingFormatted: this.formatTime(timeRemaining),
      loginTime: new Date(session.loginTime).toLocaleString(),
      authStatus: {
        employee: session.authLayers?.employee || true,
        adminSuper: session.authLayers?.adminSuper || false
      },
      isAdmin: this.isAdmin(),
      hasAdminSuper: this.hasAdminSuperAccess()
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

  // Check if user can see all jobs (admin with super access)
  canSeeAllJobs() {
    return this.isAdmin() && this.hasAdminSuperAccess();
  }

  // Get permissions for current user
  getPermissions() {
    const isAdmin = this.isAdmin();
    const hasAdminSuper = this.hasAdminSuperAccess();
    
    return {
      viewOwnJobs: true,
      editPDFs: true,
      viewAllJobs: isAdmin && hasAdminSuper,
      viewAllProjects: isAdmin && hasAdminSuper,
      viewAllEmployees: isAdmin && hasAdminSuper,
      adminAccess: isAdmin,
      superAdminAccess: hasAdminSuper
    };
  }

  // Test server connection (using apiClient)
  async testServerConnection() {
    try {
      const apiClient = (await import('./apiClient')).default;
      return await apiClient.testConnection();
    } catch (error) {
      console.error('❌ Server connection test failed:', error);
      return {
        connected: false,
        error: 'Could not test server connection'
      };
    }
  }
}

// Export singleton
const sessionManager = new SessionManager();
export default sessionManager;