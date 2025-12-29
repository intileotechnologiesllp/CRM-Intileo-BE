const Pipeline = require("../../models/deals/pipelineModel");
const PipelineStage = require("../../models/deals/pipelineStageModel");
const Deal = require("../../models/deals/dealsModels");
const { Op } = require("sequelize");
const sequelize = require("../../config/db");
const { logAuditTrail } = require("../../utils/auditTrailLogger");
const PROGRAMS = require("../../utils/programConstants");
const historyLogger = require("../../utils/historyLogger").logHistory;

// Create a new pipeline (Admin only)
exports.createPipeline = async (req, res) => {
  const { LostReason, PipelineStage, Pipeline, History, AuditTrail } = req.models;
  const {
    pipelineName,
    description,
    isDefault = false,
    color = "#007BFF",
    displayOrder = 0,
    stages = [],
  } = req.body;

  const masterUserID = req.adminId;
  const createdBy = req.adminId;

  try {
    // Validate required fields
    if (!pipelineName) {
      return res.status(400).json({
        message: "pipelineName is required.",
      });
    }

    // Check if pipeline name already exists for this user
    const existingPipeline = await Pipeline.findOne({
      where: {
        pipelineName: pipelineName.trim(),
        masterUserID,
      },
    });

    if (existingPipeline) {
      return res.status(409).json({
        message: `A pipeline with name "${pipelineName}" already exists.`,
      });
    }

    // If this is set as default, unset other default pipelines
    if (isDefault) {
      await Pipeline.update(
        { isDefault: false },
        { where: { masterUserID, isDefault: true } }
      );
    }

    // Create the pipeline
    const pipeline = await Pipeline.create({
      pipelineName: pipelineName.trim(),
      description,
      isDefault,
      color,
      displayOrder,
      masterUserID,
      createdBy,
    });

    // Create stages if provided
    const createdStages = [];
    if (stages && stages.length > 0) {
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const createdStage = await PipelineStage.create({
          pipelineId: pipeline.pipelineId,
          stageName: stage.stageName,
          stageOrder: stage.stageOrder || i + 1,
          probability: stage.probability || 0,
          dealRottenDays: stage.dealRottenDays || null,
          color: stage.color || "#28A745",
          masterUserID,
          createdBy,
        });
        createdStages.push(createdStage);
      }
    }

    await historyLogger(
      History,
      PROGRAMS.LEAD_MANAGEMENT,
      "PIPELINE_CREATION",
      masterUserID,
      pipeline.pipelineId,
      null,
      `Pipeline "${pipeline.pipelineName}" created with ${createdStages.length} stages`,
      null
    );

    res.status(201).json({
      message: "Pipeline created successfully.",
      pipeline,
      stages: createdStages,
    });
  } catch (error) {
    console.error("Error creating pipeline:", error);
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_MANAGEMENT,
      "PIPELINE_CREATION",
      null,
      "Error creating pipeline: " + error.message,
      null
    );
    res.status(500).json({
      message: "Failed to create pipeline.",
      error: error.message,
    });
  }
};

// Get all pipelines with stages
exports.getPipelines = async (req, res) => {
  const { LostReason, PipelineStage, Pipeline, History, AuditTrail } = req.models;
  const { includeInactive = "false" } = req.query;
  // const masterUserID = req.adminId;

  try {
    // Organization-wide pipelines: Remove masterUserID filter to show all pipelines
    let whereClause = {};

    if (includeInactive !== "true") {
      whereClause.isActive = true;
    }

    const pipelines = await Pipeline.findAll({
      where: whereClause,
      include: [
        {
          model: PipelineStage,
          as: "stages",
          where: includeInactive === "true" ? {} : { isActive: true },
          required: false,
          order: [["stageOrder", "ASC"]],
        },
      ],
      order: [
        ["isDefault", "DESC"],
        ["displayOrder", "ASC"],
        ["pipelineName", "ASC"],
      ],
    });

    res.status(200).json({
      message: "Pipelines retrieved successfully.",
      pipelines,
    });
  } catch (error) {
    console.error("Error fetching pipelines:", error);
    res.status(500).json({
      message: "Failed to fetch pipelines.",
      error: error.message,
    });
  }
};

