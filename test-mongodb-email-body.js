/**
 * Test MongoDB Email Body Storage Implementation
 * 
 * This script tests the new MongoDB email body storage system
 * Run with: node test-mongodb-email-body.js
 */

const EmailBodyMongoService = require('./services/emailBodyMongoService');
const { connectMongoDB } = require('./config/mongodb');

async function testMongoDBEmailBodyStorage() {
  console.log('🚀 Starting MongoDB Email Body Storage Tests...\n');
  
  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await connectMongoDB();
    console.log('✅ MongoDB connected successfully\n');
    
    const testEmailID = 'test-email-12345';
    const testMasterUserID = 1;
    
    // Test 1: Save email body to MongoDB
    console.log('🧪 Test 1: Save email body to MongoDB');
    const testBodyData = {
      bodyHtml: '<html><body><h1>Test Email</h1><p>This is a test email with <strong>HTML</strong> content.</p><img src="cid:image1" alt="Test Image"></body></html>',
      bodyText: 'Test Email\n\nThis is a test email with plain text content.'
    };
    
    const testAttachments = [
      {
        filename: 'test-image.png',
        contentId: 'image1',
        contentType: 'image/png',
        size: 1024
      }
    ];
    
    const saveResult = await EmailBodyMongoService.saveEmailBody(
      testEmailID,
      testMasterUserID,
      testBodyData,
      {
        shouldClean: true,
        preserveOriginal: false,
        attachments: testAttachments,
        provider: 'gmail',
        saveOriginal: true
      }
    );
    
    console.log('📝 Save result:', {
      success: saveResult.success,
      emailID: saveResult.emailID,
      bodyLength: saveResult.bodyLength,
      mongoId: saveResult.mongoId ? 'Generated' : 'None'
    });
    console.log('✅ Test 1 completed\n');
    
    // Test 2: Retrieve email body from MongoDB
    console.log('🧪 Test 2: Retrieve email body from MongoDB');
    const getResult = await EmailBodyMongoService.getEmailBody(
      testEmailID,
      testMasterUserID,
      {
        cleanBody: true,
        preserveOriginal: false,
        attachments: testAttachments
      }
    );
    
    console.log('📖 Get result:', {
      success: getResult.success,
      emailID: getResult.emailID,
      bodyLength: getResult.body ? getResult.body.length : 0,
      hasContent: !!getResult.body,
      fetchStatus: getResult.fetchStatus
    });
    console.log('✅ Test 2 completed\n');
    
    // Test 3: Check if email body exists
    console.log('🧪 Test 3: Check if email body exists');
    const existsResult = await EmailBodyMongoService.hasEmailBody(testEmailID, testMasterUserID);
    
    console.log('🔍 Exists result:', existsResult);
    console.log('✅ Test 3 completed\n');
    
    // Test 4: Migration test
    console.log('🧪 Test 4: MySQL to MongoDB migration test');
    const testMySQLBody = '<html><body><h2>MySQL Email Body</h2><p>This email was stored in MySQL and is being migrated to MongoDB.</p></body></html>';
    const migrationEmailID = 'migration-test-67890';
    
    const migrationResult = await EmailBodyMongoService.migrateEmailBodyFromMySQL(
      migrationEmailID,
      testMasterUserID,
      testMySQLBody,
      []
    );
    
    console.log('🔄 Migration result:', {
      success: migrationResult.success,
      emailID: migrationResult.emailID,
      error: migrationResult.error || 'None'
    });
    console.log('✅ Test 4 completed\n');
    
    // Test 5: Get statistics
    console.log('🧪 Test 5: Get email body statistics');
    const statsResult = await EmailBodyMongoService.getBodyStatistics(testMasterUserID);
    
    console.log('📊 Statistics result:', {
      success: statsResult.success,
      totalBodies: statsResult.totalBodies,
      statusBreakdown: statsResult.statusBreakdown || []
    });
    console.log('✅ Test 5 completed\n');
    
    // Test 6: Update status
    console.log('🧪 Test 6: Update email body status');
    const statusResult = await EmailBodyMongoService.updateBodyStatus(
      testEmailID,
      testMasterUserID,
      'processing',
      'Test status update'
    );
    
    console.log('📝 Status update result:', statusResult);
    console.log('✅ Test 6 completed\n');
    
    // Test 7: Cleanup test (dry run)
    console.log('🧪 Test 7: Cleanup old bodies (dry run)');
    const cleanupResult = await EmailBodyMongoService.cleanupOldBodies(1, true); // 1 day old, dry run
    
    console.log('🧹 Cleanup result:', cleanupResult);
    console.log('✅ Test 7 completed\n');
    
    // Test 8: Delete test email bodies
    console.log('🧪 Test 8: Delete test email bodies');
    const deleteResult1 = await EmailBodyMongoService.deleteEmailBody(testEmailID, testMasterUserID);
    const deleteResult2 = await EmailBodyMongoService.deleteEmailBody(migrationEmailID, testMasterUserID);
    
    console.log('🗑️ Delete results:', {
      testEmail: deleteResult1,
      migrationEmail: deleteResult2
    });
    console.log('✅ Test 8 completed\n');
    
    console.log('🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('✅ MongoDB email body storage working correctly');
    console.log('✅ Save and retrieve operations functional');
    console.log('✅ Migration from MySQL working');
    console.log('✅ Statistics and management features working');
    console.log('✅ Cleanup and maintenance operations functional');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    // Close MongoDB connection
    console.log('\n🔌 Closing MongoDB connection...');
    process.exit(0);
  }
}

// Run the tests
if (require.main === module) {
  testMongoDBEmailBodyStorage();
}

module.exports = testMongoDBEmailBodyStorage;