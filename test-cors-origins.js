#!/usr/bin/env node

const axios = require('axios');
const io = require('socket.io-client');

console.log('🔧 Testing Socket.IO CORS Origins');
console.log('=================================\n');

async function testNotificationEndpoint(baseUrl) {
    console.log(`📍 Testing: ${baseUrl}`);
    console.log(`   API URL: ${baseUrl}/debug/emit-all`);
    console.log(`   Socket URL: ${baseUrl}`);
    
    try {
        // Test the debug/emit-all endpoint
        const response = await axios.post(`${baseUrl}/debug/emit-all`, {
            notification: {
                title: 'CORS Test',
                message: `Test from ${baseUrl}`
            },
            unreadCount: 1
        });
        
        console.log(`   ✅ API Response: ${response.status} - ${JSON.stringify(response.data)}`);
        
        // Test Socket.IO connection
        return new Promise((resolve) => {
            const socket = io(baseUrl, {
                timeout: 5000,
                transports: ['websocket', 'polling']
            });
            
            let received = false;
            
            socket.on('connect', () => {
                console.log(`   ✅ Socket.IO Connected: ${socket.id}`);
            });
            
            socket.on('new_notification', (data) => {
                if (!received) {
                    received = true;
                    console.log(`   🔔 Notification Received: ${JSON.stringify(data)}`);
                    socket.disconnect();
                    resolve(true);
                }
            });
            
            socket.on('connect_error', (error) => {
                console.log(`   ❌ Socket.IO Connection Error: ${error.message}`);
                socket.disconnect();
                resolve(false);
            });
            
            // Timeout after 8 seconds
            setTimeout(() => {
                if (!received) {
                    console.log(`   ⏰ No notification received within 8 seconds`);
                    socket.disconnect();
                    resolve(false);
                }
            }, 8000);
        });
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return false;
    }
}

async function runTests() {
    console.log('Starting CORS origin tests...\n');
    
    // Test localhost (should work)
    console.log('1️⃣ Testing localhost:');
    await testNotificationEndpoint('http://localhost:4001');
    
    console.log('\n2️⃣ Testing server IP:');
    await testNotificationEndpoint('http://213.136.77.55:4001');
    
    console.log('\n📋 Test Summary:');
    console.log('================');
    console.log('If server IP test fails, check CORS configuration in socket.js');
    console.log('Make sure http://213.136.77.55:4001 is in allowedOrigins array');
}

// Run tests if called directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { testNotificationEndpoint };