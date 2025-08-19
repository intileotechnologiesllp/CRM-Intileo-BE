const express = require("express");
const router = express.Router();
const pipelineController = require("../controllers/deals/pipelineController");
const { verifyToken } = require("../middlewares/authMiddleware");

// All pipeline routes require authentication
router.use(verifyToken);

// Simple admin validation middleware (only admins can manage pipelines)
const validateAdmin = (req, res, next) => {
  if (req.role !== "admin") {
    return res.status(403).json({
      message: "Access denied. Admin privileges required.",
    });
  }
  next();
};

// Pipeline management routes (admin only)
router.post("/create", validateAdmin, pipelineController.createPipeline);
router.get("/get", pipelineController.getPipelines);
router.get("/:pipelineId", pipelineController.getPipelineById);
router.post("/update/:pipelineId", validateAdmin, pipelineController.updatePipeline);
router.delete("/delete/:pipelineId", validateAdmin, pipelineController.deletePipeline);

// Stage management routes (admin only)
router.post(
  "/:pipelineId/stages",
  validateAdmin,
  pipelineController.createStage
);
router.post("/stages/:stageId", validateAdmin, pipelineController.updateStage);
router.post(
  "/stages/:stageId",
  validateAdmin,
  pipelineController.deleteStage
);
router.post(
  "/:pipelineId/stages/reorder",
  validateAdmin,
  pipelineController.reorderStages
);

// Pipeline statistics (available to all authenticated users)
router.get("/:pipelineId/stats", pipelineController.getPipelineStats);

module.exports = router;
