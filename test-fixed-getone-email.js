const axios = require('axios');

async function testOptimizedGetOneEmail() {
    try {
        console.log('🔧 Testing getOneEmail API with MongoDB optimization...');
        
        // Extract the token from the earlier test output
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzgsImVtYWlsIjoidHJlZXNoYWxpLnNoYXJtYUBlYXJ0aG9vZC5pbiIsImxvZ2luVHlwZSI6ImFkbWluIiwiaWF0IjoxNzYyMzMwNjQ1LCJleHAiOjE3NjQ5MjI2NDV9.EbRoIjOgpG30oHqmMsGiHwbud0LPRDK3I_vtgENDdRU';
        
        const config = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };

        // Test email 9937 which we know has a body in MongoDB
        console.log('\n📧 Testing email 9937 (should retrieve from MongoDB)...');
        const response = await axios.get('http://localhost:3056/api/email/getoneEmail/9937', config);
        
        console.log('📊 Response status:', response.status);
        console.log('📧 Email subject:', response.data.subject || 'No subject');
        console.log('📝 Has body:', !!response.data.body);
        console.log('📏 Body length:', response.data.body ? response.data.body.length : 0);
        console.log('🔧 Body preview:', response.data.body ? response.data.body.substring(0, 100) + '...' : 'No body');
        
        if (response.data.body && response.data.body.length > 0) {
            console.log('✅ SUCCESS: Email body retrieved successfully from MongoDB!');
        } else {
            console.log('❌ FAILED: Email body is still empty');
        }
        
    } catch (error) {
        if (error.response) {
            console.error('❌ API Error:', error.response.status, error.response.data);
        } else if (error.code) {
            console.error('❌ Connection Error:', error.code, error.message);
        } else {
            console.error('❌ Request Error:', error.message);
            console.error('Full error:', error);
        }
    }
}

testOptimizedGetOneEmail();