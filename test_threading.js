const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('crm', 'root', 'mridul@123', {
  host: 'localhost',
  port: 3306,
  dialect: 'mysql',
  logging: false
});

async function testEnhancedThreading() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully');

    // Test the enhanced threading logic for the specific email
    const emailId = 6781;
    const mainEmail = {
      subject: "Re: test0.1",
      sender: "mridulverma2533@gmail.com",
      recipient: "mridul.kumar@intileo.com",
      messageId: "<CAO3MsephkfoeVK_sMzGSAFKjiMMp_eg+_2wWMNMqxzdm4G0UNQ@mail.gmail.com>"
    };

    console.log('Testing enhanced threading for:');
    console.log('Subject:', mainEmail.subject);
    console.log('Sender:', mainEmail.sender);
    console.log('Recipient:', mainEmail.recipient);

    // Extract base subject (remove Re:, Fwd:, etc.)
    const baseSubject = mainEmail.subject
      .replace(/^(Re|Fwd|Fw):\s*/i, '')
      .trim();

    console.log('Base subject:', baseSubject);

    // Get participants from main email
    const participants = [
      mainEmail.sender,
      mainEmail.recipient
    ].filter(Boolean);

    console.log('Participants:', participants);

    // Test the query that enhanced threading would use
    const [results] = await sequelize.query(`
      SELECT emailID, messageId, subject, sender, recipient, folder, createdAt
      FROM emails
      WHERE (
        subject LIKE '%${baseSubject}%'
        OR subject LIKE '%Re: ${baseSubject}%'
        OR subject LIKE '%Fwd: ${baseSubject}%'
        OR subject LIKE '%Fw: ${baseSubject}%'
      )
      AND (
        sender IN ('${participants.join("','")}')
        OR recipient IN ('${participants.join("','")}')
      )
      AND folder IN ('inbox', 'sent')
      AND messageId != '${mainEmail.messageId}'
      ORDER BY createdAt ASC
      LIMIT 20
    `);

    console.log(`\nFound ${results.length} related emails via enhanced threading:`);
    results.forEach(email => {
      console.log(`ID: ${email.emailID}, Subject: ${email.subject}, Folder: ${email.folder}`);
      console.log(`  Sender: ${email.sender}, Recipient: ${email.recipient}`);
      console.log('---');
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

testEnhancedThreading();
