const UserCredential = require("../../models/email/userCredentialModel");
const Imap = require("imap-simple");

// Test IMAP connection for a user
exports.testImapConnection = async (req, res) => {
  const { masterUserID } = req.body;
  const adminId = req.adminId;

  // Use the provided masterUserID or fall back to the admin's own ID
  const targetUserID = masterUserID || adminId;

  if (!targetUserID) {
    return res.status(400).json({ 
      message: "Master User ID is required" 
    });
  }

  try {
    console.log(`[IMAP-TEST] Testing IMAP connection for user: ${targetUserID}`);

    // Fetch user credentials
    const userCredential = await UserCredential.findOne({
      where: { masterUserID: targetUserID },
    });

    if (!userCredential) {
      return res.status(404).json({ 
        message: "User credentials not found",
        userID: targetUserID 
      });
    }

    const { email, appPassword, provider } = userCredential;

    console.log(`[IMAP-TEST] Testing connection for: ${email}`);
    console.log(`[IMAP-TEST] Provider: ${provider || 'gmail (default)'}`);
    console.log(`[IMAP-TEST] App Password Length: ${appPassword ? appPassword.length : 0} chars`);

    // Validate credentials
    if (!email || !appPassword) {
      return res.status(400).json({
        message: "Invalid credentials",
        details: {
          hasEmail: !!email,
          hasAppPassword: !!appPassword
        }
      });
    }

    // Auto-detect provider based on email domain
    const emailDomain = email.split('@')[1]?.toLowerCase();
    let effectiveProvider = provider || 'gmail';

    if (emailDomain) {
      if (emailDomain.includes('gmail.') || emailDomain === 'gmail.com') {
        effectiveProvider = 'gmail';
      } else if (emailDomain.includes('outlook.') || emailDomain.includes('hotmail.') || emailDomain.includes('live.')) {
        effectiveProvider = 'outlook';
      } else if (emailDomain.includes('yandex.')) {
        effectiveProvider = 'yandex';
      } else if (emailDomain.includes('yahoo.')) {
        effectiveProvider = 'yahoo';
      } else if (emailDomain === 'earthood.in') {
        console.log(`[IMAP-TEST] ⚠️ earthood.in domain detected - this may need custom IMAP settings`);
      }
    }

    console.log(`[IMAP-TEST] Effective provider: ${effectiveProvider}`);

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
      yahoo: {
        host: "imap.mail.yahoo.com",
        port: 993,
        tls: true,
      },
      outlook: {
        host: "imap-mail.outlook.com",
        port: 993,
        tls: true,
      }
    };

    const providerConfig = PROVIDER_CONFIG[effectiveProvider];
    if (!providerConfig && effectiveProvider !== 'custom') {
      return res.status(400).json({
        message: "Unknown email provider",
        provider: effectiveProvider,
        domain: emailDomain
      });
    }

    let imapConfig;
    if (effectiveProvider === 'custom') {
      if (!userCredential.imapHost || !userCredential.imapPort) {
        return res.status(400).json({
          message: "Custom IMAP settings are missing",
          provider: effectiveProvider
        });
      }
      imapConfig = {
        imap: {
          user: email,
          password: appPassword,
          host: userCredential.imapHost,
          port: userCredential.imapPort,
          tls: userCredential.imapTLS,
          authTimeout: 30000,
          connTimeout: 30000,
          tlsOptions: { 
            rejectUnauthorized: false,
            servername: userCredential.imapHost
          }
        }
      };
    } else {
      imapConfig = {
        imap: {
          user: email,
          password: appPassword,
          host: providerConfig.host,
          port: providerConfig.port,
          tls: providerConfig.tls,
          authTimeout: 30000,
          connTimeout: 30000,
          tlsOptions: { 
            rejectUnauthorized: false,
            servername: providerConfig.host
          }
        }
      };
    }

    console.log(`[IMAP-TEST] Attempting connection to ${providerConfig.host}:${providerConfig.port}`);

    // Test connection with timeout
    const connectionPromise = Imap.connect(imapConfig);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Connection timeout after 30 seconds'));
      }, 30000);
    });

    const connection = await Promise.race([connectionPromise, timeoutPromise]);
    console.log(`[IMAP-TEST] ✅ Successfully connected to IMAP server`);

    // Test opening INBOX
    await connection.openBox('INBOX');
    console.log(`[IMAP-TEST] ✅ Successfully opened INBOX folder`);

    // Get basic mailbox info
    const mailboxStatus = connection.imap.state;
    console.log(`[IMAP-TEST] 📊 Mailbox status: ${mailboxStatus}`);

    // Close connection
    connection.end();
    console.log(`[IMAP-TEST] ✅ Connection closed successfully`);

    return res.status(200).json({
      success: true,
      message: "IMAP connection test successful",
      details: {
        userID: targetUserID,
        email: email,
        provider: effectiveProvider,
        host: providerConfig.host,
        port: providerConfig.port,
        mailboxStatus: mailboxStatus,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`[IMAP-TEST] ❌ Connection test failed:`, error.message);

    let errorType = 'unknown';
    let suggestion = '';

    if (error.message.includes('timeout')) {
      errorType = 'timeout';
      suggestion = 'Check your internet connection and firewall settings';
    } else if (error.message.includes('authentication') || error.message.includes('login') || error.message.includes('invalid credentials')) {
      errorType = 'authentication';
      suggestion = 'Verify your email and app password. For Gmail, ensure 2-factor authentication is enabled and you are using an app password.';
    } else if (error.message.includes('Connection ended unexpectedly') || error.message.includes('ECONNRESET')) {
      errorType = 'connection_dropped';
      suggestion = 'The server rejected the connection. This often indicates invalid credentials or server restrictions.';
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      errorType = 'dns_error';
      suggestion = 'Cannot resolve the server hostname. Check the provider settings or use custom IMAP configuration.';
    }

    return res.status(500).json({
      success: false,
      message: "IMAP connection test failed",
      error: {
        type: errorType,
        message: error.message,
        suggestion: suggestion
      },
      details: {
        userID: targetUserID,
        email: userCredential?.email,
        provider: effectiveProvider,
        timestamp: new Date().toISOString()
      }
    });
  }
};