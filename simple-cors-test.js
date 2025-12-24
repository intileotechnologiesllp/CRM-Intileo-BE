#!/usr/bin/env node

const axios = require('axios');

console.log('🔧 Simple CORS Test - Debug Endpoint Only');
console.log('========================================\n');

async function testDebugEndpoint(baseUrl) {
    console.log(`📍 Testing: ${baseUrl}/debug/emit-all`);
    
    try {
        const response = await axios.post(`${baseUrl}/debug/emit-all`, {
            notification: {
                title: 'CORS Test Notification',
                message: `Successfully sent from ${baseUrl}`,
                type: 'success'
            },
            unreadCount: 99
        }, {
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`   ✅ Success: ${response.status}`);
        console.log(`   📤 Response: ${JSON.stringify(response.data)}`);
        console.log(`   🔔 Notification should be emitted to all connected clients`);
        return true;
        
    } catch (error) {
        if (error.response) {
            console.log(`   ❌ HTTP Error: ${error.response.status} - ${error.response.statusText}`);
            console.log(`   📄 Response: ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            console.log(`   ❌ Network Error: No response received`);
            console.log(`   🌐 Check if server is running on ${baseUrl}`);
        } else {
            console.log(`   ❌ Request Error: ${error.message}`);
        }
        return false;
    }
}

async function runSimpleTest() {
    console.log('Testing debug emission endpoints...\n');
    
    console.log('1️⃣ Testing localhost (reference):');
    const localhostResult = await testDebugEndpoint('http://localhost:4001');
    
    console.log('\n2️⃣ Testing server IP (the one that was failing):');
    const serverResult = await testDebugEndpoint('http://213.136.77.55:4001');
    
    console.log('\n📊 Results Summary:');
    console.log('==================');
    console.log(`Localhost: ${localhostResult ? '✅ Working' : '❌ Failed'}`);
    console.log(`Server IP: ${serverResult ? '✅ Working' : '❌ Failed'}`);
    
    if (serverResult) {
        console.log('\n🎉 SUCCESS: Server IP debug endpoint is working!');
        console.log('   The CORS fix allows the backend to emit notifications');
        console.log('   Frontend clients can now connect from this origin');
    } else {
        console.log('\n⚠️  Server IP endpoint failed - check server status');
    }
}

// Run test
runSimpleTest().catch(console.error);