// src/services/sessionManager.js - Updated for Role-Based Authentication
// Session storage for user authentication

class SessionManager {
  constructor() {
    this.sessionKey = 'titanpdf_user_session';
  }

  // Save user session after successful login - Updated for role-based auth
  setUserSession(userData) {
    const sessionData = {
      user: {
        ...userData,
        // Ensure company data is properly nested under user
        company: userData.company
      },
      employee: userData.employee,
      access: userData.access, // NEW: Store role-based access info
      company: userData.company, // Keep for backward compatibility
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

  // NEW: Get access level data
  getAccess() {
    const session = this.getUserSession();
    return session ? session.access : null;
  }

  // Get company data
  getCompany() {
    const session = this.getUserSession();
    // Try user.company first, then fall back to top-level company
    return session?.user?.company || session?.company || null;
  }

  // Get tenant ID - Updated to use correct path
  getTenantId() {
    const company = this.getCompany();
    return company?.tenantId || null;
  }

  // Get app key - Updated to use correct path
  getAppKey() {
    const company = this.getCompany();
    return company?.appKey || null;
  }

  // Get employee name for display
  getEmployeeName() {
    const employee = this.getEmployee();
    return employee ? employee.name : 'Unknown User';
  }

  // Get username for display
  getUsername() {
    const employee = this.getEmployee();
    return employee ? employee.loginName : 'Unknown';
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

  // NEW: Check if user is admin using role-based access
  isAdmin() {
    const access = this.getAccess();
    return access ? access.isAdmin : false;
  }

  // NEW: Check if user is technician using role-based access
  isTechnician() {
    const access = this.getAccess();
    return access ? access.isTechnician : false;
  }

  // NEW: Get access level (admin, technician, denied)
  getAccessLevel() {
    const access = this.getAccess();
    return access ? access.level : 'unknown';
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

  // Get ServiceTitan app key (Updated to use correct path)
  getServiceTitanAppKey() {
    return this.getAppKey();
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

  // Get authentication status - Updated for role-based auth
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

    const access = session.access || {};
    const company = this.getCompany();
    
    return {
      loggedIn: true,
      layers: session.authLayers || {
        employee: true,
        adminSuper: false
      },
      employeeName: session.employee?.name || 'Unknown',
      username: session.employee?.loginName || 'Unknown',
      employeeRole: session.employee?.role || 'Unknown',
      userType: session.employee?.userType || 'unknown',
      company: company?.name || 'Unknown Company',
      tenantId: company?.tenantId || 'Unknown',
      accessLevel: access.level || 'unknown',
      isAdmin: access.isAdmin || false,
      isTechnician: access.isTechnician || false,
      hasAdminSuper: this.hasAdminSuperAccess(),
      nextScreen: access.nextScreen || 'unknown'
    };
  }

  // Get session info for debugging - Updated
  getSessionInfo() {
    const session = this.getUserSession();
    if (!session) {
      return {
        loggedIn: false,
        timeRemaining: 0
      };
    }

    const timeRemaining = Math.round((session.expiresAt - Date.now()) / 1000);
    const access = session.access || {};
    const company = this.getCompany();
    
    return {
      loggedIn: true,
      employeeName: session.employee?.name || 'Unknown',
      username: session.employee?.loginName || 'Unknown',
      employeeEmail: session.employee?.email || 'Unknown',
      employeeRole: session.employee?.role || 'Unknown',
      userType: session.employee?.userType || 'unknown',
      company: company?.name || 'Unknown Company',
      tenantId: company?.tenantId || 'Unknown',
      appKey: company?.appKey ? 'Present' : 'Missing',
      timeRemaining: timeRemaining,
      timeRemainingFormatted: this.formatTime(timeRemaining),
      loginTime: new Date(session.loginTime).toLocaleString(),
      authStatus: {
        employee: session.authLayers?.employee || true,
        adminSuper: session.authLayers?.adminSuper || false
      },
      accessLevel: access.level || 'unknown',
      isAdmin: access.isAdmin || false,
      isTechnician: access.isTechnician || false,
      hasAdminSuper: this.hasAdminSuperAccess(),
      nextScreen: access.nextScreen || 'unknown'
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

  // NEW: Check if user needs company code screen
  needsCompanyCode() {
    const access = this.getAccess();
    return access && access.permissions && access.permissions.needsCompanyCode;
  }

  // Check if user can see all jobs (admin with super access)
  canSeeAllJobs() {
    return this.isAdmin() && this.hasAdminSuperAccess();
  }

  // Get permissions for current user - Updated for role-based auth
  getPermissions() {
    const access = this.getAccess();
    const isAdmin = this.isAdmin();
    const hasAdminSuper = this.hasAdminSuperAccess();
    
    if (!access || !access.permissions) {
      return {
        viewOwnJobs: false,
        editPDFs: false,
        viewAllJobs: false,
        viewAllProjects: false,
        viewAllEmployees: false,
        adminAccess: false,
        superAdminAccess: false
      };
    }
    
    return {
      ...access.permissions,
      viewOwnJobs: true,
      editPDFs: true,
      viewAllJobs: isAdmin && hasAdminSuper,
      viewAllProjects: isAdmin && hasAdminSuper,
      viewAllEmployees: isAdmin && hasAdminSuper,
      adminAccess: isAdmin,
      superAdminAccess: hasAdminSuper
    };
  }

  // NEW: Get next screen user should see
  getNextScreen() {
    const access = this.getAccess();
    return access ? access.nextScreen : 'unknown';
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