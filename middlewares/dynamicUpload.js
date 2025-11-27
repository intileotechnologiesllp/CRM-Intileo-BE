const multer = require("multer");
const path = require("path");
const MiscSettings = require("../models/miscSettings/miscSettingModel");

module.exports = async function dynamicUpload(req, res, next) {
  try {
    const miscSettings = await MiscSettings.findOne({ order: [["id", "ASC"]] });
    const maxImageSizeMB = miscSettings?.maxImageSizeMB || 5;

    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../uploads/attachments"));
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + "-" + file.originalname);
      },
    });

    const upload = multer({
      storage,
      limits: { fileSize: maxImageSizeMB * 1024 * 1024 },
    }).array("attachments");

    upload(req, res, function (err) {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            message: `File size should not exceed ${maxImageSizeMB} MB.`,
          });
        }
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  } catch (error) {
    return res
      .status(500)
      .json({
        message: "Failed to process upload settings",
        error: error.message,
      });
  }
};
