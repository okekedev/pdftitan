// src/services/apiClient.js - COMPLETE VERSION WITH PDF FORM SUPPORT

import { serviceTitanConfig } from '../config/serviceTitanConfig';
import sessionManager from './sessionManger';

class ApiClient {
  constructor() {
    this.config = serviceTitanConfig;
    this.baseUrl = 'http://localhost:3005';
  }

  // ================== CORE API METHODS ==================

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

  // ================== JOBS ==================

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

  // ================== ATTACHMENTS ==================

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

  // ================== PDF FORM MANAGEMENT ==================

  // Save completed PDF form back to ServiceTitan
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

  // Generate a filled PDF with form data
  async generateFilledPDF(jobId, attachmentId, formData) {
    try {
      console.log(`📄 Generating filled PDF: ${attachmentId} for job: ${jobId}`);
      
      const response = await this.apiCall(`/api/job/${jobId}/attachment/${attachmentId}/generate-pdf`, {
        method: 'POST',
        body: formData,
        timeout: 60000
      });
      
      console.log(`✅ Filled PDF generated successfully`);
      
      return response;
      
    } catch (error) {
      console.error('❌ Error generating filled PDF:', error);
      throw new Error(`Failed to generate filled PDF: ${error.message}`);
    }
  }

  // Get completed forms for a job
  async getCompletedForms(jobId) {
    try {
      console.log(`📋 Fetching completed forms for job: ${jobId}`);
      
      const response = await this.apiCall(`/api/job/${jobId}/completed-forms`);
      
      console.log(`✅ Found ${response.data?.length || 0} completed forms`);
      
      return response.data || [];
      
    } catch (error) {
      console.error('❌ Error fetching completed forms:', error);
      
      // Return empty array if no completed forms found
      if (error.message.includes('404') || error.message.includes('not found')) {
        console.log(`ℹ️ No completed forms found for job ${jobId}`);
        return [];
      }
      
      throw new Error(`Failed to fetch completed forms: ${error.message}`);
    }
  }

  // Download completed form
  async downloadCompletedForm(jobId, formId) {
    try {
      console.log(`📥 Downloading completed form: ${formId} from job: ${jobId}`);
      
      const url = `${this.baseUrl}/api/job/${jobId}/completed-form/${formId}/download`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/octet-stream'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      console.log(`✅ Downloaded completed form: ${blob.size} bytes`);
      
      return {
        blob: blob,
        contentType: response.headers.get('content-type'),
        fileName: this.extractFileNameFromHeaders(response.headers)
      };
      
    } catch (error) {
      console.error('❌ Error downloading completed form:', error);
      throw new Error(`Failed to download completed form: ${error.message}`);
    }
  }

  // ================== FORM DATA HELPERS ==================

  // Prepare form data for saving
  prepareFormDataForSave(pdfInfo, jobInfo, editableElements) {
    return {
      originalFileName: pdfInfo.fileName,
      serviceTitanId: pdfInfo.serviceTitanId,
      editableElements: editableElements.map(element => ({
        id: element.id,
        type: element.type,
        value: element.value,
        position: {
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height
        },
        page: element.page || 1,
        fieldName: element.fieldName || null,
        isPdfField: element.isPdfField || false,
        created: element.created,
        modified: new Date().toISOString()
      })),
      jobInfo: {
        jobId: jobInfo.id,
        jobNumber: jobInfo.number,
        jobTitle: jobInfo.title,
        customerName: jobInfo.customer?.name,
        appointmentNumber: jobInfo.appointmentNumber,
        technicianName: this.getCurrentTechnician()?.name
      },
      metadata: {
        completedAt: new Date().toISOString(),
        elementCount: editableElements.length,
        version: '1.0.0',
        source: 'TitanPDF Mobile Editor'
      }
    };
  }

