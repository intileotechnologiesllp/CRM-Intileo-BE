const fs = require("fs");
const path = require("path");

const saveAttachmentToFile = async (attachment, emailID) => {
  const uploadDir = path.join(__dirname, "uploads/attachments");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, `${emailID}_${attachment.filename}`);
  fs.writeFileSync(filePath, attachment.content);

  return filePath;
};

module.exports = { saveAttachmentToFile };