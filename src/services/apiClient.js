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

  // 🔍 [DEBUG] Save PDF directly to ServiceTitan with coordinate conversion
  async saveDirectToServiceTitan(pdfData) {
    try {
      console.log('🔍 [DEBUG] Saving PDF directly to ServiceTitan with coordinate conversion');
      console.log('🔍 [DEBUG] Data:', pdfData);

      const { jobId, attachmentId, objects, fileName } = pdfData;

      const response = await this.apiCall(`/api/job/${jobId}/attachment/${attachmentId}/save`, {
        method: 'POST',
        body: {
          editableElements: objects,
          originalFileName: fileName,
          jobInfo: { id: jobId },
          metadata: { testMode: true }
        }
      });

      console.log('✅ PDF saved directly to ServiceTitan:', response);
      return response;

    } catch (error) {
      console.error('❌ Error saving PDF to ServiceTitan:', error);
      throw error;
    }
  }

  // 🔄 Update existing draft
  async updateDraft(fileId, jobId, objects, fileName) {
    try {
      console.log(`🔄 Updating existing draft: ${fileId}`);

      const response = await this.apiCall(`/api/drafts/update/${fileId}`, {
        method: 'PUT',
        body: {
          jobId,
          objects,
          fileName
        }
      });
      
      console.log('✅ Draft updated:', response);
      return response;
      
    } catch (error) {
      console.error('❌ Error updating draft:', error);
      throw new Error(`Failed to update draft: ${error.message}`);
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

  // ================== BACKFLOW TESTING ==================

  // Get all backflow devices for a job
  async getJobBackflowDevices(jobId) {
    try {
      console.log(`🔧 Fetching backflow devices for job: ${jobId}`);

      const response = await this.apiCall(`/api/job/${jobId}/backflow-devices`);

      console.log(`✅ Backflow devices fetched: ${response.data?.length || 0} devices`);

      return response;

    } catch (error) {
      console.error('❌ Error fetching backflow devices:', error);
      throw new Error(`Failed to fetch backflow devices: ${error.message}`);
    }
  }

  // Create a new backflow device
  async createBackflowDevice(jobId, deviceData) {
    try {
      console.log(`🔧 Creating backflow device for job: ${jobId}`);

      const response = await this.apiCall(`/api/job/${jobId}/backflow-devices`, {
        method: 'POST',
        body: deviceData
      });

      console.log('✅ Backflow device created:', response);

      return response;

    } catch (error) {
      console.error('❌ Error creating backflow device:', error);
      throw new Error(`Failed to create backflow device: ${error.message}`);
    }
  }

  // Update a backflow device
  async updateBackflowDevice(deviceId, deviceData) {
    try {
      console.log(`🔧 Updating backflow device: ${deviceId}`);

      const response = await this.apiCall(`/api/backflow-devices/${deviceId}`, {
        method: 'PUT',
        body: deviceData
      });

      console.log('✅ Backflow device updated:', response);

      return response;

    } catch (error) {
      console.error('❌ Error updating backflow device:', error);
      throw new Error(`Failed to update backflow device: ${error.message}`);
    }
  }

  // Get all test records for a job
  async getJobBackflowTests(jobId) {
    try {
      console.log(`📋 Fetching backflow tests for job: ${jobId}`);

      const response = await this.apiCall(`/api/job/${jobId}/backflow-tests`);

      console.log(`✅ Backflow tests fetched: ${response.data?.length || 0} tests`);

      return response;

    } catch (error) {
      console.error('❌ Error fetching backflow tests:', error);
      throw new Error(`Failed to fetch backflow tests: ${error.message}`);
    }
  }

  // Save a backflow test record
  async saveBackflowTest(testData) {
    try {
      console.log('💾 Saving backflow test:', testData);

      const response = await this.apiCall('/api/backflow-tests/save', {
        method: 'POST',
        body: testData
      });

      console.log('✅ Backflow test saved:', response);

      return response;

    } catch (error) {
      console.error('❌ Error saving backflow test:', error);
      throw new Error(`Failed to save backflow test: ${error.message}`);
    }
  }

  // Get photos for a test record
  async getBackflowTestPhotos(testId) {
    try {
      console.log(`📷 Fetching photos for test: ${testId}`);

      const response = await this.apiCall(`/api/backflow-tests/${testId}/photos`);

      console.log(`✅ Photos fetched: ${response.data?.length || 0} photos`);

      return response;

    } catch (error) {
      console.error('❌ Error fetching photos:', error);
      throw new Error(`Failed to fetch photos: ${error.message}`);
    }
  }

  // Upload a backflow photo
  async uploadBackflowPhoto(formData) {
    try {
      console.log('📷 Uploading backflow photo');

      const url = `${this.baseUrl}/api/backflow-photos/upload`;

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to upload photo: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Photo uploaded:', result);

      return result;

    } catch (error) {
      console.error('❌ Error uploading photo:', error);
      throw new Error(`Failed to upload photo: ${error.message}`);
    }
  }

  // Delete a backflow photo
  async deleteBackflowPhoto(photoId) {
    try {
      console.log(`🗑️ Deleting photo: ${photoId}`);

      const response = await this.apiCall(`/api/backflow-photos/${photoId}`, {
        method: 'DELETE'
      });

      console.log('✅ Photo deleted');

      return response;

    } catch (error) {
      console.error('❌ Error deleting photo:', error);
      throw new Error(`Failed to delete photo: ${error.message}`);
    }
  }

  // Generate backflow PDF
  async generateBackflowPDF(pdfData) {
    try {
      console.log('📄 Generating backflow PDF:', pdfData);

      const response = await this.apiCall('/api/backflow-pdfs/generate', {
        method: 'POST',
        body: pdfData
      });

      console.log('✅ Backflow PDF generated:', response);

      return response;

    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      throw new Error(`Failed to generate PDF: ${error.message}`);
    }
  }

  // Add job note
  async addJobNote(jobId, note) {
    try {
      console.log(`📝 Adding job note to job: ${jobId}`);

      const response = await this.apiCall(`/api/job/${jobId}/notes`, {
        method: 'POST',
        body: { note }
      });

      console.log('✅ Job note added');

      return response;

    } catch (error) {
      console.error('❌ Error adding job note:', error);
      throw new Error(`Failed to add job note: ${error.message}`);
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