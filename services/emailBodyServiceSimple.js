const Imap = require('imap-simple');
const { simpleParser } = require('mailparser');
const { Email } = require('../models/index');
const UserCredential = require('../models/email/userCredentialModel');

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
 * Connect to IMAP server for a specific user
 */
const connectToIMAP = async (masterUserID, provider = 'gmail') => {
  try {
    console.log(`🔌 Connecting to IMAP for user ${masterUserID}, provider: ${provider}`);
    
    // Get user credentials
    const userCredential = await UserCredential.findOne({
      where: { masterUserID }
    });
    
    if (!userCredential) {
      throw new Error(`No credentials found for user ${masterUserID}`);
    }
    
    // Build IMAP config
    let imapConfig;
    const actualProvider = userCredential.provider || provider;
    
    if (actualProvider === "custom") {
      if (!userCredential.imapHost || !userCredential.imapPort) {
        throw new Error("Custom IMAP settings are missing in user credentials");
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
        throw new Error(`Unsupported provider: ${actualProvider}`);
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
    
    const connection = await Imap.connect(imapConfig);
    console.log(`✅ IMAP connected successfully for ${userCredential.email}`);
    return connection;
    
  } catch (error) {
    console.error(`❌ IMAP connection failed:`, error.message);
    throw error;
  }
};

/**
 * Fetch email body on demand using the EXACT working method from fetchRecentEmail
 */
const fetchEmailBodyOnDemand = async (emailId, masterUserID, provider = 'gmail') => {
  let connection = null;
  
  try {
    console.log(`\n🔍 Starting email body fetch for emailID: ${emailId}, userID: ${masterUserID}`);
    
    // Get email from database
    const email = await Email.findOne({
      where: { emailID: emailId },
      attributes: ['emailID', 'uid', 'subject', 'body', 'body_fetch_status', 'folder'] // 🔧 RE-ENABLED body_fetch_status
    });

    if (!email) {
      console.log(`❌ Email with ID ${emailId} not found`);
      return { success: false, error: 'Email not found' };
    }

    console.log(`✅ Email found: UID ${email.uid}, Subject: ${email.subject}, Folder: ${email.folder}`);
    
    // Check if body already exists
    if (email.body && email.body.trim()) {
      console.log(`✅ Body already exists for email ${emailId}`);
      return {
        success: true,
        emailID: emailId,
        uid: email.uid,
        subject: email.subject,
        bodyText: email.body,
        bodyHtml: '',
        body: email.body, // Add the combined body for controller use
        source: 'database'
      };
    }

    if (!email.uid) {
      console.log(`❌ Email ${emailId} has no UID`);
      return { success: false, error: 'Email has no UID' };
    }

    console.log(`🔍 No body found, fetching from IMAP using WORKING METHOD...`);
    
    // 🔧 FOLDER MAPPING: Map database folder to IMAP folder name
    let imapFolderName = 'INBOX'; // Default fallback
    
    if (email.folder === 'sent') {
      // Try to find the correct sent folder name for this provider
      if (provider === 'gmail') {
        imapFolderName = '[Gmail]/Sent Mail';
      } else if (provider === 'yandex') {
        imapFolderName = 'Sent'; // Yandex uses 'Sent'
      } else {
        imapFolderName = 'Sent'; // Generic sent folder
      }
    } else if (email.folder === 'drafts') {
      if (provider === 'gmail') {
        imapFolderName = '[Gmail]/Drafts';
      } else {
        imapFolderName = 'Drafts';
      }
    } else if (email.folder === 'trash') {
      if (provider === 'gmail') {
        imapFolderName = '[Gmail]/Trash';
      } else {
        imapFolderName = 'Trash';
      }
    } else if (email.folder === 'archive') {
      if (provider === 'gmail') {
        imapFolderName = '[Gmail]/All Mail';
      } else {
        imapFolderName = 'Archive';
      }
    } else {
      // inbox or unknown - use INBOX
      imapFolderName = 'INBOX';
    }
    
    console.log(`📁 Opening folder: ${imapFolderName} (database folder: ${email.folder}, provider: ${provider})`);
    
    // Connect to IMAP
    connection = await connectToIMAP(masterUserID, provider);
    await connection.openBox(imapFolderName); // 🔧 OPEN CORRECT FOLDER
    
    // Use the EXACT working method from fetchRecentEmail
    console.log(`🎯 Using proven working method: { bodies: "", struct: true }`);
    
    const searchCriteria = [['UID', email.uid]];
    const fetchOptions = { bodies: "", struct: true }; // YOUR WORKING METHOD
    
    const messages = await connection.search(searchCriteria, fetchOptions);
    
    if (!messages || messages.length === 0) {
      console.log(`❌ No messages found for UID ${email.uid}`);
      return { success: false, error: 'No messages found for UID' };
    }
    
    console.log(`✅ Found ${messages.length} message(s) for UID ${email.uid}`);
    
    // Extract raw body using YOUR EXACT METHOD
    const message = messages[0];
    const rawBodyPart = message.parts.find((part) => part.which === ""); // YOUR EXACT METHOD
    const rawBody = rawBodyPart ? rawBodyPart.body : null;
    
    if (!rawBody) {
      console.log(`❌ No raw body found in message parts for UID ${email.uid}`);
      console.log(`🔍 Available parts:`, message.parts.map(p => ({ which: p.which, size: p.body ? p.body.length : 0 })));
      return { success: false, error: 'No raw body found in message' };
    }
    
    console.log(`✅ Raw body found for UID ${email.uid}, length: ${rawBody.length}`);
    
    // Parse using simpleParser (YOUR EXACT METHOD)
    const parsedEmail = await simpleParser(rawBody);
    
    console.log(`✅ Email parsed successfully for UID ${email.uid}`);
    console.log(`📝 Parsed text length: ${parsedEmail.text ? parsedEmail.text.length : 0}`);
    console.log(`🌐 Parsed HTML length: ${parsedEmail.html ? parsedEmail.html.length : 0}`);
    
    // Update email in database
    const bodyText = parsedEmail.text || '';
    const bodyHtml = parsedEmail.html || '';

    // Return only HTML content if available, otherwise use text content
    let finalBody = '';
    if (bodyHtml) {
      // HTML content available - use it
      finalBody = bodyHtml;
    } else if (bodyText) {
      // Only text available - use it
      finalBody = bodyText;
    }

    if (finalBody) {
      await Email.update(
        {
          body: finalBody,
          body_fetch_status: 'completed'  // 🔧 FIX: Use 'completed' instead of 'fetched'
        },
        { where: { emailID: emailId } }
      );

      console.log(`✅ Email ${emailId} body updated in database, length: ${finalBody.length}`);
    }
    
    return {
      success: true,
      emailID: emailId,
      uid: email.uid,
      subject: email.subject,
      bodyText: bodyText,
      bodyHtml: bodyHtml,
      body: finalBody, // Return the final body (HTML preferred)
      source: 'imap'
    };
    
  } catch (error) {
    console.error(`❌ Error in fetchEmailBodyOnDemand:`, error.message);
    
    return {
      success: false,
      error: error.message,
      emailID: emailId,
      source: 'error'
    };
  } finally {
    if (connection) {
      try {
        connection.end();
        console.log(`🔌 IMAP connection closed`);
      } catch (closeError) {
        console.error(`❌ Error closing connection:`, closeError.message);
      }
    }
  }
};

module.exports = {
  connectToIMAP,
  fetchEmailBodyOnDemand
};
