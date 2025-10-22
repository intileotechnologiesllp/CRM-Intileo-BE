// controllers/deals/lostReasonController.js
const LostReason = require("../../models/deals/lostReasonModel");
const LostReasonSetting = require("../../models/deals/lostReasonSettingModel");
const { Op } = require("sequelize");

/**
 * Create a new lost reason
 * @route POST /api/lost-reasons
 * @desc Create a new lost reason
 * @access Private
 */
exports.createLostReason = async (req, res) => {
  try {
    const { reason, description, isActive = true, sortOrder = 0 } = req.body;
    const masterUserID = req.adminId || req.user?.id;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ 
        message: "Reason is required.",
        errors: { reason: "Reason cannot be empty" }
      });
    }

    // Check for duplicate reason for this user
    const existingReason = await LostReason.findOne({ 
      where: { 
        reason: reason.trim(),
        masterUserID: masterUserID
      } 
    });

    if (existingReason) {
      return res.status(409).json({ 
        message: "Lost reason already exists.",
        errors: { reason: "This reason already exists" }
      });
    }

    const lostReason = await LostReason.create({ 
      reason: reason.trim(), 
      description: description?.trim() || null,
      isActive,
      sortOrder,
      masterUserID,
      isSystemDefault: false
    });

    res.status(201).json({ 
      message: "Lost reason created successfully.", 
      lostReason 
    });
  } catch (error) {
    console.error("Error creating lost reason:", error);
    res.status(500).json({ 
      
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all lost reasons
 * @route GET /api/lost-reasons
 * @desc Get all lost reasons for the current user
 * @access Private
 */
exports.getLostReasons = async (req, res) => {
  try {
    const masterUserID = req.adminId || req.user?.id;
    const { includeInactive = false, includeSystem = true } = req.query;

    let whereClause = {
      [Op.or]: [
        { masterUserID: masterUserID },
        { isSystemDefault: true } // Include system defaults
      ]
    };

    // if (!includeInactive) {
    //   whereClause.isActive = true;
    // }

    if (!includeSystem) {
      whereClause.isSystemDefault = false;
    }

    const lostReasons = await LostReason.findAll({ 
      where: whereClause,
      order: [
        ['sortOrder', 'ASC'],
        ['reason', 'ASC']
      ]
    });

    // Get settings
    const settings = await LostReasonSetting.findOne({
      where: { masterUserID: masterUserID }
    }) || await LostReasonSetting.findOne({
      where: { isGlobal: true }
    }) || { allowFreeFormReasons: true, requireReasonSelection: true };

    res.status(200).json({ 
      message: "Lost reasons fetched successfully",
      lostReasons,
      settings: {
        allowFreeFormReasons: settings.allowFreeFormReasons,
        requireReasonSelection: settings.requireReasonSelection
      },
      totalCount: lostReasons.length
    });
  } catch (error) {
    console.error("Error fetching lost reasons:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get single lost reason
 * @route GET /api/lost-reasons/:id
 * @desc Get a specific lost reason by ID
 * @access Private
 */
exports.getLostReason = async (req, res) => {
  try {
    const { id } = req.params;
    const masterUserID = req.adminId || req.user?.id;

    const lostReason = await LostReason.findOne({
      where: {
        lostReasonId: id,
        [Op.or]: [
          { masterUserID: masterUserID },
          { isSystemDefault: true }
        ]
      }
    });

    if (!lostReason) {
      return res.status(404).json({ message: "Lost reason not found." });
    }

    res.status(200).json({ 
      message: "Lost reason fetched successfully",
      lostReason 
    });
  } catch (error) {
    console.error("Error fetching lost reason:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update lost reason
 * @route PUT /api/lost-reasons/:id
 * @desc Update a lost reason
 * @access Private
 */
exports.updateLostReason = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, description, isActive, sortOrder } = req.body;
    const masterUserID = req.adminId || req.user?.id;

    const lostReason = await LostReason.findOne({
      where: {
        lostReasonId: id,
        masterUserID: masterUserID // Users can only update their own reasons
      }
    });

    if (!lostReason) {
      return res.status(404).json({ 
        message: "Lost reason not found or you don't have permission to edit it." 
      });
    }

    // Check for duplicate if reason is being changed
    if (reason && reason.trim() !== lostReason.reason) {
      const existingReason = await LostReason.findOne({ 
        where: { 
          reason: reason.trim(),
          masterUserID: masterUserID,
          lostReasonId: { [Op.ne]: id }
        } 
      });

      if (existingReason) {
        return res.status(409).json({ 
          message: "Lost reason already exists.",
          errors: { reason: "This reason already exists" }
        });
      }
    }

    // Update fields
    if (reason !== undefined) lostReason.reason = reason.trim();
    if (description !== undefined) lostReason.description = description?.trim() || null;
    if (isActive !== undefined) lostReason.isActive = isActive;
    if (sortOrder !== undefined) lostReason.sortOrder = sortOrder;

    await lostReason.save();

    res.status(200).json({ 
      message: "Lost reason updated successfully.", 
      lostReason 
    });
  } catch (error) {
    console.error("Error updating lost reason:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete lost reason
 * @route DELETE /api/lost-reasons/:id
 * @desc Permanently delete a lost reason
 * @access Private
 */
exports.deleteLostReason = async (req, res) => {
  try {
    const { id } = req.params;
    const masterUserID = req.adminId || req.user?.id;

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ 
        message: "Invalid lost reason ID provided.",
        errors: { id: "Lost reason ID must be a valid number" }
      });
    }

    const lostReason = await LostReason.findOne({
      where: {
        lostReasonId: parseInt(id),
        masterUserID: masterUserID // Users can only delete their own reasons
      }
    });

    if (!lostReason) {
      return res.status(404).json({ 
        message: "Lost reason not found or you don't have permission to delete it." 
      });
    }

    if (lostReason.isSystemDefault) {
      return res.status(403).json({ 
        message: "Cannot delete system default lost reasons.",
        errors: { systemDefault: "System default reasons are protected from deletion" }
      });
    }

    // Store reason details for response
    const deletedReason = {
      lostReasonId: lostReason.lostReasonId,
      reason: lostReason.reason,
      description: lostReason.description
    };

    // Permanently delete the lost reason
    await lostReason.destroy();
    
    res.status(200).json({ 
      message: "Lost reason permanently deleted.",
      deletedReason
    });
  } catch (error) {
    console.error("Error deleting lost reason:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update lost reason settings
 * @route PUT /api/lost-reasons/settings
 * @desc Update lost reason settings (allow free-form, require selection, etc.)
 * @access Private
 */
exports.updateLostReasonSettings = async (req, res) => {
  try {
    const { allowFreeFormReasons, requireReasonSelection } = req.body;
    const masterUserID = req.adminId || req.user?.id;

    if (allowFreeFormReasons === undefined && requireReasonSelection === undefined) {
      return res.status(400).json({ 
        message: "At least one setting must be provided.",
        validSettings: ["allowFreeFormReasons", "requireReasonSelection"]
      });
    }

    let settings = await LostReasonSetting.findOne({
      where: { masterUserID: masterUserID }
    });

    if (!settings) {
      // Create new settings record
      settings = await LostReasonSetting.create({
        masterUserID: masterUserID,
        allowFreeFormReasons: allowFreeFormReasons !== undefined ? allowFreeFormReasons : true,
        requireReasonSelection: requireReasonSelection !== undefined ? requireReasonSelection : true,
        isGlobal: false
      });
    } else {
      // Update existing settings
      if (allowFreeFormReasons !== undefined) {
        settings.allowFreeFormReasons = allowFreeFormReasons;
      }
      if (requireReasonSelection !== undefined) {
        settings.requireReasonSelection = requireReasonSelection;
      }
      await settings.save();
    }

    res.status(200).json({ 
      message: "Lost reason settings updated successfully.", 
      settings: {
        allowFreeFormReasons: settings.allowFreeFormReasons,
        requireReasonSelection: settings.requireReasonSelection
      }
    });
  } catch (error) {
    console.error("Error updating lost reason settings:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get lost reason settings
 * @route GET /api/lost-reasons/settings
 * @desc Get lost reason settings for the current user
 * @access Private
 */
exports.getLostReasonSettings = async (req, res) => {
  try {
    const masterUserID = req.adminId || req.user?.id;

    let settings = await LostReasonSetting.findOne({
      where: { masterUserID: masterUserID }
    });

    if (!settings) {
      // Try to get global settings
      settings = await LostReasonSetting.findOne({
        where: { isGlobal: true }
      });
    }

    if (!settings) {
      // Return default settings
      settings = {
        allowFreeFormReasons: true,
        requireReasonSelection: true
      };
    }

    res.status(200).json({ 
      message: "Lost reason settings fetched successfully.",
      settings: {
        allowFreeFormReasons: settings.allowFreeFormReasons,
        requireReasonSelection: settings.requireReasonSelection
      }
    });
  } catch (error) {
    console.error("Error fetching lost reason settings:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Bulk update lost reasons (reorder, bulk activate/deactivate)
 * @route PUT /api/lost-reasons/bulk
 * @desc Bulk update multiple lost reasons
 * @access Private
 */
exports.bulkUpdateLostReasons = async (req, res) => {
  try {
    const { reasons, action } = req.body;
    const masterUserID = req.adminId || req.user?.id;

    if (!reasons || !Array.isArray(reasons) || reasons.length === 0) {
      return res.status(400).json({ 
        message: "Reasons array is required and must not be empty.",
        example: {
          reasons: [
            { id: 1, sortOrder: 1 },
            { id: 2, sortOrder: 2 }
          ],
          action: "reorder" // or "activate", "deactivate"
        }
      });
    }

    let updatedCount = 0;

    for (const reasonData of reasons) {
      const lostReason = await LostReason.findOne({
        where: {
          lostReasonId: reasonData.id,
          masterUserID: masterUserID
        }
      });

      if (lostReason) {
        switch (action) {
          case 'reorder':
            if (reasonData.sortOrder !== undefined) {
              lostReason.sortOrder = reasonData.sortOrder;
            }
            break;
          case 'activate':
            lostReason.isActive = true;
            break;
          case 'deactivate':
            lostReason.isActive = false;
            break;
          default:
            // Update any provided fields
            if (reasonData.sortOrder !== undefined) lostReason.sortOrder = reasonData.sortOrder;
            if (reasonData.isActive !== undefined) lostReason.isActive = reasonData.isActive;
            if (reasonData.reason !== undefined) lostReason.reason = reasonData.reason.trim();
            if (reasonData.description !== undefined) lostReason.description = reasonData.description?.trim() || null;
        }

        await lostReason.save();
        updatedCount++;
      }
    }

    res.status(200).json({ 
      message: `Bulk update completed successfully. ${updatedCount} reasons updated.`,
      updatedCount,
      action: action || 'update'
    });
  } catch (error) {
    console.error("Error in bulk update lost reasons:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create default lost reasons for a user
 * @route POST /api/lost-reasons/create-defaults
 * @desc Create default lost reasons for the current user
 * @access Private
 */
exports.createDefaultLostReasons = async (req, res) => {
  try {
    const masterUserID = req.adminId || req.user?.id;

    const defaultReasons = [
      { reason: "Not Eligible", description: "Prospect doesn't meet the qualification criteria", sortOrder: 1 },
      { reason: "Incorrect Info", description: "Wrong contact information or misqualified lead", sortOrder: 2 },
      { reason: "Delay", description: "Decision postponed to a later date", sortOrder: 3 },
      { reason: "High Prices", description: "Our pricing was higher than their budget", sortOrder: 4 },
      { reason: "New Proposal to be issued", description: "Needs a revised proposal with different terms", sortOrder: 5 },
      { reason: "New Proposal Issued", description: "Converted to a new opportunity", sortOrder: 6 }
    ];

    const createdReasons = [];
    const skippedReasons = [];

    for (const reasonData of defaultReasons) {
      const existingReason = await LostReason.findOne({
        where: {
          reason: reasonData.reason,
          masterUserID: masterUserID
        }
      });

      if (!existingReason) {
        const newReason = await LostReason.create({
          ...reasonData,
          masterUserID,
          isSystemDefault: false,
          isActive: true
        });
        createdReasons.push(newReason);
      } else {
        skippedReasons.push(reasonData.reason);
      }
    }

    res.status(201).json({
      message: "Default lost reasons setup completed.",
      created: createdReasons.length,
      skipped: skippedReasons.length,
      createdReasons,
      skippedReasons
    });
  } catch (error) {
    console.error("Error creating default lost reasons:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};