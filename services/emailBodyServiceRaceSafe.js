const Imap = require('imap-simple');
const { simpleParser } = require('mailparser');
const { Email, UserCredential } = require('../models');

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

/**
 * Race-safe email body fetching on demand
 * Uses the EXACT same method as your working fetchRecentEmail function
 * @param {number} emailID - Database email ID
 * @param {number} masterUserID - User ID
 * @param {string} provider - Email provider (gmail, yandex, etc.)
 * @returns {Object} Result with body content
 */
exports.fetchEmailBodyOnDemandSafe = async (emailID, masterUserID, provider = 'gmail') => {
  let connection = null;
  
  try {
    console.log(`[fetchEmailBodyOnDemandSafe] 🚀 Starting for emailID: ${emailID}, masterUserID: ${masterUserID}`);
    
    // 1. Get email from database
    const email = await Email.findOne({
      where: { emailID }
    });
    
    if (!email) {
      console.log(`[fetchEmailBodyOnDemandSafe] ❌ Email ${emailID} not found in database`);
      return { success: false, error: 'Email not found in database' };
    }
    
    if (!email.uid) {
      console.log(`[fetchEmailBodyOnDemandSafe] ❌ Email ${emailID} has no UID`);
      return { success: false, error: 'Email has no UID' };
    }
    
    console.log(`[fetchEmailBodyOnDemandSafe] 📧 Found email: UID ${email.uid}, Subject: ${email.subject}`);
    
    // 2. Get user credentials
    const userCredential = await UserCredential.findOne({
      where: { masterUserID }
    });
    
    if (!userCredential) {
      console.log(`[fetchEmailBodyOnDemandSafe] ❌ No credentials found for user ${masterUserID}`);
      return { success: false, error: 'User credentials not found' };
    }
    
    console.log(`[fetchEmailBodyOnDemandSafe] 🔑 Credentials found for ${userCredential.email} (${userCredential.provider})`);
    
    // 3. Build IMAP config using your exact method
    let imapConfig;
    const actualProvider = userCredential.provider || provider;
    
    if (actualProvider === "custom") {
      if (!userCredential.imapHost || !userCredential.imapPort) {
        return { success: false, error: "Custom IMAP settings are missing in user credentials" };
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
      const providerConfig = PROVIDER_CONFIG[actualProvider];
      if (!providerConfig) {
        return { success: false, error: `Unsupported provider: ${actualProvider}` };
      }
      
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
    
    console.log(`[fetchEmailBodyOnDemandSafe] 🔌 Connecting to ${imapConfig.imap.host}:${imapConfig.imap.port}...`);
    
    // 4. Connect to IMAP with timeout
    const connectionPromise = Imap.connect(imapConfig);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('IMAP connection timeout')), 30000);
    });
    
    connection = await Promise.race([connectionPromise, timeoutPromise]);
    console.log(`[fetchEmailBodyOnDemandSafe] ✅ IMAP connected successfully`);
    
    // 5. Open INBOX
    await connection.openBox('INBOX');
    console.log(`[fetchEmailBodyOnDemandSafe] ✅ INBOX opened`);
    
    // 6. Fetch email body using YOUR EXACT WORKING METHOD
    console.log(`[fetchEmailBodyOnDemandSafe] 📥 Fetching body for UID ${email.uid}...`);
    
    // Use the EXACT same method as your fetchRecentEmail function
    const searchCriteria = [['UID', email.uid]];
    const fetchOptions = { bodies: "", struct: true }; // YOUR WORKING METHOD
    
    const messages = await connection.search(searchCriteria, fetchOptions);
    
    if (!messages || messages.length === 0) {
      console.log(`[fetchEmailBodyOnDemandSafe] ❌ No messages found for UID ${email.uid}`);
      return { success: false, error: 'No messages found for UID' };
    }
    
    console.log(`[fetchEmailBodyOnDemandSafe] ✅ Found ${messages.length} message(s)`);
    
    // 7. Extract raw body using YOUR EXACT METHOD
    const message = messages[0];
    const rawBodyPart = message.parts.find((part) => part.which === ""); // YOUR EXACT METHOD
    const rawBody = rawBodyPart ? rawBodyPart.body : null;
    
    if (!rawBody) {
      console.log(`[fetchEmailBodyOnDemandSafe] ❌ No raw body found in message parts`);
      console.log(`[fetchEmailBodyOnDemandSafe] 🔍 Available parts:`, message.parts.map(p => p.which));
      return { success: false, error: 'No raw body found in message' };
    }
    
    console.log(`[fetchEmailBodyOnDemandSafe] ✅ Raw body found, length: ${rawBody.length}`);
    console.log(`[fetchEmailBodyOnDemandSafe] 📄 Raw body preview: ${rawBody.substring(0, 200)}...`);
    
    // 8. Parse using simpleParser (YOUR EXACT METHOD)
    const parsedEmail = await simpleParser(rawBody);
    
    console.log(`[fetchEmailBodyOnDemandSafe] ✅ Email parsed successfully`);
    console.log(`[fetchEmailBodyOnDemandSafe] 📝 Parsed text length: ${parsedEmail.text ? parsedEmail.text.length : 0}`);
    console.log(`[fetchEmailBodyOnDemandSafe] 🌐 Parsed HTML length: ${parsedEmail.html ? parsedEmail.html.length : 0}`);
    console.log(`[fetchEmailBodyOnDemandSafe] 📧 Parsed subject: ${parsedEmail.subject || 'N/A'}`);
    
    // 9. Update email in database
    const bodyText = parsedEmail.text || '';
    const bodyHtml = parsedEmail.html || '';
    const finalBody = bodyHtml || bodyText || '';
    
    if (finalBody) {
      await Email.update(
        { 
          body: finalBody,
          body_fetch_status: 'fetched'
        },
        { where: { emailID } }
      );
      
      console.log(`[fetchEmailBodyOnDemandSafe] ✅ Email ${emailID} body updated in database, length: ${finalBody.length}`);
    }
    
    return {
      success: true,
      bodyText: bodyText,
      bodyHtml: bodyHtml,
      subject: parsedEmail.subject || email.subject,
      source: 'imap_on_demand'
    };
    
  } catch (error) {
    console.error(`[fetchEmailBodyOnDemandSafe] ❌ Error:`, error.message);
    console.error(`[fetchEmailBodyOnDemandSafe] ❌ Stack:`, error.stack);
    
    return {
      success: false,
      error: error.message,
      bodyText: '',
      bodyHtml: '',
      source: 'error'
    };
  } finally {
    if (connection) {
      try {
        connection.end();
        console.log(`[fetchEmailBodyOnDemandSafe] 🔌 IMAP connection closed`);
      } catch (closeError) {
        console.error(`[fetchEmailBodyOnDemandSafe] ❌ Error closing connection:`, closeError.message);
      }
    }
  }
};
