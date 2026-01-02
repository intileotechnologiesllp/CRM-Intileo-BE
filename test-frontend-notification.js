#!/usr/bin/env node

const axios = require('axios');
const io = require('socket.io-client');

console.log('🌐 Frontend Notification Flow Test');
console.log('==================================');
console.log('Frontend: http://213.136.77.55:4002/');
console.log('Backend:  http://213.136.77.55:4001/');
console.log('');

async function testCompleteNotificationFlow() {
    console.log('🔄 Testing complete notification flow...\n');
    
    // Step 1: Test API endpoint
    console.log('1️⃣ Testing debug API endpoint:');
    console.log('   📍 POST http://213.136.77.55:4001/debug/emit-all');
    
    try {
        const apiResponse = await axios.post('http://213.136.77.55:4001/debug/emit-all', {
            notification: {
                title: 'Frontend Test Notification',
                message: 'Testing from frontend origin http://213.136.77.55:4002/',
                type: 'info',
                timestamp: new Date().toISOString()
            },
            unreadCount: 5
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'http://213.136.77.55:4002' // Simulate frontend origin
            }
        });
        
        console.log(`   ✅ API Success: ${apiResponse.status}`);
        console.log(`   📤 Response: ${JSON.stringify(apiResponse.data)}`);
        console.log(`   🔔 Notification emitted to all connected clients\n`);
        
    } catch (error) {
        console.log(`   ❌ API Error: ${error.message}\n`);
        return false;
    }
    
    // Step 2: Test Socket.IO connection from frontend origin
    console.log('2️⃣ Testing Socket.IO connection:');
    console.log('   📍 Connecting to ws://213.136.77.55:4001/');
    console.log('   🌐 Simulating origin: http://213.136.77.55:4002');
    
    return new Promise((resolve) => {
        const socket = io('http://213.136.77.55:4001', {
            timeout: 10000,
            transports: ['websocket', 'polling'],
            extraHeaders: {
                'Origin': 'http://213.136.77.55:4002'
            },
            forceNew: true
        });
        
        let notificationReceived = false;
        let connected = false;
        
        socket.on('connect', () => {
            connected = true;
            console.log(`   ✅ Socket Connected: ${socket.id}`);
            console.log(`   🎯 Ready to receive notifications\n`);
            
            // Now trigger a notification via API
            console.log('3️⃣ Triggering notification via API:');
            axios.post('http://213.136.77.55:4001/debug/emit-all', {
                notification: {
                    title: 'Real-time Test',
                    message: 'This should appear in real-time!',
                    type: 'success'
                },
                unreadCount: 1
            }).then(response => {
                console.log(`   📤 Notification triggered: ${response.status}`);
            }).catch(err => {
                console.log(`   ❌ Trigger failed: ${err.message}`);
            });
        });
        
        socket.on('new_notification', (data) => {
            if (!notificationReceived) {
                notificationReceived = true;
                console.log(`   🔔 NOTIFICATION RECEIVED!`);
                console.log(`   📋 Title: ${data.notification?.title || 'N/A'}`);
                console.log(`   💬 Message: ${data.notification?.message || 'N/A'}`);
                console.log(`   🔢 Unread Count: ${data.unreadCount || 'N/A'}`);
                console.log(`   ⏰ Received at: ${new Date().toLocaleTimeString()}\n`);
                
                socket.disconnect();
                resolve(true);
            }
        });
        
        socket.on('connect_error', (error) => {
            console.log(`   ❌ Connection Error: ${error.message}`);
            if (error.description) {
                console.log(`   📝 Description: ${error.description}`);
            }
            if (error.context) {
                console.log(`   🔍 Context: ${JSON.stringify(error.context)}`);
            }
            console.log(`   💡 This might be a CORS issue or authentication requirement\n`);
            socket.disconnect();
            resolve(false);
        });
        
        socket.on('disconnect', (reason) => {
            console.log(`   🔌 Disconnected: ${reason}\n`);
        });
        
        // Timeout after 15 seconds
        setTimeout(() => {
            if (!notificationReceived && connected) {
                console.log(`   ⏰ No notification received within 15 seconds`);
                console.log(`   ℹ️  Connection was successful but no notification arrived\n`);
                socket.disconnect();
                resolve(false);
            } else if (!connected) {
                console.log(`   ⏰ Connection timeout after 15 seconds\n`);
                socket.disconnect();
                resolve(false);
            }
        }, 15000);
    });
}

async function printSummary(success) {
    console.log('📊 Test Results Summary:');
    console.log('=======================');
    
    if (success) {
        console.log('✅ SUCCESS: Complete notification flow working!');
        console.log('   🎯 Frontend can connect from http://213.136.77.55:4002/');
        console.log('   📡 Real-time notifications are delivered');
        console.log('   🔔 Toast notifications should work in your frontend');
        console.log('');
        console.log('🚀 Your notification system is ready for production!');
    } else {
        console.log('❌ ISSUES DETECTED:');
        console.log('   🔍 Check server logs for CORS errors');
        console.log('   🔑 Verify Socket.IO authentication requirements');
        console.log('   🌐 Ensure server is accessible from frontend');
        console.log('');
        console.log('💡 Troubleshooting:');
        console.log('   1. Check if backend server is running on port 4001');
        console.log('   2. Verify CORS origins in socket.js include :4002');
        console.log('   3. Check if authentication is required for socket connections');
    }
}

// Run the test
async function main() {
    try {
        const result = await testCompleteNotificationFlow();
        await printSummary(result);
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
    }
}

if (require.main === module) {
    main();
}

module.exports = { testCompleteNotificationFlow };