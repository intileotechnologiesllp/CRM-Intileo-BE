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
// Add this near PROVIDER_CONFIG
const PROVIDER_FOLDER_MAP = {
  gmail: {
    inbox: "INBOX",
    drafts: "[Gmail]/Drafts",
    sent: "[Gmail]/Sent Mail",
    archive: "[Gmail]/All Mail"
  },
  yandex: {
    inbox: "INBOX",
    drafts: "Drafts",
    sent: "Sent",
    archive: "Archive"
  },
  outlook: {
    inbox: "INBOX",
    drafts: "Drafts",
    sent: "Sent",
    archive: "Archive"
  },
  custom: {
    inbox: "INBOX",
    drafts: "Drafts",
    sent: "Sent",
    archive: "Archive"
  }
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
      folders = folders.concat(flattenFolders(box.children, `${fullName}${box.delimiter}`));
    }
  }
  return folders;
}

exports.queueFetchInboxEmails = async (req, res) => {
  const { batchSize = 50, page = 1, days = 7 } = req.query;
  const masterUserID = req.adminId;
  // const { email, appPassword } = req.body;
  const email = req.body?.email || req.email;
const appPassword = req.body?.appPassword || req.appPassword;
const provider = req.body?.provider; // Default to gmail

  try {
        if (!masterUserID || !email || !appPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }
    console.log(req.adminId, "masterUserID");
    


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
  smtpSecure: req.body.smtpSecure
    });
    res.status(200).json({ message: "Inbox fetch job queued successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to queue inbox fetch job.", error: error.message });
  }
};

