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
        if (session?.user?.accessToken) {
          fetchOptions.headers['Authorization'] = `Bearer ${session.user.accessToken}`;
        }
        if (session?.user?.company?.appKey) {
          fetchOptions.headers['ST-App-Key'] = session.user.company.appKey;
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

  // ================== SERVICETITAN PROXY METHODS ==================

  // Get projects for admin users
  async getProjects(filters = {}) {
    try {
      const session = sessionManager.getUserSession();
      
      // Correct path: session.user.company.tenantId
      const tenantId = session?.user?.company?.tenantId;
      
      if (!tenantId) {
        console.error('❌ No tenant ID found. Session user company:', session?.user?.company);
        throw new Error('No tenant ID found in session. Please log in again.');
      }

      const queryParams = new URLSearchParams({
        tenantId,
        pageSize: '50',
        active: 'true', // Only active projects
        ...filters
      });

      // Filter for current/upcoming projects only
      const today = new Date().toISOString().split('T')[0];
      if (!filters.startDateFrom) {
        queryParams.set('startDateFrom', today);
      }

      const response = await this.apiCall(`/api/servicetitan/projects?${queryParams.toString()}`);

      // Transform projects data for our UI
      return response.data?.map(project => ({
        id: project.id,
        name: project.name || `Project ${project.number}`,
        number: project.number,
        customer: project.customer?.name || 'Unknown Customer',
        location: project.location?.address || 'Unknown Location',
        status: project.status || 'Unknown',
        priority: project.priority || 'Normal',
        startDate: project.startDate,
        endDate: project.endDate,
        businessUnit: project.businessUnit?.name || 'General',
        totalJobs: project.jobCount || 0,
        summary: project.summary
      })) || [];

    } catch (error) {
      console.error('❌ Error fetching projects:', error);
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }
  }

  // Get jobs for a specific project (admin view)
  async getJobsForProject(projectId, filters = {}) {
    try {
      const session = sessionManager.getUserSession();
      const tenantId = session?.user?.company?.tenantId;
      
      if (!tenantId) {
        throw new Error('No tenant ID found in session');
      }

      const queryParams = new URLSearchParams({
        tenantId,
        pageSize: '100',
        projectId: projectId,
        // Only get active jobs, not completed
        ...filters
      });

      const response = await this.apiCall(`/api/servicetitan/jobs?${queryParams.toString()}`);
      return this.transformJobsData(response.data || []);

    } catch (error) {
      console.error('❌ Error fetching jobs for project:', error);
      throw new Error(`Failed to fetch jobs for project: ${error.message}`);
    }
  }

  // Get jobs for a specific technician (technician view)
  async getJobsForTechnician(technicianId, filters = {}) {
    try {
      const session = sessionManager.getUserSession();
      const tenantId = session?.user?.company?.tenantId;
      
      if (!tenantId) {
        throw new Error('No tenant ID found in session');
      }

      // Get jobs assigned to this technician
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const queryParams = new URLSearchParams({
        tenantId,
        pageSize: '50',
        technicianId: technicianId,
        startDateFrom: today,
        startDateTo: nextWeek, // Next 7 days
        ...filters
      });

      const response = await this.apiCall(`/api/servicetitan/jobs?${queryParams.toString()}`);
      return this.transformJobsData(response.data || []);

    } catch (error) {
      console.error('❌ Error fetching technician jobs:', error);
      throw new Error(`Failed to fetch technician jobs: ${error.message}`);
    }
  }

  // Get all active jobs (admin overview)
  async getAllActiveJobs(filters = {}) {
    try {
      const session = sessionManager.getUserSession();
      const tenantId = session?.user?.company?.tenantId;
      
      if (!tenantId) {
        throw new Error('No tenant ID found in session');
      }

      const today = new Date().toISOString().split('T')[0];
      const queryParams = new URLSearchParams({
        tenantId,
        pageSize: '100',
        startDateFrom: today,
        ...filters
      });

      const response = await this.apiCall(`/api/servicetitan/jobs?${queryParams.toString()}`);
      return this.transformJobsData(response.data || []);

    } catch (error) {
      console.error('❌ Error fetching all active jobs:', error);
      throw new Error(`Failed to fetch active jobs: ${error.message}`);
    }
  }

  // ================== HELPER METHODS ==================

  // Transform jobs data for consistent UI format
  transformJobsData(jobs) {
    return jobs.map(job => ({
      id: job.id,
      number: job.number,
      summary: job.summary || 'No description',
      customer: {
        id: job.customer?.id,
        name: job.customer?.name || 'Unknown Customer'
      },
      location: {
        id: job.location?.id,
        name: job.location?.name || job.location?.address || 'Unknown Location',
        address: job.location?.address
      },
      status: job.status || 'Unknown',
      priority: job.priority || 'Normal',
      jobType: job.jobType?.name || 'General',
      businessUnit: job.businessUnit?.name || 'General',
      scheduledDate: job.scheduledDate,
      startDate: job.startDate,
      endDate: job.endDate,
      assignedTechnicians: job.appointments?.[0]?.assignedTechnicians?.map(tech => ({
        id: tech.id,
        name: tech.name
      })) || [],
      project: job.project ? {
        id: job.project.id,
        name: job.project.name
      } : null,
      totalAmount: job.total || 0,
      hasEstimate: job.hasEstimate || false,
      hasInvoice: job.hasInvoice || false,
      tags: job.tags || [],
      createdOn: job.createdOn,
      modifiedOn: job.modifiedOn
    }));
  }

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

  isJobActive(status) {
    const activeStatuses = ['scheduled', 'in progress', 'on hold', 'dispatched'];
    return activeStatuses.includes(status?.toLowerCase());
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

  // Test ServiceTitan API connectivity
  async testServiceTitanConnection() {
    try {
      const session = sessionManager.getUserSession();
      const tenantId = session?.user?.company?.tenantId;
      
      if (!tenantId) {
        throw new Error('No tenant ID found in session');
      }

      const queryParams = new URLSearchParams({ tenantId });
      const response = await this.apiCall(`/api/servicetitan/test?${queryParams.toString()}`);
      
      return {
        connected: response.connected,
        message: response.message,
        tenantId: response.tenantId
      };

    } catch (error) {
      console.error('❌ ServiceTitan connection test failed:', error);
      return {
        connected: false,
        error: error.message
      };
    }
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