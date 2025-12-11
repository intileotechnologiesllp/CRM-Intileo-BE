const emailBodyMongoService = require('./services/emailBodyMongoService');
const { connectMongoDB } = require('./config/mongodb');

async function testDirectCall() {
    try {
        console.log('🔍 Connecting to MongoDB...');
        await connectMongoDB();
        console.log('✅ MongoDB connected');
        
        console.log('🔍 Testing direct MongoDB service call...');
        
        // Test with email 9937 which we know exists in MongoDB
        const emailID = 9937;
        const masterUserID = 38;
        
        console.log(`📧 Testing emailID: ${emailID}, masterUserID: ${masterUserID}`);
        
        const result = await emailBodyMongoService.getEmailBody(emailID, masterUserID);
        
        console.log('📋 Result:', {
            success: result.success,
            bodyLength: result.body ? result.body.length : 0,
            fetchStatus: result.fetchStatus,
            error: result.error
        });
        
        if (result.success) {
            console.log('✅ SUCCESS: MongoDB retrieval is working!');
            console.log(`📝 Body preview: ${result.body.substring(0, 100)}...`);
        } else {
            console.log('❌ FAILED: MongoDB retrieval still not working');
            console.log(`⚠️ Error: ${result.error}`);
        }
        
    } catch (error) {
        console.error('❌ Exception:', error);
    }
    
    process.exit(0);
}

testDirectCall();