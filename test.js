exports.composeEmail = [
  upload.array("attachments"),
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
      draftId
    } = req.body;
    const masterUserID = req.adminId;

    try {
      // ... (your sender logic here, unchanged) ...

      let finalSubject = subject;
      let finalBody = text || html;
      let inReplyToHeader = null;
      let referencesHeader = null;
      let draftEmail = null;

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
        finalBody = (text || html) || draftEmail.body;
      }

      // ... (reply/template logic, unchanged) ...

      // ... (tracking logic, unchanged) ...

      // Prepare attachments for nodemailer
      const formattedAttachments =
        req.files && req.files.length > 0
          ? req.files.map((file) => ({
              filename: file.originalname,
              path: file.path,
            }))
          : [];

      // Create transporter and mailOptions
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: SENDER_EMAIL,
          pass: SENDER_PASSWORD,
        },
      });

      const mailOptions = {
        from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
        to: to || (draftEmail && draftEmail.recipient),
        cc: cc || (draftEmail && draftEmail.cc),
        bcc: bcc || (draftEmail && draftEmail.bcc),
        subject: finalSubject,
        text: finalBody,
        html: finalBody,
        attachments: formattedAttachments.length > 0 ? formattedAttachments : undefined,
        inReplyTo: inReplyToHeader || undefined,
        references: referencesHeader || undefined,
      };

      // Send the email
      const info = await transporter.sendMail(mailOptions);

      // Save/update the email in the database
      let savedEmail;
      let savedAttachments = [];

      if (draftId) {
        // Update the existing draft record to be a sent email
        savedEmail = await draftEmail.update({
          messageId: info.messageId,
          inReplyTo: inReplyToHeader || null,
          references: referencesHeader || null,
          sender: SENDER_EMAIL,
          senderName: SENDER_NAME,
          recipient: to || draftEmail.recipient,
          cc: cc || draftEmail.cc,
          bcc: bcc || draftEmail.bcc,
          subject: finalSubject,
          body: finalBody,
          folder: "sent",
          createdAt: new Date(),
          masterUserID,
          tempMessageId,
        });

        // Update attachments if new ones are uploaded
        if (req.files && req.files.length > 0) {
          await Attachment.destroy({ where: { emailID: draftEmail.emailID } });
          savedAttachments = req.files.map((file) => ({
            emailID: draftEmail.emailID,
            filename: file.originalname,
            path: file.path,
          }));
          await Attachment.bulkCreate(savedAttachments);
        } else {
          // If no new attachments, fetch existing ones for response
          savedAttachments = await Attachment.findAll({ where: { emailID: draftEmail.emailID } });
        }
      } else {
        // ... (your existing logic for new sent emails) ...
        const emailData = {
          messageId: info.messageId,
          inReplyTo: inReplyToHeader || null,
          references: referencesHeader || null,
          sender: SENDER_EMAIL,
          senderName: SENDER_NAME,
          recipient: to,
          cc,
          bcc,
          subject: finalSubject,
          body: finalBody,
          folder: "sent",
          createdAt: new Date(),
          masterUserID,
          tempMessageId,
        };
        savedEmail = await Email.create(emailData);

        savedAttachments =
          req.files && req.files.length > 0
            ? req.files.map((file) => ({
                emailID: savedEmail.emailID,
                filename: file.originalname,
                path: file.path,
              }))
            : [];

        if (savedAttachments.length > 0) {
          await Attachment.bulkCreate(savedAttachments);
        }
      }

      // Generate public URLs for attachments
      const baseURL = process.env.LOCALHOST_URL;
      const attachmentLinks = savedAttachments.map((attachment) => ({
        filename: attachment.filename,
        link: `${baseURL}/uploads/attachments/${attachment.filename}`,
      }));

      res.status(200).json({
        message: "Email sent and saved successfully.",
        messageId: info.messageId,
        attachments: attachmentLinks,
      });

    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ message: "Failed to send email.", error: error.message });
    }
  },
];