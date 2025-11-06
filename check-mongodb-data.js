const mongoose = require('mongoose');

// Simple script to check what's in MongoDB email_bodies collection
async function checkMongoDBData() {
    try {
        console.log('🔍 Connecting to MongoDB...');
        await mongoose.connect('mongodb://localhost:27017/pipedrive_crm');
        console.log('✅ Connected to MongoDB');

        // Get all collections
        const collections = await mongoose.connection.db.collections();
        console.log('\n📂 Available collections:');
        collections.forEach(collection => {
            console.log(`  - ${collection.collectionName}`);
        });

        // Check if email_bodies collection exists
        const hasEmailBodies = collections.some(c => c.collectionName === 'email_bodies');
        console.log(`\n📧 Has email_bodies collection: ${hasEmailBodies}`);

        if (hasEmailBodies) {
            // Count documents in email_bodies
            const emailBodiesCollection = mongoose.connection.db.collection('email_bodies');
            const count = await emailBodiesCollection.countDocuments();
            console.log(`📊 Total email bodies stored: ${count}`);

            if (count > 0) {
                // Show first few documents
                console.log('\n📝 Sample email bodies:');
                const samples = await emailBodiesCollection.find({}).limit(5).toArray();
                samples.forEach((doc, index) => {
                    console.log(`  ${index + 1}. Email ID: ${doc.emailId}, Body Length: ${doc.body ? doc.body.length : 0}`);
                });

                // Check specific emails we tested
                console.log('\n🔍 Checking specific email IDs from test...');
                const testEmails = [9937, 3955, 4004, 4261, 4329, 4370, 4492, 4493];
                
                for (const emailId of testEmails) {
                    const found = await emailBodiesCollection.findOne({ emailId: emailId });
                    console.log(`  Email ${emailId}: ${found ? '✅ Found' : '❌ Not found'}`);
                }
            }
        }

        // Check a few more collections that might be relevant
        const otherCollections = ['emailbodies', 'emails', 'email_body'];
        for (const collName of otherCollections) {
            const exists = collections.some(c => c.collectionName === collName);
            if (exists) {
                const collection = mongoose.connection.db.collection(collName);
                const count = await collection.countDocuments();
                console.log(`📊 Collection '${collName}': ${count} documents`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📴 Disconnected from MongoDB');
        process.exit(0);
    }
}

checkMongoDBData();