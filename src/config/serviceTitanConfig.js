// ServiceTitan Configuration
export const serviceTitanConfig = {
  // API Credentials
  clientId: process.env.REACT_APP_SERVICETITAN_CLIENT_ID,
  clientSecret: process.env.REACT_APP_SERVICETITAN_CLIENT_SECRET,
  appKey: process.env.REACT_APP_SERVICETITAN_APP_KEY,
  tenantId: process.env.REACT_APP_SERVICETITAN_TENANT_ID,
  
  // API Endpoints
  authUrl: process.env.REACT_APP_SERVICETITAN_AUTH_URL,
  apiBaseUrl: process.env.REACT_APP_SERVICETITAN_API_BASE_URL,
  
  // Environment Info
  isIntegrationEnvironment: process.env.REACT_APP_SERVICETITAN_API_BASE_URL?.includes('integration'),
  
  // Validation
  isConfigured() {
    return !!(this.clientId && this.clientSecret && this.appKey && this.tenantId && this.authUrl && this.apiBaseUrl);
  },
  
  // Get missing configuration items
  getMissingConfig() {
    const missing = [];
    if (!this.clientId) missing.push('REACT_APP_SERVICETITAN_CLIENT_ID');
    if (!this.clientSecret) missing.push('REACT_APP_SERVICETITAN_CLIENT_SECRET');
    if (!this.appKey) missing.push('REACT_APP_SERVICETITAN_APP_KEY');
    if (!this.tenantId) missing.push('REACT_APP_SERVICETITAN_TENANT_ID');
    if (!this.authUrl) missing.push('REACT_APP_SERVICETITAN_AUTH_URL');
    if (!this.apiBaseUrl) missing.push('REACT_APP_SERVICETITAN_API_BASE_URL');
    return missing;
  }
};