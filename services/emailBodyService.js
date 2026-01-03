// REFACTORED: Models now passed as parameters to support dynamic databases
const Imap = require('imap-simple');
const NodeImap = require('imap');
const { simpleParser } = require('mailparser');


// � Simple email body fetching service - no race conditions
// Removed race condition protection for simplicity

// 🔧 DEBUG: Log what was imported
console.log('🌟🌟🌟 EMAIL BODY SERVICE MAIN FILE LOADED 🌟🌟🌟');
console.log('🎯 THIS IS THE MAIN emailBodyService.js FILE BEING USED!');
console.log('🎯 File timestamp:', new Date().toISOString());
console.log('🔧 DEBUG: Email model imported:', typeof Email, Email ? 'EXISTS' : 'UNDEFINED');
console.log('🔧 DEBUG: UserCredential model imported:', typeof UserCredential, UserCredential ? 'EXISTS' : 'UNDEFINED');
console.log('🔧 DEBUG: Email.findOne available:', typeof Email?.findOne);
console.log('🔧 DEBUG: Email.update available:', typeof Email?.update);

// ✅ FIX: Use same PROVIDER_CONFIG as fetchInboxEmails
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
  },
  yahoo: {
    host: "imap.mail.yahoo.com",
    port: 993,
    tls: true,
  },
};

// ✅ ADD: Clean email body function
const cleanEmailBody = (body) => {
  if (!body) return "";
  // Remove quoted replies (e.g., lines starting with ">")
  return body
    .split("\n")
    .filter((line) => !line.startsWith(">"))
    .join("\n")
    .trim();
};

// IMAP connection logic
const connectToIMAP = async (masterUserID, provider, UserCredential) => {
  let imapConfig;
  let userCredential;
  
  try {
    console.log(`🔌 REAL IMAP CONNECTION: ${provider} for user ${masterUserID}`);
    
    // Get real user credentials from database with proper error handling
    console.log(`🔍 FETCHING CREDENTIALS: Looking for masterUserID ${masterUserID}`);
    userCredential = await UserCredential.findOne({
      where: { masterUserID: masterUserID }
    });

    if (!userCredential) {
      console.error(`❌ CREDENTIAL ERROR: No credentials found for user ${masterUserID}`);
      throw new Error(`No credentials found for user ${masterUserID}`);
    }

    console.log(`✅ CREDENTIALS FOUND: Provider=${userCredential.provider}, Email=${userCredential.email}`);
    console.log(`🔐 CREDENTIAL DETAILS: HasPassword=${!!userCredential.appPassword}, PasswordLength=${userCredential.appPassword ? userCredential.appPassword.length : 0}`);

    const providerd = userCredential.provider; // Use same variable name as fetchInboxEmails
    
    // ✅ FIX: Use same logic as fetchInboxEmails for provider config
    if (providerd === "custom") {
      if (!userCredential.imapHost || !userCredential.imapPort) {
        throw new Error(`Custom IMAP settings missing for user ${masterUserID}`);
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
          keepalive: true, // ✅ FIX: Add keepalive like fetchInboxEmails
        },
      };
      
      console.log(`🔧 CUSTOM IMAP CONFIG: ${userCredential.imapHost}:${userCredential.imapPort}`);
    } else {
      // ✅ FIX: Use PROVIDER_CONFIG like fetchInboxEmails
      const providerConfig = PROVIDER_CONFIG[providerd];
      if (!providerConfig) {
        throw new Error(`Unsupported provider: ${providerd}`);
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
          keepalive: true, // ✅ FIX: Add keepalive like fetchInboxEmails
        },
      };
      
      console.log(`� PROVIDER CONFIG: ${providerd} -> ${providerConfig.host}:${providerConfig.port}`);
    }

    console.log(`🔐 IMAP AUTHENTICATION: About to attempt login...`);
    console.log(`🔐 IMAP CONFIG FULL:`, {
      host: imapConfig.imap.host,
      port: imapConfig.imap.port,
      user: imapConfig.imap.user,
      passwordLength: imapConfig.imap.password ? imapConfig.imap.password.length : 0,
      tls: imapConfig.imap.tls,
      authTimeout: imapConfig.imap.authTimeout,
      keepalive: imapConfig.imap.keepalive
    });
    
    // ✅ FIX: Use same connection method as fetchInboxEmails
    const connection = await Imap.connect(imapConfig);
    console.log(`✅ REAL IMAP CONNECTION ESTABLISHED: ${userCredential.provider}`);
    
    return connection;
  } catch (error) {
    console.error(`❌ REAL IMAP CONNECTION FAILED for user ${masterUserID}:`, error.message);
    console.error(`❌ Connection attempt details:`);
    console.error(`   Host: ${imapConfig?.imap?.host || 'Unknown'}`);
    console.error(`   Port: ${imapConfig?.imap?.port || 'Unknown'}`);  
    console.error(`   User: ${imapConfig?.imap?.user || 'Unknown'}`);
    console.error(`   TLS: ${imapConfig?.imap?.tls || 'Unknown'}`);
    console.error(`   Provider: ${userCredential?.provider || 'Unknown'}`);
    console.error(`❌ Full error stack:`, error.stack);
    
    // Special handling for Yandex authentication issues
    if (userCredential?.provider === 'yandex' && error.message.includes('invalid credentials')) {
      console.error(`🔍 YANDEX SPECIFIC TROUBLESHOOTING:`);
      console.error(`   1. Check if IMAP access is enabled in Yandex Mail settings`);
      console.error(`   2. Verify the app password is generated specifically for IMAP`);
      console.error(`   3. Try connecting with regular email clients first`);
      console.error(`   4. Check if 2FA is properly configured`);
    }
    
    throw error;
  }
};

