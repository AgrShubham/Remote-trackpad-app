/**
 * Authentication Configuration for Remote Mouse Pro.
 * 
 * To enable real Google Sign-In with your own Google Cloud project:
 * 1. Go to Google Cloud Console (https://console.cloud.google.com/) or Firebase.
 * 2. Create an OAuth 2.0 Web Client ID.
 * 3. Paste the client ID string below into GOOGLE_WEB_CLIENT_ID.
 * 
 * When GOOGLE_WEB_CLIENT_ID is empty or null, the app operates in
 * Zero-Credential Offline-First mode, seamlessly simulating Google authentication
 * and storing profile & preferences locally in AsyncStorage so you can develop
 * and test without any credentials or network requirements.
 */

export const AUTH_CONFIG = {
  // Paste your Web Client ID here when ready:
  GOOGLE_WEB_CLIENT_ID: '',

  // Helper flag indicating whether custom Google credentials have been configured
  get isConfigured(): boolean {
    return (
      typeof this.GOOGLE_WEB_CLIENT_ID === 'string' &&
      this.GOOGLE_WEB_CLIENT_ID.trim().length > 0 &&
      !this.GOOGLE_WEB_CLIENT_ID.includes('YOUR_')
    );
  },
};

