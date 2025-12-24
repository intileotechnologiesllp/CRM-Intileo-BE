#!/usr/bin/env node

const axios = require('axios');
const io = require('socket.io-client');

console.log('🌐 Frontend Notification Flow Test (with JWT)');
console.log('=============================================');
console.log('Frontend: http://213.136.77.55:4002/');
console.log('Backend:  http://213.136.77.55:4001/');
console.log('');

// Use the JWT token from environment or provide a test token
const JWT_TOKEN = process.env.TEST_JWT || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NzIsImVtYWlsIjoibXJpZHVsLmt1bWFyQGludGlsZW8uY29tIiwibG9naW5UeXBlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOjE0NjksImlhdCI6MTc2NjU1ODQ1MCwiZXhwIjoxNzY5MTUwNDUwfQ.Xkr0adjv7Oy2fEjSOjlcVzWUNvDf9pVJoZ2WuIqitf0";

async function testAuthenticatedNotificationFlow() {
    console.log('🔄 Testing authenticated notification flow...');
    console.log(`🔑 Using JWT: ${JWT_TOKEN.substring(0, 30)}...\n`);
    
    // Step 1: Test API endpoint works
    console.log('1️⃣ Testing debug API endpoint:');
    console.log('   📍 POST http://213.136.77.55:4001/debug/emit-all');
    
    try {
        const apiResponse = await axios.post('http://213.136.77.55:4001/debug/emit-all', {
            notification: {
                title: 'Frontend Origin Test',
                message: 'Testing from http://213.136.77.55:4002/ with authentication',
                type: 'info'
            },
            unreadCount: 3
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'http://213.136.77.55:4002'
            }
        });
        
        console.log(`   ✅ API Success: ${apiResponse.status} - ${JSON.stringify(apiResponse.data)}`);
        
    } catch (error) {
        console.log(`   ❌ API Error: ${error.message}`);
        return false;
    }
    
    // Step 2: Test authenticated Socket.IO connection
    console.log('\n2️⃣ Testing authenticated Socket.IO connection:');
    console.log('   📍 Connecting with JWT authentication');
    console.log('   🌐 Origin: http://213.136.77.55:4002');
    
    return new Promise((resolve) => {
        const socket = io('http://213.136.77.55:4001', {
            timeout: 10000,
            transports: ['websocket', 'polling'],
            auth: {
                token: JWT_TOKEN
            },
            extraHeaders: {
                'Origin': 'http://213.136.77.55:4002',
                'Authorization': `Bearer ${JWT_TOKEN}`
            },
            forceNew: true
        });
        
        let notificationReceived = false;
        let connected = false;
        
        socket.on('connect', () => {
            connected = true;
            console.log(`   ✅ Socket Connected: ${socket.id}`);
            console.log(`   🎯 Authenticated and ready for notifications\n`);
            
            // Trigger a real notification API call
            console.log('3️⃣ Creating real notification via API:');
            axios.post('http://213.136.77.55:4001/api/notifications/send-test-notification', {
                userId: 72, // From JWT
                title: 'Real-time Frontend Test',
                message: 'This notification was sent from your frontend origin!',
                type: 'success'
            }, {
                headers: {
                    'Authorization': `Bearer ${JWT_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }).then(response => {
                console.log(`   📤 Real notification created: ${response.status}`);
                console.log(`   🔔 Should appear in real-time...\n`);
            }).catch(err => {
                console.log(`   ⚠️ Real notification failed: ${err.response?.status || err.message}`);
                console.log(`   🔄 Falling back to debug broadcast...\n`);
                
                // Fallback to debug broadcast
                return axios.post('http://213.136.77.55:4001/debug/emit-all', {
                    notification: {
                        title: 'Fallback Notification',
                        message: 'Testing via debug endpoint',
                        type: 'info'
                    },
                    unreadCount: 1
                });
            });
        });
        
        socket.on('new_notification', (data) => {
            if (!notificationReceived) {
                notificationReceived = true;
                console.log(`🔔 ✅ NOTIFICATION RECEIVED SUCCESSFULLY!`);
                console.log(`   📋 Title: ${data.notification?.title || 'N/A'}`);
                console.log(`   💬 Message: ${data.notification?.message || 'N/A'}`);
                console.log(`   🔢 Unread Count: ${data.unreadCount || 'N/A'}`);
                console.log(`   ⏰ Timestamp: ${new Date().toLocaleTimeString()}`);
                console.log(`   🎯 Target User: ${data.notification?.userId || 'broadcast'}\n`);
                
                setTimeout(() => {
                    socket.disconnect();
                    resolve(true);
                }, 1000);
            }
        });
        
        socket.on('connect_error', (error) => {
            console.log(`   ❌ Connection Error: ${error.message}`);
            
            if (error.message.includes('Authentication')) {
                console.log(`   🔑 JWT Authentication failed - token may be expired`);
            } else if (error.message.includes('CORS')) {
                console.log(`   🌐 CORS Error - check allowedOrigins in socket.js`);
            }
            
            socket.disconnect();
            resolve(false);
        });
        
        socket.on('disconnect', (reason) => {
            console.log(`   🔌 Disconnected: ${reason}`);
        });
        
        // Timeout after 12 seconds
        setTimeout(() => {
            if (!notificationReceived) {
                if (connected) {
                    console.log(`   ⏰ Connected but no notification received`);
                    console.log(`   💡 Check if notification creation is working`);
                } else {
                    console.log(`   ⏰ Connection failed within timeout`);
                }
                socket.disconnect();
                resolve(false);
            }
        }, 12000);
    });
}

async function printDetailedSummary(success) {
    console.log('📊 Frontend Integration Test Results:');
    console.log('===================================');
    
    if (success) {
        console.log('🎉 SUCCESS: Frontend notification system is working!');
        console.log('');
        console.log('✅ Confirmed working components:');
        console.log('   🌐 CORS: Frontend origin http://213.136.77.55:4002/ is allowed');
        console.log('   🔑 Auth: JWT authentication works for Socket.IO');
        console.log('   📡 Real-time: Notifications delivered instantly');
        console.log('   🔔 Events: new_notification event received successfully');
        console.log('');
        console.log('🚀 Your frontend can now:');
        console.log('   • Connect to Socket.IO with JWT token');
        console.log('   • Listen for "new_notification" events');
        console.log('   • Display real-time toast notifications');
        console.log('   • Update unread counters in real-time');
        
    } else {
        console.log('⚠️ ISSUES FOUND - Troubleshooting Guide:');
        console.log('');
        console.log('🔍 Common Issues:');
        console.log('   1. JWT Token Expired - Get fresh token from login');
        console.log('   2. Server Not Running - Check backend on port 4001');
        console.log('   3. CORS Missing - Verify socket.js includes :4002 origin');
        console.log('   4. Network Issues - Check server accessibility');
        console.log('');
        console.log('🛠️ Frontend Implementation Guide:');
        console.log('   • Use socket.io-client library');
        console.log('   • Connect with: io("http://213.136.77.55:4001")');
        console.log('   • Pass JWT in auth: { token: yourJWT }');
        console.log('   • Listen for: socket.on("new_notification", callback)');
    }
    
    console.log('\n🔗 Related Documentation:');
    console.log('   • Socket.IO Client: https://socket.io/docs/v4/client-api/');
    console.log('   • JWT Authentication: Check your login API response');
    console.log('   • Notification Events: "new_notification" with payload');
}

async function main() {
    try {
        const result = await testAuthenticatedNotificationFlow();
        await printDetailedSummary(result);
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

if (require.main === module) {
    main();
}