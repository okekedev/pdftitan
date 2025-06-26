// utils/serviceTitan.js - Centralized ServiceTitan Client
const { FormData } = require('form-data');

class ServiceTitanClient {
  constructor() {
    this.clientId = process.env.REACT_APP_SERVICETITAN_CLIENT_ID;
    this.clientSecret = process.env.REACT_APP_SERVICETITAN_CLIENT_SECRET;
    this.tenantId = process.env.REACT_APP_SERVICETITAN_TENANT_ID;
    this.appKey = process.env.REACT_APP_SERVICETITAN_APP_KEY;
    this.apiBaseUrl = process.env.REACT_APP_SERVICETITAN_API_BASE_URL;
    
    // Cache token for reuse within same execution
    this.tokenCache = null;
    this.tokenExpiry = null;
  }

  // Single method to get authenticated fetch headers
  async getAuthHeaders() {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('Failed to authenticate with ServiceTitan');
    }

    return {
      'Authorization': `Bearer ${token}`,
      'ST-App-Key': this.appKey,
      'Content-Type': 'application/json'
    };
  }

  // Centralized authentication with caching
  async getAccessToken() {
    // Return cached token if still valid
    if (this.tokenCache && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.tokenCache;
    }

    try {
      const fetch = (await import('node-fetch')).default;
      
      if (!this.clientId || !this.clientSecret || !this.tenantId) {
        throw new Error('Missing ServiceTitan credentials');
      }
      
      const tokenUrl = `${this.apiBaseUrl}/connect/token`;
      const formData = new FormData();
      formData.append('grant_type', 'client_credentials');
      formData.append('client_id', this.clientId);
      formData.append('client_secret', this.clientSecret);
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Auth failed: ${response.status} - ${errorText}`);
      }
      
      const tokenData = await response.json();
      
      // Cache token with 5 minute buffer before expiry
      this.tokenCache = tokenData.access_token;
      this.tokenExpiry = Date.now() + ((tokenData.expires_in - 300) * 1000);
      
      return this.tokenCache;
      
    } catch (error) {
      console.error('❌ ServiceTitan auth error:', error);
      throw error;
    }
  }

  // Centralized API call method
  async apiCall(endpoint, options = {}) {
    const fetch = (await import('node-fetch')).default;
    const headers = await this.getAuthHeaders();
    
    const url = `${this.apiBaseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // Raw fetch method for file downloads
  async rawFetch(endpoint, options = {}) {
    const fetch = (await import('node-fetch')).default;
    const headers = await this.getAuthHeaders();
    
    const url = `${this.apiBaseUrl}${endpoint}`;
    
    return fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    });
  }

  // Utility methods
  buildTenantUrl(service) {
    return `/${service}/v2/tenant/${this.tenantId}`;
  }

  normalizePhone(phone) {
    return phone ? phone.replace(/\D/g, '') : '';
  }

  validatePhoneMatch(techPhone, userPhone) {
    if (!techPhone || !userPhone) return false;
    
    const techNorm = this.normalizePhone(techPhone).slice(-10);
    const userNorm = this.normalizePhone(userPhone).slice(-10);
    
    return techNorm === userNorm;
  }

  // Date range helpers
  getDateRange(daysBack = 2) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    return { startDate, endDate };
  }

  // Clean HTML from job titles
  cleanJobTitle(title) {
    if (!title) return 'Service Call';
    
    let cleaned = title.replace(/<[^>]*>/g, ' ')
                      .replace(/&[^;]+;/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim();
    
    if (cleaned.length > 200) {
      cleaned = cleaned.substring(0, 200) + '...';
    }
    
    if (!cleaned || cleaned.length < 3) {
      cleaned = 'Service Call';
    }
    
    return cleaned;
  }
}

// Export singleton instance
module.exports = new ServiceTitanClient();