// Get a single pipeline with its stages
exports.getPipelineById = async (req, res) => {
  const { LostReason, PipelineStage, Pipeline, History, AuditTrail } = req.models;
  const { pipelineId } = req.params;
  // const masterUserID = req.adminId;

  try {
    const pipeline = await Pipeline.findOne({
      where: { pipelineId},
      include: [
        {
          model: PipelineStage,
          as: "stages",
          where: { isActive: true },
          required: false,
          order: [["stageOrder", "ASC"]],
        },
      ],
    });

    if (!pipeline) {
      return res.status(404).json({
        message: "Pipeline not found.",
      });
    }

    res.status(200).json({
      message: "Pipeline retrieved successfully.",
      pipeline,
    });
  } catch (error) {
    console.error("Error fetching pipeline:", error);
    res.status(500).json({
      message: "Failed to fetch pipeline.",
      error: error.message,
    });
  }
};

// Update a pipeline
exports.updatePipeline = async (req, res) => {
  const { LostReason, PipelineStage, Pipeline, History, AuditTrail } = req.models;
  const { pipelineId } = req.params;
  const {
    pipelineName,
    description,
    isDefault,
    color,
    displayOrder,
    isActive,
    stages = [],
  } = req.body;

  const masterUserID = req.adminId;
  const updatedBy = req.adminId;

  try {
    const pipeline = await Pipeline.findOne({
      where: { pipelineId },
      include: [{ model: PipelineStage, as: "stages" }],
    });

    if (!pipeline) {
      return res.status(404).json({
        message: "Pipeline not found.",
      });
    }

    // Check for name conflicts if pipelineName is being updated
    if (pipelineName && pipelineName !== pipeline.pipelineName) {
      const existingPipeline = await Pipeline.findOne({
        where: {
          pipelineName: pipelineName.trim(),
          pipelineId: { [Op.ne]: pipelineId },
        },
      });

      if (existingPipeline) {
        return res.status(409).json({
          message: `A pipeline with name "${pipelineName}" already exists.`,
        });
      }
    }

    // If this is being set as default, unset other default pipelines
    if (isDefault === true) {
      await Pipeline.update(
        { isDefault: false },
        {
          where: {
            isDefault: true,
            pipelineId: { [Op.ne]: pipelineId },
          },
        }
      );
    }

    // Store old values for history
    const oldValues = { ...pipeline.toJSON() };

    // Update the pipeline
    await pipeline.update({
      pipelineName: pipelineName ? pipelineName.trim() : pipeline.pipelineName,
      description:
        description !== undefined ? description : pipeline.description,
      isDefault: isDefault !== undefined ? isDefault : pipeline.isDefault,
      color: color || pipeline.color,
      displayOrder:
        displayOrder !== undefined ? displayOrder : pipeline.displayOrder,
      isActive: isActive !== undefined ? isActive : pipeline.isActive,
      updatedBy,
    });

    // --- Enhanced stage update logic ---
    // 1. Update existing stages, 2. Add new stages, 3. Delete removed stages
    const existingStages = pipeline.stages || [];
    const incomingStageIds = stages
      .filter((s) => s.stageId)
      .map((s) => s.stageId);
    // Delete stages not present in the new list
    for (const stage of existingStages) {
      if (!incomingStageIds.includes(stage.stageId)) {
        await PipelineStage.destroy({
          where: { stageId: stage.stageId, pipelineId, masterUserID },
        });
      }
    }
    // Update or create stages
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      if (s.stageId) {
        // Update existing
        await PipelineStage.update(
          {
            stageName: s.stageName,
            stageOrder: s.stageOrder !== undefined ? s.stageOrder : i + 1,
            probability: s.probability !== undefined ? s.probability : 0,
            dealRottenDays: s.dealRottenDays || null,
            color: s.color || "#28A745",
            isActive: s.isActive !== undefined ? s.isActive : true,
            updatedBy,
          },
          {
            where: { stageId: s.stageId, pipelineId },
          }
        );
      } else {
        // Create new
        await PipelineStage.create({
          pipelineId,
          stageName: s.stageName,
          stageOrder: s.stageOrder !== undefined ? s.stageOrder : i + 1,
          probability: s.probability !== undefined ? s.probability : 0,
          dealRottenDays: s.dealRottenDays || null,
          color: s.color || "#28A745",
          isActive: s.isActive !== undefined ? s.isActive : true,
          masterUserID,
          createdBy: updatedBy,
        });
      }
    }

    await historyLogger(
      History,
      PROGRAMS.LEAD_MANAGEMENT,
      "PIPELINE_UPDATE",
      masterUserID,
      pipeline.pipelineId,
      null,
      `Pipeline "${pipeline.pipelineName}" updated (with stages)`,
      { old: oldValues, new: pipeline.toJSON() }
    );

    // Return updated pipeline with stages
    const updatedPipeline = await Pipeline.findOne({
      where: { pipelineId},
      include: [
        { model: PipelineStage, as: "stages", order: [["stageOrder", "ASC"]] },
      ],
    });

    res.status(200).json({
      message: "Pipeline and stages updated successfully.",
      pipeline: updatedPipeline,
    });
  } catch (error) {
    console.error("Error updating pipeline:", error);
    res.status(500).json({
      message: "Failed to update pipeline.",
      error: error.message,
    });
  }
};

