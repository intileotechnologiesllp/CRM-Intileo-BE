// test-notification-api.js
// Script to trigger notification creation and test emission

const axios = require('axios');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:4001';
const TEST_JWT = process.env.TEST_JWT || 'YOUR_JWT_HERE'; // Replace with actual JWT

async function testNotificationCreation() {
  try {
    console.log('🧪 Testing notification creation...');
    console.log('   API URL:', API_URL);
    console.log('   JWT (first 20 chars):', TEST_JWT.substring(0, 20) + '...');
    console.log('');

    // Test payload
    const payload = {
      type: 'system',
      title: 'Socket Test Notification',
      message: 'Testing if new_notification event is emitted with correct user ID',
      priority: 'high'
    };

    console.log('📤 Sending POST /api/notifications/test...');
    console.log('   Payload:', JSON.stringify(payload, null, 2));
    console.log('');

    const response = await axios.post(`${API_URL}/api/notifications/test`, payload, {
      headers: {
        'Authorization': `Bearer ${TEST_JWT}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ API Response:');
    console.log('   Status:', response.status);
    console.log('   Data:', JSON.stringify(response.data, null, 2));
    console.log('');

    if (response.data.notification) {
      console.log('📋 Created Notification Details:');
      console.log('   ID:', response.data.notification.notificationId);
      console.log('   User ID:', response.data.notification.userId);
      console.log('   Type:', response.data.notification.type);
      console.log('   Title:', response.data.notification.title);
      console.log('');
    }

    console.log('🔍 Check your socket client for the emitted event!');
    
  } catch (error) {
    console.error('❌ API Request failed:');
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   Error:', error.message);
    }
    
    console.log('');
    console.log('💡 Troubleshooting tips:');
    console.log('   1. Check if backend server is running');
    console.log('   2. Verify JWT token is valid and has correct user ID');
    console.log('   3. Check API_URL is correct');
    console.log('   4. Ensure /api/notifications/test route is available');
  }
}

// Run the test
testNotificationCreation();