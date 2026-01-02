// debug-notification-test.js
// Comprehensive test script to debug notification emission

const axios = require('axios');
const jwt = require('jsonwebtoken');
const io = require('socket.io-client');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:4001';
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:4001';
const TEST_JWT = process.env.TEST_JWT || 'YOUR_JWT_HERE';

console.log('🔧 Debug Notification Test');
console.log('========================');
console.log('API URL:', API_URL);
console.log('Socket URL:', SOCKET_URL);
console.log('JWT (first 30 chars):', TEST_JWT.substring(0, 30) + '...');
console.log('');

// Step 1: Decode JWT to check userId
function debugJWT() {
  try {
    console.log('🔍 Step 1: Analyzing JWT Token...');
    
    if (TEST_JWT === 'YOUR_JWT_HERE') {
      console.log('❌ Please set a real JWT token in TEST_JWT environment variable');
      return null;
    }
    
    const decoded = jwt.decode(TEST_JWT);
    console.log('✅ JWT decoded successfully');
    console.log('   User ID:', decoded.userId || decoded.id);
    console.log('   Master User ID:', decoded.masterUserID);
    console.log('   Name:', decoded.name);
    console.log('   Email:', decoded.email);
    console.log('   Issued At:', new Date(decoded.iat * 1000).toISOString());
    console.log('   Expires At:', new Date(decoded.exp * 1000).toISOString());
    console.log('   Is Expired:', Date.now() > decoded.exp * 1000);
    console.log('');
    
    return decoded;
  } catch (error) {
    console.log('❌ JWT decode failed:', error.message);
    console.log('');
    return null;
  }
}

// Step 2: Test socket connection
function testSocketConnection(userId) {
  return new Promise((resolve) => {
    console.log('🔍 Step 2: Testing Socket Connection...');
    
    const actualUserId = userId || 'undefined';
    
    const socket = io(SOCKET_URL, {
      auth: { token: TEST_JWT },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      timeout: 5000
    });

    let connected = false;

    socket.on('connect', () => {
      console.log('✅ Socket connected successfully');
      console.log('   Socket ID:', socket.id);
      console.log('   Expected room: user_' + actualUserId);
      console.log('');
      connected = true;
      
      // Listen for notification
      socket.on('new_notification', (payload) => {
        console.log('🔔 RECEIVED: new_notification');
        console.log('   Target User ID:', payload.notification?.userId);
        console.log('   Title:', payload.notification?.title);
        console.log('   Unread Count:', payload.unreadCount);
        console.log('');
        
        socket.disconnect();
        resolve({ success: true, received: true });
      });

      // Set timeout for notification
      setTimeout(() => {
        if (connected) {
          console.log('⏰ No notification received within 10 seconds');
          socket.disconnect();
          resolve({ success: true, received: false });
        }
      }, 10000);
    });

    socket.on('connect_error', (error) => {
      console.log('❌ Socket connection failed:', error.message);
      console.log('');
      resolve({ success: false, error: error.message });
    });
  });
}

// Step 3: Test debug broadcast endpoint
async function testDebugBroadcast() {
  try {
    console.log('🔍 Step 3: Testing Debug Broadcast Endpoint...');
    
    const payload = {
      notification: {
        title: 'Debug Broadcast Test',
        message: 'This is a broadcast test notification',
        notificationId: 999,
        userId: 'broadcast'
      },
      unreadCount: 1
    };

    const response = await axios.post(`${API_URL}/debug/emit-all`, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('✅ Debug broadcast sent');
    console.log('   Response:', JSON.stringify(response.data, null, 2));
    console.log('');
    
    return true;
  } catch (error) {
    console.log('❌ Debug broadcast failed:');
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('   Error:', error.message);
    }
    console.log('');
    return false;
  }
}

// Step 4: Test notification API
async function testNotificationAPI() {
  try {
    console.log('🔍 Step 4: Testing Notification API...');
    
    const payload = {
      type: 'system',
      title: 'API Test Notification',
      message: 'Testing createNotification emission',
      priority: 'high'
    };

    const response = await axios.post(`${API_URL}/api/notifications/test`, payload, {
      headers: {
        'Authorization': `Bearer ${TEST_JWT}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Notification API call successful');
    console.log('   Status:', response.status);
    console.log('   Notification ID:', response.data.notification?.notificationId);
    console.log('   Target User ID:', response.data.notification?.userId);
    console.log('');
    
    return true;
  } catch (error) {
    console.log('❌ Notification API failed:');
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('   Error:', error.message);
    }
    console.log('');
    return false;
  }
}

// Main test function
async function runDebugTest() {
  console.log('🚀 Starting comprehensive notification debug test...');
  console.log('');

  // Step 1: Decode JWT
  const decodedJWT = debugJWT();
  if (!decodedJWT) {
    console.log('❌ Cannot proceed without valid JWT');
    return;
  }

  // Step 2: Test socket connection
  console.log('⏳ Testing socket connection (will wait 10 seconds for notification)...');
  const socketPromise = testSocketConnection(decodedJWT.userId || decodedJWT.id);

  // Step 3: Test debug broadcast
  await testDebugBroadcast();
  
  // Wait a moment then test notification API
  setTimeout(async () => {
    await testNotificationAPI();
  }, 2000);

  // Wait for socket result
  const socketResult = await socketPromise;
  
  console.log('📋 Test Summary:');
  console.log('==============');
  console.log('JWT Decode:', decodedJWT ? '✅' : '❌');
  console.log('Socket Connection:', socketResult.success ? '✅' : '❌');
  console.log('Notification Received:', socketResult.received ? '✅' : '❌');
  console.log('');
  
  if (!socketResult.success) {
    console.log('💡 Socket connection failed - check:');
    console.log('   1. Backend server is running');
    console.log('   2. JWT token is valid and not expired');
    console.log('   3. JWT_SECRET matches between client and server');
    console.log('');
  }
  
  if (socketResult.success && !socketResult.received) {
    console.log('💡 No notification received - check:');
    console.log('   1. Server logs for emission messages');
    console.log('   2. User ID in JWT matches notification target');
    console.log('   3. Socket joined correct room (user_X)');
    console.log('');
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n👋 Test interrupted by user');
  process.exit(0);
});

// Run the test
runDebugTest().catch(console.error);