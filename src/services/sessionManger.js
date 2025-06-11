// src/services/sessionManager.js
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
    console.log('✅ User auth session saved for:', userData.employee?.name || 'Unknown');
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

  // Enable admin super access (after third layer validation)
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

  // Validate admin super access via server
  async validateAdminSuperAccess(adminPassword) {
    const session = this.getUserSession();
    if (!session || !this.isAdmin()) {
      return {
        success: false,
        error: 'User does not have admin privileges'
      };
    }

    try {
      const response = await fetch('http://localhost:3005/api/admin/validate-super-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminPassword: adminPassword,
          userRole: session.employee.role
        })
      });

      const result = await response.json();
      
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

  // Get ServiceTitan app key
  getServiceTitanAppKey() {
    const session = this.getUserSession();
    return session?.user?.appKey || null;
  }

  // Get tenant ID
  getTenantId() {
    const session = this.getUserSession();
    return session?.user?.tenantId || null;
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
}

// Export singleton
const sessionManager = new SessionManager();
export default sessionManager;