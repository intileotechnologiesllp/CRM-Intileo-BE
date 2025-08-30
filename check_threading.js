const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('crm', 'root', 'mridul@123', {
  host: 'localhost',
  port: 3306,
  dialect: 'mysql',
  logging: false
});

async function checkEmails() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully');

    const [results] = await sequelize.query(`
      SELECT emailID, messageId, inReplyTo, \`references\`, subject, sender, recipient, folder, createdAt
      FROM emails
      WHERE (sender LIKE '%mridul%' OR recipient LIKE '%mridul%')
      AND subject LIKE '%test%'
      ORDER BY createdAt ASC
    `);

    console.log('Found emails:', results.length);
    results.forEach(email => {
      console.log(`ID: ${email.emailID}, Subject: ${email.subject}, Folder: ${email.folder}`);
      console.log(`  messageId: ${email.messageId}`);
      console.log(`  inReplyTo: ${email.inReplyTo || 'null'}`);
      console.log(`  references: ${email.references || 'null'}`);
      console.log('---');
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkEmails();