// Delete a pipeline
exports.deletePipeline = async (req, res) => {
  const { LostReason, PipelineStage, Pipeline, History, AuditTrail, Deal } = req.models;
  const { pipelineId } = req.params;
  const masterUserID = req.adminId;

  try {
    const pipeline = await Pipeline.findOne({
      where: { pipelineId},
    });

    if (!pipeline) {
      return res.status(404).json({
        message: "Pipeline not found.",
      });
    }

    // Check if there are deals using this pipeline
    const dealsCount = await Deal.count({
      where: {
        pipelineId: pipelineId,
      },
    });

    if (dealsCount > 0) {
      return res.status(400).json({
        message: `Cannot delete pipeline. There are ${dealsCount} deals using this pipeline. Please move or delete these deals first.`,
      });
    }

    // Delete associated stages first
    await PipelineStage.destroy({
      where: { pipelineId},
    });

    // Delete the pipeline
    await pipeline.destroy();

    await historyLogger(
      History,
      PROGRAMS.LEAD_MANAGEMENT,
      "PIPELINE_DELETION",
      masterUserID,
      pipelineId,
      null,
      `Pipeline "${pipeline.pipelineName}" deleted`,
      null
    );

    res.status(200).json({
      message: "Pipeline deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting pipeline:", error);
    res.status(500).json({
      message: "Failed to delete pipeline.",
      error: error.message,
    });
  }
};

// Create a new stage for a pipeline
exports.createStage = async (req, res) => {
  const { LostReason, PipelineStage, Pipeline, History, AuditTrail, Deal } = req.models;
  const { pipelineId } = req.params;
  const {
    stageName,
    stageOrder,
    probability = 0,
    dealRottenDays,
    color = "#28A745",
  } = req.body;

  const masterUserID = req.adminId;
  const createdBy = req.adminId;

  try {
    // Validate required fields
    if (!stageName) {
      return res.status(400).json({
        message: "stageName is required.",
      });
    }

    // Check if pipeline exists
    const pipeline = await Pipeline.findOne({
      where: { pipelineId},
    });

    if (!pipeline) {
      return res.status(404).json({
        message: "Pipeline not found.",
      });
    }

    // Check if stage name already exists in this pipeline
    const existingStage = await PipelineStage.findOne({
      where: {
        pipelineId,
        stageName: stageName.trim(),

      },
    });

    if (existingStage) {
      return res.status(409).json({
        message: `A stage with name "${stageName}" already exists in this pipeline.`,
      });
    }

    // Get the next stage order if not provided
    let finalStageOrder = stageOrder;
    if (!finalStageOrder) {
      const maxOrder = await PipelineStage.max("stageOrder", {
        where: { pipelineId},
      });
      finalStageOrder = (maxOrder || 0) + 1;
    }

    // Create the stage
    const stage = await PipelineStage.create({
      pipelineId,
      stageName: stageName.trim(),
      stageOrder: finalStageOrder,
      probability,
      dealRottenDays,
      color,
      masterUserID,
      createdBy,
    });

    await historyLogger(
      History,
      PROGRAMS.LEAD_MANAGEMENT,
      "PIPELINE_STAGE_CREATION",
      masterUserID,
      stage.stageId,
      null,
      `Stage "${stage.stageName}" created in pipeline "${pipeline.pipelineName}"`,
      null
    );

    res.status(201).json({
      message: "Stage created successfully.",
      stage,
    });
  } catch (error) {
    console.error("Error creating stage:", error);
    res.status(500).json({
      message: "Failed to create stage.",
      error: error.message,
    });
  }
};

// Update a stage
exports.updateStage = async (req, res) => {
  const { stageId } = req.params;
  const { LostReason, PipelineStage, Pipeline, History, AuditTrail, Deal } = req.models;
  const {
    stageName,
    stageOrder,
    probability,
    dealRottenDays,
    color,
    isActive,
  } = req.body;

  const masterUserID = req.adminId;
  const updatedBy = req.adminId;

  try {
    const stage = await PipelineStage.findOne({
      where: { stageId},
      include: [
        {
          model: Pipeline,
          as: "pipeline",
          attributes: ["pipelineName"],
        },
      ],
    });

    if (!stage) {
      return res.status(404).json({
        message: "Stage not found.",
      });
    }

    // Check for name conflicts if stageName is being updated
    if (stageName && stageName !== stage.stageName) {
      const existingStage = await PipelineStage.findOne({
        where: {
          pipelineId: stage.pipelineId,
          stageName: stageName.trim(),
          stageId: { [Op.ne]: stageId },
        },
      });

      if (existingStage) {
        return res.status(409).json({
          message: `A stage with name "${stageName}" already exists in this pipeline.`,
        });
      }
    }

    // Store old values for history
    const oldValues = { ...stage.toJSON() };

    // Update the stage
    await stage.update({
      stageName: stageName ? stageName.trim() : stage.stageName,
      stageOrder: stageOrder !== undefined ? stageOrder : stage.stageOrder,
      probability: probability !== undefined ? probability : stage.probability,
      dealRottenDays:
        dealRottenDays !== undefined ? dealRottenDays : stage.dealRottenDays,
      color: color || stage.color,
      isActive: isActive !== undefined ? isActive : stage.isActive,
      updatedBy,
    });

    await historyLogger(
      History,
      PROGRAMS.LEAD_MANAGEMENT,
      "PIPELINE_STAGE_UPDATE",
      masterUserID,
      stage.stageId,
      null,
      `Stage "${stage.stageName}" updated`,
      { old: oldValues, new: stage.toJSON() }
    );

    res.status(200).json({
      message: "Stage updated successfully.",
      stage,
    });
  } catch (error) {
    console.error("Error updating stage:", error);
    res.status(500).json({
      message: "Failed to update stage.",
      error: error.message,
    });
  }
};

// Delete a stage
exports.deleteStage = async (req, res) => {
  const { LostReason, PipelineStage, Pipeline, History, AuditTrail, Deal } = req.models;
  const { stageId } = req.params;
  const masterUserID = req.adminId;

  try {
    const stage = await PipelineStage.findOne({
      where: { stageId},
      include: [
        {
          model: Pipeline,
          as: "pipeline",
          attributes: ["pipelineName"],
        },
      ],
    });

    if (!stage) {
      return res.status(404).json({
        message: "Stage not found.",
      });
    }

    // Check if there are deals in this stage
    const dealsCount = await Deal.count({
      where: {
        stageId: stageId
      },
    });

    if (dealsCount > 0) {
      return res.status(400).json({
        message: `Cannot delete stage. There are ${dealsCount} deals in this stage. Please move these deals to another stage first.`,
      });
    }

    await stage.destroy();

    await historyLogger(
      History,
      PROGRAMS.LEAD_MANAGEMENT,
      "PIPELINE_STAGE_DELETION",
      masterUserID,
      stageId,
      null,
      `Stage "${stage.stageName}" deleted from pipeline "${stage.pipeline?.pipelineName}"`,
      null
    );

    res.status(200).json({
      message: "Stage deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting stage:", error);
    res.status(500).json({
      message: "Failed to delete stage.",
      error: error.message,
    });
  }
};

// Reorder stages in a pipeline
exports.reorderStages = async (req, res) => {
  const { LostReason, PipelineStage, Pipeline, History, AuditTrail, Deal } = req.models;
  const { pipelineId } = req.params;
  const { stageOrders } = req.body; // Array of { stageId, stageOrder }
  const masterUserID = req.adminId;

  try {
    // Validate that the pipeline exists
    const pipeline = await Pipeline.findOne({
      where: { pipelineId},
    });

    if (!pipeline) {
      return res.status(404).json({
        message: "Pipeline not found.",
      });
    }

    // Update stage orders
    for (const { stageId, stageOrder } of stageOrders) {
      await PipelineStage.update(
        { stageOrder, updatedBy: req.adminId },
        { where: { stageId, pipelineId} }
      );
    }

    await historyLogger(
      History,
      PROGRAMS.LEAD_MANAGEMENT,
      "PIPELINE_STAGE_REORDER",
      masterUserID,
      pipelineId,
      null,
      `Stages reordered in pipeline "${pipeline.pipelineName}"`,
      { stageOrders }
    );

    res.status(200).json({
      message: "Stages reordered successfully.",
    });
  } catch (error) {
    console.error("Error reordering stages:", error);
    res.status(500).json({
      message: "Failed to reorder stages.",
      error: error.message,
    });
  }
};

// Get pipeline statistics
exports.getPipelineStats = async (req, res) => {
  const { LostReason, PipelineStage, Pipeline, History, AuditTrail, Deal } = req.models;
  const { pipelineId } = req.params;
  const masterUserID = req.adminId;

  try {
    const pipeline = await Pipeline.findOne({
      where: { pipelineId},
      include: [
        {
          model: PipelineStage,
          as: "stages",
          where: { isActive: true },
          required: false,
          order: [["stageOrder", "ASC"]],
        },
      ],
    });

    if (!pipeline) {
      return res.status(404).json({
        message: "Pipeline not found.",
      });
    }

    // Get deal statistics for each stage
    const stageStats = await Promise.all(
      pipeline.stages.map(async (stage) => {
        const dealCount = await Deal.count({
          where: {
            stageId: stage.stageId
          },
        });

        const totalValue =
          (await Deal.sum("value", {
            where: {
              stageId: stage.stageId
            },
          })) || 0;

        return {
          stageId: stage.stageId,
          stageName: stage.stageName,
          stageOrder: stage.stageOrder,
          probability: stage.probability,
          dealCount,
          totalValue,
          weightedValue: (totalValue * stage.probability) / 100,
        };
      })
    );

    // Calculate overall pipeline stats
    const totalDeals = stageStats.reduce(
      (sum, stage) => sum + stage.dealCount,
      0
    );
    const totalValue = stageStats.reduce(
      (sum, stage) => sum + stage.totalValue,
      0
    );
    const totalWeightedValue = stageStats.reduce(
      (sum, stage) => sum + stage.weightedValue,
      0
    );

    res.status(200).json({
      message: "Pipeline statistics retrieved successfully.",
      pipeline: {
        pipelineId: pipeline.pipelineId,
        pipelineName: pipeline.pipelineName,
        totalDeals,
        totalValue,
        totalWeightedValue,
      },
      stageStats,
    });
  } catch (error) {
    console.error("Error fetching pipeline stats:", error);
    res.status(500).json({
      message: "Failed to fetch pipeline statistics.",
      error: error.message,
    });
  }
};
