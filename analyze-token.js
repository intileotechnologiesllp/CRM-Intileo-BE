// Load environment variables first
require('dotenv').config();

const jwt = require('jsonwebtoken');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NzIsImVtYWlsIjoibXJpZHVsLmt1bWFyQGludGlsZW8uY29tIiwibG9naW5UeXBlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOjE0ODYsImlhdCI6MTc2NjU2OTM2OCwiZXhwIjoxNzY5MTYxMzY4fQ.dyDpCiSPKfAnfh3GN017h677bKMTGlicyvIzZqy0n9E';

console.log('🔍 Analyzing JWT token...');
console.log('JWT_SECRET available:', !!process.env.JWT_SECRET);

try {
    // Decode without verification first
    const decoded = jwt.decode(token);
    console.log('✅ Token decoded successfully:');
    console.log('   User ID:', decoded.id);
    console.log('   Email:', decoded.email);
    console.log('   Login Type:', decoded.loginType);
    console.log('   Session ID:', decoded.sessionId);
    console.log('   Issued At:', new Date(decoded.iat * 1000));
    console.log('   Expires At:', new Date(decoded.exp * 1000));
    console.log('   Is Expired:', Date.now() > decoded.exp * 1000);
    
    // Try to verify with JWT_SECRET
    if (process.env.JWT_SECRET) {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        console.log('✅ Token verification: SUCCESS');
    } else {
        console.log('❌ Cannot verify - JWT_SECRET not available');
    }
    
} catch (error) {
    console.error('❌ Token analysis failed:', error.message);
}

console.log('\n🔍 Route endpoint analysis:');
console.log('Expected URL: http://213.136.77.55:4001/api/auth/2fa/setup');
console.log('Token should set req.adminId =', jwt.decode(token)?.id);