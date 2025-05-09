const Attachment = require("../models/email/attachmentModel");
const { saveAttachmentToFile } = require("../utils/saveAttachemts");

// const saveAttachments = async (attachments, emailID) => {
//   const savedAttachments = [];

//   for (const attachment of attachments) {
//     const filePath = await saveAttachmentToFile(attachment, emailID);

//     const attachmentData = {
//       emailID,
//       filename: attachment.filename,
//       contentType: attachment.contentType,
//       size: attachment.size,
//       filePath,
//     };

//     const savedAttachment = await Attachment.create(attachmentData);
//     savedAttachments.push(savedAttachment);
//   }

//   return savedAttachments;
// };
const saveAttachments = async (attachments, emailID) => {
  const savedAttachments = [];

  for (const attachment of attachments) {
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
      
      // Save the attachment in the database
      const savedAttachment = await Attachment.create(attachmentData);
      savedAttachments.push(savedAttachment);
    } else {
      console.log(`Attachment already exists: ${attachment.filename}`);
    }
  }

  return savedAttachments;
};

module.exports = { saveAttachments };