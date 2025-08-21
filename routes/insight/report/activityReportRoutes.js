const express = require("express");
const router = express.Router();
const activityReportController = require("../../../controllers/insight/report/activityReportController");
// const { authMiddleware } = require("../middlewares/authMiddleware");
const { verifyToken } = require("../../../middlewares/authMiddleware");
// Apply auth middleware to all routes
// router.use(authMiddleware);



router.post("/create-activityreport", verifyToken, activityReportController.createActivityReport);

router.patch("/save-activityreport/:reportId", verifyToken, activityReportController.saveActivityReport);


module.exports = router;