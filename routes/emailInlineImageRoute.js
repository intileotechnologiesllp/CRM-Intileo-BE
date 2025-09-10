const express = require('express');
const router = express.Router();
const Imap = require('imap-simple');
const { simpleParser } = require('mailparser');
const UserCredential = require('../models/email/userCredentialModel');
const { verifyToken } = require('../middlewares/authMiddleware');

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
 * Serve inline images from emails by fetching them from IMAP on-demand
 * Route: GET /api/email/inline-image/:emailId/:contentId
 */
router.get('/inline-image/:emailId/:contentId', verifyToken, async (req, res) => {
  try {
    const { emailId, contentId } = req.params;
    const masterUserID = req.user?.id;

    if (!masterUserID) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    console.log(`🖼️ Serving inline image - EmailID: ${emailId}, ContentID: ${contentId}, UserID: ${masterUserID}`);

    // Get user credentials
    const userCredential = await UserCredential.findOne({
      where: { masterUserID }
    });

    if (!userCredential) {
      return res.status(400).json({ error: 'No email credentials found' });
    }

    // Get email details from database
    const Email = require('../models/email/emailModel');
    const email = await Email.findOne({
      where: { emailID: emailId }
    });

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    // Build IMAP config
    const actualProvider = userCredential.provider || 'gmail';
    let imapConfig;

    if (actualProvider === "custom") {
      imapConfig = {
        imap: {
          user: userCredential.email,
          password: userCredential.password,
          host: userCredential.imapHost,
          port: userCredential.imapPort,
          tls: userCredential.tls || true,
          authTimeout: 60000,
          connTimeout: 60000,
          tlsOptions: { rejectUnauthorized: false }
        }
      };
    } else {
      const providerConfig = PROVIDER_CONFIG[actualProvider];
      if (!providerConfig) {
        return res.status(400).json({ error: `Unsupported provider: ${actualProvider}` });
      }

      imapConfig = {
        imap: {
          user: userCredential.email,
          password: userCredential.password,
          host: providerConfig.host,
          port: providerConfig.port,
          tls: providerConfig.tls,
          authTimeout: 60000,
          connTimeout: 60000,
          tlsOptions: { rejectUnauthorized: false }
        }
      };
    }

    // Connect to IMAP
    console.log(`🔌 Connecting to IMAP for inline image...`);
    const connection = await Imap.connect(imapConfig);

    try {
      // Determine folder based on email type
      let folderName = 'INBOX';
      if (email.folder) {
        folderName = email.folder;
      } else if (email.type === 'sent') {
        // Try common sent folder names
        const folders = await connection.getBoxes();
        const sentFolders = ['[Gmail]/Sent Mail', 'Sent', 'SENT', 'Sent Items', 'Sent Messages'];
        for (const folder of sentFolders) {
          if (folders[folder]) {
            folderName = folder;
            break;
          }
        }
      }

      await connection.openBox(folderName);
      console.log(`📂 Opened folder: ${folderName}`);

      // Search for the email by UID
      const searchCriteria = email.uid ? [['UID', email.uid]] : [['HEADER', 'MESSAGE-ID', email.messageId]];
      const fetchOptions = {
        bodies: '',
        struct: true,
        envelope: true
      };

      const emails = await connection.search(searchCriteria, fetchOptions);
      
      if (emails.length === 0) {
        return res.status(404).json({ error: 'Email not found in IMAP' });
      }

      const targetEmail = emails[0];
      
      // Parse the email to get attachments
      const rawBody = targetEmail.body;
      const parsedEmail = await simpleParser(rawBody);

      // Find the attachment with matching content ID
      if (!parsedEmail.attachments || parsedEmail.attachments.length === 0) {
        return res.status(404).json({ error: 'No attachments found in email' });
      }

      // Clean content ID (remove < > brackets if present)
      const cleanContentId = contentId.replace(/[<>]/g, '');
      
      let targetAttachment = null;
      
      // Search for attachment by content ID or filename
      for (const attachment of parsedEmail.attachments) {
        const attachmentCid = (attachment.contentId || '').replace(/[<>]/g, '');
        const filename = attachment.filename || '';
        
        // Match by content ID
        if (attachmentCid === cleanContentId) {
          targetAttachment = attachment;
          break;
        }
        
        // Match by filename
        if (filename.toLowerCase() === cleanContentId.toLowerCase()) {
          targetAttachment = attachment;
          break;
        }
        
        // Partial matches
        if (filename.toLowerCase().includes(cleanContentId.toLowerCase()) || 
            cleanContentId.toLowerCase().includes(filename.toLowerCase())) {
          targetAttachment = attachment;
          break;
        }
      }

      if (!targetAttachment) {
        console.log(`❌ Attachment not found for ContentID: ${cleanContentId}`);
        console.log(`Available attachments:`, parsedEmail.attachments.map(a => ({
          filename: a.filename,
          contentId: a.contentId,
          contentType: a.contentType
        })));
        return res.status(404).json({ error: 'Inline image not found' });
      }

      // Set proper content type and headers
      const contentType = targetAttachment.contentType || 'image/png';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      res.setHeader('Content-Length', targetAttachment.content.length);

      // Send the image content
      console.log(`✅ Serving inline image: ${targetAttachment.filename} (${contentType})`);
      res.send(targetAttachment.content);

    } finally {
      // Close IMAP connection
      connection.end();
    }

  } catch (error) {
    console.error('❌ Error serving inline image:', error);
    res.status(500).json({ error: 'Failed to fetch inline image' });
  }
});

module.exports = router;
