// src/config/serviceTitanConfig.js - Client-Side ServiceTitan Configuration
// ⚠️ This file is bundled into the browser - DO NOT include secrets like clientSecret or appKey!

class ServiceTitanConfig {
  constructor() {
    this._validateConfig();
  }

  // Public ServiceTitan configuration (safe for browser)
  get api() {
    return {
      // Only include PUBLIC values that are actually needed by client
      // Note: tenantId moved to server-side since it's only used in server API calls
      authUrl: process.env.REACT_APP_SERVICETITAN_AUTH_URL,
      apiBaseUrl: process.env.REACT_APP_SERVICETITAN_API_BASE_URL,
      
      // Request settings
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000
    };
  }

  // Environment detection
  get environment() {
    const isIntegration = this.api.apiBaseUrl?.includes('integration');
    return {
      isIntegration,
      isProduction: !isIntegration,
      name: isIntegration ? 'Integration' : 'Production',
      apiDomain: isIntegration ? 'api-integration.servicetitan.io' : 'api.servicetitan.io',
      authDomain: isIntegration ? 'auth-integration.servicetitan.io' : 'auth.servicetitan.io'
    };
  }

  // Client application settings
  get app() {
    return {
      name: 'TitanPDF',
      version: '1.0.0',
      
      // UI settings
      pageSize: 50,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      supportedFileTypes: ['.pdf'],
      
      // Session settings (client-side only)
      sessionWarningTime: 5 * 60 * 1000, // 5 minutes before expiry warning
      autoLogoutTime: 8 * 60 * 60 * 1000, // 8 hours total session
      
      // Development flags
      debugMode: process.env.NODE_ENV === 'development',
      isDevelopment: process.env.NODE_ENV === 'development'
    };
  }

  // API endpoint configuration - pointing to our proxy server
  get endpoints() {
    const isDev = this.app.isDevelopment;
    const proxyBase = 'http://localhost:3005';
    
    return {
      // Auth endpoints (always through our proxy for security)
      userValidation: `${proxyBase}/api/user/validate`,
      adminValidation: `${proxyBase}/api/admin/validate-super-access`,
      
      // ServiceTitan OAuth (through proxy in dev, direct in production)
      auth: isDev ? `${proxyBase}/api/servicetitan/auth` : this.api.authUrl,
      
      // Health check
      health: `${proxyBase}/health`
    };
  }

  // Request configuration templates
  get requestDefaults() {
    return {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: this.api.timeout,
      credentials: 'include' // For CORS with our proxy
    };
  }

  // Validation methods
  isConfigured() {
    return !!(this.api.authUrl && this.api.apiBaseUrl);
  }

  getMissingConfig() {
    const required = [
      { key: 'REACT_APP_SERVICETITAN_AUTH_URL', value: this.api.authUrl },
      { key: 'REACT_APP_SERVICETITAN_API_BASE_URL', value: this.api.apiBaseUrl }
    ];

    return required
      .filter(item => !item.value)
      .map(item => item.key);
  }

  _validateConfig() {
    if (!this.isConfigured()) {
      const missing = this.getMissingConfig();
      console.warn('⚠️ ServiceTitan configuration incomplete. Missing:', missing);
      
      if (this.app.debugMode) {
        console.warn('🔧 Add these to your .env file:');
        missing.forEach(key => console.warn(`   ${key}=your_value_here`));
      }
    }
  }

  // Helper methods for the app
  getProxyUrl(endpoint = '') {
    if (!this.app.isDevelopment) return null;
    return `http://localhost:3005${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  }

  // Configuration summary for debugging
  getConfigSummary() {
    return {
      configured: this.isConfigured(),
      environment: this.environment.name,
      debugMode: this.app.debugMode,
      proxyAvailable: this.app.isDevelopment
    };
  }

  // Error formatting helper
  formatApiError(error) {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.error) return error.error;
    return 'An unexpected error occurred';
  }

  // Check if response is valid ServiceTitan API response
  isValidApiResponse(response) {
    return response && 
           typeof response === 'object' && 
           response.success !== false &&
           !response.error;
  }
}

// Export singleton instance
export const serviceTitanConfig = new ServiceTitanConfig();

// Development logging
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 ServiceTitan Config Loaded:', serviceTitanConfig.getConfigSummary());
}

// Default export for backward compatibility
export default serviceTitanConfig;