console.log('🧪 Testing minimal 2FA endpoint...');

const express = require('express');
const app = express();

// Basic middleware
app.use(express.json());

// Test route that logs everything
app.post('/api/auth/2fa/setup', (req, res) => {
    console.log('🎯 MINIMAL ROUTE HIT! This should appear in logs');
    console.log('📍 Method:', req.method);
    console.log('📍 Path:', req.path);
    console.log('📍 Headers:', req.headers);
    
    res.json({
        message: 'Minimal route working',
        timestamp: new Date().toISOString()
    });
});

const port = 4002;
app.listen(port, () => {
    console.log(`🚀 Minimal test server running on port ${port}`);
    console.log('📍 Test URL: http://localhost:4002/api/auth/2fa/setup');
});