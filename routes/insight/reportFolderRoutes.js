const express = require("express");
const router = express.Router();
const reportFolderController = require("../../controllers/insight/reportFolderController");
// const { authMiddleware } = require("../middlewares/authMiddleware");
const { verifyToken } = require("../../middlewares/authMiddleware");
const dbContextMiddleware = require("../../middlewares/dbContext");
// Apply auth middleware to all routes
// router.use(authMiddleware);

router.use(dbContextMiddleware);


router.post("/create-reportfolder", verifyToken, reportFolderController.createReportFolder);

router.get("/get-reportfolders", verifyToken, reportFolderController.getReportFolders);

router.delete("/delete-reportfolder/:reportFolderId", verifyToken, reportFolderController.deleteReportFolder);

router.patch("/update-reportfolder/:reportFolderId", verifyToken, reportFolderController.updateReportFolder);

module.exports = router;