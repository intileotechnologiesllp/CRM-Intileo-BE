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
const { log } = require("console");

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

const upload = multer({ storage });

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

// Fetch emails from the inbox in batches
exports.fetchInboxEmails = async (req, res) => {
  const { batchSize = 50, page = 1, days = 7 } = req.query;
  const masterUserID = req.adminId; // Assuming adminId is set in middleware
  const email = req.email; // Get email from the request body
  const appPassword = req.body.appPassword;

  try {
    // Validate input
    if (!masterUserID || !email || !appPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Check if the user already has credentials saved
    const existingCredential = await UserCredential.findOne({
      where: { masterUserID },
    });

    if (existingCredential) {
      // Update existing credentials
      await existingCredential.update({ email, appPassword });
      console.log(`User credentials updated for masterUserID: ${masterUserID}`);
    } else {
      // Create new credentials
      await UserCredential.create({
        masterUserID,
        email,
        appPassword,
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
    const imapConfig = {
      imap: {
        user: userEmail,
        password: userPassword,
        host: "imap.gmail.com",
        port: 993,
        tls: true,
        authTimeout: 30000,
        tlsOptions: {
          rejectUnauthorized: false,
        },
      },
    };

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

    // Fetch emails from Inbox, Drafts, Archive, and Sent folders
    console.log("Fetching emails from Inbox...");
    await fetchEmailsFromFolder("INBOX", "inbox");

    console.log("Fetching emails from Drafts...");
    await fetchEmailsFromFolder("[Gmail]/Drafts", "drafts");

    console.log("Fetching emails from Archive...");
    await fetchEmailsFromFolder("[Gmail]/All Mail", "archive");

    console.log("Fetching emails from Sent...");
    await fetchEmailsFromFolder("[Gmail]/Sent Mail", "sent");

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
    console.log(userPassword);
    console.log(userEmail);

    console.log("Connecting to IMAP server...");
    const imapConfig = {
      imap: {
        user: userEmail, // Use the email from the database
        password: userPassword, // Use the app password from the database
        host: "imap.gmail.com", // IMAP host (e.g., Gmail)
        port: 993, // IMAP port
        tls: true, // Use TLS
        authTimeout: 30000,
        tlsOptions: {
          rejectUnauthorized: false, // Allow self-signed certificates
        },
      },
    };

    const connection = await Imap.connect(imapConfig);

    console.log("Opening INBOX...");
    await connection.openBox("INBOX");

    console.log("Fetching the most recent email...");
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

    const emailData = {
      messageId: parsedEmail.messageId || null,
      inReplyTo: parsedEmail.headers.get("in-reply-to") || null,
      references: parsedEmail.headers.get("references") || null,
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
      body: cleanEmailBody(parsedEmail.text || parsedEmail.html || ""),
      folder: "inbox",
      createdAt: parsedEmail.date || new Date(),
    };

    console.log(`Processing recent email: ${emailData.messageId}`);
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
  const { page = 1, pageSize = 80, folder, search, isRead } = req.query;
  const masterUserID = req.adminId; // Assuming adminId is set in middleware

  try {
    const filters = {
      masterUserID, // Filter emails by the specific user
    };

    // Filter by folder (e.g., inbox, drafts, archive)
    if (folder) {
      filters.folder = folder;
    }

    // Filter by read/unread status
    if (isRead !== undefined) {
      filters.isRead = isRead === "true"; // Convert string to boolean
    }

    // Search by subject, sender, or recipient
    if (search) {
      filters[Sequelize.Op.or] = [
        { subject: { [Sequelize.Op.like]: `%${search}%` } },
        { sender: { [Sequelize.Op.like]: `%${search}%` } },
        { recipient: { [Sequelize.Op.like]: `%${search}%` } },
      ];
    }

    // Pagination logic
    const offset = (page - 1) * pageSize;
    const limit = parseInt(pageSize);

    // Fetch emails from the database
    const { count, rows: emails } = await Email.findAndCountAll({
      where: filters,
      include: [
        {
          model: Attachment,
          as: "attachments", // Alias defined in the relationship
        },
      ],
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

    // Group emails by conversation (thread)
    const threads = {};
    emails.forEach((email) => {
      const threadId = email.inReplyTo || email.messageId; // Use inReplyTo or messageId as thread identifier
      if (!threads[threadId]) {
        threads[threadId] = [];
      }
      threads[threadId].push(email);
    });

    // Return the paginated response with threads and unviewCount
    res.status(200).json({
      message: "Emails fetched successfully.",
      currentPage: parseInt(page),
      totalPages: Math.ceil(count / pageSize),
      totalEmails: count,
      unviewCount, // Include the unviewCount field
      threads: Object.values(threads), // Return grouped threads
      // threads: emailsWithAttachments,
    });
  } catch (error) {
    console.error("Error fetching emails:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Fetch and store emails from the Sent folder using batching
exports.fetchSentEmails = async (adminId,batchSize=50,page=1) => {


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
    const imapConfig = {
      imap: {
        user: userEmail, // Use the email from the database
        password: userPassword, // Use the app password from the database
        host: "imap.gmail.com", // IMAP host (e.g., Gmail)
        port: 993, // IMAP port
        tls: true, // Use TLS
        authTimeout: 30000,
        tlsOptions: {
          rejectUnauthorized: false, // Allow self-signed certificates
        },
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
        where: { messageId: emailData.messageId },
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

exports.getOneEmail = async (req, res) => {
  const { emailId } = req.params;

  try {
    // Fetch the main email by emailId, including attachments
    const mainEmail = await Email.findOne({
      where: { emailID: emailId },
      include: [
        {
          model: Attachment,
          as: "attachments", // Alias defined in the relationship
        },
      ],
    });

    if (!mainEmail) {
      return res.status(404).json({ message: "Email not found." });
    }

    console.log(`Fetching related emails for thread: ${mainEmail.messageId}`);

    // Update the isRead column to true
    if (!mainEmail.isRead) {
      await mainEmail.update({ isRead: true });
      console.log(`Email marked as read: ${mainEmail.messageId}`);
    }

    // Fetch related emails in the same thread, including their attachments
    const relatedEmails = await Email.findAll({
      where: {
        [Sequelize.Op.or]: [
          { messageId: mainEmail.inReplyTo }, // Parent email
          { inReplyTo: mainEmail.messageId }, // Replies to this email
          { references: { [Sequelize.Op.like]: `%${mainEmail.messageId}%` } }, // Emails in the same thread
        ],
      },
      include: [
        {
          model: Attachment,
          as: "attachments", // Alias defined in the relationship
        },
      ],
      order: [["createdAt", "ASC"]], // Sort by date
    });

    // Clean the body of the main email
    mainEmail.body = cleanEmailBody(mainEmail.body);

    // Clean the body of each related email
    relatedEmails.forEach((email) => {
      email.body = cleanEmailBody(email.body);
    });

    // Add baseURL to attachment paths
    const baseURL = process.env.LOCALHOST_URL;
    mainEmail.attachments = mainEmail.attachments.map((attachment) => ({
      ...attachment,
      path: `${baseURL}/uploads/attachments/${attachment.filename}`, // Add baseURL to the path
    }));

    relatedEmails.forEach((email) => {
      email.attachments = email.attachments.map((attachment) => ({
        ...attachment,
        path: `${baseURL}/uploads/attachments/${attachment.filename}`, // Add baseURL to the path
      }));
    });

    // Combine the main email and related emails in the response
    res.status(200).json({
      message: "Email fetched successfully.",
      data: {
        email: mainEmail,
        relatedEmails,
      },
    });
  } catch (error) {
    console.error("Error fetching email:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.composeEmail = [
  upload.array("attachments"), // Use Multer to handle multiple file uploads
  async (req, res) => {
    const { to, cc, bcc, subject, text, html, templateID, placeholders } =
      req.body;
    const masterUserID = req.adminId; // Assuming `adminId` is set in middleware

    try {
      // Fetch the user's credentials from the UserCredential database
      const userCredential = await UserCredential.findOne({
        where: { masterUserID },
      });

      if (!userCredential) {
        return res
          .status(404)
          .json({ message: "User credentials not found for the given user." });
      }

      const SENDER_EMAIL = userCredential.email;
      const SENDER_PASSWORD = userCredential.appPassword;

      let finalSubject = subject;
      let finalBody = text || html;

      // If a templateID is provided, fetch the template and replace placeholders
      if (templateID) {
        const template = await Template.findOne({
          where: { templateID },
        });

        if (!template) {
          return res.status(404).json({ message: "Template not found." });
        }

        // Replace placeholders in the template subject and body
        finalSubject = template.subject;
        finalBody = template.body;

        if (placeholders) {
          for (const key in placeholders) {
            const placeholder = `{{${key}}}`;
            finalSubject = finalSubject.replace(placeholder, placeholders[key]);
            finalBody = finalBody.replace(placeholder, placeholders[key]);
          }
        }
      }

      // // Prepare attachments for nodemailer
      // const formattedAttachments = req.files.map((file) => ({
      //   filename: file.originalname,
      //   path: file.path, // Use the file path from Multer
      // }));
            // Prepare attachments for nodemailer
            const formattedAttachments = req.files && req.files.length > 0
            ? req.files.map((file) => ({
                filename: file.originalname,
                path: file.path, // Use the file path from Multer
              }))
            : [];

      // Create a transporter using the user's email credentials
      const transporter = nodemailer.createTransport({
        service: "gmail", // Use your email provider (e.g., Gmail, Outlook)
        auth: {
          user: SENDER_EMAIL, // Fetch from UserCredential
          pass: SENDER_PASSWORD, // Fetch from UserCredential
        },
      });

      // Define the email options
      const mailOptions = {
        from: SENDER_EMAIL, // Sender's email address
        to, // Recipient's email address
        cc, // CC recipients
        bcc, // BCC recipients
        subject: finalSubject, // Final subject after placeholder replacement
        text: finalBody, // Final body after placeholder replacement
        html: finalBody, // HTML body (optional)
        // attachments: formattedAttachments, // Attachments with file paths
        attachments: formattedAttachments.length > 0 ? formattedAttachments : undefined, // Include attachments only if they exist
      };

      // Send the email
      const info = await transporter.sendMail(mailOptions);

      console.log("Email sent: ", info.messageId);

      // Save the email in the database
      const emailData = {
        messageId: info.messageId,
        sender: SENDER_EMAIL,
        senderName: null, // Replace with the sender's name if available
        recipient: to,
        cc, // Save CC recipients
        bcc, // Save BCC recipients
        recipientName: null, // You can extract the recipient's name if needed
        subject: finalSubject,
        body: finalBody,
        folder: "sent", // Mark as sent
        createdAt: new Date(),
        masterUserID, // Associate the email with the user
      };

      const savedEmail = await Email.create(emailData);
      console.log("Composed email saved in the database:", savedEmail);

      // // Save attachments in the database
      // const savedAttachments = req.files.map((file) => ({
      //   emailID: savedEmail.emailID,
      //   filename: file.originalname,
      //   path: file.path,
      // }));

      // await Attachment.bulkCreate(savedAttachments);
      // console.log(
      //   `Saved ${savedAttachments.length} attachments for email: ${emailData.messageId}`
      // );

      // // Generate public URLs for attachments
      // const attachmentLinks = savedAttachments.map((attachment) => ({
      //   filename: attachment.filename,
      //   link: `${process.env.LOCALHOST_URL}/uploads/attachments/${attachment.filename}`, // Public URL for the attachment
      // }));
      const savedAttachments = req.files && req.files.length > 0
  ? req.files.map((file) => ({
      emailID: savedEmail.emailID,
      filename: file.originalname,
      path: file.path,
    }))
  : [];

if (savedAttachments.length > 0) {
  await Attachment.bulkCreate(savedAttachments);
  console.log(
    `Saved ${savedAttachments.length} attachments for email: ${emailData.messageId}`
  );
}

// Generate public URLs for attachments
const attachmentLinks = savedAttachments.map((attachment) => ({
  filename: attachment.filename,
  link: `${process.env.LOCALHOST_URL}/uploads/attachments/${attachment.filename}`, // Public URL for the attachment
}));

      res.status(200).json({
        message: "Email sent and saved successfully.",
        messageId: info.messageId,
        attachments: attachmentLinks, // Include attachment links in the response
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
  const { name, subject, body, placeholders, isShared } = req.body;
  const masterUserID = req.adminId; // Assuming `adminId` is set in middleware

  try {
    // Save the template in the database
    const templateData = {
      name,
      subject,
      body,
      placeholders,
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
  const masterUserID = req.adminId; // Assuming `adminId` is set in middleware

  try {
    // Define all possible folders
    const allFolders = ["inbox", "drafts", "sent", "archive"];

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
  const email = req.email; // Get email from req.user
  const appPassword = req.body.appPassword; // Get appPassword from the request body

  try {
    // Validate input
    if (!masterUserID || !email || !appPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Check if the user already has credentials saved
    const existingCredential = await UserCredential.findOne({
      where: { masterUserID },
    });

    if (existingCredential) {
      // Update existing credentials
      await existingCredential.update({ email, appPassword });
      console.log(`User credentials updated for masterUserID: ${masterUserID}`);

      return res.status(200).json({
        message: "User credentials updated successfully and emails fetched.",
      });
    }

    // Create new credentials
    const newCredential = await UserCredential.create({
      masterUserID,
      email,
      appPassword,
    });

    res.status(201).json({
      message: "User credentials added successfully.",
      credential: newCredential,
    });
  } catch (error) {
    console.error("Error adding user credentials:", error);
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
      credential: {
        email: userCredential.email,
        appPassword: userCredential.appPassword, // You may want to exclude this in production for security reasons
      },
    });
  } catch (error) {
    console.error("Error fetching user credentials:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};