// Fetch email body using BODY.PEEK[] method (works with restrictive IMAP servers)
const fetchEmailBodyOnDemand = async (emailId, masterUserID, provider, Email, UserCredential) => {
  const startTime = Date.now();
  
  try {
    console.log(`\n� WORKING: Starting email body fetch for emailID: ${emailId}, userID: ${masterUserID}`);
    console.log(`🎯 USING PROVEN WORKING METHOD: Direct node-imap with empty bodies parameter`);
    
    // Get email info
    const email = await Email.findOne({
      where: { emailID: emailId },
      attributes: ['emailID', 'uid', 'subject', 'body', 'body_fetch_status']
    });

    if (!email) {
      console.log(`❌ Email with ID ${emailId} not found`);
      return { success: false, error: 'Email not found' };
    }

    console.log(`✅ Email found: UID ${email.uid}, Subject: ${email.subject}`);
    
    // If body already exists, return it
    if (email.body_fetch_status === 'fetched' && email.body) {
      console.log(`✅ Body already cached for email ${emailId}`);
      return {
        success: true,
        emailID: emailId,
        uid: email.uid,
        subject: email.subject,
        bodyText: email.body,
        bodyHtml: '',
        cached: true
      };
    }

    // Mark as fetching to prevent duplicate requests
    await Email.update(
      { body_fetch_status: 'fetching' },
      { where: { emailID: emailId } }
    );
    
    // Get user credentials
    const credentials = await UserCredential.findOne({
      where: { masterUserID },
      attributes: ['email', 'appPassword', 'provider']
    });

    if (!credentials) {
      console.log(`❌ User credentials not found for userID: ${masterUserID}`);
      await Email.update(
        { body_fetch_status: 'failed' },
        { where: { emailID: emailId } }
      );
      return { success: false, error: 'User credentials not found' };
    }

    console.log(`✅ Using credentials for: ${credentials.email} (provider: ${credentials.provider})`);

    // Use direct node-imap for Yandex compatibility - THIS IS THE WORKING METHOD!
    const NodeImap = require('imap');
    const { simpleParser } = require('mailparser');
    
    const imapConfig = {
      user: credentials.email,
      password: credentials.appPassword,
      host: credentials.provider === 'yandex' ? 'imap.yandex.com' : 'imap.gmail.com',
      port: 993,
      tls: true,
      authTimeout: 10000,
      connTimeout: 10000,
      tlsOptions: {
        rejectUnauthorized: false
      }
    };

    console.log(`🔌 Connecting to ${credentials.provider} IMAP using direct node-imap...`);

    return new Promise((resolve, reject) => {
      const imap = new NodeImap(imapConfig);
      let emailBody = null;

      imap.once('ready', () => {
        console.log('✅ IMAP connected and ready');
        
        imap.openBox('INBOX', true, (err, box) => {
          if (err) {
            console.log(`❌ Error opening INBOX: ${err.message}`);
            imap.end();
            return reject(err);
          }
          
          console.log('✅ INBOX opened successfully');
          console.log(`🔍 Searching for UID: ${email.uid}`);

          // Search for the specific UID
          imap.search([['UID', email.uid.toString()]], (err, results) => {
            if (err) {
              console.log(`❌ Search error: ${err.message}`);
              imap.end();
              return reject(err);
            }

            if (!results || results.length === 0) {
              console.log('❌ No messages found with UID search');
              imap.end();
              return reject(new Error('No messages found with specified UID'));
            }

            console.log(`✅ Found message with UID: ${email.uid}`);
            console.log('🔧 Fetching email body using WORKING METHOD (empty bodies parameter)...');

            // 🎯 THIS IS THE WORKING METHOD: fetch with empty bodies parameter
            const f = imap.fetch(results, { bodies: '', struct: true });
            
            f.on('message', (msg, seqno) => {
              console.log(`📧 Processing message ${seqno}`);
              
              msg.on('body', (stream, info) => {
                console.log('📄 Receiving body stream, size:', info.size || 'unknown');
                let buffer = '';
                
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('utf8');
                });
                
                stream.once('end', () => {
                  console.log(`✅ Body received: ${buffer.length} chars`);
                  emailBody = buffer;
                });
              });

              msg.once('attributes', (attrs) => {
                console.log(`📋 Message attributes: UID=${attrs.uid}, Date=${attrs.date}`);
              });

              msg.once('end', () => {
                console.log('📬 Fetch completed');
              });
            });

            f.once('error', (err) => {
              console.log(`❌ Fetch error: ${err.message}`);
              imap.end();
              reject(err);
            });

            f.once('end', async () => {
              console.log('✅ All messages fetched');
              imap.end();

              if (!emailBody) {
                console.log('❌ No email body content retrieved');
                await Email.update(
                  { body_fetch_status: 'failed' },
                  { where: { emailID: emailId } }
                );
                return resolve({
                  success: false,
                  error: 'No body content found'
                });
              }

              // Parse the email content with mailparser
              console.log('🔧 Parsing email with mailparser...');
              try {
                const parsedEmail = await simpleParser(emailBody);
                console.log('✅ Parsing successful:');
                console.log(`   📄 Text: ${parsedEmail.text ? parsedEmail.text.length : 0} chars`);
                console.log(`   🌐 HTML: ${parsedEmail.html ? parsedEmail.html.length : 0} chars`);
                console.log(`   📧 Subject: ${parsedEmail.subject || 'No subject'}`);

                // Update email in database with fetched body
                await Email.update(
                  { 
                    body: parsedEmail.text || emailBody,
                    body_fetch_status: 'fetched'
                  },
                  { where: { emailID: emailId } }
                );

                const executionTime = Date.now() - startTime;
                console.log(`🎯 SUCCESS! Email body fetched and cached in ${executionTime}ms`);
                
                resolve({
                  success: true,
                  emailID: emailId,
                  uid: email.uid,
                  subject: parsedEmail.subject || email.subject,
                  bodyText: parsedEmail.text || '',
                  bodyHtml: parsedEmail.html || '',
                  from: parsedEmail.from,
                  date: parsedEmail.date,
                  rawBodySize: emailBody.length,
                  method: 'direct-node-imap-empty-bodies',
                  executionTime
                });

              } catch (parseError) {
                console.log(`⚠️ Parsing failed: ${parseError.message}, saving raw content`);
                
                // Update email in database with raw body
                await Email.update(
                  { 
                    body: emailBody,
                    body_fetch_status: 'fetched'
                  },
                  { where: { emailID: emailId } }
                );
                
                const executionTime = Date.now() - startTime;
                
                resolve({
                  success: true,
                  emailID: emailId,
                  uid: email.uid,
                  subject: email.subject,
                  bodyText: emailBody,
                  bodyHtml: '',
                  from: null,
                  date: null,
                  rawBodySize: emailBody.length,
                  method: 'direct-node-imap-raw',
                  executionTime
                });
              }
            });
          });
        });
      });

      imap.once('error', (err) => {
        console.log(`❌ IMAP connection error: ${err.message}`);
        reject(err);
      });

      imap.once('end', () => {
        console.log('🔌 IMAP connection ended');
      });

      // Connect to IMAP
      imap.connect();
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`❌ Error in fetchEmailBodyOnDemand:`, error);
    
    // Mark as failed
    await Email.update(
      { body_fetch_status: 'failed' },
      { where: { emailID: emailId } }
    );
    
    return {
      success: false,
      error: error.message,
      emailID: emailId,
      executionTime
    };
  }
};

