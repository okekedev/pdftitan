// src/services/apiClient.js - Enhanced API Client with Job Attachments

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

  // ================== AUTHENTICATION ==================

  async validateTechnician(username, phone) {
    return this.apiCall('/api/technician/validate', {
      method: 'POST',
      body: { username, phone }
    });
  }

  async getHealth() {
    return this.apiCall('/health');
  }

  // ================== JOBS ==================

  // ================== APPOINTMENTS (SIMPLIFIED) ==================

  // Get appointments for current technician 
  async getMyAppointments() {
    const session = sessionManager.getTechnicianSession();
    if (!session || !session.technician) {
      throw new Error('No technician session found');
    }

    try {
      console.log(`👷 Fetching appointments for technician ${session.technician.id}`);
      
      const endpoint = `/api/technician/${session.technician.id}/appointments`;
      const response = await this.apiCall(endpoint);
      
      console.log(`✅ Appointments fetched: ${response.data?.length || 0} appointments`);
      
      return response.data || [];

    } catch (error) {
      console.error('❌ Error fetching technician appointments:', error);
      throw new Error(`Failed to fetch appointments: ${error.message}`);
    }
  }

  // Filter appointments by date range (for frontend filtering)
  filterAppointmentsByDateRange(appointments, range = 'today-tomorrow') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    return appointments.filter(appointment => {
      if (!appointment.start) return false;
      
      const appointmentDate = new Date(appointment.start);
      const appointmentDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());
      
      switch (range) {
        case 'today':
          return appointmentDay.getTime() === today.getTime();
        case 'tomorrow':
          return appointmentDay.getTime() === tomorrow.getTime();
        case 'today-tomorrow':
          return appointmentDay.getTime() >= today.getTime() && appointmentDay.getTime() < dayAfterTomorrow.getTime();
        case 'this-week':
          const weekFromNow = new Date(today);
          weekFromNow.setDate(weekFromNow.getDate() + 7);
          return appointmentDay.getTime() >= today.getTime() && appointmentDay.getTime() < weekFromNow.getTime();
        case 'all':
          return true;
        default:
          return appointmentDay.getTime() >= today.getTime() && appointmentDay.getTime() < dayAfterTomorrow.getTime();
      }
    });
  }

  // Get available appointment statuses from data
  getAvailableStatuses(appointments) {
    const statusSet = new Set();
    appointments.forEach(appointment => {
      const status = appointment.status?.name || appointment.status;
      if (status) {
        statusSet.add(status);
      }
    });
    return Array.from(statusSet).sort();
  }

  // Legacy method - now calls appointments
  async getMyJobs() {
    return this.getMyAppointments();
  }

  // Get specific job details
  async getJobDetails(jobId) {
    try {
      console.log(`📋 Fetching job details for: ${jobId}`);
      
      const response = await this.apiCall(`/api/job/${jobId}`);
      
      console.log(`✅ Job details fetched: ${response.data?.number}`);
      
      return response.data;

    } catch (error) {
      console.error('❌ Error fetching job details:', error);
      throw new Error(`Failed to fetch job details: ${error.message}`);
    }
  }

  // ================== ATTACHMENTS (NEW) ==================

  // Get PDF attachments for a specific job
  async getJobAttachments(jobId) {
    try {
      console.log(`📎 Fetching PDF attachments for job: ${jobId}`);
      
      const response = await this.apiCall(`/api/job/${jobId}/attachments`);
      
      console.log(`✅ Attachments fetched: ${response.data?.length || 0} PDFs found`);
      
      return response.data || [];

    } catch (error) {
      console.error('❌ Error fetching job attachments:', error);
      
      // If no attachments found, return empty array instead of throwing
      if (error.message.includes('404') || error.message.includes('not found')) {
        console.log(`ℹ️ No attachments found for job ${jobId}`);
        return [];
      }
      
      throw new Error(`Failed to fetch job attachments: ${error.message}`);
    }
  }

  // Get combined appointment data (details + attachments via jobId)
  async getAppointmentWithAttachments(appointmentId, jobId) {
    try {
      console.log(`📋📎 Fetching complete appointment data for: ${appointmentId} (Job: ${jobId})`);
      
      // For appointments, we get attachments from the associated job
      const attachments = await this.getJobAttachments(jobId);
      
      const combinedData = {
        appointmentId: appointmentId,
        jobId: jobId,
        attachments: attachments,
        attachmentCount: attachments.length
      };
      
      console.log(`✅ Complete appointment data fetched: Appointment ${appointmentId} with ${combinedData.attachmentCount} PDFs`);
      
      return combinedData;

    } catch (error) {
      console.error('❌ Error fetching complete appointment data:', error);
      throw new Error(`Failed to fetch complete appointment data: ${error.message}`);
    }
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

  // Format file size for display
  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return 'Unknown size';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    if (i === 0) return `${bytes} ${sizes[i]}`;
    
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  // Format appointment date for display
  formatAppointmentDate(dateString) {
    if (!dateString) return 'Not scheduled';
    
    try {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const appointmentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      const diffDays = Math.ceil((appointmentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
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
        return `Yesterday`;
      } else if (diffDays < 7 && diffDays > 0) {
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          hour: '2-digit',
          minute: '2-digit'
        });
      } else {
        return date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (error) {
      console.error('Error formatting appointment date:', error);
      return 'Invalid date';
    }
  }

  // Get appointment status color for UI
  getAppointmentStatusColor(status) {
    switch (status?.toLowerCase()) {
      case 'scheduled':
        return '#3498db'; // Blue
      case 'dispatched':
        return '#f39c12'; // Orange
      case 'enroute':
        return '#9b59b6'; // Purple
      case 'working':
        return '#2ecc71'; // Green
      default:
        return '#7f8c8d'; // Gray
    }
  }

  // Get appointment status icon
  getAppointmentStatusIcon(status) {
    switch (status?.toLowerCase()) {
      case 'scheduled':
        return '📅'; // Calendar
      case 'dispatched':
        return '🚚'; // Truck
      case 'enroute':
        return '🚗'; // Car
      case 'working':
        return '🔧'; // Wrench
      default:
        return '📋'; // Clipboard
    }
  }

  // Format attachment creation date
  formatAttachmentDate(dateString) {
    if (!dateString) return 'Unknown date';
    
    try {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting attachment date:', error);
      return 'Invalid date';
    }
  }

  // Get attachment type color for UI
  getAttachmentTypeColor(type) {
    switch (type?.toLowerCase()) {
      case 'test report':
        return '#2ecc71'; // Green
      case 'safety form':
        return '#e74c3c'; // Red
      case 'certificate':
        return '#f39c12'; // Orange
      case 'maintenance':
        return '#3498db'; // Blue
      case 'form':
        return '#9b59b6'; // Purple
      default:
        return '#7f8c8d'; // Gray
    }
  }

  // Get status badge color
  getStatusColor(status) {
    switch (status?.toLowerCase()) {
      case 'required':
        return '#e74c3c'; // Red
      case 'optional':
        return '#f39c12'; // Orange
      case 'completed':
        return '#2ecc71'; // Green
      default:
        return '#7f8c8d'; // Gray
    }
  }

  // Check if file is a PDF
  isPdfFile(fileName) {
    if (!fileName) return false;
    return fileName.toLowerCase().endsWith('.pdf');
  }

  // Get attachment summary for job
  getAttachmentSummary(attachments) {
    if (!attachments || attachments.length === 0) {
      return {
        total: 0,
        required: 0,
        optional: 0,
        completed: 0,
        hasRequired: false
      };
    }

    const summary = {
      total: attachments.length,
      required: 0,
      optional: 0,
      completed: 0,
      hasRequired: false
    };

    attachments.forEach(attachment => {
      const status = attachment.status?.toLowerCase();
      if (status === 'required') {
        summary.required++;
        summary.hasRequired = true;
      } else if (status === 'optional') {
        summary.optional++;
      } else if (status === 'completed') {
        summary.completed++;
      }
    });

    return summary;
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
        message: health.message,
        targetStatuses: health.targetStatuses
      };
    } catch (error) {
      const errorInfo = this.handleApiError(error);
      return {
        connected: false,
        error: errorInfo
      };
    }
  }

  // ================== DEBUGGING HELPERS ==================

  // Debug: Test appointment fetching for a specific technician
  async debugTechnicianAppointments(technicianId) {
    try {
      console.log(`🔍 Debug: Testing appointment fetch for technician ${technicianId}`);
      
      const appointments = await this.apiCall(`/api/technician/${technicianId}/appointments`);
      
      console.log(`📊 Debug Results for Technician ${technicianId}:`);
      console.log(`   Total appointments: ${appointments.data?.length || 0}`);
      
      if (appointments.data && appointments.data.length > 0) {
        const statusCounts = {};
        appointments.data.forEach(appointment => {
          const status = appointment.status || 'Unknown';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        
        console.log(`📎 Appointment Status Breakdown:`);
        Object.entries(statusCounts).forEach(([status, count]) => {
          console.log(`   ${status}: ${count}`);
        });
        
        console.log(`📅 Appointment Details:`);
        appointments.data.slice(0, 5).forEach((appointment, index) => {
          console.log(`   ${index + 1}. ${appointment.appointmentNumber} (${appointment.status}) - Job ${appointment.jobId}`);
        });
      } else {
        console.log(`   No appointments found`);
      }
      
      return {
        success: true,
        technicianId,
        appointments: appointments.data || [],
        count: appointments.data?.length || 0
      };
      
    } catch (error) {
      console.error(`❌ Debug failed for technician ${technicianId}:`, error);
      return {
        success: false,
        technicianId,
        error: error.message
      };
    }
  }
}

// Export singleton
const apiClient = new ApiClient();
export default apiClient;