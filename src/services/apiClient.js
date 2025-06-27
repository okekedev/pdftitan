// src/services/apiClient.js - Updated with PDF Binary Handling and ServiceTitan Upload
import sessionManager from './sessionManager';

class ApiClient {
  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3004'
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

  // ================== JOBS ==================

  async getMyJobs() {
    const session = sessionManager.getTechnicianSession();
    if (!session?.technician?.id) {
      throw new Error('No technician session found');
    }

    try {
      console.log(`👷 Fetching jobs for technician ${session.technician.id}`);
      
      const response = await this.apiCall(`/api/technician/${session.technician.id}/jobs`);
      
      console.log(`✅ Jobs fetched: ${response.data?.length || 0} jobs`);
      
      return response;

    } catch (error) {
      console.error('❌ Error fetching jobs:', error);
      throw new Error(`Failed to fetch jobs: ${error.message}`);
    }
  }

  // Keep old method name for backward compatibility
  async getMyAppointments() {
    console.log('⚠️ getMyAppointments() is deprecated, use getMyJobs() instead');
    return this.getMyJobs();
  }

  // ================== JOB DETAILS ==================

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

  // ================== CUSTOMER DETAILS ==================

  async getCustomerDetails(customerId) {
    try {
      console.log(`👤 Fetching customer details for: ${customerId}`);
      
      const response = await this.apiCall(`/api/customer/${customerId}`);
      
      console.log(`✅ Customer details fetched: ${response.data?.name}`);
      
      return response.data;

    } catch (error) {
      console.error('❌ Error fetching customer details:', error);
      throw new Error(`Failed to fetch customer details: ${error.message}`);
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

  // ✅ UPDATED: Save completed PDF form with in-app notification (no download)
  async saveCompletedPDFForm(jobId, attachmentId, formData) {
    try {
      console.log(`💾 Saving completed PDF form: ${attachmentId} for job: ${jobId}`);
      
      const url = `${this.baseUrl}/api/job/${jobId}/attachment/${attachmentId}/save`;
      
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json', // ✅ CHANGED: Expect JSON response now
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      };

      console.log(`📡 API Call: POST ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      fetchOptions.signal = controller.signal;

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // ✅ CHANGED: Always expect JSON response (no more PDF downloads)
      const result = await response.json();
      console.log(`✅ PDF form processing result:`, result);
      
      return result;
      
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after 60 seconds`);
      }
      console.error('❌ Error saving PDF form:', error);
      throw new Error(`Failed to save PDF form: ${error.message}`);
    }
  }

  // ✅ HELPER: Extract filename from response headers
  getFileNameFromResponse(response) {
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
      if (matches != null && matches[1]) {
        let filename = matches[1].replace(/['"]/g, '');
        // ✅ FIXED: Don't add .pdf if filename already ends with .pdf
        return filename.endsWith('.pdf') ? filename : filename + '.pdf';
      }
    }
    return 'Completed_Form.pdf'; // ✅ Default filename with proper extension
  }

  // ✅ HELPER: Download blob as file
  downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  // 📄 NEW: Get saved forms for a job
  async getSavedForms(jobId) {
    try {
      console.log(`📄 Fetching saved forms for job: ${jobId}`);
      
      const response = await this.apiCall(`/api/job/${jobId}/saved-forms`);
      
      console.log(`✅ Saved forms fetched: ${response.data?.length || 0} forms found`);
      
      return response.data || [];

    } catch (error) {
      console.error('❌ Error fetching saved forms:', error);
      
      if (error.message.includes('404')) {
        console.log(`ℹ️ No saved forms found for job ${jobId}`);
        return [];
      }
      
      throw new Error(`Failed to fetch saved forms: ${error.message}`);
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
        message: response.message,
        uploadCapable: true
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        uploadCapable: false
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
    
    // Enhanced error categorization
    let category = 'unknown';
    if (error.message?.includes('network') || error.message?.includes('connection')) {
      category = 'network';
    } else if (error.message?.includes('timeout')) {
      category = 'timeout';
    } else if (error.message?.includes('401') || error.message?.includes('403')) {
      category = 'permission';
    } else if (error.message?.includes('404')) {
      category = 'not_found';
    } else if (error.message?.includes('500')) {
      category = 'server_error';
    }
    
    return {
      userMessage,
      category,
      originalError: error,
      timestamp: new Date().toISOString(),
      suggestions: this.getErrorSuggestions(category)
    };
  }

  // Get helpful suggestions based on error category
  getErrorSuggestions(category) {
    switch (category) {
      case 'network':
        return [
          'Check your internet connection',
          'Make sure the server is running',
          'Try refreshing the page'
        ];
      case 'timeout':
        return [
          'The request took too long - try again',
          'Check your internet connection speed',
          'Try uploading a smaller file'
        ];
      case 'permission':
        return [
          'Check your ServiceTitan access permissions',
          'Make sure you are logged in',
          'Contact your administrator if needed'
        ];
      case 'not_found':
        return [
          'The requested item may have been deleted',
          'Check that the job or attachment exists',
          'Try refreshing the page'
        ];
      case 'server_error':
        return [
          'ServiceTitan server is experiencing issues',
          'Please try again in a few minutes',
          'Contact support if the problem persists'
        ];
      default:
        return [
          'Please try again',
          'Check your connection',
          'Contact support if needed'
        ];
    }
  }

  // 🔍 NEW: Enhanced debugging for uploads
  async debugUploadCapabilities() {
    try {
      const health = await this.getHealth();
      const session = sessionManager.getTechnicianSession();
      
      const debugInfo = {
        serverHealth: health.status === 'healthy',
        serviceTitanConfigured: health.serviceIntegration?.configured || false,
        userLoggedIn: !!session?.technician?.id,
        environment: health.serviceIntegration?.environment || 'unknown',
        uploadEndpointsAvailable: true, // Based on our implementation
        timestamp: new Date().toISOString()
      };
      
      console.log('🔍 Upload capabilities debug:', debugInfo);
      return debugInfo;
      
    } catch (error) {
      console.error('❌ Error checking upload capabilities:', error);
      return {
        serverHealth: false,
        serviceTitanConfigured: false,
        userLoggedIn: false,
        environment: 'unknown',
        uploadEndpointsAvailable: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
const apiClient = new ApiClient();

// Add development helpers
if (process.env.NODE_ENV === 'development') {
  window.apiClient = apiClient;
  
  // Log capabilities on load
  apiClient.debugUploadCapabilities().then(capabilities => {
    if (capabilities.serverHealth && capabilities.serviceTitanConfigured) {
      console.log('🚀 TitanPDF API Client Ready - ServiceTitan Upload Enabled');
    } else {
      console.warn('⚠️ TitanPDF API Client - Limited functionality');
    }
  });
}

export default apiClient;