// Helper function for actual IMAP fetch
const performActualFetch = async (emailId, email, masterUserID, provider, startTime, Email, UserCredential) => {
  try {
    console.log(`🚀 PERFORMING ACTUAL FETCH: Email ${emailId}`);
    
    // Get user credentials
    const credentials = await UserCredential.findOne({
      where: { masterUserID },
      attributes: ['email', 'appPassword', 'provider']
    });

    if (!credentials) {
      console.log(`❌ User credentials not found for userID: ${masterUserID}`);
      await Email.update(
        { body_fetch_status: 'failed' },
        { where: { emailID: emailId } }
      );
      return { success: false, error: 'User credentials not found' };
    }

    console.log(`✅ Using credentials for: ${credentials.email} (provider: ${credentials.provider})`);

    // Use direct node-imap for Yandex compatibility - THIS IS THE WORKING METHOD!
    const imapConfig = {
      user: credentials.email,
      password: credentials.appPassword,
      host: credentials.provider === 'yandex' ? 'imap.yandex.com' : 'imap.gmail.com',
      port: 993,
      tls: true,
      authTimeout: 10000,
      connTimeout: 10000,
      tlsOptions: {
        rejectUnauthorized: false
      }
    };

    console.log(`🔌 Connecting to ${credentials.provider} IMAP using direct node-imap...`);

    return new Promise((resolve, reject) => {
      const imap = new NodeImap(imapConfig);
      let emailBody = null;

      imap.once('ready', () => {
        console.log('✅ IMAP connected and ready');
        
        imap.openBox('INBOX', true, (err, box) => {
          if (err) {
            console.log(`❌ Error opening INBOX: ${err.message}`);
            imap.end();
            return reject(err);
          }
          
          console.log('✅ INBOX opened successfully');
          console.log(`🔍 Searching for UID: ${email.uid}`);

          // Search for the specific UID
          imap.search([['UID', email.uid.toString()]], (err, results) => {
            if (err) {
              console.log(`❌ Search error: ${err.message}`);
              imap.end();
              return reject(err);
            }

            if (!results || results.length === 0) {
              console.log('❌ No messages found with UID search');
              imap.end();
              return reject(new Error('No messages found with specified UID'));
            }

            console.log(`✅ Found message with UID: ${email.uid}`);
            console.log('🔧 Fetching email body using WORKING METHOD (empty bodies parameter)...');

            // 🎯 THIS IS THE WORKING METHOD: fetch with empty bodies parameter
            const f = imap.fetch(results, { bodies: '', struct: true });
            
            f.on('message', (msg, seqno) => {
              console.log(`📧 Processing message ${seqno}`);
              
              msg.on('body', (stream, info) => {
                console.log('📄 Receiving body stream, size:', info.size || 'unknown');
                let buffer = '';
                
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('utf8');
                });
                
                stream.once('end', () => {
                  console.log(`✅ Body received: ${buffer.length} chars`);
                  emailBody = buffer;
                });
              });

              msg.once('attributes', (attrs) => {
                console.log(`📋 Message attributes: UID=${attrs.uid}, Date=${attrs.date}`);
              });

              msg.once('end', () => {
                console.log('📬 Fetch completed');
              });
            });

            f.once('error', (err) => {
              console.log(`❌ Fetch error: ${err.message}`);
              imap.end();
              reject(err);
            });

            f.once('end', async () => {
              console.log('✅ All messages fetched');
              imap.end();

              if (!emailBody) {
                console.log('❌ No email body content retrieved');
                await Email.update(
                  { body_fetch_status: 'failed' },
                  { where: { emailID: emailId } }
                );
                return resolve({
                  success: false,
                  error: 'No body content found'
                });
              }

              // Parse the email content with mailparser
              console.log('🔧 Parsing email with mailparser...');
              try {
                const parsedEmail = await simpleParser(emailBody);
                console.log('✅ Parsing successful:');
                console.log(`   📄 Text: ${parsedEmail.text ? parsedEmail.text.length : 0} chars`);
                console.log(`   🌐 HTML: ${parsedEmail.html ? parsedEmail.html.length : 0} chars`);
                console.log(`   📧 Subject: ${parsedEmail.subject || 'No subject'}`);

                // Update email in database with fetched body
                await Email.update(
                  { 
                    body: parsedEmail.text || emailBody,
                    body_fetch_status: 'fetched'
                  },
                  { where: { emailID: emailId } }
                );

                const executionTime = Date.now() - startTime;
                console.log(`🎯 SUCCESS! Email body fetched and cached in ${executionTime}ms`);
                
                resolve({
                  success: true,
                  emailID: emailId,
                  uid: email.uid,
                  subject: parsedEmail.subject || email.subject,
                  bodyText: parsedEmail.text || '',
                  bodyHtml: parsedEmail.html || '',
                  from: parsedEmail.from,
                  date: parsedEmail.date,
                  rawBodySize: emailBody.length,
                  method: 'direct-node-imap-empty-bodies',
                  executionTime
                });

              } catch (parseError) {
                console.log(`⚠️ Parsing failed: ${parseError.message}, saving raw content`);
                
                // Update email in database with raw body
                await Email.update(
                  { 
                    body: emailBody,
                    body_fetch_status: 'fetched'
                  },
                  { where: { emailID: emailId } }
                );
                
                const executionTime = Date.now() - startTime;
                
                resolve({
                  success: true,
                  emailID: emailId,
                  uid: email.uid,
                  subject: email.subject,
                  bodyText: emailBody,
                  bodyHtml: '',
                  from: null,
                  date: null,
                  rawBodySize: emailBody.length,
                  method: 'direct-node-imap-raw',
                  executionTime
                });
              }
            });
          });
        });
      });

      imap.once('error', (err) => {
        console.log(`❌ IMAP connection error: ${err.message}`);
        reject(err);
      });

      imap.once('end', () => {
        console.log('🔌 IMAP connection ended');
      });

      // Connect to IMAP
      imap.connect();
    });

  } catch (error) {
    console.error(`❌ Error in performActualFetch:`, error);
    
    // Mark as failed
    await Email.update(
      { body_fetch_status: 'failed' },
      { where: { emailID: emailId } }
    );
    
    throw error;
  }
};

