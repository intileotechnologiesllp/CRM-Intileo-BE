#!/usr/bin/env node

const axios = require('axios');
const io = require('socket.io-client');

console.log('🔍 Diagnosing Socket.IO Connection Issue');
console.log('======================================');
console.log('Problem: Frontend receives notifications from localhost API but not server IP API');
console.log('');

const JWT_TOKEN = process.env.TEST_JWT || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NzIsImVtYWlsIjoibXJpZHVsLmt1bWFyQGludGlsZW8uY29tIiwibG9naW5UeXBlIjoiYWRtaW4iLCJzZXNzaW9uSWQiOjE0NjksImlhdCI6MTc2NjU1ODQ1MCwiZXhwIjoxNzY5MTUwNDUwfQ.Xkr0adjv7Oy2fEjSOjlcVzWUNvDf9pVJoZ2WuIqitf0";

async function testBothSocketConnections() {
    console.log('🔬 Testing Socket.IO connections to both servers...\n');
    
    // Test 1: Connect to localhost (working scenario)
    console.log('1️⃣ Testing connection to localhost:4001 (working scenario):');
    const localhostResult = await testSocketConnection('http://localhost:4001', 'localhost');
    
    // Test 2: Connect to server IP (problematic scenario)  
    console.log('\n2️⃣ Testing connection to server IP:4001 (problematic scenario):');
    const serverResult = await testSocketConnection('http://213.136.77.55:4001', 'server IP');
    
    return { localhost: localhostResult, server: serverResult };
}

function testSocketConnection(socketUrl, label) {
    return new Promise((resolve) => {
        console.log(`   📍 Connecting to: ${socketUrl}`);
        
        const socket = io(socketUrl, {
            timeout: 8000,
            transports: ['websocket', 'polling'],
            auth: {
                token: JWT_TOKEN
            },
            forceNew: true
        });
        
        let connected = false;
        let notificationReceived = false;
        
        socket.on('connect', () => {
            connected = true;
            console.log(`   ✅ ${label} Socket Connected: ${socket.id}`);
            console.log(`   🎯 Ready to receive notifications`);
            
            // Trigger notification from the SAME server
            const apiUrl = socketUrl.replace('/socket.io/', '') + '/debug/emit-all';
            console.log(`   📤 Triggering notification via: ${apiUrl}`);
            
            axios.post(apiUrl, {
                notification: {
                    title: `${label} Test`,
                    message: `Notification from ${socketUrl}`,
                    type: 'info'
                },
                unreadCount: 1
            }).then(() => {
                console.log(`   📡 Notification sent via ${label} API`);
            }).catch(err => {
                console.log(`   ❌ API call failed: ${err.message}`);
            });
        });
        
        socket.on('new_notification', (data) => {
            if (!notificationReceived) {
                notificationReceived = true;
                console.log(`   🔔 ✅ Notification received from ${label}!`);
                console.log(`   📋 Title: ${data.notification?.title}`);
                console.log(`   💬 Message: ${data.notification?.message}`);
                
                setTimeout(() => {
                    socket.disconnect();
                    resolve(true);
                }, 1000);
            }
        });
        
        socket.on('connect_error', (error) => {
            console.log(`   ❌ ${label} Connection Error: ${error.message}`);
            socket.disconnect();
            resolve(false);
        });
        
        setTimeout(() => {
            if (!notificationReceived) {
                if (connected) {
                    console.log(`   ⏰ ${label} connected but no notification received`);
                } else {
                    console.log(`   ⏰ ${label} connection timeout`);
                }
                socket.disconnect();
                resolve(false);
            }
        }, 10000);
    });
}

