const express = require("express");
const router = express.Router();
const googleDriveController = require("../../controllers/googleDrive/googledrive"); // Adjust the path as necessary
const multer = require("multer");
const { verifyToken } = require("../../middlewares/authMiddleware");
const dbContextMiddleware = require("../../middlewares/dbContext");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });



router.use(dbContextMiddleware);



router.get("/connect", verifyToken, googleDriveController.connectDrive);
router.get("/callback", verifyToken, googleDriveController.googleCallback);

router.delete("/delete-file/:id", verifyToken, googleDriveController.deletefile);

router.post(
  "/upload",
  verifyToken,
  upload.single("file"),
  googleDriveController.uploadFileToDrive
);

router.get("/get-drive-files", verifyToken, googleDriveController.listDriveFiles);
module.exports = router;