const fetchSingleEmailBodyWithBodyPeek = async (connection, email) => {
  console.log(`🔍 FETCHING EMAIL BODY using your WORKING METHOD for UID: ${email.uid}`);
  
  if (!email.uid) {
    console.log(`⚠️ No UID available for email ${email.emailID}, cannot fetch body`);
    return email;
  }

  const { uid } = email;
  
  try {
    console.log(`🎯 Using proven working method: { bodies: "", struct: true }`);
    
    // Fetch the email using the EXACT working method from fetchRecentEmail
    const searchCriteria = [['UID', uid]];
    const fetchOptions = { bodies: "", struct: true }; // YOUR WORKING METHOD
    
    const messages = await connection.search(searchCriteria, fetchOptions);
    
    if (!messages || messages.length === 0) {
      console.log(`❌ No messages found for UID ${uid}`);
      return email;
    }
    
    console.log(`✅ Found ${messages.length} message(s) for UID ${uid}`);
    
    // Extract raw body using YOUR EXACT METHOD
    const message = messages[0];
    const rawBodyPart = message.parts.find((part) => part.which === ""); // YOUR EXACT METHOD
    const rawBody = rawBodyPart ? rawBodyPart.body : null;
    
    if (!rawBody) {
      console.log(`❌ No raw body found in message parts for UID ${uid}`);
      console.log(`🔍 Available parts:`, message.parts.map(p => ({ which: p.which, size: p.body ? p.body.length : 0 })));
      return email;
    }
    
    console.log(`✅ Raw body found for UID ${uid}, length: ${rawBody.length}`);
    
    // Parse using simpleParser (YOUR EXACT METHOD)
    const parsedEmail = await simpleParser(rawBody);
    
    console.log(`✅ Email parsed successfully for UID ${uid}`);
    console.log(`📝 Parsed text length: ${parsedEmail.text ? parsedEmail.text.length : 0}`);
    console.log(`🌐 Parsed HTML length: ${parsedEmail.html ? parsedEmail.html.length : 0}`);
    
    // Update email object with parsed content
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

    email.body = finalBody;
    
    // Update in database
    await Email.update(
      { 
        body: finalBody,
        body_fetch_status: 'fetched'
      },
      { where: { emailID: email.emailID } }
    );
    
    console.log(`✅ Email ${email.emailID} body updated in database, length: ${finalBody.length}`);
    
    return email;
    
  } catch (error) {
    console.error(`❌ Error fetching body for UID ${uid}:`, error.message);
    
    // Mark as failed in database
    await Email.update(
      { body_fetch_status: 'failed' },
      { where: { emailID: email.emailID } }
    );
    
    return email;
  
  }
};




