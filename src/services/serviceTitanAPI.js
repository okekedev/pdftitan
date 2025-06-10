import { serviceTitanConfig } from '../config/serviceTitanConfig';

// ServiceTitan API Service
class ServiceTitanAPI {
  constructor() {
    this.config = serviceTitanConfig;
    this.accessToken = null;
    this.tokenExpiry = null;
    
    // Validate configuration on initialization
    if (!this.config.isConfigured()) {
      const missing = this.config.getMissingConfig();
      console.error('❌ ServiceTitan configuration missing:', missing);
      throw new Error(`Missing ServiceTitan configuration: ${missing.join(', ')}`);
    }
    
    console.log('✅ ServiceTitan API initialized for', 
      this.config.isIntegrationEnvironment ? 'Integration Environment' : 'Production Environment'
    );
  }

  // Get OAuth 2.0 access token
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await fetch(this.config.authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + ((data.expires_in - 300) * 1000);
      
      console.log('✅ ServiceTitan Integration Environment authentication successful');
      return this.accessToken;
    } catch (error) {
      console.error('❌ ServiceTitan authentication failed:', error);
      throw error;
    }
  }

  // Generic API call method
  async apiCall(endpoint, method = 'GET', body = null) {
    const token = await this.getAccessToken();
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'ST-App-Key': this.config.appKey,
      'Content-Type': 'application/json',
    };

    const config = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${this.config.apiBaseUrl}${endpoint}`, config);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ API call to ${endpoint} failed:`, error);
      throw error;
    }
  }

  // Get all projects
  async getProjects() {
    try {
      console.log('📁 Fetching projects...');
      const response = await this.apiCall(`/v2/tenant/${this.config.tenantId}/job-planning/projects`);
      console.log('✅ Projects fetched:', response.data?.length || 0);
      return response.data || [];
    } catch (error) {
      console.error('❌ Failed to fetch projects:', error);
      return [];
    }
  }

  // Get jobs for a specific project
  async getJobsByProject(projectId) {
    try {
      console.log(`📋 Fetching jobs for project ${projectId}...`);
      const response = await this.apiCall(
        `/v2/tenant/${this.config.tenantId}/job-planning/jobs?projectId=${projectId}`
      );
      console.log('✅ Jobs fetched:', response.data?.length || 0);
      return response.data || [];
    } catch (error) {
      console.error('❌ Failed to fetch jobs:', error);
      return [];
    }
  }

  // Get all technicians
  async getTechnicians() {
    try {
      console.log('👨‍🔧 Fetching technicians...');
      const response = await this.apiCall(`/v2/tenant/${this.config.tenantId}/settings/technicians`);
      console.log('✅ Technicians fetched:', response.data?.length || 0);
      return response.data || [];
    } catch (error) {
      console.error('❌ Failed to fetch technicians:', error);
      return [];
    }
  }

  // Get job forms for a specific job
  async getJobForms(jobId) {
    try {
      console.log(`📄 Fetching forms for job ${jobId}...`);
      const response = await this.apiCall(
        `/v2/tenant/${this.config.tenantId}/forms/job-forms?jobId=${jobId}`
      );
      console.log('✅ Job forms fetched:', response.data?.length || 0);
      return response.data || [];
    } catch (error) {
      console.error('❌ Failed to fetch job forms:', error);
      return [];
    }
  }

  // Get customer information
  async getCustomer(customerId) {
    try {
      console.log(`👤 Fetching customer ${customerId}...`);
      const response = await this.apiCall(`/v2/tenant/${this.config.tenantId}/crm/customers/${customerId}`);
      console.log('✅ Customer fetched');
      return response;
    } catch (error) {
      console.error('❌ Failed to fetch customer:', error);
      return null;
    }
  }

  // Test API connection
  async testConnection() {
    try {
      console.log('🔍 Testing ServiceTitan Integration Environment connection...');
      const token = await this.getAccessToken();
      console.log('✅ Connection test successful');
      return { success: true, token: token.substring(0, 20) + '...' };
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create and export a singleton instance
const serviceTitanAPI = new ServiceTitanAPI();
export default serviceTitanAPI;