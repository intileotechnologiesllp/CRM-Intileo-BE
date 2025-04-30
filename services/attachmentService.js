const Attachment = require("../models/email/attachmentModel");
const { saveAttachmentToFile } = require("../utils/saveAttachemts");

const saveAttachments = async (attachments, emailID) => {
  const savedAttachments = [];

  for (const attachment of attachments) {
    const filePath = await saveAttachmentToFile(attachment, emailID);

    const attachmentData = {
      emailID,
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
      filePath,
    };

    const savedAttachment = await Attachment.create(attachmentData);
    savedAttachments.push(savedAttachment);
  }

  return savedAttachments;
};

module.exports = { saveAttachments };