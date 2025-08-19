const Deal = require("../../models/deals/dealsModels");
const Pipeline = require("../../models/deals/pipelineModel");
const {
  GroupMembership,
  VisibilityGroup,
  PipelineVisibilityRule,
} = require("../../models/admin/visibilityAssociations");
const { Op } = require("sequelize");
const {
  getUserAccessiblePipelines,
  addVisibilityToQuery,
} = require("../../middlewares/visibilityMiddleware");

/**
 * Get deals by stage with visibility filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDealsByStage = async (req, res) => {
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

      // Apply rotten deals logic
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
    console.error("Error in getDealsByStage:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching deals by stage",
      error: error.message,
    });
  }
};

/**
 * Get all deals with visibility filtering and default pipeline data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllDeals = async (req, res) => {
  try {
    const userId = req.adminId;
    const userRole = req.role;
    const { page = 1, limit = 20, pipelineId } = req.query;

    // Get user's visibility group info
    const membership = await GroupMembership.findOne({
      where: {
        userId,
        isActive: true,
      },
      include: [
        {
          model: VisibilityGroup,
          as: "group",
          where: { isActive: true },
        },
      ],
    });

    // Get default group if no specific membership
    let visibilityGroup =
      membership?.group ||
      (await VisibilityGroup.findOne({
        where: {
          isDefault: true,
          isActive: true,
        },
      }));

    // Get visible pipelines for the user's group
    let visiblePipelines;
    if (userRole === "admin") {
      visiblePipelines = await Pipeline.findAll({
        where: { isActive: true },
        order: [["createdAt", "ASC"]],
      });
    } else {
      visiblePipelines = await Pipeline.findAll({
        include: [
          {
            model: PipelineVisibilityRule,
            as: "visibilityRules",
            where: {
              groupId: visibilityGroup?.id,
              canView: true,
              isActive: true,
            },
            required: true,
          },
        ],
        where: { isActive: true },
        order: [["createdAt", "ASC"]],
      });
    }

    let baseWhere = {};
    if (pipelineId) {
      // Check pipeline access
      if (!visiblePipelines.some((p) => p.id === parseInt(pipelineId))) {
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
        visibilityGroup: visibilityGroup
          ? {
              id: visibilityGroup.id,
              name: visibilityGroup.name,
              isDefault: visibilityGroup.isDefault,
            }
          : null,
        visiblePipelines: visiblePipelines.map((pipeline) => ({
          id: pipeline.id,
          name: pipeline.name,
          isDefault: pipeline.isDefault,
        })),
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
};

module.exports = {
  getDealsByStage,
  getAllDeals,
};
