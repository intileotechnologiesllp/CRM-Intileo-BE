const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const insightController = require("../../controllers/insight/insightController");

router.post("/create-dashboard",verifyToken,insightController.createDashboard);
router.get("/get-dashboards", verifyToken, insightController.getDashboards);
router.post("/create-report", verifyToken, insightController.createReport);
router.get("/get-reports/:dashboardId", verifyToken, insightController.getReportsForDashboard);







module.exports = router;