// src/services/apiClient.js - Consolidated API Client
import sessionManager from './sessionManager';

class ApiClient {
  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3004'  // ← Changed from 3005 to 3004
      : '';
  }

  // ================== CORE API METHOD ==================

  async apiCall(endpoint, options = {}) {
    try {
      const {
        method = 'GET',
        body = null,
        timeout = 30000
      } = options;

      const url = `${this.baseUrl}${endpoint}`;
      
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
      const timeoutId = setTimeout(() => controller.abort(), timeout);
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

  // ================== APPOINTMENTS ==================

  async getMyAppointments() {
    const session = sessionManager.getTechnicianSession();
    if (!session?.technician?.id) {
      throw new Error('No technician session found');
    }

    try {
      console.log(`👷 Fetching appointments for technician ${session.technician.id}`);
      
      const response = await this.apiCall(`/api/technician/${session.technician.id}/appointments`);
      
      console.log(`✅ Appointments fetched: ${response.data?.length || 0} appointments`);
      
      return response; // Returns { data: [...], groupedByDate: {...}, count: N }

    } catch (error) {
      console.error('❌ Error fetching appointments:', error);
      throw new Error(`Failed to fetch appointments: ${error.message}`);
    }
  }

  // ================== JOBS ==================

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

  // ================== ATTACHMENTS ==================

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

  // Get download URL for attachment
  getAttachmentDownloadUrl(jobId, attachmentId) {
    return `${this.baseUrl}/api/job/${jobId}/attachment/${attachmentId}/download`;
  }

  // Save completed PDF form
  async saveCompletedPDFForm(jobId, attachmentId, formData) {
    try {
      console.log(`💾 Saving completed PDF form: ${attachmentId} for job: ${jobId}`);
      
      const response = await this.apiCall(`/api/job/${jobId}/attachment/${attachmentId}/save`, {
        method: 'POST',
        body: formData,
        timeout: 60000 // Longer timeout for file uploads
      });
      
      console.log(`✅ PDF form saved successfully`);
      
      return response;
      
    } catch (error) {
      console.error('❌ Error saving PDF form:', error);
      throw new Error(`Failed to save PDF form: ${error.message}`);
    }
  }

  // ================== UTILITIES ==================

  // Test connection to backend
  async testConnection() {
    try {
      const response = await this.getHealth();
      return {
        connected: true,
        serverStatus: response.status,
        message: response.message
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }

  // Format API errors for user display
  formatError(error) {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.error) return error.error;
    return 'An unexpected error occurred';
  }

  // Handle API errors with user-friendly messages
  handleApiError(error) {
    const userMessage = this.formatError(error);
    
    return {
      userMessage,
      originalError: error,
      timestamp: new Date().toISOString()
    };
  }

}

// Export singleton instance
const apiClient = new ApiClient();
export default apiClient;