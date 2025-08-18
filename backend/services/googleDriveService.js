/**
 * Backend Google Drive Service for PDF Titan App
 * Handles server-side Google Drive operations
 */

const { google } = require('googleapis');
const { PDFDocument } = require('pdf-lib');

// Service Account credentials
const GOOGLE_CREDENTIALS = {
  "type": "service_account",
  "project_id": "backflow-reports-467621",
  "private_key_id": "b67b2e1c5a092717e87e1a1aa212ffae436efed0",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC56TetE5FwV+TV\nAVrlgoQIguMWEjfMwu5ehmg1rceXtUMsVsxM5Jgx6gx+3O5/kHlNb4sVe2ezcFN7\n19kL0mdynDyLGvbdj4eU9tflpoRS1WmV6WzmUe51f1SavVE6/3f+CKZ+vq3jRJSa\nINAV2GFiNkPbsE+GjhopqKOfDGFwUNzDf7bHwzw9PsiIFGLDbrfiNQnsch6LQUPG\nx+hLB5IKu+gQrixyCl3QfOq3qCs3vHhSW9enakJGaBawHV06N241rmnQhawOYrxg\nqfUFksAeTmbfYxtIH30uEZd2Y1LLcibiRcFelpElABQhYrf5liz48uum952IKkxR\nN+9Irfr7AgMBAAECggEABjKJk7ON/h4+XefRKJesuhhO5KRcoTuzgYnE48E0YNDL\nxlvp+WHUPWaHEYJg6vZQea3cIS4ZDpWSGuDe3RkfyX8yBeF/7qV2iH2gEQl3g/r8\nRy4qxK5hHu0AAraIt8kRx9fW+qB1oH75RMtCOvAyWUYXOTWyUpLeUwD9qPNbNJWK\nEl+eEiemXsbGWHIYAsIY4GDMfBj9XxSJkzLm6fUgwg5erqcP+DdSoyOiV+WqC0GA\n0JGI8DtNbXG4CrNPkeAle8XhYeVzY5SWgh2Cj52NvAffpaGnQ2IfXTRV064WCnzy\nXV9Yld0wOd80jPvZb0H4arcnuTWR1tFF2xd9mzq/RQKBgQDx0Xs0ewV4D9d/6Kx5\nrJpBU5H3L+/0YhxcjKznMXZid3DMvVFCR6IBfYpVht9gImkw4gcqcqQ2uxXjuqv9\nSRqr4EW4TBJ60pJGrN8PHTuxdX3caEaGiXUlnBEWXBALsmHWOoA4ov8Z+ARaEzO4\nAtDAi//F3Jp60U0CXczlA6fD1QKBgQDE0GB9K6vJxoDxdn6H9Crm1C91G7ISJ4Or\nuC47V6S3uhyDFanH/7hsKMdDj3C3khptbnA5dgmLc2xF3n4+lSwRQ0khePZsHLrC\ndzKImGYt3axD11awxQSlYqxyziVgXVhZqgUqwSAkzcilX+pmwI1VSNOxPLUbi2PH\nIAjGPr+7jwKBgBClCaT4Hs0/0eaE/nI1ljyO4wovq4WXxzn7mN8lAXAPpp0BHvm/\n8n/Fw2LVsMRuOe1acYHTeEgoIn6VV8dMY+CWxFXGLrNzkQv6VDQ3H+e8HZixOMGD\n7qNTFb4DQjt74M4dIrxDQ+nmr23/ylyNHQ9T05wr7hosE+/owvS0hrStAoGBALYz\nblASoMuAMBjZqNO1sA3Xe0O/6v8xg4zySiJ3xa6s5f5YjL/xNcsziR07ao8W+845\nAj2/z6BAr4iTLG5FbPFiSA5rzD1T73VeIfMgmt91Kyf273NgQSfWjG0P+LwYTlVb\nt8LX3SkVNN4cSITtVyoP7KJU4Bjq1ukd9+GHb7pzAoGBAMJn+xmqVBW2cvKq+/8a\n9/CKOScSAu/m7hvatIuMXYS1V14PfAVxEDySoqngQYC1ZH3UKwm8t7IMuP7ib0gq\nAZhhsWXHkyLPPhAH66KwbDOYupRsHZXaKhLnENKM3p8Ot3R4dcv75xAXFnUmsrn1\nUnSpYGhG3QmUn0OlhS8GR7Jj\n-----END PRIVATE KEY-----\n",
  "client_email": "backflow-drive-uploader@backflow-reports-467621.iam.gserviceaccount.com",
  "client_id": "101768063531205664883",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/backflow-drive-uploader%40backflow-reports-467621.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

// Google Drive folder IDs
const FOLDER_IDS = {
  DRAFT: '1HF9vdmHZxg4DOr6c2fhOYTViAgvXxz9n',
  COMPLETED: '1SjlgRd0Nq-A3pGH-LrRnwLHUGTWq5LjO'
};

class GoogleDriveService {
  constructor() {
    this.drive = null;
    this.initialized = false;
  }

  /**
   * Initialize Google Drive with Service Account
   */
  async initialize() {
    try {
      console.log('🔐 Initializing Google Drive service with Service Account...');
      
      // Create service account authentication
      const auth = new google.auth.GoogleAuth({
        credentials: GOOGLE_CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/drive.file']
      });

      // Get authenticated client
      const authClient = await auth.getClient();
      
      this.drive = google.drive({ version: 'v3', auth: authClient });
      this.initialized = true;
      
      console.log('✅ Google Drive service initialized with Service Account');
      console.log(`📧 Service Account: ${GOOGLE_CREDENTIALS.client_email}`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive:', error);
      this.initialized = false;
      return false;
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

      // Generate filled PDF
      const filledPdfBuffer = await this.generateFilledPDF(originalPdfBuffer, formFields);
      
      // Save to Google Drive draft folder
      const result = await this.uploadToFolder(filledPdfBuffer, jobId, fileName, FOLDER_IDS.DRAFT);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to save PDF as draft:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate filled PDF from original PDF and form fields
   */
  async generateFilledPDF(originalPdfBuffer, formFields) {
    try {
      // Load the original PDF
      const pdfDoc = await PDFDocument.load(originalPdfBuffer);
      const pages = pdfDoc.getPages();

      // Group fields by page
      const fieldsByPage = {};
      formFields.forEach(field => {
        const pageNum = field.page || 1;
        if (!fieldsByPage[pageNum]) {
          fieldsByPage[pageNum] = [];
        }
        fieldsByPage[pageNum].push(field);
      });

      // Draw fields on each page
      for (const pageNum of Object.keys(fieldsByPage)) {
        const page = pages[parseInt(pageNum) - 1];
        if (!page) continue;

        const { width, height } = page.getSize();
        
        for (const field of fieldsByPage[pageNum]) {
          await this.drawFieldOnPage(page, field, height, pdfDoc);
        }
      }

      // Return the PDF as buffer
      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);
      
    } catch (error) {
      console.error('❌ Failed to generate filled PDF:', error);
      throw error;
    }
  }

  /**
   * Draw a field on a PDF page
   */
  async drawFieldOnPage(page, field, pageHeight, pdfDoc) {
    try {
      const { x, y, width, height, content, type, fontSize = 11, color = '#1e3a8a' } = field;
      
      // Convert coordinates (PDF coordinates start from bottom-left)
      const pdfY = pageHeight - y - height;
      
      if (type === 'text' && content) {
        page.drawText(content.toString(), {
          x: x,
          y: pdfY + height - fontSize, // Adjust y position for text baseline
          size: fontSize,
          color: this.hexToRgb(color)
        });
      } else if (type === 'date' && content) {
        page.drawText(content.toString(), {
          x: x,
          y: pdfY + height - fontSize,
          size: fontSize,
          color: this.hexToRgb(color)
        });
      } else if (type === 'timestamp' && content) {
        page.drawText(content.toString(), {
          x: x,
          y: pdfY + height - fontSize,
          size: fontSize,
          color: this.hexToRgb(color)
        });
      } else if (type === 'checkbox' && content) {
        page.drawText('✓', {
          x: x + 2,
          y: pdfY + 2,
          size: Math.min(fontSize * 1.5, height - 4),
          color: this.hexToRgb(color)
        });
      } else if (type === 'signature' && content) {
        if (content.startsWith('data:image')) {
          try {
            // Extract image data from data URL
            const base64Data = content.split(',')[1];
            const imageBytes = Buffer.from(base64Data, 'base64');
            
            // Determine image type from data URL
            let image;
            if (content.startsWith('data:image/png')) {
              image = await pdfDoc.embedPng(imageBytes);
            } else if (content.startsWith('data:image/jpeg') || content.startsWith('data:image/jpg')) {
              image = await pdfDoc.embedJpg(imageBytes);
            } else {
              // Fallback to text if unsupported image format
              page.drawText('[Signature]', {
                x: x,
                y: pdfY + height - fontSize,
                size: fontSize,
                color: this.hexToRgb(color)
              });
              return;
            }
            
            // Draw the signature image
            page.drawImage(image, {
              x: x,
              y: pdfY,
              width: width,
              height: height
            });
            
          } catch (imageError) {
            console.error('❌ Failed to embed signature image:', imageError);
            // Fallback to text
            page.drawText('[Signature]', {
              x: x,
              y: pdfY + height - fontSize,
              size: fontSize,
              color: this.hexToRgb(color)
            });
          }
        } else {
          // Text signature
          page.drawText(content.toString(), {
            x: x,
            y: pdfY + height - fontSize,
            size: fontSize,
            color: this.hexToRgb(color)
          });
        }
      }
    } catch (error) {
      console.error('❌ Failed to draw field on page:', error);
    }
  }

  /**
   * Convert hex color to RGB for pdf-lib
   */
  hexToRgb(hex) {
    const { rgb } = require('pdf-lib');
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
   * Upload PDF to specified Google Drive folder
   */
  async uploadToFolder(pdfBuffer, jobId, fileName, folderId) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      const fileMetadata = {
        name: `${jobId} - ${fileName}`,
        parents: [folderId]
      };

      const { Readable } = require('stream');
      const media = {
        mimeType: 'application/pdf',
        body: Readable.from(pdfBuffer)
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, createdTime, size'
      });

      console.log('✅ PDF uploaded to Google Drive:', response.data);
      return {
        success: true,
        fileId: response.data.id,
        fileName: response.data.name,
        createdTime: response.data.createdTime,
        size: response.data.size
      };

    } catch (error) {
      console.error('❌ Failed to upload to Google Drive:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search for files by Job ID
   */
  async searchFilesByJobId(jobId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const [draftFiles, completedFiles] = await Promise.all([
        this.searchInFolder(jobId, FOLDER_IDS.DRAFT),
        this.searchInFolder(jobId, FOLDER_IDS.COMPLETED)
      ]);

      return {
        success: true,
        drafts: draftFiles,
        completed: completedFiles
      };
    } catch (error) {
      console.error('❌ Failed to search files:', error);
      return {
        success: false,
        error: error.message,
        drafts: [],
        completed: []
      };
    }
  }

  /**
   * Search in specific folder
   */
  async searchInFolder(jobId, folderId) {
    try {
      const query = `'${folderId}' in parents and name contains '${jobId}' and trashed = false`;
      
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, createdTime, modifiedTime, size)',
        orderBy: 'modifiedTime desc'
      });

      return response.data.files || [];
    } catch (error) {
      console.error('❌ Failed to search folder:', error);
      return [];
    }
  }

  /**
   * Move draft to completed folder
   */
  async promoteToCompleted(draftFileId) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      await this.drive.files.update({
        fileId: draftFileId,
        addParents: FOLDER_IDS.COMPLETED,
        removeParents: FOLDER_IDS.DRAFT,
        fields: 'id, parents'
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Failed to promote to completed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new GoogleDriveService();