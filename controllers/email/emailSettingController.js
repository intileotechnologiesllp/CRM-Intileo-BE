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
// Configure storage for signature images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/signatures/"); // Make sure this folder exists
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
  "[Gmail]/All Mail": "inbox", // Map "All Mail" to "archive"
};

exports.queueSyncEmails = async (req, res) => {
  const masterUserID = req.adminId;
  const { syncStartDate, batchSize = 100 } = req.body;

  try {
    console.debug(
      `[queueSyncEmails] masterUserID: ${masterUserID}, syncStartDate: ${syncStartDate}, batchSize: ${batchSize}`
    );
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
    const userEmail = userCredential.email;
    const userPassword = userCredential.appPassword;
    const provider = userCredential.provider || "gmail";
    let imapConfig;
    if (provider === "custom") {
      if (!userCredential.imapHost || !userCredential.imapPort) {
        console.debug(
          `[queueSyncEmails] Custom IMAP settings missing for masterUserID: ${masterUserID}`
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
    // Connect to IMAP and open INBOX (or use syncFolders if you want all folders)
    console.debug(
      `[queueSyncEmails] Connecting to IMAP for user: ${userEmail}`
    );
    const connection = await Imap.connect(imapConfig);
    await connection.openBox("INBOX");
    // Calculate sinceDate for IMAP search
    let sinceDate;
    if (
      syncStartDate &&
      typeof syncStartDate === "string" &&
      syncStartDate.includes("T")
    ) {
      sinceDate = new Date(syncStartDate);
    } else if (syncStartDate && syncStartDate.includes("days ago")) {
      const days = parseInt(syncStartDate.split(" ")[0], 10);
      sinceDate = subDays(new Date(), days);
    } else if (syncStartDate && syncStartDate.includes("month")) {
      const months = parseInt(syncStartDate.split(" ")[0], 10);
      sinceDate = subMonths(new Date(), months);
    } else if (syncStartDate && syncStartDate.includes("year")) {
      const years = parseInt(syncStartDate.split(" ")[0], 10);
      sinceDate = subYears(new Date(), years);
    } else {
      sinceDate = subDays(new Date(), 3); // Default to 3 days ago
    }
    const formattedSinceDate = format(sinceDate, "dd-MMM-yyyy");
    console.debug(`[queueSyncEmails] IMAP search since: ${formattedSinceDate}`);
    // Search for all UIDs in the date range
    const searchCriteria = [["SINCE", formattedSinceDate]];
    const fetchOptions = { bodies: [], struct: true };
    const messages = await connection.search(searchCriteria, fetchOptions);
    const uids = messages.map((msg) => msg.attributes.uid);
    console.debug(`[queueSyncEmails] Found ${uids.length} UIDs to sync.`);
    await connection.end();
    // Batching
    const totalEmails = uids.length;
    const numBatches = Math.ceil(totalEmails / batchSize);
    if (numBatches === 0) {
      console.debug(`[queueSyncEmails] No emails to sync.`);
      return res.status(200).json({ message: "No emails to sync." });
    }
    for (let i = 0; i < numBatches; i++) {
      const startIdx = i * batchSize;
      const endIdx = Math.min(startIdx + parseInt(batchSize), totalEmails);
      const batchUIDs = uids.slice(startIdx, endIdx);
      if (batchUIDs.length === 0) continue;
      const startUID = batchUIDs[0];
      const endUID = batchUIDs[batchUIDs.length - 1];
      console.debug(
        `[queueSyncEmails] Queueing batch ${
          i + 1
        }/${numBatches}: startUID=${startUID}, endUID=${endUID}`
      );
      await publishToQueue("SYNC_EMAIL_QUEUE", {
        masterUserID,
        syncStartDate,
        batchSize,
        startUID,
        endUID,
      });
    }
    res.status(200).json({
      message: `Sync jobs queued: ${numBatches} batches for ${totalEmails} emails.`,
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
  const { batchSize = 100, page = 1, startUID, endUID } = req.query; // Accept startUID and endUID for batching
  const masterUserID = req.adminId; // Assuming adminId is set in middleware
  const { syncStartDate: inputSyncStartDate } = req.body; // or req.query.syncStartDate if you prefer
  try {
    console.debug(
      `[fetchSyncEmails] masterUserID: ${masterUserID}, batchSize: ${batchSize}, page: ${page}, startUID: ${startUID}, endUID: ${endUID}`
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
    console.debug(
      `[fetchSyncEmails] Fetching emails since ${humanReadableSinceDate}`
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
    // Fetch all folders if syncAllFolders is true
    let foldersToSync = Array.isArray(syncFolders)
      ? syncFolders
      : [syncFolders];
    if (syncAllFolders) {
      console.debug("[fetchSyncEmails] Fetching all folders...");
      foldersToSync = validFolders; // Use all valid folders
    } else {
      // Filter user-specified folders to include only valid folders
      foldersToSync = foldersToSync.filter((folder) =>
        validFolders.includes(folder)
      );
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
      console.debug(`[fetchSyncEmails] Opening folder: ${folderName}...`);
      await connection.openBox(folderName);
      let searchCriteria;
      if (startUID && endUID) {
        // Use UID range for this batch
        searchCriteria = [["UID", `${startUID}:${endUID}`]];
      } else {
        searchCriteria = [["SINCE", formattedSinceDate]];
      }
      const fetchOptions = {
        bodies: "",
        struct: true,
      };
      const messages = await connection.search(searchCriteria, fetchOptions);
      console.debug(
        `[fetchSyncEmails] Total emails found in ${folderName}: ${messages.length}`
      );
      // No need for further pagination here, as batching is handled by UID range
      for (const message of messages) {
        const rawBodyPart = message.parts.find((part) => part.which === "");
        const rawBody = rawBodyPart ? rawBodyPart.body : null;
        if (!rawBody) {
          console.debug(
            `[fetchSyncEmails] No body found for email in folder: ${folderName}.`
          );
          continue;
        }
        const parsedEmail = await simpleParser(rawBody);
        // Map IMAP folder name to database folder name
        const dbFolderName = folderMapping[folderName] || "inbox"; // Default to "inbox" if no mapping exists
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
          masterUserID: masterUserID,
          subject: parsedEmail.subject || null,
          body: cleanEmailBody(parsedEmail.html || parsedEmail.text || ""),
          folder: dbFolderName, // Use mapped folder name
          createdAt: parsedEmail.date || new Date(),
          isRead: isRead, // Save read/unread status
        };
        // Save email to the database
        const existingEmail = await Email.findOne({
          where: { messageId: emailData.messageId },
        });
        let savedEmail;
        if (!existingEmail) {
          try {
            savedEmail = await Email.create(emailData);
            console.debug(
              `[fetchSyncEmails] Email saved: ${emailData.messageId}`
            );
          } catch (createError) {
            console.error(
              `[fetchSyncEmails] Error creating email ${emailData.messageId}:`,
              createError
            );
            continue; // Skip this email and continue with the next one
          }
        } else {
          console.debug(
            `[fetchSyncEmails] Email already exists: ${emailData.messageId}`
          );
          savedEmail = existingEmail;
        }

        // Save attachments if they exist
        if (parsedEmail.attachments && parsedEmail.attachments.length > 0) {
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
        }

        // Fetch the full thread recursively
        if (emailData.messageId) {
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
        }
      }
    };
    // Fetch emails from specified folders
    for (const folder of foldersToSync) {
      await fetchEmailsFromFolder(folder);
    }
    connection.end();
    console.debug("[fetchSyncEmails] IMAP connection closed.");
    res.status(200).json({
      message: "Fetched and saved emails from specified folders.",
      sinceDate: humanReadableSinceDate, // Include the human-readable date in the response
      batchSize: parseInt(batchSize, 10),
      page: parseInt(page, 10),
      startUID,
      endUID,
    });
  } catch (error) {
    console.error("[fetchSyncEmails] Error fetching emails:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};
exports.fetchsyncdata = async (req, res) => {
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

  if (!Array.isArray(emailIds) || emailIds.length === 0) {
    return res
      .status(400)
      .json({ message: "emailIds must be a non-empty array." });
  }

  const [updatedCount] = await Email.update(
    { isRead: false },
    { where: { emailID: emailIds, masterUserID } }
  );

  res
    .status(200)
    .json({ message: `${updatedCount} email(s) marked as unread.` });
};

exports.markAsUnreadSingle = async (req, res) => {
  const masterUserID = req.adminId;
  const { emailID } = req.params;

  if (!emailID) {
    return res.status(400).json({ message: "emailID is required." });
  }

  try {
    const [updatedCount] = await Email.update(
      { isRead: false },
      { where: { emailID, masterUserID } }
    );

    if (updatedCount === 0) {
      return res
        .status(404)
        .json({ message: "Email not found or already unread." });
    }

    res.status(200).json({ message: "Email marked as unread." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to mark as unread.", error: error.message });
  }
};

exports.updateSignature = async (req, res) => {
  const masterUserID = req.adminId;
  const { signature, signatureName } = req.body;
  let signatureImage = req.body.signatureImage;

  // If an image was uploaded, use its path as the image URL
  if (req.file) {
    signatureImage = `${
      process.env.LOCALHOST_URL || "http://localhost:3056"
    }/uploads/signatures/${req.file.filename}`;
  }

  try {
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    if (!userCredential) {
      return res.status(404).json({ message: "User credentials not found." });
    }
    await userCredential.update({ signature, signatureName, signatureImage });
    res.status(200).json({ message: "Signature updated successfully." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update signature.", error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  const masterUserID = req.adminId;
  const { emailIds } = req.body;

  if (!Array.isArray(emailIds) || emailIds.length === 0) {
    return res
      .status(400)
      .json({ message: "emailIds must be a non-empty array." });
  }

  const [updatedCount] = await Email.update(
    { isRead: true },
    { where: { emailID: emailIds, masterUserID } }
  );

  res.status(200).json({ message: `${updatedCount} email(s) marked as read.` });
};

exports.updateEmailSharing = async (req, res) => {
  const masterUserID = req.adminId; // Assuming adminId is set in middleware
  const { emailId } = req.params; // Email ID from URL
  const { isShared } = req.body; // Boolean value in request body

  try {
    const email = await Email.findOne({
      where: { emailID: emailId, masterUserID },
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

  try {
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    if (!userCredential) {
      return res.status(404).json({ message: "User credentials not found." });
    }

    // If blockedEmail is an array, join to string
    let blockedEmailStr = blockedEmail;
    if (Array.isArray(blockedEmail)) {
      blockedEmailStr = blockedEmail.join(",");
    }

    await userCredential.update({ blockedEmail: blockedEmailStr });
    res
      .status(200)
      .json({ message: "Blocked address list updated successfully." });
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

  try {
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    if (!userCredential) {
      return res.status(404).json({ message: "User credentials not found." });
    }

    // Ensure blockedEmail is always an array
    let blockedList = [];
    if (Array.isArray(userCredential.blockedEmail)) {
      blockedList = userCredential.blockedEmail;
    } else if (
      typeof userCredential.blockedEmail === "string" &&
      userCredential.blockedEmail.length > 0
    ) {
      // Fallback for legacy comma-separated string
      blockedList = userCredential.blockedEmail
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    }

    // Remove the email (case-insensitive, trimmed)
    const updatedList = blockedList
      .map((e) => e.trim().toLowerCase())
      .filter((email) => email !== emailToRemove.trim().toLowerCase());

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

  try {
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    if (!userCredential) {
      return res.status(404).json({ message: "User credentials not found." });
    }

    res.status(200).json({
      message: "Signature data fetched successfully.",
      signature: userCredential.signature,
      signatureName: userCredential.signatureName,
      signatureImage: userCredential.signatureImage,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch signature data.",
      error: error.message,
    });
  }
};
exports.getBlockedAddress = async (req, res) => {
  const masterUserID = req.adminId;
  try {
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    if (!userCredential) {
      return res.status(404).json({ message: "User credentials not found." });
    }
    res.status(200).json({
      message: "Blocked addresses fetched successfully.",
      blockedEmail: userCredential.blockedEmail,
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

  try {
    const where = search ? { recipient: { [Op.like]: `%${search}%` } } : {};

    // Find distinct emails for auto-complete
    const { rows, count } = await Email.findAndCountAll({
      attributes: [
        [
          Email.sequelize.fn("DISTINCT", Email.sequelize.col("recipient")),
          "email",
        ],
      ],
      where,
      limit: parseInt(limit),
      offset,
      order: [["recipient", "ASC"]],
    });

    // Map to just email strings
    const emails = rows.map((row) => row.get("email"));

    res.status(200).json({
      emails,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch emails.", error: error.message });
  }
};

exports.downloadAttachment = async (req, res) => {
  const { emailID, filename } = req.query;
  const masterUserID = req.adminId;
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
exports.diagnoseAttachment = async (req, res) => {
  // Use query parameters for GET endpoint
  const { emailID, filename } = req.query;
  const masterUserID = req.adminId;
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
