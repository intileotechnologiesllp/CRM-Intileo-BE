const DefaultEmail = require("../../models/email/defaultEmailModel");
const Email = require("../../models/email/emailModel");
const { saveAttachments } = require("../../services/attachmentService");
const UserCredential = require("../../models/email/userCredentialModel");
const Imap = require("imap-simple");
// const Email = require("../../models/email/emailModel");
const { htmlToText } = require("html-to-text");
const { simpleParser } = require("mailparser");
const Attachment = require("../../models/email/attachmentModel");
const { format, subDays, subMonths, subYears } = require("date-fns"); // Use date-fns for date manipulation
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Sequelize = require("sequelize");
const { publishToQueue } = require("../../services/rabbitmqService");
const { Op } = require("sequelize");
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
  // Add more providers as needed
};

// Ensure signature upload directory exists
const signatureDir = path.join(__dirname, "../../uploads/signatures");
if (!fs.existsSync(signatureDir)) {
  fs.mkdirSync(signatureDir, { recursive: true });
  console.log(`[updateSignature] Created signatures directory: ${signatureDir}`);
}

// Configure storage for signature images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure directory exists before saving
    const uploadsDir = "uploads/signatures/";
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });
const cleanEmailBody = (body) => {
  if (!body) return "";

  // Pre-process to remove VML (Vector Markup Language) content that causes parsing issues
  let preprocessedBody = body;

  // Remove VML namespace tags (v:*, o:*) that cause selector parsing errors
  preprocessedBody = preprocessedBody.replace(/<v:[^>]*>.*?<\/v:[^>]*>/gis, "");
  preprocessedBody = preprocessedBody.replace(/<o:[^>]*>.*?<\/o:[^>]*>/gis, "");
  preprocessedBody = preprocessedBody.replace(/<v:[^>]*\/>/gis, "");
  preprocessedBody = preprocessedBody.replace(/<o:[^>]*\/>/gis, "");

  // First, use html-to-text for comprehensive HTML-to-text conversion
  const cleanText = htmlToText(preprocessedBody, {
    wordwrap: false,
    ignoreHref: true,
    ignoreImage: true,
    uppercaseHeadings: false,
    preserveNewlines: false,
    selectors: [
      // Remove style tags and their content
      { selector: "style", format: "skip" },
      // Remove script tags and their content
      { selector: "script", format: "skip" },
      // Remove tracking pixels and small images
      { selector: 'img[width="1"]', format: "skip" },
      { selector: 'img[height="1"]', format: "skip" },
      // Keep important content as text
      { selector: "a", options: { ignoreHref: true } },
      { selector: "div", format: "block" },
      { selector: "p", format: "block" },
      { selector: "br", format: "lineBreak" },
    ],
  });

  // Remove quoted replies (e.g., lines starting with ">")
  const withoutQuotes = cleanText
    .split("\n")
    .filter((line) => !line.startsWith(">"))
    .join("\n");

  // Additional cleanup for any remaining HTML entities or special characters
  const finalClean = withoutQuotes
    .replace(/&[a-zA-Z0-9#]+;/g, " ") // HTML entities
    .replace(/\s+/g, " ") // Multiple spaces
    .trim();

  return finalClean;
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

exports.createOrUpdateDefaultEmail = async (req, res) => {
  const masterUserID = req.adminId; // Assuming adminId is set in middleware
  const { email, appPassword, senderName, isDefault, provider } = req.body; // <-- add provider here
  const { DefaultEmail  } = require.models;
  try {
    // Validate input
    if (!email || !appPassword) {
      return res
        .status(400)
        .json({ message: "Email and appPassword are required." });
    }

    // If isDefault is true, unset isDefault for other accounts
    if (isDefault) {
      await DefaultEmail.update(
        { isDefault: false },
        { where: { masterUserID } }
      );
    }

    // Check if the email already exists
    const existingDefaultEmail = await DefaultEmail.findOne({
      where: { masterUserID, email },
    });

    const updateData = { appPassword, senderName, isDefault };
    if (provider) updateData.provider = provider; // <-- add this line

    if (existingDefaultEmail) {
      // Update existing default email
      await existingDefaultEmail.update(updateData);
      return res
        .status(200)
        .json({ message: "Default email updated successfully." });
    }

    // Create new default email
    await DefaultEmail.create({
      masterUserID,
      email,
      appPassword,
      senderName,
      isDefault,
      provider, // <-- add this line
    });

    res.status(201).json({ message: "Default email created successfully." });
  } catch (error) {
    console.error("Error creating or updating default email:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.getDefaultEmail = async (req, res) => {
  const masterUserID = req.adminId; // Assuming adminId is set in middleware
  const { DefaultEmail  } = req.models;
  try {
    // Fetch the default email for the user
    const defaultEmail = await DefaultEmail.findOne({
      where: { masterUserID },
    });

    if (!defaultEmail) {
      return res.status(200).json({ message: "Default email not set." });
    }

    res.status(200).json({
      message: "Default email fetched successfully.",
      email: defaultEmail.email,
      senderName: defaultEmail.senderName, // Include senderName in the response
      appPassword: defaultEmail.appPassword,
      isDefault: defaultEmail.isDefault, // You may want to exclude this in production
    });
  } catch (error) {
    console.error("Error fetching default email:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.updateDefaultEmail = async (req, res) => {
  const masterUserID = req.adminId; // Assuming adminId is set in middleware
  const { email, appPassword, senderName, isDefault } = req.body;
  const { DefaultEmail  } = require.models;
  try {
    // Check if the email exists
    const existingDefaultEmail = await DefaultEmail.findOne({
      where: { masterUserID },
    });

    if (!existingDefaultEmail) {
      return res.status(404).json({ message: "Default email not found." });
    }

    // If isDefault is true, unset isDefault for other accounts
    if (isDefault) {
      await DefaultEmail.update(
        { isDefault: false },
        { where: { masterUserID } }
      );
    }

    // Prepare the fields to update
    const updateData = {};
    if (email) updateData.email = email;
    if (appPassword) updateData.appPassword = appPassword;
    if (senderName) updateData.senderName = senderName;
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    // Update the default email
    await existingDefaultEmail.update(updateData);

    res.status(200).json({ message: "Default email updated successfully." });
  } catch (error) {
    console.error("Error updating default email:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.archiveEmail = async (req, res) => {
  const { emailId } = req.params; // Get the email ID from the request parameters
  const masterUserID = req.adminId; // Assuming adminId is set in middleware
  const { Email  } = require.models;
  try {
    // Find the email by emailId and masterUserID
    const email = await Email.findOne({
      where: { emailID: emailId, masterUserID },
    });

    if (!email) {
      return res.status(404).json({ message: "Email not found." });
    }

    // Update the folder to "archive"
    await email.update({ folder: "archive" });

    res.status(200).json({ message: "Email archived successfully." });
  } catch (error) {
    console.error("Error archiving email:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.bulkArchiveEmails = async (req, res) => {
  const masterUserID = req.adminId;
  const { emailIds } = req.body; // Array of email IDs
  const { Email  } = require.models;
  if (!Array.isArray(emailIds) || emailIds.length === 0) {
    return res
      .status(400)
      .json({ message: "emailIds must be a non-empty array." });
  }

  // Update all emails to move them to the archive folder
  const [updatedCount] = await Email.update(
    { folder: "archive" },
    { where: { emailID: emailIds, masterUserID } }
  );

  res.status(200).json({
    message: `${updatedCount} email(s) archived successfully.`,
  });
};

const extractFolders = (mailboxes, parent = "") => {
  const folders = [];
  for (const [key, value] of Object.entries(mailboxes)) {
    const folderName = parent ? `${parent}${value.delimiter}${key}` : key;
    if (!value.attribs.includes("\\Noselect")) {
      folders.push(folderName); // Add folder if it's selectable
    }
    if (value.children) {
      folders.push(...extractFolders(value.children, folderName)); // Recursively add child folders
    }
  }
  return folders;
};

// Mapping IMAP folder names to database folder names
const folderMapping = {
  INBOX: "inbox",
  "[Gmail]/Drafts": "drafts",
  "[Gmail]/Sent Mail": "sent",
  "[Gmail]/Trash": "archive",
  "[Gmail]/All Mail": "inbox", // Map "All Mail" to "inbox" for broader coverage
  "Sent": "sent", // Standard sent folder for most providers
  "Sent Items": "sent", // Outlook sent folder
  "Drafts": "drafts", // Standard drafts folder
  "Trash": "archive", // Standard trash folder
  "Deleted Items": "archive", // Outlook trash folder
  "Archive": "archive", // Standard archive folder
};

exports.queueSyncEmails = async (req, res) => {
  const masterUserID = req.adminId;
  const { syncStartDate, batchSize = 50 } = req.body; // Reduced default batch size for efficiency
  const { UserCredential  } = require.models;
  try {
    console.debug(
      `[queueSyncEmails] masterUserID: ${masterUserID} (type: ${typeof masterUserID}), syncStartDate: ${syncStartDate}, batchSize: ${batchSize}`
    );

    // Calculate and log how many days will be fetched
    let daysToFetch = 0;
    const finalSyncStartDate = syncStartDate || "3 days ago";
    
    try {
      let calculatedSinceDate;
      if (typeof finalSyncStartDate === "string" && finalSyncStartDate.includes("T")) {
        // If syncStartDate is an ISO date string
        calculatedSinceDate = new Date(finalSyncStartDate);
      } else if (finalSyncStartDate.includes("days ago")) {
        const days = parseInt(finalSyncStartDate.split(" ")[0], 10);
        calculatedSinceDate = subDays(new Date(), days);
        daysToFetch = days;
      } else if (finalSyncStartDate.includes("month")) {
        const months = parseInt(finalSyncStartDate.split(" ")[0], 10);
        calculatedSinceDate = subMonths(new Date(), months);
        daysToFetch = months * 30; // Approximate days
      } else if (finalSyncStartDate.includes("year")) {
        const years = parseInt(finalSyncStartDate.split(" ")[0], 10);
        calculatedSinceDate = subYears(new Date(), years);
        daysToFetch = years * 365; // Approximate days
      } else {
        calculatedSinceDate = new Date(finalSyncStartDate);
      }
      
      if (!isNaN(calculatedSinceDate.getTime())) {
        const now = new Date();
        const timeDiff = now.getTime() - calculatedSinceDate.getTime();
        daysToFetch = Math.ceil(timeDiff / (1000 * 3600 * 24)); // Convert milliseconds to days
        
        console.log(
          `[queueSyncEmails] 📅 Email sync range: ${daysToFetch} days (from ${calculatedSinceDate.toDateString()} to ${now.toDateString()})`
        );
        console.log(
          `[queueSyncEmails] 📊 Sync parameters: syncStartDate="${finalSyncStartDate}", calculated range=${daysToFetch} days, lightweight mode=true`
        );
      }
    } catch (dateError) {
      console.warn(`[queueSyncEmails] Could not calculate days to fetch: ${dateError.message}`);
    }

    // Early validation of masterUserID
    if (!masterUserID) {
      console.error(
        "[queueSyncEmails] ERROR: masterUserID is undefined or null!"
      );
      return res.status(400).json({ message: "User ID is required." });
    }
    
    // Fetch user credentials
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    if (!userCredential) {
      console.debug(
        `[queueSyncEmails] No user credentials found for masterUserID: ${masterUserID}`
      );
      return res.status(404).json({ message: "User credentials not found." });
    }
    const provider = userCredential.provider || "gmail";
    
    // Update sync start date in user credentials if provided
    if (syncStartDate) {
      await userCredential.update({ syncStartDate });
      console.debug(`[queueSyncEmails] Updated syncStartDate for user: ${syncStartDate}`);
    }
    console.log(
      `[queueSyncEmails] Queuing lightweight email sync job for masterUserID: ${masterUserID} (no body data)`
    );
    // Use user-specific sync queue for parallel processing similar to queueFetchInboxEmails
    const userSyncQueueName = `SYNC_EMAIL_QUEUE_${masterUserID}`;

    // Send a lightweight job to workers - let them handle all IMAP operations and batching
    await publishToQueue(userSyncQueueName, {
      masterUserID,
      email: userCredential.email,
      appPassword: userCredential.appPassword,
      batchSize: Math.min(parseInt(batchSize), 25), // Align with worker limits for efficiency
      syncStartDate: syncStartDate || userCredential.syncStartDate || "3 days ago",
      provider,
      imapHost: userCredential.imapHost,
      imapPort: userCredential.imapPort,
      imapTLS: userCredential.imapTLS,
      lightweightSync: true, // Flag to exclude body data during sync
      includeSentFolders: true, // Ensure sent folders are processed
      dynamicFetch: true, // Let workers handle all IMAP operations
      skipBodyData: true, // Explicitly skip loading email body content
    });

    console.log(
      `[queueSyncEmails] Successfully queued lightweight sync job to ${userSyncQueueName} - workers will process without body data`
    );

    return res.status(200).json({
      message: "Lightweight email sync job queued successfully. Workers will process emails from all folders without body data for improved performance.",
      queueName: userSyncQueueName,
      masterUserID,
      syncMode: "lightweight",
      bodyDataExcluded: true,
      sentFoldersIncluded: true,
      batchSize: Math.min(parseInt(batchSize), 25),
      folders: ["inbox", "sent", "drafts", "archive"], // Will be determined dynamically by workers
      syncStartDate: syncStartDate || userCredential.syncStartDate || "3 days ago",
      daysToFetch: daysToFetch > 0 ? daysToFetch : "Unable to calculate",
      estimatedDateRange: daysToFetch > 0 ? `${daysToFetch} days of email history` : "Date range calculation failed",
    });
  } catch (error) {
    console.error("[queueSyncEmails] Failed to queue sync job:", error);
    res
      .status(500)
      .json({ message: "Failed to queue sync job.", error: error.message });
  }
};

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

exports.fetchSyncEmails = async (req, res) => {
  const { batchSize = 100, page = 1, startUID, endUID, folder, skipBodyData = false } = req.query; // Accept startUID, endUID and folder for batching
  const masterUserID = req.adminId; // Assuming adminId is set in middleware
  const { syncStartDate: inputSyncStartDate, lightweightSync = false } = req.body; // or req.query.syncStartDate if you prefer
  const { UserCredential, Email  } = require.models;
  try {
    console.debug(
      `[fetchSyncEmails] masterUserID: ${masterUserID}, batchSize: ${batchSize}, page: ${page}, startUID: ${startUID}, endUID: ${endUID}, folder: ${folder}`
    );
    if (inputSyncStartDate) {
      await UserCredential.update(
        { syncStartDate: inputSyncStartDate },
        { where: { masterUserID } }
      );
    }
    // Fetch user credentials
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    if (!userCredential) {
      console.debug(
        `[fetchSyncEmails] No user credentials found for masterUserID: ${masterUserID}`
      );
      return res.status(404).json({ message: "User credentials not found." });
    }
    const userEmail = userCredential.email;
    const userPassword = userCredential.appPassword;
    const syncStartDate = userCredential.syncStartDate || "3 days ago"; // Default to "3 days ago" if invalid
    const syncFolders = userCredential.syncFolders || ["INBOX"]; // Default to "INBOX"
    const syncAllFolders = userCredential.syncAllFolders; // Check if all folders should be synced
    // Parse and calculate the `sinceDate` based on syncStartDate
    let sinceDate;
    if (typeof syncStartDate === "string" && syncStartDate.includes("T")) {
      // If syncStartDate is an ISO date string
      sinceDate = new Date(syncStartDate);
    } else if (syncStartDate.includes("days ago")) {
      const days = parseInt(syncStartDate.split(" ")[0], 10);
      sinceDate = subDays(new Date(), days);
    } else if (syncStartDate.includes("month")) {
      const months = parseInt(syncStartDate.split(" ")[0], 10);
      sinceDate = subMonths(new Date(), months);
    } else if (syncStartDate.includes("year")) {
      const years = parseInt(syncStartDate.split(" ")[0], 10);
      sinceDate = subYears(new Date(), years);
    } else {
      return res.status(400).json({ message: "Invalid syncStartDate format." });
    }
    // Validate sinceDate
    if (isNaN(sinceDate.getTime())) {
      throw new Error("Invalid sinceDate calculated from syncStartDate.");
    }
    const formattedSinceDate = format(sinceDate, "dd-MMM-yyyy"); // Format as "dd-MMM-yyyy" for IMAP
    const humanReadableSinceDate = `${format(sinceDate, "MMMM dd, yyyy")}`;
    
    // Calculate and log how many days of emails will be fetched
    const now = new Date();
    const timeDiff = now.getTime() - sinceDate.getTime();
    const daysToFetch = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    console.log(
      `[fetchSyncEmails] 📅 Email fetch range: ${daysToFetch} days (from ${humanReadableSinceDate} to ${format(now, "MMMM dd, yyyy")})`
    );
    console.debug(
      `[fetchSyncEmails] Fetching emails since ${humanReadableSinceDate} (${daysToFetch} days of history)`
    );
    // Connect to IMAP server
    const provider = userCredential.provider || "gmail"; // default to gmail
    let imapConfig;
    if (provider === "custom") {
      if (!userCredential.imapHost || !userCredential.imapPort) {
        console.debug(
          `[fetchSyncEmails] Custom IMAP settings missing for masterUserID: ${masterUserID}`
        );
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
    console.debug(
      `[fetchSyncEmails] Connecting to IMAP for user: ${userEmail}`
    );
    const connection = await Imap.connect(imapConfig);
    // Fetch all folders from the IMAP server
    const mailboxes = await connection.getBoxes();
    console.debug("[fetchSyncEmails] All folders from IMAP server:", mailboxes);
    // Extract all valid folder names, including nested folders
    const validFolders = extractFolders(mailboxes);
    console.debug(
      "[fetchSyncEmails] Valid folders from IMAP server:",
      validFolders
    );
    // Determine folders to sync - if folder is specified in queue message, use that specific folder
    let foldersToSync;
    if (folder) {
      // If a specific folder is provided from the queue message, use only that folder
      foldersToSync = [folder];
      console.debug(`[fetchSyncEmails] Processing specific folder from queue: ${folder}`);
    } else {
      // Original logic for when no specific folder is specified
      foldersToSync = Array.isArray(syncFolders) ? syncFolders : [syncFolders];
      if (syncAllFolders) {
        console.debug("[fetchSyncEmails] Fetching all folders...");
        foldersToSync = validFolders; // Use all valid folders
      } else {
        // Filter user-specified folders to include only valid folders
        foldersToSync = foldersToSync.filter((folder) =>
          validFolders.includes(folder)
        );
        
        // Always ensure important folders are included for comprehensive email sync
        // Support multiple providers with different folder naming conventions
        const providerImportantFolders = {
          gmail: ["INBOX", "[Gmail]/Sent Mail", "[Gmail]/Drafts"],
          yandex: ["INBOX", "Sent", "Drafts", "Sent Items"], // Yandex uses these folder names
          outlook: ["INBOX", "Sent Items", "Drafts"],
          custom: ["INBOX", "Sent", "Drafts", "Sent Items", "[Gmail]/Sent Mail"] // Support multiple possibilities for custom
        };
        
        const currentProvider = userCredential.provider || "gmail";
        const importantFolders = providerImportantFolders[currentProvider] || providerImportantFolders.gmail;
        
        console.log(`[fetchSyncEmails] 📂 SENT FOLDER DEBUG - Provider: ${currentProvider}`);
        console.log(`[fetchSyncEmails] 📂 SENT FOLDER DEBUG - Available folders on IMAP server:`, validFolders);
        console.log(`[fetchSyncEmails] 📂 SENT FOLDER DEBUG - User configured syncFolders:`, syncFolders);
        console.log(`[fetchSyncEmails] 📂 SENT FOLDER DEBUG - Current foldersToSync before auto-add:`, foldersToSync);
        console.log(`[fetchSyncEmails] 📂 SENT FOLDER DEBUG - Important folders for ${currentProvider}:`, importantFolders);
        
        for (const importantFolder of importantFolders) {
          if (validFolders.includes(importantFolder)) {
            if (!foldersToSync.includes(importantFolder)) {
              foldersToSync.push(importantFolder);
              console.log(`[fetchSyncEmails] ✅ SENT FOLDER DEBUG - Auto-added important folder for ${currentProvider}: ${importantFolder}`);
            } else {
              console.log(`[fetchSyncEmails] ℹ️ SENT FOLDER DEBUG - Important folder already included: ${importantFolder}`);
            }
          } else {
            console.log(`[fetchSyncEmails] ❌ SENT FOLDER DEBUG - Important folder NOT FOUND on IMAP server: ${importantFolder}`);
          }
        }
      }
    }
    // Debugging logs
    console.debug(
      "[fetchSyncEmails] User-specified folders to sync:",
      syncFolders
    );
    console.debug("[fetchSyncEmails] Filtered folders to sync:", foldersToSync);
    if (foldersToSync.length === 0) {
      console.debug("[fetchSyncEmails] No valid folders to sync.");
      return res.status(400).json({ message: "No valid folders to sync." });
    }
    console.debug("[fetchSyncEmails] Valid folders to sync:", foldersToSync);
    // Helper function to fetch emails from a specific folder
    const fetchEmailsFromFolder = async (folderName) => {
      const isSentFolder = folderName.toLowerCase().includes('sent');
      const folderLogPrefix = isSentFolder ? '📤 SENT FOLDER' : '📁';
      
      console.log(`[fetchSyncEmails] ${folderLogPrefix} Opening folder: ${folderName}...`);
      
      try {
        await connection.openBox(folderName);
        console.log(`[fetchSyncEmails] ${folderLogPrefix} Successfully opened folder: ${folderName}`);
      } catch (openError) {
        console.error(`[fetchSyncEmails] ${folderLogPrefix} ❌ Failed to open folder ${folderName}:`, openError.message);
        return; // Skip this folder if we can't open it
      }
      
      let searchCriteria;
      if (startUID && endUID) {
        // Use UID range for this batch
        searchCriteria = [["UID", `${startUID}:${endUID}`]];
      } else {
        searchCriteria = [["SINCE", formattedSinceDate]];
      }
      
      console.log(`[fetchSyncEmails] ${folderLogPrefix} Search criteria for ${folderName}:`, searchCriteria);
      
      // Configure fetch options based on whether body data should be excluded
      const shouldSkipBodyData = skipBodyData === 'true' || lightweightSync === true;
      const fetchOptions = shouldSkipBodyData ? 
        { bodies: ['HEADER'], struct: true } :  // Only fetch headers for lightweight sync
        { bodies: "", struct: true };           // Fetch full body for normal sync
      
      console.log(`[fetchSyncEmails] ${folderLogPrefix} Lightweight sync mode: ${shouldSkipBodyData ? 'enabled' : 'disabled'}`);
      
      let messages = [];
      try {
        messages = await connection.search(searchCriteria, fetchOptions);
        console.log(`[fetchSyncEmails] ${folderLogPrefix} ✅ Search successful - Total emails found in ${folderName}: ${messages.length}`);
      } catch (searchError) {
        console.error(`[fetchSyncEmails] ${folderLogPrefix} ❌ Search failed in folder ${folderName}:`, searchError.message);
        return; // Skip this folder if search fails
      }
      // No need for further pagination here, as batching is handled by UID range
      for (const message of messages) {
        let parsedEmail;
        
        if (shouldSkipBodyData) {
          // For lightweight sync, only parse headers
          const headerPart = message.parts.find((part) => part.which === "HEADER");
          if (!headerPart || !headerPart.body) {
            console.debug(
              `[fetchSyncEmails] No header found for email in folder: ${folderName}.`
            );
            continue;
          }
          // Handle different IMAP response formats for header data
          let headerData;
          if (Buffer.isBuffer(headerPart.body)) {
            headerData = headerPart.body;
          } else if (typeof headerPart.body === 'string') {
            headerData = Buffer.from(headerPart.body, 'utf8');
          } else if (headerPart.body && typeof headerPart.body === 'object') {
            // Header is already parsed as an object by IMAP library - extract fields directly
            const headers = headerPart.body;
            console.debug(`[fetchSyncEmails] Processing parsed header object with keys: ${Object.keys(headers).join(', ')}`);
            
            // Create a parsed email object manually from the header fields
            parsedEmail = {
              messageId: Array.isArray(headers['message-id']) ? headers['message-id'][0] : headers['message-id'] || null,
              subject: Array.isArray(headers.subject) ? headers.subject[0] : headers.subject || null,
              date: Array.isArray(headers.date) ? new Date(headers.date[0]) : (headers.date ? new Date(headers.date) : new Date()),
              from: null,
              to: null,
              cc: null,
              bcc: null,
              headers: {
                get: (key) => {
                  const value = headers[key.toLowerCase()];
                  return Array.isArray(value) ? value[0] : value;
                }
              }
            };
            
            // Parse FROM field
            if (headers.from) {
              const fromValue = Array.isArray(headers.from) ? headers.from[0] : headers.from;
              // Extract email and name from "Name <email>" format
              const fromMatch = fromValue.match(/^(.+?)\s*<(.+?)>$/) || [null, fromValue, fromValue];
              parsedEmail.from = {
                value: [{
                  name: fromMatch[1] ? fromMatch[1].replace(/"/g, '').trim() : null,
                  address: fromMatch[2] || fromValue
                }]
              };
            }
            
            // Parse TO field
            if (headers.to) {
              const toValue = Array.isArray(headers.to) ? headers.to : [headers.to];
              parsedEmail.to = {
                value: toValue.map(email => {
                  const match = email.match(/^(.+?)\s*<(.+?)>$/) || [null, email, email];
                  return {
                    name: match[1] ? match[1].replace(/"/g, '').trim() : null,
                    address: match[2] || email
                  };
                })
              };
            }
            
            // Parse CC field
            if (headers.cc) {
              const ccValue = Array.isArray(headers.cc) ? headers.cc : [headers.cc];
              parsedEmail.cc = {
                value: ccValue.map(email => {
                  const match = email.match(/^(.+?)\s*<(.+?)>$/) || [null, email, email];
                  return {
                    name: match[1] ? match[1].replace(/"/g, '').trim() : null,
                    address: match[2] || email
                  };
                })
              };
            }
            
            // Parse BCC field
            if (headers.bcc) {
              const bccValue = Array.isArray(headers.bcc) ? headers.bcc : [headers.bcc];
              parsedEmail.bcc = {
                value: bccValue.map(email => {
                  const match = email.match(/^(.+?)\s*<(.+?)>$/) || [null, email, email];
                  return {
                    name: match[1] ? match[1].replace(/"/g, '').trim() : null,
                    address: match[2] || email
                  };
                })
              };
            }
            
            console.debug(`[fetchSyncEmails] Successfully parsed header object for messageId: ${parsedEmail.messageId}, subject: ${parsedEmail.subject}`);
          } else {
            console.debug(`[fetchSyncEmails] Invalid header body type: ${typeof headerPart.body}`);
            continue;
          }
          
          // Skip simpleParser call when we already have parsed email from header object
          if (!parsedEmail) {
            parsedEmail = await simpleParser(headerData);
          }
        } else {
          // For normal sync, parse full body
          const rawBodyPart = message.parts.find((part) => part.which === "");
          const rawBody = rawBodyPart ? rawBodyPart.body : null;
          if (!rawBody) {
            console.debug(
              `[fetchSyncEmails] No body found for email in folder: ${folderName}.`
            );
            continue;
          }
          // Properly convert to Buffer for simpleParser
          console.debug(`[fetchSyncEmails] rawBody type: ${typeof rawBody}, isBuffer: ${Buffer.isBuffer(rawBody)}, constructor: ${rawBody?.constructor?.name}`);
          let bodyBuffer;
          if (Buffer.isBuffer(rawBody)) {
            bodyBuffer = rawBody;
          } else if (typeof rawBody === 'string') {
            bodyBuffer = Buffer.from(rawBody, 'utf8');
          } else if (rawBody && typeof rawBody === 'object') {
            // Try to convert object to string first, then to Buffer
            try {
              const bodyString = rawBody.toString();
              bodyBuffer = Buffer.from(bodyString, 'utf8');
            } catch (err) {
              console.debug(`[fetchSyncEmails] Failed to convert object to buffer: ${err.message}, object:`, rawBody);
              continue;
            }
          } else {
            console.debug(`[fetchSyncEmails] Invalid body type: ${typeof rawBody}`);
            continue;
          }
          parsedEmail = await simpleParser(bodyBuffer);
        }
        // Map IMAP folder name to database folder name
        const dbFolderName = folderMapping[folderName] || "inbox"; // Default to "inbox" if no mapping exists
        
        if (isSentFolder) {
          console.log(`[fetchSyncEmails] ${folderLogPrefix} 💾 Folder mapping: IMAP "${folderName}" -> DB "${dbFolderName}"`);
        }
        // Extract inReplyTo and references headers
        const referencesHeader = parsedEmail.headers.get("references");
        const references = Array.isArray(referencesHeader)
          ? referencesHeader.join(" ") // Convert array to string
          : referencesHeader || null;
        // Determine read/unread status from IMAP flags
        let isRead = false;
        if (message.attributes && Array.isArray(message.attributes.flags)) {
          isRead = message.attributes.flags.includes("\\Seen");
        }

        // Truncate messageId if it's too long for database column (typically 255 chars)
        let messageIdForDb = parsedEmail.messageId || null;
        if (messageIdForDb && messageIdForDb.length > 255) {
          messageIdForDb = messageIdForDb.substring(0, 255);
          console.debug(`[fetchSyncEmails] Truncated long messageId: ${parsedEmail.messageId.substring(0, 50)}...`);
        }

        // Extract UID from IMAP message attributes
        const extractedUID = message.uid || message.attributes?.uid || null;
        if (extractedUID) {
          console.debug(`[fetchSyncEmails] 🔍 UID EXTRACTED: ${extractedUID} for email ${messageIdForDb}`);
        } else {
          console.debug(`[fetchSyncEmails] ⚠️ UID NOT FOUND for email ${messageIdForDb} - message.uid: ${message.uid}, message.attributes?.uid: ${message.attributes?.uid}`);
        }

        const emailData = {
          messageId: messageIdForDb,
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
          masterUserID: masterUserID,
          subject: parsedEmail.subject || null,
          body: shouldSkipBodyData ? "" : cleanEmailBody(parsedEmail.html || parsedEmail.text || ""), // Skip body processing for lightweight sync
          folder: dbFolderName, // Use mapped folder name
          createdAt: parsedEmail.date || new Date(),
          isRead: isRead, // Save read/unread status
          uid: extractedUID, // Save IMAP UID for email body fetching and management
        };
        // Save email to the database
        const existingEmail = await Email.findOne({
          where: { messageId: emailData.messageId },
        });
        let savedEmail;
        if (!existingEmail) {
          try {
            savedEmail = await Email.create(emailData);
            if (isSentFolder) {
              console.log(`[fetchSyncEmails] ${folderLogPrefix} ✅ SENT EMAIL SAVED: ${emailData.messageId} | Subject: "${emailData.subject}" | Folder: "${emailData.folder}" | From: ${emailData.sender} | To: ${emailData.recipient} | UID: ${emailData.uid}`);
            } else {
              console.debug(`[fetchSyncEmails] Email saved: ${emailData.messageId} | UID: ${emailData.uid}`);
            }
          } catch (createError) {
            if (isSentFolder) {
              console.error(`[fetchSyncEmails] ${folderLogPrefix} ❌ FAILED TO SAVE SENT EMAIL ${emailData.messageId}:`, createError.message);
              console.error(`[fetchSyncEmails] ${folderLogPrefix} ❌ Email data that failed:`, {
                messageId: emailData.messageId,
                subject: emailData.subject,
                folder: emailData.folder,
                sender: emailData.sender,
                recipient: emailData.recipient,
                masterUserID: emailData.masterUserID
              });
            } else {
              console.error(`[fetchSyncEmails] Error creating email ${emailData.messageId}:`, createError);
            }
            continue; // Skip this email and continue with the next one
          }
        } else {
          // Email already exists - check if we need to update the folder for sent emails or add UID
          let needsUpdate = false;
          const updateData = {};
          
          if (isSentFolder && existingEmail.folder !== dbFolderName) {
            updateData.folder = dbFolderName;
            needsUpdate = true;
          }
          
          // Check if existing email needs UID update
          if (!existingEmail.uid && extractedUID) {
            updateData.uid = extractedUID;
            needsUpdate = true;
            console.log(`[fetchSyncEmails] 🔄 UID UPDATE NEEDED: Email ${emailData.messageId} - existing UID: ${existingEmail.uid}, new UID: ${extractedUID}`);
          }
          
          if (needsUpdate) {
            try {
              await existingEmail.update(updateData);
              if (isSentFolder) {
                console.log(`[fetchSyncEmails] ${folderLogPrefix} 🔄 SENT EMAIL UPDATED: ${emailData.messageId} | Subject: "${existingEmail.subject}" | Folder: "${existingEmail.folder}" -> "${dbFolderName}" | UID: ${existingEmail.uid} -> ${extractedUID}`);
              } else if (updateData.uid) {
                console.log(`[fetchSyncEmails] 🔄 UID UPDATED: Email ${emailData.messageId} now has UID ${extractedUID}`);
              }
              savedEmail = existingEmail;
            } catch (updateError) {
              console.error(`[fetchSyncEmails] ${folderLogPrefix} ❌ FAILED TO UPDATE EMAIL ${emailData.messageId}:`, updateError.message);
              savedEmail = existingEmail;
            }
          } else {
            if (isSentFolder) {
              console.log(`[fetchSyncEmails] ${folderLogPrefix} ℹ️ SENT EMAIL ALREADY EXISTS: ${emailData.messageId} | Subject: "${existingEmail.subject}" | Current folder: "${existingEmail.folder}" | UID: ${existingEmail.uid}`);
            } else {
              console.debug(`[fetchSyncEmails] Email already exists: ${emailData.messageId} | UID: ${existingEmail.uid}`);
            }
            savedEmail = existingEmail;
          }
        }

        // Save attachments if they exist and not in lightweight sync mode
        if (!shouldSkipBodyData && parsedEmail.attachments && parsedEmail.attachments.length > 0) {
          try {
            const savedAttachments = await saveAttachments(
              parsedEmail.attachments,
              savedEmail.emailID
            );
            console.debug(
              `[fetchSyncEmails] Saved ${savedAttachments.length} attachments for email: ${emailData.messageId}`
            );
          } catch (attachError) {
            console.error(
              `[fetchSyncEmails] Error saving attachments for email ${emailData.messageId}:`,
              attachError
            );
            // Continue processing even if attachment saving fails
          }
        } else if (shouldSkipBodyData) {
          console.debug(
            `[fetchSyncEmails] Skipped attachment processing for lightweight sync: ${emailData.messageId}`
          );
        }

        // Fetch the full thread recursively (skip for lightweight sync)
        if (!shouldSkipBodyData && emailData.messageId) {
          try {
            const fullThread = await getFullThread(emailData.messageId, Email);
            // Remove duplicates by messageId
            const uniqueThread = [];
            const seen = new Set();
            for (const em of fullThread) {
              if (!seen.has(em.messageId)) {
                uniqueThread.push(em);
                seen.add(em.messageId);
              }
            }
            // Sort by createdAt (oldest first)
            uniqueThread.sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            );
            // Optionally, you can log the thread for debugging
            console.debug(
              `[fetchSyncEmails] Full thread for messageId ${emailData.messageId}:`,
              uniqueThread.map((e) => e.messageId)
            );
            // You can now use uniqueThread as the full conversation
          } catch (threadError) {
            console.error(
              `[fetchSyncEmails] Error processing thread for email ${emailData.messageId}:`,
              threadError
            );
            // Continue processing even if thread processing fails
          }
        } else if (shouldSkipBodyData) {
          console.debug(
            `[fetchSyncEmails] Skipped thread processing for lightweight sync: ${emailData.messageId}`
          );
        }
      }
    };
    // Fetch emails from specified folders
    console.log(`[fetchSyncEmails] 📂 FINAL FOLDERS TO PROCESS: ${foldersToSync.length} folders`);
    console.log(`[fetchSyncEmails] 📂 FOLDERS LIST:`, foldersToSync);
    
    for (const folder of foldersToSync) {
      const isSentFolder = folder.toLowerCase().includes('sent');
      if (isSentFolder) {
        console.log(`[fetchSyncEmails] 📤 ⚡ PROCESSING SENT FOLDER: ${folder}`);
      }
      await fetchEmailsFromFolder(folder);
      if (isSentFolder) {
        console.log(`[fetchSyncEmails] 📤 ✅ COMPLETED PROCESSING SENT FOLDER: ${folder}`);
      }
    }
    connection.end();
    console.debug("[fetchSyncEmails] IMAP connection closed.");
    
    // Summary of processed folders
    const sentFoldersProcessed = foldersToSync.filter(f => f.toLowerCase().includes('sent'));
    console.log(`[fetchSyncEmails] 📊 PROCESSING SUMMARY:`);
    console.log(`[fetchSyncEmails] 📊 Total folders processed: ${foldersToSync.length}`);
    console.log(`[fetchSyncEmails] 📊 Sent folders processed: ${sentFoldersProcessed.length} - ${sentFoldersProcessed.join(', ')}`);
    console.log(`[fetchSyncEmails] 📊 All folders: ${foldersToSync.join(', ')}`);
    
    const shouldSkipBodyData = skipBodyData === 'true' || lightweightSync === true;
    res.status(200).json({
      message: shouldSkipBodyData ? 
        "Fetched and saved email metadata from specified folders (lightweight sync - body data excluded)." :
        "Fetched and saved emails from specified folders.",
      sinceDate: humanReadableSinceDate, // Include the human-readable date in the response
      batchSize: parseInt(batchSize, 10),
      page: parseInt(page, 10),
      startUID,
      endUID,
      folder, // Include the specific folder that was processed
      foldersProcessed: foldersToSync, // Include all folders that were processed
      lightweightSync: shouldSkipBodyData,
      bodyDataExcluded: shouldSkipBodyData,
      attachmentsSkipped: shouldSkipBodyData,
      threadingSkipped: shouldSkipBodyData,
    });
  } catch (error) {
    console.error("[fetchSyncEmails] Error fetching emails:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.fetchsyncdata = async (req, res) => {
  const masterUserID = req.adminId; // Assuming `adminId` is passed in the request (e.g., from middleware)
  const { UserCredential } = require.models;
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
      credential: userCredential, // Return all fields from the UserCredential model
    });
  } catch (error) {
    console.error("Error fetching user credentials:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Example restore API
exports.restoreEmails = async (req, res) => {
  const masterUserID = req.adminId;
  const { emailIds } = req.body; // Array of email IDs
  const { Email  } = require.models;

  if (!Array.isArray(emailIds) || emailIds.length === 0) {
    return res
      .status(400)
      .json({ message: "emailIds must be a non-empty array." });
  }

  // Restore all emails in trash to inbox (or originalFolder if you store it)
  const [updatedCount] = await Email.update(
    { folder: "inbox" }, // Or use originalFolder if you store it
    { where: { emailID: emailIds, masterUserID, folder: "trash" } }
  );

  res
    .status(200)
    .json({ message: `${updatedCount} email(s) restored from trash.` });
};

exports.permanentlyDeleteEmails = async (req, res) => {
  const masterUserID = req.adminId;
  const { emailIds } = req.body;
  const { Email  } = require.models;

  if (!Array.isArray(emailIds) || emailIds.length === 0) {
    return res
      .status(400)
      .json({ message: "emailIds must be a non-empty array." });
  }

  const deletedCount = await Email.destroy({
    where: { emailID: emailIds, masterUserID, folder: "trash" },
  });

  res
    .status(200)
    .json({ message: `${deletedCount} email(s) permanently deleted.` });
};

exports.markAsUnread = async (req, res) => {
  const masterUserID = req.adminId;
  const { emailIds } = req.body;
  const { UserCredential, Email  } = require.models;

  if (!Array.isArray(emailIds) || emailIds.length === 0) {
    return res
      .status(400)
      .json({ message: "emailIds must be a non-empty array." });
  }

  try {
    // Update database first
    const [updatedCount] = await Email.update(
      { isRead: false },
      { where: { emailID: emailIds, masterUserID } }
    );

    // Fetch email details to sync with IMAP server
    const emails = await Email.findAll({
      where: { emailID: emailIds, masterUserID },
      attributes: ['emailID', 'uid', 'folder', 'messageId']
    });

    // Get user credentials for IMAP connection
    const userCredential = await UserCredential.findOne({
      where: { masterUserID }
    });

    if (userCredential && userCredential.email && userCredential.appPassword) {
      // Detect provider from email
      const emailDomain = userCredential.email.split('@')[1].toLowerCase();
      let provider = 'gmail'; // default
      if (emailDomain.includes('yandex')) {
        provider = 'yandex';
      }

      const providerConfig = PROVIDER_CONFIG[provider];

      // Sync unread status with IMAP server for each email
      for (const email of emails) {
        if (email.uid) {
          try {
            const imapConfig = {
              imap: {
                user: userCredential.email,
                password: userCredential.appPassword,
                host: providerConfig.host,
                port: providerConfig.port,
                tls: providerConfig.tls,
                authTimeout: 10000,
                connTimeout: 10000,
                tlsOptions: {
                  rejectUnauthorized: false,
                  servername: providerConfig.host
                }
              },
            };

            const connection = await Imap.connect(imapConfig);
            
            // Determine folder name based on provider and folder type
            let folderName = 'INBOX';
            if (email.folder === 'sent') {
              folderName = provider === 'gmail' ? '[Gmail]/Sent Mail' : 'Sent';
            } else if (email.folder === 'drafts') {
              folderName = provider === 'gmail' ? '[Gmail]/Drafts' : 'Drafts';
            } else if (email.folder === 'trash') {
              folderName = provider === 'gmail' ? '[Gmail]/Trash' : 'Trash';
            } else if (email.folder === 'archive') {
              folderName = provider === 'gmail' ? '[Gmail]/All Mail' : 'Archive';
            }

            await connection.openBox(folderName);
            
            // Remove the \Seen flag to mark as unread
            await connection.delFlags(email.uid, ['\\Seen']);
            
            await connection.end();
            
            console.log(`✅ [IMAP SYNC] Marked email ${email.emailID} (UID: ${email.uid}) as unread on ${provider}`);
          } catch (imapError) {
            console.error(`❌ [IMAP SYNC] Failed to sync email ${email.emailID} with IMAP:`, imapError.message);
            // Continue with other emails even if one fails
          }
        }
      }
    }

    res
      .status(200)
      .json({ 
        message: `${updatedCount} email(s) marked as unread.`,
        syncedToIMAP: emails.filter(e => e.uid).length,
        totalEmails: updatedCount
      });
  } catch (error) {
    console.error('Error marking emails as unread:', error);
    res.status(500).json({ 
      message: 'Failed to mark emails as unread.', 
      error: error.message 
    });
  }
};

exports.markAsUnreadSingle = async (req, res) => {
  const masterUserID = req.adminId;
  const { emailID } = req.params;
  const { UserCredential, Email  } = require.models;

  if (!emailID) {
    return res.status(400).json({ message: "emailID is required." });
  }

  try {
    // Update database first
    const [updatedCount] = await Email.update(
      { isRead: false },
      { where: { emailID, masterUserID } }
    );

    if (updatedCount === 0) {
      return res
        .status(404)
        .json({ message: "Email not found or already unread." });
    }

    // Fetch email details to sync with IMAP server
    const email = await Email.findOne({
      where: { emailID, masterUserID },
      attributes: ['emailID', 'uid', 'folder', 'messageId']
    });

    let syncedToIMAP = false;

    if (email && email.uid) {
      // Get user credentials for IMAP connection
      const userCredential = await UserCredential.findOne({
        where: { masterUserID }
      });

      if (userCredential && userCredential.email && userCredential.appPassword) {
        try {
          // Detect provider from email
          const emailDomain = userCredential.email.split('@')[1].toLowerCase();
          let provider = 'gmail'; // default
          if (emailDomain.includes('yandex')) {
            provider = 'yandex';
          }

          const providerConfig = PROVIDER_CONFIG[provider];

          const imapConfig = {
            imap: {
              user: userCredential.email,
              password: userCredential.appPassword,
              host: providerConfig.host,
              port: providerConfig.port,
              tls: providerConfig.tls,
              authTimeout: 10000,
              connTimeout: 10000,
              tlsOptions: {
                rejectUnauthorized: false,
                servername: providerConfig.host
              }
            },
          };

          const connection = await Imap.connect(imapConfig);
          
          // Determine folder name based on provider and folder type
          let folderName = 'INBOX';
          if (email.folder === 'sent') {
            folderName = provider === 'gmail' ? '[Gmail]/Sent Mail' : 'Sent';
          } else if (email.folder === 'drafts') {
            folderName = provider === 'gmail' ? '[Gmail]/Drafts' : 'Drafts';
          } else if (email.folder === 'trash') {
            folderName = provider === 'gmail' ? '[Gmail]/Trash' : 'Trash';
          } else if (email.folder === 'archive') {
            folderName = provider === 'gmail' ? '[Gmail]/All Mail' : 'Archive';
          }

          await connection.openBox(folderName);
          
          // Remove the \Seen flag to mark as unread
          await connection.delFlags(email.uid, ['\\Seen']);
          
          await connection.end();
          
          syncedToIMAP = true;
          console.log(`✅ [IMAP SYNC] Marked email ${email.emailID} (UID: ${email.uid}) as unread on ${provider}`);
        } catch (imapError) {
          console.error(`❌ [IMAP SYNC] Failed to sync email ${email.emailID} with IMAP:`, imapError.message);
          // Don't fail the request if IMAP sync fails, just log it
        }
      }
    }

    res.status(200).json({ 
      message: "Email marked as unread.",
      syncedToIMAP: syncedToIMAP,
      emailID: emailID
    });
  } catch (error) {
    console.error('Error marking email as unread:', error);
    res
      .status(500)
      .json({ message: "Failed to mark as unread.", error: error.message });
  }
};

exports.updateSignature = async (req, res) => {
  const masterUserID = req.adminId;
  const { signature, signatureName } = req.body;
  const { UserCredential, Email  } = require.models;

  let signatureImage = req.body.signatureImage;

  // If an image was uploaded via multipart/form-data, use its path
  if (req.file) {
    // Verify the uploaded file exists
    const filePath = path.join(__dirname, "../../uploads/signatures", req.file.filename);
    if (!fs.existsSync(filePath)) {
      console.error(`[updateSignature] Uploaded file not found: ${filePath}`);
      return res.status(500).json({ 
        message: "Failed to save signature image. File not found after upload." 
      });
    }
    
    signatureImage = `${
      process.env.LOCALHOST_URL || "http://localhost:3056"
    }/uploads/signatures/${req.file.filename}`;
    
    console.log(`[updateSignature] Signature image uploaded successfully: ${signatureImage}`);
  } else if (signatureImage) {
    // If signatureImage is provided in the request body, validate it exists
    // Extract filename from URL (e.g., "http://localhost:3056/uploads/signatures/123.png" -> "123.png")
    const urlMatch = signatureImage.match(/\/uploads\/signatures\/([^\/]+)$/);
    if (urlMatch) {
      const filename = urlMatch[1];
      const filePath = path.join(__dirname, "../../uploads/signatures", filename);
      if (!fs.existsSync(filePath)) {
        console.warn(`[updateSignature] Signature image file not found: ${filePath}. Setting signatureImage to null.`);
        signatureImage = null; // Clear invalid image path
      }
    }
  }

  try {
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    if (!userCredential) {
      return res.status(404).json({ message: "User credentials not found." });
    }
    
    await userCredential.update({ signature, signatureName, signatureImage });
    
    res.status(200).json({ 
      message: "Signature updated successfully.",
      signature,
      signatureName,
      signatureImage
    });
  } catch (error) {
    console.error('[updateSignature] Error:', error);
    res
      .status(500)
      .json({ message: "Failed to update signature.", error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  const masterUserID = req.adminId;
  const { emailIds } = req.body;
  const { UserCredential, Email  } = require.models;

  if (!Array.isArray(emailIds) || emailIds.length === 0) {
    return res
      .status(400)
      .json({ message: "emailIds must be a non-empty array." });
  }

  try {
    // Update database first
    const [updatedCount] = await Email.update(
      { isRead: true },
      { where: { emailID: emailIds, masterUserID } }
    );

    // Fetch email details to sync with IMAP server
    const emails = await Email.findAll({
      where: { emailID: emailIds, masterUserID },
      attributes: ['emailID', 'uid', 'folder', 'messageId']
    });

    // Get user credentials for IMAP connection
    const userCredential = await UserCredential.findOne({
      where: { masterUserID }
    });

    if (userCredential && userCredential.email && userCredential.appPassword) {
      // Detect provider from email
      const emailDomain = userCredential.email.split('@')[1].toLowerCase();
      let provider = 'gmail'; // default
      if (emailDomain.includes('yandex')) {
        provider = 'yandex';
      }

      const providerConfig = PROVIDER_CONFIG[provider];

      // Sync read status with IMAP server for each email
      for (const email of emails) {
        if (email.uid) {
          try {
            const imapConfig = {
              imap: {
                user: userCredential.email,
                password: userCredential.appPassword,
                host: providerConfig.host,
                port: providerConfig.port,
                tls: providerConfig.tls,
                authTimeout: 10000,
                connTimeout: 10000,
                tlsOptions: {
                  rejectUnauthorized: false,
                  servername: providerConfig.host
                }
              },
            };

            const connection = await Imap.connect(imapConfig);
            
            // Determine folder name based on provider and folder type
            let folderName = 'INBOX';
            if (email.folder === 'sent') {
              folderName = provider === 'gmail' ? '[Gmail]/Sent Mail' : 'Sent';
            } else if (email.folder === 'drafts') {
              folderName = provider === 'gmail' ? '[Gmail]/Drafts' : 'Drafts';
            } else if (email.folder === 'trash') {
              folderName = provider === 'gmail' ? '[Gmail]/Trash' : 'Trash';
            } else if (email.folder === 'archive') {
              folderName = provider === 'gmail' ? '[Gmail]/All Mail' : 'Archive';
            }

            await connection.openBox(folderName);
            
            // Add the \Seen flag to mark as read
            await connection.addFlags(email.uid, ['\\Seen']);
            
            await connection.end();
            
            console.log(`✅ [IMAP SYNC] Marked email ${email.emailID} (UID: ${email.uid}) as read on ${provider}`);
          } catch (imapError) {
            console.error(`❌ [IMAP SYNC] Failed to sync email ${email.emailID} with IMAP:`, imapError.message);
            // Continue with other emails even if one fails
          }
        }
      }
    }

    res.status(200).json({ 
      message: `${updatedCount} email(s) marked as read.`,
      syncedToIMAP: emails.filter(e => e.uid).length,
      totalEmails: updatedCount
    });
  } catch (error) {
    console.error('Error marking emails as read:', error);
    res.status(500).json({ 
      message: 'Failed to mark emails as read.', 
      error: error.message 
    });
  }
};

exports.updateEmailSharing = async (req, res) => {
  const masterUserID = req.adminId; // Assuming adminId is set in middleware
  const { emailID } = req.params; // Email ID from URL
  const { isShared } = req.body; // Boolean value in request body
  const { Email } = require.models;

  try {
    const email = await Email.findOne({
      where: { emailID: emailID },
    });

    if (!email) {
      return res.status(404).json({ message: "Email not found." });
    }

    await email.update({ isShared: isShared === true || isShared === "true" });

    res.status(200).json({
      message: `Email sharing updated successfully.`,
      email: {
        emailID: email.emailID,
        isShared: email.isShared,
      },
    });
  } catch (error) {
    console.error("Error updating email sharing:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.setSmartBcc = async (req, res) => {
  const masterUserID = req.adminId;
  const { smartBcc } = req.body;
  const { UserCredential } = require.models;

  try {
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    if (!userCredential) {
      return res.status(404).json({ message: "User credentials not found." });
    }
    await userCredential.update({ smartBcc });
    res.status(200).json({ message: "Smart BCC updated successfully." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update Smart BCC.", error: error.message });
  }
};

exports.updateBlockedAddress = async (req, res) => {
  const masterUserID = req.adminId;
  const { blockedEmail } = req.body; // comma-separated string or array
  const { UserCredential, Email  } = require.models;

  try {
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    if (!userCredential) {
      return res.status(404).json({ message: "User credentials not found." });
    }

    // Always convert to array format for consistent storage
    let blockedEmailArray = [];
    
    // Helper function to clean and extract emails
    const cleanEmail = (email) => {
      if (typeof email !== 'string') return '';
      return email.trim().replace(/^["'\[\]]+|["'\[\]]+$/g, '').toLowerCase();
    };
    
    // Helper function to parse potentially nested JSON strings
    const parseEmailData = (data) => {
      if (Array.isArray(data)) {
        return data;
      }
      if (typeof data === 'string') {
        // Try to parse as JSON if it looks like JSON
        if (data.startsWith('[') && data.endsWith(']')) {
          try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [data];
          } catch (e) {
            // If parsing fails, treat as comma-separated string
            return data.split(',');
          }
        }
        // Regular comma-separated string
        return data.split(',');
      }
      return [];
    };
    
    const emailData = parseEmailData(blockedEmail);
    
    // Process each email, handling nested arrays and JSON strings
    for (let item of emailData) {
      if (typeof item === 'string' && (item.startsWith('[') || item.startsWith('"['))) {
        // Handle nested JSON string like "[\"email@test.com\"]"
        try {
          const nestedParsed = JSON.parse(item);
          if (Array.isArray(nestedParsed)) {
            for (let nestedItem of nestedParsed) {
              const cleaned = cleanEmail(nestedItem);
              if (cleaned && cleaned.includes('@')) {
                blockedEmailArray.push(cleaned);
              }
            }
          } else {
            const cleaned = cleanEmail(nestedParsed);
            if (cleaned && cleaned.includes('@')) {
              blockedEmailArray.push(cleaned);
            }
          }
        } catch (e) {
          // If parsing fails, clean the string directly
          const cleaned = cleanEmail(item);
          if (cleaned && cleaned.includes('@')) {
            blockedEmailArray.push(cleaned);
          }
        }
      } else {
        const cleaned = cleanEmail(item);
        if (cleaned && cleaned.includes('@')) {
          blockedEmailArray.push(cleaned);
        }
      }
    }
    
    // Remove duplicates
    blockedEmailArray = [...new Set(blockedEmailArray)];

    await userCredential.update({ blockedEmail: blockedEmailArray });
    res.status(200).json({ 
      message: "Blocked address list updated successfully.",
      blockedEmail: blockedEmailArray
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update blocked address.",
      error: error.message,
    });
  }
};

exports.removeBlockedAddress = async (req, res) => {
  const masterUserID = req.adminId;
  const { emailToRemove } = req.body; // The email address to remove
  const { UserCredential } = require.models;
  try {
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    if (!userCredential) {
      return res.status(404).json({ message: "User credentials not found." });
    }

    // Helper function to clean emails from nested JSON strings
    const cleanEmail = (email) => {
      if (typeof email !== 'string') return '';
      return email.trim().replace(/^["'\[\]]+|["'\[\]]+$/g, '').toLowerCase();
    };

    // Ensure blockedEmail is always an array and handle nested JSON
    let blockedList = [];
    if (Array.isArray(userCredential.blockedEmail)) {
      for (let item of userCredential.blockedEmail) {
        if (typeof item === 'string' && (item.startsWith('[') || item.startsWith('"['))) {
          // Handle nested JSON string like "[\"email@test.com\"]"
          try {
            const parsed = JSON.parse(item);
            if (Array.isArray(parsed)) {
              for (let nestedItem of parsed) {
                const cleaned = cleanEmail(nestedItem);
                if (cleaned && cleaned.includes('@')) {
                  blockedList.push(cleaned);
                }
              }
            } else {
              const cleaned = cleanEmail(parsed);
              if (cleaned && cleaned.includes('@')) {
                blockedList.push(cleaned);
              }
            }
          } catch (e) {
            const cleaned = cleanEmail(item);
            if (cleaned && cleaned.includes('@')) {
              blockedList.push(cleaned);
            }
          }
        } else {
          const cleaned = cleanEmail(item);
          if (cleaned && cleaned.includes('@')) {
            blockedList.push(cleaned);
          }
        }
      }
    } else if (
      typeof userCredential.blockedEmail === "string" &&
      userCredential.blockedEmail.length > 0
    ) {
      // Fallback for legacy comma-separated string
      blockedList = userCredential.blockedEmail
        .split(",")
        .map((e) => cleanEmail(e))
        .filter(Boolean);
    }

    // Clean the email to remove and normalize it
    const cleanEmailToRemove = cleanEmail(emailToRemove);

    // Remove the email (case-insensitive, trimmed, quotes removed)
    const updatedList = blockedList.filter((email) => email !== cleanEmailToRemove);

    await userCredential.update({ blockedEmail: updatedList });

    res.status(200).json({
      message:
        updatedList.length < blockedList.length
          ? "Blocked address removed successfully."
          : "Email not found in blocked list.",
      blockedEmail: updatedList,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to remove blocked address.",
      error: error.message,
    });
  }
};

exports.getSignature = async (req, res) => {
  const masterUserID = req.adminId;
  const { UserCredential } = require.models;
  try {
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    if (!userCredential) {
      return res.status(404).json({ message: "User credentials not found." });
    }

    // Validate signature image file exists if path is set
    let signatureImage = userCredential.signatureImage;
    if (signatureImage) {
      const urlMatch = signatureImage.match(/\/uploads\/signatures\/([^\/]+)$/);
      if (urlMatch) {
        const filename = urlMatch[1];
        const filePath = path.join(__dirname, "../../uploads/signatures", filename);
        if (!fs.existsSync(filePath)) {
          console.warn(`[getSignature] Signature image file not found: ${filePath}. Clearing from database.`);
          // Clear invalid image path from database
          await userCredential.update({ signatureImage: null });
          signatureImage = null;
        }
      }
    }

    res.status(200).json({
      message: "Signature data fetched successfully.",
      signature: userCredential.signature,
      signatureName: userCredential.signatureName,
      signatureImage: signatureImage,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch signature data.",
      error: error.message,
    });
  }
};

exports.deleteSignature = async (req, res) => {
  const masterUserID = req.adminId;
  const { UserCredential, Email  } = require.models;

  try {
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    if (!userCredential) {
      return res.status(404).json({ message: "User credentials not found." });
    }
    await userCredential.update({
      signature: null,
      signatureName: null,
      signatureImage: null,
    });
    res.status(200).json({ message: "Signature deleted successfully." });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete signature.",
      error: error.message,
    });
  }
};

exports.getBlockedAddress = async (req, res) => {
  const masterUserID = req.adminId;
  const { UserCredential } = require.models;
  try {
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    if (!userCredential) {
      return res.status(404).json({ message: "User credentials not found." });
    }

    // Helper function to clean emails from nested JSON strings
    const cleanEmail = (email) => {
      if (typeof email !== 'string') return '';
      return email.trim().replace(/^["'\[\]]+|["'\[\]]+$/g, '');
    };

    // Normalize the blocked email data to array format and clean quotes
    let blockedEmailArray = [];
    if (Array.isArray(userCredential.blockedEmail)) {
      for (let item of userCredential.blockedEmail) {
        if (typeof item === 'string' && (item.startsWith('[') || item.startsWith('"['))) {
          // Handle nested JSON string like "[\"email@test.com\"]"
          try {
            const parsed = JSON.parse(item);
            if (Array.isArray(parsed)) {
              for (let nestedItem of parsed) {
                const cleaned = cleanEmail(nestedItem);
                if (cleaned && cleaned.includes('@')) {
                  blockedEmailArray.push(cleaned);
                }
              }
            } else {
              const cleaned = cleanEmail(parsed);
              if (cleaned && cleaned.includes('@')) {
                blockedEmailArray.push(cleaned);
              }
            }
          } catch (e) {
            const cleaned = cleanEmail(item);
            if (cleaned && cleaned.includes('@')) {
              blockedEmailArray.push(cleaned);
            }
          }
        } else {
          const cleaned = cleanEmail(item);
          if (cleaned && cleaned.includes('@')) {
            blockedEmailArray.push(cleaned);
          }
        }
      }
    } else if (typeof userCredential.blockedEmail === "string" && userCredential.blockedEmail.length > 0) {
      blockedEmailArray = userCredential.blockedEmail
        .split(",")
        .map(email => cleanEmail(email))
        .filter(Boolean);
    }
    
    // Remove duplicates
    blockedEmailArray = [...new Set(blockedEmailArray)];

    res.status(200).json({
      message: "Blocked addresses fetched successfully.",
      blockedEmail: blockedEmailArray,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch blocked addresses.",
      error: error.message,
    });
  }
};

exports.getSmartBcc = async (req, res) => {
  const masterUserID = req.adminId;
  const { UserCredential  } = require.models;

  try {
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    if (!userCredential) {
      return res.status(404).json({ message: "User credentials not found." });
    }
    res.status(200).json({
      message: "Smart BCC fetched successfully.",
      smartBcc: userCredential.smartBcc,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch Smart BCC.", error: error.message });
  }
};

// GET /api/emails/autocomplete?search=abc&page=1&limit=10
exports.getEmailAutocomplete = async (req, res) => {
  const { search = "", page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { Email } = require.models;

  try {
    // Get all email records
    const emails = await Email.findAll({
      attributes: ['recipient'],
      raw: true,
      where: {
        recipient: {
          [Op.ne]: null, // Exclude null values
          [Op.ne]: '',   // Exclude empty strings
        }
      }
    });

    // Process all recipient strings into individual emails
    const allEmails = emails.flatMap(email => {
      try {
        // Additional safety check
        if (!email || !email.recipient || typeof email.recipient !== 'string') {
          return [];
        }
        
        return email.recipient
          .split(',')
          .map(e => e.trim())
          .filter(e => e && e !== '' && e.includes('@')); // Basic email validation
      } catch (error) {
        console.warn('Error processing recipient:', email, error);
        return [];
      }
    });

    // Remove duplicates
    const uniqueEmails = [...new Set(allEmails)];
    
    // Filter emails that start with the search term (case insensitive)
    let filteredEmails = uniqueEmails;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredEmails = uniqueEmails.filter(email => 
        email.toLowerCase().startsWith(searchLower)
      );
    }

    // Sort alphabetically
    filteredEmails.sort();

    // Apply pagination
    const paginatedEmails = filteredEmails.slice(offset, offset + parseInt(limit));

    res.status(200).json({
      emails: paginatedEmails,
      total: filteredEmails.length,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error("Error fetching emails:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch emails.", error: error.message });
  }
};

exports.downloadAttachment = async (req, res) => {
  const { emailID, filename } = req.query;
  const masterUserID = req.adminId;
  const { UserCredential, Email, Attachment  } = require.models;

  console.debug(
    `[downloadAttachment] emailID: ${emailID}, filename: ${filename}, masterUserID: ${masterUserID}`
  );

  // Provider-specific folder mapping
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

  try {
    // Find the email and attachment metadata
    const email = await Email.findOne({ where: { emailID } });
    if (!email) {
      console.debug(`[downloadAttachment] Email not found: ${emailID}`);
      return res.status(404).json({ message: "Email not found." });
    }

    const attachmentMeta = await Attachment.findOne({
      where: { emailID, filename },
    });
    if (!attachmentMeta) {
      console.debug(
        `[downloadAttachment] Attachment not found: ${filename} for emailID: ${emailID}`
      );
      return res.status(404).json({ message: "Attachment not found." });
    }

    // Fetch user credentials
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    if (!userCredential) {
      console.debug(
        `[downloadAttachment] User credentials not found for masterUserID: ${masterUserID}`
      );
      return res.status(404).json({ message: "User credentials not found." });
    }

    // Connect to IMAP and fetch the email
    const provider = userCredential.provider || "gmail"; // default to gmail

    let imapConfig;
    if (provider === "custom") {
      if (!userCredential.imapHost || !userCredential.imapPort) {
        console.debug(
          `[downloadAttachment] Custom IMAP settings missing for masterUserID: ${masterUserID}`
        );
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
        },
      };
    } else {
      const providerConfig = PROVIDER_CONFIG[provider];
      console.debug(
        `[downloadAttachment] Using provider config: host=${providerConfig.host}, port=${providerConfig.port}, tls=${providerConfig.tls}`
      );
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

    // Map internal folder name to provider-specific IMAP folder name
    let imapFolder = email.folder;
    if (
      PROVIDER_FOLDER_MAP[provider] &&
      PROVIDER_FOLDER_MAP[provider][email.folder]
    ) {
      imapFolder = PROVIDER_FOLDER_MAP[provider][email.folder];
    }

    const connection = await Imap.connect(imapConfig);
    await connection.openBox(imapFolder);

    // Debug logging
    console.debug(
      `[downloadAttachment] Searching for messageId: ${email.messageId} in folder: ${imapFolder}`
    );

    // Search for the email by messageId
    let messages = [];
    let messageIdSearchFailed = false;
    try {
      const searchCriteria = [["HEADER", "MESSAGE-ID", email.messageId]];
      const fetchOptions = { bodies: "", struct: true };
      messages = await connection.search(searchCriteria, fetchOptions);
      console.debug(
        `[downloadAttachment] IMAP search by messageId found ${messages.length} messages.`
      );
    } catch (err) {
      console.error(
        "[downloadAttachment] IMAP search by messageId failed:",
        err
      );
      messageIdSearchFailed = true;
    }

    // Always perform a deep scan if messageId search fails or returns no results
    let foundAttachment = null;
    let foundMessage = null;
    let deepScanLog = [];
    if (messageIdSearchFailed || !messages || !messages.length) {
      console.warn(
        "[downloadAttachment] MessageId search failed or returned no results, performing deep scan of all emails in folder."
      );
      try {
        const fetchOptions = { bodies: "", struct: true };
        const allMessages = await connection.search(["ALL"], fetchOptions);
        console.debug(
          `[downloadAttachment] Deep scan: total messages in folder: ${allMessages.length}`
        );
        for (const msg of allMessages) {
          const rawBodyPart = msg.parts.find((part) => part.which === "");
          const rawBody = rawBodyPart ? rawBodyPart.body : null;
          if (!rawBody) continue;
          const parsedEmail = await simpleParser(rawBody);
          // Log messageId and all attachment filenames for diagnostics
          const msgId = parsedEmail.messageId || null;
          const attNames = (parsedEmail.attachments || []).map(
            (a) => a.filename
          );
          deepScanLog.push({
            uid: msg.attributes.uid,
            messageId: msgId,
            attachments: attNames,
          });
          if (attNames.includes(filename)) {
            foundAttachment = parsedEmail.attachments.find(
              (a) => a.filename === filename
            );
            foundMessage = msg;
            console.debug(
              `[downloadAttachment] Deep scan: found attachment in message UID ${msg.attributes.uid}`
            );
            break;
          }
        }
        // Log all messageIds and attachment filenames found during the deep scan
        console.debug(
          "[downloadAttachment] Deep scan log:",
          JSON.stringify(deepScanLog, null, 2)
        );
        if (!foundAttachment) {
          connection.end();
          return res.status(404).json({
            message: "Attachment not found in any email in folder (deep scan).",
            deepScanLog,
          });
        }
      } catch (deepErr) {
        console.error("[downloadAttachment] Deep scan failed:", deepErr);
        connection.end();
        return res.status(500).json({
          message: "Deep scan failed.",
          error: deepErr.message,
        });
      }
    }

    // Parse the email and find the attachment (normal or fallback)
    let attachment;
    if (foundAttachment) {
      attachment = foundAttachment;
    } else {
      const rawBodyPart = messages[0].parts.find((part) => part.which === "");
      const rawBody = rawBodyPart ? rawBodyPart.body : null;
      const parsedEmail = await simpleParser(rawBody);
      attachment = parsedEmail.attachments.find(
        (att) => att.filename === filename
      );
      if (!attachment) {
        connection.end();
        console.debug(
          `[downloadAttachment] Attachment not found in email (after messageId search): ${filename}`
        );
        return res.status(404).json({
          message: "Attachment not found in email (after messageId search).",
        });
      }
    }

    // Send the attachment as a download (in-memory, not saved to disk)
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${attachment.filename}"`
    );
    res.setHeader("Content-Type", attachment.contentType);
    res.send(attachment.content);

    connection.end();
    console.debug(
      `[downloadAttachment] Attachment sent: ${attachment.filename}`
    );
  } catch (error) {
    console.error("[downloadAttachment] Error downloading attachment:", error);
    res.status(500).json({
      message: "Failed to download attachment.",
      error: error.message,
    });
  }
};

// Diagnostic endpoint for attachment download issues
// Test endpoint to verify sent folder detection
exports.testSentFolderDetection = async (req, res) => {
  const masterUserID = req.adminId;
  const { UserCredential } = require.models;

  try {
    // Fetch user credentials
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    
    if (!userCredential) {
      return res.status(404).json({ message: "User credentials not found." });
    }

    const provider = userCredential.provider || "gmail";
    let imapConfig;
    
    if (provider === "custom") {
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

    // Connect and get all folders
    console.debug(`[testSentFolderDetection] Connecting to IMAP for user: ${userCredential.email}`);
    const connection = await Imap.connect(imapConfig);

    // Get all folders from the IMAP server
    const mailboxes = await connection.getBoxes();
    const validFolders = extractFolders(mailboxes);
    
    // Identify sent folders
    const sentFolders = validFolders.filter(folder => 
      folder.toLowerCase().includes('sent') || 
      folder === '[Gmail]/Sent Mail' ||
      folder === 'Sent Items'
    );
    
    await connection.end();

    res.status(200).json({
      message: "Sent folder detection test completed",
      userEmail: userCredential.email,
      provider,
      allFolders: validFolders,
      sentFolders: sentFolders,
      sentFoldersCount: sentFolders.length,
      folderMapping: sentFolders.reduce((acc, folder) => {
        acc[folder] = folderMapping[folder] || "sent";
        return acc;
      }, {})
    });
    
  } catch (error) {
    console.error("[testSentFolderDetection] Error:", error);
    res.status(500).json({ 
      message: "Test failed", 
      error: error.message 
    });
  }
};

// Test endpoint to verify queueSyncEmails functionality
exports.testQueueSyncEmails = async (req, res) => {
  const masterUserID = req.adminId;
  const { UserCredential, Email, Attachment  } = require.models;

  try {
    // Fetch user credentials
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    
    if (!userCredential) {
      return res.status(404).json({ message: "User credentials not found." });
    }

    const provider = userCredential.provider || "gmail";
    let imapConfig;
    
    if (provider === "custom") {
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

    // Connect and test folder access
    console.debug(`[testQueueSyncEmails] Connecting to test IMAP for user: ${userCredential.email}`);
    const connection = await Imap.connect(imapConfig);

    // Get all folders from the IMAP server
    const mailboxes = await connection.getBoxes();
    const validFolders = extractFolders(mailboxes);
    
    // Test each important folder
    const testResults = {};
    const importantFolders = ["INBOX", "[Gmail]/Sent Mail", "[Gmail]/Drafts"];
    
    for (const folderName of importantFolders) {
      if (validFolders.includes(folderName)) {
        try {
          await connection.openBox(folderName);
          
          // Count recent emails (last 7 days)
          const sinceDate = subDays(new Date(), 7);
          const formattedSinceDate = format(sinceDate, "dd-MMM-yyyy");
          const searchCriteria = [["SINCE", formattedSinceDate]];
          const messages = await connection.search(searchCriteria, { bodies: [], struct: true });
          
          testResults[folderName] = {
            accessible: true,
            recentEmailCount: messages.length,
            dbFolderName: folderMapping[folderName] || "inbox"
          };
        } catch (error) {
          testResults[folderName] = {
            accessible: false,
            error: error.message
          };
        }
      } else {
        testResults[folderName] = {
          accessible: false,
          error: "Folder not found in server"
        };
      }
    }

    await connection.end();

    res.status(200).json({
      message: "queueSyncEmails test completed",
      userEmail: userCredential.email,
      provider,
      validFolders,
      folderTests: testResults,
      syncSettings: {
        syncFolders: userCredential.syncFolders,
        syncAllFolders: userCredential.syncAllFolders,
        syncStartDate: userCredential.syncStartDate
      }
    });
    
  } catch (error) {
    console.error("[testQueueSyncEmails] Error:", error);
    res.status(500).json({ 
      message: "Test failed", 
      error: error.message 
    });
  }
};

exports.diagnoseAttachment = async (req, res) => {
  // Use query parameters for GET endpoint
  const { emailID, filename } = req.query;
  const masterUserID = req.adminId;
  const { UserCredential, Email, Attachment  } = require.models;
  
  const diagnostics = [];
  diagnostics.push({ step: "start", emailID, filename, masterUserID });

  // Provider-specific folder mapping
  const PROVIDER_FOLDER_MAP = {
    gmail: {
      inbox: "INBOX",
      drafts: "Drafts",
      sent: "Sent",
      archive: "Archive",
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

  try {
    const email = await Email.findOne({ where: { emailID } });
    if (!email) {
      diagnostics.push({ step: "email_not_found", emailID });
      return res.status(404).json({ diagnostics, message: "Email not found." });
    }
    diagnostics.push({
      step: "email_found",
      folder: email.folder,
      messageId: email.messageId,
    });
    const attachmentMeta = await Attachment.findOne({
      where: { emailID, filename },
    });
    if (!attachmentMeta) {
      diagnostics.push({ step: "attachment_not_found_in_db", filename });
      return res
        .status(404)
        .json({ diagnostics, message: "Attachment not found." });
    }
    diagnostics.push({ step: "attachment_meta_found" });
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    if (!userCredential) {
      diagnostics.push({ step: "user_credential_not_found", masterUserID });
      return res
        .status(404)
        .json({ diagnostics, message: "User credentials not found." });
    }
    diagnostics.push({
      step: "user_credential_found",
      provider: userCredential.provider,
    });
    const provider = userCredential.provider || "gmail";
    let imapConfig;
    if (provider === "custom") {
      if (!userCredential.imapHost || !userCredential.imapPort) {
        diagnostics.push({ step: "custom_imap_settings_missing" });
        return res.status(400).json({
          diagnostics,
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
        },
      };
    } else {
      const providerConfig = PROVIDER_CONFIG[provider];
      diagnostics.push({ step: "provider_config", providerConfig });
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
    // Map internal folder name to provider-specific IMAP folder name
    let imapFolder = email.folder;
    if (
      PROVIDER_FOLDER_MAP[provider] &&
      PROVIDER_FOLDER_MAP[provider][email.folder]
    ) {
      imapFolder = PROVIDER_FOLDER_MAP[provider][email.folder];
    }
    const connection = await Imap.connect(imapConfig);
    await connection.openBox(imapFolder);
    diagnostics.push({ step: "opened_folder", folder: imapFolder });
    let messages = [];
    let messageIdSearchFailed = false;
    try {
      const searchCriteria = [["HEADER", "MESSAGE-ID", email.messageId]];
      const fetchOptions = { bodies: "", struct: true };
      messages = await connection.search(searchCriteria, fetchOptions);
      diagnostics.push({
        step: "imap_search_by_messageid",
        found: messages.length,
      });
    } catch (err) {
      diagnostics.push({
        step: "imap_search_by_messageid_failed",
        error: err.message,
      });
      messageIdSearchFailed = true;
    }
    // Always perform a deep scan if messageId search fails (or returns 0)
    if (messageIdSearchFailed || !messages || !messages.length) {
      diagnostics.push({ step: "deep_scan_triggered" });
      try {
        const fetchOptions = { bodies: "", struct: true };
        const allMessages = await connection.search(["ALL"], fetchOptions);
        diagnostics.push({
          step: "deep_scan_total_messages",
          count: allMessages.length,
        });
        let foundAttachment = null;
        let foundMessage = null;
        const deepScanLog = [];
        for (const msg of allMessages) {
          const rawBodyPart = msg.parts.find((part) => part.which === "");
          const rawBody = rawBodyPart ? rawBodyPart.body : null;
          if (!rawBody) continue;
          const parsedEmail = await simpleParser(rawBody);
          // Log messageId and all attachment filenames for diagnostics
          const msgId = parsedEmail.messageId || null;
          const attNames = (parsedEmail.attachments || []).map(
            (a) => a.filename
          );
          deepScanLog.push({
            uid: msg.attributes.uid,
            messageId: msgId,
            attachments: attNames,
          });
          if (attNames.includes(filename)) {
            foundAttachment = parsedEmail.attachments.find(
              (a) => a.filename === filename
            );
            foundMessage = msg;
            diagnostics.push({
              step: "deep_fallback_found",
              uid: msg.attributes.uid,
              messageId: msgId,
              attachments: attNames,
            });
            break;
          }
        }
        diagnostics.push({ step: "deep_scan_log", scanned: deepScanLog });
        if (!foundAttachment) {
          connection.end();
          diagnostics.push({ step: "deep_fallback_not_found" });
          return res.status(404).json({
            diagnostics,
            message:
              "Attachment not found in any email in folder (deep fallback).",
          });
        }
        connection.end();
        diagnostics.push({ step: "imap_connection_closed" });
        return res.status(200).json({
          diagnostics,
          message: "Attachment found in deep scan.",
          filename: foundAttachment.filename,
        });
      } catch (deepErr) {
        diagnostics.push({
          step: "deep_fallback_failed",
          error: deepErr.message,
        });
        connection.end();
        return res.status(500).json({
          diagnostics,
          message: "Deep scan failed.",
          error: deepErr.message,
        });
      }
    }
    // If messageId search succeeded, check for attachment in that message
    let attachment;
    const rawBodyPart = messages[0].parts.find((part) => part.which === "");
    const rawBody = rawBodyPart ? rawBodyPart.body : null;
    const parsedEmail = await simpleParser(rawBody);
    attachment = parsedEmail.attachments.find(
      (att) => att.filename === filename
    );
    if (!attachment) {
      connection.end();
      diagnostics.push({ step: "attachment_not_found_after_messageid_search" });
      return res.status(404).json({
        diagnostics,
        message: "Attachment not found in email (after messageId search).",
      });
    }
    diagnostics.push({
      step: "attachment_found",
      filename: attachment.filename,
    });
    connection.end();
    diagnostics.push({ step: "imap_connection_closed" });
    res
      .status(200)
      .json({ diagnostics, message: "Attachment diagnostics complete." });
  } catch (error) {
    diagnostics.push({ step: "error", error: error.message });
    res.status(500).json({
      diagnostics,
      message: "Failed to diagnose attachment.",
      error: error.message,
    });
  }
};
