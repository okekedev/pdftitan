// src/services/sessionManager.js - FIXED for Tenant ID Access
// Session storage for user authentication

class SessionManager {
  constructor() {
    this.sessionKey = 'titanpdf_user_session';
  }

  // ✅ FIXED: Save user session after successful login
  setUserSession(userData) {
    console.log('🔧 DEBUG: Setting user session with data:', userData);
    
    // ✅ CRITICAL FIX: Don't spread userData into user object
    // userData contains the full server response structure
    const sessionData = {
      user: userData.user,              // ✅ Just the user data
      employee: userData.employee,      // ✅ Employee data  
      access: userData.access,          // ✅ Access permissions
      company: userData.company,        // ✅ Company data with tenant ID
      accessToken: userData.accessToken, // ✅ ServiceTitan token
      environment: userData.environment, // ✅ Environment info
      authLayers: userData.authLayers || {
        employee: true,
        adminSuper: false
      },
      loginTime: Date.now(),
      expiresAt: Date.now() + (8 * 60 * 60 * 1000) // 8 hours
    };
    
    // ✅ DEBUG: Log the tenant ID specifically
    console.log('🔧 DEBUG: Tenant ID being stored:', sessionData.company?.tenantId);
    console.log('🔧 DEBUG: Full company data:', sessionData.company);
    
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

  // Get access level data
  getAccess() {
    const session = this.getUserSession();
    return session ? session.access : null;
  }

  // ✅ FIXED: Get company data - simplified
  getCompany() {
    const session = this.getUserSession();
    const company = session?.company;
    
    // ✅ DEBUG: Log what we're returning
    console.log('🔧 DEBUG: getCompany() returning:', company);
    
    return company || null;
  }

  // ✅ FIXED: Get tenant ID with debugging
  getTenantId() {
    const company = this.getCompany();
    const tenantId = company?.tenantId;
    
    // ✅ DEBUG: Log tenant ID retrieval
    console.log('🔧 DEBUG: getTenantId() - Company:', company);
    console.log('🔧 DEBUG: getTenantId() - Tenant ID:', tenantId);
    
    if (!tenantId) {
      console.error('❌ CRITICAL: Tenant ID not found in session!');
      console.error('❌ Available company data:', company);
      
      // Additional debugging
      const session = this.getUserSession();
      console.error('❌ Full session data:', session);
    }
    
    return tenantId || null;
  }

  // ✅ FIXED: Get app key with debugging
  getAppKey() {
    const company = this.getCompany();
    const appKey = company?.appKey;
    
    // ✅ DEBUG: Log app key retrieval
    console.log('🔧 DEBUG: getAppKey() - App Key:', appKey ? 'Present' : 'Missing');
    
    if (!appKey) {
      console.error('❌ CRITICAL: App Key not found in session!');
    }
    
    return appKey || null;
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

  // Check if user is admin using role-based access
  isAdmin() {
    const access = this.getAccess();
    return access ? access.isAdmin : false;
  }

  // Check if user is technician using role-based access
  isTechnician() {
    const access = this.getAccess();
    return access ? access.isTechnician : false;
  }

  // Get access level (admin, technician, denied)
  getAccessLevel() {
    const access = this.getAccess();
    return access ? access.level : 'unknown';
  }

  // Check if user has admin super access
  hasAdminSuperAccess() {
    const session = this.getUserSession();
    return session && session.authLayers && session.authLayers.adminSuper;
  }

  // ✅ FIXED: Enable admin super access with proper session update
  enableAdminSuperAccess() {
    const session = this.getUserSession();
    if (session && this.isAdmin()) {
      session.authLayers.adminSuper = true;
      session.adminSuperAccessTime = Date.now();
      sessionStorage.setItem(this.sessionKey, JSON.stringify(session));
      console.log('🔑 Admin super access enabled for:', session.employee?.name);
      return true;
    }
    return false;
  }

  // ✅ FIXED: Validate admin super access via ApiClient
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
      
      const result = await apiClient.validateAdminAccess(adminPassword, session.employee?.role);
      
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
    return session && session.accessToken;
  }

  // ✅ FIXED: Get ServiceTitan access token
  getServiceTitanToken() {
    const session = this.getUserSession();
    const token = session?.accessToken;
    
    console.log('🔧 DEBUG: getServiceTitanToken():', token ? 'Present' : 'Missing');
    
    return token || null;
  }

  // Get ServiceTitan app key (alias for getAppKey)
  getServiceTitanAppKey() {
    return this.getAppKey();
  }

  // ✅ FIXED: Update session with new data (preserve structure)
  updateSession(updates) {
    const session = this.getUserSession();
    if (session) {
      const updatedSession = {
        ...session,
        ...updates, // Merge updates at top level
        lastUpdated: Date.now()
      };
      sessionStorage.setItem(this.sessionKey, JSON.stringify(updatedSession));
      console.log('✅ Session updated');
    }
  }

  // ✅ FIXED: Get authentication status 
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
    const company = session.company || {};
    
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
      company: company.name || 'Unknown Company',
      tenantId: company.tenantId || 'Unknown',
      accessLevel: access.level || 'unknown',
      isAdmin: access.isAdmin || false,
      isTechnician: access.isTechnician || false,
      hasAdminSuper: this.hasAdminSuperAccess(),
      nextScreen: access.nextScreen || 'unknown'
    };
  }

  // ✅ FIXED: Get session info for debugging
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
    const company = session.company || {};
    
    return {
      loggedIn: true,
      employeeName: session.employee?.name || 'Unknown',
      username: session.employee?.loginName || 'Unknown',  
      employeeEmail: session.employee?.email || 'Unknown',
      employeeRole: session.employee?.role || 'Unknown',
      userType: session.employee?.userType || 'unknown',
      company: company.name || 'Unknown Company',
      tenantId: company.tenantId || 'Unknown',              // ✅ FIXED
      appKey: company.appKey ? 'Present' : 'Missing',       // ✅ FIXED
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

  // Check if user needs company code screen
  needsCompanyCode() {
    const access = this.getAccess();
    return access && access.permissions && access.permissions.needsCompanyCode;
  }

  // Check if user can see all jobs (admin with super access)
  canSeeAllJobs() {
    return this.isAdmin() && this.hasAdminSuperAccess();
  }

  // Get permissions for current user
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

  // Get next screen user should see
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

  // ✅ NEW: Debug method to check tenant ID availability
  debugTenantIdAccess() {
    console.log('🔧 DEBUG: Checking tenant ID access...');
    
    const session = this.getUserSession();
    console.log('🔧 DEBUG: Full session:', session);
    
    const company = this.getCompany();
    console.log('🔧 DEBUG: Company data:', company);
    
    const tenantId = this.getTenantId();
    console.log('🔧 DEBUG: Tenant ID:', tenantId);
    
    const appKey = this.getAppKey();
    console.log('🔧 DEBUG: App Key:', appKey ? 'Present' : 'Missing');
    
    const token = this.getServiceTitanToken();
    console.log('🔧 DEBUG: Access Token:', token ? 'Present' : 'Missing');
    
    return {
      sessionExists: !!session,
      companyExists: !!company,
      tenantIdExists: !!tenantId,
      appKeyExists: !!appKey,
      tokenExists: !!token,
      tenantId: tenantId,
      company: company
    };
  }
}

// Export singleton
const sessionManager = new SessionManager();
export default sessionManager;