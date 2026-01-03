const express = require("express");
const router = express.Router();
const contactReportController = require("../../../controllers/insight/report/contactReportController");
// const { authMiddleware } = require("../middlewares/authMiddleware");
const { verifyToken } = require("../../../middlewares/authMiddleware");
const dbContextMiddleware = require("../../../middlewares/dbContext");
// Apply auth middleware to all routes
// router.use(authMiddleware);


router.use(dbContextMiddleware);


router.post("/create-personreport", verifyToken, contactReportController.createPersonReport);

router.post("/get-summarypersonreport", verifyToken, contactReportController.getPersonReportSummary);

router.post("/save-personreport", verifyToken, contactReportController.savePersonReport);


module.exports = router;