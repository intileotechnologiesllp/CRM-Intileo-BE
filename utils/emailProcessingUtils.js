/**
 * Email Processing Utilities
 * 
 * This file contains utility functions for processing email content,
 * including cleaning email bodies and replacing CID references.
 */

/**
 * Clean email body by removing unwanted content and replacing CID references
 * @param {string} body - The email body content
 * @param {Array} attachments - Array of attachment objects
 * @param {string} baseURL - Base URL for attachment links
 * @returns {string} Cleaned email body
 */
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
    if (trimmedLine.match(/^On .* wrote:$/) || 
        trimmedLine.match(/^From: .*/) ||
        trimmedLine.match(/^Sent: .*/) ||
        trimmedLine.match(/^Subject: .*/) ||
        trimmedLine.match(/^To: .*/)) {
      inQuotedSection = true;
    }
    
    // If we're not in a quoted section, preserve the line
    if (!inQuotedSection) {
      preservedLines.push(line);
    }
    
    // Reset quoted section detection if we encounter non-quoted content
    if (inQuotedSection && !trimmedLine.startsWith('>') && trimmedLine.length > 0) {
      // Check if this looks like new content (not part of the quoted section)
      if (!trimmedLine.match(/^(From|To|Sent|Subject|Date):/)) {
        inQuotedSection = false;
        preservedLines.push(line);
      }
    }
  }
  
  cleanedBody = preservedLines.join('\n');
  
  // Remove excessive line breaks (more than 2 consecutive)
  cleanedBody = cleanedBody.replace(/\n{3,}/g, '\n\n');
  
  // Remove common email client artifacts (but preserve useful content)
  cleanedBody = cleanedBody.replace(/\[cid:.*?\]/gi, ''); // Remove broken cid references
  
  // Clean up HTML if present (but preserve structure)
  if (cleanedBody.includes('<')) {
    // Remove style attributes but keep the tags
    cleanedBody = cleanedBody.replace(/style="[^"]*"/gi, '');
    
    // Remove empty paragraphs
    cleanedBody = cleanedBody.replace(/<p[^>]*>\s*<\/p>/gi, '');
    
    // Clean up excessive spaces in HTML
    cleanedBody = cleanedBody.replace(/\s+/g, ' ');
  }
  
  return cleanedBody.trim();
};

/**
 * Replace CID references with attachment URLs without removing other content
 * @param {string} body - The email body content
 * @param {Array} attachments - Array of attachment objects
 * @param {string} baseURL - Base URL for attachment links
 * @returns {string} Body with CID references replaced
 */
const replaceCidReferences = (body, attachments = [], baseURL = process.env.BASE_URL || 'http://localhost:3000') => {
  if (!body) return "";
  
  let processedBody = body;
  
  console.log(`[replaceCidReferences] 🔧 Processing body with ${attachments.length} attachments (PRESERVE MODE)`);
  
  // Only replace cid: references with actual attachment URLs
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
          const beforeReplace = processedBody.includes(`cid:${contentId}`);
          processedBody = processedBody.replace(cidPattern, attachmentUrl);
          
          if (beforeReplace) {
            console.log(`[replaceCidReferences] 🔗 Replaced cid:${contentId} with ${attachmentUrl}`);
          }
        }
      }
    });
  }
  
  return processedBody;
};

/**
 * Extract text content from HTML email body
 * @param {string} htmlBody - HTML email content
 * @returns {string} Plain text content
 */
const extractTextFromHtml = (htmlBody) => {
  if (!htmlBody) return '';
  
  // Simple HTML to text conversion
  let textContent = htmlBody
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Clean up excessive whitespace
  textContent = textContent
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  
  return textContent;
};

/**
 * Detect if content is HTML
 * @param {string} content - Content to check
 * @returns {boolean} True if content appears to be HTML
 */
const isHtmlContent = (content) => {
  if (!content) return false;
  
  // Check for HTML tags
  const htmlTagPattern = /<[^>]+>/;
  return htmlTagPattern.test(content);
};

/**
 * Clean and prepare email body for storage and display
 * @param {Object} bodyData - Object containing bodyHtml and/or bodyText
 * @param {Array} attachments - Array of attachment objects
 * @param {Object} options - Processing options
 * @returns {Object} Processed body data
 */
const processEmailBodyData = (bodyData, attachments = [], options = {}) => {
  const {
    shouldClean = true,
    preserveOriginal = false,
    baseURL = process.env.BASE_URL || 'http://localhost:3000'
  } = options;
  
  let processedBody = '';
  let contentType = 'empty';
  
  if (bodyData.bodyHtml) {
    contentType = 'html';
    if (preserveOriginal) {
      processedBody = replaceCidReferences(bodyData.bodyHtml, attachments, baseURL);
    } else if (shouldClean) {
      processedBody = cleanEmailBody(bodyData.bodyHtml, attachments, baseURL);
    } else {
      processedBody = bodyData.bodyHtml;
    }
  } else if (bodyData.bodyText) {
    contentType = 'text';
    if (preserveOriginal) {
      processedBody = replaceCidReferences(bodyData.bodyText, attachments, baseURL);
    } else if (shouldClean) {
      processedBody = cleanEmailBody(bodyData.bodyText, attachments, baseURL);
    } else {
      processedBody = bodyData.bodyText;
    }
  }
  
  return {
    processedBody,
    contentType,
    originalSize: (bodyData.bodyHtml || '').length + (bodyData.bodyText || '').length,
    processedSize: processedBody.length,
    hasImages: processedBody.includes('<img') || processedBody.includes('data:image/'),
    hasCidReferences: processedBody.includes('cid:'),
    hasHtml: !!bodyData.bodyHtml,
    hasText: !!bodyData.bodyText
  };
};

module.exports = {
  cleanEmailBody,
  replaceCidReferences,
  extractTextFromHtml,
  isHtmlContent,
  processEmailBodyData
};