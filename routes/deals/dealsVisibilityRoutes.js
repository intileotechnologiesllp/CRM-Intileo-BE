const express = require("express");
const router = express.Router();
const {
  applyVisibilityFilter,
  checkItemPermission,
  getUserAccessiblePipelines,
  addVisibilityToQuery,
} = require("../../middlewares/visibilityMiddleware");
const { verifyToken } = require("../../middlewares/authMiddleware");
const Deal = require("../../models/deals/dealsModels");
const { Op } = require("sequelize");

/**
 * Enhanced getDealsByStage with visibility groups support
 * GET /api/deals/stages/:pipelineId
 */
router.get(
  "/stages/:pipelineId",
  verifyToken,
  applyVisibilityFilter("deal"),
  checkItemPermission("canView"),
  async (req, res) => {
    try {
      const { pipelineId } = req.params;
      const userId = req.adminId;
      const userRole = req.role;

      // Check if user has access to this pipeline
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
            "Access denied. You don't have permission to view this pipeline.",
        });
      }

      const allStages = [
        "Qualified",
        "Contact Made",
        "Proposal Made",
        "Negotiations Started",
        "Won",
        "Lost",
      ];

      const result = [];
      let totalDeals = 0;

      for (const stage of allStages) {
        // Apply visibility filter to the base where clause
        const baseWhere = {
          pipelineStage: stage,
          pipelineId: pipelineId,
        };

        const finalWhere = await addVisibilityToQuery(
          baseWhere,
          userId,
          userRole,
          "deal"
        );

        const deals = await Deal.findAll({
          where: finalWhere,
          order: [["createdAt", "DESC"]],
          include: [
            {
              model: require("../../models/master/masterUserModel"),
              as: "owner",
              attributes: ["firstName", "lastName", "email"],
            },
          ],
        });

        // Apply rotten deals logic (your existing logic)
        const dealsWithRottenStatus = deals.map((deal) => {
          const dealData = deal.toJSON();

          // Calculate days since last update
          const lastUpdateDate = new Date(deal.updatedAt);
          const currentDate = new Date();
          const daysSinceUpdate = Math.floor(
            (currentDate - lastUpdateDate) / (1000 * 60 * 60 * 24)
          );

          // Determine if deal is rotten (customize this logic)
          const dealRottenDays = 30; // Or get from settings
          const isRotten = daysSinceUpdate > dealRottenDays;

          return {
            ...dealData,
            isRotten,
            daysSinceUpdate,
            backgroundColor: isRotten ? "#FF4444" : "#FFFFFF",
          };
        });

        const totalValue = deals.reduce(
          (sum, deal) => sum + (deal.value || 0),
          0
        );
        const dealCount = deals.length;
        totalDeals += dealCount;

        result.push({
          stage,
          totalValue,
          dealCount,
          deals: dealsWithRottenStatus,
        });
      }

      res.status(200).json({
        success: true,
        data: {
          totalDeals,
          pipelineId,
          stages: result,
          userPermissions: req.itemPermissions,
        },
      });
    } catch (error) {
      console.error("Error in getDealsByStage with visibility:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

/**
 * Get deals with visibility filtering
 * GET /api/deals/
 */
router.get(
  "/",
  verifyToken,
  applyVisibilityFilter("deal"),
  checkItemPermission("canView"),
  async (req, res) => {
    try {
      const userId = req.adminId;
      const userRole = req.role;
      const { page = 1, limit = 20, pipelineId } = req.query;

      let baseWhere = {};
      if (pipelineId) {
        // Check pipeline access
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
              "Access denied. You don't have permission to view this pipeline.",
          });
        }
        baseWhere.pipelineId = pipelineId;
      }

      // Apply visibility filtering
      const finalWhere = await addVisibilityToQuery(
        baseWhere,
        userId,
        userRole,
        "deal"
      );

      const deals = await Deal.findAndCountAll({
        where: finalWhere,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [["createdAt", "DESC"]],
        include: [
          {
            model: require("../../models/master/masterUserModel"),
            as: "owner",
            attributes: ["firstName", "lastName", "email"],
          },
        ],
      });

      res.status(200).json({
        success: true,
        data: {
          deals: deals.rows,
          pagination: {
            total: deals.count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(deals.count / parseInt(limit)),
          },
          userPermissions: req.itemPermissions,
        },
      });
    } catch (error) {
      console.error("Error fetching deals with visibility:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
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
