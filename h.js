exports.composeEmail = [
    upload.array("attachments"), // Use Multer to handle multiple file uploads
    async (req, res) => {
      const { to, cc, bcc, subject, text, html, templateID, actionType, replyToMessageId } = req.body;
      const masterUserID = req.adminId; // Assuming adminId is set in middleware
  
      try {
        // Check if a default email is set in the DefaultEmail table
        const defaultEmail = await DefaultEmail.findOne({
          where: { masterUserID, isDefault: true },
        });
  
        let SENDER_EMAIL, SENDER_PASSWORD, SENDER_NAME;
  
        if (defaultEmail) {
          SENDER_EMAIL = defaultEmail.email;
          SENDER_PASSWORD = defaultEmail.appPassword;
          SENDER_NAME = defaultEmail.senderName || "No Name";
        } else {
          const userCredential = await UserCredential.findOne({
            where: { masterUserID },
          });
  
          if (!userCredential) {
            return res.status(404).json({
              message: "User credentials not found for the given user.",
            });
          }
  
          SENDER_EMAIL = userCredential.email;
          SENDER_PASSWORD = userCredential.appPassword;
          SENDER_NAME = userCredential.senderName || "No Name";
        }
  
        let finalSubject = subject;
        let finalBody = text || html;
        let inReplyToHeader = null;
        let referencesHeader = null;
  
        // Handle reply action
        if (actionType === "reply") {
          // Fetch the original email from the database
          const originalEmail = await Email.findOne({
            where: { messageId: replyToMessageId, masterUserID },
          });
  
          if (!originalEmail) {
            return res.status(404).json({
              message: "Original email not found for the given messageId.",
            });
          }
  
          // Set headers for reply
          inReplyToHeader = originalEmail.messageId; // Use the original email's messageId
          referencesHeader = originalEmail.references
            ? `${originalEmail.references} ${originalEmail.messageId}`
            : originalEmail.messageId; // Append the original email's messageId to references
  
          // Modify subject and body for reply
          finalSubject = `Re: ${originalEmail.subject}`;
          finalBody = `\n\nOn ${originalEmail.createdAt}, ${originalEmail.sender} wrote:\n${originalEmail.body}\n\n${text}`;
        }
  
        // Prepare attachments for nodemailer
        const formattedAttachments =
          req.files && req.files.length > 0
            ? req.files.map((file) => ({
                filename: file.originalname,
                path: file.path,
              }))
            : [];
  
        // Create a transporter using the selected email credentials
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: SENDER_EMAIL,
            pass: SENDER_PASSWORD,
          },
        });
  
        // Define the email options
        const mailOptions = {
          from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
          to,
          cc,
          bcc,
          subject: finalSubject,
          text: finalBody,
          html: finalBody,
          attachments: formattedAttachments.length > 0 ? formattedAttachments : undefined,
          inReplyTo: inReplyToHeader || undefined, // Add inReplyTo header
          references: referencesHeader || undefined, // Add references header
        };
  
        // Send the email
        const info = await transporter.sendMail(mailOptions);
  
        console.log("Email sent: ", info.messageId);
  
        // Save the email in the database
        const emailData = {
          messageId: info.messageId,
          inReplyTo: inReplyToHeader || null,
          references: referencesHeader || null,
          sender: SENDER_EMAIL,
          recipient: to,
          subject: finalSubject,
          body: finalBody,
          folder: "sent",
          createdAt: new Date(),
          masterUserID,
        };
  
        const savedEmail = await Email.create(emailData);
        console.log("Composed email saved in the database:", savedEmail);
  
        res.status(200).json({
          message: "Email sent and saved successfully.",
          messageId: info.messageId,
        });
      } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ message: "Failed to send email.", error: error.message });
      }
    },
  ];