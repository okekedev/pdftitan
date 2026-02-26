// tests/auth/servicetitan.test.js - Validates ServiceTitan OAuth2 and API access
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

let accessToken;

describe('ServiceTitan OAuth2', () => {
  test('returns a valid Bearer token with client credentials', async () => {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', process.env.REACT_APP_SERVICETITAN_CLIENT_ID);
    params.append('client_secret', process.env.REACT_APP_SERVICETITAN_CLIENT_SECRET);

    const response = await fetch(
      `${process.env.REACT_APP_SERVICETITAN_AUTH_URL}/connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      }
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.access_token).toBeDefined();
    expect(data.token_type).toBe('Bearer');
    expect(data.expires_in).toBeGreaterThan(0);

    // Store token for the API tests below
    accessToken = data.access_token;
  }, 15000);
});

describe('ServiceTitan API Access', () => {
  beforeAll(async () => {
    // Get a fresh token if not already set
    if (!accessToken) {
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', process.env.REACT_APP_SERVICETITAN_CLIENT_ID);
      params.append('client_secret', process.env.REACT_APP_SERVICETITAN_CLIENT_SECRET);

      const response = await fetch(
        `${process.env.REACT_APP_SERVICETITAN_AUTH_URL}/connect/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        }
      );
      const data = await response.json();
      accessToken = data.access_token;
    }

  }, 15000);

  test('can reach technicians endpoint for the tenant', async () => {
    const response = await fetch(
      `${process.env.REACT_APP_SERVICETITAN_API_BASE_URL}/settings/v2/tenant/${process.env.REACT_APP_SERVICETITAN_TENANT_ID}/technicians?page=1&pageSize=1`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'ST-App-Key': process.env.REACT_APP_SERVICETITAN_APP_KEY,
        },
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
  }, 20000);

  test('can reach jobs endpoint for the tenant', async () => {
    const response = await fetch(
      `${process.env.REACT_APP_SERVICETITAN_API_BASE_URL}/jpm/v2/tenant/${process.env.REACT_APP_SERVICETITAN_TENANT_ID}/jobs?page=1&pageSize=1`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'ST-App-Key': process.env.REACT_APP_SERVICETITAN_APP_KEY,
        },
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
  }, 20000);
});
