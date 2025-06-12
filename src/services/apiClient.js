// src/services/apiClient.js - Simplified for Technician-Only Portal

import { serviceTitanConfig } from '../config/serviceTitanConfig';
import sessionManager from './sessionManger';

class ApiClient {
  constructor() {
    this.config = serviceTitanConfig;
    this.baseUrl = 'http://localhost:3005';
  }

  // Generic API call to server
  async apiCall(endpoint, options = {}) {
    try {
      const {
        method = 'GET',
        body = null,
        timeout = 30000
      } = options;

      const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
      
      const fetchOptions = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include'
      };

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

  // ================== TECHNICIAN AUTHENTICATION ==================

  async validateTechnician(username, phone) {
    return this.apiCall('/api/technician/validate', {
      method: 'POST',
      body: { username, phone }
    });
  }

  // Health check
  async getHealth() {
    return this.apiCall('/health');
  }

  // ================== TECHNICIAN JOBS ==================

  // Get jobs for the current technician
  async getJobsForTechnician(technicianId) {
    try {
      console.log(`👷 Fetching jobs for technician ${technicianId}...`);
      
      const response = await this.apiCall(`/api/technician/${technicianId}/jobs`);
      
      console.log(`✅ Jobs fetched: ${response.data?.length || 0} jobs`);
      return response.data || [];

    } catch (error) {
      console.error('❌ Error fetching technician jobs:', error);
      throw new Error(`Failed to fetch jobs: ${error.message}`);
    }
  }

  // Get current technician's jobs
  async getMyJobs() {
    const session = sessionManager.getTechnicianSession();
    if (!session || !session.technician) {
      throw new Error('No technician session found');
    }

    return this.getJobsForTechnician(session.technician.id);
  }

  // ================== UTILITY METHODS ==================

  // Get current technician info
  getCurrentTechnician() {
    const session = sessionManager.getTechnicianSession();
    return session ? {
      id: session.technician?.id,
      name: session.technician?.name,
      email: session.technician?.email,
      phone: session.technician?.phoneNumber
    } : null;
  }

  // Job status helper methods
  getJobStatusColor(status) {
    switch (status?.toLowerCase()) {
      case 'scheduled': return 'status-scheduled';
      case 'in progress': 
      case 'dispatched': return 'status-progress';
      case 'on hold': return 'status-hold';
      case 'completed': return 'status-completed';
      case 'canceled': return 'status-canceled';
      default: return 'status-default';
    }
  }

  getPriorityColor(priority) {
    switch (priority?.toLowerCase()) {
      case 'high': 
      case 'urgent': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return 'priority-default';
    }
  }

  formatJobDate(dateString) {
    if (!dateString) return 'Not scheduled';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getJobUrgency(job) {
    if (job.priority?.toLowerCase() === 'urgent' || job.priority?.toLowerCase() === 'high') {
      return 'urgent';
    }
    
    if (job.status?.toLowerCase() === 'on hold') {
      return 'hold';
    }
    
    const scheduledDate = new Date(job.scheduledDate);
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    
    if (scheduledDate <= tomorrow) {
      return 'today';
    }
    
    return 'normal';
  }

  // ================== ERROR HANDLING ==================

  handleApiError(error) {
    console.error('API Error:', error);

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