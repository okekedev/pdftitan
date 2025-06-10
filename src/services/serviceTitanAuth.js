import { serviceTitanConfig } from '../config/serviceTitanConfig';

// ServiceTitan OAuth 2.0 Authentication Service (with Proxy Support)
class ServiceTitanAuth {
  constructor() {
    this.config = serviceTitanConfig;
    this.accessToken = null;
    this.tokenExpiry = null;
    
    // Validate configuration on initialization
    if (!this.config.isConfigured()) {
      const missing = this.config.getMissingConfig();
      console.error('❌ ServiceTitan auth configuration missing:', missing);
      throw new Error(`Missing ServiceTitan configuration: ${missing.join(', ')}`);
    }
    
    console.log('✅ ServiceTitan Auth initialized for', 
      this.config.isIntegrationEnvironment ? 'Integration Environment' : 'Production Environment'
    );
  }

  // OAuth 2.0 Client Credentials Grant authentication via proxy
  async authenticate() {
    try {
      console.log('🔐 Starting OAuth 2.0 authentication via proxy...');
      
      // Use proxy server in development
      const authUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3005/api/servicetitan/auth'
        : this.config.authUrl; // Direct call in production
      
      console.log('📡 Auth URL:', authUrl);
      
      let response;
      
      if (process.env.NODE_ENV === 'development') {
        // Use proxy server (credentials handled by proxy)
        console.log('🌐 Using proxy server for authentication');
        response = await fetch(authUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}) // Proxy handles OAuth credentials
        });
      } else {
        // Direct call to ServiceTitan (production)
        console.log('🔗 Direct authentication to ServiceTitan');
        const formData = new URLSearchParams();
        formData.append('grant_type', 'client_credentials');
        formData.append('client_id', this.config.clientId);
        formData.append('client_secret', this.config.clientSecret);

        response = await fetch(this.config.authUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: formData
        });
      }

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Authentication failed:', errorData);
        throw new Error(errorData.error || `Authentication failed: ${response.status}`);
      }

      const tokenData = await response.json();
      console.log('✅ Token received:', {
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        scope: tokenData.scope,
        access_token_preview: tokenData.access_token ? tokenData.access_token.substring(0, 20) + '...' : 'MISSING'
      });

      if (!tokenData.access_token) {
        throw new Error('No access token received from ServiceTitan');
      }

      // Store token and expiry
      this.accessToken = tokenData.access_token;
      const expiresIn = tokenData.expires_in || 900; // Default 15 minutes
      this.tokenExpiry = Date.now() + (expiresIn * 1000);
      
      console.log('✅ ServiceTitan OAuth 2.0 authentication successful via proxy!');
      console.log('⏰ Token expires in:', expiresIn, 'seconds');
      
      return {
        success: true,
        accessToken: this.accessToken,
        expiresIn: expiresIn,
        tokenType: tokenData.token_type,
        environment: this.config.isIntegrationEnvironment ? 'Integration' : 'Production',
        viaProxy: process.env.NODE_ENV === 'development'
      };

    } catch (error) {
      console.error('❌ OAuth authentication failed:', error);
      
      // Reset token state on failure
      this.accessToken = null;
      this.tokenExpiry = null;
      
      // Check for proxy connection issues
      if (error.message.includes('Failed to fetch') && process.env.NODE_ENV === 'development') {
        return {
          success: false,
          error: 'Cannot connect to proxy server - Is it running on localhost:3005?',
          errorType: 'PROXY_CONNECTION_ERROR',
          suggestions: [
            'Check proxy server is running: npm run proxy',
            'Verify proxy server URL: http://localhost:3005/health',
            'Check firewall/antivirus blocking localhost connections'
          ]
        };
      }
      
      if (error.message.includes('401') || error.message.includes('invalid_client')) {
        return {
          success: false,
          error: 'Invalid credentials - Check Client ID and Secret in .env file',
          errorType: 'INVALID_CREDENTIALS'
        };
      }
      
      return {
        success: false,
        error: error.message,
        errorType: 'UNKNOWN_ERROR'
      };
    }
  }

  // Get a valid access token (refresh if needed)
  async getValidAccessToken() {
    // If we have a valid token, return it
    if (this.isAuthenticated()) {
      return this.accessToken;
    }
    
    // Otherwise, authenticate and get a new token
    const authResult = await this.authenticate();
    if (authResult.success) {
      return authResult.accessToken;
    }
    
    throw new Error(authResult.error || 'Failed to get access token');
  }

  // Check if we have a valid token
  isAuthenticated() {
    return this.accessToken && this.tokenExpiry && Date.now() < (this.tokenExpiry - 30000); // 30 second buffer
  }

  // Get current token (if authenticated)
  getAccessToken() {
    if (this.isAuthenticated()) {
      return this.accessToken;
    }
    return null;
  }

  // Clear authentication
  logout() {
    console.log('🚪 Clearing ServiceTitan authentication');
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Get authentication status info
  getAuthStatus() {
    if (this.isAuthenticated()) {
      const timeLeft = Math.round((this.tokenExpiry - Date.now()) / 1000);
      return {
        authenticated: true,
        expiresIn: timeLeft,
        tokenPreview: this.accessToken.substring(0, 20) + '...',
        environment: this.config.isIntegrationEnvironment ? 'Integration' : 'Production',
        viaProxy: process.env.NODE_ENV === 'development'
      };
    }
    
    return {
      authenticated: false,
      expiresIn: 0,
      tokenPreview: null,
      environment: this.config.isIntegrationEnvironment ? 'Integration' : 'Production',
      viaProxy: process.env.NODE_ENV === 'development'
    };
  }

  // Get auth headers for API requests
  getAuthHeaders() {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated - call authenticate() first');
    }
    
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'ST-App-Key': this.config.appKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }
}

// Create and export singleton instance
const serviceTitanAuth = new ServiceTitanAuth();
export default serviceTitanAuth;