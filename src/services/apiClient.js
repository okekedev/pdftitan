// src/services/apiClient.js - Updated for clean server-side calls
// No more ServiceTitan credentials needed on frontend!

import { serviceTitanConfig } from '../config/serviceTitanConfig';
import sessionManager from './sessionManger';

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

  // ================== AUTHENTICATION METHODS ==================

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

  // ================== CLEAN SERVICETITAN METHODS ==================
  // All ServiceTitan calls now go through our server - no credentials needed!

  // ✅ CLEAN: Get projects (server handles everything)
  async getProjects(filters = {}) {
    try {
      console.log('📋 Fetching projects via server...');
      
      const response = await this.apiCall('/api/projects');
      
      console.log(`✅ Projects fetched: ${response.data?.length || 0} projects`);
      return response.data || [];

    } catch (error) {
      console.error('❌ Error fetching projects:', error);
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }
  }

  // ✅ CLEAN: Get jobs for a specific project (server handles everything)
  async getJobsForProject(projectId, filters = {}) {
    try {
      console.log(`👷 Fetching jobs for project ${projectId} via server...`);
      
      const response = await this.apiCall(`/api/jobs?projectId=${projectId}`);
      
      console.log(`✅ Jobs fetched: ${response.data?.length || 0} jobs`);
      return response.data || [];

    } catch (error) {
      console.error('❌ Error fetching jobs for project:', error);
      throw new Error(`Failed to fetch jobs for project: ${error.message}`);
    }
  }

  // ✅ CLEAN: Get jobs for a specific technician (server handles everything)
  async getJobsForTechnician(technicianId, filters = {}) {
    try {
      console.log(`👷 Fetching jobs for technician ${technicianId} via server...`);
      
      const response = await this.apiCall(`/api/jobs?technicianId=${technicianId}`);
      
      console.log(`✅ Jobs fetched: ${response.data?.length || 0} jobs`);
      return response.data || [];

    } catch (error) {
      console.error('❌ Error fetching technician jobs:', error);
      throw new Error(`Failed to fetch technician jobs: ${error.message}`);
    }
  }

  // ✅ CLEAN: Get all active jobs (server handles everything)
  async getAllActiveJobs(filters = {}) {
    try {
      console.log('👷 Fetching all active jobs via server...');
      
      const response = await this.apiCall('/api/jobs');
      
      console.log(`✅ Jobs fetched: ${response.data?.length || 0} jobs`);
      return response.data || [];

    } catch (error) {
      console.error('❌ Error fetching all active jobs:', error);
      throw new Error(`Failed to fetch active jobs: ${error.message}`);
    }
  }

  // ================== HELPER METHODS ==================

  // Get current user info for job filtering
  getCurrentUserInfo() {
    const session = sessionManager.getUserSession();
    const access = sessionManager.getAccess();
    
    return {
      isAdmin: access?.isAdmin || false,
      isTechnician: access?.isTechnician || false,
      userId: session?.user?.userId,
      employeeId: session?.user?.id,
      name: session?.user?.name
    };
  }

  // Get jobs based on current user's role
  async getJobsForCurrentUser(filters = {}) {
    const userInfo = this.getCurrentUserInfo();
    
    if (userInfo.isAdmin) {
      // Admins see all active jobs
      return await this.getAllActiveJobs(filters);
    } else if (userInfo.isTechnician) {
      // Technicians see only their assigned jobs
      return await this.getJobsForTechnician(userInfo.employeeId, filters);
    } else {
      throw new Error('User does not have permission to view jobs');
    }
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

  // ✅ UPDATED: Server now filters out completed jobs, so all returned jobs are active
  isJobActive(status) {
    // Since server filters out completed jobs, all jobs returned are considered active
    return true;
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