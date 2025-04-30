const Imap = require("imap-simple");
const Email = require("../../models/email/emailModel");
const { htmlToText } = require("html-to-text");
const { simpleParser } = require("mailparser");
const Attachment = require("../../models/email/attachmentModel");
const Template = require("../../models/email/templateModel");
const { Sequelize } = require("sequelize");
const nodemailer = require("nodemailer");

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
  const { batchSize = 5, page = 1 } = req.query;

  try {
    console.log("Connecting to IMAP server...");
    const connection = await Imap.connect(imapConfig);

    console.log("Opening INBOX...");
    await connection.openBox("INBOX");

    console.log("Fetching emails from the last 7 days...");
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

    // Pagination logic
    const startIndex = (page - 1) * batchSize;
    const endIndex = startIndex + parseInt(batchSize);
    const batchMessages = messages.slice(startIndex, endIndex);

    if (batchMessages.length === 0) {
      console.log("No more emails to fetch.");
      return res.status(200).json({ message: "No more emails to fetch." });
    }

    const inboxEmails = [];

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
        body: parsedEmail.text || parsedEmail.html || null,
        folder: "inbox",
        createdAt: parsedEmail.date || new Date(),
      };

      console.log(`Processing email: ${emailData.messageId}`);
      inboxEmails.push(emailData);

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

      // Save attachments
      if (parsedEmail.attachments && parsedEmail.attachments.length > 0) {
        const attachments = parsedEmail.attachments.map((attachment) => ({
          emailID: savedEmail.emailID,
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.size,
        }));

        await Attachment.bulkCreate(attachments);
        console.log(
          `Saved ${attachments.length} attachments for email: ${emailData.messageId}`
        );
      }
    }

    connection.end();
    console.log("IMAP connection closed.");

    res.status(200).json({
      message: `Fetched and saved ${inboxEmails.length} emails.`,
      currentPage: parseInt(page),
      totalEmails: messages.length,
    });
  } catch (error) {
    console.error("Error fetching inbox emails:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Fetch and store the most recent email
exports.fetchRecentEmail = async (req, res) => {
  try {
    console.log("Connecting to IMAP server...");
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
      return res.status(200).json({ message: "No emails found." });
    }

    // Get the most recent email
    const recentMessage = messages[messages.length - 1];
    const rawBodyPart = recentMessage.parts.find((part) => part.which === "");
    const rawBody = rawBodyPart ? rawBodyPart.body : null;

    if (!rawBody) {
      console.log("No body found for the most recent email.");
      return res
        .status(200)
        .json({ message: "No body found for the most recent email." });
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
      body: parsedEmail.text || parsedEmail.html || null,
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
    if (parsedEmail.attachments && parsedEmail.attachments.length > 0) {
      const attachments = parsedEmail.attachments.map((attachment) => ({
        emailID: savedEmail.emailID,
        filename: attachment.filename,
        contentType: attachment.contentType,
        size: attachment.size,
      }));

      await Attachment.bulkCreate(attachments);
      console.log(
        `Saved ${attachments.length} attachments for email: ${emailData.messageId}`
      );
    }

    connection.end(); // Close the connection
    console.log("IMAP connection closed.");

    res.status(200).json({
      message: "Fetched and saved the most recent email.",
      email: emailData,
    });
  } catch (error) {
    console.error("Error fetching recent email:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Fetch and store emails from the Drafts folder using batching
exports.fetchDraftEmails = async (req, res) => {
  const { batchSize = 2, page = 1 } = req.query;

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
        body: parsedEmail.text || parsedEmail.html || null, // Prefer plain text, fallback to HTML
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
  const { batchSize = 5, page = 1, days = 7 } = req.query;

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
        body: parsedEmail.text || parsedEmail.html || null,
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
  const { page = 1, pageSize = 10, folder, search, isRead } = req.query;

  try {
    // Build the query filters dynamically
    const filters = {};

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
      offset,
      limit,
      order: [["createdAt", "DESC"]], // Sort by most recent emails
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

    // Return the paginated response with threads
    res.status(200).json({
      message: "Emails fetched successfully.",
      currentPage: parseInt(page),
      totalPages: Math.ceil(count / pageSize),
      totalEmails: count,
      threads: Object.values(threads), // Return grouped threads
    });
  } catch (error) {
    console.error("Error fetching emails:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Fetch and store emails from the Sent folder using batching
exports.fetchSentEmails = async (req, res) => {
  const { batchSize = 5, page = 1 } = req.query;

  try {
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
        sender: parsedEmail.from ? parsedEmail.from.value[0].address : null,
        senderName: parsedEmail.from ? parsedEmail.from.value[0].name : null,
        recipient: parsedEmail.to ? parsedEmail.to.value[0].address : null,
        recipientName: parsedEmail.to ? parsedEmail.to.value[0].name : null,
        subject: parsedEmail.subject || null,
        body: parsedEmail.text || parsedEmail.html || null,
        folder: "sent",
        createdAt: parsedEmail.date || new Date(),
      };

      console.log(`Processing sent email: ${emailData.messageId}`);
      sentEmails.push(emailData);

      const existingEmail = await Email.findOne({
        where: { messageId: emailData.messageId },
      });
      if (!existingEmail) {
        await Email.create(emailData);
        console.log(`Sent email saved: ${emailData.messageId}`);
      } else {
        console.log(`Sent email already exists: ${emailData.messageId}`);
      }
    }

    connection.end();
    console.log("IMAP connection closed.");

    res.status(200).json({
      message: `Fetched and saved ${sentEmails.length} sent emails.`,
      currentPage: parseInt(page),
      totalSent: messages.length,
    });
  } catch (error) {
    console.error("Error fetching sent emails:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.getOneEmail = async (req, res) => {
  const { emailId } = req.params;

  try {
    // Fetch the email by emailId
    const email = await Email.findOne({
      where: { emailID: emailId },
    });

    if (!email) {
      return res.status(404).json({ message: "Email not found." });
    }

    // Initialize the response with the main email
    const response = {
      email,
    };

    // Check if the email has an inReplyTo field
    if (email.inReplyTo) {
      console.log(`Fetching related emails for thread: ${email.inReplyTo}`);

      // Fetch related emails in the same thread
      const relatedEmails = await Email.findAll({
        where: {
          [Sequelize.Op.or]: [
            { messageId: email.inReplyTo }, // The parent email
            { inReplyTo: email.inReplyTo }, // Other replies in the thread
          ],
        },
        order: [["createdAt", "ASC"]], // Sort by date
      });

      // Add related emails to the response only if they exist
      if (relatedEmails.length > 0) {
        response.relatedEmails = relatedEmails;
      }
    }

    res.status(200).json({
      message: "Email fetched successfully.",
      data: response,
    });
  } catch (error) {
    console.error("Error fetching email:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.composeEmail = async (req, res) => {
  const { to, subject, text, html, attachments, templateID, placeholders } =
    req.body;

  try {
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

    // Create a transporter using your email credentials
    const transporter = nodemailer.createTransport({
      service: "gmail", // Use your email provider (e.g., Gmail, Outlook)
      auth: {
        user: process.env.SENDER_EMAIL, // Your email address
        pass: process.env.SENDER_PASSWORD, // Your email password or app password
      },
    });

    // Define the email options
    const mailOptions = {
      from: process.env.SENDER_EMAIL, // Sender's email address
      to, // Recipient's email address
      subject: finalSubject, // Final subject after placeholder replacement
      text: finalBody, // Final body after placeholder replacement
      html: finalBody, // HTML body (optional)
      attachments, // Attachments (optional)
    };

    // Send the email
    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent: ", info.messageId);

    // Save the email in the database
    const emailData = {
      messageId: info.messageId,
      sender: process.env.SENDER_EMAIL,
      senderName: process.env.SENDER_NAME, // Replace with the sender's name if available
      recipient: to,
      recipientName: null, // You can extract the recipient's name if needed
      subject: finalSubject,
      body: finalBody,
      folder: "sent", // Mark as sent
      createdAt: new Date(),
    };

    const savedEmail = await Email.create(emailData);
    console.log("Composed email saved in the database:", savedEmail);

    res.status(200).json({
      message: "Email sent and saved successfully.",
      messageId: info.messageId,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    res
      .status(500)
      .json({ message: "Failed to send email.", error: error.message });
  }
};

exports.createTemplate = async (req, res) => {
  const { name, subject, body, placeholders } = req.body;

  try {
    // Save the template in the database
    const templateData = {
      name,
      subject,
      body,
      placeholders, // Optional: Array of placeholder names (e.g., ["{{name}}", "{{date}}"])
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
  try {
    console.log("error..................///");

    const templates = await Template.findAll();
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

  try {
    const template = await Template.findOne({
      where: { templateID },
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
