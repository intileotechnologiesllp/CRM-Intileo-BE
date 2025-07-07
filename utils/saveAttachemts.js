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
  console.log(
    `saveAttachmentToFile called for: ${attachment.filename}, emailID: ${emailID}`
  );

  const uploadDir = path.join(__dirname, "../uploads/attachments");
  if (!fs.existsSync(uploadDir)) {
    console.log(`Creating upload directory: ${uploadDir}`);
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Save the file with emailID prefix
  const savedFileName = `${emailID}_${attachment.filename}`;
  const filePath = path.join(uploadDir, savedFileName);

  console.log(`Saving file to: ${filePath}`);
  console.log(
    `Attachment content size: ${
      attachment.content ? attachment.content.length : "undefined"
    }`
  );

  if (!attachment.content) {
    throw new Error(
      `Attachment content is missing for file: ${attachment.filename}`
    );
  }

  fs.writeFileSync(filePath, attachment.content);
  console.log(`File successfully saved to disk: ${filePath}`);

  // Return the correct public URL for the file
  const baseURL = process.env.LOCALHOST_URL || "http://localhost:3056";
  const publicPath = `${baseURL}/uploads/attachments/${savedFileName}`;

  console.log(`Public URL for file: ${publicPath}`);
  return publicPath;
};

module.exports = { saveAttachmentToFile };
