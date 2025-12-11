/**
 * Test Email Body Optimization
 * Verify that getOneEmail API respects body_fetch_status = 'completed'
 * and fetches from MongoDB only (no IMAP) when completed
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3056'; // Your application URL

// Test configuration
const testEmailId = 4370; // Use the email ID from your logs
const masterUserID = 38; // Use the master user ID from your logs

async function testEmailOptimization() {
  console.log('\n🚀 TESTING EMAIL BODY OPTIMIZATION');
  console.log('==================================\n');

  try {
    // Step 1: Test getOneEmail API and check console logs
    console.log('📋 Step 1: Testing getOneEmail API optimization...');
    console.log(`Testing email ID: ${testEmailId} for user: ${masterUserID}`);
    console.log('⚠️  CHECK SERVER CONSOLE LOGS for optimization indicators:');
    console.log('   - "BODY EXISTS OR COMPLETED" = Optimization working ✅');
    console.log('   - "MONGODB ONLY: Getting body from MongoDB" = Perfect optimization ✅');
    console.log('   - "ON-DEMAND: Email body missing or pending" = Not optimized ❌');
    console.log('   - "IMAP connection" messages = Not optimized ❌\n');
    
    const startTime = Date.now();
    
    // Make request to getOneEmail API
    const response = await axios.get(`${BASE_URL}/email/getOneEmail/${testEmailId}?masterUserID=${masterUserID}`);
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`⏱️  Response Time: ${responseTime}ms`);
    
    if (response.data.success !== false) {
      const email = response.data.data.email;
      console.log('\n✅ Email Retrieved Successfully:');
      console.log(`- Email ID: ${email.emailID}`);
      console.log(`- Subject: ${email.subject}`);
      console.log(`- Body Length: ${email.body ? email.body.length : 0} chars`);
      console.log(`- Has Body: ${!!email.body}`);
      console.log(`- Related Emails: ${response.data.data.relatedEmails ? response.data.data.relatedEmails.length : 0}`);
      
      // Check if body was retrieved
      if (email.body && email.body.length > 0) {
        console.log('\n✅ OPTIMIZATION SUCCESS INDICATORS:');
        console.log('- Body was retrieved from database');
        console.log('- Check server logs for "MONGODB ONLY" or "BODY EXISTS OR COMPLETED"');
        console.log('- No IMAP connection should have been made');
      } else {
        console.log('\n⚠️ POTENTIAL OPTIMIZATION ISSUE:');
        console.log('- No body content retrieved');
        console.log('- Check if email body_fetch_status is actually "completed"');
      }
      
    } else {
      console.log('❌ Failed to retrieve email:', response.data);
    }

    console.log('\n📊 OPTIMIZATION VERIFICATION CHECKLIST:');
    console.log('□ Server logs show "BODY EXISTS OR COMPLETED" message');
    console.log('□ Server logs show "MONGODB ONLY" retrieval (if MySQL body empty)');
    console.log('□ NO "ON-DEMAND: Fetching body" messages for completed emails');
    console.log('□ NO "IMAP connection" messages for completed emails');
    console.log('□ Fast response time (should be < 100ms for cached emails)');

    console.log('\n✅ EMAIL OPTIMIZATION TEST COMPLETED');
    console.log('====================================');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (error.response && error.response.data) {
      console.error('Error Details:', error.response.data);
    }
  }
}

// Instructions for manual verification
function printInstructions() {
  console.log('\n📋 MANUAL VERIFICATION INSTRUCTIONS');
  console.log('====================================');
  console.log('1. Ensure your server is running: npm start');
  console.log('2. Run this test: node test-email-optimization.js');
  console.log('3. WATCH THE SERVER CONSOLE for these optimization logs:');
  console.log('');
  console.log('   ✅ OPTIMIZED (what you should see):');
  console.log('   - "BODY EXISTS OR COMPLETED: Email XXX already has body"');
  console.log('   - "MONGODB ONLY: Getting body from MongoDB for completed email XXX"');
  console.log('   - NO "IMAP connection" messages');
  console.log('   - NO "fetchEmailBodyOnDemand" calls');
  console.log('');
  console.log('   ❌ NOT OPTIMIZED (what you should NOT see):');
  console.log('   - "ON-DEMAND: Email XXX body missing or pending, fetching now"');
  console.log('   - "🔌 Connecting to IMAP for user"');
  console.log('   - "🔍 Searching by UID:"');
  console.log('   - Long response times (>500ms)');
  console.log('');
  console.log('4. Compare before/after server logs to see the difference');
  console.log('5. Test with different email IDs to verify consistent behavior\n');
}

// Run the test
if (require.main === module) {
  printInstructions();
  testEmailOptimization();
}

module.exports = { testEmailOptimization };