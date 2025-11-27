const Attachment = require("../models/email/attachmentModel");
// Note: We only save attachment metadata to database, not files to disk

const saveAttachments = async (attachments, emailID) => {
  const savedAttachments = [];
  console.log(
    `Starting to save ${attachments.length} attachment metadata records for emailID: ${emailID}`
  );

  for (const attachment of attachments) {
    try {
      // Generate a filename if missing, based on content type
      let filename = attachment.filename;
      if (!filename) {
        // Generate default filename based on content type
        const timestamp = Date.now();
        const partId = attachment.partId || "unknown";

        switch (attachment.contentType) {
          case "text/calendar":
            filename = `calendar-invite-${timestamp}-${partId}.ics`;
            break;
          case "application/pdf":
            filename = `attachment-${timestamp}-${partId}.pdf`;
            break;
          case "application/vnd.ms-excel":
          case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
            filename = `spreadsheet-${timestamp}-${partId}.xlsx`;
            break;
          case "application/msword":
          case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            filename = `document-${timestamp}-${partId}.docx`;
            break;
          case "image/jpeg":
            filename = `image-${timestamp}-${partId}.jpg`;
            break;
          case "image/png":
            filename = `image-${timestamp}-${partId}.png`;
            break;
          case "image/gif":
            filename = `image-${timestamp}-${partId}.gif`;
            break;
          case "text/plain":
            filename = `text-${timestamp}-${partId}.txt`;
            break;
          case "text/html":
            filename = `html-${timestamp}-${partId}.html`;
            break;
          case "application/json":
            filename = `data-${timestamp}-${partId}.json`;
            break;
          case "application/xml":
          case "text/xml":
            filename = `xml-${timestamp}-${partId}.xml`;
            break;
          case "application/zip":
            filename = `archive-${timestamp}-${partId}.zip`;
            break;
          case "application/x-zip-compressed":
            filename = `archive-${timestamp}-${partId}.zip`;
            break;
          case "application/octet-stream":
            filename = `binary-${timestamp}-${partId}.bin`;
            break;
          default:
            // For unknown types, use the content type to create a filename
            const extension = attachment.contentType.split("/")[1] || "unknown";
            filename = `attachment-${timestamp}-${partId}.${extension}`;
        }

        console.log(
          `Generated filename for attachment without filename: ${filename} (contentType: ${attachment.contentType})`
        );
      }

      console.log(
        `Processing attachment metadata: ${filename}, size: ${attachment.size}, contentType: ${attachment.contentType}`
      );

      // Check if the attachment already exists in the database
      const existingAttachment = await Attachment.findOne({
        where: {
          emailID,
          filename: filename, // Ensure uniqueness by emailID and filename
        },
      });

      if (!existingAttachment) {
        // Save only attachment metadata to database (no file saving)
        console.log(`Saving attachment metadata to database: ${filename}`);

        // Prepare attachment data (metadata only)
        const attachmentData = {
          emailID,
          filename: filename,
          contentType: attachment.contentType,
          size: attachment.size,
          filePath: null, // No file path since we're not saving files
        };

        // Save the attachment metadata in the database
        const savedAttachment = await Attachment.create(attachmentData);
        savedAttachments.push(savedAttachment);
        console.log(
          `Attachment metadata saved to database: ${filename}, ID: ${savedAttachment.attachmentID}`
        );
      } else {
        console.log(`Attachment metadata already exists: ${filename}`);
      }
    } catch (error) {
      console.error(
        `Error processing attachment metadata: ${
          attachment.filename || "unknown"
        }`,
        error
      );
    }
  }

  console.log(
    `Finished saving attachment metadata. Total saved: ${savedAttachments.length}`
  );
  return savedAttachments;
};

// Special function for saving user-uploaded attachments (compose email)
// This saves actual files with file paths, unlike the regular saveAttachments which only saves metadata
const saveUserUploadedAttachments = async (files, emailID) => {
  const savedAttachments = [];
  const baseURL = process.env.LOCALHOST_URL || "http://localhost:3056";

  console.log(
    `Starting to save ${files.length} user-uploaded attachment files for emailID: ${emailID}`
  );

  for (const file of files) {
    try {
      // Validate that the file has required properties
      if (!file.filename || !file.path) {
        console.warn("Skipping file with missing filename or path:", file);
        continue;
      }

      console.log(
        `Processing user-uploaded file: ${file.filename}, size: ${file.size}, path: ${file.path}`
      );

      // Check if the attachment already exists in the database
      const existingAttachment = await Attachment.findOne({
        where: {
          emailID,
          filename: file.filename,
        },
      });

      if (!existingAttachment) {
        // Save attachment with file path for user uploads
        console.log(
          `Saving user-uploaded attachment to database: ${file.filename}`
        );

        // Prepare attachment data with file path
        const attachmentData = {
          emailID,
          filename: file.filename,
          contentType: file.mimetype || "application/octet-stream",
          size: file.size,
          filePath: `${baseURL}/uploads/attachments/${encodeURIComponent(
            file.filename
          )}`,
        };

        // Save the attachment in the database
        const savedAttachment = await Attachment.create(attachmentData);
        savedAttachments.push(savedAttachment);
        console.log(
          `User-uploaded attachment saved to database: ${file.filename}, ID: ${savedAttachment.attachmentID}`
        );
      } else {
        console.log(
          `User-uploaded attachment already exists: ${file.filename}`
        );
      }
    } catch (error) {
      console.error(
        `Error processing user-uploaded attachment: ${file.filename}`,
        error
      );
    }
  }

  console.log(
    `Finished saving user-uploaded attachments. Total saved: ${savedAttachments.length}`
  );
  return savedAttachments;
};

module.exports = { saveAttachments, saveUserUploadedAttachments };
