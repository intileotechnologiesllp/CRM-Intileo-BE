const Imap = require("imap-simple");
const Email = require("../../models/email/emailModel");
const { htmlToText } = require("html-to-text");
const { simpleParser } = require("mailparser");
const Attachment = require("../../models/email/attachmentModel");
const Template = require("../../models/email/templateModel");
const { Sequelize } = require("sequelize");
const nodemailer = require("nodemailer");
const amqp = require('amqplib'); // Added for auto-pagination queue system
const {
  saveAttachments,
  saveUserUploadedAttachments,
  fetchAndSaveInlineAttachments,
} = require("../../services/attachmentService");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const UserCredential = require("../../models/email/userCredentialModel");
const DefaultEmail = require("../../models/email/defaultEmailModel");
const MasterUser = require("../../models/master/masterUserModel");
const { Lead, Deal, Person, Organization } = require("../../models/index");
const Activity = require("../../models/activity/activityModel");
const { publishToQueue } = require("../../services/rabbitmqService");
const { log } = require("console");

// Configuration constants
const ICON_ATTACHMENT_SIZE_THRESHOLD = 100; // bytes - attachments smaller than this are considered icons/tracking pixels
const MAX_BATCH_SIZE = 100; // Maximum number of emails to process in one batch
const DEFAULT_BATCH_SIZE = 50; // Default batch size for email fetching
// Helper function to identify icon/image attachments and body content that shouldn't be saved as attachments
const isIconAttachment = (attachment) => {
  const filename = attachment.filename || attachment.generatedFileName || "";
  const contentType = attachment.contentType || "";
  const contentId = attachment.contentId || "";
  const contentDisposition = attachment.contentDisposition || "";

  // DON'T skip inline attachments anymore - we need them for email body rendering
  // Instead, we'll save them and mark them as inline for proper handling
  if (contentDisposition.toLowerCase().includes("inline")) {
    console.log(
      `Keeping inline attachment for email body: ${filename} (${contentType}) with contentId: ${contentId}`
    );
    return false; // Changed from true to false - keep inline attachments
  }

  // Skip if it has a content ID (usually embedded images)
  // BUT allow screenshots and important embedded images
  if (contentId) {
    // Allow screenshots and important embedded images
    const importantEmbeddedPatterns = [
      /screenshot/i,
      /image_?\d+/i, // image001, image_1, etc.
      /photo/i,
      /picture/i,
      /document/i,
      /scan/i,
      /attachment/i,
      /file/i,
    ];

    const isImportantEmbedded =
      importantEmbeddedPatterns.some((pattern) => pattern.test(filename)) ||
      attachment.size > 5000; // Also keep larger embedded images (> 5KB)

    if (!isImportantEmbedded) {
      console.log(
        `Filtering out small embedded attachment: ${filename} (${contentType}) with contentId: ${contentId}`
      );
      return true;
    } else {
      console.log(
        `Keeping important embedded attachment: ${filename} (${contentType}) with contentId: ${contentId} - size: ${attachment.size} bytes`
      );
    }
  }

  // Skip common icon/signature image patterns
  const iconPatterns = [
    /icon/i,
    /signature/i,
    /logo/i,
    /avatar/i,
    /spacer/i,
    /pixel/i,
    /tracker/i,
    /blank/i,
    /transparent/i,
    /1x1/i,
  ];

  if (iconPatterns.some((pattern) => pattern.test(filename))) {
    console.log(
      `Filtering out icon/pattern attachment: ${filename} (${contentType})`
    );
    return true;
  }

  // Skip very small images (likely tracking pixels or icons) - CONFIGURABLE
  if (
    contentType.startsWith("image/") &&
    attachment.size &&
    attachment.size < ICON_ATTACHMENT_SIZE_THRESHOLD
  ) {
    console.log(
      `Filtering out small image attachment: ${filename} (${contentType}) - size: ${attachment.size} bytes (threshold: ${ICON_ATTACHMENT_SIZE_THRESHOLD} bytes)`
    );
    return true;
  }

  // Skip common body content types
  const bodyContentTypes = [
    "text/html",
    "text/plain",
    "multipart/",
    "message/",
  ];

  if (bodyContentTypes.some((type) => contentType.startsWith(type))) {
    console.log(
      `Filtering out body content attachment: ${filename} (${contentType})`
    );
    return true;
  }

  return false;
};

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
  // Add more providers as needed
};

// Add this near PROVIDER_CONFIG
const PROVIDER_FOLDER_MAP = {
  gmail: {
    inbox: "INBOX",
    drafts: "[Gmail]/Drafts",
    sent: "[Gmail]/Sent Mail",
    archive: "[Gmail]/All Mail",
  },
  yandex: {
    inbox: "INBOX",
    drafts: "Drafts",
    sent: "Sent",
    archive: "Archive",
  },
  outlook: {
    inbox: "INBOX",
    drafts: "Drafts",
    sent: "Sent",
    archive: "Archive",
  },
  custom: {
    inbox: "INBOX",
    drafts: "Drafts",
    sent: "Sent",
    archive: "Archive",
  },
};
// Ensure the upload directory exists
const uploadDir = path.join(__dirname, "../../uploads/attachments");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads/attachments")); // Directory to store attachments
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname); // Generate a unique filename
  },
});

const upload = multer({
  storage,
  // limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
});

const imapConfig = {
  imap: {
    user: process.env.SENDER_EMAIL, // Your email address
    password: process.env.SENDER_PASSWORD, // Your email password
    host: "imap.gmail.com", // IMAP host (e.g., Gmail)
    port: 993, // IMAP port
    tls: true, // Use TLS
    authTimeout: 30000,
    tlsOptions: {
      rejectUnauthorized: false, // Allow self-signed certificates
    },
  },
};
// const cleanEmailBody = (body) => {
//   if (!body) return "";

//   let cleanBody = body;

//   // Use html-to-text for robust HTML conversion
//   try {
//     if (body.includes("<") && body.includes(">")) {
//       // This looks like HTML, use html-to-text for better conversion
//       cleanBody = htmlToText(body, {
//         wordwrap: false,
//         ignoreHref: true,
//         ignoreImage: true,
//         preserveNewlines: true,
//         uppercaseHeadings: false,
//         hideLinkHrefIfSameAsText: true,
//         noLinkBrackets: true,
//         formatters: {
//           // Custom formatter to handle VML and CSS blocks
//           vmlBlock: function (elem, walk, builder, formatOptions) {
//             return "";
//           },
//           styleBlock: function (elem, walk, builder, formatOptions) {
//             return "";
//           },
//         },
//         selectors: [
//           // Ignore VML and style blocks completely
//           { selector: "v\\:*", format: "skip" },
//           { selector: "o\\:*", format: "skip" },
//           { selector: "style", format: "skip" },
//           { selector: "script", format: "skip" },
//           { selector: "head", format: "skip" },
//           { selector: "title", format: "skip" },
//           { selector: "meta", format: "skip" },
//           { selector: "link", format: "skip" },
//           // Format common elements
//           { selector: "p", format: "paragraph" },
//           { selector: "br", format: "lineBreak" },
//           { selector: "div", format: "block" },
//           { selector: "span", format: "inline" },
//           { selector: "table", format: "table" },
//           { selector: "tr", format: "tableRow" },
//           { selector: "td", format: "tableCell" },
//           { selector: "th", format: "tableCell" },
//           { selector: "ul", format: "unorderedList" },
//           { selector: "ol", format: "orderedList" },
//           { selector: "li", format: "listItem" },
//         ],
//       });
//     }
//   } catch (htmlError) {
//     console.log(
//       "HTML-to-text conversion failed, falling back to regex cleanup:",
//       htmlError.message
//     );
//     // Fall back to regex if html-to-text fails
//     cleanBody = body.replace(/<[^>]*>/g, "");
//   }

//   // Additional cleanup for any remaining VML/CSS artifacts
//   cleanBody = cleanBody.replace(/v\\\*\s*\{[^}]*\}/g, "");
//   cleanBody = cleanBody.replace(/o\\\*\s*\{[^}]*\}/g, "");
//   cleanBody = cleanBody.replace(/\{[^}]*behavior:[^}]*\}/g, "");
//   cleanBody = cleanBody.replace(/\{[^}]*url\([^)]*\)[^}]*\}/g, "");
//   cleanBody = cleanBody.replace(/\{[^}]*\}/g, ""); // Remove any remaining CSS blocks

//   // Remove HTML entities and encoded characters
//   cleanBody = cleanBody.replace(/&[a-zA-Z0-9#]+;/g, " ");
//   cleanBody = cleanBody.replace(/\\[a-zA-Z0-9]+/g, " ");
//   cleanBody = cleanBody.replace(/v\\\*/g, "");
//   cleanBody = cleanBody.replace(/o\\\*/g, "");

//   // Remove quoted replies (e.g., lines starting with ">")
//   cleanBody = cleanBody
//     .split("\n")
//     .filter((line) => !line.trim().startsWith(">"))
//     .join("\n");

//   // Clean up extra whitespace and special characters
//   cleanBody = cleanBody.replace(/[{}[\]]/g, " ");
//   cleanBody = cleanBody.replace(/\s+/g, " ").trim();

//   return cleanBody;
// };
const cleanEmailBody = (body, attachments = [], baseURL = process.env.BASE_URL || 'http://localhost:3000') => {
  if (!body) return "";
  
  let cleanedBody = body;
  
  console.log(`[cleanEmailBody] 🔧 Processing body with ${attachments.length} attachments`);
  
  // Check for base64 embedded images before processing
  const base64ImageMatches = cleanedBody.match(/data:image\/[^;]+;base64,[^"'\s>]+/gi) || [];
  console.log(`[cleanEmailBody] 🖼️ Found ${base64ImageMatches.length} base64 embedded images`);
  if (base64ImageMatches.length > 0) {
    console.log(`[cleanEmailBody] 🖼️ Base64 images preview:`, base64ImageMatches.map(img => img.substring(0, 50) + '...'));
  }
  
  // Replace cid: references with actual attachment URLs (only if we have attachments)
  if (attachments && attachments.length > 0) {
    attachments.forEach(attachment => {
      if (attachment.contentId) {
        // Clean the contentId (remove < > brackets if present)
        const contentId = attachment.contentId.replace(/[<>]/g, '');
        
        let attachmentUrl = '';
        
        // Handle both user-uploaded and fetched attachments
        if (attachment.filePath) {
          // User-uploaded files with filePath
          attachmentUrl = attachment.filePath.startsWith('http') 
            ? attachment.filePath 
            : `${baseURL}${attachment.filePath}`;
        } else if (attachment.path) {
          // Attachments with path property
          attachmentUrl = attachment.path.startsWith('http') 
            ? attachment.path 
            : `${baseURL}${attachment.path}`;
        } else if (attachment.filename) {
          // Fallback: construct path from filename
          attachmentUrl = `${baseURL}/uploads/attachments/${attachment.filename}`;
        }
        
        if (attachmentUrl) {
          // Replace all cid: references in the email body
          const cidPattern = new RegExp(`cid:${contentId}`, 'gi');
          const beforeReplace = cleanedBody.includes(`cid:${contentId}`);
          cleanedBody = cleanedBody.replace(cidPattern, attachmentUrl);
          
          if (beforeReplace) {
            console.log(`[cleanEmailBody] 🔗 Replaced cid:${contentId} with ${attachmentUrl}`);
          }
        }
      }
    });
  }
  
  // 🚀 PRESERVE SIGNATURES AND IMAGES: Don't remove quoted replies indiscriminately
  // Only remove obvious quoted content, but preserve signatures and inline images
  
  // Instead of removing all ">" lines, only remove email thread history
  // (usually starts with "On ... wrote:" or "From:" patterns)
  const lines = cleanedBody.split('\n');
  const preservedLines = [];
  let inQuotedSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Detect start of quoted email thread (common patterns)
    const isQuoteStart = trimmedLine.match(/^(On .* wrote:|From:.*|Sent:.*|To:.*|Subject:.*|\*\*\* .*|>+\s*On .* wrote:|>+\s*From:)/i);
    
    // If we find a quote start pattern, mark as quoted section
    if (isQuoteStart) {
      inQuotedSection = true;
      continue; // Skip this line
    }
    
    // If line doesn't start with > and we were in quoted section, we might be out
    if (inQuotedSection && !line.startsWith('>') && trimmedLine !== '') {
      // Check if this looks like new content (not part of quote)
      const looksLikeNewContent = trimmedLine.length > 10 && 
                                  !trimmedLine.match(/^(Re:|Fw:|Fwd:|\-\-|\+\+|[\*\-\=]{3,})/i);
      if (looksLikeNewContent) {
        inQuotedSection = false;
      }
    }
    
    // Preserve the line if not in quoted section, or if it contains important content
    if (!inQuotedSection || 
        trimmedLine.includes('<img') || 
        trimmedLine.includes('data:image/') || // Preserve base64 embedded images
        trimmedLine.includes('base64,') || // Preserve base64 content
        trimmedLine.includes('signature') || 
        trimmedLine.includes('cid:') ||
        trimmedLine.match(/^[\-\*\=]{2,}/) || // Signature separators
        (trimmedLine.startsWith('>') && trimmedLine.length < 50)) { // Short quoted lines might be signatures
      preservedLines.push(line);
    }
  }
  
  cleanedBody = preservedLines.join('\n').trim();
  
  // Check if base64 images are still present after cleaning
  const finalBase64Images = cleanedBody.match(/data:image\/[^;]+;base64,[^"'\s>]+/gi) || [];
  console.log(`[cleanEmailBody] ✅ Preserved signatures and images. Lines: ${lines.length} -> ${preservedLines.length}`);
  console.log(`[cleanEmailBody] 🖼️ Base64 images after cleaning: ${finalBase64Images.length} (${base64ImageMatches.length - finalBase64Images.length} lost)`);
  
  if (base64ImageMatches.length > finalBase64Images.length) {
    console.warn(`[cleanEmailBody] ⚠️ WARNING: ${base64ImageMatches.length - finalBase64Images.length} base64 images were lost during cleaning!`);
  }
  
  return cleanedBody;
};

// Minimal body processing - only replace CID references, preserve all content
const replaceCidReferences = (body, attachments = [], baseURL = process.env.BASE_URL || 'http://localhost:3000') => {
  if (!body) return "";
  
  let processedBody = body;
  
  console.log(`[replaceCidReferences] 🔧 Processing body with ${attachments.length} attachments (preserve mode)`);
  
  // Only replace cid: references with actual attachment URLs
  if (attachments && attachments.length > 0) {
    attachments.forEach(attachment => {
      if (attachment.contentId) {
        // Clean the contentId (remove < > brackets if present)
        const contentId = attachment.contentId.replace(/[<>]/g, '');
        
        let attachmentUrl = '';
        
        // Handle both user-uploaded and fetched attachments
        if (attachment.filePath) {
          attachmentUrl = attachment.filePath.startsWith('http') 
            ? attachment.filePath 
            : `${baseURL}${attachment.filePath}`;
        } else if (attachment.path) {
          attachmentUrl = attachment.path.startsWith('http') 
            ? attachment.path 
            : `${baseURL}${attachment.path}`;
        } else if (attachment.filename) {
          attachmentUrl = `${baseURL}/uploads/attachments/${attachment.filename}`;
        }
        
        if (attachmentUrl) {
          const cidPattern = new RegExp(`cid:${contentId}`, 'gi');
          const beforeReplace = processedBody.includes(`cid:${contentId}`);
          processedBody = processedBody.replace(cidPattern, attachmentUrl);
          
          if (beforeReplace) {
            console.log(`[replaceCidReferences] 🔗 Replaced cid:${contentId} with ${attachmentUrl}`);
          }
        }
      }
    });
  }
  
  console.log(`[replaceCidReferences] ✅ Preserved all content. No signatures or formatting removed.`);
  
  return processedBody;
};

// Helper function to create email body preview
const createBodyPreview = (body, maxLength = 120) => {
  if (!body) return "";

  let cleanBody = body;

  // Use html-to-text for robust HTML conversion
  try {
    if (body.includes("<") && body.includes(">")) {
      // This looks like HTML, use html-to-text for better conversion
      cleanBody = htmlToText(body, {
        wordwrap: false,
        ignoreHref: true,
        ignoreImage: true,
        preserveNewlines: false,
        uppercaseHeadings: false,
        hideLinkHrefIfSameAsText: true,
        noLinkBrackets: true,
        formatters: {
          // Custom formatter to handle VML and CSS blocks
          vmlBlock: function (elem, walk, builder, formatOptions) {
            return "";
          },
          styleBlock: function (elem, walk, builder, formatOptions) {
            return "";
          },
        },
        selectors: [
          // Ignore VML and style blocks completely
          { selector: "v\\:*", format: "skip" },
          { selector: "o\\:*", format: "skip" },
          { selector: "style", format: "skip" },
          { selector: "script", format: "skip" },
          { selector: "head", format: "skip" },
          { selector: "title", format: "skip" },
          { selector: "meta", format: "skip" },
          { selector: "link", format: "skip" },
          // Format common elements to preserve structure
          { selector: "p", format: "paragraph" },
          { selector: "br", format: "lineBreak" },
          { selector: "div", format: "block" },
          { selector: "span", format: "inline" },
        ],
      });
    }
  } catch (htmlError) {
    console.log(
      "HTML-to-text conversion failed in preview, falling back to regex cleanup:",
      htmlError.message
    );
    // Fall back to regex if html-to-text fails
    cleanBody = body.replace(/<[^>]*>/g, "");
  }

  // Additional cleanup for any remaining VML/CSS artifacts
  cleanBody = cleanBody.replace(/v\\\*\s*\{[^}]*\}/g, "");
  cleanBody = cleanBody.replace(/o\\\*\s*\{[^}]*\}/g, "");
  cleanBody = cleanBody.replace(/\{[^}]*behavior:[^}]*\}/g, "");
  cleanBody = cleanBody.replace(/\{[^}]*url\([^)]*\)[^}]*\}/g, "");
  cleanBody = cleanBody.replace(/\{[^}]*\}/g, ""); // Remove any remaining CSS blocks

  // Remove HTML entities and encoded characters
  cleanBody = cleanBody.replace(/&[a-zA-Z0-9#]+;/g, " ");
  cleanBody = cleanBody.replace(/\\[a-zA-Z0-9]+/g, " ");
  cleanBody = cleanBody.replace(/v\\\*/g, "");
  cleanBody = cleanBody.replace(/o\\\*/g, "");

  // Remove extra whitespace, newlines, and special characters
  cleanBody = cleanBody.replace(/\s+/g, " ").trim();

  // Remove any remaining curly braces and brackets
  cleanBody = cleanBody.replace(/[{}[\]]/g, " ");

  // Clean up any remaining special patterns
  cleanBody = cleanBody.replace(/[^\w\s.,!?;:()-]/g, " ");

  // Final cleanup - remove multiple spaces
  cleanBody = cleanBody.replace(/\s+/g, " ").trim();

  // If after cleaning there's no meaningful content, return empty
  if (cleanBody.length < 3 || /^[\s\W]*$/.test(cleanBody)) {
    return "";
  }

  // Truncate to maxLength and add ellipsis if needed
  if (cleanBody.length <= maxLength) {
    return cleanBody;
  }

  return cleanBody.substring(0, maxLength).trim() + "...";
};

// Helper function to format date to DD-MMM-YYYY
const formatDateForIMAP = (date) => {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};
function flattenFolders(boxes, prefix = "") {
  let folders = [];
  for (const [name, box] of Object.entries(boxes)) {
    const fullName = prefix ? `${prefix}${name}` : name;
    folders.push(fullName);
    if (box.children) {
      folders = folders.concat(
        flattenFolders(box.children, `${fullName}${box.delimiter}`)
      );
    }
  }
  return folders;
}

// Helper function to find matching folder by type
function findMatchingFolder(allFoldersArr, folderType) {
  const folderMap = {
    inbox: ["INBOX", "Inbox", "inbox"],
    sent: [
      "Sent", "SENT", "Sent Items", "Sent Mail", 
      "[Gmail]/Sent Mail", "[Google Mail]/Sent Mail",
      "Отправленные", "Sent",  // Yandex Russian and English
      "Отправлено", "Sent Messages",  // Additional Yandex patterns
      "outbox", "Outbox", "OUTBOX"  // Yandex uses outbox for sent emails
    ],
    drafts: [
      "Drafts", "DRAFTS", "Draft", "[Gmail]/Drafts", "[Google Mail]/Drafts",
      "Черновики", "Черновики"  // Yandex Russian
    ],
    archive: [
      "Archive", "ARCHIVE", "All Mail", "[Gmail]/All Mail", "[Google Mail]/All Mail", 
      "Archived", "Архив"  // Yandex Russian
    ]
  };
  
  const patterns = folderMap[folderType] || [folderType];
  
  console.log(`🔍 FOLDER SEARCH: Looking for '${folderType}' using patterns: [${patterns.join(', ')}]`);
  console.log(`🔍 AVAILABLE FOLDERS: [${allFoldersArr.join(', ')}]`);
  
  // Special handling for Yandex sent folder - try exact matches for Russian names first, then outbox
  if (folderType === 'sent') {
    // Try Yandex Russian folder names with exact matching first
    const yandexExactNames = ['Отправленные', 'Отправлено'];
    for (const exactName of yandexExactNames) {
      const found = allFoldersArr.find(folder => folder === exactName);
      if (found) {
        console.log(`✅ YANDEX EXACT MATCH: Found '${found}' for exact Russian pattern`);
        return found;
      }
    }
    
    // Try outbox as Yandex sent folder alternative
    const outboxFound = allFoldersArr.find(folder => folder.toLowerCase() === 'outbox');
    if (outboxFound) {
      console.log(`✅ YANDEX OUTBOX MATCH: Found '${outboxFound}' - using as SENT folder for Yandex`);
      return outboxFound;
    }
  }
  
  for (const pattern of patterns) {
    // 🔧 GMAIL FIX: Use exact case matching for Gmail folders first
    const exactFound = allFoldersArr.find(folder => folder === pattern);
    if (exactFound) {
      console.log(`✅ EXACT MATCH: Found '${exactFound}' for exact pattern '${pattern}'`);
      return exactFound;
    }
    
    // Fallback to case-insensitive matching for other providers
    const found = allFoldersArr.find(folder => 
      folder.toLowerCase() === pattern.toLowerCase() ||
      folder.toLowerCase().includes(pattern.toLowerCase())
    );
    if (found) {
      console.log(`✅ FOLDER MATCH: Found '${found}' for pattern '${pattern}'`);
      return found;
    }
  }
  
  console.log(`❌ FOLDER NOT FOUND: No match for '${folderType}' in available folders`);
  return null;
}

// Helper function to recursively fetch all emails in a thread
async function getFullThread(messageId, EmailModel, collected = new Set()) {
  if (!messageId || collected.has(messageId)) return [];
  collected.add(messageId);
  const emails = await EmailModel.findAll({
    where: {
      [Sequelize.Op.or]: [
        { messageId },
        { inReplyTo: messageId },
        { references: { [Sequelize.Op.like]: `%${messageId}%` } },
      ],
    },
  });
  let thread = [...emails];
  for (const email of emails) {
    if (email.inReplyTo && !collected.has(email.inReplyTo)) {
      thread = thread.concat(
        await getFullThread(email.inReplyTo, EmailModel, collected)
      );
    }
    if (email.references) {
      const refs = email.references.split(" ");
      for (const ref of refs) {
        if (ref && !collected.has(ref)) {
          thread = thread.concat(
            await getFullThread(ref, EmailModel, collected)
          );
        }
      }
    }
  }
  return thread;
}

// 🚀 PHASE 2: Fetch single email body on-demand
const fetchSingleEmailBody = async (messageId, userCredential) => {
  const imaps = require('imap-simple');
  
  try {
    console.log(`[Phase 2] Connecting to IMAP for single email body fetch...`);
    
    // Connect to IMAP
    const connection = await imaps.connect({
      imap: {
        user: userCredential.email,
        password: userCredential.appPassword,
        host: userCredential.imapHost,
        port: userCredential.imapPort,
        tls: userCredential.imapEncryption === 'tls',
        authTimeout: 30000,
        connTimeout: 30000,
        tlsOptions: { rejectUnauthorized: false }
      }
    });
    
    await connection.openBox('INBOX');
    console.log(`[Phase 2] IMAP connected, searching for message: ${messageId}`);
    
    // Search for specific email by message ID
    const searchCriteria = [['HEADER', 'MESSAGE-ID', messageId]];
    const fetchOptions = {
      bodies: 'TEXT', // Fetch full body content
      struct: true
    };
    
    const emails = await connection.search(searchCriteria, fetchOptions);
    
    if (emails && emails.length > 0) {
      const email = emails[0];
      console.log(`[Phase 2] Found email, extracting body...`);
      
      // Extract body content
      let bodyContent = '';
      if (email.bodies && email.bodies.TEXT) {
        bodyContent = email.bodies.TEXT;
      }
      
      await connection.end();
      console.log(`[Phase 2] Single email body fetched successfully`);
      return bodyContent;
    } else {
      await connection.end();
      console.log(`[Phase 2] Email not found with message ID: ${messageId}`);
      return null;
    }
    
  } catch (error) {
    console.log(`[Phase 2] Error fetching single email body:`, error.message);
    return null;
  }
};

// 🧠 INTELLIGENT CHUNKING: Helper function to fetch emails in date-based chunks for ALL providers
// Enhanced progressive timeout calculation based on strategy
const getProgressiveTimeout = (strategy) => {
  switch (strategy) {
    case "MASSIVE_INBOX": return 60000; // 60s for metadata-only fetching (Yandex compatibility)
    case "VERY_LARGE": return 45000; // 45 seconds for very large inboxes
    case "LARGE": return 30000; // 30 seconds for large inboxes
    case "MEDIUM": return 20000; // 20 seconds for medium inboxes
    case "SMALL_CHUNKS": return 15000; // 15 seconds for small chunks
    default: return 10000; // 10 seconds for normal
  }
};

// ⚡ HIGH-PERFORMANCE: Batch fetch by UID ranges (100-200 emails at once)
const fetchEmailsByUIDRanges = async (connection, uidRanges, strategy = 'NORMAL', page = 1, userID = 'unknown', provider = 'unknown') => {
  // 🚀 METADATA-ONLY FETCH: Can handle larger batches since we're not fetching bodies
  const batchSize = strategy === "MASSIVE_INBOX" ? 1 : 5; // Yandex: ultra-conservative 1 range at a time
  const allEmails = [];
  let successfulBatches = 0;
  let failedBatches = 0;
  
  console.log(`[Batch ${page}] ⚡ HIGH-PERFORMANCE FETCH: Processing ${uidRanges.length} UID ranges for USER ${userID} ${provider}`);
  console.log(`[Batch ${page}] 🎯 METADATA BATCH SIZE: ${batchSize} UID ranges per fetch (strategy: ${strategy})`);
  
  for (let i = 0; i < uidRanges.length; i += batchSize) {
    const batchRanges = uidRanges.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    
    try {
      // Create UID range string: "1001:1100,1201:1300,1401:1500"
      const uidRangeStr = batchRanges.map(range => `${range.start}:${range.end}`).join(',');
      
      console.log(`[Batch ${page}] 🔄 UID Batch ${batchNum}: Fetching UIDs ${uidRangeStr} (${batchRanges.length} ranges)`);
      
      const timeout = getProgressiveTimeout(strategy);
      
      const fetchPromise = new Promise(async (resolve, reject) => {
        try {
          if (batchRanges.length > 0) {
            // 🚀 TWO-PASS STRATEGY: Metadata first, then bodies
            let searchCriteria;
            let fetchOptions;
            
            if (batchRanges.length === 1) {
              // Single range - use simple UID range format
              const range = batchRanges[0];
              searchCriteria = [['UID', `${range.start}:${range.end}`]];
              
              // 📋 PROGRESSIVE STRATEGY: Try HEADER.FIELDS first, fallback to HEADER
              fetchOptions = {
                bodies: 'HEADER',  // Use simpler HEADER for better compatibility
                struct: true,     // Get structure for attachments
                envelope: true,   // Get envelope for quick access
                markSeen: false   // Don't mark as read
              };
              
              console.log(`[Batch ${page}] 🔍 METADATA FETCH: UIDs ${range.start}:${range.end} (${range.end - range.start + 1} emails)`);
            } else {
              // Multiple ranges - use comma-separated ranges 
              const rangeList = batchRanges.map(range => `${range.start}:${range.end}`).join(',');
              searchCriteria = [['UID', rangeList]];
              
              // 📋 PROGRESSIVE STRATEGY: Use simpler HEADER for better compatibility
              fetchOptions = {
                bodies: 'HEADER',  // Use simpler HEADER for better compatibility
                struct: true,     // Get structure for attachments
                envelope: true,   // Get envelope for quick access
                markSeen: false   // Don't mark as read
              };
              
              console.log(`[Batch ${page}] 🔍 METADATA FETCH: ${batchRanges.length} ranges: ${rangeList}`);
            }
            
            console.log(`[Batch ${page}] 🔍 SEARCH DEBUG: Using criteria:`, searchCriteria);
            
            // Fetch metadata only (fast and reliable)
            const emails = await connection.search(searchCriteria, fetchOptions);
            console.log(`[Batch ${page}] 📨 METADATA RESULT: Found ${emails.length} email headers`);
            
            // 📋 TODO: PASS 2 will be implemented separately for body fetching
            // For now, we successfully get all email metadata without timeouts
            
            resolve(emails);
          } else {
            resolve([]);
          }
        } catch (err) {
          reject(err);
        }
      });
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`UID batch ${batchNum} timeout`)), timeout)
      );
      
      const emails = await Promise.race([fetchPromise, timeoutPromise]);
      allEmails.push(...emails);
      successfulBatches++;
      
      console.log(`[Batch ${page}] ✅ UID Batch ${batchNum}: Found ${emails.length} email headers in ${timeout/1000}s`);
      
      // Minimal pause between batches
      if (i + batchSize < uidRanges.length) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5s pause
      }
      
    } catch (error) {
      failedBatches++;
      console.log(`[Batch ${page}] ⚠️ UID Batch ${batchNum} failed: ${error.message}`);
      
      // Continue processing other batches - more tolerant with smaller batches
      if (failedBatches > 10 && successfulBatches === 0) {
        console.log(`[Batch ${page}] ❌ Too many failed UID batches, stopping`);
        break;
      }
    }
  }
  
  console.log(`[Batch ${page}] 🎯 UID BATCH SUMMARY: ${allEmails.length} emails, ${successfulBatches} successful, ${failedBatches} failed batches`);
  return allEmails;
};

