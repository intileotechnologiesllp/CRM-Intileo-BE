const axios = require('axios');

async function testMinimalServer() {
    try {
        console.log('🧪 Testing minimal server...');
        
        const response = await axios.post('http://localhost:4002/api/auth/2fa/setup', 
            { test: 'data' },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token'
                }
            }
        );
        
        console.log('📊 Status Code:', response.status);
        console.log('📥 Response:', response.data);
        console.log('✅ Minimal server test successful!');
        
    } catch (error) {
        console.log('❌ Minimal server test failed:', error.message);
    }
}

testMinimalServer();