// ✅ FIXED: Fetch email body using imap-simple syntax
// const fetchSingleEmailBodyWithBodyPeek = async (connection, email) => {
//   console.log(`🔍 FETCHING EMAIL BODY with imap-simple for UID: ${email.uid}`);

//   try {
//     if (!email.uid) {
//       console.log(`⚠️ No UID available for email ${email.emailID}, cannot fetch body`);
//       return email;
//     }

//     const { uid } = email;
//     console.log(`🔧 Using imap-simple to fetch UID: ${uid}`);

//     // ✅ IMAP-SIMPLE FIX: Use connection.search with UID criteria and fetchOptions
//     const searchCriteria = [['UID', uid]];
//     const fetchOptions = {
//       bodies: '', // Fetch complete raw message (empty string gets full message)
//       struct: true
//     };

//     console.log(`🔧 Searching with criteria:`, searchCriteria);
//     console.log(`🔧 Fetch options:`, fetchOptions);

//     // Search and fetch the specific email by UID
//     const results = await connection.search(searchCriteria, fetchOptions);
//     console.log(`🔧 Search results:`, results.length, 'messages found');

//     if (results.length === 0) {
//       console.log(`⚠️ No messages found for UID ${uid}`);
//       const informativeMessage = createInformativeMessage(email);
      
