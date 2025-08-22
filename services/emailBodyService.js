const Email = require('../models/email/emailModel');
const UserCredential = require('../models/email/userCredentialModel'); // ✅ FIXED: Correct path
const Imap = require('imap-simple'); // ✅ FIX: Use same import as fetchInboxEmails

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

// ✅ FIX: Remove old providerConfigs, we now use PROVIDER_CONFIG like fetchInboxEmails

// ✅ FIX: Use same IMAP connection logic as fetchInboxEmails
const connectToIMAP = async (masterUserID, provider) => {
  let imapConfig; // ✅ FIX: Declare at function scope for error handling
  let userCredential; // ✅ FIX: Declare at function scope for error handling
  
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
const fetchEmailBodyOnDemand = async (emailId, masterUserID, provider) => {
    console.log(provider,"email provider");
    
  console.log(`🔍 my check Fetching body for email ID ${emailId}`);
  console.log(`🔧 ENHANCED SERVICE: This is the NEW EmailBodyService with enhanced debugging!`);
  console.log(`🎯 UNIQUE MARKER: EmailBodyService-v2.0-ENHANCED-2025-08-22`);
  console.log(`🚨 CRITICAL DEBUG: fetchEmailBodyOnDemand called with emailId=${emailId}, masterUserID=${masterUserID}, provider=${provider}`);
  console.log(`🚨 CRITICAL DEBUG: If you see this message, the NEW service is working!`);

  try {
    console.log(`🔧 ENHANCED DEBUG: About to fetch email from database with emailID=${emailId}`);
    const email = await Email.findOne({ where: { emailID: emailId } });
    if (!email) {
      console.log(`❌ ENHANCED DEBUG: No email found with emailID=${emailId}`);
      throw new Error(`Email ${emailId} not found`);
    }

    console.log(`✅ ENHANCED DEBUG: Email found - UID: ${email.uid}, Subject: ${email.subject}`);

    // If body already exists, return it
    if (email.body_fetch_status === 'fetched' && email.body) {
      console.log(`✅ ON-DEMAND: Body already cached for ${email.messageId}`);
      return email;
    }

    console.log(`🔧 ENHANCED DEBUG: Email body not cached, proceeding with IMAP fetch`);

    // Mark as fetching to prevent duplicate requests
    await Email.update(
      { body_fetch_status: 'fetching' },
      { where: { emailID: emailId } }
    );

    console.log(`🔧 ENHANCED DEBUG: About to fetch UserCredential for masterUserID=${masterUserID}`);
    
    // Get user credentials properly
    const userCredential = await UserCredential.findOne({
      where: { masterUserID: masterUserID }
    });

    if (!userCredential) {
      console.log(`❌ ENHANCED DEBUG: No UserCredential found for masterUserID=${masterUserID}`);
      throw new Error(`No credentials found for user ${masterUserID}`);
    }

    console.log(`✅ ENHANCED DEBUG: UserCredential found - Provider: ${userCredential.provider}, Email: ${userCredential.email}`);
    console.log(`🔧 ENHANCED DEBUG: Password length: ${userCredential.appPassword ? userCredential.appPassword.length : 0} chars`);

    // Connect to IMAP and fetch body
    console.log(`🚀 ENHANCED SERVICE: About to call connectToIMAP with masterUserID=${masterUserID}, provider=${userCredential.provider}`);
    const connection = await connectToIMAP(masterUserID, userCredential.provider);
    console.log(`✅ ENHANCED DEBUG: connectToIMAP successful, opening INBOX`);
    
    await connection.openBox('INBOX');
    console.log(`✅ ENHANCED DEBUG: INBOX opened, calling fetchSingleEmailBodyWithBodyPeek`);

    const updatedEmail = await fetchSingleEmailBodyWithBodyPeek(connection, email);
    
    await connection.end();
    console.log(`✅ ENHANCED DEBUG: IMAP connection closed`);

    console.log(`✅ ON-DEMAND: Successfully fetched body for ${email.messageId}`);
    return updatedEmail;

  } catch (error) {
    console.error(`❌ ENHANCED DEBUG: Error in fetchEmailBodyOnDemand:`, error.message);
    console.error(`❌ ENHANCED DEBUG: Error stack:`, error.stack);
    console.error(`❌ ON-DEMAND FETCH ERROR for email ${emailId}:`, error.message);
    
    // Mark as failed
    await Email.update(
      { body_fetch_status: 'failed' },
      { where: { emailID: emailId } }
    );

    throw error;
  }
};
const fetchSingleEmailBodyWithBodyPeek = async (connection, email) => {
  console.log(`🔍 FETCHING EMAIL BODY with imap-simple for UID: ${email.uid}`);
  if (!email.uid) {
    console.log(`⚠️ No UID available for email ${email.emailID}, cannot fetch body`);
    return email;
  }
  const { uid } = email;
  const searchCriteria = [['UID', uid]];
  
  // First try to get message structure to understand the email format
  console.log(`🔧 First getting message structure for UID: ${uid}`);
  let structResults = null;
  try {
    structResults = await connection.search(searchCriteria, { struct: true });
    if (structResults && structResults.length > 0) {
      console.log(`🔧 Message structure:`, JSON.stringify(structResults[0], null, 2));
    }
  } catch (structError) {
    console.log(`⚠️ Could not get message structure: ${structError.message}`);
  }
  
  // Extract text parts from message structure for targeted fetching (handle nested structures)
  let textParts = [];
  let htmlParts = [];
  
  const parseStructureParts = (struct, depth = 0) => {
    console.log(`🔧 Parsing structure at depth ${depth}, parts: ${struct.length}`);
    
    for (let i = 1; i < struct.length; i++) {
      if (Array.isArray(struct[i])) {
        if (struct[i].length > 0) {
          const part = struct[i][0];
          
          // Check if this is a container with nested parts
          if (part && !part.partID && part.type) {
            console.log(`🔧 Found container part: ${part.type}, recursing...`);
            // This is a container, recurse into it
            parseStructureParts(struct[i], depth + 1);
          } else if (part && part.partID && part.type === 'text') {
            // This is an actual text part
            const partInfo = {
              partID: part.partID,
              subtype: part.subtype,
              encoding: part.encoding,
              charset: part.params?.charset || 'UTF-8',
              size: part.size
            };
            
            if (part.subtype === 'plain') {
              textParts.push(partInfo);
              console.log(`🔧 Found text/plain part: ${part.partID}, encoding: ${part.encoding}, size: ${part.size}`);
            } else if (part.subtype === 'html') {
              htmlParts.push(partInfo);
              console.log(`🔧 Found text/html part: ${part.partID}, encoding: ${part.encoding}, size: ${part.size}`);
            }
          }
        }
      }
    }
  };
  
  try {
    if (structResults && structResults.length > 0) {
      const struct = structResults[0].attributes?.struct;
      if (struct && struct.length >= 2) {
        console.log(`🔧 Parsing message structure with ${struct.length} parts`);
        parseStructureParts(struct);
      }
    }
  } catch (parseError) {
    console.log(`⚠️ Could not parse message structure: ${parseError.message}`);
  }
  
  console.log(`🔧 Discovered ${textParts.length} text/plain parts and ${htmlParts.length} text/html parts`);
  
  // Choose preferred part (HTML first, then plain text)
  let chosenPart = null;
  if (htmlParts.length > 0) {
    chosenPart = htmlParts[0];
    console.log(`🎯 Choosing HTML part: ${chosenPart.partID} (size: ${chosenPart.size}, encoding: ${chosenPart.encoding})`);
  } else if (textParts.length > 0) {
    chosenPart = textParts[0];
    console.log(`🎯 Choosing plain text part: ${chosenPart.partID} (size: ${chosenPart.size}, encoding: ${chosenPart.encoding})`);
  }
  
  // Try to fetch the chosen part using targeted partID
  if (chosenPart) {
    // Try different formats for imap-simple compatibility
    const partFetchOptions = [
      `BODY.PEEK[${chosenPart.partID}]`,
      `BODY[${chosenPart.partID}]`,
      `${chosenPart.partID}.MIME`,
      `${chosenPart.partID}.TEXT`
    ];
    
    for (const fetchCmd of partFetchOptions) {
      console.log(`🔧 Attempting targeted fetch with: ${fetchCmd}`);
      try {
        // Try with proper imap-simple syntax
        const fetchOptions = { 
          bodies: fetchCmd,  // Try string instead of array
          struct: false 
        };
        console.log(`🔧 Using fetchOptions:`, fetchOptions);
        
        const results = await connection.search(searchCriteria, fetchOptions);
        if (!results || results.length === 0) {
          console.log(`⚠️ No results for ${fetchCmd}`);
          continue;
        }
        
        const message = results[0];
        const bodyKeys = Object.keys(message.bodies || {});
        console.log(`🔧 Available body keys for ${fetchCmd}:`, bodyKeys);
        
        if (bodyKeys.length === 0) {
          console.log(`⚠️ No bodies returned for ${fetchCmd}`);
          continue;
        }
        
        const key = bodyKeys[0];
        let rawMessage = message.bodies[key];
        
        if (!rawMessage || rawMessage.length === 0) {
          console.log(`⚠️ Body key ${key} is empty for ${fetchCmd}`);
          continue;
        }
        
        console.log(`✅ Successfully fetched part ${chosenPart.partID} with ${fetchCmd}, raw length: ${rawMessage.length} chars`);
        
        // Decode quoted-printable content if needed
        if (chosenPart.encoding && chosenPart.encoding.toLowerCase() === 'quoted-printable') {
          console.log(`🔧 Decoding quoted-printable content...`);
          try {
            const quotedPrintable = require('quoted-printable');
            const utf8 = require('utf8');
            
            // Decode quoted-printable
            let decoded = quotedPrintable.decode(rawMessage);
            
            // Handle charset conversion if needed
            if (chosenPart.charset && chosenPart.charset.toLowerCase() !== 'utf-8') {
              console.log(`🔧 Converting from ${chosenPart.charset} to UTF-8`);
              // For most common charsets, utf8 decode should work
              try {
                decoded = utf8.decode(decoded);
              } catch (charsetError) {
                console.log(`⚠️ Charset conversion failed, using as-is: ${charsetError.message}`);
              }
            }
            
            rawMessage = decoded;
            console.log(`✅ Decoded content, new length: ${rawMessage.length} chars`);
          } catch (decodeError) {
            console.error(`❌ Quoted-printable decode failed: ${decodeError.message}`);
            console.log(`🔧 Using raw content without decoding`);
          }
        }
        
        // Additional parsing with mailparser for best results
        let parsedBody = '';
        try {
          const { simpleParser } = require('mailparser');
          const parsed = await simpleParser(rawMessage);
          parsedBody = parsed.text || parsed.html || rawMessage;
          console.log(`✅ Mailparser processed body: ${parsedBody.length} chars`);
        } catch (parseError) {
          console.error(`❌ Mailparser error: ${parseError.message}`);
          parsedBody = rawMessage;
        }
        
        const cleanedBody = cleanEmailBody(parsedBody || rawMessage);
        await Email.update({
          body: cleanedBody,
          body_fetch_status: "fetched"
        }, { where: { emailID: email.emailID } });
        console.log(`✅ TARGETED FETCH SUCCESS: Updated email with ${cleanedBody.length} chars using part ${chosenPart.partID}`);
        return { ...email, body: cleanedBody };
        
      } catch (error) {
        console.error(`❌ TARGETED FETCH ERROR for ${fetchCmd}:`, error.message);
        if (error.message && error.message.toLowerCase().includes('command syntax error')) {
          continue;
        } else {
          break;
        }
      }
    }
  }
  
  // Fallback: If targeted approach failed, try RFC822 first, then generic methods
  console.log(`⚠️ FALLBACK: Targeted part fetching failed, trying RFC822 full email fetch`);
  
  // Try RFC822 first for full raw email
  try {
    console.log(`🔧 Attempting RFC822 full email fetch for UID: ${uid}`);
    // Try different RFC822 formats for imap-simple
    const rfc822Formats = ['RFC822', 'BODY[]', 'BODY.PEEK[]'];
    
    for (const rfc822Format of rfc822Formats) {
      try {
        console.log(`🔧 Trying RFC822 format: ${rfc822Format}`);
        const rfc822Results = await connection.search(searchCriteria, { 
          bodies: rfc822Format,  // Try string format
          struct: false 
        });
        
        if (rfc822Results && rfc822Results.length > 0) {
          const message = rfc822Results[0];
          const bodyKeys = Object.keys(message.bodies || {});
          console.log(`🔧 RFC822 (${rfc822Format}) available body keys:`, bodyKeys);
          
          if (bodyKeys.length > 0) {
            const key = bodyKeys[0];
            const rawEmail = message.bodies[key];
            
            if (rawEmail && rawEmail.length > 0) {
              console.log(`✅ RFC822 SUCCESS with ${rfc822Format}: Retrieved full raw email, length: ${rawEmail.length} chars`);
              
              // Parse the full email with mailparser to extract text/html parts
              try {
                const { simpleParser } = require('mailparser');
                console.log(`🔧 Parsing RFC822 email with simpleParser...`);
                const parsed = await simpleParser(rawEmail);
                
                let extractedBody = '';
                let contentType = '';
                
                // Prefer HTML, fallback to text
                if (parsed.html && parsed.html.length > 0) {
                  extractedBody = parsed.html;
                  contentType = 'text/html';
                  console.log(`✅ simpleParser extracted HTML content: ${extractedBody.length} chars`);
                } else if (parsed.text && parsed.text.length > 0) {
                  extractedBody = parsed.text;
                  contentType = 'text/plain';
                  console.log(`✅ simpleParser extracted plain text content: ${extractedBody.length} chars`);
                } else {
                  // Fallback to raw if no text/html found
                  extractedBody = rawEmail;
                  contentType = 'raw';
                  console.log(`⚠️ simpleParser found no text/html, using raw email: ${extractedBody.length} chars`);
                }
                
                const cleanedBody = cleanEmailBody(extractedBody);
                await Email.update({
                  body: cleanedBody,
                  body_fetch_status: "fetched"
                }, { where: { emailID: email.emailID } });
                console.log(`✅ RFC822 PARSE SUCCESS: Updated email with ${cleanedBody.length} chars from ${contentType} using ${rfc822Format}`);
                return { ...email, body: cleanedBody };
                
              } catch (parseError) {
                console.error(`❌ RFC822 simpleParser error: ${parseError.message}`);
                console.log(`🔧 Falling back to raw RFC822 content without parsing`);
                
                const cleanedBody = cleanEmailBody(rawEmail);
                await Email.update({
                  body: cleanedBody,
                  body_fetch_status: "fetched"
                }, { where: { emailID: email.emailID } });
                console.log(`✅ RFC822 RAW SUCCESS: Updated email with ${cleanedBody.length} chars (unparsed) using ${rfc822Format}`);
                return { ...email, body: cleanedBody };
              }
            } else {
              console.log(`⚠️ RFC822 ${rfc822Format} returned empty body`);
            }
          } else {
            console.log(`⚠️ RFC822 ${rfc822Format} returned no body keys`);
          }
        } else {
          console.log(`⚠️ RFC822 ${rfc822Format} fetch returned no results`);
        }
      } catch (formatError) {
        console.error(`❌ RFC822 ${rfc822Format} ERROR: ${formatError.message}`);
        continue;
      }
    }
  } catch (rfc822Error) {
    console.error(`❌ RFC822 FETCH ERROR: ${rfc822Error.message}`);
    console.log(`🔧 RFC822 failed, continuing to generic fallback methods`);
  }
  
  // Final fallback: generic methods if RFC822 also failed
  console.log(`⚠️ FINAL FALLBACK: RFC822 failed, trying remaining generic methods`);
  const fallbackBodies = [
    "BODY.PEEK[TEXT]", "BODY.PEEK[1]", "BODY.PEEK[]",
    "BODY[TEXT]", "BODY[1]", "BODY[]",
    "TEXT", "HEADER"
  ];
  
  for (const bodyType of fallbackBodies) {
    const fetchOptions = { bodies: [bodyType], struct: false };
    console.log(`🔧 Fallback trying: [${bodyType}]`);
    try {
      const results = await connection.search(searchCriteria, fetchOptions);
      if (!results || results.length === 0) {
        console.log(`⚠️ No messages found for UID ${uid} with ${bodyType}`);
        continue;
      }
      const message = results[0];
      const bodyKeys = Object.keys(message.bodies || {});
      console.log(`🔧 Available body keys for ${bodyType}:`, bodyKeys);
      if (bodyKeys.length === 0) {
        console.log(`⚠️ No bodies returned for ${bodyType}`);
        continue;
      }
      const key = bodyKeys[0];
      const rawMessage = message.bodies[key];
      if (!rawMessage || rawMessage.length === 0) {
        console.log(`⚠️ Body key ${key} is empty for ${bodyType}`);
        continue;
      }
      console.log(`✅ Fallback success with: ${bodyType}, key: ${key}, length: ${rawMessage.length} chars`);
      
      // Parse with mailparser for best results
      let parsedBody = '';
      try {
        const { simpleParser } = require('mailparser');
        const parsed = await simpleParser(rawMessage);
        parsedBody = parsed.text || parsed.html || rawMessage;
        console.log(`✅ Parsed body (${bodyType}): ${parsedBody.length} chars`);
      } catch (parseError) {
        console.error(`❌ Mailparser error for ${bodyType}:`, parseError.message);
        parsedBody = rawMessage;
      }
      const cleanedBody = cleanEmailBody(parsedBody || rawMessage);
      await Email.update({
        body: cleanedBody,
        body_fetch_status: "fetched"
      }, { where: { emailID: email.emailID } });
      console.log(`✅ FALLBACK SUCCESS: Updated email with ${cleanedBody.length} chars using ${bodyType}`);
      return { ...email, body: cleanedBody };
    } catch (error) {
      console.error(`❌ FALLBACK ERROR for ${bodyType}:`, error.message);
      if (error.message && error.message.toLowerCase().includes('command syntax error')) {
        continue;
      } else {
        break;
      }
    }
  }
  
  // If all attempts fail
  console.log(`❌ All body fetch attempts failed for UID ${email.uid}`);
  const fallbackMessage = "Body not available";
  await Email.update({
    body: fallbackMessage,
    body_fetch_status: 'failed'
  }, { where: { emailID: email.emailID } });
  return { ...email, body: fallbackMessage };
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
// };

// Parse RFC822 message using mailparser and manual parsing with DOUBLE FALLBACK approach
const parseRFC822Message = async (rawMessage) => {
  console.log(`🔍 PARSING RFC822 MESSAGE: ${rawMessage.length} chars`);
  
  try {
    // FIRST ATTEMPT: Parse with mailparser
    const { simpleParser } = require('mailparser');
    const parsed = await simpleParser(rawMessage);
    
    console.log(`📧 FIRST PARSE - Text: ${parsed.text ? parsed.text.length : 0} chars, HTML: ${parsed.html ? parsed.html.length : 0} chars`);
    console.log(`📧 FIRST PARSE - Subject: ${parsed.subject}, From: ${parsed.from ? parsed.from.text : 'none'}`);
    
    // Extract body content using your suggested approach
    let bodyContent = parsed.html || parsed.text || "";
    
    // FALLBACK 1: If body is empty, try re-parsing the raw message (YOUR SUGGESTED APPROACH)
    if (!bodyContent && rawMessage) {
      console.log(`🔄 APPLYING YOUR FALLBACK: Re-parsing raw message due to empty body`);
      const reParsed = await simpleParser(rawMessage);
      bodyContent = reParsed.html || reParsed.text || "";
      console.log(`🔄 YOUR FALLBACK RESULT: ${bodyContent.length} chars extracted`);
      console.log(`🔄 Re-parsed - Text: ${reParsed.text ? reParsed.text.length : 0} chars, HTML: ${reParsed.html ? reParsed.html.length : 0} chars`);
    }
    
    if (bodyContent && bodyContent.length > 10) {
      console.log(`✅ BODY CONTENT EXTRACTED: ${bodyContent.substring(0, 100)}...`);
      return {
        fullBody: bodyContent,
        textBody: parsed.text || "",
        htmlBody: parsed.html || ""
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
          fullBody: htmlContent || textContent || '',
          textBody: textContent.trim(),
          htmlBody: htmlContent.trim()
        };
      }
    } catch (manualParseError) {
      console.log(`⚠️ Manual parsing failed: ${manualParseError.message}`);
    }

    return { fullBody: '', textBody: '', htmlBody: '' };
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
const getBodyFetchStats = async (masterUserID) => {
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
  fetchEmailBodyOnDemand,
  fetchSingleEmailBodyWithBodyPeek,
  parseRFC822Message,
  createInformativeMessage,
  getBodyFetchStats,
  // Add the missing functions that the controller expects
  fetchRealEmailContent: async (emailUID, masterUserID) => {
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
      const connection = await connectToIMAP(masterUserID, userCredential.provider);
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
