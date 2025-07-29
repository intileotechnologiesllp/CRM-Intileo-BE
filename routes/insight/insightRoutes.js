// const express = require("express");
// const router = express.Router();
// const { verifyToken } = require("../../middlewares/authMiddleware");
// const insightController = require("../../controllers/insight/insightController");

// router.post("/create-dashboard",verifyToken,insightController.createDashboard);
// router.get("/get-dashboards", verifyToken, insightController.getDashboards);
// router.post("/create-report", verifyToken, insightController.createReport);
// router.get("/get-reports/:dashboardId", verifyToken, insightController.getReportsForDashboard);

// module.exports = router;
const express = require("express");
const router = express.Router();
const insightController = require("../../controllers/insight/insightController");
// const { authMiddleware } = require("../middlewares/authMiddleware");
const { verifyToken } = require("../../middlewares/authMiddleware");
// Apply auth middleware to all routes
// router.use(authMiddleware);

// =============== DASHBOARD ROUTES ===============
router.post("/dashboards", verifyToken, insightController.createDashboard);
router.get("/dashboards", verifyToken, insightController.getDashboards);
router.get(
  "/dashboards/:dashboardId",
  verifyToken,
  insightController.getDashboard
);
router.put(
  "/dashboards/:dashboardId",
  verifyToken,
  insightController.updateDashboard
);
router.delete("/dashboards/:dashboardId", insightController.deleteDashboard);

// =============== FOLDER MANAGEMENT ROUTES ===============
router.post("/folders", verifyToken, insightController.createFolder);
router.get(
  "/folders/:folderId/contents",
  verifyToken,
  insightController.getFolderContents
);
router.put("/items/:itemId/move", verifyToken, insightController.moveToFolder);

// =============== REPORT ROUTES ===============
router.post("/reports", verifyToken, insightController.createReport);
router.get(
  "/dashboards/:dashboardId/reports",
  verifyToken,
  insightController.getReportsForDashboard
);
router.get(
  "/reports/:reportId/data",
  verifyToken,
  insightController.getReportData
);
router.put("/reports/:reportId", verifyToken, insightController.updateReport);
router.delete(
  "/reports/:reportId",
  verifyToken,
  insightController.deleteReport
);

// =============== GOAL ROUTES ===============
router.post("/goals", insightController.createGoal);
router.get(
  "/dashboards/:dashboardId/goals",
  verifyToken,
  insightController.getGoalsForDashboard
);
router.get(
  "/goals/:goalId/progress",
  verifyToken,
  insightController.getGoalProgress
);
router.put("/goals/:goalId", verifyToken, insightController.updateGoal);
router.delete("/goals/:goalId", verifyToken, insightController.deleteGoal);

// =============== UTILITY ROUTES ===============
router.get("/report-types", (req, res) => {
  res.json({
    success: true,
    data: {
      entities: [
        "Deal",
        "Lead",
        "Activity",
        "Contact",
        "Campaign",
        "Revenue forecast",
      ],
      reportTypes: {
        Deal: ["Performance", "Conversion", "Duration", "Progress", "Products"],
        Lead: ["Performance", "Conversion", "Duration", "Sources"],
        Activity: ["Performance", "Types", "Duration", "Completion"],
        Contact: ["Performance", "Sources", "Engagement"],
        Campaign: ["Performance", "ROI", "Conversion"],
        "Revenue forecast": ["Forecast", "Pipeline", "Trends"],
      },
      goalTypes: {
        Deal: ["Added", "Progressed", "Won"],
        Activity: ["Added", "Completed"],
        Forecast: ["Revenue", "Pipeline"],
      },
    },
  });
});

router.get("/folders", (req, res) => {
  res.json({
    success: true,
    data: [
      "My dashboards",
      "Shared with me",
      "Team dashboards",
      "Sales Reports",
      "Marketing Reports",
    ],
  });
});

module.exports = router;