//       await Email.update({
//         body: informativeMessage,
//         body_fetch_status: 'fetched'
//       }, {
//         where: { emailID: email.emailID }
//       });

//       return { ...email, body: informativeMessage };
//     }

//     // Process the first (and should be only) result
//     const message = results[0];
//     console.log(`🔧 Processing message for UID ${uid}`);
//     console.log(`🔧 Message structure:`, Object.keys(message));
//     console.log(`🔧 Message bodies available:`, Object.keys(message.bodies || {}));

//     // Get the complete raw message body
//     let rawMessage = '';
//     if (message.bodies && message.bodies['']) {
//       rawMessage = message.bodies[''];
//       console.log(`✅ Raw email body fetched: ${rawMessage.length} chars`);
//     } else {
//       console.log(`⚠️ No raw body found in message.bodies['']`);
//       console.log(`Available body keys:`, Object.keys(message.bodies || {}));
      
//       // Try to get any available body content
//       const bodyKeys = Object.keys(message.bodies || {});
//       if (bodyKeys.length > 0) {
//         const firstKey = bodyKeys[0];
//         rawMessage = message.bodies[firstKey];
//         console.log(`� Using body key '${firstKey}': ${rawMessage ? rawMessage.length : 0} chars`);
//       }
//     }

//     // Parse the raw message with mailparser
//     let parsedBody = '';
//     if (rawMessage) {
//       try {
//         const { simpleParser } = require('mailparser');
//         const parsed = await simpleParser(rawMessage);
        
//         // Use text content first, then HTML as fallback
//         parsedBody = parsed.text || parsed.html || rawMessage;
//         console.log(`✅ Parsed body: ${parsedBody.length} chars`);
//       } catch (parseError) {
//         console.error(`❌ Mailparser error:`, parseError.message);
//         parsedBody = rawMessage; // Use raw message as fallback
//       }
//     }

//     // Clean the email body
//     const cleanedBody = cleanEmailBody(parsedBody || rawMessage);
    
//     // Update email with fetched body
//     await Email.update(
//       { 
//         body: cleanedBody,
//         body_fetch_status: "fetched" 
//       },
//       { where: { emailID: email.emailID } }
//     );

//     console.log(`✅ IMAP-SIMPLE SUCCESS: Updated email with ${cleanedBody.length} chars`);
    
//     // Return updated email with the new body
//     return { ...email, body: cleanedBody };

//   } catch (error) {
//     console.error(`❌ IMAP-SIMPLE FETCH ERROR:`, error.message);
//     console.error(`❌ Error stack:`, error.stack);
    
//     // Create informative message as fallback
//     const informativeMessage = createInformativeMessage(email);
    
//     await Email.update({
//       body: informativeMessage,
//       body_fetch_status: 'failed'
//     }, {
//       where: { emailID: email.emailID }
//     });

