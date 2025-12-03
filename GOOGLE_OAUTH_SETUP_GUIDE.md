# Google OAuth Login Setup Guide

## Overview
This guide will help you integrate Google OAuth authentication into your CRM login page.

## Features Implemented
- ✅ Google OAuth login alongside traditional email/password login
- ✅ Automatic user creation for new Google users
- ✅ Login history tracking for Google OAuth users
- ✅ JWT token generation
- ✅ Audit trail logging
- ✅ Beautiful login UI with Google button

## Setup Steps

### 1. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - For development: `http://localhost:3000/api/auth/google/callback`
     - For production: `https://yourdomain.com/api/auth/google/callback`
   - Click "Create"
5. Copy your Client ID and Client Secret

### 2. Configure Environment Variables

Create or update your `.env` file with:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_actual_client_id_here
GOOGLE_CLIENT_SECRET=your_actual_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# JWT Secret (if not already set)
JWT_SECRET=your_secure_jwt_secret_here
```

**Important:** 
- Replace `your_actual_client_id_here` with your Google Client ID
- Replace `your_actual_client_secret_here` with your Google Client Secret
- For production, use your production domain in GOOGLE_REDIRECT_URI

### 3. API Endpoints

The following endpoints have been added:

#### Get Google OAuth URL
```
GET /api/auth/google/login
```

Response:
```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

#### Handle Google OAuth Callback
```
POST /api/auth/google/callback
```

Request Body:
```json
{
  "code": "authorization_code_from_google",
  "systemInfo": {
    "approximateLocation": "New York, USA"
  },
  "device": "User agent string",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "ipAddress": "192.168.1.1"
}
```

Response:
```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "masterUserID": 123,
    "name": "John Doe",
    "email": "john@example.com",
    "loginType": "google"
  }
}
```

### 4. Frontend Integration

#### Option A: Use the Provided HTML Page

1. The file `public/login-google-oauth.html` is ready to use
2. Update the `API_BASE_URL` constant in the JavaScript section:
   ```javascript
   const API_BASE_URL = 'http://localhost:3000/api/auth'; // Change to your API URL
   ```
3. Update the redirect URLs in the success handlers:
   ```javascript
   window.location.href = '/dashboard.html'; // Change to your actual dashboard URL
   ```
4. Access the login page at: `http://localhost:3000/login-google-oauth.html`

#### Option B: Integrate into Your Existing Login Page

Add this JavaScript code to your existing login page:

```javascript
// Get Google OAuth URL and redirect
async function loginWithGoogle() {
    try {
        const response = await fetch('http://localhost:3000/api/auth/google/login');
        const data = await response.json();
        
        if (data.success && data.authUrl) {
            localStorage.setItem('googleOAuthPending', 'true');
            window.location.href = data.authUrl;
        }
    } catch (error) {
        console.error('Google login error:', error);
    }
}

// Handle OAuth callback
window.addEventListener('load', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const googleOAuthPending = localStorage.getItem('googleOAuthPending');

    if (code && googleOAuthPending) {
        localStorage.removeItem('googleOAuthPending');
        
        try {
            const response = await fetch('http://localhost:3000/api/auth/google/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: code,
                    systemInfo: { approximateLocation: 'Unknown' },
                    device: navigator.userAgent
                })
            });

            const data = await response.json();

            if (response.ok && data.token) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = '/dashboard.html';
            }
        } catch (error) {
            console.error('Google callback error:', error);
        }
    }
});
```

Add a Google login button to your HTML:
```html
<button onclick="loginWithGoogle()">
    <img src="google-icon.svg" alt="Google"> Login with Google
</button>
```

### 5. How It Works

#### Login Flow:

1. **User clicks "Login with Google" button**
   - Frontend calls `GET /api/auth/google/login`
   - Backend generates Google OAuth URL
   - User is redirected to Google's login page

2. **User authenticates with Google**
   - User logs in to their Google account
   - Google asks for permission to share email and profile
   - User grants permission

3. **Google redirects back with authorization code**
   - Google redirects to: `http://localhost:3000/api/auth/google/callback?code=xxx`
   - Frontend detects the `code` parameter
   - Frontend sends code to backend via `POST /api/auth/google/callback`

4. **Backend processes authentication**
   - Exchanges code for Google access token
   - Retrieves user profile from Google
   - Checks if user exists in database:
     - If exists: Log them in
     - If new: Create account automatically
   - Generates JWT token
   - Creates login history entry
   - Returns token and user data

5. **Frontend receives token**
   - Stores token in localStorage
   - Redirects to dashboard

### 6. Database Considerations

The Google OAuth implementation:
- ✅ Works with existing `MasterUser` table
- ✅ Sets `loginType` to 'google' for OAuth users
- ✅ Creates random password for security (user can't use traditional login)
- ✅ Records all logins in `LoginHistory` table
- ✅ Updates `RecentLoginHistory` table
- ✅ Logs events in audit trail

### 7. Security Features

- ✅ JWT token with 24-hour expiration
- ✅ Secure random password for OAuth users
- ✅ Audit trail logging for all authentication events
- ✅ Login history tracking
- ✅ Device and location tracking
- ✅ Inactive user detection

### 8. Testing

1. **Start your server:**
   ```bash
   npm start
   ```

2. **Test the endpoints:**
   
   Get OAuth URL:
   ```bash
   curl http://localhost:3000/api/auth/google/login
   ```

3. **Test the UI:**
   - Open `http://localhost:3000/login-google-oauth.html`
   - Click "Google" button
   - Complete Google authentication
   - Verify you're logged in

### 9. Production Deployment

Before deploying to production:

1. ✅ Update `GOOGLE_REDIRECT_URI` in `.env` with production domain
2. ✅ Add production domain to Google Cloud Console authorized redirect URIs
3. ✅ Update `API_BASE_URL` in frontend code
4. ✅ Enable HTTPS (required by Google OAuth)
5. ✅ Set secure JWT_SECRET
6. ✅ Test the complete flow in production

### 10. Customization

You can customize:

- **User creation logic:** Modify `googleAuthCallback` to add custom fields
- **Login UI:** Edit `public/login-google-oauth.html` styling
- **Redirect URLs:** Change dashboard redirect locations
- **Token expiration:** Modify JWT expiration time
- **Additional OAuth providers:** Follow similar pattern for Facebook, Microsoft, etc.

### 11. Troubleshooting

**Error: "redirect_uri_mismatch"**
- Ensure GOOGLE_REDIRECT_URI matches exactly in Google Console and .env file
- Check for trailing slashes
- Verify protocol (http vs https)

**Error: "invalid_client"**
- Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are correct
- Verify credentials are for the same project

**User not created automatically**
- Check database connection
- Verify MasterUser model has all required fields
- Check server logs for errors

**Token not stored**
- Check localStorage in browser developer tools
- Verify frontend API_BASE_URL is correct
- Check CORS settings if frontend is on different domain

### 12. Support

For issues or questions:
1. Check server logs for error messages
2. Check browser console for frontend errors
3. Verify all environment variables are set correctly
4. Test API endpoints directly with Postman/curl

## Summary

You now have a complete Google OAuth login system integrated with your CRM! Users can:
- ✅ Login with email/password (existing functionality)
- ✅ Login with Google account (new functionality)
- ✅ Have their login history tracked
- ✅ Be automatically registered on first Google login
