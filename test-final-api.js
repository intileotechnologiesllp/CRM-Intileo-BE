const axios = require('axios');

async function testGetOneEmailAPI() {
    try {
        console.log('🔍 Testing getOneEmail API with MongoDB optimization...');
        
        const emailID = 9937;
        const url = `http://localhost:3056/api/email/getOneEmail/${emailID}`;
        
        // Use your auth token
        const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzgsImVtYWlsIjoidHJlZXNoYWxpLnNoYXJtYUBlYXJ0aG9vZC5pbiIsImxvZ2luVHlwZSI6ImFkbWluIiwiaWF0IjoxNzYyMzMwNjQ1LCJleHAiOjE3NjQ5MjI2NDV9.EbRoIjOgpG30oHqmMsGiHwbud0LPRDK3I_vtgENDdRU";
        
        console.log(`📧 Testing emailID: ${emailID}`);
        console.log(`🌐 URL: ${url}`);
        
        const startTime = Date.now();
        
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        console.log(`⏱️ Response Time: ${responseTime}ms`);
        console.log(`📊 Status: ${response.status}`);
        
        if (response.data && response.data.data) {
            const email = response.data.data;
            console.log('\n✅ SUCCESS: Email retrieved!');
            console.log(`📧 Subject: ${email.subject}`);
            console.log(`📝 Body Length: ${email.body ? email.body.length : 0} characters`);
            console.log(`🗄️ Body Fetch Status: ${email.body_fetch_status}`);
            console.log(`📅 Date: ${email.date}`);
            
            if (email.body && email.body.length > 0) {
                console.log(`🎉 MONGODB OPTIMIZATION WORKING! Got body content from MongoDB`);
                console.log(`📝 Body Preview: ${email.body.substring(0, 150)}...`);
            } else {
                console.log(`⚠️ No body content returned - check server logs`);
            }
            
            // Check if IMAP was avoided (should be fast for completed emails)
            if (responseTime < 5000 && email.body_fetch_status === 'completed') {
                console.log(`🚀 FAST RESPONSE (${responseTime}ms) - IMAP likely avoided!`);
            } else {
                console.log(`🐌 Slow response (${responseTime}ms) - may have used IMAP`);
            }
            
        } else {
            console.log('❌ No email data in response');
            console.log('Response:', response.data);
        }
        
    } catch (error) {
        console.error('❌ API Error:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else if (error.request) {
            console.error('No response received. Is server running on port 3056?');
            console.error('Request error:', error.message);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testGetOneEmailAPI();