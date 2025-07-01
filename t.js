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
  // Remove quoted replies (e.g., lines starting with ">")
  return body
    .split("\n")
    .filter((line) => !line.startsWith(">"))
    .join("\n")
    .trim();
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
  const { syncStartDate } = req.body;

  try {
    await publishToQueue("SYNC_EMAIL_QUEUE", { masterUserID, syncStartDate });
    res.status(200).json({ message: "Sync job queued successfully." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to queue sync job.", error: error.message });
  }
};

exports.fetchSyncEmails = async (req, res) => {
  const { batchSize = 100, page = 1 } = req.query; // Default batchSize to 50 and page to 1
  const masterUserID = req.adminId; // Assuming adminId is set in middleware
  const { syncStartDate: inputSyncStartDate } = req.body; // or req.query.syncStartDate if you prefer
  try {
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

    console.log(`Fetching emails since ${humanReadableSinceDate}`);

    // Connect to IMAP server
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
    const provider = userCredential.provider || "gmail"; // default to gmail

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

    const connection = await Imap.connect(imapConfig);

    // Fetch all folders from the IMAP server
    const mailboxes = await connection.getBoxes();
    console.log("All folders from IMAP server:", mailboxes);

    // Extract all valid folder names, including nested folders
    const validFolders = extractFolders(mailboxes);
    console.log("Valid folders from IMAP server:", validFolders);

    // Fetch all folders if syncAllFolders is true
    let foldersToSync = Array.isArray(syncFolders)
      ? syncFolders
      : [syncFolders];
    if (syncAllFolders) {
      console.log("Fetching all folders...");
      foldersToSync = validFolders; // Use all valid folders
    } else {
      // Filter user-specified folders to include only valid folders
      foldersToSync = foldersToSync.filter((folder) =>
        validFolders.includes(folder)
      );
    }

    // Debugging logs
    console.log("User-specified folders to sync:", syncFolders);
    console.log("Filtered folders to sync:", foldersToSync);

    if (foldersToSync.length === 0) {
      return res.status(400).json({ message: "No valid folders to sync." });
    }

    console.log("Valid folders to sync:", foldersToSync);

    // Helper function to fetch emails from a specific folder
    const fetchEmailsFromFolder = async (folderName) => {
      console.log(`Opening folder: ${folderName}...`);
      await connection.openBox(folderName);

      console.log(`Fetching emails from folder: ${folderName}...`);
      const searchCriteria = [["SINCE", formattedSinceDate]];
      const fetchOptions = {
        bodies: "",
        struct: true,
      };

      const messages = await connection.search(searchCriteria, fetchOptions);

      console.log(`Total emails found in ${folderName}: ${messages.length}`);

      // Paginate emails based on batchSize and page
      const startIndex = (page - 1) * batchSize;
      const endIndex = startIndex + parseInt(batchSize, 10);
      const paginatedMessages = messages.slice(startIndex, endIndex);

      for (const message of paginatedMessages) {
        const rawBodyPart = message.parts.find((part) => part.which === "");
        const rawBody = rawBodyPart ? rawBodyPart.body : null;

        if (!rawBody) {
          console.log(`No body found for email in folder: ${folderName}.`);
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
        };

        // Save email to the database
        const existingEmail = await Email.findOne({
          where: { messageId: emailData.messageId },
        });

        let savedEmail;
        if (!existingEmail) {
          savedEmail = await Email.create(emailData);
          console.log(`Email saved: ${emailData.messageId}`);
        } else {
          console.log(`Email already exists: ${emailData.messageId}`);
          savedEmail = existingEmail;
        }

        // Fetch related emails in the same thread (like fetchRecentEmail)
        const relatedEmails = await Email.findAll({
          where: {
            [Sequelize.Op.or]: [
              { messageId: emailData.inReplyTo }, // Parent email
              { inReplyTo: emailData.messageId }, // Replies to this email
              {
                references: { [Sequelize.Op.like]: `%${emailData.messageId}%` },
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
      }
    };

    // Fetch emails from specified folders
    for (const folder of foldersToSync) {
      await fetchEmailsFromFolder(folder);
    }

    connection.end();
    console.log("IMAP connection closed.");

    res.status(200).json({
      message: "Fetched and saved emails from specified folders.",
      sinceDate: humanReadableSinceDate, // Include the human-readable date in the response
      batchSize: parseInt(batchSize, 10),
      page: parseInt(page, 10),
    });
  } catch (error) {
    console.error("Error fetching emails:", error);
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
  const { emailID, filename } = req.params;
  const masterUserID = req.adminId;
  console.log(emailID, filename, masterUserID);

  try {
    // Find the email and attachment metadata
    const email = await Email.findOne({ where: { emailID} });
    if (!email) return res.status(404).json({ message: "Email not found." });

    const attachmentMeta = await Attachment.findOne({
      where: { emailID, filename },
    });
    if (!attachmentMeta)
      return res.status(404).json({ message: "Attachment not found." });

    // Fetch user credentials
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });
    if (!userCredential)
      return res.status(404).json({ message: "User credentials not found." });

    // Connect to IMAP and fetch the email
    // const imapConfig = {
    //   imap: {
    //     user: userCredential.email,
    //     password: userCredential.appPassword,
    //     host: "imap.gmail.com",
    //     port: 993,
    //     tls: true,
    //     authTimeout: 30000,
    //     tlsOptions: { rejectUnauthorized: false },
    //   },
    // };
    const provider = userCredential.provider || "gmail"; // default to gmail

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

    const connection = await Imap.connect(imapConfig);
    await connection.openBox(email.folder);

    // Search for the email by messageId
    const searchCriteria = [["HEADER", "MESSAGE-ID", email.messageId]];
    const fetchOptions = { bodies: "", struct: true };
    const messages = await connection.search(searchCriteria, fetchOptions);

    if (!messages.length) {
      connection.end();
      return res.status(404).json({ message: "Email not found on server." });
    }

    // Parse the email and find the attachment
    const rawBodyPart = messages[0].parts.find((part) => part.which === "");
    const rawBody = rawBodyPart ? rawBodyPart.body : null;
    const parsedEmail = await simpleParser(rawBody);

    const attachment = parsedEmail.attachments.find(
      (att) => att.filename === filename
    );
    if (!attachment) {
      connection.end();
      return res
        .status(404)
        .json({ message: "Attachment not found in email." });
    }

    // Send the attachment as a download
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${attachment.filename}"`
    );
    res.setHeader("Content-Type", attachment.contentType);
    res.send(attachment.content);

    connection.end();
  } catch (error) {
    console.error("Error downloading attachment:", error);
    res.status(500).json({
      message: "Failed to download attachment.",
      error: error.message,
    });
  }
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