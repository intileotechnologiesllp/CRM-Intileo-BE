const Attachment = require("../models/email/attachmentModel");
const { saveAttachmentToFile } = require("../utils/saveAttachemts");

const saveAttachments = async (attachments, emailID) => {
  const savedAttachments = [];

  for (const attachment of attachments) {
    try {
      // Validate that the attachment has a filename
      if (!attachment.filename) {
        console.warn("Skipping attachment with missing filename:", attachment);
        continue; // Skip this attachment
      }

      // Check if the attachment already exists in the database
      const existingAttachment = await Attachment.findOne({
        where: {
          emailID,
          filename: attachment.filename, // Ensure uniqueness by emailID and filename
        },
      });

      if (!existingAttachment) {
        // Save the attachment to the file system
        const filePath = await saveAttachmentToFile(attachment, emailID);

        // Prepare attachment data
        const attachmentData = {
          emailID,
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.size,
          filePath,
        };

        //   const meta = await saveAttachmentToFile(attachment, emailID);

        // // Prepare attachment data
        // const attachmentData = {
        //   emailID:meta.emailID,
        //   filename: meta.filename,
        //   contentType: meta.contentType,
        //   size: meta.size,
        //   // filePath,
        // };

        // Save the attachment in the database
        const savedAttachment = await Attachment.create(attachmentData);
        savedAttachments.push(savedAttachment);
      } else {
        console.log(`Attachment already exists: ${attachment.filename}`);
      }
    } catch (error) {
      console.error(
        `Error processing attachment: ${attachment.filename}`,
        error
      );
    }
  }

  return savedAttachments;
};

module.exports = { saveAttachments };
