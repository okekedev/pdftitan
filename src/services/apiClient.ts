// src/services/apiClient.ts - Updated with PDF Binary Handling and ServiceTitan Upload
import sessionManager from './sessionManager';

interface ApiCallOptions {
  method?: string;
  body?: unknown;
  timeout?: number;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.DEV ? 'http://localhost:3004' : '';
  }

  // ================== CORE API METHOD ==================

  async apiCall<T = unknown>(endpoint: string, options: ApiCallOptions = {}): Promise<T> {
    const { method = 'GET', body = null, timeout = 30000 } = options;

    const url = `${this.baseUrl}${endpoint}`;

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    console.log(`📡 API Call: ${method} ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    fetchOptions.signal = controller.signal;

    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`✅ API Success: ${method} ${url}`);
      return responseData as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      console.error(`❌ API Error: ${endpoint}`, error);
      throw error;
    }
  }

  // ================== AUTHENTICATION ==================

  async validateTechnician(username: string, phone: string) {
    return this.apiCall('/api/technician/validate', {
      method: 'POST',
      body: { username, phone },
    });
  }

  async getHealth() {
    return this.apiCall('/health');
  }

  // ================== JOBS ==================

  async getMyJobs() {
    const session = sessionManager.getTechnicianSession();
    if (!session?.technician?.id) throw new Error('No technician session found');

    console.log(`👷 Fetching jobs for technician ${session.technician.id}`);
    const response = await this.apiCall<{ data: unknown[]; groupedByDate: Record<string, unknown> }>(
      `/api/technician/${session.technician.id}/jobs`
    );
    console.log(`✅ Jobs fetched: ${response.data?.length ?? 0} jobs`);
    return response;
  }

  // ================== JOB DETAILS ==================

  async getJobDetails(jobId: number | string) {
    console.log(`📋 Fetching job details for: ${jobId}`);
    const response = await this.apiCall<{ data: unknown }>(`/api/job/${jobId}`);
    console.log(`✅ Job details fetched`);
    return response.data;
  }

  // ================== CUSTOMER DETAILS ==================

  async getCustomerDetails(customerId: number | string) {
    console.log(`👤 Fetching customer details for: ${customerId}`);
    const response = await this.apiCall<{ data: unknown }>(`/api/customer/${customerId}`);
    console.log(`✅ Customer details fetched`);
    return response.data;
  }

  // ================== ATTACHMENTS ==================

  async getJobAttachments(jobId: number | string) {
    console.log(`📎 Fetching attachments for job: ${jobId}`);
    const response = await this.apiCall<{ data: unknown[] }>(`/api/job/${jobId}/attachments`);
    console.log(`✅ Attachments fetched: ${response.data?.length ?? 0} attachments`);
    return response.data ?? [];
  }

  // ================== PDF PROCESSING ==================

  async downloadPDF(jobId: number | string, attachmentId: number | string): Promise<ArrayBuffer> {
    console.log(`📄 Downloading PDF: Job ${jobId}, Attachment ${attachmentId}`);

    const url = `${this.baseUrl}/api/job/${jobId}/attachment/${attachmentId}/download`;

    const response = await fetch(url, { method: 'GET', credentials: 'include' });

    if (!response.ok) throw new Error(`Failed to download PDF: ${response.statusText}`);

    console.log(`✅ PDF downloaded successfully`);
    return response.arrayBuffer();
  }

  getFileNameFromResponse(response: Response): string {
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
      if (matches?.[1]) {
        const filename = matches[1].replace(/['"]/g, '');
        return filename.endsWith('.pdf') ? filename : filename + '.pdf';
      }
    }
    return 'Completed_Form.pdf';
  }

  downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  // ================== GOOGLE DRIVE INTEGRATION ==================

  async savePDFAsDraft(pdfData: unknown) {
    console.log('💾 Saving PDF as draft to Google Drive:', pdfData);
    const response = await this.apiCall('/api/drafts/save', { method: 'POST', body: pdfData });
    console.log('✅ PDF saved as draft:', response);
    return response;
  }

  async updateDraft(fileId: string, jobId: unknown, objects: unknown, fileName: unknown) {
    console.log(`🔄 Updating existing draft: ${fileId}`);
    const response = await this.apiCall(`/api/drafts/update/${fileId}`, {
      method: 'PUT',
      body: { jobId, objects, fileName },
    });
    console.log('✅ Draft updated:', response);
    return response;
  }

  async getJobDrafts(jobId: number | string) {
    console.log(`🔍 Fetching drafts for job: ${jobId}`);
    const response = await this.apiCall<{ drafts: unknown[]; completed: unknown[] }>(`/api/drafts/${jobId}`);
    console.log(`✅ Drafts fetched: ${response.drafts?.length ?? 0} drafts, ${response.completed?.length ?? 0} completed`);
    return response;
  }

  async promoteToCompleted(fileId: string, jobId: unknown) {
    console.log(`📤 Promoting draft to completed: ${fileId}`);
    const response = await this.apiCall(`/api/drafts/${fileId}/complete`, {
      method: 'POST',
      body: { jobId },
    });
    console.log('✅ Draft promoted to completed:', response);
    return response;
  }

  // ================== BACKFLOW TESTING ==================

  async getJobBackflowDevices(jobId: number | string) {
    console.log(`🔧 Fetching backflow devices for job: ${jobId}`);
    const response = await this.apiCall<{ data: unknown[] }>(`/api/job/${jobId}/backflow-devices`);
    console.log(`✅ Backflow devices fetched: ${response.data?.length ?? 0} devices`);
    return response;
  }

  async createBackflowDevice(jobId: number | string, deviceData: unknown) {
    console.log(`🔧 Creating backflow device for job: ${jobId}`);
    const response = await this.apiCall(`/api/job/${jobId}/backflow-devices`, { method: 'POST', body: deviceData });
    console.log('✅ Backflow device created:', response);
    return response;
  }

  async updateBackflowDevice(deviceId: number | string, deviceData: unknown) {
    console.log(`🔧 Updating backflow device: ${deviceId}`);
    const response = await this.apiCall(`/api/backflow-devices/${deviceId}`, { method: 'PUT', body: deviceData });
    console.log('✅ Backflow device updated:', response);
    return response;
  }

  async getJobBackflowTests(jobId: number | string) {
    console.log(`📋 Fetching backflow tests for job: ${jobId}`);
    const response = await this.apiCall<{ data: unknown[] }>(`/api/job/${jobId}/backflow-tests`);
    console.log(`✅ Backflow tests fetched: ${response.data?.length ?? 0} tests`);
    return response;
  }

  async saveBackflowTest(testData: unknown) {
    console.log('💾 Saving backflow test:', testData);
    const response = await this.apiCall('/api/backflow-tests/save', { method: 'POST', body: testData });
    console.log('✅ Backflow test saved:', response);
    return response;
  }

  async getBackflowTestPhotos(testId: number | string) {
    console.log(`📷 Fetching photos for test: ${testId}`);
    const response = await this.apiCall<{ data: unknown[] }>(`/api/backflow-tests/${testId}/photos`);
    console.log(`✅ Photos fetched: ${response.data?.length ?? 0} photos`);
    return response;
  }

  async uploadBackflowPhoto(formData: FormData) {
    console.log('📷 Uploading backflow photo');

    const url = `${this.baseUrl}/api/backflow-photos/upload`;
    const response = await fetch(url, { method: 'POST', body: formData, credentials: 'include' });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(errorData.error || `Failed to upload photo: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Photo uploaded:', result);
    return result;
  }

  async deleteBackflowPhoto(photoId: number | string) {
    console.log(`🗑️ Deleting photo: ${photoId}`);
    const response = await this.apiCall(`/api/backflow-photos/${photoId}`, { method: 'DELETE' });
    console.log('✅ Photo deleted');
    return response;
  }

  async generateBackflowPDF(pdfData: {
    deviceId: string;
    testRecordId: string;
    jobId: number | string;
    cityCode: string;
    technician: unknown;
    company: unknown;
    customerName: string;
    serviceAddress: string;
  }) {
    console.log('📄 Generating backflow PDF:', pdfData);
    const response = await this.apiCall('/api/backflow-pdfs/generate', { method: 'POST', body: pdfData });
    console.log('✅ Backflow PDF generated:', response);
    return response;
  }

  async generateOnlineReference(pdfData: unknown) {
    console.log('📄 Generating online reference report:', pdfData);
    const response = await this.apiCall('/api/backflow-pdfs/generate-online-reference', { method: 'POST', body: pdfData });
    console.log('✅ Online reference report generated:', response);
    return response;
  }

  async addJobNote(jobId: number | string, note: string) {
    console.log(`📝 Adding job note to job: ${jobId}`);
    const response = await this.apiCall(`/api/job/${jobId}/notes`, { method: 'POST', body: { note } });
    console.log('✅ Job note added');
    return response;
  }

  async getCities() {
    console.log('🌆 Fetching cities');
    const response = await this.apiCall<{ data: unknown[] }>('/api/cities');
    console.log(`✅ Cities fetched: ${response.data?.length ?? 0} cities`);
    return response;
  }

  async getCityInfo(cityName: string) {
    console.log(`🌆 Fetching city info for: ${cityName}`);
    const response = await this.apiCall(`/api/cities/${encodeURIComponent(cityName)}`);
    console.log('✅ City info fetched');
    return response;
  }

  async getFormFields() {
    console.log('📋 Fetching form field definitions');
    const response = await this.apiCall('/api/form-fields');
    console.log('✅ Form fields fetched');
    return response;
  }

  async getManufacturers(): Promise<{ name: string; models: string[] }[]> {
    const response = await this.apiCall<{ data: { name: string; models: string[] }[] }>('/api/backflow/manufacturers');
    return response.data ?? [];
  }

  async trackManufacturer(manufacturer: string, model?: string): Promise<void> {
    if (!manufacturer.trim()) return;
    await this.apiCall('/api/backflow/manufacturers/track', {
      method: 'POST',
      body: { manufacturer: manufacturer.trim(), model: model?.trim() ?? '' },
    });
  }

  // ================== UTILITIES ==================

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.getHealth() as { status?: string };
      return response?.status === 'healthy';
    } catch {
      return false;
    }
  }

  logout(): void {
    sessionManager.clearTechnicianSession();
  }
}

const apiClient = new ApiClient();
export default apiClient;
