const { Email } = require('./models/index');
const Attachment = require('./models/email/attachmentModel');

async function testInlineImages() {
  try {
    console.log('🔍 Searching for emails with cid: references...');
    
    // Find emails with cid: references in the body
    const emailsWithCids = await Email.findAll({
      where: {
        body: {
          [require('sequelize').Op.like]: '%cid:%'
        }
      },
      limit: 5,
      include: [{
        model: Attachment,
        as: 'attachments'
      }]
    });
    
    console.log(`\n📧 Found ${emailsWithCids.length} emails with cid: references:`);
    
    for (const email of emailsWithCids) {
      console.log(`\n📨 Email ID: ${email.emailID}`);
      console.log(`📝 Subject: ${email.subject || 'No subject'}`);
      console.log(`📎 Attachments: ${email.attachments?.length || 0}`);
      
      // Find cid: references in the body
      const cidMatches = (email.body || '').match(/cid:([^"'\s>]+)/gi);
      if (cidMatches) {
        console.log(`🔗 CID references found: ${cidMatches.join(', ')}`);
        
        // Test our cleanEmailBody function
        const { cleanEmailBody } = require('./controllers/email/emailController');
        console.log('🧪 Testing CID replacement...');
        
        // Note: This won't work because cleanEmailBody is not exported, but we can see the logic
        console.log(`📄 Original body (first 100 chars): ${email.body.substring(0, 100)}...`);
      }
    }
    
    if (emailsWithCids.length === 0) {
      console.log('❌ No emails found with cid: references');
      
      // Check a few recent emails to see their content
      console.log('\n🔍 Checking recent emails for any attachment patterns...');
      const recentEmails = await Email.findAll({
        limit: 3,
        order: [['createdAt', 'DESC']],
        include: [{
          model: Attachment,
          as: 'attachments'
        }]
      });
      
      for (const email of recentEmails) {
        console.log(`\n📨 Recent Email ID: ${email.emailID}`);
        console.log(`📝 Subject: ${email.subject || 'No subject'}`);
        console.log(`📎 Attachments: ${email.attachments?.length || 0}`);
        if (email.body) {
          console.log(`📄 Body preview: ${email.body.substring(0, 200)}...`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing inline images:', error);
  }
}

testInlineImages().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
});
