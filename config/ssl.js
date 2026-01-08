// SSL Configuration for production
// Add this at the top of app.js to enable HTTPS

const fs = require('fs');
const https = require('https');

// SSL Certificate paths
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || './ssl/private.key';
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || './ssl/certificate.crt';
const SSL_CA_PATH = process.env.SSL_CA_PATH || './ssl/ca_bundle.crt'; // Optional

// Check if SSL certificates exist
function hasSSLCertificates() {
  try {
    return fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH);
  } catch (error) {
    return false;
  }
}

// Create HTTPS server if certificates are available
function createSecureServer(app) {
  if (!hasSSLCertificates()) {
    console.log('⚠️ SSL certificates not found. Running in HTTP mode.');
    console.log(`   Expected key: ${SSL_KEY_PATH}`);
    console.log(`   Expected cert: ${SSL_CERT_PATH}`);
    return null;
  }

  try {
    const sslOptions = {
      key: fs.readFileSync(SSL_KEY_PATH),
      cert: fs.readFileSync(SSL_CERT_PATH)
    };

    // Add CA bundle if it exists (for some SSL providers)
    if (fs.existsSync(SSL_CA_PATH)) {
      sslOptions.ca = fs.readFileSync(SSL_CA_PATH);
    }

    const httpsServer = https.createServer(sslOptions, app);
    console.log('✅ HTTPS server created with SSL certificates');
    return httpsServer;
  } catch (error) {
    console.error('❌ Failed to create HTTPS server:', error.message);
    return null;
  }
}

module.exports = { createSecureServer, hasSSLCertificates };
