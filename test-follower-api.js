/**
 * Quick test script to verify follower API is working
 * This tests the basic follower functionality
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
let authToken = ''; // You'll need to add your JWT token here

async function testFollowerAPI() {
  console.log('🧪 Testing Follower API\n');
  console.log('⚠️  NOTE: You need to set your authToken in this script first!\n');

  if (!authToken) {
    console.log('❌ No auth token provided. Please:');
    console.log('1. Login to get your token');
    console.log('2. Set authToken variable in test-follower-api.js');
    console.log('3. Run this script again\n');
    console.log('Example:');
    console.log("const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';\n");
    return;
  }

  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };

  try {
    console.log('1️⃣  Test: Get followers for a deal (should be empty initially)');
    const response1 = await axios.get(`${BASE_URL}/api/followers/deal/1`, { headers });
    console.log('✅ Success:', response1.data);
    console.log('');

    console.log('2️⃣  Test: Add a follower to deal #1');
    const response2 = await axios.post(
      `${BASE_URL}/api/followers/deal/1`,
      { userId: 1 }, // Change to actual user ID
      { headers }
    );
    console.log('✅ Success:', response2.data);
    console.log('');

    console.log('3️⃣  Test: Check if user is following');
    const response3 = await axios.get(`${BASE_URL}/api/followers/deal/1/check/1`, { headers });
    console.log('✅ Success:', response3.data);
    console.log('');

    console.log('4️⃣  Test: Get follower count');
    const response4 = await axios.get(`${BASE_URL}/api/followers/deal/1/count`, { headers });
    console.log('✅ Success:', response4.data);
    console.log('');

    console.log('5️⃣  Test: Get all entities user is following');
    const response5 = await axios.get(`${BASE_URL}/api/followers/user/1`, { headers });
    console.log('✅ Success:', response5.data);
    console.log('');

    console.log('✅ All tests passed! Follower API is working correctly! 🎉');

  } catch (error) {
    console.error('❌ Test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run tests
testFollowerAPI();
