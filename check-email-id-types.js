const mongoose = require('mongoose');

// Check the documents that exist and what their emailId values are
async function checkEmailIdTypes() {
    try {
        console.log('🔍 Connecting to MongoDB...');
        await mongoose.connect('mongodb://localhost:27017/pipedrive_crm');
        console.log('✅ Connected to MongoDB');

        const emailBodiesCollection = mongoose.connection.db.collection('email_bodies');
        
        // Get all documents and check their emailID values
        console.log('\n📋 All email_bodies documents:');
        const allDocs = await emailBodiesCollection.find({}).toArray();
        
        allDocs.forEach((doc, index) => {
            console.log(`${index + 1}. _id: ${doc._id}`);
            console.log(`   emailID: ${doc.emailID} (type: ${typeof doc.emailID})`);
            console.log(`   masterUserID: ${doc.masterUserID} (type: ${typeof doc.masterUserID})`);
            console.log(`   fetchStatus: ${doc.fetchStatus}`);
            console.log(`   hasBody: ${!!(doc.bodyHtml || doc.bodyText || doc.processedBody)}`);
            console.log('');
        });

        // Test lookups with different data types
        console.log('\n🔍 Testing email lookup as string vs number:');
        const testEmailId = 9937;
        
        // Test as number
        const foundAsNumber = await emailBodiesCollection.findOne({ emailID: testEmailId });
        console.log(`Looking for emailID as number (${testEmailId}): ${foundAsNumber ? '✅ Found' : '❌ Not found'}`);
        
        // Test as string
        const foundAsString = await emailBodiesCollection.findOne({ emailID: testEmailId.toString() });
        console.log(`Looking for emailID as string ("${testEmailId}"): ${foundAsString ? '✅ Found' : '❌ Not found'}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📴 Disconnected from MongoDB');
        process.exit(0);
    }
}

checkEmailIdTypes();