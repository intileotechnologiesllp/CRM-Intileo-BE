const Imap = require("imap-simple");
const Email = require("../../models/email/emailModel");
const { htmlToText } = require("html-to-text");

const imapConfig = {
  imap: {
    user: process.env.EMAIL_USER, // Your email address
    password: process.env.EMAIL_PASS, // Your email password
    host: "imap.gmail.com", // IMAP host (e.g., Gmail)
    port: 993, // IMAP port
    tls: true, // Use TLS
    authTimeout: 10000,
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
  const { batchSize = 5, page = 1 } = req.query; // Batch size and page number from query params

  try {
    console.log("Connecting to IMAP server...");
    const connection = await Imap.connect(imapConfig);

    console.log("Opening INBOX...");
    await connection.openBox("INBOX");

    console.log("Searching for emails...");
    const startTime = Date.now();

    // Fetch emails from the last 7 days
    const sinceDate = formatDateForIMAP(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ); // 7 days ago
    console.log(`Using SINCE date: ${sinceDate}`); // Log the formatted date

    // Ensure the date is passed as a string
    const searchCriteria = [["SINCE", sinceDate]];
    const fetchOptions = {
      bodies: ["HEADER", "TEXT"],
      struct: true,
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    const endTime = Date.now();
    console.log(`Emails fetched in ${(endTime - startTime) / 1000} seconds.`);
    console.log(`Total emails found: ${messages.length}`);

    // Calculate pagination
    const startIndex = (page - 1) * batchSize;
    const endIndex = startIndex + parseInt(batchSize);
    const batchMessages = messages.slice(startIndex, endIndex);

    if (batchMessages.length === 0) {
      console.log("No more emails to fetch.");
      return res.status(200).json({ message: "No more emails to fetch." });
    }

    console.log(`Processing ${batchMessages.length} emails...`);
    for (const message of batchMessages) {
      const header = message.parts.find((part) => part.which === "HEADER").body;
      const body = message.parts.find((part) => part.which === "TEXT").body;
      const plainTextBody = htmlToText(body || "", {
        wordwrap: 130, // Wrap text at 130 characters
      });
      const emailData = {
        messageId: header["message-id"] ? header["message-id"][0] : null,
        sender: header.from ? header.from[0] : null,
        recipient: header.to ? header.to[0] : null,
        subject: header.subject ? header.subject[0] : null,
        body: plainTextBody || null,
        folder: "inbox",
        createdAt: header.date ? new Date(header.date[0]) : new Date(),
      };

      console.log(`Processing email: ${emailData.messageId}`);
      const existingEmail = await Email.findOne({
        where: { messageId: emailData.messageId },
      });
      if (!existingEmail) {
        await Email.create(emailData);
        console.log(`Email saved: ${emailData.messageId}`);
      } else {
        console.log(`Email already exists: ${emailData.messageId}`);
      }
    }

    connection.end(); // Close the connection
    console.log("IMAP connection closed.");

    res.status(200).json({
      message: `Fetched and saved ${batchMessages.length} emails.`,
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
    const startTime = Date.now();
    const sinceDate = formatDateForIMAP(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    // Fetch only the latest email using UID
    // const searchCriteria = ["UID", "*"]; // Fetch the latest email by UID
    const searchCriteria = [["SINCE", sinceDate]];
    const fetchOptions = {
      bodies: ["HEADER", "TEXT"],
      struct: true,
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    const endTime = Date.now();
    console.log(`Emails fetched in ${(endTime - startTime) / 1000} seconds.`);
    console.log(`Total emails found: ${messages.length}`);

    if (messages.length === 0) {
      console.log("No emails found.");
      return res.status(200).json({ message: "No emails found." });
    }

    // Get the most recent email
    const recentMessage = messages[messages.length - 1];
    const header = recentMessage.parts.find(
      (part) => part.which === "HEADER"
    ).body;
    const body = recentMessage.parts.find((part) => part.which === "TEXT").body;
    const plainTextBody = htmlToText(body || "", {
      wordwrap: 130, // Wrap text at 130 characters
    });
    const emailData = {
      messageId: header["message-id"] ? header["message-id"][0] : null,
      sender: header.from ? header.from[0] : null,
      recipient: header.to ? header.to[0] : null,
      subject: header.subject ? header.subject[0] : null,
      body: plainTextBody || null,
      folder: "inbox",
      createdAt: header.date ? new Date(header.date[0]) : new Date(),
    };

    console.log(`Processing recent email: ${emailData.messageId}`);
    const existingEmail = await Email.findOne({
      where: { messageId: emailData.messageId },
    });
    if (!existingEmail) {
      await Email.create(emailData);
      console.log(`Recent email saved: ${emailData.messageId}`);
    } else {
      console.log(`Recent email already exists: ${emailData.messageId}`);
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

// Fetch and store 2 emails from the Drafts folder using batching
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
      bodies: ["HEADER", "TEXT"],
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
      const header = message.parts.find((part) => part.which === "HEADER").body;
      const body = message.parts.find((part) => part.which === "TEXT").body;
      const plainTextBody = htmlToText(body || "", {
        wordwrap: 130, // Wrap text at 130 characters
      });

      const emailData = {
        messageId: header["message-id"] ? header["message-id"][0] : null,
        sender: header.from ? header.from[0] : null,
        recipient: header.to ? header.to[0] : null,
        subject: header.subject ? header.subject[0] : null,
        body: plainTextBody || null,
        folder: "drafts",
        createdAt: header.date ? new Date(header.date[0]) : new Date(),
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
  const { batchSize = 2, page = 1, days = 7 } = req.query; // Default batch size is 2, and fetch emails from the last 7 days

  try {
    console.log("Connecting to IMAP server...");
    const connection = await Imap.connect(imapConfig);

    console.log("Opening Archive folder...");
    await connection.openBox("[Gmail]/All Mail"); // Adjust the folder name based on the output of getBoxes()

    console.log("Fetching emails from Archive...");
    const sinceDate = formatDateForIMAP(
      new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    ); // Fetch emails from the last 'days'
    console.log(`Using SINCE date: ${sinceDate}`);

    const fetchOptions = {
      bodies: ["HEADER", "TEXT"],
      struct: true,
    };

    // Ensure the date is passed as a string
    const searchCriteria = [["SINCE", sinceDate]];
    const messages = await connection.search(searchCriteria, fetchOptions); // Fetch emails since the specified date
    console.log(`Total archive emails found: ${messages.length}`);

    if (messages.length === 0) {
      console.log("No archive emails found.");
      return res.status(200).json({ message: "No archive emails found." });
    }

    // Pagination logic
    const startIndex = (page - 1) * batchSize;
    const endIndex = startIndex + parseInt(batchSize);
    const batchMessages = messages.slice(startIndex, endIndex);

    const archiveEmails = [];

    for (const message of batchMessages) {
      const header = message.parts.find((part) => part.which === "HEADER").body;
      const body = message.parts.find((part) => part.which === "TEXT").body;
      const plainTextBody = htmlToText(body || "", {
        wordwrap: 130,
      });

      const emailData = {
        messageId: header["message-id"] ? header["message-id"][0] : null,
        sender: header.from ? header.from[0] : null,
        recipient: header.to ? header.to[0] : null,
        subject: header.subject ? header.subject[0] : null,
        body: plainTextBody || null,
        folder: "archive",
        createdAt: header.date ? new Date(header.date[0]) : new Date(),
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
      archives: archiveEmails,
    });
  } catch (error) {
    console.error("Error fetching archive emails:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};
