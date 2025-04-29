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

    const searchCriteria = ["ALL"]; // Fetch all emails
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

    // Check for replies
    const inReplyTo = parsedEmail.headers.get("in-reply-to");
    if (inReplyTo) {
      console.log(`This email is a reply to: ${inReplyTo}`);
    } else {
      console.log("This email is not a reply.");
    }

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