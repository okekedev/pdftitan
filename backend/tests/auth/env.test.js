// tests/auth/env.test.js - Validates all required environment variables are present and valid
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const REQUIRED_VARS = [
  'REACT_APP_SERVICETITAN_CLIENT_ID',
  'REACT_APP_SERVICETITAN_CLIENT_SECRET',
  'REACT_APP_SERVICETITAN_TENANT_ID',
  'REACT_APP_SERVICETITAN_APP_KEY',
  'REACT_APP_SERVICETITAN_API_BASE_URL',
  'REACT_APP_SERVICETITAN_AUTH_URL',
  'GOOGLE_DRIVE_CLIENT_EMAIL',
  'GOOGLE_DRIVE_CLIENT_ID',
  'GOOGLE_DRIVE_PROJECT_ID',
  'GOOGLE_DRIVE_PRIVATE_KEY_ID',
  'GOOGLE_DRIVE_PRIVATE_KEY',
  'GOOGLE_DRIVE_DRAFT_FOLDER_ID',
  'GOOGLE_DRIVE_COMPLETED_FOLDER_ID',
];

describe('Environment Variables', () => {
  test.each(REQUIRED_VARS)('%s is set and not empty', (varName) => {
    expect(process.env[varName]).toBeDefined();
    expect(process.env[varName].trim()).not.toBe('');
  });

  test('ServiceTitan API URL points to servicetitan.io', () => {
    expect(process.env.REACT_APP_SERVICETITAN_API_BASE_URL).toContain('servicetitan.io');
  });

  test('ServiceTitan Auth URL points to servicetitan.io', () => {
    expect(process.env.REACT_APP_SERVICETITAN_AUTH_URL).toContain('servicetitan.io');
  });

  test('ServiceTitan Tenant ID is numeric', () => {
    expect(process.env.REACT_APP_SERVICETITAN_TENANT_ID).toMatch(/^\d+$/);
  });

  test('ServiceTitan Client ID has correct format (cid.*)', () => {
    expect(process.env.REACT_APP_SERVICETITAN_CLIENT_ID).toMatch(/^cid\./);
  });

  test('ServiceTitan Client Secret has correct format (cs2.*)', () => {
    expect(process.env.REACT_APP_SERVICETITAN_CLIENT_SECRET).toMatch(/^cs2\./);
  });

  test('Google Drive private key is valid PEM format', () => {
    const key = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
    expect(key).toContain('BEGIN PRIVATE KEY');
    expect(key).toContain('END PRIVATE KEY');
  });

  test('Google Drive client email is a service account', () => {
    expect(process.env.GOOGLE_DRIVE_CLIENT_EMAIL).toContain('iam.gserviceaccount.com');
  });
});