// ⚡ HIGH-PERFORMANCE: Parallel database saving with p-limit
const saveEmailsInParallel = async (emails, concurrency = 10, userID, provider, page = 1) => {
  const pLimit = require('p-limit');
  const limit = pLimit(concurrency); // Process up to 10 emails at once
  const savedEmails = [];
  const errors = [];
  const startTime = Date.now();
  
  console.log(`[Batch ${page}] ⚡ PARALLEL SAVING: ${emails.length} emails with concurrency ${concurrency} for USER ${userID}`);
  
  const savePromises = emails.map((email, index) => 
    limit(async () => {
      try {
        // Check if email already exists
        const existingEmail = await Email.findOne({
          where: { messageId: email.messageId },
        });
        
        if (!existingEmail) {
          // 🔍 DEBUG: Log UID before saving
          console.log(`[Batch ${page}] 💾 SAVING NEW EMAIL: ${email.messageId} with UID: ${email.uid}`);
          const savedEmail = await Email.create(email);
          savedEmails.push(savedEmail);
          
          // Progress logging every 50 saves
          if (savedEmails.length % 50 === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            const rate = savedEmails.length / elapsed;
            console.log(`[Batch ${page}] 💾 SAVED: ${savedEmails.length}/${emails.length} emails (${rate.toFixed(1)} saves/sec)`);
          }
          
          return savedEmail;
        } else {
          // ✅ UPDATE: Check if existing email needs UID update
          if (!existingEmail.uid && email.uid) {
            console.log(`[Batch ${page}] 🔄 UID UPDATE: Email ${email.messageId} - existing UID: ${existingEmail.uid}, new UID: ${email.uid}`);
            await existingEmail.update({ uid: email.uid });
            console.log(`[Batch ${page}] 🔄 UID UPDATED: Email ${email.messageId} now has UID ${email.uid}`);
            savedEmails.push(existingEmail); // Count as processed
            return existingEmail;
          } else if (existingEmail.uid && email.uid && existingEmail.uid !== email.uid) {
            // Handle potential UID conflicts (rare but possible)
            console.log(`[Batch ${page}] ⚠️ UID CONFLICT: Email ${email.messageId} has different UID (existing: ${existingEmail.uid}, new: ${email.uid})`);
          } else {
            console.log(`[Batch ${page}] ⏭️ SKIP: Email ${email.messageId} already exists with UID (existing: ${existingEmail.uid}, new: ${email.uid})`);
          }
          return null;
        }
      } catch (error) {
        errors.push({ email: email.messageId, error: error.message });
        console.log(`[Batch ${page}] ⚠️ SAVE ERROR: ${email.messageId} - ${error.message}`);
        return null;
      }
    })
  );
  
  // Wait for all saves to complete 
  await Promise.all(savePromises);
  
  const totalTime = (Date.now() - startTime) / 1000;
  const rate = savedEmails.length / totalTime;
  
  console.log(`[Batch ${page}] ✅ PARALLEL SAVE COMPLETE: ${savedEmails.length} processed (new emails + UID updates), ${errors.length} errors in ${totalTime.toFixed(1)}s (${rate.toFixed(1)} saves/sec)`);
  
  return { savedEmails, errors, processingTime: totalTime, rate };
};

// ⚡ HIGH-PERFORMANCE: Fast email fetching with optimized strategy  
const fetchEmailsHighPerformance = async (connection, strategy, userID, provider, page = 1) => {
  const startTime = Date.now();
  let allEmails = [];
  
  console.log(`[Batch ${page}] 🚀 HIGH-PERFORMANCE FETCH: Starting optimized fetch for USER ${userID} ${provider} (strategy: ${strategy})`);
  
  try {
    // Step 1: Get all UIDs quickly (no body fetch)
    console.log(`[Batch ${page}] 📋 STEP 1: Getting all email UIDs...`);
    const uidResults = await connection.search(['ALL'], { struct: false });
    
    // Extract UIDs from message objects
    const totalUIDs = uidResults.map((msg) => msg.attributes.uid);
    
    console.log(`[Batch ${page}] 📊 FOUND: ${totalUIDs.length} total emails in inbox`);
    
    // Step 2: Priority strategy - Recent emails first
    const recentCount = strategy === "MASSIVE_INBOX" ? 2000 : 
                       strategy === "VERY_LARGE" ? 3000 :
                       strategy === "LARGE" ? 5000 : totalUIDs.length;
    
    const priorityUIDs = totalUIDs.slice(-recentCount); // Get most recent emails
    console.log(`[Batch ${page}] 🎯 PRIORITY: Processing ${priorityUIDs.length} recent emails first`);
    
    // Step 3: Create UID ranges for batch fetching (METADATA ONLY - can handle larger batches)
    const batchSize = strategy === "MASSIVE_INBOX" ? 25 : 100; // Smaller batches for Yandex MASSIVE_INBOX
    const uidRanges = [];
    
    for (let i = 0; i < priorityUIDs.length; i += batchSize) {
      const startUID = priorityUIDs[i];
      const endUID = priorityUIDs[Math.min(i + batchSize - 1, priorityUIDs.length - 1)];
      uidRanges.push({ start: startUID, end: endUID });
    }
    
    console.log(`[Batch ${page}] 📦 BATCHING: Created ${uidRanges.length} UID ranges (${batchSize} emails per range)`);
    
    // Step 4: Batch fetch by UID ranges
    allEmails = await fetchEmailsByUIDRanges(connection, uidRanges, strategy, page, userID, provider);
    
    const fetchTime = (Date.now() - startTime) / 1000;
    const fetchRate = allEmails.length / fetchTime;
    
    console.log(`[Batch ${page}] ✅ FETCH COMPLETE: ${allEmails.length} emails fetched in ${fetchTime.toFixed(1)}s (${fetchRate.toFixed(1)} emails/sec)`);
    
    return {
      emails: allEmails,
      totalCount: totalUIDs.length,
      fetchedCount: allEmails.length,
      fetchTime: fetchTime,
      fetchRate: fetchRate,
      strategy: strategy
    };
    
  } catch (error) {
    console.log(`[Batch ${page}] ❌ HIGH-PERFORMANCE FETCH ERROR: ${error.message}`);
    throw error;
  }
};

const fetchEmailsInChunksEnhanced = async (connection, chunkDays, page, provider = 'unknown', userID = 'unknown', strategy = 'NORMAL') => {
  const formatDateForIMAP = (date) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const allChunkedMessages = [];
  const today = new Date();
  
  // Enhanced chunk limits based on strategy
  const getMaxChunks = (strategy) => {
    switch (strategy) {
      case "MASSIVE_INBOX": return 500; // Process up to 500 chunks (10+ years of 7-day chunks)
      case "VERY_LARGE": return 400; // Process up to 400 chunks (11+ years of 10-day chunks)
      case "LARGE": return 300; // Process up to 300 chunks (12+ years of 15-day chunks)
      case "MEDIUM": return 200; // Process up to 200 chunks (16+ years of 30-day chunks)
      case "SMALL_CHUNKS": return 100; // Process up to 100 chunks (16+ years of 60-day chunks)
      default: return 50; // Default for normal processing
    }
  };
  
  const maxChunks = getMaxChunks(strategy);
  let successfulChunks = 0;
  let failedChunks = 0;
  let lastChunkProcessed = 0;
  let memoryOptimizationTrigger = false;
  
  console.log(`[Batch ${page}] 🚀 ENHANCED CHUNKING: Starting ${provider} enhanced fetch for USER ${userID}`);
  console.log(`[Batch ${page}] 🔧 STRATEGY: ${strategy} with ${chunkDays}-day chunks, max ${maxChunks} chunks`);
  console.log(`[Batch ${page}] 📊 CAPACITY: Will process up to ${Math.floor(maxChunks * chunkDays / 365)} years of email history`);
  
  for (let chunk = 0; chunk < maxChunks; chunk++) {
    lastChunkProcessed = chunk + 1;
    let chunkMessages = [];
    
    try {
      const chunkEndDate = new Date(today.getTime() - (chunk * chunkDays * 24 * 60 * 60 * 1000));
      const chunkStartDate = new Date(today.getTime() - ((chunk + 1) * chunkDays * 24 * 60 * 60 * 1000));
      
      const endDateStr = formatDateForIMAP(chunkEndDate);
      const startDateStr = formatDateForIMAP(chunkStartDate);
      
      console.log(`[Batch ${page}] 📅 USER ${userID} ${provider} Enhanced Chunk ${chunk + 1}/${maxChunks}: ${startDateStr} to ${endDateStr}`);
      
      // Enhanced progressive timeout based on strategy and chunk number
      const baseTimeout = getProgressiveTimeout(strategy);
      const adaptiveTimeout = baseTimeout + (chunk * 1000); // Add 1s per chunk for older data
      const maxTimeout = Math.min(adaptiveTimeout, 120000); // Cap at 2 minutes
      
      const searchPromise = connection.search([
        ["SINCE", startDateStr],
        ["BEFORE", endDateStr]
      ], {
        bodies: "HEADER",
        struct: true,
        envelope: true  // 🔧 ADD ENVELOPE for proper email metadata
      });
      
      const chunkTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${provider} enhanced chunk ${chunk + 1} timeout`)), maxTimeout)
      );
      
      chunkMessages = await Promise.race([searchPromise, chunkTimeout]);
      successfulChunks++;
      console.log(`[Batch ${page}] ✅ USER ${userID} ${provider} Enhanced Chunk ${chunk + 1}: Found ${chunkMessages.length} emails (${(maxTimeout/1000)}s timeout)`);
      
      allChunkedMessages.push(...chunkMessages);
      
      // Enhanced memory management based on strategy
      const memoryThresholds = {
        "MASSIVE_INBOX": 5000,
        "VERY_LARGE": 8000,
        "LARGE": 12000,
        "MEDIUM": 15000,
        "SMALL_CHUNKS": 20000,
        "NORMAL": 25000
      };
      
      const threshold = memoryThresholds[strategy] || 15000;
      
      if (allChunkedMessages.length > threshold && !memoryOptimizationTrigger) {
        memoryOptimizationTrigger = true;
        console.log(`[Batch ${page}] 🧠 MEMORY OPTIMIZATION: ${allChunkedMessages.length} emails collected, implementing memory management`);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          console.log(`[Batch ${page}] 🗑️ GARBAGE COLLECTION: Forced cleanup at ${allChunkedMessages.length} emails`);
        }
        
        // For massive inboxes, break into stages
        if (strategy === "MASSIVE_INBOX" && allChunkedMessages.length > 3000) {
          console.log(`[Batch ${page}] 🏁 MASSIVE INBOX STAGE COMPLETE: ${allChunkedMessages.length} emails collected, will continue in next session`);
          break;
        }
      }
      
      // Smart stopping logic with enhanced detection
      if (chunkMessages.length === 0) {
        console.log(`[Batch ${page}] 🏁 USER ${userID} ${provider} no more emails found, stopping at chunk ${chunk + 1}`);
        break;
      }
      
      // Dynamic chunk size adjustment for dense email periods
      if (chunkMessages.length > 500 && chunkDays > 3 && strategy !== "MASSIVE_INBOX") {
        console.log(`[Batch ${page}] 🔄 DENSE PERIOD DETECTED: ${chunkMessages.length} emails in ${chunkDays} days, consider smaller chunks for future optimization`);
      }
      
    } catch (error) {
      failedChunks++;
      console.log(`[Batch ${page}] ⚠️ USER ${userID} ${provider} Enhanced Chunk ${chunk + 1} failed: ${error.message}, continuing...`);
      
      // Enhanced error handling with strategy-specific recovery
      if (failedChunks > 10 && successfulChunks === 0) {
        console.log(`[Batch ${page}] ❌ USER ${userID} ${provider} too many failed chunks (${failedChunks}) with no success, stopping enhanced chunking`);
        break;
      } else if (failedChunks > 20 && successfulChunks > 10) {
        console.log(`[Batch ${page}] ⚠️ USER ${userID} ${provider} many failed chunks (${failedChunks}) but ${successfulChunks} successful, continuing with caution`);
      }
    }
    
    // Enhanced pause between chunks based on strategy
    if (chunk < maxChunks - 1) {
      const pauseDuration = strategy === "MASSIVE_INBOX" ? 2000 : 1000; // Longer pause for massive inboxes
      await new Promise(resolve => setTimeout(resolve, pauseDuration));
    }
  }
  
  console.log(`[Batch ${page}] 🎯 USER ${userID} ${provider} ENHANCED chunked fetch complete: ${allChunkedMessages.length} total emails collected`);
  console.log(`[Batch ${page}] 📈 USER ${userID} ${provider} ENHANCED SUMMARY: ${successfulChunks} successful, ${failedChunks} failed out of ${lastChunkProcessed} total chunks`);
  console.log(`[Batch ${page}] 🏆 USER ${userID} PERFORMANCE: Processed ${Math.floor(allChunkedMessages.length / (successfulChunks || 1))} avg emails per successful chunk`);
  
  return allChunkedMessages;
};

const fetchEmailsInChunks = async (connection, chunkDays, page, provider = 'unknown', userID = 'unknown') => {
  const formatDateForIMAP = (date) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const allChunkedMessages = [];
  const today = new Date();
  const maxChunks = 200; // Increased from 50 to handle larger inboxes
  let successfulChunks = 0;
  let failedChunks = 0;
  let lastChunkProcessed = 0;
  
  console.log(`[Batch ${page}] 🔄 Starting ${provider} chunked fetch for USER ${userID}: ${chunkDays}-day chunks, max ${maxChunks} chunks`);
  console.log(`[Batch ${page}] 📊 USER ${userID} CHUNKING STRATEGY: Will process up to ${maxChunks * chunkDays} days of email history in ${chunkDays}-day chunks`);
  
  for (let chunk = 0; chunk < maxChunks; chunk++) {
    lastChunkProcessed = chunk + 1;
    let chunkMessages = [];
    try {
      const chunkEndDate = new Date(today.getTime() - (chunk * chunkDays * 24 * 60 * 60 * 1000));
      const chunkStartDate = new Date(today.getTime() - ((chunk + 1) * chunkDays * 24 * 60 * 60 * 1000));
      
      const endDateStr = formatDateForIMAP(chunkEndDate);
      const startDateStr = formatDateForIMAP(chunkStartDate);
      
      console.log(`[Batch ${page}] 📅 USER ${userID} ${provider} Chunk ${chunk + 1}/${maxChunks}: ${startDateStr} to ${endDateStr}`);
      
      // Search for emails in this date range with progressive timeout
      const baseTimeout = 20000; // Base 20 seconds
      const progressiveTimeout = baseTimeout + (chunk * 3000); // Add 3s per chunk for older data
      
      const searchPromise = connection.search([
        ["SINCE", startDateStr],
        ["BEFORE", endDateStr]
      ], {
        bodies: "HEADER",
        struct: true,
        envelope: true  // 🔧 ADD ENVELOPE for proper email metadata
      });
      
      const chunkTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${provider} chunk ${chunk + 1} timeout`)), progressiveTimeout)
      );
      
      chunkMessages = await Promise.race([searchPromise, chunkTimeout]);
      successfulChunks++;
      console.log(`[Batch ${page}] ✅ USER ${userID} ${provider} Chunk ${chunk + 1}: Found ${chunkMessages.length} emails (${(progressiveTimeout/1000)}s timeout)`);
      
      allChunkedMessages.push(...chunkMessages);
      
      // Smart stopping logic
      if (chunkMessages.length === 0) {
        console.log(`[Batch ${page}] 🏁 USER ${userID} ${provider} no more emails found, stopping at chunk ${chunk + 1}`);
        break;
      }
      
      // Memory protection - progressive strategy for very large inboxes
      if (allChunkedMessages.length > 10000) {
        console.log(`[Batch ${page}] 🛡️ USER ${userID} ${provider} STAGE 1 COMPLETE: ${allChunkedMessages.length} emails collected, will continue in next session`);
        break;
      } else if (allChunkedMessages.length > 5000) {
        // Switch to smaller chunks for remaining processing
        if (chunkDays > 7) {
          console.log(`[Batch ${page}] 🔄 USER ${userID} ${provider} SWITCHING TO MICRO-CHUNKS: Reducing to 7-day periods for dense email areas`);
          // Continue with current chunk size but note the strategy change
        }
      }
      
    } catch (error) {
      failedChunks++;
      console.log(`[Batch ${page}] ⚠️ USER ${userID} ${provider} Chunk ${chunk + 1} failed: ${error.message}, continuing...`);
      
      // If too many consecutive chunks fail, but we have some success, continue with smaller chunks
      if (failedChunks > 5 && successfulChunks === 0) {
        console.log(`[Batch ${page}] ❌ USER ${userID} ${provider} too many failed chunks (${failedChunks}) with no success, stopping chunking`);
        break;
      } else if (failedChunks > 10 && successfulChunks > 0) {
        console.log(`[Batch ${page}] ⚠️ USER ${userID} ${provider} many failed chunks (${failedChunks}) but ${successfulChunks} successful, switching to micro-chunking`);
        // Could implement micro-chunking here (3-5 day periods)
      }
      
      // Continue with next chunk even if this one fails
    }
    
    // Brief pause between chunks to prevent rate limiting
    if (chunk < maxChunks - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second pause
    }
  }
  
  console.log(`[Batch ${page}] 🎯 USER ${userID} ${provider} chunked fetch complete: ${allChunkedMessages.length} total emails collected`);
  console.log(`[Batch ${page}] 📈 USER ${userID} ${provider} CHUNK SUMMARY: ${successfulChunks} successful, ${failedChunks} failed out of ${lastChunkProcessed} total chunks`);
  return allChunkedMessages;
};

exports.queueFetchAllEmails = async (req, res) => {
  const { batchSize = 50, days = "all" } = req.query; // Enable ALL emails for all providers
  const masterUserID = req.adminId;
  const email = req.body?.email || req.email;
  const appPassword = req.body?.appPassword || req.appPassword;
  const provider = req.body?.provider;

  try {
    if (!masterUserID || !email || !appPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }

    console.log(
      `[Queue] Queuing all folders email fetch job for masterUserID: ${masterUserID} (delegated to workers)`
    );

    // Save user credentials for workers to use
    console.log(
      `[Queue] Saving user credentials for masterUserID: ${masterUserID}`
    );

    // Prepare SMTP config for saving
    const smtpConfigByProvider = {
      gmail: { smtpHost: "smtp.gmail.com", smtpPort: 465, smtpSecure: true },
      yandex: { smtpHost: "smtp.yandex.com", smtpPort: 465, smtpSecure: true },
      yahoo: {
        smtpHost: "smtp.mail.yahoo.com",
        smtpPort: 465,
        smtpSecure: true,
      },
      outlook: {
        smtpHost: "smtp.office365.com",
        smtpPort: 587,
        smtpSecure: false,
      },
    };

    let smtpHost = null,
      smtpPort = null,
      smtpSecure = null;
    if (["gmail", "yandex", "yahoo", "outlook"].includes(provider)) {
      const smtpConfig = smtpConfigByProvider[provider];
      smtpHost = smtpConfig.smtpHost;
      smtpPort = smtpConfig.smtpPort;
      smtpSecure = smtpConfig.smtpSecure;
    } else if (provider === "custom") {
      smtpHost = req.body.smtpHost;
      smtpPort = req.body.smtpPort;
      smtpSecure = req.body.smtpSecure;
    }

    // Check if credentials already exist
    const existingCredential = await UserCredential.findOne({
      where: { masterUserID },
    });

    if (existingCredential) {
      await existingCredential.update({
        email,
        appPassword,
        provider,
        imapHost: provider === "custom" ? req.body.imapHost : null,
        imapPort: provider === "custom" ? req.body.imapPort : null,
        imapTLS: provider === "custom" ? req.body.imapTLS : null,
        smtpHost,
        smtpPort,
        smtpSecure,
      });
      console.log(
        `[Queue] User credentials updated for masterUserID: ${masterUserID}`
      );
    } else {
      // Create new credentials with duplicate handling
      try {
        await UserCredential.create({
          masterUserID,
          email,
          appPassword,
          provider,
          imapHost: provider === "custom" ? req.body.imapHost : null,
          imapPort: provider === "custom" ? req.body.imapPort : null,
          imapTLS: provider === "custom" ? req.body.imapTLS : null,
          smtpHost,
          smtpPort,
          smtpSecure,
        });
        console.log(
          `[Queue] User credentials created for masterUserID: ${masterUserID}`
        );
      } catch (createError) {
        if (createError.name === "SequelizeUniqueConstraintError") {
          console.log(
            `[Queue] Duplicate detected, attempting to update existing credentials for masterUserID: ${masterUserID}`
          );
          const existingRecord = await UserCredential.findOne({
            where: { masterUserID },
          });
          if (existingRecord) {
            await existingRecord.update({
              email,
              appPassword,
              provider,
              imapHost: provider === "custom" ? req.body.imapHost : null,
              imapPort: provider === "custom" ? req.body.imapPort : null,
              imapTLS: provider === "custom" ? req.body.imapTLS : null,
              smtpHost,
              smtpPort,
              smtpSecure,
            });
            console.log(
              `[Queue] User credentials updated after duplicate error for masterUserID: ${masterUserID}`
            );
          }
        } else {
          throw createError; // Re-throw if it's not a duplicate error
        }
      }
    }

    // Queue job for dedicated inbox workers (no direct processing in main app)
    const userQueueName = `FETCH_INBOX_QUEUE_${masterUserID}`;

    // Send a simple job to workers to let them handle all the IMAP processing
    await publishToQueue(userQueueName, {
      masterUserID,
      email,
      appPassword,
      batchSize: Math.min(parseInt(batchSize), 25), // Align with worker limits
      page: 1, // Start with page 1, workers will handle pagination
      days,
      provider,
      imapHost: req.body.imapHost,
      imapPort: req.body.imapPort,
      imapTLS: req.body.imapTLS,
      smtpHost: req.body.smtpHost,
      smtpPort: req.body.smtpPort,
      smtpSecure: req.body.smtpSecure,
      dynamicFetch: true, // Let workers handle all IMAP operations
      skipCount: 0, // Start from beginning
    });

    console.log(
      `[Queue] Successfully queued all folders fetch job to ${userQueueName} - workers will handle all processing`
    );

    return res.status(200).json({
      message:
        "All folders email fetch job queued successfully. Workers will process emails from inbox, sent, drafts, and archive.",
      queueName: userQueueName,
      masterUserID,
      folders: ["inbox", "sent", "drafts", "archive"],
    });
  } catch (error) {
    console.error("[Queue] Error queuing all folders fetch job:", error);
    res.status(500).json({
      message: "Failed to queue all folders fetch job.",
      error: error.message,
    });
  }
};

// Backward compatibility - alias for the old function name
exports.queueFetchInboxEmails = exports.queueFetchAllEmails;

