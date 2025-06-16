// src/services/apiClient.js - Optimized for Technician-Only Portal

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
        body = null
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

  // Get jobs for a specific technician with date filtering
  async getJobsForTechnician(technicianId, dateFilter = 'recent') {
    try {
      console.log(`👷 Fetching jobs for technician ${technicianId} (filter: ${dateFilter})...`);
      
      const response = await this.apiCall(`/api/technician/${technicianId}/jobs?dateFilter=${dateFilter}`);
      
      console.log(`✅ Jobs fetched: ${response.data?.length || 0} jobs`);
      return response.data || [];

    } catch (error) {
      console.error('❌ Error fetching technician jobs:', error);
      throw new Error(`Failed to fetch jobs: ${error.message}`);
    }
  }

  // Get current technician's jobs - optimized to work with simplified server response
  async getMyJobs(dateFilter = 'recent') {
    const session = sessionManager.getTechnicianSession();
    if (!session || !session.technician) {
      throw new Error('No technician session found');
    }

    return this.getJobsForTechnician(session.technician.id, dateFilter);
  }

  // ================== UTILITY METHODS ==================

  // Get current technician info
  getCurrentTechnician() {
    const session = sessionManager.getTechnicianSession();
    return session ? {
      id: session.technician?.id,
      name: session.technician?.name,
      email: session.technician?.email,
      phone: session.technician?.phoneNumber,
      loginName: session.technician?.loginName
    } : null;
  }

  // Job status helper methods - optimized for server's simplified response
  getJobStatusColor(status) {
    if (!status) return 'status-default';
    
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case 'scheduled': return 'status-scheduled';
      case 'in progress': 
      case 'dispatched': return 'status-progress';
      case 'on hold': return 'status-hold';
      case 'completed': return 'status-completed';
      case 'canceled': 
      case 'cancelled': return 'status-canceled';
      default: return 'status-default';
    }
  }

  getPriorityColor(priority) {
    if (!priority) return 'priority-default';
    
    const normalizedPriority = priority.toLowerCase();
    switch (normalizedPriority) {
      case 'high': 
      case 'urgent': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return 'priority-default';
    }
  }

  // Optimized for server's simplified date format
  formatJobDate(dateString) {
    if (!dateString) return 'Not scheduled';
    
    try {
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const jobDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      // Calculate difference in days
      const diffTime = jobDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return `Today, ${date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        })}`;
      } else if (diffDays === 1) {
        return `Tomorrow, ${date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        })}`;
      } else if (diffDays === -1) {
        return `Yesterday, ${date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        })}`;
      } else if (diffDays > 1 && diffDays <= 7) {
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } else {
        return date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  }

  // Optimized for server's simplified job structure
  getJobUrgency(job) {
    if (!job) return 'normal';
    
    // Check priority first
    const priority = (job.priority || '').toLowerCase();
    if (priority === 'urgent' || priority === 'high') {
      return 'urgent';
    }
    
    // Check status
    const status = (job.status || '').toLowerCase();
    if (status === 'on hold') {
      return 'hold';
    }
    
    // Check if scheduled for today or overdue
    if (job.scheduledDate || job.createdOn) {
      try {
        const scheduledDate = new Date(job.scheduledDate || job.createdOn);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        
        if (scheduledDate <= tomorrow) {
          return 'today';
        }
      } catch (error) {
        console.warn('Error parsing scheduled date:', error);
      }
    }
    
    return 'normal';
  }

  // Get job urgency icon based on simplified server data
  getJobUrgencyIcon(job) {
    const urgency = this.getJobUrgency(job);
    switch (urgency) {
      case 'urgent': return '🚨';
      case 'today': return '⏰';
      case 'hold': return '⏸️';
      default: return '📋';
    }
  }

  // Debug method to check job status variety
  async getJobStatuses() {
    try {
      const response = await this.apiCall('/debug/job-statuses');
      return response;
    } catch (error) {
      console.error('❌ Error fetching job statuses:', error);
      throw new Error(`Failed to fetch job statuses: ${error.message}`);
    }
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

    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
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
        userMessage: 'Your credentials are invalid. Please log in again.'
      };
    }

    if (error.message.includes('403')) {
      return {
        type: 'PERMISSION',
        message: 'Permission denied',
        userMessage: 'You do not have permission to perform this action.'
      };
    }

    if (error.message.includes('404')) {
      return {
        type: 'NOT_FOUND',
        message: 'Resource not found',
        userMessage: 'The requested resource was not found.'
      };
    }

    if (error.message.includes('500')) {
      return {
        type: 'SERVER_ERROR',
        message: 'Server error',
        userMessage: 'Server error occurred. Please try again later.'
      };
    }

    return {
      type: 'UNKNOWN',
      message: error.message,
      userMessage: error.message || 'An unexpected error occurred. Please try again.'
    };
  }

  // Connection test
  async testConnection() {
    try {
      const health = await this.getHealth();
      return {
        connected: true,
        serverStatus: health.status,
        environment: health.environment,
        message: health.message
      };
    } catch (error) {
      const errorInfo = this.handleApiError(error);
      return {
        connected: false,
        error: errorInfo
      };
    }
  }
}

// Export singleton
const apiClient = new ApiClient();
export default apiClient;