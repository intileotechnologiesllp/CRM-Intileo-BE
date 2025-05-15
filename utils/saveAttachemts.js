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
  const uploadDir = path.join(__dirname, "../uploads/attachments"); // Ensure correct relative path
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Save the file to the uploads directory
  const filePath = path.join(uploadDir, `${emailID}_${attachment.filename}`);
  fs.writeFileSync(filePath, attachment.content);

  // Return the public URL for the file
  const baseURL = process.env.LOCALHOST_URL;
  const publicPath = `${baseURL}/uploads/attachments/${encodeURIComponent(attachment.filename)}`;

  return publicPath;
};

module.exports = { saveAttachmentToFile };