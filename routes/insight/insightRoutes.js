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
router.post(
  "/create-dashboards",
  verifyToken,
  insightController.createDashboard
);
router.get("/get-dashboards", verifyToken, insightController.getDashboards);
router.get(
  "/get-dashboards/:dashboardId",
  verifyToken,
  insightController.getDashboard
);
router.put(
  "/update-dashboards/:dashboardId",
  verifyToken,
  insightController.updateDashboard
);
router.delete(
  "/delete-dashboards/:dashboardId",
  verifyToken,
  insightController.deleteDashboard
);
router.post(
  "/bulk-delete-dashboards",
  verifyToken,
  insightController.bulkDeleteDashboards
);

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
router.get("/goal-types", insightController.getGoalTypes);
router.post("/create-goals", verifyToken, insightController.createGoal);
router.get("/get-goals", verifyToken, insightController.getAllGoals);
router.get(
  "/dashboards/:dashboardId/goals",
  verifyToken,
  insightController.getGoalsForDashboard
);
router.post(
  "/goals/:goalId/add-to-dashboard",
  verifyToken,
  insightController.addGoalToDashboard
);
router.get(
  "/goals/:goalId/progress",
  verifyToken,
  insightController.getGoalProgress
);
router.get("/goals/:goalId/data", verifyToken, insightController.getGoalData);
router.get(
  "/dashboards/:dashboardId/goals-data",
  verifyToken,
  insightController.getGoalData
);
// router.get(
//   "/goals/:goalId/progressed-data",
//   verifyToken,
//   insightController.getProgressedGoalData
// );
router.post("/edit-goals/:goalId", verifyToken, insightController.updateGoal);
router.post("/delete-goals/:goalId", verifyToken, insightController.deleteGoal);
router.post("/bulk-delete-goals", verifyToken, insightController.bulkDeleteGoal);
router.post(
  "/dashboards/:dashboardId/goals/reorder",
  verifyToken,
  insightController.reorderGoals
);


router.post("/bulkdelete-report", verifyToken, insightController.bulkDeleteReports);
router.get("/get-allreports", verifyToken, insightController.GetAllReports);
router.get("/get-reportsdata-dashboardwise/:dashboardId", verifyToken, insightController.GetReportsDataDashboardWise);
// router.post("/entity-columns", verifyToken, insightController.getEntityColumns);
// router.post("/setColumnsVisibility", verifyToken, insightController.setColumnVisibility);
// router.get("/getColumnsVisibility",verifyToken, insightController.getColumnVisibility);
// router.post("/updateColumnsVisibility", verifyToken, insightController.updateColumnVisibility);
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
