/**
 * Test MongoDB Email Body Retrieval
 * Debug and verify MongoDB data retrieval for completed emails
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3056'; // Your application URL

// Test configuration
const testEmailId = 4370; // Use the email ID from your logs that should have completed status
const masterUserID = 38; // Use the master user ID from your logs

async function testMongoDBRetrieval() {
  console.log('\n🔍 TESTING MONGODB EMAIL BODY RETRIEVAL');
  console.log('=======================================\n');

  try {
    // Step 1: Check if email exists and its status
    console.log(`📋 Step 1: Checking email ${testEmailId} status...`);
    
    // You can add a direct database check here if you have access
    console.log('Expected: body_fetch_status = "completed" with empty/null MySQL body');
    
    // Step 2: Check MongoDB directly via API
    console.log('\n📋 Step 2: Testing MongoDB API directly...');
    try {
      const mongoResponse = await axios.get(`${BASE_URL}/api/mongodb/email-body/${testEmailId}?masterUserID=${masterUserID}`);
      console.log('MongoDB API Response:', {
        success: !!mongoResponse.data,
        hasBody: !!(mongoResponse.data && mongoResponse.data.body),
        hasProcessedBody: !!(mongoResponse.data && mongoResponse.data.processedBody),
        bodyLength: mongoResponse.data && mongoResponse.data.body ? mongoResponse.data.body.length : 0,
        processedBodyLength: mongoResponse.data && mongoResponse.data.processedBody ? mongoResponse.data.processedBody.length : 0
      });
    } catch (mongoApiError) {
      console.log('❌ MongoDB API Error:', mongoApiError.response ? mongoApiError.response.data : mongoApiError.message);
    }

    // Step 3: Test getOneEmail API and observe detailed logs
    console.log('\n📋 Step 3: Testing getOneEmail API...');
    console.log('⚠️  WATCH SERVER CONSOLE for these debug logs:');
    console.log('   - "MONGODB DEBUG: Calling getEmailBody"');
    console.log('   - "MONGODB DEBUG: getEmailBody result"');
    console.log('   - "MONGODB ONLY: Successfully retrieved body" (success)');
    console.log('   - "MONGODB ONLY: No body found" (issue)');
    console.log('   - "MONGODB ONLY: Error retrieving" (error)\n');
    
    const startTime = Date.now();
    
    const response = await axios.get(`${BASE_URL}/email/getOneEmail/${testEmailId}?masterUserID=${masterUserID}`);
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`⏱️  Response Time: ${responseTime}ms`);
    
    if (response.data && !response.data.error) {
      const email = response.data.data.email;
      console.log('\n✅ Email Retrieved:');
      console.log(`- Email ID: ${email.emailID}`);
      console.log(`- Subject: ${email.subject}`);
      console.log(`- Body Length: ${email.body ? email.body.length : 0} chars`);
      console.log(`- Has Body: ${!!email.body}`);
      
      if (email.body && email.body.length > 0) {
        console.log(`- Body Preview: ${email.body.substring(0, 200)}...`);
        console.log('\n✅ SUCCESS: Body retrieved from MongoDB!');
      } else {
        console.log('\n❌ ISSUE: No body content retrieved');
        console.log('Check server logs for MongoDB debug information');
      }
      
    } else {
      console.log('❌ Failed to retrieve email:', response.data);
    }

    // Step 4: Troubleshooting information
    console.log('\n🔧 TROUBLESHOOTING CHECKLIST:');
    console.log('□ MongoDB connection is working');
    console.log('□ Email body exists in MongoDB email_bodies collection');
    console.log('□ EmailBodyMongoService.getEmailBody() returns data');
    console.log('□ Email has body_fetch_status = "completed"');
    console.log('□ MySQL body is empty/null for this email');
    console.log('□ Server logs show MongoDB debug information');

    console.log('\n✅ MONGODB RETRIEVAL TEST COMPLETED');
    console.log('==================================');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (error.response && error.response.data) {
      console.error('Error Details:', error.response.data);
    }
  }
}

// Database verification instructions
function printDatabaseVerification() {
  console.log('\n📋 MANUAL DATABASE VERIFICATION');
  console.log('===============================');
  console.log('1. Check MySQL email table:');
  console.log('   SELECT emailID, body_fetch_status, LENGTH(body) as body_length FROM Emails WHERE emailID = 4370;');
  console.log('   Expected: body_fetch_status="completed", body_length=0');
  console.log('');
  console.log('2. Check MongoDB email_bodies collection:');
  console.log('   db.email_bodies.findOne({emailId: 4370});');
  console.log('   Expected: Document with body and/or processedBody fields');
  console.log('');
  console.log('3. Check MongoDB connection:');
  console.log('   - Ensure MongoDB is running on localhost:27017');
  console.log('   - Database name: pipedrive_crm');
  console.log('   - Collection name: email_bodies');
  console.log('');
  console.log('4. If MongoDB is empty, run migration:');
  console.log('   POST /api/mongodb/email-body/migrate with emailId and masterUserID\n');
}

// Run the test
if (require.main === module) {
  printDatabaseVerification();
  testMongoDBRetrieval();
}

module.exports = { testMongoDBRetrieval };