//     console.log(`✅ CREATED FALLBACK MESSAGE for email ${email.emailID} after error`);
//     return { ...email, body: informativeMessage };
//   }
// Parse RFC822 message using mailparser and manual parsing with DOUBLE FALLBACK approach
const parseRFC822Message = async (rawMessage) => {
  console.log(`🔍 PARSING RFC822 MESSAGE: ${rawMessage.length} chars`);
  
  try {
    // FIRST ATTEMPT: Parse with mailparser
    const { simpleParser } = require('mailparser');
    const parsed = await simpleParser(rawMessage);
    
    console.log(`📧 FIRST PARSE - Text: ${parsed.text ? parsed.text.length : 0} chars, HTML: ${parsed.html ? parsed.html.length : 0} chars`);
    console.log(`📧 FIRST PARSE - Subject: ${parsed.subject}, From: ${parsed.from ? parsed.from.text : 'none'}`);
    
    // Extract body content using combined HTML and text approach
    const bodyText = parsed.text || "";
    const bodyHtml = parsed.html || "";

    let bodyContent = "";
    if (bodyHtml) {
      // HTML content available - use it
      bodyContent = bodyHtml;
    } else if (bodyText) {
      // Only text available - use it
      bodyContent = bodyText;
    }

    // FALLBACK 1: If body is empty, try re-parsing the raw message (YOUR SUGGESTED APPROACH)
    if (!bodyContent && rawMessage) {
      console.log(`🔄 APPLYING YOUR FALLBACK: Re-parsing raw message due to empty body`);
      const reParsed = await simpleParser(rawMessage);
      const reParsedText = reParsed.text || "";
      const reParsedHtml = reParsed.html || "";

      if (reParsedHtml) {
        bodyContent = reParsedHtml;
      } else if (reParsedText) {
        bodyContent = reParsedText;
      }

      console.log(`🔄 YOUR FALLBACK RESULT: ${bodyContent.length} chars extracted`);
      console.log(`🔄 Re-parsed - Text: ${reParsedText.length} chars, HTML: ${reParsedHtml.length} chars`);
    }
    
    if (bodyContent && bodyContent.length > 10) {
      console.log(`✅ BODY CONTENT EXTRACTED: ${bodyContent.substring(0, 100)}...`);
      return {
        fullBody: bodyContent
      };
    }
  } catch (parseError) {
    console.log(`⚠️ Mailparser failed, trying manual parsing: ${parseError.message}`);
  }

    // Manual MIME boundary parsing as fallback
    try {
      const lines = rawMessage.split('\n');
      let inTextPart = false;
      let inHtmlPart = false;
      let textContent = '';
      let htmlContent = '';
      let skipHeaders = true;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip email headers until we find content
        if (skipHeaders && line.trim() === '') {
          skipHeaders = false;
          continue;
        }
        
        if (skipHeaders) continue;
        
        if (line.includes('Content-Type: text/plain')) {
          inTextPart = true;
          inHtmlPart = false;
          continue;
        } else if (line.includes('Content-Type: text/html')) {
          inHtmlPart = true;
          inTextPart = false;
          continue;
        } else if (line.startsWith('--') && line.length > 10) {
          inTextPart = false;
          inHtmlPart = false;
          continue;
        }
        
        if (inTextPart && line.trim() !== '' && !line.includes('Content-Transfer-Encoding')) {
          textContent += line + '\n';
        } else if (inHtmlPart && line.trim() !== '' && !line.includes('Content-Transfer-Encoding')) {
          htmlContent += line + '\n';
        }
      }
      
      if (textContent.trim() || htmlContent.trim()) {
        console.log(`✅ MANUAL PARSE SUCCESS: Text: ${textContent.trim().length} chars, HTML: ${htmlContent.trim().length} chars`);
        return {
          fullBody: htmlContent || textContent || ''
        };
      }
    } catch (manualParseError) {
      console.log(`⚠️ Manual parsing failed: ${manualParseError.message}`);
    }

    return { fullBody: '' };
  };

