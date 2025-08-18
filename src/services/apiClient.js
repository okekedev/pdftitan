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
      console.log(`📎 Fetching attachments for job: ${jobId}`);
      
      const response = await this.apiCall(`/api/job/${jobId}/attachments`);
      
      console.log(`✅ Attachments fetched: ${response.data?.length || 0} attachments`);
      
      return response.data || [];

    } catch (error) {
      console.error('❌ Error fetching attachments:', error);
      throw new Error(`Failed to fetch attachments: ${error.message}`);
    }
  }

  // ================== PDF PROCESSING ==================

  async downloadPDF(jobId, attachmentId) {
    try {
      console.log(`📄 Downloading PDF: Job ${jobId}, Attachment ${attachmentId}`);
      
      const url = `${this.baseUrl}/api/job/${jobId}/attachment/${attachmentId}/download`;
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.statusText}`);
      }

      console.log(`✅ PDF downloaded successfully`);
      
      return await response.arrayBuffer();

    } catch (error) {
      console.error('❌ Error downloading PDF:', error);
      throw new Error(`Failed to download PDF: ${error.message}`);
    }
  }

  async savePDFForm(formData) {
    try {
      console.log('💾 Saving PDF form with data:', formData);
      
      const url = `${this.baseUrl}/api/form/save`;
      
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
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

  // ================== GOOGLE DRIVE INTEGRATION ==================

  // 📄 Get saved forms for a job
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

  // 💾 Save PDF as draft to Google Drive
  async savePDFAsDraft(pdfData) {
    try {
      console.log('💾 Saving PDF as draft to Google Drive:', pdfData);
      
      const response = await this.apiCall('/api/drafts/save', {
        method: 'POST',
        body: pdfData
      });
      
      console.log('✅ PDF saved as draft:', response);
      
      return response;
      
    } catch (error) {
      console.error('❌ Error saving PDF as draft:', error);
      throw new Error(`Failed to save PDF as draft: ${error.message}`);
    }
  }

  // 🔍 Get drafts and completed files for a job
  async getJobDrafts(jobId) {
    try {
      console.log(`🔍 Fetching drafts for job: ${jobId}`);
      
      const response = await this.apiCall(`/api/drafts/${jobId}`);
      
      console.log(`✅ Drafts fetched: ${response.drafts?.length || 0} drafts, ${response.completed?.length || 0} completed`);
      
      return response;
      
    } catch (error) {
      console.error('❌ Error fetching job drafts:', error);
      throw new Error(`Failed to fetch job drafts: ${error.message}`);
    }
  }

  // 📤 Promote draft to completed
  async promoteToCompleted(fileId, jobId) {
    try {
      console.log(`📤 Promoting draft to completed: ${fileId}`);
      
      const response = await this.apiCall(`/api/drafts/${fileId}/complete`, {
        method: 'POST',
        body: { jobId }
      });
      
      console.log('✅ Draft promoted to completed:', response);
      
      return response;
      
    } catch (error) {
      console.error('❌ Error promoting draft:', error);
      throw new Error(`Failed to promote draft: ${error.message}`);
    }
  }

  // 📥 NEW: Download PDF from Google Drive
  async downloadFromGoogleDrive(fileId, fileName) {
    try {
      console.log(`📥 Downloading from Google Drive: ${fileId}`);
      
      const url = `${this.baseUrl}/api/google-drive/download/${fileId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to download from Google Drive: ${response.statusText}`);
      }

      console.log(`✅ Google Drive file downloaded successfully`);
      
      return await response.arrayBuffer();

    } catch (error) {
      console.error('❌ Error downloading from Google Drive:', error);
      throw new Error(`Failed to download from Google Drive: ${error.message}`);
    }
  }

  // 📥 NEW: Load PDF from Google Drive for editing
  async loadPDFFromGoogleDrive(googleDriveFileId) {
    try {
      console.log(`📥 Loading PDF from Google Drive for editing: ${googleDriveFileId}`);
      
      const url = `${this.baseUrl}/api/google-drive/load/${googleDriveFileId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load PDF from Google Drive: ${response.statusText}`);
      }

      console.log(`✅ PDF loaded from Google Drive successfully`);
      
      return await response.arrayBuffer();

    } catch (error) {
      console.error('❌ Error loading PDF from Google Drive:', error);
      throw new Error(`Failed to load PDF from Google Drive: ${error.message}`);
    }
  }

  // 🔗 NEW: Get Google Drive file info
  async getGoogleDriveFileInfo(fileId) {
    try {
      console.log(`🔗 Getting Google Drive file info: ${fileId}`);
      
      const response = await this.apiCall(`/api/google-drive/info/${fileId}`);
      
      console.log('✅ Google Drive file info retrieved:', response);
      
      return response;
      
    } catch (error) {
      console.error('❌ Error getting Google Drive file info:', error);
      throw new Error(`Failed to get Google Drive file info: ${error.message}`);
    }
  }

  // ================== UTILITIES ==================

  // Test connection to backend
  async testConnection() {
    try {
      const response = await this.getHealth();
      return response?.status === 'OK';
    } catch {
      return false;
    }
  }

  // Log out (clear session)
  logout() {
    sessionManager.clearSession();
  }
}

// Export singleton instance
const apiClient = new ApiClient();
export default apiClient;