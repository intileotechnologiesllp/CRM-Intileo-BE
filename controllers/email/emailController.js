const Imap = require("imap-simple");
const Email = require("../../models/email/emailModel");
const { htmlToText } = require("html-to-text");
const { simpleParser } = require("mailparser");
const Attachment = require("../../models/email/attachmentModel");
const Template = require("../../models/email/templateModel");
const { Sequelize } = require("sequelize");
const nodemailer = require("nodemailer");
const { saveAttachments } = require("../../services/attachmentService");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const UserCredential = require("../../models/email/userCredentialModel");
const DefaultEmail = require("../../models/email/defaultEmailModel");
const MasterUser = require("../../models/master/masterUserModel");
const Lead = require("../../models/leads/leadsModel");
const Deal = require("../../models/deals/dealsModels");
const Person = require("../../models/leads/leadPersonModel");
const Organization = require("../../models/leads/leadOrganizationModel");
const Activity = require("../../models/activity/activityModel");
const { publishToQueue } = require("../../services/rabbitmqService");
const { log } = require("console");
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

// Maximum batch size for all email fetch operations
const MAX_BATCH_SIZE = 20;

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

exports.queueFetchInboxEmails = async (req, res) => {
  const { batchSize = 50, days = 7 } = req.query;
  const masterUserID = req.adminId;
  const email = req.body?.email || req.email;
  const appPassword = req.body?.appPassword || req.appPassword;
  const provider = req.body?.provider;

  try {
    if (!masterUserID || !email || !appPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // 1. Connect to IMAP and get all UIDs (not fetching all messages)
    let imapConfig;
    const providerConfig =
      PROVIDER_CONFIG[provider] || PROVIDER_CONFIG["gmail"];
    if (provider === "custom") {
      imapConfig = {
        imap: {
          user: email,
          password: appPassword,
          host: req.body.imapHost,
          port: req.body.imapPort,
          tls: req.body.imapTLS,
          authTimeout: 30000,
          tlsOptions: { rejectUnauthorized: false },
        },
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
          tlsOptions: { rejectUnauthorized: false },
        },
      };
    }
    const connection = await Imap.connect(imapConfig);
    await connection.openBox("INBOX");
    let searchCriteria;
    if (!days || days === 0 || days === "all") {
      searchCriteria = ["ALL"];
    } else {
      const sinceDate = formatDateForIMAP(
        new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      );
      searchCriteria = [["SINCE", sinceDate]];
    }
    // Only fetch UIDs
    const fetchOptions = { bodies: [], struct: true }; // no bodies
    const messages = await connection.search(searchCriteria, fetchOptions);
    const uids = messages.map((msg) => msg.attributes.uid);
    const totalEmails = uids.length;
    await connection.end();

    // 2. Calculate UID ranges for batches
    const numBatches = Math.ceil(totalEmails / batchSize);
    if (numBatches === 0) {
      return res.status(200).json({ message: "No emails to fetch." });
    }

    for (let page = 1; page <= numBatches; page++) {
      const startIdx = (page - 1) * batchSize;
      const endIdx = Math.min(startIdx + parseInt(batchSize), totalEmails);
      const batchUIDs = uids.slice(startIdx, endIdx);
      if (batchUIDs.length === 0) continue;
      const startUID = batchUIDs[0];
      const endUID = batchUIDs[batchUIDs.length - 1];
      await publishToQueue("FETCH_INBOX_QUEUE", {
        masterUserID,
        email,
        appPassword,
        batchSize,
        page,
        days,
        provider,
        imapHost: req.body.imapHost,
        imapPort: req.body.imapPort,
        imapTLS: req.body.imapTLS,
        smtpHost: req.body.smtpHost,
        smtpPort: req.body.smtpPort,
        smtpSecure: req.body.smtpSecure,
        startUID,
        endUID,
      });
    }
    res.status(200).json({
      message: `Inbox fetch jobs queued: ${numBatches} batches for ${totalEmails} emails.`,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to queue inbox fetch job.",
      error: error.message,
    });
  }
};

