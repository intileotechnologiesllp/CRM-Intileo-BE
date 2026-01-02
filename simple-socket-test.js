// simple-socket-test.js
// Simple socket test using the debug broadcast endpoint (no auth required)

const io = require('socket.io-client');
const axios = require('axios');

const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:4001';
const API_URL = process.env.API_URL || 'http://localhost:4001';

console.log('🧪 Simple Socket Test (No Auth Required)');
console.log('========================================');
console.log('Socket URL:', SOCKET_URL);
console.log('API URL:', API_URL);
console.log('');

// Connect without authentication to test broadcast
const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  auth: {}  // Empty auth to test connection without JWT
});

socket.on('connect', () => {
  console.log('✅ Socket connected successfully');
  console.log('   Socket ID:', socket.id);
  console.log('');
  console.log('🎯 Listening for broadcast notifications...');
  
  // Test the debug broadcast endpoint after connection
  setTimeout(async () => {
    try {
      console.log('📤 Sending debug broadcast...');
      
      const payload = {
        notification: {
          title: 'Broadcast Test',
          message: 'Testing broadcast emission to all clients',
          notificationId: 123,
          userId: 'broadcast_test',
          type: 'system'
        },
        unreadCount: 1
      };

      const response = await axios.post(`${API_URL}/debug/emit-all`, payload, {
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('✅ Broadcast sent successfully');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      console.log('');
      
    } catch (error) {
      console.log('❌ Broadcast failed:', error.message);
    }
  }, 1000);
});

socket.on('connect_error', (error) => {
  console.log('❌ Socket connection failed:', error.message);
  console.log('');
  console.log('💡 This might be expected if auth is required for all connections');
});

socket.on('new_notification', (payload) => {
  console.log('🔔 SUCCESS! Received new_notification broadcast:');
  console.log('   Title:', payload.notification?.title);
  console.log('   Message:', payload.notification?.message);
  console.log('   User ID:', payload.notification?.userId);
  console.log('   Unread Count:', payload.unreadCount);
  console.log('   Full Payload:', JSON.stringify(payload, null, 2));
  console.log('');
  console.log('✅ Broadcast emission is working correctly!');
  
  setTimeout(() => {
    console.log('👋 Test completed - disconnecting...');
    socket.disconnect();
    process.exit(0);
  }, 2000);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Socket disconnected:', reason);
});

// Keep script running
console.log('🚀 Connecting to socket server...');

// Timeout to prevent hanging
setTimeout(() => {
  console.log('⏰ Test timeout - no broadcast received');
  socket.disconnect();
  process.exit(0);
}, 15000);

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n👋 Test interrupted by user');
  socket.disconnect();
  process.exit(0);
});