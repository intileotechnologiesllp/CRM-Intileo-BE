const express = require("express");
const router = express.Router();
const googleDriveController = require("../../controllers/googleDrive/googledrive"); // Adjust the path as necessary
const multer = require("multer");
const { verifyToken } = require("../../middlewares/authMiddleware");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

router.get("/connect", googleDriveController.connectDrive);
router.get("/callback", googleDriveController.googleCallback);

router.post(
  "/upload",
  verifyToken,
  upload.single("file"),
  googleDriveController.uploadFileToDrive
);

router.get("/get-drive-files", verifyToken, googleDriveController.listDriveFiles);
module.exports = router;
