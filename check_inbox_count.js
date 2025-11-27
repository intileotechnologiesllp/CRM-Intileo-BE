const { Email } = require('./models');

console.log('Checking inbox email count for user 35...');

async function checkEmailCount() {
  try {
    // Count total emails by folder
    const inboxCount = await Email.count({
      where: { 
        masterUserID: 35, 
        folderType: 'inbox' 
      }
    });
    
    const sentCount = await Email.count({
      where: { 
        masterUserID: 35, 
        folderType: 'sent' 
      }
    });
    
    const draftsCount = await Email.count({
      where: { 
        masterUserID: 35, 
        folderType: 'drafts' 
      }
    });
    
    const totalCount = await Email.count({
      where: { 
        masterUserID: 35
      }
    });
    
    console.log('📧 Email count breakdown:');
    console.log(`   Inbox: ${inboxCount} emails`);
    console.log(`   Sent: ${sentCount} emails`);
    console.log(`   Drafts: ${draftsCount} emails`);
    console.log(`   Total: ${totalCount} emails`);
    console.log('');
    
    if (totalCount !== (inboxCount + sentCount + draftsCount)) {
      const otherCount = totalCount - (inboxCount + sentCount + draftsCount);
      console.log(`   Other folders: ${otherCount} emails`);
    }
    
    // Get the latest 5 emails to see recent activity
    const latestEmails = await Email.findAll({
      where: { 
        masterUserID: 35,
        folderType: 'inbox'
      },
      order: [['dateReceived', 'DESC']],
      limit: 5,
      attributes: ['subject', 'dateReceived', 'folderType']
    });
    
    console.log('� Latest 5 inbox emails:');
    latestEmails.forEach((email, idx) => {
      console.log(`${idx + 1}. ${email.subject} (${email.dateReceived})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking email count:', error);
    process.exit(1);
  }
}

checkEmailCount();