// Fetch emails from all folders (inbox, sent, drafts, archive) in batches
exports.fetchInboxEmails = async (req, res) => {
  // Optimized batch size for better performance
  let {
    batchSize = 50,
    page = 1,
    days = "all", // Enable ALL emails for all providers
    startUID,
    endUID,
    allUIDsInBatch,
    expectedCount,
  } = req.query;
  batchSize = Math.min(Number(batchSize) || 50, MAX_BATCH_SIZE);

  const masterUserID = req.adminId;
  const email = req.body?.email || req.email;
  const appPassword = req.body?.appPassword || req.appPassword;
  const provider = req.body?.provider;

  let connection;
  try {
    const currentPage = page || 1;
    const effectiveStartUID = startUID || 'auto';
    const effectiveEndUID = endUID || 'auto';
    
    console.log(
      `[Batch ${currentPage}] Starting fetch for ${batchSize} emails, UIDs: ${effectiveStartUID}-${effectiveEndUID}`
    );

    if (allUIDsInBatch) {
      console.log(`[Batch ${page}] Specific UIDs to fetch: ${allUIDsInBatch}`);
    }

    if (expectedCount) {
      console.log(
        `[Batch ${page}] Expected to process: ${expectedCount} emails`
      );
    }

    if (!masterUserID || !email || !appPassword || !provider) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Check if the user already has credentials saved
    const existingCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    const smtpConfigByProvider = {
      gmail: { smtpHost: "smtp.gmail.com", smtpPort: 465, smtpSecure: true },
      yandex: { smtpHost: "smtp.yandex.com", smtpPort: 465, smtpSecure: true },
      yahoo: {
        smtpHost: "smtp.mail.yahoo.com",
        smtpPort: 465,
        smtpSecure: true,
      },
      outlook: {
        smtpHost: "smtp.office365.com",
        smtpPort: 587,
        smtpSecure: false,
      },
    };

    // Prepare SMTP config for saving
    let smtpHost = null,
      smtpPort = null,
      smtpSecure = null;
    if (["gmail", "yandex", "yahoo", "outlook"].includes(provider)) {
      const smtpConfig = smtpConfigByProvider[provider];
      smtpHost = smtpConfig.smtpHost;
      smtpPort = smtpConfig.smtpPort;
      smtpSecure = smtpConfig.smtpSecure;
    } else if (provider === "custom") {
      smtpHost = req.body.smtpHost;
      smtpPort = req.body.smtpPort;
      smtpSecure = req.body.smtpSecure;
    }
    if (existingCredential) {
      await existingCredential.update({
        email,
        appPassword,
        provider,
        imapHost: provider === "custom" ? req.body.imapHost : null,
        imapPort: provider === "custom" ? req.body.imapPort : null,
        imapTLS: provider === "custom" ? req.body.imapTLS : null,
        smtpHost,
        smtpPort,
        smtpSecure,
      });
      console.log(`User credentials updated for masterUserID: ${masterUserID}`);
    } else {
      // Use upsert to avoid duplicate entry errors
      try {
        await UserCredential.create({
          masterUserID,
          email,
          appPassword,
          provider,
          imapHost: provider === "custom" ? req.body.imapHost : null,
          imapPort: provider === "custom" ? req.body.imapPort : null,
          imapTLS: provider === "custom" ? req.body.imapTLS : null,
          smtpHost,
          smtpPort,
          smtpSecure,
        });
        console.log(
          `User credentials created for masterUserID: ${masterUserID}`
        );
      } catch (createError) {
        if (createError.name === "SequelizeUniqueConstraintError") {
          // If creation fails due to duplicate, try to find and update
          console.log(
            `Duplicate detected, attempting to update existing credentials for masterUserID: ${masterUserID}`
          );
          const existingRecord = await UserCredential.findOne({
            where: { masterUserID },
          });
          if (existingRecord) {
            await existingRecord.update({
              email,
              appPassword,
              provider,
              imapHost: provider === "custom" ? req.body.imapHost : null,
              imapPort: provider === "custom" ? req.body.imapPort : null,
              imapTLS: provider === "custom" ? req.body.imapTLS : null,
              smtpHost,
              smtpPort,
              smtpSecure,
            });
            console.log(
              `User credentials updated after duplicate error for masterUserID: ${masterUserID}`
            );
          }
        } else {
          throw createError; // Re-throw if it's not a duplicate error
        }
      }
    }

    // Fetch emails after saving credentials
    console.log("Fetching emails for masterUserID:", masterUserID);
    // Fetch user credentials
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });

    if (!userCredential) {
      console.error(
        "User credentials not found for masterUserID:",
        masterUserID
      );
      return res.status(404).json({ message: "User credentials not found." });
    }
    console.log(userCredential.email, "email");
    console.log(userCredential.appPassword, "appPassword");

    const userEmail = userCredential.email;
    const userPassword = userCredential.appPassword;

    console.log("Connecting to IMAP server...");
    // const imapConfig = {
    //   imap: {
    //     user: userEmail,
    //     password: userPassword,
    //     host: "imap.gmail.com",
    //     port: 993,
    //     tls: true,
    //     authTimeout: 30000,
    //     tlsOptions: {
    //       rejectUnauthorized: false,
    //     },
    //   },
    // };
    let imapConfig;
    const providerd = userCredential.provider; // default to gmail

    const providerConfig = PROVIDER_CONFIG[providerd];
    const folderMap =
      PROVIDER_FOLDER_MAP[providerd] || PROVIDER_FOLDER_MAP["gmail"];
    if (providerd === "custom") {
      if (!userCredential.imapHost || !userCredential.imapPort) {
        return res.status(400).json({
          message: "Custom IMAP settings are missing in user credentials.",
        });
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
          keepalive: true, // Enable keepalive for better performance
        },
      };
    } else {
      imapConfig = {
        imap: {
          user: userCredential.email,
          password: userCredential.appPassword,
          host: providerConfig.host,
          port: providerConfig.port,
          tls: providerConfig.tls,
          authTimeout: 30000,
          tlsOptions: { rejectUnauthorized: false },
          keepalive: true, // Enable keepalive for better performance
        },
      };
    }

    connection = await Imap.connect(imapConfig);

    // Add robust error handler
    connection.on("error", (err) => {
      console.error("IMAP connection error:", err);
    });

    // Helper function to fetch emails from a specific folder using dynamic calculation
    const fetchEmailsFromFolder = async (folderName, folderType) => {
      try {
        await connection.openBox(folderName);
        let searchCriteria;
        let messages = []; // Initialize messages array properly
        let allMessages; // Declare allMessages at function scope
        let skipCount = 0; // Declare skipCount at function scope with default value
        let batchSize = 50; // Declare batchSize at function scope with default value
        let chunkStrategy = "NORMAL"; // Declare chunkStrategy at function scope

        // Check if we should use dynamic UID calculation
        if (req.query.dynamicFetch) {
          console.log(`[Batch ${page}] Using dynamic UID calculation...`);

          // For dynamic fetch, get all emails and then slice for this batch
          allMessages; // Already declared above
          if (!days || days === 0 || days === "all") {
            // 🧠 INTELLIGENT CHUNKING for ALL email providers
            console.log(`[Batch ${page}] 📧 Provider: ${provider || 'unknown'} - analyzing inbox size...`);
            
            try {
              // Step 1: Quick test to determine inbox size (works for all providers)
              const testDate = formatDateForIMAP(
                new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
              );
              const testPromise = connection.search([["SINCE", testDate]], {
                bodies: "HEADER.FIELDS (FROM TO CC BCC SUBJECT DATE MESSAGE-ID IN-REPLY-TO REFERENCES)",
                struct: true,
                envelope: true  // 🔧 ADD ENVELOPE for proper email metadata
              });
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Test timeout")), 3000) // Ultra-fast 3 second test
              );
              
              let testMessages;
              let chunkDays;
              
              try {
                testMessages = await Promise.race([testPromise, timeoutPromise]);
                console.log(`[Batch ${page}] 🔍 Found ${testMessages.length} emails in last 7 days for ${provider || 'unknown'}`);
                
                // Get total inbox count for detailed logging
                let totalInboxCount = 0;
                try {
                  console.log(`[Batch ${page}] 📊 Getting total inbox count for user ${masterUserID}...`);
                  const totalPromise = connection.search(["ALL"], { 
                    bodies: "HEADER", 
                    struct: true,
                    envelope: true  // 🔧 ADD ENVELOPE for proper email metadata
                  });
                  const totalTimeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Total count timeout")), 10000)
                  );
                  const totalMessages = await Promise.race([totalPromise, totalTimeout]);
                  totalInboxCount = totalMessages.length;
                  console.log(`[Batch ${page}] 📧 USER ${masterUserID} TOTAL INBOX SIZE: ${totalInboxCount} emails`);
                  console.log(`[Batch ${page}] 📈 USER ${masterUserID} INBOX ANALYSIS: ${testMessages.length} recent emails out of ${totalInboxCount} total emails`);
                  console.log(`[Batch ${page}] 📊 USER ${masterUserID} INBOX PERCENTAGE: ${((testMessages.length / totalInboxCount) * 100).toFixed(1)}% of emails are from last 7 days`);
                } catch (error) {
                  console.log(`[Batch ${page}] ⚠️ Could not get total inbox count for user ${masterUserID}: ${error.message}`);
                  console.log(`[Batch ${page}] 📧 USER ${masterUserID} INBOX SIZE: Unable to determine total (using recent count: ${testMessages.length})`);
                }
                
                // Step 2: Enhanced inbox size detection and intelligent strategy selection
                let totalInboxSize = totalInboxCount || 0;
                
                // Enhanced strategy determination based on both recent activity and total size
                if (totalInboxSize > 50000 || testMessages.length > 500) {
                  chunkStrategy = "MASSIVE_INBOX"; 
                  chunkDays = 7; // 7-day micro-chunks for massive inboxes (50K+ emails)
                  console.log(`[Batch ${page}] 🔥 MASSIVE INBOX detected (${totalInboxSize} total, ${testMessages.length} recent) - using MICRO chunks (${chunkDays} days)`);
                  console.log(`[Batch ${page}] 🔥 USER ${masterUserID} INBOX STRATEGY: MASSIVE_INBOX micro-chunks (${chunkDays}-day periods) for maximum stability`);
                } else if (totalInboxSize > 20000 || testMessages.length > 300) {
                  chunkStrategy = "VERY_LARGE"; 
                  chunkDays = 10; // 10-day chunks for very large inboxes (20K+ emails)
                  console.log(`[Batch ${page}] 🔴 VERY LARGE inbox detected (${totalInboxSize} total, ${testMessages.length} recent) - using ULTRA_SMALL chunks (${chunkDays} days)`);
                  console.log(`[Batch ${page}] 🔴 USER ${masterUserID} INBOX STRATEGY: VERY_LARGE chunks (${chunkDays}-day periods) for large dataset`);
                } else if (totalInboxSize > 10000 || testMessages.length > 200) {
                  chunkStrategy = "LARGE"; 
                  chunkDays = 15; // 15-day chunks for large inboxes (10K+ emails)
                  console.log(`[Batch ${page}] 🟠 LARGE inbox detected (${totalInboxSize} total, ${testMessages.length} recent) - using SMALL chunks (${chunkDays} days)`);
                  console.log(`[Batch ${page}] 🟠 USER ${masterUserID} INBOX STRATEGY: LARGE chunks (${chunkDays}-day periods) for medium-large dataset`);
                } else if (totalInboxSize > 5000 || testMessages.length > 100) {
                  chunkStrategy = "MEDIUM"; 
                  chunkDays = 30; // 30-day chunks for medium inboxes (5K+ emails)
                  console.log(`[Batch ${page}] 🟡 MEDIUM inbox detected (${totalInboxSize} total, ${testMessages.length} recent) - using MEDIUM chunks (${chunkDays} days)`);
                  console.log(`[Batch ${page}] 🟡 USER ${masterUserID} INBOX STRATEGY: MEDIUM chunks (${chunkDays}-day periods) for balanced processing`);
                } else if (totalInboxSize > 2000 || testMessages.length > 50) {
                  chunkStrategy = "SMALL_CHUNKS"; 
                  chunkDays = 60; // 60-day chunks for smaller but still chunked processing
                  console.log(`[Batch ${page}] 🟢 SMALL_CHUNKS inbox detected (${totalInboxSize} total, ${testMessages.length} recent) - using LARGE chunks (${chunkDays} days)`);
                  console.log(`[Batch ${page}] 🟢 USER ${masterUserID} INBOX STRATEGY: SMALL_CHUNKS (${chunkDays}-day periods) for efficient processing`);
                } else {
                  chunkStrategy = "NORMAL";
                  console.log(`[Batch ${page}] 🌟 NORMAL inbox detected (${totalInboxSize} total, ${testMessages.length} recent) - using DIRECT processing`);
                  console.log(`[Batch ${page}] 🌟 USER ${masterUserID} INBOX STRATEGY: NORMAL processing (all emails at once) for small inbox`);
                }
              } catch (testError) {
                // If test fails, assume large inbox and force ultra-safe chunking
                console.log(`[Batch ${page}] ⚠️ ${provider || 'unknown'} inbox test failed: ${testError.message} - FORCING ULTRA-SAFE CHUNKING`);
                console.log(`[Batch ${page}] 🔴 USER ${masterUserID} INBOX STRATEGY: FORCED MASSIVE_INBOX chunks (7-day periods) due to timeout - assuming MASSIVE inbox`);
                chunkStrategy = "MASSIVE_INBOX";
                chunkDays = 7; // Ultra-conservative 7-day chunks for maximum safety
                testMessages = [];
              }
              
              // Step 3: Apply intelligent chunking strategy to get ALL emails with enhanced memory management
              if (chunkStrategy !== "NORMAL") {
                const effectiveChunkDays = chunkDays || 30; // Fallback value
                console.log(`[Batch ${page}] 🔄 Fetching ALL emails using ${effectiveChunkDays}-day chunks for ${provider || 'unknown'}...`);
                console.log(`[Batch ${page}] 🔄 USER ${masterUserID} CHUNKING: Starting ${chunkStrategy} chunking (${effectiveChunkDays}-day periods)`);
                console.log(`[Batch ${page}] 📊 USER ${masterUserID} CHUNKING STRATEGY: Will process up to ${Math.floor(3000 / effectiveChunkDays)} chunks of ${effectiveChunkDays} days each`);
                
                try {
              // ⚡ HIGH-PERFORMANCE MODE: Use optimized fetching for large inboxes
              if (chunkStrategy === "MASSIVE_INBOX" || chunkStrategy === "VERY_LARGE") {
                console.log(`[Batch ${page}] 🚀 ACTIVATING HIGH-PERFORMANCE MODE for ${chunkStrategy} strategy`);
                const highPerfResult = await fetchEmailsHighPerformance(connection, chunkStrategy, masterUserID, provider || 'unknown', page);
                allMessages = highPerfResult.emails;
                
                console.log(`[Batch ${page}] ⚡ HIGH-PERFORMANCE RESULTS:`);
                console.log(`[Batch ${page}] 📊 Total emails in inbox: ${highPerfResult.totalCount}`);
                console.log(`[Batch ${page}] 📥 Fetched for processing: ${highPerfResult.fetchedCount}`);
                console.log(`[Batch ${page}] ⏱️ Fetch time: ${highPerfResult.fetchTime.toFixed(1)}s`);
                console.log(`[Batch ${page}] 🚀 Fetch rate: ${highPerfResult.fetchRate.toFixed(1)} emails/sec`);
              } else {
                // Original enhanced chunking for smaller inboxes
                allMessages = await fetchEmailsInChunksEnhanced(connection, effectiveChunkDays, page, provider || 'unknown', masterUserID, chunkStrategy);
              }
                } catch (chunkError) {
                  console.log(`[Batch ${page}] ❌ USER ${masterUserID} CHUNKING FAILED: ${chunkError.message} - falling back to progressive search`);
                  // Enhanced fallback with progressive timeout increases
                  try {
                    const progressiveTimeout = getProgressiveTimeout(chunkStrategy);
                    console.log(`[Batch ${page}] 🔄 USER ${masterUserID} PROGRESSIVE FALLBACK: Using ${progressiveTimeout}ms timeout for ${chunkStrategy} strategy`);
                    
                    const fallbackPromise = connection.search(["ALL"], {
                      bodies: "HEADER", 
                      struct: true,
                      envelope: true  // 🔧 ADD ENVELOPE for proper email metadata
                    });
                    const fallbackTimeoutPromise = new Promise((_, reject) =>
                      setTimeout(() => reject(new Error(`${provider || 'Email'} progressive fallback timeout`)), progressiveTimeout)
                    );
                    allMessages = await Promise.race([fallbackPromise, fallbackTimeoutPromise]);
                    console.log(`[Batch ${page}] ✅ USER ${masterUserID} FALLBACK SUCCESS: Found ${allMessages.length} emails`);
                  } catch (fallbackError) {
                    console.log(`[Batch ${page}] ❌ USER ${masterUserID} FALLBACK FAILED: ${fallbackError.message} - returning empty result`);
                    allMessages = [];
                  }
                }
              } else {
                // Normal inbox: Get all emails at once (all providers)
                console.log(`[Batch ${page}] 📧 Fetching ALL emails directly for ${provider || 'unknown'}...`);
                console.log(`[Batch ${page}] 📧 USER ${masterUserID} DIRECT FETCH: Processing all emails at once for small inbox`);
                
                try {
                  const searchPromise = connection.search(["ALL"], {
                    bodies: "HEADER", 
                    struct: true,
                    envelope: true  // 🔧 ADD ENVELOPE for proper email metadata
                  });
                  const normalTimeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`${provider || 'Email'} search timeout`)), 15000)
                  );
                  allMessages = await Promise.race([searchPromise, normalTimeout]);
                } catch (directError) {
                  console.log(`[Batch ${page}] ❌ USER ${masterUserID} DIRECT FETCH FAILED: ${directError.message} - returning empty result`);
                  allMessages = [];
                }
              }
              
              console.log(`[Batch ${page}] ✅ ${provider || 'unknown'} intelligent chunking completed: ${allMessages.length} total emails found`);
              console.log(`[Batch ${page}] ✅ USER ${masterUserID} FETCH COMPLETED: Found ${allMessages.length} total emails using ${chunkStrategy} strategy`);
              
            } catch (error) {
              console.log(`[Batch ${page}] ⚠️ ${provider || 'unknown'} intelligent chunking failed: ${error.message} - FORCING CHUNKING as fallback`);
              // Force chunking as fallback when everything fails
              console.log(`[Batch ${page}] 🔄 Forcing 30-day chunking for ${provider || 'unknown'} as safety fallback...`);
              allMessages = await fetchEmailsInChunks(connection, 30, page, provider || 'unknown');
            }
          } else {
            const sinceDate = formatDateForIMAP(
              new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            );
            console.log(`Using dynamic SINCE date: ${sinceDate}`);
            allMessages = await connection.search([["SINCE", sinceDate]], {
              bodies: "HEADER",
              struct: true,
              envelope: true  // 🔧 ADD ENVELOPE for proper email metadata
            });
          }

          // 🛡️ ENHANCED INTELLIGENT SAFETY: Dynamic limits with progressive processing for large datasets
          const getMaxSafeEmailsForStrategy = (strategy, totalEmails) => {
            switch (strategy) {
              case "MASSIVE_INBOX": return totalEmails; // Process ALL emails for MASSIVE_INBOX
              case "VERY_LARGE": return totalEmails; // Process ALL emails for VERY_LARGE  
              case "LARGE": return totalEmails; // Process ALL emails for LARGE
              case "MEDIUM": return totalEmails; // Process ALL emails for MEDIUM
              case "SMALL_CHUNKS": return totalEmails; // Process ALL emails
              default: return totalEmails; // Process all for normal inboxes
            }
          };
          
          const maxSafeEmails = getMaxSafeEmailsForStrategy(chunkStrategy || "NORMAL", allMessages.length);
          const shouldLimitProcessing = allMessages.length > maxSafeEmails;
          
          if (shouldLimitProcessing) {
            console.log(
              `[Batch ${page}] 🎯 LARGE DATASET OPTIMIZATION: ${allMessages.length} emails found, processing ${maxSafeEmails} in this session (${chunkStrategy} strategy)`
            );
            console.log(
              `[Batch ${page}] 📊 PROGRESSIVE PROCESSING: Session will handle ${maxSafeEmails} emails, remaining ${allMessages.length - maxSafeEmails} will be auto-queued for next sessions`
            );
            // Process most recent emails first for large datasets
            allMessages = allMessages.slice(-maxSafeEmails); // Take the last (most recent) emails
          }

          console.log(
            `[Batch ${page}] Found ${allMessages.length} total emails dynamically for ${provider || 'provider'}`
          );

          // 📊 ENHANCED SMART BATCH SIZING: Optimized batches based on inbox size and strategy
          skipCount = parseInt(req.query.skipCount) || 0; // Assign to existing variable
          batchSize = parseInt(req.query.batchSize) || getDynamicBatchSize(allMessages.length, chunkStrategy); // Enhanced dynamic sizing
          
          // Intelligent batch sizing based on inbox size and processing strategy
          function getDynamicBatchSize(totalEmails, strategy) {
            if (totalEmails > 50000) {
              return 5; // Micro-batches for massive inboxes (50K+ emails)
            } else if (totalEmails > 20000) {
              return 10; // Very small batches for very large inboxes (20K+ emails)
            } else if (totalEmails > 10000) {
              return 15; // Small batches for large inboxes (10K+ emails)
            } else if (totalEmails > 5000) {
              return 25; // Medium-small batches for medium-large inboxes
            } else if (totalEmails > 2000) {
              return 35; // Medium batches for medium inboxes
            } else if (totalEmails > 1000) {
              return 45; // Larger batches for smaller-medium inboxes
            } else {
              return 50; // Default batch size for small inboxes
            }
          }
          
          console.log(`[Batch ${page}] � BATCH OPTIMIZATION: Using ${batchSize} emails per batch for ${allMessages.length} total emails (${chunkStrategy || 'NORMAL'} strategy)`);
          
          // Additional memory and performance optimizations for large datasets
          if (allMessages.length > 10000) {
            console.log(`[Batch ${page}] 🧠 MEMORY OPTIMIZATION: Implementing enhanced memory management for ${allMessages.length} emails`);
            // Force garbage collection if available
            if (global.gc) {
              global.gc();
              console.log(`[Batch ${page}] �️ GARBAGE COLLECTION: Forced cleanup before processing large dataset`);
            }
          }
          
          const startIdx = skipCount;
          const endIdx = Math.min(startIdx + batchSize, allMessages.length);

          // Slice the messages array to get this batch
          const batchMessages = allMessages.slice(startIdx, endIdx);

          if (batchMessages.length === 0) {
            console.log(
              `[Batch ${page}] No emails found for this batch (skip: ${skipCount}, total: ${allMessages.length})`
            );
            return {
              processedCount: 0,
              totalEmails: allMessages ? allMessages.length : 0,
              currentBatchEnd: allMessages ? Math.min(skipCount + batchSize, allMessages.length) : 0,
              hasMoreEmails: allMessages ? (skipCount + batchSize < allMessages.length) : false,
              remainingEmails: allMessages ? Math.max(0, allMessages.length - (skipCount + batchSize)) : 0
            };
          }

          console.log(
            `[Batch ${page}] � SMART BATCHING: Processing emails ${startIdx + 1}-${endIdx} out of ${allMessages.length} total`
          );
          console.log(
            `[Batch ${page}] 💾 BATCH SIZE: ${batchMessages.length} emails in this batch (batchSize: ${batchSize})`
          );

          // Use the sliced messages for this batch
          messages = batchMessages;
        } else if (allUIDsInBatch) {
          // Use specific UIDs for this batch (more reliable than ranges)
          searchCriteria = [["UID", allUIDsInBatch]];
          console.log(
            `[Batch ${page}] Using specific UIDs: ${allUIDsInBatch} (expecting ${expectedCount} emails)`
          );
        } else if (startUID && endUID) {
          // Fallback to UID range for this batch
          searchCriteria = [["UID", `${startUID}:${endUID}`]];
          console.log(`[Batch ${page}] Using UID range: ${startUID}-${endUID}`);
        } else if (!days || days === 0 || days === "all") {
          searchCriteria = ["ALL"];
        } else {
          const sinceDate = formatDateForIMAP(
            new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          );
          searchCriteria = [["SINCE", sinceDate]];
        }

        // Only do additional search if not using dynamic fetch (which already has messages)
        if (!req.query.dynamicFetch) {
          // Fetch specific header fields for metadata without body content
          const fetchOptions = { 
            bodies: "HEADER", 
            struct: true,
            envelope: true  // 🔧 ADD ENVELOPE for proper email metadata (fixes sent folder fallback data)
          };
          messages = await connection.search(searchCriteria, fetchOptions);
        }

        console.log(
          `[Batch ${page}] Total emails found in ${folderType}: ${messages.length}`
        );

        // Determine how many emails to process
        let actualBatchSize;
        if (req.query.dynamicFetch) {
          // For dynamic fetch, process all found emails (no warnings needed)
          actualBatchSize = messages.length;
          console.log(
            `[Batch ${page}] Dynamic fetch found ${actualBatchSize} emails to process`
          );
        } else if (allUIDsInBatch || (startUID && endUID)) {
          // In batch mode with specific UIDs or UID range, process ALL emails found
          actualBatchSize = messages.length;
          if (expectedCount && messages.length !== parseInt(expectedCount)) {
            // Only warn if the difference is significant (more than 50% difference)
            // AND if we found significantly fewer emails than expected
            const expectedCountNum = parseInt(expectedCount);
            const difference = Math.abs(messages.length - expectedCountNum);
            const percentDifference = (difference / expectedCountNum) * 100;

            if (
              percentDifference > 50 &&
              messages.length < expectedCountNum * 0.5
            ) {
              console.warn(
                `[Batch ${page}] WARNING: Expected ${expectedCount} emails but found ${
                  messages.length
                } (${percentDifference.toFixed(
                  1
                )}% difference). This may indicate UIDs were deleted/moved.`
              );
            } else if (percentDifference > 20) {
              console.log(
                `[Batch ${page}] INFO: Expected ${expectedCount} emails, found ${
                  messages.length
                } (${percentDifference.toFixed(
                  1
                )}% difference - likely due to duplicates or processed emails)`
              );
            } else {
              console.log(
                `[Batch ${page}] SUCCESS: Expected ${expectedCount} emails, found ${
                  messages.length
                } emails (${percentDifference.toFixed(
                  1
                )}% difference - within normal range)`
              );
            }
          }
          console.log(
            `[Batch ${page}] Processing all ${actualBatchSize} emails in batch`
          );
        } else {
          // In direct mode without UID specification, respect the batchSize limit
          actualBatchSize = Math.min(batchSize, messages.length);
          console.log(
            `[Batch ${page}] Processing ${actualBatchSize} out of ${messages.length} emails (direct mode)`
          );
        }

        let processedCount = 0;

        // 🚀 HIGH-PERFORMANCE PROCESSING: Use optimized processing for all strategies
        if (chunkStrategy && ["MASSIVE_INBOX", "VERY_LARGE", "LARGE"].includes(chunkStrategy)) {
          console.log(`[Batch ${page}] ⚡ HIGH-PERFORMANCE PROCESSING: Starting optimized processing for ${chunkStrategy} strategy`);
          console.log(`[Batch ${page}] 📊 PERFORMANCE MODE: Processing ${actualBatchSize} emails with parallel optimization`);
          
          // Step 1: Lightweight processing (headers + metadata only)
          const lightweightResult = await processEmailsLightweight(messages.slice(0, actualBatchSize), masterUserID, provider || 'unknown', chunkStrategy, page, folderType);
          
          console.log(`[Batch ${page}] ⚡ LIGHTWEIGHT COMPLETE: ${lightweightResult.processedEmails.length} emails processed at ${lightweightResult.rate.toFixed(1)} emails/sec`);
          
          // Step 2: Parallel database saving with concurrency control
          const concurrency = chunkStrategy === "MASSIVE_INBOX" ? 15 : 10; // Higher concurrency for massive inboxes
          const saveResult = await saveEmailsInParallel(lightweightResult.processedEmails, concurrency, masterUserID, provider || 'unknown', page);
          
          processedCount = saveResult.savedEmails.length;
          
          console.log(`[Batch ${page}] 🎯 HIGH-PERFORMANCE SUMMARY:`);
          console.log(`[Batch ${page}] ⚡ Processing rate: ${lightweightResult.rate.toFixed(1)} emails/sec`);
          console.log(`[Batch ${page}] 💾 Saving rate: ${saveResult.rate.toFixed(1)} saves/sec`);
          console.log(`[Batch ${page}] ✅ Total processed: ${processedCount} emails`);
          console.log(`[Batch ${page}] ⚠️ Errors: ${lightweightResult.errorCount + saveResult.errors.length}`);
          
          console.log(`[Batch ${page}] 🏆 HIGH-PERFORMANCE PROCESSING COMPLETE: ${processedCount} emails processed with ${chunkStrategy} strategy`);
          
        } else {
          console.log(`[Batch ${page}] 📋 STANDARD PROCESSING: Using regular processing for ${chunkStrategy || 'NORMAL'} strategy`);
          
          // Step 1: Lightweight processing (headers + metadata only) - same as high-performance but for smaller batches
          const lightweightResult = await processEmailsLightweight(messages.slice(0, actualBatchSize), masterUserID, provider || 'unknown', chunkStrategy || 'NORMAL', page, folderType);
          
          console.log(`[Batch ${page}] ⚡ LIGHTWEIGHT COMPLETE: ${lightweightResult.processedEmails.length} emails processed at ${lightweightResult.rate.toFixed(1)} emails/sec`);
          
          // Step 2: Parallel database saving with standard concurrency
          const concurrency = 5; // Lower concurrency for normal inboxes
          const saveResult = await saveEmailsInParallel(lightweightResult.processedEmails, concurrency, masterUserID, provider || 'unknown', page);
          
          processedCount = saveResult.savedEmails.length;
          
          console.log(`[Batch ${page}] 🎯 STANDARD PROCESSING SUMMARY:`);
          console.log(`[Batch ${page}] ⚡ Processing rate: ${lightweightResult.rate.toFixed(1)} emails/sec`);
          console.log(`[Batch ${page}] 💾 Saving rate: ${saveResult.rate.toFixed(1)} saves/sec`);
          console.log(`[Batch ${page}] ✅ Total processed: ${processedCount} emails`);
          console.log(`[Batch ${page}] ⚠️ Errors: ${lightweightResult.errorCount + saveResult.errors.length}`);
          
          console.log(`[Batch ${page}] 🏆 STANDARD PROCESSING COMPLETE: ${processedCount} emails processed with ${chunkStrategy || 'NORMAL'} strategy`);
        }

        console.log(
          `📧 [Batch ${page}] SUCCESSFULLY PROCESSED ${processedCount} NEW EMAILS in ${folderType} folder!`
        );

        // Return both count and pagination info for auto-pagination
        const requestSkipCount = parseInt(req.query.skipCount) || 0;
        const requestBatchSize = parseInt(req.query.batchSize) || 50;
        
        return {
          processedCount,
          totalEmails: allMessages ? allMessages.length : 0,
          currentBatchEnd: allMessages ? Math.min(requestSkipCount + requestBatchSize, allMessages.length) : 0,
          hasMoreEmails: allMessages ? (requestSkipCount + requestBatchSize < allMessages.length) : false,
          remainingEmails: allMessages ? Math.max(0, allMessages.length - (requestSkipCount + requestBatchSize)) : 0
        };
        
      } catch (folderError) {
        console.error(
          `[Batch ${page}] Error fetching emails from folder ${folderType}:`,
          folderError.message
        );
        return {
          processedCount: 0,
          totalEmails: 0,
          currentBatchEnd: 0,
          hasMoreEmails: false,
          remainingEmails: 0
        };
      }
    }
    
    // Continue with main email processing
    const boxes = await connection.getBoxes();
    const allFoldersArr = flattenFolders(boxes); // 🔧 GMAIL FIX: Keep original case for proper folder matching

    console.log(
      `[Batch ${page}] Processing all folders for masterUserID: ${masterUserID}`
    );

    // 🎯 SMART FOLDER PROCESSING: Provider-specific folder configuration
    let primaryFolders, optionalFolders;
    
    console.log(`[Batch ${page}] 🔍 FOLDER DEBUG: Provider detected as '${provider}' for USER ${masterUserID}`);
    
    // ALL PROVIDERS: Process both INBOX and SENT folders
    primaryFolders = ["inbox", "sent"];
    optionalFolders = ["drafts", "archive"];
    console.log(`[Batch ${page}] 📧 PROVIDER (${provider}): Processing INBOX + SENT folders (updated to include all providers)`);
    
    console.log(`[Batch ${page}] 📂 PRIMARY FOLDERS TO PROCESS: [${primaryFolders.join(', ')}]`);
    console.log(`[Batch ${page}] 📂 OPTIONAL FOLDERS TO PROCESS: [${optionalFolders.join(', ')}]`);
    console.log(`[Batch ${page}] 📂 ALL AVAILABLE FOLDERS (COMPLETE): [${allFoldersArr.join(', ')}]`);
    console.log(`[Batch ${page}] 📂 TOTAL FOLDER COUNT: ${allFoldersArr.length}`);
    
    
    let totalProcessedEmails = 0;
    const folderResults = {};
    let paginationInfo = null; // 🔧 FIX: Declare paginationInfo before the loop

    // Process primary folders (INBOX - guaranteed to exist)
    for (const folderType of primaryFolders) {
      try {
        console.log(`[Batch ${page}] 🔍 ATTEMPTING TO FIND: ${folderType.toUpperCase()} folder`);
        const folderName = findMatchingFolder(allFoldersArr, folderType);
        
        if (folderName) {
          console.log(`[Batch ${page}] ✅ FOUND ${folderType.toUpperCase()} FOLDER: '${folderName}' - Processing now...`);
          const result = await fetchEmailsFromFolder(folderName, folderType);
          
          if (result && result.processedCount !== undefined) {
            totalProcessedEmails += result.processedCount;
            // 🔧 FIX: Add missing properties for proper logging
            result.status = result.processedCount > 0 ? 'success' : 'no_emails';
            result.folderName = folderName;
            folderResults[folderType] = result;
            
            console.log(`[Batch ${page}] ✅ ${folderType.toUpperCase()} COMPLETE: ${result.processedCount} emails processed from '${folderName}'`);
            
            // Enhanced auto-pagination support
            if (result.hasMoreEmails && result.remainingEmails > 0) {
              console.log(`[Batch ${page}] 🔄 AUTO-PAGINATION: ${folderType} has ${result.remainingEmails} more emails`);
              // Store pagination info for auto-queuing
              if (!paginationInfo || result.remainingEmails > paginationInfo.remainingEmails) {
                paginationInfo = result;
              }
            }
          } else {
            console.log(`[Batch ${page}] ⚠️ ${folderType.toUpperCase()} RESULT INCOMPLETE: No processedCount returned`);
            folderResults[folderType] = {
              processedCount: 0,
              status: 'error',
              folderName: folderName
            };
          }
        } else {
          console.log(`[Batch ${page}] ❌ ${folderType.toUpperCase()} FOLDER NOT FOUND in available folders: [${allFoldersArr.slice(0, 5).join(', ')}...]`);
          folderResults[folderType] = { processedCount: 0, message: "Critical folder not found" };
        }
      } catch (folderError) {
        console.error(`[Batch ${page}] Error processing ${folderType}:`, folderError.message);
        folderResults[folderType] = { processedCount: 0, error: folderError.message };
      }
    }

    // 🔧 OPTIONAL FOLDERS: Only process if they exist, skip silently if not
    for (const folderType of optionalFolders) {
      try {
        const folderName = findMatchingFolder(allFoldersArr, folderType);
        if (folderName) {
          console.log(`[Batch ${page}] Processing ${folderType} folder: ${folderName}`);
          const result = await fetchEmailsFromFolder(folderName, folderType);
          
          if (result && result.processedCount !== undefined) {
            totalProcessedEmails += result.processedCount;
            result.status = result.processedCount > 0 ? 'success' : 'no_emails';
            result.folderName = folderName;
            folderResults[folderType] = result;
          }
        } else {
          // 🔇 SILENT SKIP: Don't log missing optional folders to reduce noise
          folderResults[folderType] = { processedCount: 0, status: 'no_emails', message: folderType };
        }
      } catch (folderError) {
        // 🔇 SILENT SKIP: Don't log errors for optional folders (like "No such folder")
        if (!folderError.message.includes('No such folder')) {
          console.error(`[Batch ${page}] Error fetching emails from folder ${folderType}: ${folderError.message}`);
        }
        folderResults[folderType] = { processedCount: 0, status: 'no_emails', message: folderType };
      }
    }

    // Auto-pagination logic
    if (paginationInfo && paginationInfo.hasMoreEmails && paginationInfo.remainingEmails > 0) {
      const nextSkipCount = paginationInfo.currentBatchEnd;
      const nextPage = page + 1;
      
      console.log(`🔄 AUTO-PAGINATION TRIGGERED FOR USER ${masterUserID}:`);
      console.log(`📊 Total emails found by chunking: ${paginationInfo.totalEmails}`);
      console.log(`✅ Current batch processed: ${parseInt(req.query.skipCount) || 0 + 1}-${paginationInfo.currentBatchEnd}`);
      console.log(`🔄 Remaining emails to process: ${paginationInfo.remainingEmails}`);
      console.log(`⏭️ Queuing next batch: Page ${nextPage}, Skip: ${nextSkipCount}`);

      try {
        // Queue the next batch for this user
        const queueConnection = await amqp.connect('amqp://localhost');
        const queueChannel = await queueConnection.createChannel();
        const queueName = `FETCH_INBOX_QUEUE_${masterUserID}`;
        
        await queueChannel.assertQueue(queueName, { durable: true });
        
        const nextBatchJob = {
          adminId: masterUserID,
          email: email,
          appPassword: appPassword,
          provider: provider,
          page: nextPage,
          batchSize: batchSize,
          skipCount: nextSkipCount,
          source: 'auto-pagination',
          originalTotalEmails: paginationInfo.totalEmails,
          timestamp: new Date().toISOString()
        };
        
        await queueChannel.sendToQueue(
          queueName,
          Buffer.from(JSON.stringify(nextBatchJob)),
          { persistent: true }
        );
        
        await queueChannel.close();
        await queueConnection.close();
        
        console.log(`✅ AUTO-PAGINATION: Successfully queued next batch (Page ${nextPage}) for user ${masterUserID}`);
        
      } catch (queueError) {
        console.error(`❌ AUTO-PAGINATION: Failed to queue next batch for user ${masterUserID}:`, queueError.message);
      }
    } else if (paginationInfo) {
      console.log(`✅ AUTO-PAGINATION: All ${paginationInfo.totalEmails} emails processed for user ${masterUserID} - no more batches needed`);
    }
    
    // Main processing continues here (auto-pagination logic above)

    // Memory cleanup for large batches
    console.log(`[Batch ${page}] Performing memory cleanup...`);
    if (global.gc && page % 10 === 0) {
      // Only every 10th batch for larger batches
      global.gc();
    }

    // Add small delay for system recovery (optimized for larger batches)
    if (page > 1 && page % 10 === 0) {
      // Only every 10th batch
      await new Promise((resolve) => setTimeout(resolve, 100)); // Reduced from 200ms to 100ms
    }

    connection.end();
    console.log(`[Batch ${page}] IMAP connection closed successfully.`);

    // Enhanced logging with prominent email count display for all folders
    console.log(`
====== FETCH ALL FOLDERS QUEUE RESULTS FOR BATCH ${page} ======
✅ TOTAL EMAILS FETCHED: ${totalProcessedEmails} emails
📊 Batch Info: Page ${page}, Batch size: ${batchSize}
👤 User: ${masterUserID}
📁 Folders Processed:
${Object.entries(folderResults)
  .map(
    ([type, result]) =>
      `   ${type.toUpperCase()}: ${result.processedCount} emails (${
        result.status
      }) - ${result.folderName}`
  )
  .join("\n")}
📅 Timestamp: ${new Date().toISOString()}
${startUID && endUID ? `📋 UID Range: ${startUID}-${endUID}` : `📋 Processing: Metadata-only strategy (auto UIDs)`}
${allUIDsInBatch ? `📋 Specific UIDs: ${allUIDsInBatch}` : ""}
========================================================
`);

    res.status(200).json({
      message: `✅ [Batch ${page}] Successfully fetched ${totalProcessedEmails} new emails from all folders!`,
      processedBatch: `Page ${page}, Batch size: ${batchSize}`,
      processedEmails: totalProcessedEmails,
      folderResults: folderResults,
      expectedEmails: expectedCount ? parseInt(expectedCount) : null,
      uidRange: startUID && endUID ? `${startUID}-${endUID}` : "Not specified",
      specificUIDs: allUIDsInBatch ? allUIDsInBatch : "Not specified",
      masterUserID: masterUserID,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[Batch ${page}] Error fetching emails:`, error.message);
    res.status(500).json({
      message: `[Batch ${page}] Internal server error.`,
      error: error.message,
      batch: page,
      masterUserID: masterUserID,
    });
  } finally {
    // Safe connection close with better error handling
    if (connection) {
      try {
        if (connection.imap && connection.imap.state !== "disconnected") {
          await connection.end();
          console.log(
            `[Batch ${page}] IMAP connection closed in finally block.`
          );
        }
      } catch (closeErr) {
        console.error(
          `[Batch ${page}] Error closing IMAP connection:`,
          closeErr.message
        );
      }
    }
    // Final memory cleanup
    console.log(`[Batch ${page}] Final memory cleanup...`);
    if (global.gc && page % 15 === 0) {
      // Only every 15th batch for larger batches
      global.gc();
    }
  }
};

// ⚡ HIGH-PERFORMANCE: Lightweight email processing with priority strategy
const processEmailsLightweight = async (emails, userID, provider, strategy = 'NORMAL', page = 1, folderType = 'inbox') => {
  const processedEmails = [];
  let errorCount = 0;
  const startTime = Date.now();
  
  console.log(`[Batch ${page}] ⚡ LIGHTWEIGHT PROCESSING: ${emails.length} emails for USER ${userID} ${provider} (strategy: ${strategy}, folder: ${folderType})`);
  
  // Priority strategy: Sort by date (recent first)
  const sortedEmails = emails.sort((a, b) => {
    const dateA = new Date(a.date || a.envelope?.date || 0);
    const dateB = new Date(b.date || b.envelope?.date || 0);
    return dateB - dateA; // Recent emails first
  });
  
  console.log(`[Batch ${page}] 🎯 PRIORITY STRATEGY: Processing recent emails first`);
  
  for (let i = 0; i < sortedEmails.length; i++) {
    try {
      const email = sortedEmails[i];
      
      // 🔍 DEBUG: Log the complete email object to understand structure
      console.log(`\n=== EMAIL ${i} COMPLETE STRUCTURE ===`);
      console.log('UID:', email.uid);
      console.log('Attributes:', JSON.stringify(email.attributes, null, 2));
      console.log('Envelope:', JSON.stringify(email.envelope, null, 2));
      console.log('Headers keys:', email.headers ? Object.keys(email.headers) : 'none');
      console.log('Bodies keys:', email.bodies ? Object.keys(email.bodies) : 'none');
      
      // 🔧 ENHANCED HEADER PARSING: Safely extract all email metadata
      let parsedHeaders = {};
      let rawHeaderText = '';
      
      // 🔍 DEBUG: Log the complete email structure first
      console.log(`\n🔍 EMAIL ${i} RAW STRUCTURE:`, {
        uid: email.uid,
        attributes: email.attributes,
        envelope: email.envelope,
        bodiesKeys: email.bodies ? Object.keys(email.bodies) : 'none'
      });
      
      if (email.bodies) {
        // Handle HEADER response (this should be our primary source)
        if (email.bodies.HEADER) {
          rawHeaderText = email.bodies.HEADER;
          console.log(`📧 Found HEADER content (${rawHeaderText.length} chars)`);
        } else {
          // Check for any header fields in bodies as fallback
          const headerKeys = Object.keys(email.bodies).filter(key => 
            key.includes('HEADER') || key.includes('header')
          );
          if (headerKeys.length > 0) {
            rawHeaderText = email.bodies[headerKeys[0]];
            console.log(`📧 Found header field: ${headerKeys[0]} (${rawHeaderText.length} chars)`);
          }
        }
        
        if (rawHeaderText && rawHeaderText.length > 10) {
          // Use mailparser for robust header parsing
          try {
            const parsed = await simpleParser(rawHeaderText, { skipHtmlToText: true, skipTextLinks: true });
            
            // 🔧 SAFE EXTRACTION: Extract with proper fallbacks
            parsedHeaders = {
              messageId: parsed.messageId || parsed.headers?.get('message-id'),
              subject: parsed.subject || parsed.headers?.get('subject'),
              date: parsed.date || new Date(parsed.headers?.get('date')) || new Date(),
              
              // From field with multiple fallbacks
              from: parsed.from?.value?.[0]?.address || 
                    parsed.from?.text || 
                    parsed.headers?.get('from'),
              fromName: parsed.from?.value?.[0]?.name || 
                       parsed.from?.value?.[0]?.address ||
                       parsed.headers?.get('from'),
              
              // To field with proper handling
              to: parsed.to?.value?.map(addr => addr.address).join(', ') || 
                  parsed.to?.text || 
                  parsed.headers?.get('to'),
              toName: parsed.to?.value?.map(addr => addr.name || addr.address).join(', ') || 
                     parsed.to?.text || 
                     parsed.headers?.get('to'),
              
              // CC and BCC
              cc: parsed.cc?.value?.map(addr => addr.address).join(', ') || 
                  parsed.cc?.text || 
                  parsed.headers?.get('cc') || '',
              bcc: parsed.bcc?.value?.map(addr => addr.address).join(', ') || 
                   parsed.bcc?.text || 
                   parsed.headers?.get('bcc') || '',
              
              // Threading
              inReplyTo: parsed.inReplyTo || parsed.headers?.get('in-reply-to'),
              references: (() => {
                const refs = parsed.references || parsed.headers?.get('references');
                if (Array.isArray(refs)) {
                  return refs.join(' ');
                }
                return refs || null;
              })()
            };
            
            console.log('✅ PARSED HEADERS:', {
              messageId: parsedHeaders.messageId,
              subject: parsedHeaders.subject,
              from: parsedHeaders.from,
              fromName: parsedHeaders.fromName,
              to: parsedHeaders.to,
              date: parsedHeaders.date
            });
            
          } catch (parseError) {
            console.log('⚠️ simpleParser failed, using manual parsing:', parseError.message);
            
            // Enhanced manual parsing as fallback
            const headerLines = rawHeaderText.split(/\r?\n/);
            let currentHeader = '';
            let currentValue = '';
            
            for (const line of headerLines) {
              if (line.match(/^\s/) && currentHeader) {
                // Continuation of previous header
                currentValue += ' ' + line.trim();
              } else if (line.includes(':')) {
                // Save previous header
                if (currentHeader && currentValue) {
                  parsedHeaders[currentHeader.toLowerCase()] = currentValue.trim();
                }
                
                // Start new header
                const colonIndex = line.indexOf(':');
                currentHeader = line.substring(0, colonIndex).trim();
                currentValue = line.substring(colonIndex + 1).trim();
              }
            }
            
            // Save last header
            if (currentHeader && currentValue) {
              parsedHeaders[currentHeader.toLowerCase()] = currentValue.trim();
            }

            // 🔧 FIX: Ensure references field is properly handled
            if (parsedHeaders['references']) {
              // References can be multi-line or array, ensure it's properly formatted
              if (Array.isArray(parsedHeaders['references'])) {
                parsedHeaders['references'] = parsedHeaders['references'].join(' ').trim();
              } else {
                parsedHeaders['references'] = parsedHeaders['references'].trim();
              }
            }

            console.log('📋 Manual parsed headers:', Object.keys(parsedHeaders));
          }
        } else {
          console.log('⚠️ No usable header content found in email.bodies');
        }
      } else {
        console.log('⚠️ No email.bodies found in IMAP response');
      }
      
      console.log('Direct properties:', {
        messageId: email.messageId,
        subject: email.subject,
        from: email.from,
        to: email.to,
        date: email.date
      });
      console.log('=== END EMAIL STRUCTURE ===\n');

      // ✅ SAFE EMAIL DATA EXTRACTION with comprehensive fallbacks
      const generateFallbackMessageId = () => `generated-${Date.now()}-${userID}-${i}`;
      
      // 🔍 UID EXTRACTION DEBUG
      const extractedUID = email.uid || email.attributes?.uid;
      console.log(`🔍 UID EXTRACTION DEBUG for email ${i}:`);
      console.log(`  email.uid: ${email.uid}`);
      console.log(`  email.attributes?.uid: ${email.attributes?.uid}`);
      console.log(`  extractedUID: ${extractedUID}`);
      
      const lightweightEmail = {
        uid: extractedUID,
        
        // Message ID with fallback generation  
        messageId: parsedHeaders.messageId || 
                  parsedHeaders['message-id'] ||
                  email.attributes?.envelope?.messageId ||
                  email.envelope?.messageId || 
                  email.messageId || 
                  email.attributes?.messageId || 
                  generateFallbackMessageId(),
                  
        // Subject with proper fallback
        subject: parsedHeaders.subject || 
                email.attributes?.envelope?.subject ||
                email.envelope?.subject || 
                email.subject || 
                email.attributes?.subject || 
                'No Subject',
        
        // 🔧 ENHANCED SENDER EXTRACTION: Never use "Unknown Sender"
        sender: parsedHeaders.from || 
                parsedHeaders['from'] ||
                (email.attributes?.envelope?.from && 
                 email.attributes.envelope.from[0] && 
                 `${email.attributes.envelope.from[0].mailbox}@${email.attributes.envelope.from[0].host}`) ||
                (email.envelope?.from && email.envelope.from[0]?.address) || 
                email.from || 
                email.attributes?.from || 
                'system@unknown.com', // Better than "Unknown Sender"
                
        senderName: parsedHeaders.fromName || 
                   parsedHeaders['from'] ||
                   (email.attributes?.envelope?.from && 
                    email.attributes.envelope.from[0] && 
                    (email.attributes.envelope.from[0].name || `${email.attributes.envelope.from[0].mailbox}@${email.attributes.envelope.from[0].host}`)) ||
                   (email.envelope?.from && email.envelope.from[0]?.name) || 
                   parsedHeaders.from ||
                   email.fromName || 
                   email.attributes?.fromName ||
                   'System Email',
        
        // 🔧 ENHANCED RECIPIENT EXTRACTION
        recipient: parsedHeaders.to || 
                  parsedHeaders['to'] ||
                  (email.attributes?.envelope?.to && 
                   email.attributes.envelope.to.map(addr => `${addr.mailbox}@${addr.host}`).join(', ')) ||
                  (email.envelope?.to && email.envelope.to.map(addr => addr.address).join(', ')) || 
                  email.to || 
                  email.attributes?.to ||
                  'recipient@unknown.com',
                  
        recipientName: parsedHeaders.toName || 
                      parsedHeaders['to'] ||
                      (email.attributes?.envelope?.to && 
                       email.attributes.envelope.to.map(addr => addr.name || `${addr.mailbox}@${addr.host}`).join(', ')) ||
                      (email.envelope?.to && email.envelope.to.map(addr => addr.name || addr.address).join(', ')) || 
                      parsedHeaders.to ||
                      email.toName || 
                      email.attributes?.toName ||
                      'Unknown Recipient',
        
        // CC and BCC with empty string fallback
        cc: parsedHeaders.cc || 
            parsedHeaders['cc'] ||
            (email.attributes?.envelope?.cc && 
             email.attributes.envelope.cc.map(addr => `${addr.mailbox}@${addr.host}`).join(', ')) ||
            (email.envelope?.cc && email.envelope.cc.map(addr => addr.address).join(', ')) || 
            email.cc || 
            email.attributes?.cc || 
            '',
            
        bcc: parsedHeaders.bcc || 
             parsedHeaders['bcc'] ||
             (email.attributes?.envelope?.bcc && 
              email.attributes.envelope.bcc.map(addr => `${addr.mailbox}@${addr.host}`).join(', ')) ||
             (email.envelope?.bcc && email.envelope.bcc.map(addr => addr.address).join(', ')) || 
             email.bcc || 
             email.attributes?.bcc || 
             '',
        
        // Threading fields
        inReplyTo: parsedHeaders.inReplyTo || 
                  parsedHeaders['in-reply-to'] ||
                  email.attributes?.envelope?.inReplyTo ||
                  email.envelope?.inReplyTo || 
                  email.inReplyTo || null,
                  
        references: (() => {
          const refs = parsedHeaders.references || 
                      parsedHeaders['references'] ||
                      email.attributes?.envelope?.references ||
                      email.envelope?.references || 
                      email.references;
          if (Array.isArray(refs)) {
            return refs.join(' ');
          }
          return refs || null;
        })(),
        
        // Date handling with multiple fallbacks and validation
        createdAt: (() => {
          // 🔍 DEBUG: Log all available date sources
          console.log('🕒 DATE DEBUG:', {
            parsedHeadersDate: parsedHeaders.date,
            envelopeDate: email.attributes?.envelope?.date,
            emailDate: email.date,
            rawEnvelope: email.attributes?.envelope ? 'present' : 'missing'
          });
          
          const tryDate = parsedHeaders.date || 
                         email.attributes?.envelope?.date ||
                         email.envelope?.date || 
                         email.attributes?.date || 
                         email.date;
          
          console.log('🕒 Selected tryDate:', tryDate, typeof tryDate);
          
          if (tryDate) {
            const dateObj = new Date(tryDate);
            console.log('🕒 Parsed dateObj:', dateObj, 'isValid:', !isNaN(dateObj.getTime()));
            if (!isNaN(dateObj.getTime())) {
              return dateObj;
            }
          }
          
          // If parsing parsedHeaders['date'] string
          if (parsedHeaders['date']) {
            const dateObj = new Date(parsedHeaders['date']);
            console.log('🕒 Fallback dateObj from parsedHeaders:', dateObj);
            if (!isNaN(dateObj.getTime())) {
              return dateObj;
            }
          }
          
          // Fallback to current time
          console.log('🕒 Using current time as fallback');
          return new Date();
        })(),
        updatedAt: new Date(),
        
        // Email flags and attributes
        isRead: email.attributes?.flags?.includes('\\Seen') || false,
        flags: email.attributes?.flags || email.flags || [],
        size: email.attributes?.size || 0,
        
        // CRM specific fields
        masterUserID: userID,
        folder: folderType || 'inbox',
        isDraft: folderType === 'drafts',
        isOpened: false,
        isClicked: false,
        
        // Body handling (Phase 2 strategy)
        body_fetch_status: 'pending',
        body: '',
        
        // Optional fields
        leadId: null,
        dealId: null,
        draftId: null,
        tempMessageId: null,
        scheduledAt: null,
        threadId: email.envelope?.messageId || null,
        
        // Processing metadata (not saved to DB)
        provider: provider,
        processed: true,
        lightweight: true,
        strategy: strategy,
        needsBodyProcessing: true,
        processedAt: new Date(),
        
        // Quick content preview (if available in headers)
        preview: email.headers?.['x-gmail-snippet'] || email.snippet || '',
        importance: email.headers?.importance || 'normal',
        priority: email.headers?.priority || 'normal'
      };
      
      // 🔍 COMPREHENSIVE DEBUG LOGGING: See exactly what we're about to save
      console.log(`\n🔍 EMAIL ${i} FINAL EXTRACTION RESULT:`);
      console.log('==================================================');
      console.log('📧 CORE FIELDS:');
      console.log('  MessageID:', lightweightEmail.messageId);
      console.log('  Subject:', lightweightEmail.subject);
      console.log('  Sender:', lightweightEmail.sender);
      console.log('  SenderName:', lightweightEmail.senderName);
      console.log('  Recipient:', lightweightEmail.recipient);
      console.log('  Date:', lightweightEmail.createdAt);
      console.log('📧 PARSED vs FALLBACK:');
      console.log('  Parsed Headers:', Object.keys(parsedHeaders));
      console.log('  Envelope Data:', email.envelope ? 'present' : 'missing');
      console.log('  Attributes Data:', email.attributes ? 'present' : 'missing');
      console.log('🔧 DATA QUALITY CHECK:');
      console.log('  Has real sender?', !lightweightEmail.sender.includes('unknown') && !lightweightEmail.sender.includes('Unknown'));
      console.log('  Has real subject?', lightweightEmail.subject !== 'No Subject');
      console.log('  Has real messageId?', !lightweightEmail.messageId.includes('generated'));
      console.log('==================================================\n');
      
      processedEmails.push(lightweightEmail);
      
      // Progress logging every 100 emails
      if ((i + 1) % 100 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = (i + 1) / elapsed;
        console.log(`[Batch ${page}] 📈 PROGRESS: ${i + 1}/${emails.length} emails (${rate.toFixed(1)} emails/sec)`);
      }
      
    } catch (emailError) {
      errorCount++;
      console.log(`[Batch ${page}] ⚠️ Lightweight processing error ${errorCount}: ${emailError.message}`);
      
      // Higher error tolerance for performance
      if (errorCount > 100) {
        console.log(`[Batch ${page}] ❌ Too many errors (${errorCount}), stopping batch`);
        break;
      }
    }
  }
  
  const totalTime = (Date.now() - startTime) / 1000;
  const rate = processedEmails.length / totalTime;
  
  console.log(`[Batch ${page}] ✅ LIGHTWEIGHT COMPLETE: ${processedEmails.length} emails processed in ${totalTime.toFixed(1)}s (${rate.toFixed(1)} emails/sec)`);
  console.log(`[Batch ${page}] 📊 ERROR RATE: ${errorCount}/${emails.length} (${((errorCount/emails.length)*100).toFixed(1)}%)`);
  
  return { processedEmails, errorCount, processingTime: totalTime, rate };
};

// Fetch and store the most recent email
exports.fetchRecentEmail = async (adminId, options = {}) => {
  // Enforce max batch size if options.batchSize is provided (for worker safety)
  const batchSize = Math.min(Number(options.batchSize) || 10, MAX_BATCH_SIZE);
  let connection = null; // Track connection for proper cleanup

  try {
    console.log(`[fetchRecentEmail] Starting for adminId: ${adminId}`);

    // Fetch the user's email and app password from the UserCredential model
    const userCredential = await UserCredential.findOne({
      where: { masterUserID: adminId },
    });

    if (!userCredential) {
      console.error("User credentials not found for adminId:", adminId);
      return { message: "User credentials not found." };
    }

    const userEmail = userCredential.email;
    const userPassword = userCredential.appPassword;

    console.log("Connecting to IMAP server...");
    // const imapConfig = {
    //   imap: {
    //     user: userEmail, // Use the email from the database
    //     password: userPassword, // Use the app password from the database
    //     host: "imap.gmail.com", // IMAP host (e.g., Gmail)
    //     port: 993, // IMAP port
    //     tls: true, // Use TLS
    //     authTimeout: 30000,
    //     tlsOptions: {
    //       rejectUnauthorized: false, // Allow self-signed certificates
    //     },
    //   },
    // };
    const provider = userCredential.provider; // default to gmail

    let imapConfig;
    if (provider === "custom") {
      if (!userCredential.imapHost || !userCredential.imapPort) {
        return {
          message: "Custom IMAP settings are missing in user credentials.",
        };
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

    // Add connection timeout wrapper
    const connectWithTimeout = async () => {
      console.log(
        `[fetchRecentEmail] Connecting to IMAP server for adminId: ${adminId}...`
      );

      const connectionPromise = Imap.connect(imapConfig);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                `IMAP connection timeout after 2 minutes for adminId ${adminId}`
              )
            ),
          120000
        ); // 2 minutes - increased for Gmail
      });

      try {
        connection = await Promise.race([connectionPromise, timeoutPromise]);
        console.log(
          `[fetchRecentEmail] IMAP connected successfully for adminId: ${adminId}`
        );
        return connection;
      } catch (error) {
        console.error(
          `[fetchRecentEmail] IMAP connection failed for adminId ${adminId}:`,
          error.message
        );
        throw error;
      }
    };

    connection = await connectWithTimeout();

    // Add overall operation timeout wrapper
    const operationWithTimeout = async () => {
      console.log(
        `[fetchRecentEmail] Starting email fetch operation for adminId: ${adminId}...`
      );

      const operationPromise = performEmailFetch();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                `Email fetch operation timeout after 10 minutes for adminId ${adminId}`
              )
            ),
          600000
        ); // 10 minutes - increased for large Gmail mailboxes
      });

      return await Promise.race([operationPromise, timeoutPromise]);
    };

    const performEmailFetch = async () => {
      // Get provider-specific folder configuration
      const provider = userCredential.provider;
      const folderMap = PROVIDER_FOLDER_MAP[provider] || PROVIDER_FOLDER_MAP["gmail"];
      
      console.log(`[fetchRecentEmail] Fetching from both INBOX and SENT folders for provider: ${provider}`);

      // For better performance, fetch only recent emails (last 2 days)
      const sinceDate = formatDateForIMAP(
        new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      );
      console.log(`Using optimized SINCE date: ${sinceDate}`);

      const fetchOptions = {
        bodies: "HEADER", // Only fetch headers first for better performance
        struct: true,
        envelope: true  // ADD ENVELOPE for proper email metadata
      };

      let allMessages = [];
      let folderResults = {};

      // Fetch from INBOX folder
      try {
        console.log(`[fetchRecentEmail] Opening INBOX folder: ${folderMap.inbox}`);
        await connection.openBox(folderMap.inbox);
        
        const searchCriteria = [["SINCE", sinceDate]];
        console.log("Searching for recent emails in INBOX (headers only)...");
        const inboxMessages = await connection.search(searchCriteria, fetchOptions);
        
        // Add folder information to each message
        const inboxMessagesWithFolder = inboxMessages.map(msg => ({
          ...msg,
          folderType: 'inbox',
          folderName: folderMap.inbox
        }));
        
        allMessages.push(...inboxMessagesWithFolder);
        folderResults.inbox = {
          count: inboxMessages.length,
          folderName: folderMap.inbox,
          status: 'success'
        };
        
        console.log(`[fetchRecentEmail] Found ${inboxMessages.length} recent emails in INBOX`);
      } catch (inboxError) {
        console.error(`[fetchRecentEmail] Error fetching from INBOX: ${inboxError.message}`);
        folderResults.inbox = {
          count: 0,
          folderName: folderMap.inbox,
          status: 'error',
          error: inboxError.message
        };
      }

      // Fetch from SENT folder
      try {
        console.log(`[fetchRecentEmail] Opening SENT folder: ${folderMap.sent}`);
        await connection.openBox(folderMap.sent);
        
        const searchCriteria = [["SINCE", sinceDate]];
        console.log("Searching for recent emails in SENT (headers only)...");
        const sentMessages = await connection.search(searchCriteria, fetchOptions);
        
        // Add folder information to each message
        const sentMessagesWithFolder = sentMessages.map(msg => ({
          ...msg,
          folderType: 'sent',
          folderName: folderMap.sent
        }));
        
        allMessages.push(...sentMessagesWithFolder);
        folderResults.sent = {
          count: sentMessages.length,
          folderName: folderMap.sent,
          status: 'success'
        };
        
        console.log(`[fetchRecentEmail] Found ${sentMessages.length} recent emails in SENT`);
      } catch (sentError) {
        console.error(`[fetchRecentEmail] Error fetching from SENT: ${sentError.message}`);
        folderResults.sent = {
          count: 0,
          folderName: folderMap.sent,
          status: 'error',
          error: sentError.message
        };
      }

      console.log(`[fetchRecentEmail] Total recent emails found across folders: ${allMessages.length}`);
      console.log(`[fetchRecentEmail] Folder results:`, folderResults);

      if (allMessages.length === 0) {
        console.log("No recent emails found in any folder.");
        return { 
          message: "No recent emails found in any folder.",
          folderResults: folderResults
        };
      }

      // Sort all messages by date to get the most recent one across all folders
      const sortedMessages = allMessages.sort((a, b) => {
        const dateA = a.attributes?.envelope?.date || a.envelope?.date || new Date(0);
        const dateB = b.attributes?.envelope?.date || b.envelope?.date || new Date(0);
        return new Date(dateB) - new Date(dateA); // Most recent first
      });

      // Get the most recent email from all folders
      const recentHeaderMessage = sortedMessages[0];
      const recentUID = recentHeaderMessage.attributes.uid;
      const recentFolder = recentHeaderMessage.folderType;
      const recentFolderName = recentHeaderMessage.folderName;
      
      console.log(`[fetchRecentEmail] Most recent email found in ${recentFolder} folder (${recentFolderName}) with UID: ${recentUID}`);
      
      // Re-open the folder where the most recent email was found
      console.log(`[fetchRecentEmail] Re-opening ${recentFolder} folder to fetch full body`);
      await connection.openBox(recentFolderName);
      
      console.log(`Fetching full body for most recent email UID: ${recentUID} from ${recentFolder} folder`);
      
      // Now fetch only the full body of the most recent email
      const fullMessages = await connection.search(
        [["UID", recentUID]], 
        { bodies: "", struct: true }
      );

      if (!fullMessages || fullMessages.length === 0) {
        console.log("Could not fetch full message body.");
        return { message: "Could not fetch full message body." };
      }

      console.log(`Found full message data for email in ${recentFolder} folder`);

      // Get the full message data
      const recentMessage = fullMessages[0];
      const rawBodyPart = recentMessage.parts.find((part) => part.which === "");
      const rawBody = rawBodyPart ? rawBodyPart.body : null;

      // Determine read/unread status from IMAP flags
      // If the message has the "\Seen" flag, it is read; otherwise, unread
      let isRead = false;
      if (
        recentMessage.attributes &&
        Array.isArray(recentMessage.attributes.flags)
      ) {
        isRead = recentMessage.attributes.flags.includes("\\Seen");
      }

      if (!rawBody) {
        console.log("No body found for the most recent email.");
        return { message: "No body found for the most recent email." };
      }

      // Parse the raw email body using simpleParser
      const parsedEmail = await simpleParser(rawBody);

      let blockedList = [];
      if (userCredential && userCredential.blockedEmail) {
        blockedList = Array.isArray(userCredential.blockedEmail)
          ? userCredential.blockedEmail
              .map((e) => String(e).trim().toLowerCase())
              .filter(Boolean)
          : [];
      }
      const senderEmail = parsedEmail.from
        ? parsedEmail.from.value[0].address.toLowerCase()
        : null;
      // Sponsored patterns (add more as needed)
      const sponsoredPatterns = [
        /no-?reply/i,
        /mailer-?daemon/i,
        /demon\.mailer/i,
        /sponsored/i,
      ];
      const isSponsored = sponsoredPatterns.some((pattern) =>
        pattern.test(senderEmail)
      );
      if (blockedList.includes(senderEmail) || isSponsored) {
        console.log(`Blocked email from: ${senderEmail}`);
        connection.end();
        return { message: `Blocked email from: ${senderEmail}` };
      }

      const referencesHeader = parsedEmail.headers.get("references");
      const references = Array.isArray(referencesHeader)
        ? referencesHeader.join(" ") // Convert array to string
        : referencesHeader || null;
      //................................

      const emailData = {
        messageId: parsedEmail.messageId || null,
        inReplyTo: parsedEmail.headers.get("in-reply-to") || null,
        references,
        sender: parsedEmail.from ? parsedEmail.from.value[0].address : null,
        senderName: parsedEmail.from ? parsedEmail.from.value[0].name : null,
        recipient: parsedEmail.to
          ? parsedEmail.to.value.map((to) => to.address).join(", ")
          : null,
        cc: parsedEmail.cc
          ? parsedEmail.cc.value.map((cc) => cc.address).join(", ")
          : null,
        bcc: parsedEmail.bcc
          ? parsedEmail.bcc.value.map((bcc) => bcc.address).join(", ")
          : null,
        masterUserID: adminId,
        subject: parsedEmail.subject || null,
        // body: cleanEmailBody(parsedEmail.text || parsedEmail.html || ""),
        body: cleanEmailBody(parsedEmail.html || parsedEmail.text || ""),
        folder: recentFolder, // Use the actual folder where email was found (inbox or sent)
        // threadId,
        createdAt: parsedEmail.date || new Date(),
        isRead: isRead, // Save read/unread status
        uid: recentUID, // Store the IMAP UID for future body fetching
      };

      console.log(`Processing recent email: ${emailData.messageId}`);
      // Check if the email exists in the trash folder
      const trashedEmail = await Email.findOne({
        where: { messageId: emailData.messageId, folder: "trash" },
      });

      let existingEmail;
      if (trashedEmail) {
        existingEmail = trashedEmail;
      } else {
        existingEmail = await Email.findOne({
          where: { messageId: emailData.messageId, folder: emailData.folder },
        });
      }

      // const existingEmail = await Email.findOne({
      //   where: { messageId: emailData.messageId, folder: emailData.folder }, // Check uniqueness with folder
      // });

      let savedEmail;
      if (!existingEmail) {
        savedEmail = await Email.create(emailData);
        console.log(`Recent email saved: ${emailData.messageId}`);
      } else {
        console.log(
          `Recent email already exists in folder ${emailData.folder}: ${emailData.messageId}`
        );
        savedEmail = existingEmail;
      }

      // Save attachments
      const attachments = [];
      if (parsedEmail.attachments && parsedEmail.attachments.length > 0) {
        console.log(
          `Found ${parsedEmail.attachments.length} total attachments for email: ${emailData.messageId}`
        );

        // Filter out icon attachments but KEEP inline attachments for email body rendering
        const filteredAttachments = parsedEmail.attachments.filter(
          (att) =>
            !isIconAttachment(att) &&
            att.contentType !== "text/html" &&
            att.contentType !== "text/plain" &&
            att.size > 0 &&
            att.size < 10 * 1024 * 1024 // Max 10MB per attachment
        );

        console.log(
          `Filtered to ${filteredAttachments.length} real attachments for email: ${emailData.messageId}`
        );

        if (filteredAttachments.length > 0 && filteredAttachments.length <= 5) {
          // Max 5 attachments per email
          try {
            const savedAttachments = await saveAttachments(
              filteredAttachments,
              savedEmail.emailID
            );
            attachments.push(...savedAttachments);
            console.log(
              `Saved ${attachments.length} attachment metadata records for email: ${emailData.messageId}`
            );
          } catch (attachmentError) {
            console.error(
              `Error saving attachment metadata for email ${emailData.messageId}:`,
              attachmentError.message
            );
          }
        } else if (filteredAttachments.length > 5) {
          console.log(
            `Too many attachments (${filteredAttachments.length}) for email: ${emailData.messageId}, skipping attachment metadata processing`
          );
        } else {
          console.log(
            `No real attachments to save metadata for email: ${emailData.messageId}`
          );
        }
      }

      // Fetch related emails in the same thread
      const relatedEmails = await Email.findAll({
        where: {
          [Sequelize.Op.or]: [
            { messageId: emailData.inReplyTo }, // Parent email
            { inReplyTo: emailData.messageId }, // Replies to this email
            {
              references: {
                [Sequelize.Op.like]: `%${emailData.messageId}%`,
              },
            }, // Emails in the same thread
          ],
        },
        order: [["createdAt", "ASC"]], // Sort by date
      });
      // Save related emails in the database
      for (const relatedEmail of relatedEmails) {
        const existingRelatedEmail = await Email.findOne({
          where: { messageId: relatedEmail.messageId },
        });

        if (!existingRelatedEmail) {
          await Email.create(relatedEmail);
          console.log(`Related email saved: ${relatedEmail.messageId}`);
        } else {
          console.log(
            `Related email already exists: ${relatedEmail.messageId}`
          );
        }
      }

      connection.end(); // Close the connection
      console.log("IMAP connection closed.");

      return {
        message: `Fetched and saved the most recent email from ${recentFolder} folder.`,
        email: emailData,
        relatedEmails,
        folderResults: folderResults,
        sourceFolder: {
          type: recentFolder,
          name: recentFolderName,
          uid: recentUID
        }
      };
    }; // End of performEmailFetch function

    // Execute the operation with timeout
    const result = await operationWithTimeout();
    return result;
  } catch (error) {
    console.error("Error fetching recent email:", error);

    // Ensure connection is closed on error
    if (connection) {
      try {
        connection.end();
        console.log("IMAP connection closed due to error.");
      } catch (closeError) {
        console.error("Error closing IMAP connection:", closeError.message);
      }
    }

    return { message: "Internal server error.", error: error.message };
  }
};

// Fetch and store emails from the Drafts folder using batching
exports.fetchDraftEmails = async (req, res) => {
  const { batchSize = 50, page = 1 } = req.query;

  try {
    console.log("Connecting to IMAP server...");
    const connection = await Imap.connect(imapConfig);

    console.log("Listing available folders...");
    const boxes = await connection.getBoxes();
    console.log("Available folders:", boxes);

    console.log("Opening Drafts folder...");
    await connection.openBox("[Gmail]/Drafts"); // Adjust the folder name based on the output of getBoxes()

    console.log("Fetching emails from Drafts...");
    const fetchOptions = {
      bodies: "",
      struct: true,
    };

    const messages = await connection.search(["ALL"], fetchOptions);

    console.log(`Total draft emails found: ${messages.length}`);

    if (messages.length === 0) {
      console.log("No draft emails found.");
      return res.status(200).json({ message: "No draft emails found." });
    }

    // Pagination logic
    const startIndex = (page - 1) * batchSize;
    const endIndex = startIndex + parseInt(batchSize);
    const batchMessages = messages.slice(startIndex, endIndex);

    const draftEmails = [];

    for (const message of batchMessages) {
      const rawBodyPart = message.parts.find((part) => part.which === "");
      const rawBody = rawBodyPart ? rawBodyPart.body : null;

      if (!rawBody) {
        console.log("No body found for this email.");
        continue;
      }

      // Parse the raw email body using simpleParser
      const parsedEmail = await simpleParser(rawBody);

      const emailData = {
        messageId: parsedEmail.messageId || null,
        sender: parsedEmail.from ? parsedEmail.from.value[0].address : null,
        senderName: parsedEmail.from ? parsedEmail.from.value[0].name : null,
        recipient: parsedEmail.to ? parsedEmail.to.value[0].address : null,
        recipientName: parsedEmail.to ? parsedEmail.to.value[0].name : null,
        subject: parsedEmail.subject || null,
        body: cleanEmailBody(parsedEmail.text || parsedEmail.html || ""), // Prefer plain text, fallback to HTML
        folder: "drafts",
        createdAt: parsedEmail.date || new Date(),
      };

      console.log(`Processing draft email: ${emailData.messageId}`);
      draftEmails.push(emailData);

      // Save the draft email to the database
      const existingEmail = await Email.findOne({
        where: { messageId: emailData.messageId },
      });
      if (!existingEmail) {
        await Email.create(emailData);
        console.log(`Draft email saved: ${emailData.messageId}`);
      } else {
        console.log(`Draft email already exists: ${emailData.messageId}`);
      }
      // Save attachments using saveAttachments function
      if (parsedEmail.attachments && parsedEmail.attachments.length > 0) {
        const savedAttachments = await saveAttachments(
          parsedEmail.attachments,
          savedEmail.emailID
        );
        console.log(
          `Saved ${savedAttachments.length} attachment metadata records for email: ${emailData.messageId}`
        );
      }
    }

    connection.end(); // Close the connection
    console.log("IMAP connection closed.");

    res.status(200).json({
      message: `Fetched and saved ${draftEmails.length} draft emails.`,
      currentPage: parseInt(page),
      totalDrafts: messages.length,
      drafts: draftEmails,
    });
  } catch (error) {
    console.error("Error fetching draft emails:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Fetch and store emails from the Archive folder using batching
exports.fetchArchiveEmails = async (req, res) => {
  const { batchSize = 50, page = 1, days = 7 } = req.query;

  try {
    console.log("Connecting to IMAP server...");
    const connection = await Imap.connect(imapConfig);

    console.log("Opening Archive folder...");
    await connection.openBox("[Gmail]/All Mail");

    console.log("Fetching emails from the last 7 days...");
    let searchCriteria;
    if (!days || days === 0 || days === "all") {
      searchCriteria = ["ALL"];
      console.log("Fetching ALL emails (no date restriction)");
    } else {
      const sinceDate = formatDateForIMAP(
        new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      );
      console.log(`Using SINCE date: ${sinceDate}`);
      searchCriteria = [["SINCE", sinceDate]];
    }
    const fetchOptions = {
      bodies: "",
      struct: true,
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    console.log(`Total archive emails found: ${messages.length}`);

    // Pagination logic
    const startIndex = (page - 1) * batchSize;
    const endIndex = startIndex + parseInt(batchSize);
    const batchMessages = messages.slice(startIndex, endIndex);

    if (batchMessages.length === 0) {
      console.log("No more emails to fetch.");
      return res.status(200).json({ message: "No more emails to fetch." });
    }

    const archiveEmails = [];

    for (const message of batchMessages) {
      const rawBodyPart = message.parts.find((part) => part.which === "");
      const rawBody = rawBodyPart ? rawBodyPart.body : null;

      if (!rawBody) {
        console.log("No body found for this email.");
        continue;
      }

      // Parse the raw email body using simpleParser
      const parsedEmail = await simpleParser(rawBody);

      const emailData = {
        messageId: parsedEmail.messageId || null,
        sender: parsedEmail.from ? parsedEmail.from.value[0].address : null,
        senderName: parsedEmail.from ? parsedEmail.from.value[0].name : null,
        recipient: parsedEmail.to ? parsedEmail.to.value[0].address : null,
        recipientName: parsedEmail.to ? parsedEmail.to.value[0].name : null,
        subject: parsedEmail.subject || null,
        body: cleanEmailBody(parsedEmail.text || parsedEmail.html || ""),
        folder: "archive",
        createdAt: parsedEmail.date || new Date(),
      };

      console.log(`Processing archive email: ${emailData.messageId}`);
      archiveEmails.push(emailData);

      const existingEmail = await Email.findOne({
        where: { messageId: emailData.messageId },
      });
      if (!existingEmail) {
        await Email.create(emailData);
        console.log(`Archive email saved: ${emailData.messageId}`);
      } else {
        console.log(`Archive email already exists: ${emailData.messageId}`);
      }
      // Save attachments using saveAttachments function
      if (parsedEmail.attachments && parsedEmail.attachments.length > 0) {
        const savedAttachments = await saveAttachments(
          parsedEmail.attachments,
          savedEmail.emailID
        );
        console.log(
          `Saved ${savedAttachments.length} attachment metadata records for email: ${emailData.messageId}`
        );
      }
    }

    connection.end();
    console.log("IMAP connection closed.");

    res.status(200).json({
      message: `Fetched and saved ${archiveEmails.length} archive emails.`,
      currentPage: parseInt(page),
      totalArchives: messages.length,
    });
  } catch (error) {
    console.error("Error fetching archive emails:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};
// Get emails with pagination, filtering, and searching
exports.getEmails = async (req, res) => {
  let {
    page = 1,
    pageSize = 20,
    folder,
    search,
    isRead,
    toMe,
    hasAttachments,
    isOpened, // <-- Add this
    isClicked, // <-- Add this
    trackedEmails,
    isShared,
    cursor, // Buffer pagination cursor (createdAt ISO string or emailID)
    direction = "next", // 'next' or 'prev'
    dealLinkFilter, // New filter: "linked_with_deal", "linked_with_open_deal", "not_linked_with_deal"
    contactFilter, // New filter: "from_existing_contact", "not_from_existing_contact"
    includeFullBody = "false", // New parameter to control body inclusion
  } = req.query;
  const masterUserID = req.adminId; // Assuming adminId is set in middleware

  // Enforce strict maximum page size
  const MAX_SAFE_PAGE_SIZE = 50;
  pageSize = Math.min(Number(pageSize) || 20, MAX_SAFE_PAGE_SIZE);
  if (pageSize > MAX_SAFE_PAGE_SIZE) pageSize = MAX_SAFE_PAGE_SIZE;

  try {
    // Check if user has credentials in UserCredential model
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });

    if (!userCredential) {
      return res.status(200).json({
        message: "No email credentials found for this user.",
        currentPage: parseInt(page),
        totalPages: 0,
        totalEmails: 0,
        unviewCount: 0,
        threads: [],
        nextCursor: null,
        prevCursor: null,
      });
    }

    let filters = {
      masterUserID,
    };
    // if (isShared === "true") {
    //   filters.isShared = true;
    //   if (folder) filters.folder = folder;
    // } else {
    //   filters = {
    //     [Sequelize.Op.or]: [
    //       { masterUserID },
    //       { isShared: true },
    //     ]
    //   };
    //   if (folder) filters[Sequelize.Op.or].forEach(f => f.folder = folder);
    // }
    if (folder) {
      filters.folder = folder;
    }

    if (isRead !== undefined) {
      filters.isRead = isRead === "true";
    }

    if (toMe === "true") {
      const userCredential = await UserCredential.findOne({
        where: { masterUserID },
      });
      if (!userCredential) {
        return res.status(404).json({ message: "User credentials not found." });
      }
      const userEmail = userCredential.email;
      filters.recipient = { [Sequelize.Op.like]: `%${userEmail}%` };
    }

    // Add tracked emails filter
    // --- Tracked emails filter ---
    if (trackedEmails === "true") {
      filters.isOpened = true;
      filters.isClicked = true;
    } else {
      if (isOpened !== undefined) filters.isOpened = isOpened === "true";
      if (isClicked !== undefined) filters.isClicked = isClicked === "true";
    }

    // Add hasAttachments filter
    let includeAttachments = [
      {
        model: Attachment,
        as: "attachments",
      },
    ];
    if (hasAttachments === "true") {
      includeAttachments = [
        {
          model: Attachment,
          as: "attachments",
          required: true,
        },
      ];
    }

    // Search by subject, sender, or recipient
    if (search) {
      filters[Sequelize.Op.or] = [
        { subject: { [Sequelize.Op.like]: `%${search}%` } },
        { sender: { [Sequelize.Op.like]: `%${search}%` } },
        { recipient: { [Sequelize.Op.like]: `%${search}%` } },
        { senderName: { [Sequelize.Op.like]: `%${search}%` } },
        { recipientName: { [Sequelize.Op.like]: `%${search}%` } },
        { folder: { [Sequelize.Op.like]: `%${search}%` } },
      ];
    }

    // Deal linkage filter
    let includeDeal = [];
    if (dealLinkFilter) {
      switch (dealLinkFilter) {
        case "linked_with_deal":
          // Emails linked to any deal
          filters.dealId = { [Sequelize.Op.ne]: null };
          break;
        case "linked_with_open_deal":
          // Emails linked to open deals only
          filters.dealId = { [Sequelize.Op.ne]: null };
          includeDeal = [
            {
              model: Deal,
              as: "Deal",
              required: true,
              where: {
                status: "open",
              },
            },
          ];
          break;
        case "not_linked_with_deal":
          // Emails not linked to any deal
          filters.dealId = { [Sequelize.Op.or]: [null, ""] };
          break;
      }
    }

    // Contact filter (from existing contact)
    let includePerson = [];
    if (contactFilter) {
      switch (contactFilter) {
        case "from_existing_contact":
          // Emails from senders who exist as contacts/persons
          const existingContactEmails = await Person.findAll({
            attributes: ["email"],
            where: {
              email: { [Sequelize.Op.ne]: null },
            },
          });
          const existingEmailAddresses = existingContactEmails
            .map((p) => p.email)
            .filter(Boolean);

          if (existingEmailAddresses.length > 0) {
            filters.sender = { [Sequelize.Op.in]: existingEmailAddresses };
          } else {
            // If no contacts exist, return empty result
            filters.sender = { [Sequelize.Op.in]: [] };
          }
          break;
        case "not_from_existing_contact":
          // Emails from senders who don't exist as contacts
          const existingContactEmailsNot = await Person.findAll({
            attributes: ["email"],
            where: {
              email: { [Sequelize.Op.ne]: null },
            },
          });
          const existingEmailAddressesNot = existingContactEmailsNot
            .map((p) => p.email)
            .filter(Boolean);

          if (existingEmailAddressesNot.length > 0) {
            filters.sender = {
              [Sequelize.Op.notIn]: existingEmailAddressesNot,
            };
          }
          break;
      }
    }

    // Create base filters without cursor-based date filtering (for totalCount and unviewCount)
    const baseFilters = { masterUserID };
    if (folder) baseFilters.folder = folder;
    if (isRead !== undefined) baseFilters.isRead = isRead === "true";
    if (toMe === "true") {
      const userCredential = await UserCredential.findOne({
        where: { masterUserID },
      });
      if (userCredential) {
        const userEmail = userCredential.email;
        baseFilters.recipient = { [Sequelize.Op.like]: `%${userEmail}%` };
      }
    }
    if (trackedEmails === "true") {
      baseFilters.isOpened = true;
      baseFilters.isClicked = true;
    } else {
      if (isOpened !== undefined) baseFilters.isOpened = isOpened === "true";
      if (isClicked !== undefined) baseFilters.isClicked = isClicked === "true";
    }
    if (search) {
      baseFilters[Sequelize.Op.or] = [
        { subject: { [Sequelize.Op.like]: `%${search}%` } },
        { sender: { [Sequelize.Op.like]: `%${search}%` } },
        { recipient: { [Sequelize.Op.like]: `%${search}%` } },
        { senderName: { [Sequelize.Op.like]: `%${search}%` } },
        { recipientName: { [Sequelize.Op.like]: `%${search}%` } },
        { folder: { [Sequelize.Op.like]: `%${search}%` } },
      ];
    }

    // Add deal linkage filter to baseFilters
    if (dealLinkFilter) {
      switch (dealLinkFilter) {
        case "linked_with_deal":
          baseFilters.dealId = { [Sequelize.Op.ne]: null };
          break;
        case "linked_with_open_deal":
          baseFilters.dealId = { [Sequelize.Op.ne]: null };
          break;
        case "not_linked_with_deal":
          baseFilters.dealId = { [Sequelize.Op.or]: [null, ""] };
          break;
      }
    }

    // Add contact filter to baseFilters
    if (contactFilter) {
      switch (contactFilter) {
        case "from_existing_contact":
          // For baseFilters, we need to apply the same logic
          const existingContactEmailsBase = await Person.findAll({
            attributes: ["email"],
            where: {
              email: { [Sequelize.Op.ne]: null },
            },
          });
          const existingEmailAddressesBase = existingContactEmailsBase
            .map((p) => p.email)
            .filter(Boolean);

          if (existingEmailAddressesBase.length > 0) {
            baseFilters.sender = {
              [Sequelize.Op.in]: existingEmailAddressesBase,
            };
          } else {
            // If no contacts exist, return empty result
            baseFilters.sender = { [Sequelize.Op.in]: [] };
          }
          break;
        case "not_from_existing_contact":
          // For baseFilters, we need to apply the same logic
          const existingContactEmailsNotBase = await Person.findAll({
            attributes: ["email"],
            where: {
              email: { [Sequelize.Op.ne]: null },
            },
          });
          const existingEmailAddressesNotBase = existingContactEmailsNotBase
            .map((p) => p.email)
            .filter(Boolean);

          if (existingEmailAddressesNotBase.length > 0) {
            baseFilters.sender = {
              [Sequelize.Op.notIn]: existingEmailAddressesNotBase,
            };
          }
          break;
      }
    }

    // Buffer pagination logic
    let order = [["createdAt", "DESC"]];
    if (cursor) {
      // If cursor is an emailID, fetch its createdAt
      let cursorDate = null;
      if (/^\d+$/.test(cursor)) {
        const cursorEmail = await Email.findOne({ where: { emailID: cursor } });
        if (cursorEmail) cursorDate = cursorEmail.createdAt;
      } else {
        cursorDate = new Date(cursor);
      }
      if (cursorDate) {
        if (direction === "next") {
          filters.createdAt = { [Sequelize.Op.lt]: cursorDate };
        } else {
          filters.createdAt = { [Sequelize.Op.gt]: cursorDate };
          order = [["createdAt", "ASC"]]; // Reverse order for prev
        }
      }
    }

    // Pagination logic
    const limit = pageSize;
    let offset = null;

    // Use buffer pagination if cursor is provided, otherwise use offset pagination
    if (!cursor) {
      offset = (page - 1) * pageSize;
    }

    // Only select essential fields for better performance
    const essentialFields = [
      "emailID",
      "messageId",
      "inReplyTo",
      "references",
      "sender",
      "senderName",
      "recipient",
      "cc",
      "bcc",
      "subject",
      // 🚀 PHASE 2: Conditional body inclusion for performance
      ...(includeFullBody === "true" ? ["body"] : []), // Only include body if explicitly requested
      "folder",
      "createdAt",
      "isRead",
      "isOpened", // Used to track body fetch status
      "isClicked",
      "leadId",
      "dealId",
    ];

    // Fetch emails from the database
    let emails;

    // Add Lead and Deal includes to get related information
    const includeLeadDeal = [
      {
        model: Lead,
        as: "Lead",
        required: false,
        attributes: [
          "leadId",
          "title",
          "value",
          "status",
          "personId",
          "leadOrganizationId",
        ],
        include: [
          {
            model: Person,
            as: "LeadPerson",
            required: false,
            attributes: [
              "personId",
              "contactPerson",
              "email",
              "phone",
              "jobTitle",
            ],
          },
          {
            model: Organization,
            as: "LeadOrganization",
            required: false,
            attributes: [
              "leadOrganizationId",
              "organization",
              "address",
              "organizationLabels",
            ],
          },
        ],
      },
      {
        model: Deal,
        as: "Deal",
        required: false,
        attributes: [
          "dealId",
          "title",
          "value",
          "status",
          "personId",
          "leadOrganizationId",
        ],
        include: [
          {
            model: Person,
            as: "Person",
            required: false,
            attributes: [
              "personId",
              "contactPerson",
              "email",
              "phone",
              "jobTitle",
            ],
          },
          {
            model: Organization,
            as: "Organization",
            required: false,
            attributes: [
              "leadOrganizationId",
              "organization",
              "address",
              "organizationLabels",
            ],
          },
        ],
      },
    ];

    // Combine includes (attachments + deals + leads)
    const includeModels = [
      ...includeAttachments,
      ...includeDeal,
      ...includeLeadDeal,
    ];

    if (cursor) {
      // Buffer pagination - use findAll with limit and order
      emails = await Email.findAll({
        where: filters,
        include: includeModels,
        limit,
        order,
        attributes: essentialFields,
        distinct: true,
      });
      if (direction === "prev") emails = emails.reverse();
    } else {
      // Traditional offset pagination
      const { count, rows } = await Email.findAndCountAll({
        where: filters,
        include: includeModels,
        offset,
        limit,
        order,
        attributes: essentialFields,
        distinct: true,
      });
      emails = rows;
    }

    // Handle attachment metadata and file paths appropriately
    const emailsWithAttachments = emails.map((email) => {
      const attachments = (email.attachments || []).map((attachment) => {
        const baseAttachment = { ...attachment.toJSON() };

        // If filePath exists, it's a user-uploaded file, include the path
        // If filePath is null, it's metadata-only from fetched emails
        if (attachment.filePath) {
          baseAttachment.path = attachment.filePath; // User-uploaded files
        }
        // For metadata-only attachments, we just return the basic info

        return baseAttachment;
      });

      // Create email object with body preview, attachments, leads, and deals
      const emailObj = { ...email.toJSON(), attachments };

      // Replace body with preview content (but keep the 'body' key name)
      if (includeFullBody === "true") {
        // Keep full body if explicitly requested
        emailObj.body = emailObj.body;
      } else {
        // Replace body with preview content
        emailObj.body = createBodyPreview(emailObj.body);
      }

      // The emailObj now includes:
      // - Lead information (if linkedId exists) with Person and Organization details
      // - Deal information (if dealId exists) with Person and Organization details
      // - Attachments information
      // - All email fields

      return emailObj;
    });

    // Calculate unviewCount using base filters (without cursor date filtering)
    let unviewCount;
    let totalCount;

    // Handle count queries with deal linkage filter
    if (dealLinkFilter === "linked_with_open_deal") {
      // For open deals, we need to join with the Deal table
      unviewCount = await Email.count({
        where: {
          ...baseFilters,
          isRead: false, // Count only unread emails
        },
        include: [
          {
            model: Deal,
            as: "Deal",
            required: true,
            where: {
              status: "open",
            },
          },
        ],
        distinct: true,
      });

      totalCount = await Email.count({
        where: baseFilters,
        include: [
          {
            model: Deal,
            as: "Deal",
            required: true,
            where: {
              status: "open",
            },
          },
        ],
        distinct: true,
      });
    } else {
      // For other filters, use simple count
      unviewCount = await Email.count({
        where: {
          ...baseFilters,
          isRead: false, // Count only unread emails
        },
      });

      totalCount = await Email.count({ where: baseFilters });
    }

    // Grouping logic (only for current page)
    let responseThreads;
    if (folder === "drafts" || folder === "trash") {
      // For drafts and trash, group by draftId if available, else by emailID
      const threads = {};
      emailsWithAttachments.forEach((email) => {
        const threadId = email.draftId || email.emailID; // fallback to emailID if no draftId
        if (!threads[threadId]) {
          threads[threadId] = [];
        }
        threads[threadId].push(email);
      });
      responseThreads = Object.values(threads);
    } else {
      // For other folders, group by inReplyTo or messageId
      const threads = {};
      emailsWithAttachments.forEach((email) => {
        const threadId = email.inReplyTo || email.messageId || email.emailID;
        if (!threads[threadId]) {
          threads[threadId] = [];
        }
        threads[threadId].push(email);
      });
      responseThreads = Object.values(threads);
    }

    // Buffer pagination cursors
    const nextCursor =
      emailsWithAttachments.length > 0
        ? emailsWithAttachments[emailsWithAttachments.length - 1].createdAt
        : null;
    const prevCursor =
      emailsWithAttachments.length > 0
        ? emailsWithAttachments[0].createdAt
        : null;

    // Return the paginated response with threads and unviewCount
    res.status(200).json({
      message: "Emails fetched successfully.",
      currentPage: parseInt(page),
      totalPages: cursor ? 1 : Math.ceil(totalCount / pageSize), // totalPages not meaningful for buffer pagination
      totalEmails: totalCount,
      unviewCount, // Include the unviewCount field
      threads: responseThreads, // Return grouped threads
      nextCursor,
      prevCursor,
    });
  } catch (error) {
    console.error("Error fetching emails:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};
// // Get emails with pagination, filtering, and searching
// exports.getEmails = async (req, res) => {
//   let {
//     page = 1,
//     pageSize = 20,
//     folder,
//     search,
//     isRead,
//     toMe,
//     hasAttachments,
//     isOpened,
//     isClicked,
//     trackedEmails,
//     isShared,
//   } = req.query;
//   const masterUserID = req.adminId;

//   // Enforce strict maximum page size
//   const MAX_SAFE_PAGE_SIZE = 50;
//   pageSize = Math.min(Number(pageSize) || 20, MAX_SAFE_PAGE_SIZE);
//   if (pageSize > MAX_SAFE_PAGE_SIZE) pageSize = MAX_SAFE_PAGE_SIZE;

//   try {
//     const userCredential = await UserCredential.findOne({
//       where: { masterUserID },
//     });
//     if (!userCredential) {
//       return res.status(200).json({
//         message: "No email credentials found for this user.",
//         currentPage: parseInt(page),
//         totalPages: 0,
//         totalEmails: 0,
//         unviewCount: 0,
//         threads: [],
//       });
//     }
//     let filters = { masterUserID };
//     if (folder) filters.folder = folder;
//     if (isRead !== undefined) filters.isRead = isRead === "true";
//     if (toMe === "true") {
//       const userEmail = userCredential.email;
//       filters.recipient = { [Sequelize.Op.like]: `%${userEmail}%` };
//     }
//     if (trackedEmails === "true") {
//       filters.isOpened = true;
//       filters.isClicked = true;
//     } else {
//       if (isOpened !== undefined) filters.isOpened = isOpened === "true";
//       if (isClicked !== undefined) filters.isClicked = isClicked === "true";
//     }
//     let includeAttachments = [
//       {
//         model: Attachment,
//         as: "attachments",
//         attributes: ["attachmentID", "filename", "size"], // Only metadata, removed mimetype
//       },
//     ];
//     if (hasAttachments === "true") {
//       includeAttachments[0].required = true;
//     }
//     if (search) {
//       filters[Sequelize.Op.or] = [
//         { subject: { [Sequelize.Op.like]: `%${search}%` } },
//         { sender: { [Sequelize.Op.like]: `%${search}%` } },
//         { recipient: { [Sequelize.Op.like]: `%${search}%` } },
//         { senderName: { [Sequelize.Op.like]: `%${search}%` } },
//         { recipientName: { [Sequelize.Op.like]: `%${search}%` } },
//         { folder: { [Sequelize.Op.like]: `%${search}%` } },
//       ];
//     }
//     const offset = (page - 1) * pageSize;
//     const limit = pageSize;
//     // Only select essential fields
//     const essentialFields = [
//       "emailID",
//       "messageId",
//       "inReplyTo",
//       "references",
//       "sender",
//       "senderName",
//       "recipient",
//       "cc",
//       "bcc",
//       "subject",
//       "folder",
//       "createdAt",
//       "isRead",
//       "isOpened",
//       "isClicked",
//       "leadId",
//       "dealId",
//     ];
//     const { count, rows: emails } = await Email.findAndCountAll({
//       where: filters,
//       include: includeAttachments,
//       offset,
//       limit,
//       order: [["createdAt", "DESC"]],
//       distinct: true,
//       attributes: essentialFields,
//     });
//     // Add baseURL to attachment paths (metadata only)
//     const baseURL = process.env.LOCALHOST_URL;
//     const emailsWithAttachments = emails.map((email) => {
//       const attachments = (email.attachments || []).map((attachment) => ({
//         ...attachment.toJSON(),
//         path: `${baseURL}/uploads/attachments/${attachment.filename}`,
//       }));
//       return {
//         ...email.toJSON(),
//         attachments,
//       };
//     });
//     // Calculate unviewCount for the specified folder or all folders
//     const unviewCount = await Email.count({
//       where: {
//         ...filters,
//         isRead: false,
//       },
//     });
//     // Grouping logic (only for current page)
//     let responseThreads;
//     if (folder === "drafts" || folder === "trash") {
//       const threads = {};
//       emailsWithAttachments.forEach((email) => {
//         const threadId = email.draftId || email.emailID;
//         if (!threads[threadId]) threads[threadId] = [];
//         threads[threadId].push(email);
//       });
//       responseThreads = Object.values(threads);
//     } else {
//       const threads = {};
//       emailsWithAttachments.forEach((email) => {
//         const threadId = email.inReplyTo || email.messageId || email.emailID;
//         if (!threads[threadId]) threads[threadId] = [];
//         threads[threadId].push(email);
//       });
//       responseThreads = Object.values(threads);
//     }
//     // Safeguard: If response is too large, return error
//     const estimatedResponseSize = JSON.stringify(responseThreads).length;
//     const MAX_RESPONSE_SIZE = 2 * 1024 * 1024; // 2MB
//     if (estimatedResponseSize > MAX_RESPONSE_SIZE) {
//       return res.status(413).json({
//         message:
//           "Response too large. Please reduce pageSize or apply more filters.",
//         currentPage: 1,
//         totalPages: 1,
//         totalEmails: 0,
//         unviewCount,
//         threads: [],
//         nextCursor: null,
//         prevCursor: null,
//       });
//     }
//     // Buffer pagination cursors
//     const nextCursor =
//       emailsWithAttachments.length > 0
//         ? emailsWithAttachments[emailsWithAttachments.length - 1].createdAt
//         : null;
//     const prevCursor =
//       emailsWithAttachments.length > 0
//         ? emailsWithAttachments[0].createdAt
//         : null;
//     res.status(200).json({
//       message: "Emails fetched successfully.",
//       threads: responseThreads,
//       unviewCount,
//       nextCursor,
//       prevCursor,
//     });
//   } catch (error) {
//     console.error("Error fetching emails:", error);
//     res.status(500).json({ message: "Internal server error." });
//   }
// };

// Fetch and store emails from the Sent folder using batching
exports.fetchSentEmails = async (adminId, batchSize = 50, page = 1) => {
  try {
    const userCredential = await UserCredential.findOne({
      where: { masterUserID: adminId },
    });

    if (!userCredential) {
      console.error("User credentials not found for adminId:", adminId);
      return { message: "User credentials not found." };
    }

    const userEmail = userCredential.email;
    const userPassword = userCredential.appPassword;
    console.log(userPassword);
    console.log(userEmail);

    console.log("Connecting to IMAP server...");
    // const imapConfig = {
    //   imap: {
    //     user: userEmail, // Use the email from the database
    //     password: userPassword, // Use the app password from the database
    //     host: "imap.gmail.com", // IMAP host (e.g., Gmail)
    //     port: 993, // IMAP port
    //     tls: true, // Use TLS
    //     authTimeout: 30000,
    //     tlsOptions: {
    //       rejectUnauthorized: false, // Allow self-signed certificates
    //     },
    //   },
    // };
    const provider = userCredential.provider; // default to gmail

    const providerConfig = PROVIDER_CONFIG[provider];
    const imapConfig = {
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

    console.log("Connecting to IMAP server...");
    const connection = await Imap.connect(imapConfig);

    console.log("Opening Sent folder...");
    await connection.openBox("[Gmail]/Sent Mail");

    console.log("Fetching emails from Sent...");
    const sinceDate = formatDateForIMAP(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    console.log(`Using SINCE date: ${sinceDate}`);

    const searchCriteria = [["SINCE", sinceDate]];
    const fetchOptions = {
      bodies: "",
      struct: true,
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    console.log(`Total sent emails found: ${messages.length}`);

    // Pagination logic
    const startIndex = (page - 1) * batchSize;
    const endIndex = startIndex + parseInt(batchSize);
    const batchMessages = messages.slice(startIndex, endIndex);

    if (batchMessages.length === 0) {
      console.log("No more emails to fetch.");
      return res.status(200).json({ message: "No more emails to fetch." });
    }

    const sentEmails = [];

    for (const message of batchMessages) {
      const rawBodyPart = message.parts.find((part) => part.which === "");
      const rawBody = rawBodyPart ? rawBodyPart.body : null;

      if (!rawBody) {
        console.log("No body found for this email.");
        continue;
      }

      // Parse the raw email body using simpleParser
      const parsedEmail = await simpleParser(rawBody);

      const emailData = {
        messageId: parsedEmail.messageId || null,
        inReplyTo: parsedEmail.headers.get("in-reply-to") || null, // Extract inReplyTo header
        references: parsedEmail.headers.get("references")
          ? Array.isArray(parsedEmail.headers.get("references"))
            ? parsedEmail.headers.get("references").join(" ") // Convert array to string
            : parsedEmail.headers.get("references") // Use string directly
          : null,
        sender: parsedEmail.from ? parsedEmail.from.value[0].address : null,
        senderName: parsedEmail.from ? parsedEmail.from.value[0].name : null,
        recipient: parsedEmail.to
          ? parsedEmail.to.value.map((to) => to.address).join(", ")
          : null,
        cc: parsedEmail.cc
          ? parsedEmail.cc.value.map((cc) => cc.address).join(", ")
          : null,
        bcc: parsedEmail.bcc
          ? parsedEmail.bcc.value.map((bcc) => bcc.address).join(", ")
          : null,
        subject: parsedEmail.subject || null,
        body: cleanEmailBody(parsedEmail.text || parsedEmail.html || ""),
        folder: "sent",
        createdAt: parsedEmail.date || new Date(),
        masterUserID: adminId,
      };

      console.log(`Processing sent email: ${emailData.messageId}`);
      sentEmails.push(emailData);

      const existingEmail = await Email.findOne({
        where: { messageId: emailData.messageId, folder: emailData.folder },
      });

      let savedEmail;
      if (!existingEmail) {
        savedEmail = await Email.create(emailData);
        console.log(`Sent email saved: ${emailData.messageId}`);
      } else {
        console.log(`Sent email already exists: ${emailData.messageId}`);
        savedEmail = existingEmail;
      }

      // Save attachments using saveAttachments function
      if (parsedEmail.attachments && parsedEmail.attachments.length > 0) {
        const savedAttachments = await saveAttachments(
          parsedEmail.attachments,
          savedEmail.emailID
        );
        console.log(
          `Saved ${savedAttachments.length} attachment metadata records for email: ${emailData.messageId}`
        );
      }
    }

    connection.end();
    console.log("IMAP connection closed.");

    // res.status(200).json({
    //   message: `Fetched and saved ${sentEmails.length} sent emails.`,
    //   currentPage: parseInt(page),
    //   totalSent: messages.length,
    // });
    return {
      message: `Fetched and saved ${sentEmails.length} sent emails.`,
    };
  } catch (error) {
    console.error("Error fetching sent emails:", error);
    // res.status(500).json({ message: "Internal server error." });
  }
};

// Helper function to fetch linked entities for an email
const getLinkedEntities = async (email) => {
  try {
    const linkedEntities = {
      leads: [],
      deals: [],
      persons: [],
      organizations: [],
    };

    // Extract emails from sender and recipient
    const emailAddresses = [];

    if (email.sender) emailAddresses.push(email.sender);
    if (email.recipient) {
      // Split recipient emails (comma-separated)
      const recipients = email.recipient.split(",").map((r) => r.trim());
      emailAddresses.push(...recipients);
    }
    if (email.cc) {
      const ccEmails = email.cc.split(",").map((r) => r.trim());
      emailAddresses.push(...ccEmails);
    }
    if (email.bcc) {
      const bccEmails = email.bcc.split(",").map((r) => r.trim());
      emailAddresses.push(...bccEmails);
    }

    // Remove duplicates and filter out empty values
    const uniqueEmails = [...new Set(emailAddresses)].filter(Boolean);

    if (uniqueEmails.length === 0) {
      return linkedEntities;
    }

    // LINKING STRATEGY:
    // 1. For Leads & Deals: Prioritize direct linkage (email.leadId/dealId) over email matching
    //    - Each email should link to at most ONE lead and ONE deal
    // 2. For Persons: Allow multiple persons with same email (different roles/organizations)
    // 3. For Organizations: Derived from persons' organizations

    // Search for leads ONLY by explicit linkage (no email matching)
    let leads = [];
    if (email.leadId) {
      leads = await Lead.findAll({
        where: { leadId: email.leadId },
        include: [
          {
            model: MasterUser,
            as: "Owner",
            attributes: ["name", "masterUserID"],
            required: false,
          },
        ],
      });
    }

    // Search for deals ONLY by explicit linkage (no email matching)
    let deals = [];
    if (email.dealId) {
      deals = await Deal.findAll({
        where: { dealId: email.dealId },
        include: [
          {
            model: MasterUser,
            as: "Owner",
            attributes: ["name", "masterUserID"],
            required: false,
          },
        ],
      });
    }

    // Search for persons by email (can have multiple persons with same email)
    const persons = await Person.findAll({
      where: {
        email: { [Sequelize.Op.in]: uniqueEmails },
      },
      include: [
        {
          model: Organization,
          as: "LeadOrganization",
          required: false,
        },
      ],
      limit: 10, // Reasonable limit to prevent performance issues
      order: [["createdAt", "DESC"]], // Get the most recent persons first
    });

    // Search for organizations by finding persons first
    const personOrgIds = persons
      .map((p) => p.leadOrganizationId)
      .filter(Boolean);
    let organizations = [];

    if (personOrgIds.length > 0) {
      organizations = await Organization.findAll({
        where: {
          leadOrganizationId: { [Sequelize.Op.in]: personOrgIds },
        },
      });
    }

    // Format the results and fetch activities for persons
    linkedEntities.leads = leads.map((lead) => ({
      leadId: lead.leadId,
      title: lead.title,
      contactPerson: lead.contactPerson,
      organization: lead.organization,
      status: lead.status,
      owner: lead.Owner ? lead.Owner.name : null,
      createdAt: lead.createdAt,
    }));

    linkedEntities.deals = deals.map((deal) => ({
      dealId: deal.dealId,
      title: deal.title,
      contactPerson: deal.contactPerson,
      organization: deal.organization,
      status: deal.status,
      value: deal.value,
      owner: deal.Owner ? deal.Owner.name : null,
      createdAt: deal.createdAt,
    }));

    // Get all person IDs for activity lookup
    const personIds = persons.map((p) => p.personId).filter(Boolean);

    // Fetch activities for all persons at once
    const activities =
      personIds.length > 0
        ? await Activity.findAll({
            where: {
              personId: { [Sequelize.Op.in]: personIds },
            },
            order: [["createdAt", "DESC"]],
            limit: 50, // Reasonable limit to prevent too much data
          })
        : [];

    // Group activities by personId
    const activitiesByPersonId = {};
    activities.forEach((activity) => {
      if (!activitiesByPersonId[activity.personId]) {
        activitiesByPersonId[activity.personId] = [];
      }
      activitiesByPersonId[activity.personId].push({
        activityId: activity.activityId,
        type: activity.type, // Corrected field name from activityType to type
        subject: activity.subject,
        description: activity.description,
        status: activity.status,
        priority: activity.priority,
        startDateTime: activity.startDateTime,
        endDateTime: activity.endDateTime,
        dueDate: activity.dueDate,
        isDone: activity.isDone,
        createdAt: activity.createdAt,
      });
    });

    linkedEntities.persons = persons.map((person) => ({
      personId: person.personId,
      contactPerson: person.contactPerson,
      email: person.email,
      phone: person.phone,
      leadOrganizationId: person.leadOrganizationId, // Add leadOrganizationId
      organization: person.LeadOrganization
        ? person.LeadOrganization.organization
        : null,
      createdAt: person.createdAt,
      activities: activitiesByPersonId[person.personId] || [], // Add activities array
      activityCount: (activitiesByPersonId[person.personId] || []).length, // Add activity count
    }));

    linkedEntities.organizations = organizations.map((org) => ({
      leadOrganizationId: org.leadOrganizationId,
      organization: org.organization,
      country: org.organizationCountry,
      createdAt: org.createdAt,
    }));

    return linkedEntities;
  } catch (error) {
    console.error("Error fetching linked entities:", error);
    return {
      leads: [],
      deals: [],
      persons: [],
      organizations: [],
    };
  }
};

// Helper function to aggregate linked entities from all emails in a conversation
// Enhanced to include detailed participant information for uniqueParticipants
const getAggregatedLinkedEntities = async (emails) => {
  try {
    const aggregatedEntities = {
      leads: [],
      deals: [],
      persons: [],
      organizations: [],
      conversationStats: {
        totalEmails: emails.length,
        uniqueParticipants: new Set(),
        dateRange: {
          earliest: null,
          latest: null,
        },
      },
    };

    // Keep track of unique entities to avoid duplicates
    // const seenLeads = new Set();
    // const seenDeals = new Set();
    // const seenPersons = new Set();
    // const seenOrganizations = new Set();

    // Track conversation statistics and email-to-name mapping
    const emailToNameMap = new Map(); // Map email addresses to their display names

    emails.forEach((email) => {
      // Add sender with name mapping
      if (email.sender) {
        aggregatedEntities.conversationStats.uniqueParticipants.add(
          email.sender
        );
        // Map sender email to sender name (if available)
        if (email.senderName) {
          emailToNameMap.set(email.sender.toLowerCase(), email.senderName);
        }
      }

      // Add recipients (note: recipients don't have individual names in most email structures)
      if (email.recipient) {
        email.recipient.split(",").forEach((r) => {
          const cleanEmail = r.trim();
          aggregatedEntities.conversationStats.uniqueParticipants.add(
            cleanEmail
          );
          // Recipients typically don't have individual names in stored email data
          // so we'll use email as fallback
        });
      }

      if (email.cc) {
        email.cc.split(",").forEach((r) => {
          const cleanEmail = r.trim();
          aggregatedEntities.conversationStats.uniqueParticipants.add(
            cleanEmail
          );
        });
      }

      // Track date range
      const emailDate = new Date(email.createdAt);
      if (
        !aggregatedEntities.conversationStats.dateRange.earliest ||
        emailDate < aggregatedEntities.conversationStats.dateRange.earliest
      ) {
        aggregatedEntities.conversationStats.dateRange.earliest = emailDate;
      }
      if (
        !aggregatedEntities.conversationStats.dateRange.latest ||
        emailDate > aggregatedEntities.conversationStats.dateRange.latest
      ) {
        aggregatedEntities.conversationStats.dateRange.latest = emailDate;
      }
    });

    // Convert Set to Array for response
    aggregatedEntities.conversationStats.uniqueParticipants = Array.from(
      aggregatedEntities.conversationStats.uniqueParticipants
    ).filter(Boolean);

    // Keep track of unique entities to avoid duplicates
    const seenLeads = new Set();
    const seenDeals = new Set();
    const seenPersons = new Set(); // This will track all persons from both sources
    const seenOrganizations = new Set();

    // Fetch detailed participant data for ALL unique participants (conversation + linked entities)
    const participantEmails =
      aggregatedEntities.conversationStats.uniqueParticipants;

    // Fetch ALL persons data for unique participants
    const allParticipantPersons = await Person.findAll({
      where: {
        email: { [Sequelize.Op.in]: participantEmails },
      },
      include: [
        {
          model: Organization,
          as: "LeadOrganization",
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Create a map of emails that have person records
    const emailsWithPersonRecords = new Set();
    const emailToPersonMap = new Map();

    allParticipantPersons.forEach((person) => {
      emailsWithPersonRecords.add(person.email.toLowerCase());
      emailToPersonMap.set(person.email.toLowerCase(), person);
    }); // Add all participant emails to persons array (both existing persons and email-only participants)
    participantEmails.forEach((email) => {
      const emailLower = email.toLowerCase();

      if (emailsWithPersonRecords.has(emailLower)) {
        // Email has a person record in database
        const person = emailToPersonMap.get(emailLower);
        if (!seenPersons.has(person.personId)) {
          seenPersons.add(person.personId);
          aggregatedEntities.persons.push({
            personId: person.personId,
            contactPerson: person.contactPerson, // Keep contactPerson for existing persons
            senderName: emailToNameMap.get(emailLower) || person.contactPerson, // Add senderName
            email: person.email,
            phone: person.phone,
            leadOrganizationId: person.leadOrganizationId,
            organization: person.LeadOrganization
              ? person.LeadOrganization.organization
              : null,
            createdAt: person.createdAt,
            isExistingPerson: true, // Flag: this is an existing person record
            sourceType: "database", // Source: from person database
            canCreateContact: false, // Already exists, no need to create
            sourceEmail: {
              emailId: null, // Participant from conversation, not specific email
              messageId: null,
              subject: "Conversation Participant",
              createdAt: null,
            },
          });
        }
      } else {
        // Email participant without person record
        const emailOnlyId = `email-only-${emailLower}`;
        if (!seenPersons.has(emailOnlyId)) {
          seenPersons.add(emailOnlyId);
          const displayName = emailToNameMap.get(emailLower) || email; // Use senderName if available, else email
          aggregatedEntities.persons.push({
            personId: null, // No person record exists
            // contactPerson: removed for email-only participants
            senderName: displayName, // Use senderName from email or email address as fallback
            email: email,
            phone: null,
            leadOrganizationId: null,
            organization: null,
            createdAt: null,
            isExistingPerson: false, // Flag: this is just an email participant
            sourceType: "email_participant", // Source: from email conversation
            canCreateContact: true, // Flag: can create new contact from this
            sourceEmail: {
              emailId: null,
              messageId: null,
              subject: "Email Participant Only",
              createdAt: null,
            },
          });
        }
      }
    });

    // Fetch organizations related to all persons
    const allPersonOrgIds = allParticipantPersons
      .map((p) => p.leadOrganizationId)
      .filter(Boolean);

    // Add organizations from participants
    if (allPersonOrgIds.length > 0) {
      const participantOrganizations = await Organization.findAll({
        where: {
          leadOrganizationId: { [Sequelize.Op.in]: allPersonOrgIds },
        },
      });

      participantOrganizations.forEach((org) => {
        if (!seenOrganizations.has(org.leadOrganizationId)) {
          seenOrganizations.add(org.leadOrganizationId);
          aggregatedEntities.organizations.push({
            leadOrganizationId: org.leadOrganizationId,
            organization: org.organization,
            country: org.organizationCountry,
            createdAt: org.createdAt,
            sourceEmail: {
              emailId: null,
              messageId: null,
              subject: "Conversation Participant Organization",
              createdAt: null,
            },
          });
        }
      });
    }

    // Update conversation stats to only include basic info
    aggregatedEntities.conversationStats.participantSummary = {
      totalParticipants: participantEmails.length,
      emailAddresses: participantEmails,
    };

    // Process each email in the conversation for additional linked entities
    for (const email of emails) {
      const linkedEntities = await getLinkedEntities(email);

      // Aggregate leads (deduplicate by leadId)
      linkedEntities.leads.forEach((lead) => {
        if (!seenLeads.has(lead.leadId)) {
          seenLeads.add(lead.leadId);
          aggregatedEntities.leads.push({
            ...lead,
            sourceEmail: {
              emailId: email.emailID,
              messageId: email.messageId,
              subject: email.subject,
              createdAt: email.createdAt,
            },
          });
        }
      });

      // Aggregate deals (deduplicate by dealId)
      linkedEntities.deals.forEach((deal) => {
        if (!seenDeals.has(deal.dealId)) {
          seenDeals.add(deal.dealId);
          aggregatedEntities.deals.push({
            ...deal,
            sourceEmail: {
              emailId: email.emailID,
              messageId: email.messageId,
              subject: email.subject,
              createdAt: email.createdAt,
            },
          });
        }
      });

      // Aggregate additional persons from linked entities (avoid duplicates)
      linkedEntities.persons.forEach((person) => {
        if (!seenPersons.has(person.personId)) {
          seenPersons.add(person.personId);
          aggregatedEntities.persons.push({
            ...person,
            leadOrganizationId: person.leadOrganizationId,
            senderName:
              emailToNameMap.get(person.email.toLowerCase()) ||
              person.contactPerson, // Add senderName
            isExistingPerson: true, // These are existing person records from database
            sourceType: "database", // Source: from person database
            canCreateContact: false, // Already exists, no need to create
            sourceEmail: {
              emailId: email.emailID,
              messageId: email.messageId,
              subject: email.subject,
              createdAt: email.createdAt,
            },
          });
        }
      });

      // Aggregate additional organizations from linked entities (avoid duplicates)
      linkedEntities.organizations.forEach((org) => {
        if (!seenOrganizations.has(org.leadOrganizationId)) {
          seenOrganizations.add(org.leadOrganizationId);
          aggregatedEntities.organizations.push({
            ...org,
            sourceEmail: {
              emailId: email.emailID,
              messageId: email.messageId,
              subject: email.subject,
              createdAt: email.createdAt,
            },
          });
        }
      });
    }

    // Fetch activities for all persons with personId (only for existing persons)
    const personIds = aggregatedEntities.persons
      .map((p) => p.personId)
      .filter(Boolean); // Only get persons that have personId

    const activities =
      personIds.length > 0
        ? await Activity.findAll({
            where: {
              personId: { [Sequelize.Op.in]: personIds },
            },
            order: [["createdAt", "DESC"]],
            limit: 100, // Reasonable limit to prevent too much data for aggregated view
          })
        : [];

    // Group activities by personId
    const activitiesByPersonId = {};
    activities.forEach((activity) => {
      if (!activitiesByPersonId[activity.personId]) {
        activitiesByPersonId[activity.personId] = [];
      }
      activitiesByPersonId[activity.personId].push({
        activityId: activity.activityId,
        type: activity.type, // Use 'type' instead of 'activityType' based on model
        subject: activity.subject,
        description: activity.description,
        status: activity.status,
        priority: activity.priority,
        startDateTime: activity.startDateTime,
        endDateTime: activity.endDateTime,
        dueDate: activity.dueDate,
        isDone: activity.isDone,
        createdAt: activity.createdAt,
      });
    });

    // Add activities to each person in the aggregated persons array
    aggregatedEntities.persons = aggregatedEntities.persons.map((person) => ({
      ...person,
      activities: person.personId
        ? activitiesByPersonId[person.personId] || []
        : [], // Only add activities if personId exists
      activityCount: person.personId
        ? (activitiesByPersonId[person.personId] || []).length
        : 0, // Activity count
    }));

    // Sort aggregated entities by creation date (most recent first)
    // Handle null createdAt for email-only participants
    aggregatedEntities.leads.sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
    aggregatedEntities.deals.sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
    aggregatedEntities.persons.sort((a, b) => {
      // Put existing persons first, then email-only participants
      if (a.isExistingPerson && !b.isExistingPerson) return -1;
      if (!a.isExistingPerson && b.isExistingPerson) return 1;
      // Within same type, sort by creation date
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    aggregatedEntities.organizations.sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    return aggregatedEntities;
  } catch (error) {
    console.error("Error aggregating linked entities:", error);
    return {
      leads: [],
      deals: [],
      persons: [],
      organizations: [],
      conversationStats: {
        totalEmails: 0,
        uniqueParticipants: [],
        participantDetails: {
          persons: [],
          organizations: [],
          emailAddresses: [],
        },
        dateRange: { earliest: null, latest: null },
      },
    };
  }
};

// Helper function to fetch body for a single email on-demand
const fetchEmailBodyOnDemandForEmail = async (email, masterUserID) => {
  try {
    // Check if body needs fetching
    if ((email.body && email.body.trim() !== '') &&
        email.body_fetch_status !== 'pending') {
      console.log(`[fetchEmailBodyOnDemandForEmail] ✅ Email ${email.emailID} already has body`);
      return email;
    }

    console.log(`[fetchEmailBodyOnDemandForEmail] 🔍 Fetching body for related email ${email.emailID}...`);

    const emailBodyService = require('../../services/emailBodyServiceSimple');

    // Get user credentials
    const userCredential = await UserCredential.findOne({
      where: { masterUserID }
    });

    if (!userCredential) {
      console.log(`[fetchEmailBodyOnDemandForEmail] ❌ No credentials found for masterUserID ${masterUserID}`);
      return email;
    }

    // Fetch the body
    const updatedEmail = await emailBodyService.fetchEmailBodyOnDemand(
      email.emailID,
      masterUserID,
      userCredential.provider || 'gmail'
    );

    if (updatedEmail && updatedEmail.success && (updatedEmail.bodyText || updatedEmail.bodyHtml)) {
      // Determine final body content
      let finalBody = '';
      if (updatedEmail.bodyHtml) {
        finalBody = updatedEmail.bodyHtml;
      } else if (updatedEmail.bodyText) {
        finalBody = updatedEmail.bodyText;
      }

      // Update the email object
      email.body = finalBody;
      email.body_fetch_status = 'completed';

      // Update the database record
      await Email.update(
        {
          body: email.body || '',
          body_fetch_status: 'completed'
        },
        { where: { emailID: email.emailID } }
      );

      console.log(`[fetchEmailBodyOnDemandForEmail] ✅ Successfully fetched body for email ${email.emailID} - Body length: ${email.body.length}`);
    } else {
      console.log(`[fetchEmailBodyOnDemandForEmail] ⚠️ Failed to fetch body for email ${email.emailID}`);
      // Mark as failed in database
      await Email.update(
        { body_fetch_status: 'failed' },
        { where: { emailID: email.emailID } }
      );
    }

    return email;
  } catch (error) {
    console.error(`[fetchEmailBodyOnDemandForEmail] ❌ Error fetching body for email ${email.emailID}:`, error.message);
    // Mark as failed in database
    try {
      await Email.update(
        { body_fetch_status: 'failed' },
        { where: { emailID: email.emailID } }
      );
    } catch (dbError) {
      console.error(`[fetchEmailBodyOnDemandForEmail] ❌ Error updating database:`, dbError.message);
    }
    return email;
  }
};

exports.getOneEmail = async (req, res) => {
  const { emailId } = req.params;
  const { preserveOriginal = 'false' } = req.query; // Option to preserve original content
  const masterUserID = req.adminId; // Assuming adminId is set in middleware
  
  const shouldPreserveOriginal = preserveOriginal === 'true';
  console.log(`[getOneEmail] 🔧 PRESERVE ORIGINAL CONTENT: ${shouldPreserveOriginal}`);

  try {
    // Fetch the main email by emailId, including attachments
    const mainEmail = await Email.findOne({
      where: { emailID: emailId },
      include: [
        {
          model: Attachment,
          as: "attachments",
        },
      ],
      // 🔧 DEBUG: Explicitly ensure body field is selected
      attributes: { exclude: [] } // This ensures all fields including body are selected
    });

    if (!mainEmail) {
      return res.status(404).json({ message: "Email not found." });
    }

    // 🔧 DEBUG: Log body status for debugging
    console.log(`[getOneEmail] 📧 Email ${emailId}: body_fetch_status = ${mainEmail.body_fetch_status}, has body = ${!!mainEmail.body}, body length = ${mainEmail.body ? mainEmail.body.length : 0}`);

    // Mark as read if not already
    if (!mainEmail.isRead) {
      await mainEmail.update({ isRead: true });
    }

    // 🚀 PHASE 2: Hybrid body fetching - On-demand for when user opens email
    if ((!mainEmail.body || mainEmail.body === null || mainEmail.body.trim() === '') || 
        (mainEmail.body_fetch_status === 'pending' && (!mainEmail.body || mainEmail.body === null))) {
      // Email body not fetched yet - fetch it now using our smart service
      console.log(`[Phase 2] 🔍 ON-DEMAND: Email ${emailId} body missing or pending, fetching now...`);
      
      try {
        const emailBodyService = require('../../services/emailBodyServiceSimple');
        const emailBodyServiceRaceSafe = require('../../services/emailBodyServiceRaceSafe');
        console.log(`🔍 CONTROLLER DEBUG: EmailBodyService loaded, functions available:`, Object.keys(emailBodyService));
        console.log(`🛡️ CONTROLLER DEBUG: Race-safe service loaded, functions available:`, Object.keys(emailBodyServiceRaceSafe));
        
        // 🔧 ENHANCED DEBUG: Get and analyze user credentials
        console.log(`🔍 API DEBUG: Looking for credentials for masterUserID ${masterUserID}`);
        const userCredential = await UserCredential.findOne({
          where: { masterUserID }
        });
        
        if (userCredential) {
          console.log(`✅ API DEBUG: Credentials found for user ${masterUserID}`);
          console.log(`📧 API DEBUG: Email: ${userCredential.email}`);
          console.log(`🔧 API DEBUG: Provider: ${userCredential.provider}`);
          console.log(`🔑 API DEBUG: Has App Password: ${!!userCredential.appPassword}`);
          console.log(`🔑 API DEBUG: App Password Length: ${userCredential.appPassword ? userCredential.appPassword.length : 0}`);
          console.log(`🌐 API DEBUG: IMAP Host: ${userCredential.imapHost || 'Not set (will use default)'}`);
          console.log(`🌐 API DEBUG: IMAP Port: ${userCredential.imapPort || 'Not set (will use default)'}`);
          console.log(`🔒 API DEBUG: IMAP TLS: ${userCredential.imapTLS !== null ? userCredential.imapTLS : 'Not set (will use default)'}`);
          
          // Check if it's Gmail and validate requirements
          if (userCredential.email && userCredential.email.includes('gmail.com')) {
            console.log(`📧 API DEBUG: GMAIL ACCOUNT DETECTED - Validating requirements...`);
            console.log(`${userCredential.provider === 'gmail' ? '✅' : '❌'} API DEBUG: Provider should be 'gmail', current: ${userCredential.provider}`);
            console.log(`${userCredential.appPassword && userCredential.appPassword.length === 16 ? '✅' : '❌'} API DEBUG: App Password should be 16 chars, current: ${userCredential.appPassword ? userCredential.appPassword.length : 0}`);
            console.log(`🔑 API DEBUG: App Password preview: ${userCredential.appPassword ? userCredential.appPassword.substring(0, 4) + '************' : 'None'}`);
          }
          
          console.log(`🚀 API DEBUG: Calling fetchEmailBodyOnDemand (SIMPLE VERSION) with:`);
          console.log(`   - emailID: ${mainEmail.emailID}`);
          console.log(`   - masterUserID: ${masterUserID}`);
          console.log(`   - provider: ${userCredential.provider || 'gmail'}`);
          
          // � USE SIMPLE VERSION: No race condition protection, proven working method
          const updatedEmail = await emailBodyService.fetchEmailBodyOnDemand(
            mainEmail.emailID, // 🔧 FIX: Use emailID instead of id
            masterUserID, 
            userCredential.provider || 'gmail'
          );
          
          console.log(`🔧 API DEBUG: fetchEmailBodyOnDemand result:`, {
            success: updatedEmail.success,
            hasBodyText: !!updatedEmail.bodyText,
            hasBodyHtml: !!updatedEmail.bodyHtml,
            bodyTextLength: updatedEmail.bodyText ? updatedEmail.bodyText.length : 0,
            bodyHtmlLength: updatedEmail.bodyHtml ? updatedEmail.bodyHtml.length : 0
          });
          
          // Update the main email object with fetched body
          if (updatedEmail && updatedEmail.success && (updatedEmail.bodyText || updatedEmail.bodyHtml)) {
            // Return only HTML content if available, otherwise use text content
            let finalBody = '';
            if (updatedEmail.bodyHtml) {
              // HTML content available - use it
              finalBody = updatedEmail.bodyHtml;
            } else if (updatedEmail.bodyText) {
              // Only text available - use it
              finalBody = updatedEmail.bodyText;
            }

            mainEmail.body = finalBody;
            mainEmail.body_fetch_status = 'completed';

            // Also update the database record
            await Email.update(
              {
                body: mainEmail.body || '',
                body_fetch_status: 'completed'
              },
              { where: { emailID: mainEmail.emailID } }
            );

            console.log(`[Phase 2] ✅ ON-DEMAND: Email ${emailId} body fetched successfully - Body length: ${mainEmail.body.length}`);
          } else {
            console.log(`[Phase 2] ⚠️ ON-DEMAND: Email ${emailId} body fetch failed or returned empty result`);
            console.log(`   - Success: ${updatedEmail ? updatedEmail.success : 'N/A'}`);
            console.log(`   - Error: ${updatedEmail ? updatedEmail.error : 'N/A'}`);
          }
        } else {
          console.log(`❌ API DEBUG: No credentials found for masterUserID ${masterUserID}`);
          console.log(`[Phase 2] ⚠️ ON-DEMAND: No user credentials found for USER ${masterUserID}`);
        }
      } catch (bodyFetchError) {
        console.log(`❌ API DEBUG: Body fetch error details:`);
        console.log(`   - Error message: ${bodyFetchError.message}`);
        console.log(`   - Error stack: ${bodyFetchError.stack}`);
        console.log(`[Phase 2] ❌ ON-DEMAND: Failed to fetch body for email ${emailId}:`, bodyFetchError.message);
        await mainEmail.update({ body_fetch_status: 'failed' });
        // Continue with existing data - conversation still works!
      }
    } else {
      console.log(`[Phase 2] ✅ BODY EXISTS: Email ${emailId} already has body (length: ${mainEmail.body ? mainEmail.body.length : 0})`);
    }

    // Handle attachments appropriately based on type (user-uploaded vs fetched)
    mainEmail.attachments = mainEmail.attachments.map((attachment) => {
      const baseAttachment = { ...attachment };

      // If filePath exists, it's a user-uploaded file, include the path
      // If filePath is null, it's metadata-only from fetched emails
      if (attachment.filePath) {
        baseAttachment.path = attachment.filePath; // User-uploaded files
      }
      // For metadata-only attachments, we just return the basic info

      return baseAttachment;
    });

    // Clean the body of the main email AFTER processing attachments so we can replace cid: references
    console.log(`[getOneEmail] 🔧 BEFORE CLEAN: Email ${emailId} body length: ${mainEmail.body ? mainEmail.body.length : 0}`);
    console.log(`[getOneEmail] 🔍 BODY TYPE: ${mainEmail.body && mainEmail.body.includes('<') ? 'HTML' : 'TEXT'}`);
    console.log(`[getOneEmail] 📎 ATTACHMENTS: ${mainEmail.attachments.length} total`);
    
    // Check for inline images (cid references) before cleaning
    const hasCidReferences = mainEmail.body && mainEmail.body.includes('cid:');
    console.log(`[getOneEmail] 🖼️ HAS CID REFERENCES: ${hasCidReferences}`);
    
    if (hasCidReferences) {
      const cidMatches = mainEmail.body.match(/cid:[^"'\s>]+/gi) || [];
      console.log(`[getOneEmail] 🖼️ FOUND CID REFERENCES: ${cidMatches.join(', ')}`);
      
      // Log attachment contentIds for debugging
      const attachmentCids = mainEmail.attachments
        .filter(att => att.contentId)
        .map(att => `cid:${att.contentId.replace(/[<>]/g, '')}`);
      console.log(`[getOneEmail] 📎 ATTACHMENT CIDs: ${attachmentCids.join(', ')}`);
    }
    
    // Store original body for comparison
    const originalBodyLength = mainEmail.body ? mainEmail.body.length : 0;
    
    if (shouldPreserveOriginal) {
      // Minimal cleaning - only replace CID references, preserve everything else
      console.log(`[getOneEmail] 🔒 PRESERVE MODE: Only replacing CID references, keeping signatures and formatting`);
      mainEmail.body = replaceCidReferences(mainEmail.body || '', mainEmail.attachments);
    } else {
      // Normal cleaning
      mainEmail.body = cleanEmailBody(mainEmail.body || '', mainEmail.attachments);
    }
    
    console.log(`[getOneEmail] 🔧 AFTER CLEAN: Email ${emailId} body length: ${mainEmail.body ? mainEmail.body.length : 0} (${originalBodyLength - (mainEmail.body ? mainEmail.body.length : 0)} chars removed)`);
    console.log(`[getOneEmail] 🔧 BODY PREVIEW: ${mainEmail.body ? mainEmail.body.substring(0, 300) + '...' : 'No body content'}`);

    // If this is a draft or trash, do NOT fetch related emails but still get linked entities
    if (mainEmail.folder === "drafts") {
      const linkedEntities = await getLinkedEntities(mainEmail);
      return res.status(200).json({
        message: "Draft email fetched successfully.",
        data: {
          email: mainEmail,
          relatedEmails: [],
          linkedEntities,
        },
      });
    }
    if (mainEmail.folder === "trash") {
      const linkedEntities = await getLinkedEntities(mainEmail);
      return res.status(200).json({
        message: "trash email fetched successfully.",
        data: {
          email: mainEmail,
          relatedEmails: [],
          linkedEntities,
        },
      });
    }

    // Gather all thread IDs (messageId, inReplyTo, and references)
    const threadIds = [
      mainEmail.messageId,
      mainEmail.inReplyTo,
      ...(mainEmail.references ? mainEmail.references.split(" ") : []),
    ].filter(Boolean);

    // Fetch all related emails in the thread (across all users)
    let relatedEmails = await Email.findAll({
      where: {
        [Sequelize.Op.or]: [
          { messageId: { [Sequelize.Op.in]: threadIds } },
          { inReplyTo: { [Sequelize.Op.in]: threadIds } },
          {
            references: {
              [Sequelize.Op.or]: threadIds.map((id) => ({
                [Sequelize.Op.like]: `%${id}%`,
              })),
            },
          },
        ],
        folder: { [Sequelize.Op.in]: ["inbox", "sent"] },
      },
      include: [
        {
          model: Attachment,
          as: "attachments",
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    // Remove the main email from relatedEmails (by messageId) BEFORE checking for enhanced threading
    relatedEmails = relatedEmails.filter(
      (email) => email.messageId !== mainEmail.messageId
    );

    // 🚀 ENHANCED THREADING: If no related emails found via standard threading,
    // try subject-based and participant-based matching
    if (relatedEmails.length === 0 && mainEmail.subject) {
      console.log(`[getOneEmail] 🔍 No standard thread matches found for email ${emailId}, trying enhanced threading...`);

      // Extract base subject (remove Re:, Fwd:, etc.)
      const baseSubject = mainEmail.subject
        .replace(/^(Re|Fwd|Fw):\s*/i, '')
        .trim();

      // Get participants from main email
      const participants = [
        mainEmail.sender,
        mainEmail.recipient,
        ...(mainEmail.cc ? mainEmail.cc.split(',').map(cc => cc.trim()) : []),
        ...(mainEmail.bcc ? mainEmail.bcc.split(',').map(bcc => bcc.trim()) : [])
      ].filter(Boolean);

      // Find emails with similar subjects and overlapping participants
      const subjectBasedEmails = await Email.findAll({
        where: {
          [Sequelize.Op.and]: [
            {
              [Sequelize.Op.or]: [
                { subject: { [Sequelize.Op.like]: `%${baseSubject}%` } },
                { subject: { [Sequelize.Op.like]: `%Re: ${baseSubject}%` } },
                { subject: { [Sequelize.Op.like]: `%Fwd: ${baseSubject}%` } },
                { subject: { [Sequelize.Op.like]: `%Fw: ${baseSubject}%` } }
              ]
            },
            {
              [Sequelize.Op.or]: [
                { sender: { [Sequelize.Op.in]: participants } },
                { recipient: { [Sequelize.Op.in]: participants } },
                { cc: { [Sequelize.Op.like]: participants.map(p => `%${p}%`).join('') } },
                { bcc: { [Sequelize.Op.like]: participants.map(p => `%${p}%`).join('') } }
              ]
            }
          ],
          folder: { [Sequelize.Op.in]: ["inbox", "sent"] },
          messageId: { [Sequelize.Op.ne]: mainEmail.messageId } // Exclude main email
        },
        include: [
          {
            model: Attachment,
            as: "attachments",
          },
        ],
        order: [["createdAt", "ASC"]],
        limit: 20 // Limit to prevent too many false matches
      });

      if (subjectBasedEmails.length > 0) {
        console.log(`[getOneEmail] ✅ Found ${subjectBasedEmails.length} emails via enhanced threading for subject: "${baseSubject}"`);
        relatedEmails = subjectBasedEmails;
      }
    }
    // Remove the main email from relatedEmails
    //relatedEmails = relatedEmails.filter(email => email.emailID !== mainEmail.emailID);
    // Remove the main email from relatedEmails (by messageId)

    // relatedEmails = relatedEmails.filter(
    //   (email) => email.messageId !== mainEmail.messageId
    // );

    // Deduplicate relatedEmails by messageId (keep the first occurrence)
    // const seen = new Set();
    // relatedEmails = relatedEmails.filter(email => {
    //   if (seen.has(email.messageId)) return false;
    //   seen.add(email.messageId);
    //   return true;
    // });
    let allEmails = [mainEmail, ...relatedEmails];

    //......changes
    const seen = new Set();
    allEmails = allEmails.filter((email) => {
      if (seen.has(email.messageId)) return false;
      seen.add(email.messageId);
      return true;
    });
    const emailMap = {};
    allEmails.forEach((email) => {
      emailMap[email.messageId] = email;
    });
    const conversation = [];
    let current = allEmails.find(
      (email) => !email.inReplyTo || !emailMap[email.inReplyTo]
    );
    while (current) {
      conversation.push(current);
      // Find the next email that replies to the current one
      current = allEmails.find(
        (email) =>
          email.inReplyTo === conversation[conversation.length - 1].messageId
      );
    }

    // // If some emails are not in the chain (e.g., forwards), add them by date
    const remaining = allEmails.filter(
      (email) => !conversation.includes(email)
    );
    remaining.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    conversation.push(...remaining);

    // // The first is the main email, the rest are related
    // const sortedMainEmail = conversation[0];
    // const sortedRelatedEmails = conversation.slice(1);

    // Handle attachments appropriately for related emails
    // 🚀 PHASE 2: Fetch bodies for related emails on-demand
    console.log(`[getOneEmail] 🔍 Processing ${relatedEmails.length} related emails for body fetching...`);

    for (let i = 0; i < relatedEmails.length; i++) {
      const relatedEmail = relatedEmails[i];

      // Check if body needs fetching (similar to main email logic)
      if ((!relatedEmail.body || relatedEmail.body === null || relatedEmail.body.trim() === '') ||
          (relatedEmail.body_fetch_status === 'pending' && (!relatedEmail.body || relatedEmail.body === null))) {

        console.log(`[getOneEmail] 🔍 ON-DEMAND: Related email ${relatedEmail.emailID} body missing or pending, fetching now...`);

        try {
          // Use the helper function to fetch body for this related email
          const updatedEmail = await fetchEmailBodyOnDemandForEmail(relatedEmail, masterUserID);

          // Update the email in the array with the fetched body
          relatedEmails[i] = updatedEmail;

          console.log(`[getOneEmail] ✅ ON-DEMAND: Related email ${relatedEmail.emailID} body fetched successfully`);
        } catch (bodyFetchError) {
          console.log(`[getOneEmail] ❌ ON-DEMAND: Failed to fetch body for related email ${relatedEmail.emailID}:`, bodyFetchError.message);
          // Continue with existing data - conversation still works!
        }
      } else {
        console.log(`[getOneEmail] ✅ BODY EXISTS: Related email ${relatedEmail.emailID} already has body (length: ${relatedEmail.body ? relatedEmail.body.length : 0})`);
      }
    }

    // Now clean the bodies (whether fetched or existing)
    console.log(`[getOneEmail] 🧹 Cleaning bodies for ${relatedEmails.length} related emails...`);
    
    relatedEmails.forEach((email, index) => {
      console.log(`[getOneEmail] 🔧 Processing related email ${index + 1}/${relatedEmails.length} (ID: ${email.emailID})`);
      
      // First process attachments to get the paths ready
      email.attachments = email.attachments.map((attachment) => {
        const baseAttachment = { ...attachment };

        // If filePath exists, it's a user-uploaded file, include the path
        // If filePath is null, it's metadata-only from fetched emails
        if (attachment.filePath) {
          baseAttachment.path = attachment.filePath; // User-uploaded files
        }
        
        return baseAttachment;
      });
      
      // Log before cleaning
      const originalLength = email.body ? email.body.length : 0;
      const hasCids = email.body && email.body.includes('cid:');
      console.log(`[getOneEmail] 📧 Related email ${email.emailID}: body length=${originalLength}, has CIDs=${hasCids}, attachments=${email.attachments.length}`);
      
      // Then clean the body with attachment info to replace cid: references
      if (shouldPreserveOriginal) {
        // Minimal cleaning for related emails too
        email.body = replaceCidReferences(email.body, email.attachments);
      } else {
        // Normal cleaning
        email.body = cleanEmailBody(email.body, email.attachments);
      }
      
      const newLength = email.body ? email.body.length : 0;
      console.log(`[getOneEmail] ✅ Related email ${email.emailID} processed: ${originalLength} -> ${newLength} chars (preserve=${shouldPreserveOriginal})`);
    });

    const sortedMainEmail = conversation.find(email => email.emailID === mainEmail.emailID) || conversation[0];
    const sortedRelatedEmails = conversation.slice(1);

    // 🔧 ENSURE: Main email has the latest body content
    if (sortedMainEmail.emailID === mainEmail.emailID) {
      sortedMainEmail.body = mainEmail.body;
      sortedMainEmail.body_fetch_status = mainEmail.body_fetch_status;
    }

    console.log(`[getOneEmail] 🔍 FINAL CHECK: Email ${emailId} body in response:`, {
      hasBody: !!sortedMainEmail.body,
      bodyLength: sortedMainEmail.body ? sortedMainEmail.body.length : 0,
      bodyPreview: sortedMainEmail.body ? sortedMainEmail.body.substring(0, 100) + '...' : 'No body'
    });

    // Fetch linked entities from ALL emails in the conversation thread
    const linkedEntities = await getAggregatedLinkedEntities(conversation);

    res.status(200).json({
      message: "Email fetched successfully.",
      data: {
        email: sortedMainEmail,
        relatedEmails: sortedRelatedEmails,
        linkedEntities, // Add aggregated linked entities to response
      },
    });
  } catch (error) {
    console.error("Error fetching email:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

const dynamicUpload = require("../../middlewares/dynamicUpload");
const { threadId } = require("worker_threads");
exports.composeEmail = [
  // upload.array("attachments"), // Use Multer to handle multiple file uploads
  dynamicUpload,
  async (req, res) => {
    const {
      to,
      cc,
      bcc,
      subject,
      text,
      html,
      templateID,
      actionType,
      replyToMessageId,
      isDraft,
      draftId,
      // isShared
    } = req.body;
    const masterUserID = req.adminId; // Assuming `adminId` is set in middleware

    try {
      // Check if a default email is set in the DefaultEmail table
      const defaultEmail = await DefaultEmail.findOne({
        where: { masterUserID, isDefault: true },
      });

      let SENDER_EMAIL, SENDER_PASSWORD, SENDER_NAME;

      if (defaultEmail) {
        // Use the default email account
        SENDER_EMAIL = defaultEmail.email;
        SENDER_PASSWORD = defaultEmail.appPassword;

        // If senderName is not provided in DefaultEmail, fetch it from MasterUser
        if (defaultEmail.senderName) {
          SENDER_NAME = defaultEmail.senderName;
        } else {
          const masterUser = await MasterUser.findOne({
            where: { masterUserID },
          });

          if (!masterUser) {
            return res.status(404).json({
              message: "Master user not found for the given user.",
            });
          }

          SENDER_NAME = masterUser.name; // Use the name from MasterUser
        }
      } else {
        // Fallback to UserCredential if no default email is set
        const userCredential = await UserCredential.findOne({
          where: { masterUserID },
        });

        if (!userCredential) {
          return res.status(404).json({
            message: "User credentials not found for the given user.",
          });
        }
        // Add Smart BCC if set and not already in bcc
        // let bccList = [];
        // if (bcc) {
        //   bccList = bcc.split(",").map(e => e.trim()).filter(Boolean);
        // }
        // if (userCredential.smartBcc) {
        //   const smartBccEmail = userCredential.smartBcc.trim();
        //   if (!bccList.includes(smartBccEmail)) {
        //     bccList.push(smartBccEmail);
        //   }
        // }
        // const finalBcc = bccList.join(", ");

        SENDER_EMAIL = userCredential.email;
        SENDER_PASSWORD = userCredential.appPassword;

        // Fetch senderName from MasterUser
        const masterUser = await MasterUser.findOne({
          where: { masterUserID },
        });

        if (!masterUser) {
          return res.status(404).json({
            message: "Master user not found for the given user.",
          });
        }

        SENDER_NAME = masterUser.name; // Use the name from MasterUser
      }
      // --- Smart BCC logic: always after sender is set ---
      const userCredentialForBcc = await UserCredential.findOne({
        where: { masterUserID },
      });

      let bccList = [];
      if (bcc) {
        bccList = bcc
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
      }
      if (userCredentialForBcc && userCredentialForBcc.smartBcc) {
        const smartBccEmail = userCredentialForBcc.smartBcc.trim();
        if (!bccList.includes(smartBccEmail)) {
          bccList.push(smartBccEmail);
        }
      }
      const finalBcc = bccList.join(", ");

      let finalSubject = subject;
      let finalBody = text || html;
      let inReplyToHeader = null;
      let referencesHeader = null;
      let draftEmail;
      // If draftId is present, fetch the draft and use its data as defaults
      if (draftId) {
        draftEmail = await Email.findOne({
          where: { draftId, masterUserID, folder: "drafts" },
        });
        if (!draftEmail) {
          return res.status(404).json({ message: "Draft not found." });
        }
        // Use draft's data as defaults, allow override by request
        finalSubject = subject || draftEmail.subject;
        finalBody = text || html || draftEmail.body;
      }
      // Handle reply action
      if (actionType === "reply") {
        const originalEmail = await Email.findOne({
          where: { messageId: replyToMessageId },
        });

        if (!originalEmail) {
          return res.status(404).json({
            message: "Original email not found for the given messageId.",
          });
        }

        inReplyToHeader = originalEmail.messageId;
        referencesHeader = originalEmail.references
          ? `${originalEmail.references} ${originalEmail.messageId}`
          : originalEmail.messageId;

        finalSubject = originalEmail.subject.startsWith("Re:")
          ? originalEmail.subject
          : `Re: ${originalEmail.subject}`;
        finalBody = `${text || html}`;
        req.body.to = originalEmail.sender;
        req.body.cc = "";
      }
      if (actionType === "replyAll") {
        const originalEmail = await Email.findOne({
          where: { messageId: replyToMessageId },
        });

        if (!originalEmail) {
          return res.status(404).json({
            message: "Original email not found for the given messageId.",
          });
        }

        inReplyToHeader = originalEmail.messageId;
        referencesHeader = originalEmail.references
          ? `${originalEmail.references} ${originalEmail.messageId}`
          : originalEmail.messageId;

        finalSubject = originalEmail.subject.startsWith("Re:")
          ? originalEmail.subject
          : `Re: ${originalEmail.subject}`;
        finalBody = `${text || html}`;

        // Build recipients: all original To and CC, plus sender, except yourself
        const currentUserEmail = SENDER_EMAIL.toLowerCase();
        const allTo = (originalEmail.recipient || "")
          .split(",")
          .map((e) => e.trim().toLowerCase());
        const allCc = (originalEmail.cc || "")
          .split(",")
          .map((e) => e.trim().toLowerCase());
        const replyAllList = [originalEmail.sender, ...allTo, ...allCc].filter(
          (email) => email && email !== currentUserEmail
        );
        // Remove duplicates
        const uniqueReplyAll = [...new Set(replyAllList)];
        // Set recipients for reply all
        req.body.to = uniqueReplyAll[0] || "";
        req.body.cc = uniqueReplyAll.slice(1).join(", ");
      }
      if (actionType === "forward") {
        const originalEmail = await Email.findOne({
          where: { messageId: replyToMessageId },
        });

        if (!originalEmail) {
          return res.status(404).json({
            message: "Original email not found for the given messageId.",
          });
        }

        inReplyToHeader = null;
        referencesHeader = null;

        finalSubject = originalEmail.subject.startsWith("Fwd:")
          ? originalEmail.subject
          : `Fwd: ${originalEmail.subject}`;
        finalBody = `${
          text || html
        }<br><br>---------- Forwarded message ----------<br>
    From: ${originalEmail.senderName || originalEmail.sender}<br>
    Date: ${originalEmail.createdAt}<br>
    Subject: ${originalEmail.subject}<br>
    To: ${originalEmail.recipient}<br>
    ${originalEmail.body}`;
        // For forward, req.body.to and req.body.cc are set by the user
      }

      // If a templateID is provided, fetch the template
      if (templateID) {
        const template = await Template.findOne({
          where: { templateID },
        });

        if (!template) {
          return res.status(404).json({ message: "Template not found." });
        }

        finalSubject = template.subject;
        finalBody = template.content;
      }

      // Fetch user credentials to check tracking settings
      const userCredential = await UserCredential.findOne({
        where: { masterUserID },
      });

      if (!userCredential) {
        return res.status(404).json({
          message: "User credentials not found for the given user.",
        });
      }

      const isTrackOpenEmail = userCredential.isTrackOpenEmail || false;
      const isTrackClickEmail = userCredential.isTrackClickEmail || false;

      // Add tracking pixel for email open tracking
      const generateTrackingPixel = (messageId) => {
        const baseURL = process.env.LOCALHOST_URL || "http://yourdomain.com";
        return `<img src="${baseURL}/track/open/${messageId}" width="1" height="1" style="display:none;"alt="" />`;
      };

      // Add tracking links for click tracking
      const generateRedirectLink = (originalUrl, messageId) => {
        const baseURL = process.env.LOCALHOST_URL || "http://yourdomain.com";
        return `${baseURL}/track/click?tempMessageId=${messageId}&url=${encodeURIComponent(
          originalUrl
        )}`;
      };

      const replaceLinksWithTracking = (body, messageId) => {
        return body.replace(
          /href="([^"]*)"/g,
          (match, url) => `href="${generateRedirectLink(url, messageId)}"`
        );
      };
      let signatureBlock = "";
      if (userCredential.signatureName) {
        signatureBlock += `<strong>${userCredential.signatureName}</strong><br>`;
      }
      if (userCredential.signature) {
        signatureBlock += `${userCredential.signature}<br>`;
      }
      if (userCredential.signatureImage) {
        signatureBlock += `<img src="${userCredential.signatureImage}" alt="Signature Image" style="max-width:200px;"/><br>`;
      }
      finalBody += `<br><br>${signatureBlock}`;
      // Generate a temporary messageId for tracking
      const tempMessageId = `temp-${Date.now()}`;

      // Conditionally add tracking pixel and replace links in the email body
      if (isTrackOpenEmail) {
        finalBody += `<br>${generateTrackingPixel(tempMessageId)}`;
      }

      if (isTrackClickEmail) {
        finalBody = replaceLinksWithTracking(finalBody, tempMessageId);
      }

      // Prepare attachments for nodemailer
      const formattedAttachments =
        req.files && req.files.length > 0
          ? req.files.map((file) => ({
              filename: file.originalname,
              path: file.path,
            }))
          : [];
      //Check if scheduledAt is provided for scheduling
      if (req.body.scheduledAt) {
        const parsedDate = new Date(req.body.scheduledAt);
        if (isNaN(parsedDate.getTime())) {
          return res
            .status(400)
            .json({ message: "Invalid scheduledAt date format." });
        }
        // Save to outbox for later sending
        const emailData = {
          messageId: null,
          inReplyTo: inReplyToHeader || null,
          references: referencesHeader || null,
          sender: SENDER_EMAIL,
          senderName: SENDER_NAME,
          recipient: to,
          cc,
          bcc,
          subject: finalSubject,
          body: finalBody,
          folder: "outbox",
          createdAt: new Date(),
          masterUserID,
          tempMessageId,
          isDraft: false,
          scheduledAt: parsedDate,
        };
        const savedEmail = await Email.create(emailData);

        // Save user-uploaded attachment files with file paths for scheduled emails
        if (req.files && req.files.length > 0) {
          await saveUserUploadedAttachments(req.files, savedEmail.emailID);
        }

        return res.status(200).json({
          message: "Email scheduled and saved to outbox successfully.",
          scheduledAt: emailData.scheduledAt,
          emailID: savedEmail.emailID,
        });
      }

      // Create a transporter using the selected email credentials
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: SENDER_EMAIL,
          pass: SENDER_PASSWORD,
        },
      });
      // If isDraft is false and draftId is provided, update the draft's folder to 'sent'

      // Define the email options
      const mailOptions = {
        from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
        to: to || (draftEmail && draftEmail.recipient),
        cc: cc || (draftEmail && draftEmail.cc),
        bcc: finalBcc || bcc || (draftEmail && draftEmail.bcc),
        subject: finalSubject,
        text: htmlToText(finalBody),
        html: finalBody,
        attachments:
          formattedAttachments.length > 0 ? formattedAttachments : undefined,
        inReplyTo: inReplyToHeader || undefined,
        references: referencesHeader || undefined,
      };

      const baseURL = process.env.LOCALHOST_URL;

      let attachments = [];
      if (req.files && req.files.length > 0) {
        // For user-uploaded files, include the full file path for proper saving
        const baseURL = process.env.LOCALHOST_URL;
        attachments = req.files.map((file) => ({
          filename: file.filename,
          originalname: file.originalname,
          path: file.path, // This is the actual file path on disk where multer saved the file
          size: file.size,
          contentType: file.mimetype,
        }));
      } else if (draftId && draftEmail) {
        // If no new files uploaded, fetch existing attachments from the draft
        const oldAttachments = await Attachment.findAll({
          where: { emailID: draftEmail.emailID },
        });
        attachments = oldAttachments.map((att) => ({
          filename: att.filename,
          originalname: att.filename,
          path: att.filePath || att.path, // use filePath or path
          size: att.size,
          contentType: att.contentType,
        }));
      }

      const finalTo = to || (draftEmail && draftEmail.recipient);
      const finalCc = cc || (draftEmail && draftEmail.cc);
      const finalBccValue = finalBcc || bcc || (draftEmail && draftEmail.bcc);

      if (!finalTo && !finalCc && !finalBccValue) {
        return res.status(400).json({
          message: "At least one recipient (to, cc, bcc) is required.",
        });
      }
      const emailData = {
        // messageId: info.messageId,
        draftId: draftId || null,
        inReplyTo: inReplyToHeader || null,
        references: referencesHeader || null,
        sender: SENDER_EMAIL,
        senderName: SENDER_NAME,
        // recipient: to,
        // cc,
        // bcc,
        recipient: finalTo,
        cc: finalCc,
        bcc: finalBccValue,
        subject: finalSubject,
        body: finalBody,
        folder: "sent", // Will be set when saved in queue worker
        createdAt: new Date(),
        masterUserID,
        tempMessageId,
        isDraft: false,
        attachments,
        // isShared: isShared === true || isShared === "true", // ensure boolean
      };

      // Don't save to database here - let the queue worker handle it
      // Just send the email data to the queue for processing
      await publishToQueue("EMAIL_QUEUE", emailData);
      // }

      res.status(200).json({
        message: "Email sent and saved successfully.",
        // messageId: info.messageId,
        // attachments: attachmentLinks,
      });
    } catch (error) {
      console.error("Error sending email:", error);
      res
        .status(500)
        .json({ message: "Failed to send email.", error: error.message });
    }
  },
];

exports.createTemplate = async (req, res) => {
  const { name, subject, content, isShared } = req.body; // Changed `body` to `content`
  const masterUserID = req.adminId; // Assuming `adminId` is set in middleware

  try {
    // Save the template in the database
    const templateData = {
      name,
      subject,
      content, // Use `content` instead of `body`
      isShared: isShared || false, // Default to false if not provided
      masterUserID, // Associate the template with the user
    };

    const savedTemplate = await Template.create(templateData);
    console.log("Template created successfully:", savedTemplate);

    res.status(200).json({
      message: "Template created successfully.",
      template: savedTemplate,
    });
  } catch (error) {
    console.error("Error creating template:", error);
    res
      .status(500)
      .json({ message: "Failed to create template.", error: error.message });
  }
};

exports.getTemplates = async (req, res) => {
  const masterUserID = req.adminId; // Assuming `adminId` is set in middleware

  try {
    // Fetch templates for the specific user
    const templates = await Template.findAll({
      where: { masterUserID }, // Filter by masterUserID
    });

    res.status(200).json({
      message: "Templates fetched successfully.",
      templates,
    });
  } catch (error) {
    console.error("Error fetching templates:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch templates.", error: error.message });
  }
};

exports.getTemplateById = async (req, res) => {
  const { templateID } = req.params;
  const masterUserID = req.adminId; // Assuming `adminId` is set in middleware

  try {
    // Fetch the template for the specific user and templateID
    const template = await Template.findOne({
      where: {
        templateID,
        masterUserID, // Ensure the template belongs to the specific user
      },
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found." });
    }

    res.status(200).json({
      message: "Template fetched successfully.",
      template,
    });
  } catch (error) {
    console.error("Error fetching template:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch template.", error: error.message });
  }
};
exports.getUnreadCounts = async (req, res) => {
  const masterUserID = req.adminId; // Assuming adminId is set in middleware

  try {
    // Check if user has credentials in UserCredential model
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });

    if (!userCredential) {
      return res.status(200).json({
        message: "No email credentials found for this user.",
        masterUserID,
        unreadCounts: {
          inbox: 0,
          drafts: 0,
          sent: 0,
          archive: 0,
          trash: 0,
        },
      });
    }

    // Define all possible folders
    const allFolders = ["inbox", "drafts", "sent", "archive", "trash"];

    // Fetch the count of unread emails grouped by folder for the specific user
    const unreadCounts = await Email.findAll({
      attributes: [
        "folder", // Group by folder
        [Sequelize.fn("COUNT", Sequelize.col("emailID")), "unreadCount"], // Count unread emails
      ],
      where: {
        isRead: false, // Only fetch unread emails
        masterUserID, // Filter by the specific user's masterUserID
      },
      group: ["folder"], // Group by folder
    });

    // Convert the result into a dictionary with folder names as keys
    const counts = unreadCounts.reduce((acc, item) => {
      acc[item.folder] = parseInt(item.dataValues.unreadCount, 10);
      return acc;
    }, {});

    // Ensure all folders are included in the response, even if they have zero unread emails
    const response = allFolders.reduce((acc, folder) => {
      acc[folder] = counts[folder] || 0; // Default to 0 if the folder is not in the result
      return acc;
    }, {});

    res.status(200).json({
      message: "Unread counts fetched successfully.",
      masterUserID, // Include the user's masterUserID in the response
      unreadCounts: response,
    });
  } catch (error) {
    console.error("Error fetching unread counts:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.addUserCredential = async (req, res) => {
  const masterUserID = req.adminId; // Assuming adminId is set in middleware
  const {
    email,
    appPassword,
    syncStartDate,
    syncFolders,
    syncAllFolders,
    isTrackOpenEmail,
    isTrackClickEmail,
    blockedEmail, // <-- Add this line
    provider,
    imapHost, // <-- Add these lines
    imapPort,
    imapTLS,
    smtpHost,
    smtpPort,
    smtpSecure,
  } = req.body;

  try {
    // Validate syncStartDate (ensure it's a valid ISO date string)
    if (syncStartDate) {
      const parsedDate = new Date(syncStartDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          message: "Invalid syncStartDate format. Expected an ISO date string.",
        });
      }
    }

    // Validate syncFolders (optional validation to ensure it's an array)
    if (syncFolders && !Array.isArray(syncFolders)) {
      return res.status(400).json({
        message: "Invalid syncFolders. It must be an array of folder names.",
      });
    }

    // Check if the user already has credentials saved
    const existingCredential = await UserCredential.findOne({
      where: { masterUserID },
    });

    const updateData = {};
    if (email) updateData.email = email;
    if (appPassword) updateData.appPassword = appPassword;
    if (syncStartDate) updateData.syncStartDate = syncStartDate;
    if (syncFolders) updateData.syncFolders = syncFolders;
    if (syncAllFolders !== undefined)
      updateData.syncAllFolders = syncAllFolders;
    if (isTrackOpenEmail !== undefined)
      updateData.isTrackOpenEmail = isTrackOpenEmail;
    if (isTrackClickEmail !== undefined)
      updateData.isTrackClickEmail = isTrackClickEmail;
    if (blockedEmail !== undefined) updateData.blockedEmail = blockedEmail;
    if (provider) updateData.provider = provider;
    // Add custom provider fields
    if (provider === "custom") {
      if (imapHost) updateData.imapHost = imapHost;
      if (imapPort) updateData.imapPort = imapPort;
      if (imapTLS !== undefined) updateData.imapTLS = imapTLS;
      if (smtpHost) updateData.smtpHost = smtpHost;
      if (smtpPort) updateData.smtpPort = smtpPort;
      if (smtpSecure !== undefined) updateData.smtpSecure = smtpSecure;
    }

    if (existingCredential) {
      // Update existing credentials
      await existingCredential.update(updateData);
      return res.status(200).json({
        message: "User credentials updated successfully.",
        updatedFields: updateData,
      });
    }

    // Create new credentials
    const newCredential = await UserCredential.create({
      masterUserID,
      email: email || null,
      appPassword: appPassword || null,
      syncStartDate: syncStartDate || new Date().toISOString(),
      syncFolders: syncFolders || [
        "INBOX",
        "[Gmail]/Sent Mail",
        "[Gmail]/Drafts",
      ],
      syncAllFolders: syncAllFolders || false,
      isTrackOpenEmail: isTrackOpenEmail || true,
      isTrackClickEmail: isTrackClickEmail || true,
      blockedEmail: blockedEmail || null, // <-- Add this line
      provider: provider || "gmail",
      // Add these lines for custom provider support
      imapHost: provider === "custom" ? imapHost : null,
      imapPort: provider === "custom" ? imapPort : null,
      imapTLS: provider === "custom" ? imapTLS : null,
      smtpHost: provider === "custom" ? smtpHost : null,
      smtpPort: provider === "custom" ? smtpPort : null,
      smtpSecure: provider === "custom" ? smtpSecure : null,
    });

    res.status(201).json({
      message: "User credentials added successfully.",
      credential: newCredential,
    });
  } catch (error) {
    console.error("Error adding or updating user credentials:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.getUserCredential = async (req, res) => {
  const masterUserID = req.adminId; // Assuming `adminId` is passed in the request (e.g., from middleware)

  try {
    // Fetch the user credentials
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });

    if (!userCredential) {
      return res.status(404).json({ message: "User credentials not found." });
    }

    res.status(200).json({
      message: "User credentials fetched successfully.",
      credential: userCredential, // Return all fields
    });
  } catch (error) {
    console.error("Error fetching user credentials:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};
exports.deleteEmail = async (req, res) => {
  try {
    const masterUserID = req.adminId; // Assuming adminId is set in middleware
    const { emailId } = req.params; // Get the email ID from the request parameters

    const email = await Email.findOne({
      where: { emailID: emailId, masterUserID }, // Ensure the email belongs to the specific user
    });
    if (!email) {
      return res.status(404).json({ message: "Email not found." });
    } else {
      // Move the email to the trash folder
      await email.update({ folder: "trash" });
      console.log(`Email moved to trash: ${email.messageId}`);
      res.status(200).json({
        message: "Email moved to trash successfully.",
      });
    }
  } catch (error) {
    console.error("Error deleting email:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.deletebulkEmails = async (req, res) => {
  try {
    const masterUserID = req.adminId;
    const { emailIds } = req.body; // Expecting an array of email IDs

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return res
        .status(400)
        .json({ message: "emailIds must be a non-empty array." });
    }

    // Update all emails to move them to the trash folder
    const [updatedCount] = await Email.update(
      { folder: "trash" },
      { where: { emailID: emailIds, masterUserID } }
    );

    res.status(200).json({
      message: `${updatedCount} email(s) moved to trash successfully.`,
    });
  } catch (error) {
    console.error("Error deleting emails:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.saveDraft = [
  // upload.array("attachments"), // Use Multer to handle multiple file uploads
  dynamicUpload,
  async (req, res) => {
    const { to, cc, bcc, subject, text, html, draftId } = req.body;
    const masterUserID = req.adminId; // Assuming adminId is set in middleware

    try {
      let savedDraft;
      let isUpdate = false;

      if (draftId) {
        // Try to find the existing draft
        savedDraft = await Email.findOne({
          where: { draftId, masterUserID, folder: "drafts" },
        });

        if (savedDraft) {
          // Update the existing draft
          await savedDraft.update({
            recipient: to || null,
            cc: cc || null,
            bcc: bcc || null,
            subject: subject || null,
            body: text || html || null,
          });
          isUpdate = true;
        }
      }

      if (!savedDraft) {
        // Create a new draft if not updating
        savedDraft = await Email.create({
          messageId: null,
          sender: null,
          senderName: null,
          recipient: to || null,
          cc: cc || null,
          bcc: bcc || null,
          subject: subject || null,
          body: text || html || null,
          folder: "drafts",
          masterUserID,
          draftId: draftId || null,
        });
      }

      // Handle attachments (save actual files for user uploads)
      let savedAttachments = [];
      if (req.files && req.files.length > 0) {
        if (isUpdate) {
          // Remove old attachments if updating
          await Attachment.destroy({ where: { emailID: savedDraft.emailID } });
        }
        // Save user-uploaded draft attachments with file paths
        const baseURL = process.env.LOCALHOST_URL || "http://localhost:3056";
        savedAttachments = req.files.map((file) => ({
          emailID: savedDraft.emailID,
          filename: file.filename,
          filePath: `${baseURL}/uploads/attachments/${encodeURIComponent(
            file.filename
          )}`, // Save actual file path for user uploads
          size: file.size,
          contentType: file.mimetype,
        }));
        await Attachment.bulkCreate(savedAttachments);
      } else if (isUpdate) {
        // If no new attachments, fetch existing ones for response
        savedAttachments = await Attachment.findAll({
          where: { emailID: savedDraft.emailID },
        });
      }

      // Return attachment links for user-uploaded files
      const attachmentLinks = savedAttachments.map((attachment) => ({
        filename: attachment.filename,
        link: attachment.filePath, // Return the file path for user uploads
      }));

      res.status(200).json({
        message: isUpdate
          ? "Draft updated successfully."
          : "Draft saved successfully.",
        draft: savedDraft,
        attachments: attachmentLinks,
      });
    } catch (error) {
      console.error("Error saving draft:", error);
      res
        .status(500)
        .json({ message: "Failed to save draft.", error: error.message });
    }
  },
];

exports.scheduleEmail = [
  // upload.array("attachments"),
  dynamicUpload,
  async (req, res) => {
    const { to, cc, bcc, subject, text, html, scheduledAt } = req.body;
    const masterUserID = req.adminId;

    try {
      // Fetch sender email and name (prefer DefaultEmail, fallback to UserCredential)
      let SENDER_EMAIL, SENDER_NAME;

      const defaultEmail = await DefaultEmail.findOne({
        where: { masterUserID, isDefault: true },
      });

      if (defaultEmail) {
        SENDER_EMAIL = defaultEmail.email;
        SENDER_NAME = defaultEmail.senderName;
        if (!SENDER_NAME) {
          const masterUser = await MasterUser.findOne({
            where: { masterUserID },
          });
          SENDER_NAME = masterUser ? masterUser.name : null;
        }
      } else {
        const userCredential = await UserCredential.findOne({
          where: { masterUserID },
        });
        SENDER_EMAIL = userCredential ? userCredential.email : null;
        const masterUser = await MasterUser.findOne({
          where: { masterUserID },
        });
        SENDER_NAME = masterUser ? masterUser.name : null;
      }

      // Prepare email data for scheduling
      const emailData = {
        sender: SENDER_EMAIL,
        senderName: SENDER_NAME,
        recipient: to,
        cc,
        bcc,
        subject,
        body: text || html,
        folder: "outbox",
        masterUserID,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        isDraft: false,
      };
      const scheduledEmail = await Email.create(emailData);

      // Save attachments if any
      if (req.files && req.files.length > 0) {
        const savedAttachments = req.files.map((file) => ({
          emailID: scheduledEmail.emailID,
          filename: file.originalname,
          path: file.path,
        }));
        await Attachment.bulkCreate(savedAttachments);
      }

      res.status(200).json({
        message: "Email scheduled successfully.",
        // email: fullEmail,
      });
    } catch (error) {
      console.error("Error scheduling email:", error);
      res
        .status(500)
        .json({ message: "Failed to schedule email.", error: error.message });
    }
  },
];

// Delete all emails and attachments for a given masterUserID
exports.deleteAllEmailsForUser = async (req, res) => {
  const masterUserID = req.adminId; // Assuming adminId is set in middleware
  const BATCH_SIZE = 1000;
  let totalEmailsDeleted = 0;
  let totalAttachmentsDeleted = 0;

  // Use transaction to ensure data consistency
  const transaction = await Email.sequelize.transaction();

  try {
    // First, get the total count for verification
    const totalEmailsCount = await Email.count({
      where: { masterUserID },
      transaction,
    });

    // Get total attachments count by finding all emails first, then counting attachments
    const allEmailIds = await Email.findAll({
      where: { masterUserID },
      attributes: ["emailID"],
      transaction,
    });

    const emailIds = allEmailIds.map((email) => email.emailID);
    const totalAttachmentsCount =
      emailIds.length > 0
        ? await Attachment.count({
            where: { emailID: emailIds },
            transaction,
          })
        : 0;

    console.log(`Starting deletion for user ${masterUserID}:`);
    console.log(`- Total emails to delete: ${totalEmailsCount}`);
    console.log(`- Total attachments to delete: ${totalAttachmentsCount}`);

    while (true) {
      // Fetch a batch of email IDs for the user
      const emails = await Email.findAll({
        where: { masterUserID },
        attributes: ["emailID"],
        limit: BATCH_SIZE,
        transaction,
      });

      if (emails.length === 0) break;
      const emailIDs = emails.map((e) => e.emailID);

      // Delete all attachments for these emails first
      const attachmentsDeleted = await Attachment.destroy({
        where: { emailID: emailIDs },
        transaction,
      });

      // Delete all emails for the user in this batch
      const emailsDeleted = await Email.destroy({
        where: { emailID: emailIDs },
        transaction,
      });

      totalEmailsDeleted += emailsDeleted;
      totalAttachmentsDeleted += attachmentsDeleted;

      console.log(
        `Batch processed: ${emailsDeleted} emails, ${attachmentsDeleted} attachments`
      );

      if (emails.length < BATCH_SIZE) break;
    }

    // Commit the transaction
    await transaction.commit();

    // Verify deletion
    const remainingEmails = await Email.count({ where: { masterUserID } });

    // Check remaining attachments by getting remaining email IDs
    const remainingEmailIds = await Email.findAll({
      where: { masterUserID },
      attributes: ["emailID"],
    });
    const remainingEmailIdsList = remainingEmailIds.map(
      (email) => email.emailID
    );
    const remainingAttachments =
      remainingEmailIdsList.length > 0
        ? await Attachment.count({
            where: { emailID: remainingEmailIdsList },
          })
        : 0;

    console.log(`Deletion completed for user ${masterUserID}:`);
    console.log(`- Emails deleted: ${totalEmailsDeleted}`);
    console.log(`- Attachments deleted: ${totalAttachmentsDeleted}`);
    console.log(`- Remaining emails: ${remainingEmails}`);
    console.log(`- Remaining attachments: ${remainingAttachments}`);

    res.status(200).json({
      message: `All emails and attachments deleted for user ${masterUserID}`,
      details: {
        emailsDeleted: totalEmailsDeleted,
        attachmentsDeleted: totalAttachmentsDeleted,
        remainingEmails: remainingEmails,
        remainingAttachments: remainingAttachments,
      },
    });
  } catch (error) {
    // Rollback the transaction in case of error
    await transaction.rollback();
    console.error("Error deleting all emails and attachments:", error);
    res.status(500).json({
      message: "Failed to delete all emails and attachments.",
      error: error.message,
    });
  }
};

// Bulk email operations
exports.bulkEditEmails = async (req, res) => {
  const { emailIds, updateData } = req.body;
  const masterUserID = req.adminId;

  // Validate input
  if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
    return res.status(400).json({
      message: "emailIds must be a non-empty array",
    });
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    return res.status(400).json({
      message: "updateData must contain at least one field to update",
    });
  }

  console.log("Bulk edit emails request:", { emailIds, updateData });

  try {
    // Find emails to update (only user's own emails)
    const emailsToUpdate = await Email.findAll({
      where: {
        emailID: { [Sequelize.Op.in]: emailIds },
        masterUserID: masterUserID,
      },
    });

    if (emailsToUpdate.length === 0) {
      return res.status(404).json({
        message:
          "No emails found to update or you don't have permission to edit them",
      });
    }

    console.log(`Found ${emailsToUpdate.length} emails to update`);

    const updateResults = {
      successful: [],
      failed: [],
      skipped: [],
    };

    // Process each email
    for (const email of emailsToUpdate) {
      try {
        console.log(`Processing email ${email.emailID}`);

        // Update the email
        await email.update(updateData);

        updateResults.successful.push({
          emailID: email.emailID,
          subject: email.subject,
          sender: email.sender,
          folder: email.folder,
        });

        console.log(`Updated email ${email.emailID}`);
      } catch (emailError) {
        console.error(`Error updating email ${email.emailID}:`, emailError);

        updateResults.failed.push({
          emailID: email.emailID,
          subject: email.subject,
          error: emailError.message,
        });
      }
    }

    // Check for emails that were requested but not found
    const foundEmailIds = emailsToUpdate.map((email) => email.emailID);
    const notFoundEmailIds = emailIds.filter(
      (id) => !foundEmailIds.includes(id)
    );

    notFoundEmailIds.forEach((emailId) => {
      updateResults.skipped.push({
        emailID: emailId,
        reason: "Email not found or no permission to edit",
      });
    });

    console.log("Bulk update results:", updateResults);

    res.status(200).json({
      message: "Bulk edit operation completed",
      results: updateResults,
      summary: {
        total: emailIds.length,
        successful: updateResults.successful.length,
        failed: updateResults.failed.length,
        skipped: updateResults.skipped.length,
      },
    });
  } catch (error) {
    console.error("Error in bulk edit emails:", error);
    res.status(500).json({
      message: "Internal server error during bulk edit",
      error: error.message,
    });
  }
};

// Bulk delete emails
exports.bulkDeleteEmails = async (req, res) => {
  const { emailIds } = req.body;
  const masterUserID = req.adminId;

  // Validate input
  if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
    return res.status(400).json({
      message: "emailIds must be a non-empty array",
    });
  }

  console.log("Bulk delete emails request:", emailIds);

  try {
    // Find emails to delete (only user's own emails)
    const emailsToDelete = await Email.findAll({
      where: {
        emailID: { [Sequelize.Op.in]: emailIds },
        masterUserID: masterUserID,
      },
      attributes: ["emailID", "subject", "sender", "folder"],
    });

    if (emailsToDelete.length === 0) {
      return res.status(404).json({
        message:
          "No emails found to delete or you don't have permission to delete them",
      });
    }

    console.log(`Found ${emailsToDelete.length} emails to delete`);

    const deleteResults = {
      successful: [],
      failed: [],
      skipped: [],
    };

    // Process each email for deletion
    for (const email of emailsToDelete) {
      try {
        console.log(`Deleting email ${email.emailID}`);

        // Delete attachments first
        await Attachment.destroy({
          where: { emailID: email.emailID },
        });

        // Delete the email
        await Email.destroy({
          where: { emailID: email.emailID },
        });

        deleteResults.successful.push({
          emailID: email.emailID,
          subject: email.subject,
          sender: email.sender,
          folder: email.folder,
        });

        console.log(`Deleted email ${email.emailID}`);
      } catch (emailError) {
        console.error(`Error deleting email ${email.emailID}:`, emailError);

        deleteResults.failed.push({
          emailID: email.emailID,
          subject: email.subject,
          error: emailError.message,
        });
      }
    }

    // Check for emails that were requested but not found
    const foundEmailIds = emailsToDelete.map((email) => email.emailID);
    const notFoundEmailIds = emailIds.filter(
      (id) => !foundEmailIds.includes(id)
    );

    notFoundEmailIds.forEach((emailId) => {
      deleteResults.skipped.push({
        emailID: emailId,
        reason: "Email not found or no permission to delete",
      });
    });

    console.log("Bulk delete results:", deleteResults);

    res.status(200).json({
      message: "Bulk delete operation completed",
      results: deleteResults,
      summary: {
        total: emailIds.length,
        successful: deleteResults.successful.length,
        failed: deleteResults.failed.length,
        skipped: deleteResults.skipped.length,
      },
    });
  } catch (error) {
    console.error("Error in bulk delete emails:", error);
    res.status(500).json({
      message: "Internal server error during bulk delete",
      error: error.message,
    });
  }
};

// Bulk mark emails as read/unread
exports.bulkMarkEmails = async (req, res) => {
  const { emailIds, isRead } = req.body;
  const masterUserID = req.adminId;

  // Validate input
  if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
    return res.status(400).json({
      message: "emailIds must be a non-empty array",
    });
  }

  if (typeof isRead !== "boolean") {
    return res.status(400).json({
      message: "isRead must be a boolean value",
    });
  }

  console.log("Bulk mark emails request:", { emailIds, isRead });

  try {
    // Find emails to mark (only user's own emails)
    const emailsToMark = await Email.findAll({
      where: {
        emailID: { [Sequelize.Op.in]: emailIds },
        masterUserID: masterUserID,
      },
      attributes: ["emailID", "subject", "sender", "folder", "isRead"],
    });

    if (emailsToMark.length === 0) {
      return res.status(404).json({
        message:
          "No emails found to mark or you don't have permission to mark them",
      });
    }

    console.log(
      `Found ${emailsToMark.length} emails to mark as ${
        isRead ? "read" : "unread"
      }`
    );

    const markResults = {
      successful: [],
      failed: [],
      skipped: [],
    };

    // Process each email for marking
    for (const email of emailsToMark) {
      try {
        console.log(
          `Marking email ${email.emailID} as ${isRead ? "read" : "unread"}`
        );

        // Update the email read status
        await Email.update(
          { isRead: isRead },
          { where: { emailID: email.emailID } }
        );

        markResults.successful.push({
          emailID: email.emailID,
          subject: email.subject,
          sender: email.sender,
          folder: email.folder,
          previousStatus: email.isRead,
          newStatus: isRead,
        });

        console.log(
          `Marked email ${email.emailID} as ${isRead ? "read" : "unread"}`
        );
      } catch (emailError) {
        console.error(`Error marking email ${email.emailID}:`, emailError);

        markResults.failed.push({
          emailID: email.emailID,
          subject: email.subject,
          error: emailError.message,
        });
      }
    }

    // Check for emails that were requested but not found
    const foundEmailIds = emailsToMark.map((email) => email.emailID);
    const notFoundEmailIds = emailIds.filter(
      (id) => !foundEmailIds.includes(id)
    );

    notFoundEmailIds.forEach((emailId) => {
      markResults.skipped.push({
        emailID: emailId,
        reason: "Email not found or no permission to mark",
      });
    });

    console.log("Bulk mark results:", markResults);

    res.status(200).json({
      message: `Bulk mark as ${isRead ? "read" : "unread"} operation completed`,
      results: markResults,
      summary: {
        total: emailIds.length,
        successful: markResults.successful.length,
        failed: markResults.failed.length,
        skipped: markResults.skipped.length,
      },
    });
  } catch (error) {
    console.error("Error in bulk mark emails:", error);
    res.status(500).json({
      message: "Internal server error during bulk mark",
      error: error.message,
    });
  }
};

// Bulk move emails to folder
exports.bulkMoveEmails = async (req, res) => {
  const { emailIds, targetFolder } = req.body;
  const masterUserID = req.adminId;

  // Validate input
  if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
    return res.status(400).json({
      message: "emailIds must be a non-empty array",
    });
  }

  if (!targetFolder || typeof targetFolder !== "string") {
    return res.status(400).json({
      message: "targetFolder must be a non-empty string",
    });
  }

  // Validate folder name
  const validFolders = ["inbox", "sent", "drafts", "trash", "archive"];
  if (!validFolders.includes(targetFolder.toLowerCase())) {
    return res.status(400).json({
      message: `targetFolder must be one of: ${validFolders.join(", ")}`,
    });
  }

  console.log("Bulk move emails request:", { emailIds, targetFolder });

  try {
    // Find emails to move (only user's own emails)
    const emailsToMove = await Email.findAll({
      where: {
        emailID: { [Sequelize.Op.in]: emailIds },
        masterUserID: masterUserID,
      },
      attributes: ["emailID", "subject", "sender", "folder"],
    });

    if (emailsToMove.length === 0) {
      return res.status(404).json({
        message:
          "No emails found to move or you don't have permission to move them",
      });
    }

    console.log(
      `Found ${emailsToMove.length} emails to move to ${targetFolder}`
    );

    const moveResults = {
      successful: [],
      failed: [],
      skipped: [],
    };

    // Process each email for moving
    for (const email of emailsToMove) {
      try {
        console.log(
          `Moving email ${email.emailID} from ${email.folder} to ${targetFolder}`
        );

        // Update the email folder
        await Email.update(
          { folder: targetFolder },
          { where: { emailID: email.emailID } }
        );

        moveResults.successful.push({
          emailID: email.emailID,
          subject: email.subject,
          sender: email.sender,
          fromFolder: email.folder,
          toFolder: targetFolder,
        });

        console.log(`Moved email ${email.emailID} to ${targetFolder}`);
      } catch (emailError) {
        console.error(`Error moving email ${email.emailID}:`, emailError);

        moveResults.failed.push({
          emailID: email.emailID,
          subject: email.subject,
          error: emailError.message,
        });
      }
    }

    // Check for emails that were requested but not found
    const foundEmailIds = emailsToMove.map((email) => email.emailID);
    const notFoundEmailIds = emailIds.filter(
      (id) => !foundEmailIds.includes(id)
    );

    notFoundEmailIds.forEach((emailId) => {
      moveResults.skipped.push({
        emailID: emailId,
        reason: "Email not found or no permission to move",
      });
    });

    console.log("Bulk move results:", moveResults);

    res.status(200).json({
      message: `Bulk move to ${targetFolder} operation completed`,
      results: moveResults,
      summary: {
        total: emailIds.length,
        successful: moveResults.successful.length,
        failed: moveResults.failed.length,
        skipped: moveResults.skipped.length,
      },
    });
  } catch (error) {
    console.error("Error in bulk move emails:", error);
    res.status(500).json({
      message: "Internal server error during bulk move",
      error: error.message,
    });
  }
};

// Export the processEmailsLightweight function for testing
exports.processEmailsLightweight = (emails, userID, provider, strategy = 'NORMAL', page = 1, folderType = 'inbox') => 
  processEmailsLightweight(emails, userID, provider, strategy, page, folderType);
//hello