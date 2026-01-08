const https = require('https');
const http = require('http');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NzIsImVtYWlsIjoibXJpZHVsLmt1bWFyQGludGlsZW8uY29tIiwibG9naW5UeXBlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOjE0ODYsImlhdCI6MTc2NjU2OTM2OCwiZXhwIjoxNzY5MTYxMzY4fQ.dyDpCiSPKfAnfh3GN017h677bKMTGlicyvIzZqy0n9E';

const options = {
    hostname: '213.136.77.55',  // Try the public IP mentioned in the logs
    port: 4001,
    path: '/api/auth/2fa/setup',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    }
};

function testSetupEndpoint() {
    console.log('🧪 Testing 2FA Setup API Endpoint...');
    console.log('📍 URL: http://localhost:4001/api/auth/2fa/setup');
    console.log('🔑 Token: ' + token.substring(0, 50) + '...');
    
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
                
                if (response.secret && response.qrCode) {
                    console.log('\n✅ SUCCESS: 2FA setup endpoint working!');
                    console.log('   - Secret generated:', response.secret ? 'YES' : 'NO');
                    console.log('   - QR Code generated:', response.qrCode ? 'YES' : 'NO');
                    console.log('   - QR Code length:', response.qrCode?.length);
                } else {
                    console.log('\n❌ Response missing expected fields');
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
    req.end();
}

testSetupEndpoint();