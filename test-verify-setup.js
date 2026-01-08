const https = require('https');
const http = require('http');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NzIsImVtYWlsIjoibXJpZHVsLmt1bWFyQGludGlsZW8uY29tIiwibG9naW5UeXBlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOjE0ODYsImlhdCI6MTc2NjU2OTM2OCwiZXhwIjoxNzY5MTYxMzY4fQ.dyDpCiSPKfAnfh3GN017h677bKMTGlicyvIzZqy0n9E';

// Test with a sample 6-digit code (you should replace this with actual code from your authenticator app)
const testCode = '123456'; // Replace with actual code from your authenticator app

const postData = JSON.stringify({
    token: testCode
});

const options = {
    hostname: '213.136.77.55',
    port: 4001,
    path: '/api/auth/2fa/verify-setup',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': postData.length
    }
};

function testVerifySetupEndpoint() {
    console.log('🧪 Testing 2FA Verify-Setup API Endpoint...');
    console.log('📍 URL: http://213.136.77.55:4001/api/auth/2fa/verify-setup');
    console.log('🔑 Token: ' + token.substring(0, 50) + '...');
    console.log('🔢 Test Code: ' + testCode);
    console.log('⚠️  NOTE: Replace testCode with actual code from authenticator app for real test');
    
    const req = http.request(options, (res) => {
        console.log('📊 Status Code:', res.statusCode);
        console.log('📋 Headers:', res.headers);
        
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            console.log('\n📥 Response Body:');
            try {
                const response = JSON.parse(data);
                console.log(JSON.stringify(response, null, 2));
                
                if (res.statusCode === 200) {
                    console.log('\n✅ SUCCESS: 2FA verify-setup working!');
                } else {
                    console.log('\n❌ ERROR RESPONSE:');
                    console.log('   Status:', res.statusCode);
                    console.log('   Message:', response.message || response.error);
                    
                    // Common error analysis
                    if (response.message?.includes('Invalid token')) {
                        console.log('\n💡 SOLUTION: Use a valid 6-digit code from your authenticator app');
                    } else if (response.message?.includes('setup not initiated')) {
                        console.log('\n💡 SOLUTION: Call /setup endpoint first to generate the secret');
                    } else if (response.message?.includes('already enabled')) {
                        console.log('\n💡 INFO: 2FA is already enabled for this user');
                    }
                }
            } catch (error) {
                console.log('Raw response:', data);
                console.log('Parse error:', error.message);
            }
        });
    });
    
    req.on('error', (error) => {
        console.error('❌ Request failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Server appears to be down. Please start the server first.');
        }
    });
    
    req.on('timeout', () => {
        console.error('❌ Request timed out');
        req.destroy();
    });
    
    req.setTimeout(10000); // 10 second timeout
    req.write(postData);
    req.end();
}

testVerifySetupEndpoint();