// Create informative message when email content can't be fetched
const createInformativeMessage = (email) => {
  let bodyMessage = `📧 EMAIL SUMMARY\n\n`;
  bodyMessage += `Subject: ${email.subject || 'Today Facts'}\n`;
  bodyMessage += `From: ${email.sender || 'intileotech@gmail.com'}\n`;
  bodyMessage += `Date: ${email.createdAt || new Date().toISOString()}\n\n`;
  bodyMessage += `⚠️ The email content is protected by your email provider's security settings and cannot be displayed directly in the CRM.\n\n`;
  bodyMessage += `💡 To view the complete email content, please:\n`;
  bodyMessage += `• Open your email client (Gmail, Outlook, etc.)\n`;
  bodyMessage += `• Search for emails from: ${email.sender || 'intileotech@gmail.com'}\n`;
  bodyMessage += `• Look for subject: "${email.subject || 'Today Facts'}"\n`;
  bodyMessage += `• Email UID: ${email.uid || 'N/A'}\n\n`;
  bodyMessage += `📅 Email received: ${new Date(email.createdAt || Date.now()).toLocaleDateString()}\n`;
  
  return bodyMessage;
};

// Get body fetch statistics
const getBodyFetchStats = async (masterUserID, Email) => {
  try {
    const stats = await Email.findAll({
      attributes: [
        'body_fetch_status',
        [Email.sequelize.fn('COUNT', '*'), 'count']
      ],
      where: { masterUserID },
      group: ['body_fetch_status'],
      raw: true
    });

    return stats.reduce((acc, stat) => {
      acc[stat.body_fetch_status || 'unknown'] = parseInt(stat.count);
      return acc;
    }, {});
  } catch (error) {
    console.error('Error getting body fetch stats:', error);
    return {};
  }
};

module.exports = {
  connectToIMAP,
  fetchEmailBodyOnDemand, // � Simple version only
  fetchSingleEmailBodyWithBodyPeek,
  parseRFC822Message,
  createInformativeMessage,
  getBodyFetchStats,
  // Add the missing functions that the controller expects
  fetchRealEmailContent: async (emailUID, masterUserID, Email, UserCredential) => {
    console.log(`📧 Attempting to fetch REAL email content for UID ${emailUID}`);
    console.log(`📧 Connecting to IMAP to fetch REAL content for UID ${emailUID}`);
    console.log(`🔧 ENHANCED DEBUG: fetchRealEmailContent called with UID=${emailUID}, masterUserID=${masterUserID}`);
    
    try {
      // Get user credentials first
      console.log(`🔧 ENHANCED DEBUG: About to fetch credentials for user ${masterUserID}`);
      const userCredential = await UserCredential.findOne({
        where: { masterUserID }
      });

      if (!userCredential) {
        console.log(`❌ ENHANCED DEBUG: No credentials found for user ${masterUserID}`);
        throw new Error(`No credentials found for user ${masterUserID}`);
      }

      console.log(`✅ ENHANCED DEBUG: Credentials found - Provider: ${userCredential.provider}, Email: ${userCredential.email}`);

      // Connect to IMAP with enhanced debugging
      console.log(`🔧 ENHANCED DEBUG: About to call connectToIMAP with provider ${userCredential.provider}`);
      const connection = await connectToIMAP(masterUserID, userCredential.provider, UserCredential);
      console.log(`✅ ENHANCED DEBUG: IMAP connection successful`);
      
      await connection.openBox('INBOX');
      console.log(`✅ ENHANCED DEBUG: INBOX opened successfully`);

      // Find email by UID
      console.log(`🔧 ENHANCED DEBUG: Looking for email with UID ${emailUID}`);
      const email = await Email.findOne({ where: { uid: emailUID.toString() } });
      if (email) {
        console.log(`✅ ENHANCED DEBUG: Email found with UID ${emailUID}, proceeding with body fetch`);
        const result = await fetchSingleEmailBodyWithBodyPeek(connection, email);
        await connection.end();
        console.log(`📧 Real content result:`, result ? 'SUCCESS' : 'null');
        return result;
      } else {
        console.log(`❌ ENHANCED DEBUG: No email found with UID ${emailUID}`);
      }
      
      await connection.end();
      console.log(`📧 Real content result: null`);
      return null;
    } catch (error) {
      console.log(`❌ ENHANCED DEBUG: Error in fetchRealEmailContent:`, error.message);
      console.log(`❌ ENHANCED DEBUG: Error stack:`, error.stack);
      console.log(`📧 IMAP connection/fetch error:`, error.message);
      console.log(`📧 Real content result: null`);
      return null;
    }
  },
  parseEmailContent: parseRFC822Message,
  manualParseEmailContent: parseRFC822Message
};
