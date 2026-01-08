# 🔒 SSL/HTTPS Setup Guide for Iframe Embedding

## Problem
When embedding an HTTP iframe in an HTTPS website, browsers block it due to "Mixed Content" security policy.

**Example:**
- Website: `https://yourdomain.com` ✅ (Secure)
- Iframe: `http://213.136.77.55:4002/embed-form/...` ❌ (Not secure)
- Result: Browser blocks the iframe

---

## Solutions

### ✅ Solution 1: Add SSL to Your Backend (RECOMMENDED)

You need to enable HTTPS on your Node.js server at `213.136.77.55:4002`

#### Step 1: Get SSL Certificate

**Option A - Free SSL (Let's Encrypt):**
```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot

# Get SSL certificate for your domain
sudo certbot certonly --standalone -d api.yourdomain.com

# Certificates will be saved in:
# /etc/letsencrypt/live/api.yourdomain.com/privkey.pem
# /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem
```

**Option B - Paid SSL (Namecheap, GoDaddy, etc.):**
1. Purchase SSL certificate
2. Download the certificate files (.key, .crt, .ca-bundle)

#### Step 2: Add SSL Files to Your Project

Create an `ssl` folder in your project:
```bash
mkdir ssl
```

Copy your SSL files:
```
ssl/
  ├── private.key         # Your private key
  ├── certificate.crt     # Your certificate
  └── ca_bundle.crt       # CA bundle (optional)
```

#### Step 3: Update .env File

Add these to your `.env` file:
```env
# SSL Configuration
SSL_ENABLED=true
SSL_KEY_PATH=./ssl/private.key
SSL_CERT_PATH=./ssl/certificate.crt
SSL_CA_PATH=./ssl/ca_bundle.crt
HTTPS_PORT=443
```

#### Step 4: Modify app.js

Replace the server creation section in `app.js` (around line 330-350):

```javascript
// Add at the top of app.js
const { createSecureServer } = require('./config/ssl');

// Replace the existing server.listen section with:
const PORT = process.env.PORT || 3056;
const HTTPS_PORT = process.env.HTTPS_PORT || 443;
const SSL_ENABLED = process.env.SSL_ENABLED === 'true';

if (SSL_ENABLED) {
  // Create HTTPS server
  const httpsServer = createSecureServer(app);
  
  if (httpsServer) {
    // Initialize Socket.IO with HTTPS server
    initializeSocket(httpsServer);
    
    httpsServer.listen(HTTPS_PORT, () => {
      console.log(`🔒 HTTPS Server running on port ${HTTPS_PORT}`);
      console.log(`🌐 Secure URL: https://213.136.77.55`);
      // ... rest of console logs
    });
    
    // Also run HTTP server for redirect (optional)
    const http = require('http');
    const httpApp = express();
    httpApp.get('*', (req, res) => {
      res.redirect(`https://${req.headers.host}${req.url}`);
    });
    httpApp.listen(80, () => {
      console.log('📌 HTTP->HTTPS redirect active on port 80');
    });
  } else {
    // Fallback to HTTP
    server.listen(PORT, () => {
      console.log(`⚠️ Server running on HTTP port ${PORT} (SSL failed)`);
    });
  }
} else {
  // Regular HTTP server (current setup)
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    // ... rest of your existing code
  });
}
```

#### Step 5: Test

```bash
# Restart your server
npm start

# Test HTTPS URL
curl https://213.136.77.55:443/embed-form/a458ae656f5538e2ca06d43e082e107a
```

Your iframe URL will now be:
```html
<iframe src="https://213.136.77.55/embed-form/a458ae656f5538e2ca06d43e082e107a/render"></iframe>
```

---

### 🔄 Solution 2: Use Reverse Proxy (Nginx/Apache)

If you can't modify Node.js directly, use Nginx as SSL terminator:

```nginx
# /etc/nginx/sites-available/crm-api
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:4001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then use:
```html
<iframe src="https://api.yourdomain.com/embed-form/..."></iframe>
```

---

### ☁️ Solution 3: Use Cloudflare (Easiest)

1. Add your domain to Cloudflare (free)
2. Point your domain to `213.136.77.55`
3. Enable Cloudflare's SSL (Free)
4. Use: `https://api.yourdomain.com/embed-form/...`

Cloudflare handles all SSL automatically!

---

### 🚫 Solution 4: Iframe Proxy (Not Recommended)

Create a proxy endpoint on your HTTPS website that fetches from HTTP:

```javascript
// On your HTTPS website backend
app.get('/proxy/form/:key', async (req, res) => {
  const response = await fetch(`http://213.136.77.55:4002/embed-form/${req.params.key}`);
  const html = await response.text();
  res.send(html);
});
```

Then use:
```html
<iframe src="https://yourdomain.com/proxy/form/a458ae656f5538e2ca06d43e082e107a"></iframe>
```

⚠️ This is not recommended as it defeats the purpose of iframe isolation.

---

## Testing After SSL Setup

1. **Check certificate:**
   ```bash
   openssl s_client -connect 213.136.77.55:443 -servername api.yourdomain.com
   ```

2. **Test in browser:**
   ```
   https://213.136.77.55/embed-form/a458ae656f5538e2ca06d43e082e107a/render
   ```

3. **Embed in your HTTPS website:**
   ```html
   <iframe src="https://213.136.77.55/embed-form/a458ae656f5538e2ca06d43e082e107a/render" 
           width="600" 
           height="800">
   </iframe>
   ```

---

## Quick Fix for Development/Testing

If you just want to test locally without SSL:

1. Open your website in Chrome
2. Click the lock icon in address bar
3. Go to "Site settings"
4. Find "Insecure content"
5. Set to "Allow"

⚠️ This is ONLY for testing - users won't do this!

---

## Recommended Approach

**Best Solution:** Solution 1 (Add SSL to backend) or Solution 3 (Cloudflare)

**Why?**
- ✅ Most secure
- ✅ Best performance
- ✅ Works for all users
- ✅ No browser warnings

**Next Steps:**
1. Get a domain name (if you don't have one)
2. Point it to `213.136.77.55`
3. Use Cloudflare for free SSL
4. Update iframe URL to `https://api.yourdomain.com/embed-form/...`

Need help with any of these solutions? Let me know which one you want to implement!
