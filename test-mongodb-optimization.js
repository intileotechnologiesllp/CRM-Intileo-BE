/**
 * Test MongoDB Body Optimization
 * Verify that getOneEmail API efficiently uses MongoDB processed bodies
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8081';

// Test configuration
const testEmailId = 35; // Use a test email ID
const masterUserID = 1;

async function testMongoDBOptimization() {
  console.log('\n🚀 TESTING MONGODB BODY OPTIMIZATION');
  console.log('=====================================\n');

  try {
    // Step 1: Ensure email has body in MongoDB
    console.log('📋 Step 1: Check MongoDB body status...');
    const checkResponse = await axios.get(`${BASE_URL}/api/mongodb/email-body/check/${testEmailId}?masterUserID=${masterUserID}`);
    console.log('MongoDB Status:', checkResponse.data);

    if (!checkResponse.data.exists) {
      console.log('\n💾 Step 1.5: Migrating email body to MongoDB...');
      const migrateResponse = await axios.post(`${BASE_URL}/api/mongodb/email-body/migrate`, {
        emailId: testEmailId,
        masterUserID: masterUserID
      });
      console.log('Migration Result:', migrateResponse.data);
    }

    // Step 2: Test getOneEmail API performance with MongoDB
    console.log('\n⚡ Step 2: Testing getOneEmail with MongoDB optimization...');
    
    const startTime = Date.now();
    const emailResponse = await axios.get(`${BASE_URL}/email/getOneEmail/${testEmailId}?masterUserID=${masterUserID}`);
    const endTime = Date.now();
    
    const responseTime = endTime - startTime;
    console.log(`Response Time: ${responseTime}ms`);
    
    // Check response
    if (emailResponse.data.success) {
      const email = emailResponse.data.data;
      console.log('\n✅ Email Retrieved Successfully:');
      console.log(`- Email ID: ${email.emailID}`);
      console.log(`- Subject: ${email.subject}`);
      console.log(`- Body Length: ${email.body ? email.body.length : 0} chars`);
      console.log(`- Body Type: ${email.body && email.body.includes('<') ? 'HTML' : 'TEXT'}`);
      console.log(`- Has Attachments: ${email.attachments && email.attachments.length > 0}`);
      
      // Check for optimization indicators
      const bodyPreview = email.body ? email.body.substring(0, 200) + '...' : 'No body';
      console.log(`- Body Preview: ${bodyPreview}`);
      
    } else {
      console.log('❌ Failed to retrieve email:', emailResponse.data);
    }

    // Step 3: Test multiple calls to verify consistency
    console.log('\n🔄 Step 3: Testing consistency with multiple calls...');
    
    const calls = [];
    for (let i = 0; i < 3; i++) {
      calls.push(axios.get(`${BASE_URL}/email/getOneEmail/${testEmailId}?masterUserID=${masterUserID}`));
    }
    
    const results = await Promise.all(calls);
    const responseTimes = results.map((_, index) => {
      const start = Date.now();
      return Date.now() - start; // This won't be accurate, but shows the pattern
    });
    
    console.log('Multiple Call Results:');
    results.forEach((result, index) => {
      console.log(`  Call ${index + 1}: ${result.data.success ? 'Success' : 'Failed'} - Body Length: ${result.data.data?.body?.length || 0}`);
    });

    // Step 4: Check MongoDB statistics
    console.log('\n📊 Step 4: MongoDB Performance Statistics...');
    const statsResponse = await axios.get(`${BASE_URL}/api/mongodb/email-body/stats`);
    console.log('MongoDB Stats:', statsResponse.data);

    console.log('\n✅ MONGODB OPTIMIZATION TEST COMPLETED');
    console.log('=====================================');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (error.response && error.response.data) {
      console.error('Error Details:', error.response.data);
    }
  }
}

// Instructions for manual testing
function printManualTestInstructions() {
  console.log('\n📋 MANUAL TEST INSTRUCTIONS');
  console.log('============================');
  console.log('1. Start your application: npm start');
  console.log('2. Run this test: node test-mongodb-optimization.js');
  console.log('3. Check console logs for optimization indicators:');
  console.log('   - "Retrieved processed body from MongoDB" = Optimized ✅');
  console.log('   - "Using pre-processed body from MongoDB, skipping cleaning" = Optimized ✅');
  console.log('   - "MIGRATION: Migrating email" = Not optimized (first time) ⚠️');
  console.log('4. Run test again to see optimization in action');
  console.log('5. Check server logs for MongoDB vs MySQL usage patterns\n');
}

// Run the test
if (require.main === module) {
  printManualTestInstructions();
  testMongoDBOptimization();
}

module.exports = { testMongoDBOptimization };