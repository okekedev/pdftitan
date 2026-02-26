// tests/auth/google-drive.test.js - Validates Google Drive service account auth and folder access
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { google } = require('googleapis');

let auth;
let drive;

beforeAll(() => {
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  auth = new google.auth.JWT({
    email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  drive = google.drive({ version: 'v3', auth });
});

describe('Google Drive Authentication', () => {
  test('service account can obtain an access token', async () => {
    const tokenInfo = await auth.authorize();
    expect(tokenInfo.access_token).toBeDefined();
    expect(tokenInfo.access_token.length).toBeGreaterThan(0);
  }, 15000);
});

describe('Google Drive Folder Access', () => {
  test('draft folder exists and is accessible', async () => {
    const response = await drive.files.get({
      fileId: process.env.GOOGLE_DRIVE_DRAFT_FOLDER_ID,
      fields: 'id, name, mimeType',
      supportsAllDrives: true,
    });

    expect(response.data.id).toBe(process.env.GOOGLE_DRIVE_DRAFT_FOLDER_ID);
    expect(response.data.mimeType).toBe('application/vnd.google-apps.folder');
  }, 15000);

  test('completed folder exists and is accessible', async () => {
    const response = await drive.files.get({
      fileId: process.env.GOOGLE_DRIVE_COMPLETED_FOLDER_ID,
      fields: 'id, name, mimeType',
      supportsAllDrives: true,
    });

    expect(response.data.id).toBe(process.env.GOOGLE_DRIVE_COMPLETED_FOLDER_ID);
    expect(response.data.mimeType).toBe('application/vnd.google-apps.folder');
  }, 15000);

  test('can list files inside the draft folder', async () => {
    const response = await drive.files.list({
      q: `'${process.env.GOOGLE_DRIVE_DRAFT_FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
      pageSize: 5,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    expect(response.data.files).toBeDefined();
    expect(Array.isArray(response.data.files)).toBe(true);
  }, 15000);
});