// Fetch emails from the inbox in batches
// Fetch emails from the inbox in batches
exports.fetchInboxEmails = async (req, res) => {
  // Enforce max batch size
  let { batchSize = 50, page = 1, days = 7, startUID, endUID } = req.query;
  batchSize = Math.min(Number(batchSize) || 10, MAX_BATCH_SIZE);

  const masterUserID = req.adminId;
  const email = req.body?.email || req.email;
  const appPassword = req.body?.appPassword || req.appPassword;
  const provider = req.body?.provider;

  let connection;
  try {
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
        `User credentials upserted for masterUserID: ${masterUserID}`
      );
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
        },
      };
    }

    connection = await Imap.connect(imapConfig);

    // Add robust error handler
    connection.on("error", (err) => {
      console.error("IMAP connection error:", err);
    });

    // Helper function to fetch emails from a specific folder using UID range
    const fetchEmailsFromFolder = async (folderName, folderType) => {
      try {
        await connection.openBox(folderName);
        let searchCriteria;
        if (startUID && endUID) {
          // Use UID range for this batch
          searchCriteria = [["UID", `${startUID}:${endUID}`]];
        } else if (!days || days === 0 || days === "all") {
          searchCriteria = ["ALL"];
        } else {
          const sinceDate = formatDateForIMAP(
            new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          );
          searchCriteria = [["SINCE", sinceDate]];
        }
        const fetchOptions = { bodies: "", struct: true };
        const messages = await connection.search(searchCriteria, fetchOptions);

        console.log(`Total emails found in ${folderType}: ${messages.length}`);

        // Pagination logic
        const startIndex = (page - 1) * batchSize;
        const endIndex = startIndex + parseInt(batchSize);
        const batchMessages = messages.slice(startIndex, endIndex);

        for (const message of batchMessages) {
          const rawBodyPart = message.parts.find((part) => part.which === "");
          const rawBody = rawBodyPart ? rawBodyPart.body : null;

          if (!rawBody) {
            console.log(`No body found for email in ${folderType}.`);
            continue;
          }

          const parsedEmail = await simpleParser(rawBody);

          //..............changes for inReplyTo and references fields................
          const referencesHeader = parsedEmail.headers.get("references");
          const references = Array.isArray(referencesHeader)
            ? referencesHeader.join(" ") // Convert array to string
            : referencesHeader || null;

          const emailData = {
            messageId: parsedEmail.messageId || null,
            inReplyTo: parsedEmail.headers.get("in-reply-to") || null,
            references,
            sender: parsedEmail.from ? parsedEmail.from.value[0].address : null,
            senderName: parsedEmail.from
              ? parsedEmail.from.value[0].name
              : null,
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
            folder: folderType, // Dynamically set the folder type
            createdAt: parsedEmail.date || new Date(),
          };

          // Save email to the database
          const existingEmail = await Email.findOne({
            where: { messageId: emailData.messageId },
          });

          let savedEmail;
          if (!existingEmail) {
            savedEmail = await Email.create(emailData);
            console.log(`Recent email saved: ${emailData.messageId}`);
          } else {
            console.log(`Recent email already exists: ${emailData.messageId}`);
            savedEmail = existingEmail;
          }

          // Save attachments
          const attachments = [];
          if (parsedEmail.attachments && parsedEmail.attachments.length > 0) {
            const savedAttachments = await saveAttachments(
              parsedEmail.attachments,
              savedEmail.emailID
            );
            attachments.push(...savedAttachments);
            console.log(
              `Saved ${attachments.length} attachments for email: ${emailData.messageId}`
            );
          }

          // Fetch the full thread recursively
          if (emailData.messageId) {
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
            console.log(
              `Full thread for messageId ${emailData.messageId}:`,
              uniqueThread.map((e) => e.messageId)
            );
            // You can now use uniqueThread as the full conversation
          }
        }
      } catch (folderError) {
        console.error(
          `Error fetching emails from folder ${folderType}:`,
          folderError
        );
      }
    };
    const boxes = await connection.getBoxes();
    const allFoldersArr = flattenFolders(boxes).map((f) => f.toLowerCase());
    const folderTypes = ["inbox", "drafts", "archive", "sent"];
    for (const type of folderTypes) {
      const folderName = folderMap[type];
      if (allFoldersArr.includes(folderName.toLowerCase())) {
        console.log(`Fetching emails from ${type}...`);
        await fetchEmailsFromFolder(folderName, type);
      } else {
        console.log(
          `Folder "${folderName}" not found for provider ${provider}. Skipping.`
        );
      }
    }

    console.log("Fetching emails from Inbox...");
    await fetchEmailsFromFolder(folderMap.inbox, "inbox");

    console.log("Fetching emails from Drafts...");
    await fetchEmailsFromFolder(folderMap.drafts, "drafts");

    console.log("Fetching emails from Archive...");
    // await fetchEmailsFromFolder(folderMap.archive, "archive");
    if (allFoldersArr.includes(folderMap.archive.toLowerCase())) {
      console.log("Fetching emails from Archive...");
      await fetchEmailsFromFolder(folderMap.archive, "archive");
    } else {
      console.log(
        `Archive folder "${folderMap.archive}" not found for provider ${provider}. Skipping.`
      );
    }

    console.log("Fetching emails from Sent...");
    await fetchEmailsFromFolder(folderMap.sent, "sent");

    connection.end();
    console.log("IMAP connection closed.");

    res.status(200).json({
      message:
        "Fetched and saved emails from Inbox, Drafts, Archive, and Sent folders.",
    });
  } catch (error) {
    console.error("Error fetching emails:", error);
    res.status(500).json({ message: "Internal server error." });
  } finally {
    // Safe connection close
    if (
      connection &&
      connection.imap &&
      connection.imap.state !== "disconnected"
    ) {
      try {
        connection.end();
      } catch (closeErr) {
        console.error("Error closing IMAP connection:", closeErr);
      }
    }
  }
};

