import serviceTitanAuth from './serviceTitanAuth';
import { serviceTitanConfig } from '../config/serviceTitanConfig';

// ServiceTitan API Service Layer
// This will handle all API calls after authentication is working
class ServiceTitanAPI {
  constructor() {
    this.auth = serviceTitanAuth;
    this.config = serviceTitanConfig;
  }

  // Generic API call method
  async apiCall(endpoint, method = 'GET', body = null) {
    try {
      // Ensure we have a valid token
      await this.auth.getValidAccessToken();
      
      const headers = this.auth.getAuthHeaders();
      
      const config = {
        method,
        headers,
      };

      if (body && method !== 'GET') {
        config.body = JSON.stringify(body);
      }

      const fullUrl = `${this.config.apiBaseUrl}${endpoint}`;
      console.log(`📡 Making ${method} request to:`, fullUrl);

      const response = await fetch(fullUrl, config);
      
      console.log(`📡 API response status for ${endpoint}:`, response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API error response:`, errorText);
        throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const responseData = await response.json();
      console.log(`✅ API call successful for ${endpoint}`);
      return responseData;
    } catch (error) {
      console.error(`❌ API call to ${endpoint} failed:`, error);
      throw error;
    }
  }

  // TODO: Add specific API methods here once authentication is working
  // async getProjects() { ... }
  // async getJobs(projectId) { ... }
  // async getTechnicians() { ... }
  // async getJobForms(jobId) { ... }
  // async getCustomer(customerId) { ... }
}

// Create and export singleton instance
const serviceTitanAPI = new ServiceTitanAPI();
export default serviceTitanAPI;