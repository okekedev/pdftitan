// src/services/apiClient.js - Client-side API service
// This ONLY talks to YOUR server, never directly to ServiceTitan

import { serviceTitanConfig } from '../config/serviceTitanConfig';
import sessionManager from './sessionManger'; // Fix typo when you rename file

class ApiClient {
  constructor() {
    this.config = serviceTitanConfig;
    this.baseUrl = 'http://localhost:3005'; // Your server
  }

  // Generic API call to YOUR server
  async apiCall(endpoint, options = {}) {
    try {
      const {
        method = 'GET',
        body = null,
        requiresAuth = true,
        timeout = 30000
      } = options;

      const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
      
      const fetchOptions = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include' // For CORS
      };

      // Add auth headers if required and available
      if (requiresAuth) {
        const session = sessionManager.getUserSession();
        if (session?.accessToken) {
          fetchOptions.headers['Authorization'] = `Bearer ${session.accessToken}`;
        }
      }

      // Add body for non-GET requests
      if (body && method !== 'GET') {
        fetchOptions.body = JSON.stringify(body);
      }

      console.log(`📡 API Call: ${method} ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);
      fetchOptions.signal = controller.signal;

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`✅ API Success: ${method} ${url}`);
      return responseData;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${options.timeout || 30000}ms`);
      }
      console.error(`❌ API Error: ${endpoint}`, error);
      throw error;
    }
  }

  // Authentication methods (call YOUR server)
  async validateUser(name, phone) {
    return this.apiCall('/api/user/validate', {
      method: 'POST',
      body: { name, phone },
      requiresAuth: false
    });
  }

  async validateAdminAccess(adminPassword, userRole) {
    return this.apiCall('/api/admin/validate-super-access', {
      method: 'POST',
      body: { adminPassword, userRole }
    });
  }

  // Health check
  async getHealth() {
    return this.apiCall('/health', {
      requiresAuth: false
    });
  }

  // Error handling helper
  handleApiError(error) {
    console.error('API Error:', error);

    // Handle specific error types
    if (error.message.includes('timeout')) {
      return {
        type: 'TIMEOUT',
        message: 'Request timed out. Please try again.',
        userMessage: 'Connection timeout - please check your internet and try again.'
      };
    }

    if (error.message.includes('Failed to fetch')) {
      return {
        type: 'NETWORK',
        message: 'Network error - server may be down',
        userMessage: 'Cannot connect to server. Please check if the server is running.'
      };
    }

    if (error.message.includes('401')) {
      return {
        type: 'AUTH',
        message: 'Authentication failed',
        userMessage: 'Your session has expired. Please log in again.'
      };
    }

    if (error.message.includes('403')) {
      return {
        type: 'PERMISSION',
        message: 'Permission denied',
        userMessage: 'You do not have permission to perform this action.'
      };
    }

    return {
      type: 'UNKNOWN',
      message: error.message,
      userMessage: 'An unexpected error occurred. Please try again.'
    };
  }

  // Connection test
  async testConnection() {
    try {
      const health = await this.getHealth();
      return {
        connected: true,
        serverStatus: health.status,
        environment: health.environment
      };
    } catch (error) {
      return {
        connected: false,
        error: this.handleApiError(error)
      };
    }
  }
}

// Export singleton
const apiClient = new ApiClient();
export default apiClient;