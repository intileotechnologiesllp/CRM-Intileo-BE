const mysql = require('mysql2/promise');
const Imap = require('imap-simple');
const { simpleParser } = require('mailparser');

// Database configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'mridul@123',
  database: 'crm',
  port: 3306
};

// Provider configurations
const PROVIDER_CONFIG = {
  gmail: {
    host: "imap.gmail.com",
    port: 993,
    tls: true,
  },
  yandex: {
    host: "imap.yandex.com",
    port: 993,
    tls: true,
  },
  outlook: {
    host: "outlook.office365.com",
    port: 993,
    tls: true,
  }
};

async function testWorkingMethod() {
  let connection = null;
  let imapConnection = null;
  
  const TARGET_MASTER_USER_ID = 35;
  const TARGET_EMAIL_ID = 4545;
  
  try {
    console.log('🎯 TESTING WITH YOUR WORKING METHOD');
    console.log('====================================');
    console.log(`Testing masterUserID: ${TARGET_MASTER_USER_ID}, emailID: ${TARGET_EMAIL_ID}`);
    
    // 1. Connect to database and get credentials
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected');
    
    const [credentials] = await connection.execute(`
      SELECT masterUserID, provider, email, appPassword, imapHost, imapPort, imapTLS 
      FROM usercredentials 
      WHERE masterUserID = ?
    `, [TARGET_MASTER_USER_ID]);
    
    if (credentials.length === 0) {
      console.log(`❌ No credentials found for user ${TARGET_MASTER_USER_ID}`);
      return;
    }
    
    const userCredential = credentials[0];
    console.log(`✅ Found credentials for ${userCredential.email} (${userCredential.provider})`);
    
    // 2. Get email UID
    const [emails] = await connection.execute(`
      SELECT emailID, uid, subject, messageId 
      FROM emails 
      WHERE emailID = ?
    `, [TARGET_EMAIL_ID]);
    
    if (emails.length === 0) {
      console.log(`❌ Email ${TARGET_EMAIL_ID} not found`);
      return;
    }
    
    const email = emails[0];
    console.log(`✅ Found email: UID ${email.uid}, Subject: ${email.subject}`);
    
    // 3. Build IMAP config (using your exact logic)
    const provider = userCredential.provider;
    let imapConfig;
    
    if (provider === "custom") {
      if (!userCredential.imapHost || !userCredential.imapPort) {
        console.log("❌ Custom IMAP settings are missing");
        return;
      }
      imapConfig = {
        imap: {
          user: userCredential.email,
          password: userCredential.appPassword,
          host: userCredential.imapHost,
          port: userCredential.imapPort,
          tls: userCredential.imapTLS,
          authTimeout: 30000,
          tlsOptions: { rejectUnauthorized: false },
        },
      };
    } else {
      const providerConfig = PROVIDER_CONFIG[provider];
      imapConfig = {
        imap: {
          user: userCredential.email,
          password: userCredential.appPassword,
          host: providerConfig.host,
          port: providerConfig.port,
          tls: providerConfig.tls,
          authTimeout: 30000,
          tlsOptions: { rejectUnauthorized: false },
        },
      };
    }
    
    console.log(`🔌 Connecting to ${imapConfig.imap.host}:${imapConfig.imap.port}...`);
    
    // 4. Connect to IMAP (using your exact method)
    imapConnection = await Imap.connect(imapConfig);
    console.log('✅ IMAP connected successfully');
    
    await imapConnection.openBox('INBOX');
    console.log('✅ INBOX opened');
    
    // 5. Test the EXACT method from your working code
    console.log('\n🧪 TESTING YOUR WORKING METHOD');
    console.log('===============================');
    console.log(`Fetching UID ${email.uid} using: { bodies: "", struct: true }`);
    
    try {
      // Use the EXACT search method from your working code
      const messages = await imapConnection.search(
        [["UID", email.uid]], 
        { bodies: "", struct: true }  // <-- This is your working method!
      );
      
      if (!messages || messages.length === 0) {
        console.log("❌ No messages returned");
        return;
      }
      
      console.log(`✅ Got ${messages.length} message(s)`);
      
      const message = messages[0];
      console.log('📋 Message structure:');
      console.log('   - UID:', message.attributes?.uid);
      console.log('   - Flags:', message.attributes?.flags);
      console.log('   - Parts count:', message.parts?.length || 0);
      
      // Use your EXACT body extraction method
      const rawBodyPart = message.parts.find((part) => part.which === "");
      const rawBody = rawBodyPart ? rawBodyPart.body : null;
      
      if (!rawBody) {
        console.log("❌ No raw body found");
        return;
      }
      
      console.log(`✅ Raw body found: ${rawBody.length} characters`);
      console.log(`📄 First 200 chars: "${rawBody.substring(0, 200)}"`);
      
      // Parse using simpleParser (your exact method)
      console.log('\n📧 PARSING WITH SIMPLE PARSER');
      console.log('==============================');
      
      const parsedEmail = await simpleParser(rawBody);
      
      console.log('✅ Email parsed successfully!');
      console.log(`   📝 Subject: ${parsedEmail.subject || 'N/A'}`);
      console.log(`   👤 From: ${parsedEmail.from?.value?.[0]?.address || 'N/A'}`);
      console.log(`   📅 Date: ${parsedEmail.date || 'N/A'}`);
      console.log(`   📄 Text: ${parsedEmail.text?.length || 0} chars`);
      console.log(`   🌐 HTML: ${parsedEmail.html?.length || 0} chars`);
      
      if (parsedEmail.text) {
        console.log(`\n📝 TEXT CONTENT (first 300 chars):`);
        console.log(parsedEmail.text.substring(0, 300));
      }
      
      if (parsedEmail.html) {
        console.log(`\n🌐 HTML CONTENT (first 300 chars):`);
        console.log(parsedEmail.html.substring(0, 300));
      }
      
      console.log('\n🎉 SUCCESS! Your method works perfectly!');
      console.log('✅ This confirms that { bodies: "", struct: true } is the right approach');
      
    } catch (fetchError) {
      console.error('❌ Body fetch failed:', fetchError.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (imapConnection) {
      console.log('\n🔌 Closing IMAP connection...');
      imapConnection.end();
    }
    if (connection) {
      console.log('🔌 Closing database connection...');
      connection.end();
    }
  }
}

console.log('🧪 TESTING YOUR WORKING IMAP METHOD');
console.log('📧 Target: masterUserID 35, emailID 4545');
console.log('🔧 Using your exact fetchRecentEmail approach');
console.log('─'.repeat(50));

testWorkingMethod().catch(console.error);
