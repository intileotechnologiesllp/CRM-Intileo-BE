const DefaultEmail = require("../../models/email/defaultEmailModel");
const Email = require("../../models/email/emailModel");
const { saveAttachments } = require("../../services/attachmentService");
const UserCredential = require("../../models/email/userCredentialModel");
const Imap = require("imap-simple");
// const Email = require("../../models/email/emailModel");
const { htmlToText } = require("html-to-text");
const { simpleParser } = require("mailparser");
const Attachment = require("../../models/email/attachmentModel");
const { format, subDays } = require("date-fns"); // Use date-fns for date manipulation

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
  const { email, appPassword, senderName, isDefault } = req.body;

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

    if (existingDefaultEmail) {
      // Update existing default email
      await existingDefaultEmail.update({ appPassword, senderName, isDefault });
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
      return res.status(404).json({ message: "Default email not set." });
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

exports.fetchSyncEmails = async (req, res) => {
  const { batchSize = 50, page = 1 } = req.query;
  const masterUserID = req.adminId; // Assuming adminId is set in middleware

  try {
    // Fetch user credentials
    const userCredential = await UserCredential.findOne({
      where: { masterUserID },
    });

    if (!userCredential) {
      return res.status(404).json({ message: "User credentials not found." });
    }

    const userEmail = userCredential.email;
    const userPassword = userCredential.appPassword;
    const syncStartDate = parseInt(userCredential.syncStartDate, 10) || 3; // Default to 3 days if invalid
    const syncFolders = userCredential.syncFolders || ["INBOX"]; // Default to "INBOX"
    const syncAllFolders = userCredential.syncAllFolders; // Check if all folders should be synced

    // Validate syncStartDate
    if (isNaN(syncStartDate) || syncStartDate <= 0) {
      return res.status(400).json({ message: "Invalid syncStartDate value." });
    }

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

    // Calculate the `sinceDate` based on syncStartDate
    const now = new Date();
    const sinceDate = subDays(now, syncStartDate); // Subtract days from the current date

    // Validate sinceDate
    if (isNaN(sinceDate.getTime())) {
      throw new Error("Invalid sinceDate calculated from syncStartDate.");
    }

    const formattedSinceDate = format(sinceDate, "dd-MMM-yyyy"); // Format as "dd-MMM-yyyy" for IMAP
    const humanReadableSinceDate = `${syncStartDate} days ago (${format(
      sinceDate,
      "MMMM dd, yyyy"
    )})`; // Format as "3 days ago (May 10, 2025)"

    console.log(`Fetching emails since ${humanReadableSinceDate}`);

    // Fetch all folders from the IMAP server
    const mailboxes = await connection.getBoxes();
    console.log("All folders from IMAP server:", mailboxes);

    // Extract all valid folder names, including nested folders
    const validFolders = extractFolders(mailboxes);
    console.log("Valid folders from IMAP server:", validFolders);

    // Fetch all folders if syncAllFolders is true
    let foldersToSync = syncFolders;
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

      for (const message of messages) {
        const rawBodyPart = message.parts.find((part) => part.which === "");
        const rawBody = rawBodyPart ? rawBodyPart.body : null;

        if (!rawBody) {
          console.log(`No body found for email in folder: ${folderName}.`);
          continue;
        }

        const parsedEmail = await simpleParser(rawBody);

        // Map IMAP folder name to database folder name
        const dbFolderName = folderMapping[folderName] || "inbox"; // Default to "inbox" if no mapping exists

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
