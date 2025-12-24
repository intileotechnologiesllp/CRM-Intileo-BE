// test-notification-socket.js
// Test script to verify new_notification emission with proper user ID targeting

const io = require('socket.io-client');

// Configuration
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:4001';
const TEST_JWT = process.env.TEST_JWT || 'YOUR_JWT_HERE'; // Replace with actual JWT

console.log('🔧 Configuration:');
console.log('  Socket URL:', SOCKET_URL);
console.log('  JWT (first 20 chars):', TEST_JWT.substring(0, 20) + '...');
console.log('');

// Connect to Socket.IO
const socket = io(SOCKET_URL, {
  auth: { token: TEST_JWT },
  transports: ['websocket', 'polling'],
  withCredentials: true
});

// Connection events
socket.on('connect', () => {
  console.log('✅ Socket connected successfully');
  console.log('   Socket ID:', socket.id);
  console.log('');
  console.log('🎯 Listening for notification events...');
  console.log('   - new_notification');
  console.log('   - notification_read');  
  console.log('   - all_notifications_read');
  console.log('');
});

socket.on('connect_error', (error) => {
  console.error('❌ Socket connection failed:');
  console.error('   Error:', error.message);
  console.error('');
  console.log('💡 Troubleshooting tips:');
  console.log('   1. Check if backend server is running');
  console.log('   2. Verify JWT token is valid');
  console.log('   3. Check SOCKET_URL is correct');
  process.exit(1);
});

// Notification events
socket.on('new_notification', (payload) => {
  console.log('🔔 RECEIVED: new_notification');
  console.log('   Timestamp:', new Date().toISOString());
  
  if (payload.notification) {
    console.log('   Notification ID:', payload.notification.notificationId);
    console.log('   User ID:', payload.notification.userId);
    console.log('   Title:', payload.notification.title);
    console.log('   Message:', payload.notification.message);
    console.log('   Type:', payload.notification.type);
    console.log('   Priority:', payload.notification.priority);
    
    if (payload.notification.actor) {
      console.log('   Actor:', payload.notification.actor.name, `(ID: ${payload.notification.actor.masterUserID})`);
    }
  }
  
  console.log('   Unread Count:', payload.unreadCount);
  console.log('   Raw Payload:', JSON.stringify(payload, null, 2));
  console.log('');
});

socket.on('notification_read', (payload) => {
  console.log('✓ RECEIVED: notification_read');
  console.log('   Notification ID:', payload.notificationId);
  console.log('   New Unread Count:', payload.unreadCount);
  console.log('');
});

socket.on('all_notifications_read', (payload) => {
  console.log('✓ RECEIVED: all_notifications_read');
  console.log('   New Unread Count:', payload.unreadCount);
  console.log('');
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Socket disconnected:', reason);
  process.exit(0);
});

// Keep the script running
console.log('🚀 Starting notification test client...');
console.log('');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  socket.disconnect();
  process.exit(0);
});