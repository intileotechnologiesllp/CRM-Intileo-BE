exports.fetchRecentEmail = async (adminId) => {
  try {
    // Fetch the user's email, app password, syncStartDate, and syncStartType from the UserCredential model
    const userCredential = await UserCredential.findOne({
      where: { masterUserID: adminId },
    });

    if (!userCredential) {
      console.error("User credentials not found for adminId:", adminId);
      return { message: "User credentials not found." };
    }

    const userEmail = userCredential.email;
    const userPassword = userCredential.appPassword;
    const syncStartDate = userCredential.syncStartDate || 3; // Default to 3 if not set
    const syncStartType = userCredential.syncStartType || "days"; // Default to "days" if not set

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

    // Calculate the `sinceDate` based on syncStartDate and syncStartType
    const now = new Date();
    let sinceDate;
    if (syncStartType === "days") {
      sinceDate = new Date(now.getTime() - syncStartDate * 24 * 60 * 60 * 1000);
    } else if (syncStartType === "hours") {
      sinceDate = new Date(now.getTime() - syncStartDate * 60 * 60 * 1000);
    } else if (syncStartType === "minutes") {
      sinceDate = new Date(now.getTime() - syncStartDate * 60 * 1000);
    } else {
      console.error("Invalid syncStartType:", syncStartType);
      return { message: "Invalid syncStartType in user credentials." };
    }

    const formattedSinceDate = formatDateForIMAP(sinceDate);
    console.log(`Using SINCE date: ${formattedSinceDate}`);

    const searchCriteria = [["SINCE", formattedSinceDate]];
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
      masterUserID: adminId,
      subject: parsedEmail.subject || null,
      body: cleanEmailBody(parsedEmail.text || parsedEmail.html || ""),
      folder: "inbox", // Add folder field
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

    connection.end(); // Close the connection
    console.log("IMAP connection closed.");

    return {
      message: "Fetched and saved the most recent email.",
      email: emailData,
      attachments,
    };
  } catch (error) {
    console.error("Error fetching recent email:", error);
    return { message: "Internal server error.", error: error.message };
  }
};