  // Validate form data before saving
  validateFormData(formData) {
    const errors = [];
    
    if (!formData.editableElements || formData.editableElements.length === 0) {
      errors.push('No form elements to save');
    }
    
    if (!formData.jobInfo || !formData.jobInfo.jobId) {
      errors.push('Missing job information');
    }
    
    if (!formData.originalFileName) {
      errors.push('Missing original file name');
    }
    
    // Check for required fields
    const requiredFields = formData.editableElements.filter(el => 
      el.isPdfField && el.fieldName && el.fieldName.toLowerCase().includes('required')
    );
    
    const emptyRequiredFields = requiredFields.filter(field => 
      !field.value || field.value.trim() === ''
    );
    
    if (emptyRequiredFields.length > 0) {
      errors.push(`Required fields not filled: ${emptyRequiredFields.map(f => f.fieldName).join(', ')}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  // Create a summary of form completion
  getFormCompletionSummary(editableElements) {
    const total = editableElements.length;
    const filled = editableElements.filter(el => el.value && el.value.trim() !== '').length;
    const signatures = editableElements.filter(el => el.type === 'signature' && el.value).length;
    const textFields = editableElements.filter(el => el.type === 'text' && el.value && el.value.trim() !== '').length;
    
    return {
      total: total,
      filled: filled,
      empty: total - filled,
      completionPercentage: total > 0 ? Math.round((filled / total) * 100) : 0,
      signatures: signatures,
      textFields: textFields,
      isComplete: filled === total,
      summary: `${filled}/${total} fields completed (${Math.round((filled / total) * 100)}%)`
    };
  }

  // Extract filename from response headers
  extractFileNameFromHeaders(headers) {
    const contentDisposition = headers.get('content-disposition');
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        return filenameMatch[1].replace(/['"]/g, '');
      }
    }
    return `completed_form_${Date.now()}`;
  }

  // ================== FORM TEMPLATES (Future Enhancement) ==================

  // Get available form templates
  async getFormTemplates() {
    try {
      console.log('📋 Fetching form templates...');
      
      // This would be a future enhancement to get predefined form templates
      const templates = [
        {
          id: 'backflow_test',
          name: 'Backflow Prevention Test Report',
          description: 'Standard backflow prevention device testing form',
          fields: [
            { name: 'device_type', label: 'Device Type', type: 'text', required: true },
            { name: 'serial_number', label: 'Serial Number', type: 'text', required: true },
            { name: 'test_date', label: 'Test Date', type: 'date', required: true },
            { name: 'technician_signature', label: 'Technician Signature', type: 'signature', required: true }
          ]
        },
        {
          id: 'safety_inspection',
          name: 'Safety Inspection Checklist',
          description: 'General safety inspection form',
          fields: [
            { name: 'location', label: 'Inspection Location', type: 'text', required: true },
            { name: 'inspection_date', label: 'Inspection Date', type: 'date', required: true },
            { name: 'inspector_signature', label: 'Inspector Signature', type: 'signature', required: true }
          ]
        }
      ];
      
      return templates;
      
    } catch (error) {
      console.error('❌ Error fetching form templates:', error);
      return [];
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

  // Handle API errors
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

  // Handle form-specific errors
  handleFormError(error, context = '') {
    console.error(`Form Error ${context}:`, error);

    if (error.message.includes('validation')) {
      return {
        type: 'VALIDATION',
        message: 'Form validation failed',
        userMessage: 'Please check that all required fields are filled out correctly.'
      };
    }

    if (error.message.includes('upload')) {
      return {
        type: 'UPLOAD',
        message: 'Form upload failed',
        userMessage: 'Failed to save form to ServiceTitan. Please try again.'
      };
    }

    if (error.message.includes('permission')) {
      return {
        type: 'PERMISSION',
        message: 'Permission denied',
        userMessage: 'You do not have permission to save forms for this job.'
      };
    }

    // Use existing error handling for other cases
    return this.handleApiError(error);
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
        features: health.features
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

  // ================== USAGE EXAMPLES AND DOCUMENTATION ==================
  
  /*
  Example usage in PDFEditor component:

  const handleSave = async () => {
    try {
      // Prepare form data
      const formData = apiClient.prepareFormDataForSave(pdf, job, editableElements);
      
      // Validate before saving
      const validation = apiClient.validateFormData(formData);
      if (!validation.isValid) {
        alert('Form validation failed:\n' + validation.errors.join('\n'));
        return;
      }
      
      // Get completion summary
      const summary = apiClient.getFormCompletionSummary(editableElements);
      console.log('Form completion:', summary.summary);
      
      // Save to ServiceTitan
      const result = await apiClient.saveCompletedPDFForm(job.id, pdf.serviceTitanId, formData);
      
      if (result.success) {
        alert(`Form saved successfully!\n${summary.summary}`);
        onSave(result.data);
      }
      
    } catch (error) {
      const errorInfo = apiClient.handleFormError(error, 'saving form');
      alert(`Error saving form: ${errorInfo.userMessage}`);
    }
  };

  Example usage in Attachments component:

  const loadAttachments = async () => {
    try {
      const attachments = await apiClient.getJobAttachments(job.id);
      setAttachments(attachments);
      
      // Get summary
      const summary = apiClient.getAttachmentSummary(attachments);
      console.log(`Found ${summary.total} attachments`);
      
    } catch (error) {
      const errorInfo = apiClient.handleApiError(error);
      setError(errorInfo.userMessage);
    }
  };

  Example usage in Jobs component:

  const loadAppointments = async () => {
    try {
      const appointments = await apiClient.getMyAppointments();
      
      // Filter by date range
      const filtered = apiClient.filterAppointmentsByDateRange(appointments, 'today-tomorrow');
      setFilteredAppointments(filtered);
      
      // Get available statuses for filter dropdown
      const statuses = apiClient.getAvailableStatuses(appointments);
      setAvailableStatuses(statuses);
      
    } catch (error) {
      const errorInfo = apiClient.handleApiError(error);
      setError(errorInfo.userMessage);
    }
  };
  */
}

// Export singleton
const apiClient = new ApiClient();
export default apiClient;