// const fs = require("fs");
// const path = require("path");

// const saveAttachmentToFile = async (attachment, emailID) => {
//   const uploadDir = path.join(__dirname, "uploads/attachments");
//   if (!fs.existsSync(uploadDir)) {
//     fs.mkdirSync(uploadDir, { recursive: true });
//   }

//   const filePath = path.join(uploadDir, `${emailID}_${attachment.filename}`);
//   fs.writeFileSync(filePath, attachment.content);

//   return filePath;
// };

// module.exports = { saveAttachmentToFile };

const fs = require("fs");
const path = require("path");

const saveAttachmentToFile = async (attachment, emailID) => {
  const uploadDir = path.join(__dirname, "../uploads/attachments");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Save the file with emailID prefix
  const savedFileName = `${emailID}_${attachment.filename}`;
  const filePath = path.join(uploadDir, savedFileName);
  fs.writeFileSync(filePath, attachment.content);

  // Return the correct public URL for the file
  const baseURL = process.env.LOCALHOST_URL || "http://localhost:3056";
  const publicPath = `${baseURL}/uploads/attachments/${savedFileName}`;

  return publicPath;
};

module.exports = { saveAttachmentToFile };



// const saveAttachmentToFile = async (attachment, emailID) => {
//   // Do NOT save the file to disk
//   // Just return metadata for database storage
//   return {
//     filename: attachment.filename,
//     size: attachment.size,
//     contentType: attachment.contentType,
//     emailID,
//     // Optionally add: checksum, partID, etc.
//   };
// };

// module.exports = { saveAttachmentToFile };
