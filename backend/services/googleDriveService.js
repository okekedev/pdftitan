/**
 * Production Google Drive Service for PDF Titan App
 * Enhanced with Base64 credentials support for GitHub Actions
 * Organizes files by Job ID in separate folders
 */

const { google } = require('googleapis');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

/**
 * Get Google credentials from environment variables
 * Supports both base64-encoded JSON and individual environment variables
 */
function getGoogleCredentials() {
  try {
    // Method 1: Base64-encoded credentials (recommended for GitHub Actions)
    if (process.env.GOOGLE_CREDENTIALS_BASE64) {
      console.log('🔍 Found GOOGLE_CREDENTIALS_BASE64 environment variable');
      
      // Just decode the base64, don't modify anything
      const decodedCredentials = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf8');
      const credentials = JSON.parse(decodedCredentials);
      
      console.log('✅ Successfully decoded GOOGLE_CREDENTIALS_BASE64 (no modifications)');
      console.log(`📧 Service Account: ${credentials.client_email}`);
      
      // Return credentials exactly as they were in the original JSON
      return credentials;
    }
    
    // Method 2: Individual environment variables (fallback)
    else if (process.env.GOOGLE_DRIVE_PRIVATE_KEY) {
      console.log('🔍 Using individual Google Drive environment variables');
      
      const credentials = {
        "type": "service_account",
        "project_id": process.env.GOOGLE_DRIVE_PROJECT_ID,
        "private_key_id": process.env.GOOGLE_DRIVE_PRIVATE_KEY_ID,
        "private_key": process.env.GOOGLE_DRIVE_PRIVATE_KEY, // No processing at all
        "client_email": process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
        "client_id": process.env.GOOGLE_DRIVE_CLIENT_ID,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.GOOGLE_DRIVE_CLIENT_EMAIL)}`,
        "universe_domain": "googleapis.com"
      };
      
      console.log('✅ Successfully built credentials from individual env vars (no modifications)');
      console.log(`📧 Service Account: ${credentials.client_email}`);
      
      return credentials;
    }
    
    else {
      throw new Error('No Google credentials found. Please set either GOOGLE_CREDENTIALS_BASE64 or individual GOOGLE_DRIVE_* environment variables');
    }
    
  } catch (error) {
    console.error('❌ Failed to process Google credentials:', error.message);
    
    // Enhanced error messaging for common issues
    if (error.message.includes('JSON.parse')) {
      console.error('💡 The GOOGLE_CREDENTIALS_BASE64 may be corrupted. Try re-encoding your service account JSON file.');
    }
    if (error.message.includes('DECODER routines')) {
      console.error('💡 Private key format error. Ensure your private key is properly formatted with actual newlines.');
    }
    
    throw new Error(`Google credentials error: ${error.message}`);
  }
}

// Google Drive folder IDs from environment variables
const FOLDER_IDS = {
  DRAFT: process.env.GOOGLE_DRIVE_DRAFT_FOLDER_ID,      // 1GNrVdoGnWNHC6_QmvNkZEIUroNwg-q29
  COMPLETED: process.env.GOOGLE_DRIVE_COMPLETED_FOLDER_ID // 1tTsOoGiBJPvJucrpjIQvVvXJSIP8SVbJ
};

class GoogleDriveService {
  constructor() {
    this.drive = null;
    this.initialized = false;
    this.validateEnvironmentVariables();
  }
  /**
   * Validate that all required environment variables are set
   */
  validateEnvironmentVariables() {
    // Check for GOOGLE_CREDENTIALS_BASE64 first
    if (process.env.GOOGLE_CREDENTIALS_BASE64) {
      console.log('✅ Found GOOGLE_CREDENTIALS_BASE64 environment variable');
      
      // Still need folder IDs
      const requiredFolders = [
        'GOOGLE_DRIVE_DRAFT_FOLDER_ID',
        'GOOGLE_DRIVE_COMPLETED_FOLDER_ID'
      ];
      
      const missing = requiredFolders.filter(env => !process.env[env]);
      
      if (missing.length > 0) {
        console.error('❌ Missing required Google Drive folder environment variables:');
        missing.forEach(env => console.error(`   - ${env}`));
        throw new Error(`Missing Google Drive folder environment variables: ${missing.join(', ')}`);
      }
    }
    // Fallback to individual variables
    else {
      const required = [
        'GOOGLE_DRIVE_PROJECT_ID',
        'GOOGLE_DRIVE_PRIVATE_KEY_ID', 
        'GOOGLE_DRIVE_PRIVATE_KEY',
        'GOOGLE_DRIVE_CLIENT_EMAIL',
        'GOOGLE_DRIVE_CLIENT_ID',
        'GOOGLE_DRIVE_DRAFT_FOLDER_ID',
        'GOOGLE_DRIVE_COMPLETED_FOLDER_ID'
      ];

      const missing = required.filter(env => !process.env[env]);
      
      if (missing.length > 0) {
        console.error('❌ Missing required Google Drive environment variables:');
        missing.forEach(env => console.error(`   - ${env}`));
        throw new Error(`Missing Google Drive environment variables: ${missing.join(', ')}`);
      }
    }

    console.log('✅ All required Google Drive environment variables are set');
    console.log(`📁 Draft Folder: ${FOLDER_IDS.DRAFT}`);
    console.log(`📁 Completed Folder: ${FOLDER_IDS.COMPLETED}`);
    
    // Test credentials processing
    try {
      const credentials = getGoogleCredentials();
      console.log(`🔑 Credentials validation successful for: ${credentials.client_email}`);
    } catch (error) {
      console.error('❌ Credentials validation failed:', error.message);
      throw error;
    }
  }

  /**
   * Initialize Google Drive with Service Account
   */
  async initialize() {
    try {
      console.log('🔐 Initializing Google Drive service with Service Account...');
      
      // Get credentials using the enhanced function
      const GOOGLE_CREDENTIALS = getGoogleCredentials();
      
      // Create service account authentication
      const auth = new google.auth.GoogleAuth({
        credentials: GOOGLE_CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/drive']
      });

      // Get authenticated client with timeout
      console.log('🔄 Requesting authenticated client...');
      const authClient = await Promise.race([
        auth.getClient(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Authentication timeout after 15 seconds')), 15000)
        )
      ]);
      
      this.drive = google.drive({ version: 'v3', auth: authClient });
      this.initialized = true;
      
      console.log('✅ Google Drive service initialized with Service Account');
      console.log(`📧 Service Account: ${GOOGLE_CREDENTIALS.client_email}`);
      
      // Test connectivity
      await this.testConnection();
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive:', error);
      
      // Enhanced error reporting for common issues
      if (error.message.includes('DECODER routines')) {
        console.error('🔍 OpenSSL private key format error detected');
        console.error('💡 This usually means the private key format is incorrect');
        console.error('💡 If using GOOGLE_CREDENTIALS_BASE64, ensure they are properly encoded');
        console.error('💡 If using individual env vars, ensure private key has proper newlines');
      }
      if (error.message.includes('timeout')) {
        console.error('🔍 Authentication timeout - this may be a network or credentials issue');
      }
      
      this.initialized = false;
      return false;
    }
  }

  /**
   * Test Google Drive connectivity
   */
  async testConnection() {
    try {
      console.log('🧪 Testing Google Drive connectivity...');
      
      const response = await this.drive.about.get({
        fields: 'user'
      });
      
      console.log('✅ Google Drive connection test successful');
      console.log(`👤 Connected as: ${response.data.user.emailAddress}`);
      
      return true;
    } catch (error) {
      console.error('❌ Google Drive connection test failed:', error.message);
      throw new Error(`Google Drive connectivity test failed: ${error.message}`);
    }
  }

  /**
   * Create or get a job folder within the specified parent folder
   */
  async createOrGetJobFolder(jobId, parentFolderId) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      // First, check if the job folder already exists
      const existingFolders = await this.drive.files.list({
        q: `'${parentFolderId}' in parents and name = '${jobId}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'files(id, name)'
      });

      if (existingFolders.data.files.length > 0) {
        console.log(`📁 Found existing job folder: ${jobId}`);
        return existingFolders.data.files[0].id;
      }

      // Create new job folder
      console.log(`📁 Creating new job folder: ${jobId}`);
      const folderMetadata = {
        name: jobId,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      };

      const folderResponse = await this.drive.files.create({
        resource: folderMetadata,
        supportsAllDrives: true,
        fields: 'id, name'
      });

      console.log(`✅ Created job folder: ${jobId} (${folderResponse.data.id})`);
      return folderResponse.data.id;

    } catch (error) {
      console.error(`❌ Failed to create/get job folder ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Generate PDF with form fields and save as draft
   */
  async savePDFAsDraft(originalPdfBuffer, formFields, jobId, fileName) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Get or create job folder in Drafts
      const jobFolderId = await this.createOrGetJobFolder(jobId, FOLDER_IDS.DRAFT);

      // Generate filled PDF
      const filledPdfBuffer = await this.generateFilledPDF(originalPdfBuffer, formFields);
      
      // Save to Google Drive job folder
      const result = await this.uploadToFolder(filledPdfBuffer, fileName, jobFolderId);
      
      return {
        ...result,
        jobId,
        folderType: 'draft'
      };
    } catch (error) {
      console.error('❌ Failed to save PDF as draft:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update existing file in Google Drive
   */
  async updateFile(fileId, pdfBuffer, fileName) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      console.log(`🔄 Updating file ${fileId} in Google Drive...`);

      // Create temp file (same approach as uploadToFolder method)
      const tempFilePath = path.join(__dirname, `temp-update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.pdf`);
      fs.writeFileSync(tempFilePath, Buffer.from(pdfBuffer));

      // Create media object for upload using file stream
      const media = {
        mimeType: 'application/pdf',
        body: fs.createReadStream(tempFilePath)
      };

      // Update the file content (keep same name and location)
      const response = await this.drive.files.update({
        fileId: fileId,
        media: media,
        supportsAllDrives: true,
        fields: 'id, name, size, modifiedTime'
      });

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      console.log(`✅ File updated successfully: ${response.data.id}`);
      
      return {
        success: true,
        fileId: response.data.id,
        fileName: response.data.name,
        size: response.data.size,
        modifiedTime: response.data.modifiedTime
      };

    } catch (error) {
      // Clean up temp file if it exists
      const tempFiles = fs.readdirSync(__dirname).filter(f => f.startsWith('temp-update-'));
      tempFiles.forEach(f => {
        try {
          fs.unlinkSync(path.join(__dirname, f));
        } catch (e) {}
      });

      console.error('❌ Failed to update file in Google Drive:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Move draft to completed folder (promote)
   */
  async promoteToCompleted(draftFileId, jobId) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      // Get or create job folder in Completed
      const completedJobFolderId = await this.createOrGetJobFolder(jobId, FOLDER_IDS.COMPLETED);

      // Get the draft job folder ID
      const draftJobFolderId = await this.createOrGetJobFolder(jobId, FOLDER_IDS.DRAFT);

      // Move file from draft job folder to completed job folder
      await this.drive.files.update({
        fileId: draftFileId,
        addParents: completedJobFolderId,
        removeParents: draftJobFolderId,
        supportsAllDrives: true,
        fields: 'id, parents'
      });

      console.log(`✅ File ${draftFileId} promoted to completed for job ${jobId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to promote to completed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * ✅ FIXED: Download file content from Google Drive
   */
  async downloadFile(fileId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log(`📥 Downloading file from Google Drive: ${fileId}`);

      // Download the file content
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media',
        supportsAllDrives: true
      }, {
        responseType: 'stream'
      });

      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of response.data) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      console.log(`✅ File downloaded successfully: ${buffer.length} bytes`);

      return {
        success: true,
        data: buffer
      };

    } catch (error) {
      console.error(`❌ Failed to download file ${fileId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get file metadata from Google Drive
   */
  async getFileMetadata(fileId) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      console.log(`🔍 Getting file metadata: ${fileId}`);

      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, size, mimeType, createdTime, modifiedTime, parents',
        supportsAllDrives: true
      });

      if (response.status === 200) {
        console.log(`✅ Retrieved metadata for file: ${response.data.name}`);
        return response.data;
      } else {
        throw new Error(`Metadata fetch failed with status: ${response.status}`);
      }

    } catch (error) {
      console.error(`❌ Failed to get metadata for file ${fileId}:`, error);
      return null;
    }
  }

  /**
   * Generate filled PDF with form fields
   */
  async generateFilledPDF(originalPdfBuffer, formFields) {
    try {
      const existingPdfDoc = await PDFDocument.load(originalPdfBuffer);
      const pages = existingPdfDoc.getPages();
      const font = await existingPdfDoc.embedFont('Helvetica');

      // Process each form field
      for (const field of formFields) {
        const pageIndex = (field.page || 1) - 1; // Convert to 0-based index
        const page = pages[pageIndex];
        
        if (!page) {
          console.warn(`⚠️ Page ${field.page} not found, skipping field ${field.id}`);
          continue;
        }

        const { height: pageHeight } = page.getSize();
        const adjustedY = pageHeight - field.y - field.height; // Convert coordinate system

        switch (field.type) {
          case 'text':
            if (field.content && field.content.toString().trim()) {
              page.drawText(field.content.toString(), {
                x: field.x,
                y: adjustedY + (field.height / 2) - 5, // Center vertically
                size: field.fontSize || 12,
                font: font,
                color: rgb(0, 0, 0)
              });
            }
            break;

          case 'signature':
            if (field.content && field.content.startsWith('data:image/')) {
              try {
                const base64Data = field.content.replace(/^data:image\/[a-z]+;base64,/, '');
                const signatureImage = await existingPdfDoc.embedPng(Buffer.from(base64Data, 'base64'));
                
                page.drawImage(signatureImage, {
                  x: field.x,
                  y: adjustedY,
                  width: field.width,
                  height: field.height
                });
              } catch (imgError) {
                console.warn('⚠️ Failed to embed signature image:', imgError.message);
              }
            }
            break;

          case 'date':
          case 'timestamp':
            if (field.content && field.content.toString().trim()) {
              const dateText = field.content.toString();
              page.drawText(dateText, {
                x: field.x,
                y: adjustedY + (field.height / 2) - 5,
                size: field.fontSize || 10,
                font: font,
                color: rgb(0, 0, 0)
              });
            }
            break;

          case 'checkbox':
            // Check if checkbox is checked (content should be true for checked boxes)
            const isChecked = field.content === true || field.content === 'true' || field.content === 1;
            
            if (isChecked) {
              // Render X mark for checked boxes (matching frontend style)
              const fontSize = 10;
              
              page.drawText('X', {
                x: field.x + 2,
                y: adjustedY + 2,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 1) // Blue color
              });
            }
            break;
        }
      }

      return await existingPdfDoc.save();
    } catch (error) {
      console.error('❌ Failed to generate filled PDF:', error);
      throw error;
    }
  }

  /**
   * Convert hex color to RGB
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return rgb(
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255
      );
    }
    return rgb(0, 0, 0); // Default to black
  }

  /**
   * Upload PDF to specified folder using proven working syntax
   */
  async uploadToFolder(pdfBuffer, fileName, folderId) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      // Create temp file (most reliable method)
      const tempFilePath = path.join(__dirname, `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.pdf`);
      fs.writeFileSync(tempFilePath, Buffer.from(pdfBuffer));

      const fileMetadata = {
        name: fileName,
        parents: [folderId]
      };

      const media = {
        mimeType: 'application/pdf',
        body: fs.createReadStream(tempFilePath)
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, createdTime, size, parents',
        supportsAllDrives: true
      });

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      console.log('✅ PDF uploaded to Google Drive:', response.data);
      return {
        success: true,
        fileId: response.data.id,
        fileName: response.data.name,
        createdTime: response.data.createdTime,
        size: response.data.size,
        parents: response.data.parents
      };

    } catch (error) {
      // Clean up temp file if it exists
      const tempFiles = fs.readdirSync(__dirname).filter(f => f.startsWith('temp-'));
      tempFiles.forEach(f => {
        try {
          fs.unlinkSync(path.join(__dirname, f));
        } catch (e) {}
      });

      console.error('❌ Failed to upload to Google Drive:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all drafts and completed files organized by Job ID
   */
  async getAllJobFiles() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const [draftJobs, completedJobs] = await Promise.all([
        this.getJobsFromFolder(FOLDER_IDS.DRAFT, 'drafts'),
        this.getJobsFromFolder(FOLDER_IDS.COMPLETED, 'completed')
      ]);

      return {
        success: true,
        drafts: draftJobs,
        completed: completedJobs
      };
    } catch (error) {
      console.error('❌ Failed to get job files:', error);
      return {
        success: false,
        error: error.message,
        drafts: {},
        completed: {}
      };
    }
  }

  /**
   * Get jobs and their files from a specific folder
   */
  async getJobsFromFolder(parentFolderId, folderType) {
    try {
      // Get all job folders in the parent folder
      const jobFolders = await this.drive.files.list({
        q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'files(id, name, createdTime)',
        orderBy: 'createdTime desc'
      });

      const jobs = {};

      // For each job folder, get the files inside
      for (const jobFolder of jobFolders.data.files) {
        const jobId = jobFolder.name;
        
        const filesInJob = await this.drive.files.list({
          q: `'${jobFolder.id}' in parents and mimeType = 'application/pdf' and trashed = false`,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          fields: 'files(id, name, createdTime, modifiedTime, size)',
          orderBy: 'modifiedTime desc'
        });

        if (filesInJob.data.files.length > 0) {
          jobs[jobId] = {
            jobId,
            folderId: jobFolder.id,
            folderCreated: jobFolder.createdTime,
            files: filesInJob.data.files.map(file => ({
              id: file.id,
              name: file.name,
              createdTime: file.createdTime,
              modifiedTime: file.modifiedTime,
              size: file.size,
              type: folderType
            }))
          };
        }
      }

      return jobs;
    } catch (error) {
      console.error(`❌ Failed to get jobs from ${folderType} folder:`, error);
      return {};
    }
  }

  /**
   * Get files for a specific job ID
   */
  async getFilesByJobId(jobId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const [draftFiles, completedFiles] = await Promise.all([
        this.getFilesInJobFolder(jobId, FOLDER_IDS.DRAFT),
        this.getFilesInJobFolder(jobId, FOLDER_IDS.COMPLETED)
      ]);

      return {
        success: true,
        jobId,
        drafts: draftFiles,
        completed: completedFiles
      };
    } catch (error) {
      console.error('❌ Failed to get files by job ID:', error);
      return {
        success: false,
        error: error.message,
        drafts: [],
        completed: []
      };
    }
  }

  /**
   * Get files in a specific job folder
   */
  async getFilesInJobFolder(jobId, parentFolderId) {
    try {
      // Find the job folder
      const jobFolders = await this.drive.files.list({
        q: `'${parentFolderId}' in parents and name = '${jobId}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'files(id, name)'
      });

      if (jobFolders.data.files.length === 0) {
        return []; // No job folder exists yet
      }

      const jobFolderId = jobFolders.data.files[0].id;

      // Get files in the job folder
      const filesResponse = await this.drive.files.list({
        q: `'${jobFolderId}' in parents and mimeType = 'application/pdf' and trashed = false`,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'files(id, name, createdTime, modifiedTime, size)',
        orderBy: 'modifiedTime desc'
      });

      return filesResponse.data.files || [];
    } catch (error) {
      console.error(`❌ Failed to get files in job folder ${jobId}:`, error);
      return [];
    }
  }
}

module.exports = new GoogleDriveService();