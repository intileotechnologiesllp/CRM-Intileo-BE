const {
  VisibilityGroup,
  PipelineVisibilityRule,
} = require("../../models/admin/visibilityAssociations");
const Pipeline = require("../../models/deals/pipelineModel");
const { Op } = require("sequelize");
const { logAuditTrail } = require("../../utils/auditTrailLogger");
const PROGRAMS = require("../../utils/programConstants");
const historyLogger = require("../../utils/historyLogger").logHistory;

// Get pipeline visibility rules for a group
exports.getGroupPipelineRules = async (req, res) => {
  const { VisibilityGroup, Pipeline, MasterUser, PipelineVisibilityRule } = req.models;
  const { groupId } = req.params;
  const masterUserID = req.adminId;

  try {
    const group = await VisibilityGroup.findOne({
      where: { groupId, masterUserID },
    });

    if (!group) {
      return res.status(404).json({
        message: "Visibility group not found.",
      });
    }

    // Get all pipelines for this user
    const allPipelines = await Pipeline.findAll({
      where: { masterUserID, isActive: true },
      attributes: [
        "pipelineId",
        "pipelineName",
        "color",
        "isDefault",
        "displayOrder",
      ],
      order: [
        ["isDefault", "DESC"],
        ["displayOrder", "ASC"],
        ["pipelineName", "ASC"],
      ],
    });

    // Get existing rules for this group
    const existingRules = await PipelineVisibilityRule.findAll({
      where: { groupId, masterUserID, isActive: true },
      include: [
        {
          model: Pipeline,
          as: "pipeline",
          attributes: ["pipelineId", "pipelineName", "color", "isDefault"],
        },
      ],
    });

    // Combine pipeline data with visibility rules
    const pipelineVisibility = allPipelines.map((pipeline) => {
      const rule = existingRules.find(
        (r) => r.pipelineId === pipeline.pipelineId
      );

      return {
        pipelineId: pipeline.pipelineId,
        pipelineName: pipeline.pipelineName,
        color: pipeline.color,
        isDefault: pipeline.isDefault,
        displayOrder: pipeline.displayOrder,
        hasAccess: !!rule,
        canView: rule ? rule.canView : false,
        canEdit: rule ? rule.canEdit : false,
        canDelete: rule ? rule.canDelete : false,
        canCreateDeals: rule ? rule.canCreateDeals : false,
        ruleId: rule ? rule.ruleId : null,
      };
    });

    // Calculate summary
    const totalPipelines = allPipelines.length;
    const visiblePipelines = pipelineVisibility.filter(
      (p) => p.hasAccess
    ).length;

    res.status(200).json({
      message: "Pipeline visibility rules retrieved successfully.",
      group: {
        groupId: group.groupId,
        groupName: group.groupName,
      },
      pipelineVisibility,
      summary: {
        totalPipelines,
        visiblePipelines,
        hiddenPipelines: totalPipelines - visiblePipelines,
        visibilityPercentage:
          totalPipelines > 0
            ? Math.round((visiblePipelines / totalPipelines) * 100)
            : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching pipeline visibility rules:", error);
    res.status(500).json({
      message: "Failed to fetch pipeline visibility rules.",
      error: error.message,
    });
  }
};

// Update pipeline visibility rules for a group
exports.updateGroupPipelineRules = async (req, res) => {
  const { VisibilityGroup, Pipeline, PipelineVisibilityRule, History } = req.models;
  const { groupId } = req.params;
  const { pipelineRules } = req.body;
  const masterUserID = req.adminId;
  const updatedBy = req.adminId;

  try {
    if (!pipelineRules || !Array.isArray(pipelineRules)) {
      return res.status(400).json({
        message: "pipelineRules array is required.",
      });
    }

    const group = await VisibilityGroup.findOne({
      where: { groupId, masterUserID },
    });

    if (!group) {
      return res.status(404).json({
        message: "Visibility group not found.",
      });
    }

    // Validate that all pipelines belong to this user
    const pipelineIds = pipelineRules.map((rule) => rule.pipelineId);
    const validPipelines = await Pipeline.findAll({
      where: {
        pipelineId: { [Op.in]: pipelineIds },
        masterUserID,
        isActive: true,
      },
    });

    if (validPipelines.length !== pipelineIds.length) {
      const validPipelineIds = validPipelines.map((p) => p.pipelineId);
      const invalidPipelineIds = pipelineIds.filter(
        (id) => !validPipelineIds.includes(id)
      );
      return res.status(400).json({
        message: `Invalid pipeline IDs: ${invalidPipelineIds.join(", ")}`,
      });
    }

    // Get existing rules
    const existingRules = await PipelineVisibilityRule.findAll({
      where: { groupId, masterUserID },
    });

    const existingRulesMap = new Map(
      existingRules.map((rule) => [rule.pipelineId, rule])
    );

    const updatedRules = [];
    const createdRules = [];

    // Process each pipeline rule
    for (const ruleData of pipelineRules) {
      const {
        pipelineId,
        canView = false,
        canEdit = false,
        canDelete = false,
        canCreateDeals = false,
      } = ruleData;

      const existingRule = existingRulesMap.get(pipelineId);

      if (existingRule) {
        // Update existing rule
        await existingRule.update({
          canView,
          canEdit,
          canDelete,
          canCreateDeals,
          isActive: canView, // Deactivate if no view access
          updatedBy,
        });
        updatedRules.push(existingRule);
      } else {
        // Create new rule only if view access is granted
        if (canView) {
          const newRule = await PipelineVisibilityRule.create({
            groupId,
            pipelineId,
            masterUserID,
            canView,
            canEdit,
            canDelete,
            canCreateDeals,
            createdBy: updatedBy,
          });
          createdRules.push(newRule);
        }
      }
    }

    // Deactivate rules for pipelines not included in the update
    const updatedPipelineIds = pipelineRules.map((rule) => rule.pipelineId);
    await PipelineVisibilityRule.update(
      { isActive: false, updatedBy },
      {
        where: {
          groupId,
          masterUserID,
          pipelineId: { [Op.notIn]: updatedPipelineIds },
        },
      }
    );

    await historyLogger(
      History,
      PROGRAMS.LEAD_MANAGEMENT,
      "PIPELINE_VISIBILITY_UPDATE",
      masterUserID,
      groupId,
      null,
      `Pipeline visibility rules updated for group "${group.groupName}"`,
      {
        updatedRules: updatedRules.length,
        createdRules: createdRules.length,
        totalRules: pipelineRules.length,
      }
    );

    res.status(200).json({
      message: "Pipeline visibility rules updated successfully.",
      summary: {
        updatedRules: updatedRules.length,
        createdRules: createdRules.length,
        totalRules: pipelineRules.length,
      },
    });
  } catch (error) {
    console.error("Error updating pipeline visibility rules:", error);
    res.status(500).json({
      message: "Failed to update pipeline visibility rules.",
      error: error.message,
    });
  }
};

// Grant access to specific pipeline for a group
exports.grantPipelineAccess = async (req, res) => {
  const { VisibilityGroup, Pipeline, PipelineVisibilityRule, History, AuditTrail } = req.models;
  const { groupId, pipelineId } = req.params;
  const {
    canView = true,
    canEdit = false,
    canDelete = false,
    canCreateDeals = true,
  } = req.body;

  const masterUserID = req.adminId;
  const createdBy = req.adminId;

  try {
    const group = await VisibilityGroup.findOne({
      where: { groupId, masterUserID },
    });

    if (!group) {
      return res.status(404).json({
        message: "Visibility group not found.",
      });
    }

    const pipeline = await Pipeline.findOne({
      where: { pipelineId, masterUserID, isActive: true },
    });

    if (!pipeline) {
      return res.status(404).json({
        message: "Pipeline not found.",
      });
    }

    // Check if rule already exists
    let rule = await PipelineVisibilityRule.findOne({
      where: { groupId, pipelineId, masterUserID },
    });

    if (rule) {
      // Update existing rule
      await rule.update({
        canView,
        canEdit,
        canDelete,
        canCreateDeals,
        isActive: true,
        updatedBy: createdBy,
      });
    } else {
      // Create new rule
      rule = await PipelineVisibilityRule.create({
        groupId,
        pipelineId,
        masterUserID,
        canView,
        canEdit,
        canDelete,
        canCreateDeals,
        createdBy,
      });
    }

    await historyLogger(
      History,
      PROGRAMS.LEAD_MANAGEMENT,
      "PIPELINE_ACCESS_GRANTED",
      masterUserID,
      groupId,
      null,
      `Access granted to pipeline "${pipeline.pipelineName}" for group "${group.groupName}"`,
      {
        pipelineId,
        permissions: { canView, canEdit, canDelete, canCreateDeals },
      }
    );

    res.status(200).json({
      message: "Pipeline access granted successfully.",
      rule,
      group: {
        groupId: group.groupId,
        groupName: group.groupName,
      },
      pipeline: {
        pipelineId: pipeline.pipelineId,
        pipelineName: pipeline.pipelineName,
      },
    });
  } catch (error) {
    console.error("Error granting pipeline access:", error);
    res.status(500).json({
      message: "Failed to grant pipeline access.",
      error: error.message,
    });
  }
};

// Revoke access to specific pipeline for a group
exports.revokePipelineAccess = async (req, res) => {
  const { VisibilityGroup, Pipeline, PipelineVisibilityRule, History } = req.models;
  const { groupId, pipelineId } = req.params;
  const masterUserID = req.adminId;

  try {
    const group = await VisibilityGroup.findOne({
      where: { groupId, masterUserID },
    });

    if (!group) {
      return res.status(404).json({
        message: "Visibility group not found.",
      });
    }

    const pipeline = await Pipeline.findOne({
      where: { pipelineId, masterUserID },
    });

    if (!pipeline) {
      return res.status(404).json({
        message: "Pipeline not found.",
      });
    }

    const rule = await PipelineVisibilityRule.findOne({
      where: { groupId, pipelineId, masterUserID, isActive: true },
    });

    if (!rule) {
      return res.status(404).json({
        message: "Pipeline access rule not found.",
      });
    }

    await rule.update({
      isActive: false,
      updatedBy: req.adminId,
    });

    await historyLogger(
      History,
      PROGRAMS.LEAD_MANAGEMENT,
      "PIPELINE_ACCESS_REVOKED",
      masterUserID,
      groupId,
      null,
      `Access revoked from pipeline "${pipeline.pipelineName}" for group "${group.groupName}"`,
      { pipelineId }
    );

    res.status(200).json({
      message: "Pipeline access revoked successfully.",
      group: {
        groupId: group.groupId,
        groupName: group.groupName,
      },
      pipeline: {
        pipelineId: pipeline.pipelineId,
        pipelineName: pipeline.pipelineName,
      },
    });
  } catch (error) {
    console.error("Error revoking pipeline access:", error);
    res.status(500).json({
      message: "Failed to revoke pipeline access.",
      error: error.message,
    });
  }
};

module.exports = exports;