// Fetch and store the most recent email
exports.fetchRecentEmail = async (adminId, options = {}) => {
  // Enforce max batch size if options.batchSize is provided (for worker safety)
  const batchSize = Math.min(Number(options.batchSize) || 10, MAX_BATCH_SIZE);

  try {
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

    const connection = await Imap.connect(imapConfig);

    console.log("Opening INBOX...");
    await connection.openBox("INBOX");

    console.log("Fetching the most recent email...");

    // // Fetch all emails, then get the most recent one
    // const fetchOptions = { bodies: "", struct: true };
    // const messages = await connection.search(["ALL"], fetchOptions);

    // if (!messages.length) {
    //   connection.end();
    //   return { message: "No emails found." };
    // }

    //...................original code.................
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

    console.log(`Total emails found: ${messages.length}`);

    if (messages.length === 0) {
      console.log("No emails found.");
      return { message: "No emails found." };
    }

    // Get the most recent email
    const recentMessage = messages[messages.length - 1];
    const rawBodyPart = recentMessage.parts.find((part) => part.which === "");
    const rawBody = rawBodyPart ? rawBodyPart.body : null;

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
      folder: "inbox", // Add folder field
      // threadId,
      createdAt: parsedEmail.date || new Date(),
    };

    console.log(`Processing recent email: ${emailData.messageId}`);
    const existingEmail = await Email.findOne({
      where: { messageId: emailData.messageId, folder: emailData.folder }, // Check uniqueness with folder
    });

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
      const savedAttachments = await saveAttachments(
        parsedEmail.attachments,
        savedEmail.emailID
      );
      attachments.push(...savedAttachments);
      console.log(
        `Saved ${attachments.length} attachments for email: ${emailData.messageId}`
      );
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
        console.log(`Related email already exists: ${relatedEmail.messageId}`);
      }
    }

    connection.end(); // Close the connection
    console.log("IMAP connection closed.");

    return {
      message: "Fetched and saved the most recent email.",
      email: emailData,
      relatedEmails,
    };
  } catch (error) {
    console.error("Error fetching recent email:", error);
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
          `Saved ${savedAttachments.length} attachments for email: ${emailData.messageId}`
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
          `Saved ${savedAttachments.length} attachments for email: ${emailData.messageId}`
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
    pageSize = 10,
    folder,
    search,
    isRead,
    toMe,
    hasAttachments,
    isOpened,
    isClicked,
    trackedEmails,
    isShared,
  } = req.query;
  const masterUserID = req.adminId;

  // Enforce strict maximum page size
  const MAX_SAFE_PAGE_SIZE = 50;
  pageSize = Math.min(Number(pageSize) || 10, MAX_SAFE_PAGE_SIZE);
  if (pageSize > MAX_SAFE_PAGE_SIZE) pageSize = MAX_SAFE_PAGE_SIZE;

  try {
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
      });
    }
    let filters = { masterUserID };
    if (folder) filters.folder = folder;
    if (isRead !== undefined) filters.isRead = isRead === "true";
    if (toMe === "true") {
      const userEmail = userCredential.email;
      filters.recipient = { [Sequelize.Op.like]: `%${userEmail}%` };
    }
    if (trackedEmails === "true") {
      filters.isOpened = true;
      filters.isClicked = true;
    } else {
      if (isOpened !== undefined) filters.isOpened = isOpened === "true";
      if (isClicked !== undefined) filters.isClicked = isClicked === "true";
    }
    let includeAttachments = [
      {
        model: Attachment,
        as: "attachments",
        attributes: ["attachmentID", "filename", "size"], // Only metadata, removed mimetype
      },
    ];
    if (hasAttachments === "true") {
      includeAttachments[0].required = true;
    }
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
    const offset = (page - 1) * pageSize;
    const limit = pageSize;
    // Only select essential fields
    const essentialFields = [
      "emailID", "messageId", "inReplyTo", "references", "sender", "senderName", "recipient", "cc", "bcc", "subject", "folder", "createdAt", "isRead", "isOpened", "isClicked", "leadId", "dealId"
    ];
    const { count, rows: emails } = await Email.findAndCountAll({
      where: filters,
      include: includeAttachments,
      offset,
      limit,
      order: [["createdAt", "DESC"]],
      distinct: true,
      attributes: essentialFields,
    });
    // Add baseURL to attachment paths (metadata only)
    const baseURL = process.env.LOCALHOST_URL;
    const emailsWithAttachments = emails.map((email) => {
      const attachments = (email.attachments || []).map((attachment) => ({
        ...attachment.toJSON(),
        path: `${baseURL}/uploads/attachments/${attachment.filename}`,
      }));
      return {
        ...email.toJSON(),
        attachments,
      };
    });
    // Calculate unviewCount for the specified folder or all folders
    const unviewCount = await Email.count({
      where: {
        ...filters,
        isRead: false,
      },
    });
    // Grouping logic (only for current page)
    let responseThreads;
    if (folder === "drafts" || folder === "trash") {
      const threads = {};
      emailsWithAttachments.forEach((email) => {
        const threadId = email.draftId || email.emailID;
        if (!threads[threadId]) threads[threadId] = [];
        threads[threadId].push(email);
      });
      responseThreads = Object.values(threads);
    } else {
      const threads = {};
      emailsWithAttachments.forEach((email) => {
        const threadId = email.inReplyTo || email.messageId || email.emailID;
        if (!threads[threadId]) threads[threadId] = [];
        threads[threadId].push(email);
      });
      responseThreads = Object.values(threads);
    }
    // Safeguard: If response is too large, return error
    const estimatedResponseSize = JSON.stringify(responseThreads).length;
    const MAX_RESPONSE_SIZE = 2 * 1024 * 1024; // 2MB
    if (estimatedResponseSize > MAX_RESPONSE_SIZE) {
      return res.status(413).json({
        message: "Response too large. Please reduce pageSize or apply more filters.",
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / pageSize),
        totalEmails: count,
        unviewCount,
        threads: [],
      });
    }
    res.status(200).json({
      message: "Emails fetched successfully.",
      currentPage: parseInt(page),
      totalPages: Math.ceil(count / pageSize),
      totalEmails: count,
      unviewCount,
      threads: responseThreads,
    });
  } catch (error) {
    console.error("Error fetching emails:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

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
          `Saved ${savedAttachments.length} attachments for email: ${emailData.messageId}`
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

exports.getOneEmail = async (req, res) => {
  const { emailId } = req.params;
  const masterUserID = req.adminId;
  const baseURL = process.env.LOCALHOST_URL;
  const includeConversation = req.query.includeConversation === "true";

  try {
    // Measure heap before
    const usedBefore = process.memoryUsage().heapUsed;

    // Fetch main email
    const mainEmail = await Email.findOne({
      where: { emailID: emailId },
      include: [{ model: Attachment, as: "attachments" }],
    });

    if (!mainEmail) return res.status(404).json({ message: "Email not found." });

    // Mark as read if not already
    if (!mainEmail.isRead) await mainEmail.update({ isRead: true });

    // Clean body
    mainEmail.body = cleanEmailBody(mainEmail.body);

    // Attachments path cleanup
    mainEmail.attachments = mainEmail.attachments.map(att => ({
      filename: att.filename,
      path: `${baseURL}/uploads/attachments/${att.filename}`,
    }));

    // Check for drafts or trash
    if (mainEmail.folder === "drafts" || mainEmail.folder === "trash") {
      const linkedEntities = await getLinkedEntities(mainEmail);
      return res.status(200).json({
        message: `${mainEmail.folder} email fetched successfully.`,
        data: {
          email: mainEmail,
          relatedEmails: [],
          linkedEntities,
        },
      });
    }

    // Get thread IDs
    const threadIds = [
      mainEmail.messageId,
      mainEmail.inReplyTo,
      ...(mainEmail.references ? mainEmail.references.split(" ") : []),
    ].filter(Boolean);

    // Fetch related emails with pagination (limit to 50 for performance)
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
      include: [{ model: Attachment, as: "attachments" }],
      order: [["createdAt", "ASC"]],
      limit: 50, // Adjust as needed
    });

    // Remove duplicate
    relatedEmails = relatedEmails.filter(
      (email) => email.messageId !== mainEmail.messageId
    );

    // Clean bodies and attachments
    relatedEmails.forEach((email) => {
      email.body = cleanEmailBody(email.body);
      email.attachments = email.attachments.map(att => ({
        filename: att.filename,
        path: `${baseURL}/uploads/attachments/${att.filename}`,
      }));
    });

    let sortedMainEmail = mainEmail;
    let sortedRelatedEmails = relatedEmails;

    // Only build conversation if requested
    if (includeConversation) {
      let allEmails = [mainEmail, ...relatedEmails];

      // Deduplicate by messageId
      const seen = new Set();
      allEmails = allEmails.filter((email) => {
        if (seen.has(email.messageId)) return false;
        seen.add(email.messageId);
        return true;
      });

      // Build message tree order
      const emailMap = {};
      allEmails.forEach(email => {
        emailMap[email.messageId] = email;
      });

      const conversation = [];
      let current = allEmails.find(
        (email) => !email.inReplyTo || !emailMap[email.inReplyTo]
      );

      while (current) {
        conversation.push(current);
        current = allEmails.find(
          (email) => email.inReplyTo === conversation[conversation.length - 1].messageId
        );
      }

      // Add leftovers
      const remaining = allEmails.filter((email) => !conversation.includes(email));
      remaining.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      conversation.push(...remaining);

      sortedMainEmail = conversation[0];
      sortedRelatedEmails = conversation.slice(1);
    }

    // Fetch linked entities from entire conversation
    const linkedEntities = await getAggregatedLinkedEntities([
      sortedMainEmail,
      ...sortedRelatedEmails,
    ]);

    // Heap log
    const usedAfter = process.memoryUsage().heapUsed;
    console.log(`[MEMORY] Heap used: ${(usedAfter - usedBefore) / 1024 / 1024} MB for emailId ${emailId}`);

    return res.status(200).json({
      message: "Email fetched successfully.",
      data: {
        email: sortedMainEmail,
        relatedEmails: sortedRelatedEmails,
        linkedEntities,
      },
    });
  } catch (error) {
    console.error("Error fetching email:", error);
    return res.status(500).json({ message: "Internal server error." });
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

        // Save attachments in the database
        const baseURL = process.env.LOCALHOST_URL || "http://localhost:3056";
        const savedAttachments = req.files.map((file) => ({
          emailID: savedEmail.emailID,
          filename: file.filename,
          filePath: `${baseURL}/uploads/attachments/${encodeURIComponent(
            file.filename
          )}`,
          size: file.size,
          contentType: file.mimetype,
        }));
        if (savedAttachments.length > 0) {
          await Attachment.bulkCreate(savedAttachments);
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
        attachments = req.files.map((file) => ({
          filename: file.filename,
          originalname: file.originalname,
          path: file.path,
          // path: `${baseURL}/uploads/attachments/${encodeURIComponent(file.filename)}`, // <-- public URL
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
        folder: "sent",
        createdAt: new Date(),
        masterUserID,
        tempMessageId,
        isDraft: false,
        attachments,
        // isShared: isShared === true || isShared === "true", // ensure boolean
      };

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

      // Handle attachments
      let savedAttachments = [];
      if (req.files && req.files.length > 0) {
        if (isUpdate) {
          // Remove old attachments if updating
          await Attachment.destroy({ where: { emailID: savedDraft.emailID } });
        }
        // savedAttachments = req.files.map((file) => ({
        //   emailID: savedDraft.emailID,
        //   filename: file.originalname,
        //   path: file.path,
        // }));
        const baseURL = process.env.LOCALHOST_URL || "http://localhost:3056";
        const savedAttachments = req.files.map((file) => ({
          emailID: savedDraft.emailID,
          filename: file.filename,
          filePath: `${baseURL}/uploads/attachments/${encodeURIComponent(
            file.filename
          )}`,
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

      // Generate public URLs for attachments
      const attachmentLinks = savedAttachments.map((attachment) => ({
        filename: attachment.filename,
        link: `${process.env.LOCALHOST_URL}/uploads/attachments/${attachment.filename}`,
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
  let totalDeleted = 0;
  try {
    while (true) {
      // Fetch a batch of email IDs for the user
      const emails = await Email.findAll({
        where: { masterUserID },
        attributes: ["emailID"],
        limit: BATCH_SIZE,
      });
      if (emails.length === 0) break;
      const emailIDs = emails.map((e) => e.emailID);
      // Delete all attachments for these emails
      await Attachment.destroy({ where: { emailID: emailIDs } });
      // Delete all emails for the user in this batch
      await Email.destroy({ where: { emailID: emailIDs } });
      totalDeleted += emails.length;
      if (emails.length < BATCH_SIZE) break;
    }
    res.status(200).json({
      message: `All emails and attachments deleted for user ${masterUserID}. Total deleted: ${totalDeleted}`,
    });
  } catch (error) {
    console.error("Error deleting all emails and attachments:", error);
    res.status(500).json({
      message: "Failed to delete all emails and attachments.",
      error: error.message,
    });
  }
};