// Fetch emails from the inbox in batches
exports.fetchInboxEmails = async (req, res) => {
  const { batchSize = 50, page = 1, days = 7 } = req.query;
  const masterUserID = req.adminId; // Assuming adminId is set in middleware
  // const email = req.email; // Get email from the request body
  // const appPassword = req.body.appPassword;
  const email = req.body?.email || req.email;
const appPassword = req.body?.appPassword || req.appPassword;
const provider = req.body?.provider; // Default to gmail

  try {
    // Validate input
    if (!masterUserID || !email || !appPassword || !provider) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Check if the user already has credentials saved
    const existingCredential = await UserCredential.findOne({
      where: { masterUserID },
    });

    if (existingCredential) {
      // Update existing credentials
      // await existingCredential.update({ email, appPassword,provider });
        await existingCredential.update({
    email,
    appPassword,
    provider,
    // Add custom provider fields
    imapHost: provider === "custom" ? req.body.imapHost : null,
    imapPort: provider === "custom" ? req.body.imapPort : null,
    imapTLS: provider === "custom" ? req.body.imapTLS : null,
    smtpHost: provider === "custom" ? req.body.smtpHost : null,
    smtpPort: provider === "custom" ? req.body.smtpPort : null,
    smtpSecure: provider === "custom" ? req.body.smtpSecure : null,
  });
      console.log(`User credentials updated for masterUserID: ${masterUserID}`);
    } else {
      // Create new credentials
      // await UserCredential.create({
      //   masterUserID,
      //   email,
      //   appPassword,
      //   provider
      // });
      // console.log(`User credentials added for masterUserID: ${masterUserID}`);
        // Create new credentials
  await UserCredential.create({
    masterUserID,
    email,
    appPassword,
    provider,
    // Add custom provider fields
    imapHost: provider === "custom" ? req.body.imapHost : null,
    imapPort: provider === "custom" ? req.body.imapPort : null,
    imapTLS: provider === "custom" ? req.body.imapTLS : null,
    smtpHost: provider === "custom" ? req.body.smtpHost : null,
    smtpPort: provider === "custom" ? req.body.smtpPort : null,
    smtpSecure: provider === "custom" ? req.body.smtpSecure : null,
  });
  console.log(`User credentials added for masterUserID: ${masterUserID}`);
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
const folderMap = PROVIDER_FOLDER_MAP[providerd] || PROVIDER_FOLDER_MAP["gmail"];
    if (providerd === "custom") {
      if (!userCredential.imapHost || !userCredential.imapPort) {
        return res.status(400).json({ message: "Custom IMAP settings are missing in user credentials." });
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

    const connection = await Imap.connect(imapConfig);

    // Helper function to fetch emails from a specific folder
    const fetchEmailsFromFolder = async (folderName, folderType) => {
      console.log(`Opening ${folderType} folder...`);
      await connection.openBox(folderName);

      console.log(`Fetching emails from ${folderType} folder...`);
      const sinceDate = formatDateForIMAP(
        new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      );
      console.log(`Using SINCE date: ${sinceDate}`);

      const searchCriteria = [["SINCE", sinceDate]];
      // const searchCriteria = ["ALL"];
      const fetchOptions = {
        bodies: "",
        struct: true,
      };

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

        const emailData = {
          messageId: parsedEmail.messageId || null,
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
          body: cleanEmailBody(parsedEmail.text || parsedEmail.html || ""),
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
      }
    };
    const boxes = await connection.getBoxes();
const allFoldersArr = flattenFolders(boxes).map(f => f.toLowerCase());
const folderTypes = ["inbox", "drafts", "archive", "sent"];
for (const type of folderTypes) {
  const folderName = folderMap[type];
  if (allFoldersArr.includes(folderName.toLowerCase())) {
    console.log(`Fetching emails from ${type}...`);
    await fetchEmailsFromFolder(folderName, type);
  } else {
    console.log(`Folder "${folderName}" not found for provider ${provider}. Skipping.`);
  }
}

    // // Fetch emails from Inbox, Drafts, Archive, and Sent folders
    // console.log("Fetching emails from Inbox...");
    // await fetchEmailsFromFolder("INBOX", "inbox");

    // console.log("Fetching emails from Drafts...");
    // await fetchEmailsFromFolder("[Gmail]/Drafts", "drafts");

    // console.log("Fetching emails from Archive...");
    // await fetchEmailsFromFolder("[Gmail]/All Mail", "archive");

    // console.log("Fetching emails from Sent...");
    // await fetchEmailsFromFolder("[Gmail]/Sent Mail", "sent");
    // Fetch emails from Inbox, Drafts, Archive, and Sent folders
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
  console.log(`Archive folder "${folderMap.archive}" not found for provider ${provider}. Skipping.`);
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
  }
};

// Fetch and store the most recent email
exports.fetchRecentEmail = async (adminId) => {
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
        return { message: "Custom IMAP settings are missing in user credentials." };
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
// let blockedList = [];
// if (userCredential && userCredential.blockedEmail) {
//   blockedList = userCredential.blockedEmail
//     .split(",")
//     .map(e => e.trim().toLowerCase())
//     .filter(Boolean);
// }
let blockedList = [];
if (userCredential && userCredential.blockedEmail) {
  blockedList = Array.isArray(userCredential.blockedEmail)
    ? userCredential.blockedEmail.map(e => String(e).trim().toLowerCase()).filter(Boolean)
    : [];
}
    const senderEmail = parsedEmail.from ? parsedEmail.from.value[0].address.toLowerCase() : null;
    if (blockedList.includes(senderEmail)) {
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
      // references: parsedEmail.headers.get("references") || null,
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
          { references: { [Sequelize.Op.like]: `%${emailData.messageId}%` } }, // Emails in the same thread
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
    const sinceDate = formatDateForIMAP(
      new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    );
    console.log(`Using SINCE date: ${sinceDate}`);

    const searchCriteria = [["SINCE", sinceDate]];
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
  const {
    page = 1,
    pageSize = 100,
    folder,
    search,
    isRead,
    toMe,
    hasAttachments,
    isOpened, // <-- Add this
    isClicked, // <-- Add this
    trackedEmails,
    isShared,
  } = req.query;
  const masterUserID = req.adminId; // Assuming adminId is set in middleware

  try {
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

    // Pagination logic
    const offset = (page - 1) * pageSize;
    const limit = parseInt(pageSize);

    // Fetch emails from the database
    const { count, rows: emails } = await Email.findAndCountAll({
      where: filters,
      include: includeAttachments,
      offset,
      limit,
      order: [["createdAt", "DESC"]], // Sort by most recent emails
    });

    // Add baseURL to attachment paths
    const baseURL = process.env.LOCALHOST_URL;
    const emailsWithAttachments = emails.map((email) => {
      const attachments = email.attachments.map((attachment) => ({
        ...attachment.toJSON(),
        path: `${baseURL}/uploads/attachments/${attachment.filename}`, // Add baseURL to the path
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
        isRead: false, // Count only unread emails
      },
    });
//................................original important
    // Group emails by conversation (thread)
    // let responseThreads;
    // if (folder === "drafts") {
    //   // For drafts, group by draftId if available, else by messageId
    //   const threads = {};
    //   emails.forEach((email) => {
    //     const threadId = email.draftId || email.messageId;
    //     if (!threads[threadId]) {
    //       threads[threadId] = [];
    //     }
    //     threads[threadId].push(email);
    //   });
    //   responseThreads = Object.values(threads);
    // } else {
    //   // For other folders, group by inReplyTo or messageId
    //   const threads = {};
    //   emails.forEach((email) => {
    //     const threadId = email.inReplyTo || email.messageId;
    //     if (!threads[threadId]) {
    //       threads[threadId] = [];
    //     }
    //     threads[threadId].push(email);
    //   });
    //   responseThreads = Object.values(threads);

    // }
    //............................end of original important

let responseThreads;
if (folder === "drafts" || folder === "trash") {
  // For drafts and trash, group by draftId if available, else by emailID
  const threads = {};
  emails.forEach((email) => {
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
  emails.forEach((email) => {
    const threadId = email.inReplyTo || email.messageId || email.emailID;
    if (!threads[threadId]) {
      threads[threadId] = [];
    }
    threads[threadId].push(email);
  });
  responseThreads = Object.values(threads);
}


    // Return the paginated response with threads and unviewCount
    res.status(200).json({
      message: "Emails fetched successfully.",
      currentPage: parseInt(page),
      totalPages: Math.ceil(count / pageSize),
      totalEmails: count,
      unviewCount, // Include the unviewCount field
      // threads: Object.values(threads), // Return grouped threads
      threads: responseThreads, // Return grouped threads
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
//...........................changes............................

// exports.getOneEmail = async (req, res) => {
//   const { emailId } = req.params;
//   const masterUserID = req.adminId;

//   try {
//     // Fetch the main email
//     const mainEmail = await Email.findOne({
//       where: { emailID: emailId },
//       include: [{ model: Attachment, as: "attachments" }],
//     });

//     if (!mainEmail) {
//       return res.status(404).json({ message: "Email not found." });
//     }

//     // Mark as read if not already
//     if (!mainEmail.isRead) {
//       await mainEmail.update({ isRead: true });
//     }

//     // Clean the body of the main email
//     mainEmail.body = cleanEmailBody(mainEmail.body);

//     // Add baseURL to attachment paths
//     const baseURL = process.env.LOCALHOST_URL;
//     mainEmail.attachments = mainEmail.attachments.map((attachment) => ({
//       ...attachment.toJSON(),
//       path: `${baseURL}/uploads/attachments/${attachment.filename}`,
//     }));

//     // If this is a draft or trash, do NOT fetch related emails
//     if (mainEmail.folder === "drafts" || mainEmail.folder === "trash") {
//       return res.status(200).json({
//         message: `${mainEmail.folder} email fetched successfully.`,
//         data: {
//           email: mainEmail,
//           relatedEmails: [],
//         },
//       });
//     }

//     // --- Gmail-like conversation grouping ---
//     // Gather all thread IDs (messageId, inReplyTo, references)
//     const threadIds = [
//       mainEmail.messageId,
//       mainEmail.inReplyTo,
//       ...(mainEmail.references ? mainEmail.references.split(" ") : []),
//     ].filter(Boolean);

//     // Fetch all related emails in the thread (across all users)
//     let relatedEmails = await Email.findAll({
//       where: {
//         [Sequelize.Op.or]: [
//           { messageId: { [Sequelize.Op.in]: threadIds } },
//           { inReplyTo: { [Sequelize.Op.in]: threadIds } },
//           {
//             references: {
//               [Sequelize.Op.or]: threadIds.map((id) => ({
//                 [Sequelize.Op.like]: `%${id}%`,
//               })),
//             },
//           },
//         ],
//         masterUserID,
//         folder: { [Sequelize.Op.in]: ["inbox", "sent"] },
//       },
//       include: [{ model: Attachment, as: "attachments" }],
//       order: [["createdAt", "ASC"]],
//     });

//     // Remove the main email from relatedEmails (by messageId)
//     relatedEmails = relatedEmails.filter(email => email.messageId !== mainEmail.messageId);

//     // Deduplicate relatedEmails by messageId (keep the first occurrence)
//     const seen = new Set();
//     relatedEmails = relatedEmails.filter(email => {
//       if (seen.has(email.messageId)) return false;
//       seen.add(email.messageId);
//       return true;
//     });

//     // Clean the body and attachment paths for related emails
//     relatedEmails.forEach((email) => {
//       email.body = cleanEmailBody(email.body);
//       email.attachments = email.attachments.map((attachment) => ({
//         ...attachment,
//         path: `${baseURL}/uploads/attachments/${attachment.filename}`,
//       }));
//     });

//     res.status(200).json({
//       message: "Email fetched successfully.",
//       data: {
//         email: mainEmail,
//         relatedEmails,
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching email:", error);
//     res.status(500).json({ message: "Internal server error." });
//   }
// };

exports.getOneEmail = async (req, res) => {
  const { emailId } = req.params;
  const masterUserID = req.adminId; // Assuming adminId is set in middleware

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
    });

    if (!mainEmail) {
      return res.status(404).json({ message: "Email not found." });
    }

    // Mark as read if not already
    if (!mainEmail.isRead) {
      await mainEmail.update({ isRead: true });
    }

    // Clean the body of the main email
    mainEmail.body = cleanEmailBody(mainEmail.body);

    // Add baseURL to attachment paths
    const baseURL = process.env.LOCALHOST_URL;
    mainEmail.attachments = mainEmail.attachments.map((attachment) => ({
      ...attachment,
      path: `${baseURL}/uploads/attachments/${attachment.filename}`,
    }));

    // If this is a draft or trash, do NOT fetch related emails
    if (mainEmail.folder === "drafts") {
      return res.status(200).json({
        message: "Draft email fetched successfully.",
        data: {
          email: mainEmail,
          relatedEmails: [],
        },
      });
    }
    if (mainEmail.folder === "trash") {
      return res.status(200).json({
        message: "trash email fetched successfully.",
        data: {
          email: mainEmail,
          relatedEmails: [],
        },
      });
    }

    // Gather all thread IDs (messageId, inReplyTo, references)
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
        folder: { [Sequelize.Op.in]: ["inbox","sent"] },
      },
      include: [
        {
          model: Attachment,
          as: "attachments",
        },
      ],
      order: [["createdAt", "ASC"]],
    });
// Remove the main email from relatedEmails
//relatedEmails = relatedEmails.filter(email => email.emailID !== mainEmail.emailID);
// Remove the main email from relatedEmails (by messageId)

relatedEmails = relatedEmails.filter(email => email.messageId !== mainEmail.messageId);

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
allEmails = allEmails.filter(email => {
  if (seen.has(email.messageId)) return false;
  seen.add(email.messageId);
  return true;
});
const emailMap = {};
allEmails.forEach(email => {
  emailMap[email.messageId] = email;
});
const conversation = [];
let current = allEmails.find(email => !email.inReplyTo || !emailMap[email.inReplyTo]);
while (current) {
  conversation.push(current);
  // Find the next email that replies to the current one
  current = allEmails.find(email => email.inReplyTo === conversation[conversation.length - 1].messageId);
}

// // If some emails are not in the chain (e.g., forwards), add them by date
const remaining = allEmails.filter(email => !conversation.includes(email));
remaining.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
conversation.push(...remaining);

// // The first is the main email, the rest are related
// const sortedMainEmail = conversation[0];
// const sortedRelatedEmails = conversation.slice(1);

    // Clean the body and attachment paths for related emails
    relatedEmails.forEach((email) => {
      email.body = cleanEmailBody(email.body);
      email.attachments = email.attachments.map((attachment) => ({
        ...attachment,
        path: `${baseURL}/uploads/attachments/${attachment.filename}`,
      }));
    });

    // res.status(200).json({
    //   message: "Email fetched successfully.",
    //   data: {
    //     email: mainEmail,
    //     relatedEmails,
    //   },
    // });
    // Sort relatedEmails by createdAt ascending (oldest to newest)
    //  allEmails.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

// The oldest email is the main email, the rest are relatedEmails
// const sortedMainEmail = allEmails[0];
// const sortedRelatedEmails = allEmails.slice(1);
const sortedMainEmail = conversation[0];
const sortedRelatedEmails = conversation.slice(1);

res.status(200).json({
  message: "Email fetched successfully.",
  data: {
    email: sortedMainEmail,
    relatedEmails: sortedRelatedEmails,
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
  bccList = bcc.split(",").map(e => e.trim()).filter(Boolean);
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

  finalSubject = originalEmail.subject.startsWith("Re:") ? originalEmail.subject : `Re: ${originalEmail.subject}`;
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

  finalSubject = originalEmail.subject.startsWith("Re:") ? originalEmail.subject : `Re: ${originalEmail.subject}`;
  finalBody = `${text || html}`;

  // Build recipients: all original To and CC, plus sender, except yourself
  const currentUserEmail = SENDER_EMAIL.toLowerCase();
  const allTo = (originalEmail.recipient || "").split(",").map(e => e.trim().toLowerCase());
  const allCc = (originalEmail.cc || "").split(",").map(e => e.trim().toLowerCase());
  const replyAllList = [originalEmail.sender, ...allTo, ...allCc]
    .filter(email => email && email !== currentUserEmail);
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

  finalSubject = originalEmail.subject.startsWith("Fwd:") ? originalEmail.subject : `Fwd: ${originalEmail.subject}`;
  finalBody = `${text || html}<br><br>---------- Forwarded message ----------<br>
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

      // Send the email
      // const info = await transporter.sendMail(mailOptions);
      // await publishToQueue("EMAIL_QUEUE", { emailID: savedEmail.emailID });


      // let savedEmail;
      // let savedAttachments = [];
      // console.log(draftId, ".............");

      // // if (draftId) {
      //   // Update the existing draft record to be a sent email
      //   savedEmail = await draftEmail.update({
      //     // messageId: info.messageId,
      //     inReplyTo: inReplyToHeader || null,
      //     references: referencesHeader || null,
      //     sender: SENDER_EMAIL,
      //     senderName: SENDER_NAME,
      //     recipient: to || draftEmail.recipient,
      //     cc: cc || draftEmail.cc,
      //     bcc: bcc || draftEmail.bcc,
      //     subject: finalSubject,
      //     body: `${text || html}`,
      //     folder: "sent",
      //     createdAt: new Date(),
      //     masterUserID,
      //     tempMessageId,
      //   });

      //   // Update attachments if new ones are uploaded
      //   if (req.files && req.files.length > 0) {
      //     await Attachment.destroy({ where: { emailID: draftEmail.emailID } });
      //      const baseURL = process.env.LOCALHOST_URL || "http://localhost:3056";
      //     savedAttachments = req.files.map((file) => ({
      //             emailID: savedEmail.emailID,
      //     filename: file.filename,
      //     filePath: `${baseURL}/uploads/attachments/${encodeURIComponent(
      //       file.filename
      //     )}`, // Save public URL in DB
      //     size: file.size,
      //     contentType: file.mimetype,
      //     }));
      //     await Attachment.bulkCreate(savedAttachments);
      //   } else {
      //     // If no new attachments, fetch existing ones for response
      //     savedAttachments = await Attachment.findAll({
      //       where: { emailID: draftEmail.emailID },
      //     });
      //   }
      // } else {
        // ... (your existing logic for new sent emails) ...
const baseURL = process.env.LOCALHOST_URL;
//         const attachments = req.files && req.files.length > 0
//   ? req.files.map((file) => ({
//       filename: file.filename,
//       originalname: file.originalname,
//       path: `${baseURL}/uploads/attachments/${encodeURIComponent(file.filename)}`, // <-- public URL
//       size: file.size,
//       contentType: file.mimetype,
//     }))
//   : [];
  
      let attachments = [];
      if (req.files && req.files.length > 0) {
        attachments = req.files.map((file) => ({
          filename: file.filename,
          originalname: file.originalname,
          // path: file.path,
          path: `${baseURL}/uploads/attachments/${encodeURIComponent(file.filename)}`, // <-- public URL
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
          originalname:att.originalname || att.filename,
          path: att.filePath || att.path, // use filePath or path
          size: att.size,
          contentType: att.contentType,
        }));
      }

  const finalTo = to || (draftEmail && draftEmail.recipient);
const finalCc = cc || (draftEmail && draftEmail.cc);
const finalBccValue = finalBcc || bcc || (draftEmail && draftEmail.bcc);

if (!finalTo && !finalCc && !finalBccValue) {
  return res.status(400).json({ message: "At least one recipient (to, cc, bcc) is required." });
}
        const emailData = {
          // messageId: info.messageId,
          draftId:draftId || null,
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
          attachments
          // isShared: isShared === true || isShared === "true", // ensure boolean
        };

         await publishToQueue("EMAIL_QUEUE", emailData);
      // }
    

      // Generate public URLs for attachments
      // const attachmentLinks = savedAttachments.map((attachment) => ({
      //   filename: attachment.filename,
      //   link: `${process.env.LOCALHOST_URL}/uploads/attachments/${attachment.filename}`,
      // }));
// await publishToQueue("EMAIL_QUEUE", { emailID: savedEmail.emailID });
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
    imapHost,      // <-- Add these lines
    imapPort,
    imapTLS,
    smtpHost,
    smtpPort,
    smtpSecure
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

    // Prepare the fields to update
    // const updateData = {};
    // if (email) updateData.email = email;
    // if (appPassword) updateData.appPassword = appPassword;
    // if (syncStartDate) updateData.syncStartDate = syncStartDate;
    // if (syncFolders) updateData.syncFolders = syncFolders;
    // if (syncAllFolders !== undefined)
    //   updateData.syncAllFolders = syncAllFolders;
    // if (isTrackOpenEmail !== undefined)
    //   updateData.isTrackOpenEmail = isTrackOpenEmail;
    // if (isTrackClickEmail !== undefined)
    //   updateData.isTrackClickEmail = isTrackClickEmail;
    // if (blockedEmail !== undefined) updateData.blockedEmail = blockedEmail; // <-- Add this line

        const updateData = {};
    if (email) updateData.email = email;
    if (appPassword) updateData.appPassword = appPassword;
    if (syncStartDate) updateData.syncStartDate = syncStartDate;
    if (syncFolders) updateData.syncFolders = syncFolders;
    if (syncAllFolders !== undefined) updateData.syncAllFolders = syncAllFolders;
    if (isTrackOpenEmail !== undefined) updateData.isTrackOpenEmail = isTrackOpenEmail;
    if (isTrackClickEmail !== undefined) updateData.isTrackClickEmail = isTrackClickEmail;
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
    filePath: `${baseURL}/uploads/attachments/${encodeURIComponent(file.filename)}`,
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

      // // Fetch the full email data with attachments for response
      // const fullEmail = await Email.findOne({
      //   where: { emailID: scheduledEmail.emailID },
      //   include: [
      //     {
      //       model: Attachment,
      //       as: "attachments",
      //     },
      //   ],
      // });

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