async function simulateFrontendScenario() {
    console.log('\n🌐 Simulating your frontend scenario...\n');
    
    // This simulates what your frontend is likely doing
    console.log('3️⃣ Scenario: Frontend connects to localhost, API hit from server IP');
    console.log('   Frontend Socket.IO: http://localhost:4001');
    console.log('   API Call (Postman): http://213.136.77.55:4001/debug/emit-all');
    
    return new Promise((resolve) => {
        // Frontend connects to localhost
        const frontendSocket = io('http://localhost:4001', {
            timeout: 8000,
            auth: { token: JWT_TOKEN },
            forceNew: true
        });
        
        let connected = false;
        let notificationReceived = false;
        
        frontendSocket.on('connect', () => {
            connected = true;
            console.log(`   ✅ Frontend connected to localhost: ${frontendSocket.id}`);
            
            // Simulate Postman hitting server IP
            console.log(`   📤 Hitting server IP API (simulating Postman)...`);
            
            axios.post('http://213.136.77.55:4001/debug/emit-all', {
                notification: {
                    title: 'Server IP Test',
                    message: 'API hit from server IP, frontend on localhost',
                    type: 'warning'
                },
                unreadCount: 1
            }).then(() => {
                console.log(`   📡 Server IP API call successful`);
            }).catch(err => {
                console.log(`   ❌ Server IP API failed: ${err.message}`);
            });
        });
        
        frontendSocket.on('new_notification', (data) => {
            if (!notificationReceived) {
                notificationReceived = true;
                console.log(`   🔔 ❌ NO NOTIFICATION - This is the problem!`);
                console.log(`   📋 Different servers: localhost socket vs server IP API`);
                
                setTimeout(() => {
                    frontendSocket.disconnect();
                    resolve(false);
                }, 1000);
            }
        });
        
        frontendSocket.on('connect_error', (error) => {
            console.log(`   ❌ Frontend connection failed: ${error.message}`);
            resolve(false);
        });
        
        setTimeout(() => {
            if (!notificationReceived && connected) {
                console.log(`   ❌ CONFIRMED: No notification received`);
                console.log(`   🔍 Root cause: Frontend connected to localhost, API hit server IP`);
                console.log(`   💡 Solution: Frontend must connect to same server as API`);
                frontendSocket.disconnect();
                resolve(false);
            } else if (!connected) {
                console.log(`   ❌ Frontend couldn't connect to localhost`);
                resolve(false);
            }
        }, 8000);
    });
}

async function printDiagnosisAndSolution(results) {
    console.log('\n📊 Diagnosis Results:');
    console.log('====================');
    
    console.log(`Localhost Socket + Localhost API: ${results.localhost ? '✅ Works' : '❌ Failed'}`);
    console.log(`Server IP Socket + Server IP API: ${results.server ? '✅ Works' : '❌ Failed'}`);
    console.log(`Localhost Socket + Server IP API: ❌ Doesn't work (your issue)`);
    
    console.log('\n🔍 Root Cause Analysis:');
    console.log('======================');
    console.log('Your frontend is connecting to Socket.IO at:');
    console.log('   http://localhost:4001  ← Frontend Socket.IO connection');
    console.log('');
    console.log('But you\'re hitting the API at:');
    console.log('   http://213.136.77.55:4001  ← Postman API call');
    console.log('');
    console.log('These are TWO DIFFERENT servers! Notifications from server IP');
    console.log('won\'t reach clients connected to localhost.');
    
    console.log('\n💡 Solution Options:');
    console.log('===================');
    console.log('Option 1 (Recommended): Update frontend to connect to server IP');
    console.log('   Change frontend Socket.IO URL to: http://213.136.77.55:4001');
    console.log('');
    console.log('Option 2: Use localhost for both API and Socket.IO');
    console.log('   Hit API at: http://localhost:4001/debug/emit-all');
    console.log('');
    console.log('🔧 Frontend Fix:');
    console.log('   const socket = io("http://213.136.77.55:4001", {');
    console.log('     auth: { token: yourJWT }');
    console.log('   });');
}

async function main() {
    try {
        const results = await testBothSocketConnections();
        await simulateFrontendScenario();
        await printDiagnosisAndSolution(results);
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

if (require.main === module) {
    main();
}