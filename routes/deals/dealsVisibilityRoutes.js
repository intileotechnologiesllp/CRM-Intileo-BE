const express = require("express");
const router = express.Router();
const {
  applyVisibilityFilter,
  checkItemPermission,
} = require("../../middlewares/visibilityMiddleware");
const { verifyToken } = require("../../middlewares/authMiddleware");
const {
  getDealsByStage,
  getAllDeals,
} = require("../../controllers/deals/dealVisibilityController");

/**
 * Enhanced getDealsByStage with visibility groups support
 * GET /api/deals/stages/:pipelineId
 */
router.get(
  "/stages/:pipelineId",
  verifyToken,
  applyVisibilityFilter("deal"),
  checkItemPermission("canView"),
  getDealsByStage
);

/**
 * Get deals with visibility filtering
 * GET /api/deals/
 */
router.get(
  "/getAll",
  verifyToken,
  applyVisibilityFilter("deal"),
  checkItemPermission("canView"),
  getAllDeals
);

/**
 * Create new deal
 * POST /api/deals/
 */
router.post(
  "/",
  verifyToken,
  applyVisibilityFilter("deal"),
  checkItemPermission("canCreate"),
  async (req, res) => {
    try {
      const userId = req.adminId;
      const userRole = req.role;
      const { pipelineId } = req.body;

      // Check pipeline access for creation
      if (pipelineId) {
        const accessiblePipelines = await getUserAccessiblePipelines(
          userId,
          userRole
        );
        if (
          accessiblePipelines !== null &&
          !accessiblePipelines.includes(parseInt(pipelineId))
        ) {
          return res.status(403).json({
            message:
              "Access denied. You don't have permission to create deals in this pipeline.",
          });
        }
      }

      // Set the owner to current user
      const dealData = {
        ...req.body,
        masterUserID: userId,
        createdBy: userId,
        updatedBy: userId,
      };

      const newDeal = await Deal.create(dealData);

      res.status(201).json({
        success: true,
        message: "Deal created successfully",
        data: newDeal,
      });
    } catch (error) {
      console.error("Error creating deal with visibility:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

/**
 * Update deal
 * PUT /api/deals/:id
 */
router.put(
  "/:id",
  verifyToken,
  applyVisibilityFilter("deal"),
  checkItemPermission("canEdit"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.adminId;
      const userRole = req.role;

      // First check if user can see this deal
      const baseWhere = { id };
      const finalWhere = await addVisibilityToQuery(
        baseWhere,
        userId,
        userRole,
        "deal"
      );

      const existingDeal = await Deal.findOne({ where: finalWhere });

      if (!existingDeal) {
        return res.status(404).json({
          success: false,
          message: "Deal not found or access denied",
        });
      }

      // Update the deal
      const updateData = {
        ...req.body,
        updatedBy: userId,
      };

      await Deal.update(updateData, { where: { id } });

      const updatedDeal = await Deal.findByPk(id);

      res.status(200).json({
        success: true,
        message: "Deal updated successfully",
        data: updatedDeal,
      });
    } catch (error) {
      console.error("Error updating deal with visibility:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

module.exports = router;
