const mysql = require('mysql2/promise');
const Imap = require('imap-simple');
const { simpleParser } = require('mailparser');

// Database configuration
const dbConfig = {
  host: '213.136.77.55',
  user: 'root',
  password: 'Intileo@123',
  database: 'crm',
  port: 3308
};

// Provider configurations
const PROVIDER_CONFIG = {
  yandex: {
    host: "imap.yandex.com",
    port: 993,
    tls: true,
  }
};

async function quickTest() {
  let connection = null;
  let imapConnection = null;
  
  const TARGET_MASTER_USER_ID = 35;
  const TARGET_EMAIL_ID = 4545;
  
  try {
    console.log(`🎯 QUICK TEST: masterUserID ${TARGET_MASTER_USER_ID}, emailID ${TARGET_EMAIL_ID}`);
    
    // 1. Connect to database
    console.log('📊 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected');
    
    // 2. Get user credentials
    console.log(`🔍 Getting credentials for user ${TARGET_MASTER_USER_ID}...`);
    const [credentials] = await connection.execute(`
      SELECT masterUserID, provider, email, appPassword 
      FROM usercredentials 
      WHERE masterUserID = ?
    `, [TARGET_MASTER_USER_ID]);
    
    if (credentials.length === 0) {
      console.log(`❌ No credentials found for user ${TARGET_MASTER_USER_ID}`);
      return;
    }
    
    const cred = credentials[0];
    console.log(`✅ Found credentials: ${cred.email} (${cred.provider})`);
    console.log(`🔑 Password length: ${cred.appPassword ? cred.appPassword.length : 0}`);
    
    // 3. Get email info
    console.log(`📧 Getting email ${TARGET_EMAIL_ID}...`);
    const [emails] = await connection.execute(`
      SELECT emailID, uid, subject, messageId, body
      FROM emails 
      WHERE emailID = ?
    `, [TARGET_EMAIL_ID]);
    
    if (emails.length === 0) {
      console.log(`❌ Email ${TARGET_EMAIL_ID} not found`);
      return;
    }
    
    const email = emails[0];
    console.log(`✅ Found email: UID ${email.uid}, Subject: ${email.subject}`);
    console.log(`📄 Current body: ${email.body ? email.body.length + ' chars' : 'EMPTY'}`);
    
    // 4. Test IMAP connection
    console.log(`🔌 Connecting to IMAP...`);
    const providerConfig = PROVIDER_CONFIG[cred.provider];
    
    const imapConfig = {
      imap: {
        user: cred.email,
        password: cred.appPassword,
        host: providerConfig.host,
        port: providerConfig.port,
        tls: providerConfig.tls,
        authTimeout: 30000,
        tlsOptions: { rejectUnauthorized: false }
      }
    };
    
    console.log(`🔐 Connecting to ${imapConfig.imap.host}:${imapConfig.imap.port}...`);
    imapConnection = await Imap.connect(imapConfig);
    console.log('✅ IMAP connected');
    
    await imapConnection.openBox('INBOX');
    console.log('✅ INBOX opened');
    
    // 5. Test UID exists
    console.log(`🔍 Checking if UID ${email.uid} exists...`);
    const searchCriteria = [['UID', email.uid]];
    const uidCheck = await imapConnection.search(searchCriteria);
    
    if (!uidCheck || uidCheck.length === 0) {
      console.log(`❌ UID ${email.uid} not found in mailbox`);
      return;
    }
    console.log(`✅ UID ${email.uid} exists`);
    
    // 6. Test different fetch methods one by one
    console.log('\n🧪 Testing IMAP fetch methods...');
    
    const methods = [
      'RFC822',
      'BODY[]',
      'BODY.PEEK[]',
      'TEXT',
      'HEADER',
      'BODY[1]',
      'BODY.PEEK[1]'
    ];
    
    for (const method of methods) {
      try {
        console.log(`\n🔧 Testing: ${method}`);
        const results = await imapConnection.search(searchCriteria, { bodies: method });
        
        if (results && results.length > 0 && results[0].bodies) {
          const bodyKeys = Object.keys(results[0].bodies);
          console.log(`   📋 Body keys: [${bodyKeys.join(', ')}]`);
          
          if (bodyKeys.length > 0) {
            const body = results[0].bodies[bodyKeys[0]];
            if (body && body.length > 0) {
              console.log(`   ✅ SUCCESS! Got ${body.length} chars`);
              console.log(`   📄 First 100 chars: "${body.substring(0, 100)}"`);
              
              // Try to parse if it looks like email content
              if (body.includes('Content-Type') || body.includes('Subject:')) {
                try {
                  const parsed = await simpleParser(body);
                  console.log(`   🎯 PARSED: Text: ${parsed.text?.length || 0}, HTML: ${parsed.html?.length || 0}`);
                  
                  if (parsed.text && parsed.text.length > 10) {
                    console.log(`\n🎉 WORKING METHOD FOUND: ${method}`);
                    console.log(`📝 Text content: "${parsed.text.substring(0, 200)}..."`);
                    return { method, parsed };
                  }
                } catch (parseErr) {
                  console.log(`   ❌ Parse failed: ${parseErr.message}`);
                }
              }
            } else {
              console.log(`   ⚠️ Empty body`);
            }
          } else {
            console.log(`   ⚠️ No body keys`);
          }
        } else {
          console.log(`   ⚠️ No results`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    
    console.log('\n❌ No working method found');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (imapConnection) {
      console.log('\n🔌 Closing IMAP...');
      imapConnection.end();
    }
    if (connection) {
      console.log('🔌 Closing database...');
      connection.end();
    }
  }
}

// Run the test
quickTest().catch(console.error);
