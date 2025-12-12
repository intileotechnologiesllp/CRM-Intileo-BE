const CustomField = require("../models/customFieldModel");
const CustomFieldValue = require("../models/customFieldValueModel");
const Deal = require("../models/deals/dealsModels");
const { Op } = require("sequelize");
const sequelize = require("../config/db");
const { logAuditTrail } = require("../utils/auditTrailLogger");
const PROGRAMS = require("../utils/programConstants");
const historyLogger = require("../utils/historyLogger").logHistory;
const NotificationTriggers = require("../services/notification/notificationTriggers");

// Create a new deal with custom fields
exports.createDeal = async (req, res) => {
  const { customFields } = req.body;
  const masterUserID = req.adminId;
  const entityType = "deal";

  try {
    if (!customFields) {
      return res.status(400).json({
        message: "customFields are required.",
      });
    }

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Create the deal in the database first
      const dealData = {
        masterUserID,
        // Initialize with minimal required fields
        title: "",
        status: "open",
      };

      // Extract essential fields from customFields if present
      const essentialFields = [
        "title",
        "value",
        "currency",
        "pipeline",
        "pipelineStage",
        "expectedCloseDate",
      ];
      for (const essentialField of essentialFields) {
        if (customFields[essentialField]) {
          dealData[essentialField] = customFields[essentialField];
        }
      }

      // Create the deal record
      const deal = await Deal.create(dealData, { transaction });
      const entityId = deal.dealId;

      const savedValues = [];
      const validationErrors = [];

      // Process each custom field
      for (const [fieldKey, value] of Object.entries(customFields)) {
        let customField;

        // Check if it's a fieldId (numeric) or fieldName (string)
        if (isNaN(fieldKey)) {
          // It's a fieldName - search by fieldName
          customField = await CustomField.findOne({
            where: { fieldName: fieldKey, masterUserID, entityType },
            transaction,
          });
        } else {
          // It's a fieldId - search by fieldId
          customField = await CustomField.findOne({
            where: { fieldId: fieldKey, masterUserID, entityType },
            transaction,
          });
        }

        if (!customField) {
          continue; // Skip invalid fields
        }

        // Validate required fields
        if (
          customField.isRequired &&
          (value === null || value === "" || value === undefined)
        ) {
          validationErrors.push(
            `Field "${customField.fieldLabel}" is required.`
          );
          continue;
        }

        // Validate value based on field type
        let processedValue = value;

        if (
          customField.fieldType === "number" &&
          value !== null &&
          value !== ""
        ) {
          processedValue = parseFloat(value);
          if (isNaN(processedValue)) {
            validationErrors.push(
              `Invalid number value for field "${customField.fieldLabel}".`
            );
            continue;
          }
        }

        if (customField.fieldType === "email" && value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            validationErrors.push(
              `Invalid email format for field "${customField.fieldLabel}".`
            );
            continue;
          }
        }

        if (customField.fieldType === "select" && customField.options) {
          const validOptions = Array.isArray(customField.options)
            ? customField.options
            : [];
          if (value && !validOptions.includes(value)) {
            validationErrors.push(
              `Invalid option "${value}" for field "${customField.fieldLabel}".`
            );
            continue;
          }
        }

        // Create the field value
        const fieldValue = await CustomFieldValue.create(
          {
            fieldId: customField.fieldId,
            entityId: entityId.toString(),
            entityType,
            value: processedValue,
            masterUserID,
          },
          { transaction }
        );

        savedValues.push({
          fieldId: customField.fieldId,
          fieldName: customField.fieldName,
          fieldLabel: customField.fieldLabel,
          fieldType: customField.fieldType,
          value: processedValue,
          isRequired: customField.isRequired,
          isImportant: customField.isImportant,
        });
      }

      // Check for validation errors
      if (validationErrors.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          message: "Validation errors occurred.",
          errors: validationErrors,
        });
      }

      // Commit the transaction
      await transaction.commit();

      // 🔔 Send Notification - Deal Created
      try {
        const ownerId = deal.ownerId || masterUserID;
        await NotificationTriggers.dealCreated(
          deal.dealId,
          ownerId,
          masterUserID
        );
      } catch (notifError) {
        console.error('Failed to send deal created notification:', notifError);
        // Don't fail the request if notification fails
      }

      // Log the creation
      await historyLogger(
        PROGRAMS.LEAD_MANAGEMENT,
        "DEAL_CREATION",
        masterUserID,
        entityId,
        null,
        `Deal created with custom fields`,
        { customFields: savedValues }
      );

      res.status(201).json({
        message: "Deal created successfully with custom fields.",
        dealId: entityId,
        entityType,
        customFields: savedValues,
        totalFields: savedValues.length,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error creating deal with custom fields:", error);
    res.status(500).json({
      message: "Failed to create deal with custom fields.",
      error: error.message,
    });
  }
};

// Get all deals with custom fields
exports.getAllDeals = async (req, res) => {
  const masterUserID = req.adminId;
  const entityType = "deal";

  try {
    // Get all deals for this user
    const deals = await Deal.findAll({
      where: { masterUserID },
      order: [["createdAt", "DESC"]],
    });

    const dealsWithCustomFields = [];

    for (const deal of deals) {
      const customFieldValues = await CustomFieldValue.findAll({
        where: {
          entityId: deal.dealId.toString(),
          entityType,
          masterUserID,
        },
        include: [
          {
            model: CustomField,
            as: "CustomField",
            where: { isActive: true },
            required: true,
          },
        ],
        order: [
          [{ model: CustomField, as: "CustomField" }, "category", "ASC"],
          [{ model: CustomField, as: "CustomField" }, "fieldGroup", "ASC"],
          [{ model: CustomField, as: "CustomField" }, "displayOrder", "ASC"],
        ],
      });

      // Format the custom fields
      const formattedCustomFields = {};
      customFieldValues.forEach((value) => {
        const field = value.CustomField;
        formattedCustomFields[field.fieldName] = {
          fieldId: field.fieldId,
          fieldName: field.fieldName,
          fieldLabel: field.fieldLabel,
          fieldType: field.fieldType,
          value: value.value,
          options: field.options,
          isRequired: field.isRequired,
          isImportant: field.isImportant,
        };
      });

      dealsWithCustomFields.push({
        dealId: deal.dealId,
        title: deal.title,
        value: deal.value,
        currency: deal.currency,
        pipeline: deal.pipeline,
        pipelineStage: deal.pipelineStage,
        status: deal.status,
        expectedCloseDate: deal.expectedCloseDate,
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt,
        customFields: formattedCustomFields,
      });
    }

    res.status(200).json({
      message: "Deals retrieved successfully.",
      deals: dealsWithCustomFields,
      totalDeals: dealsWithCustomFields.length,
    });
  } catch (error) {
    console.error("Error fetching deals:", error);
    res.status(500).json({
      message: "Failed to fetch deals.",
      error: error.message,
    });
  }
};

// Get a specific deal with custom fields
exports.getDealById = async (req, res) => {
  const { dealId } = req.params;
  const masterUserID = req.adminId;
  const entityType = "deal";

  try {
    // Get the deal
    const deal = await Deal.findOne({
      where: { dealId, masterUserID },
    });

    if (!deal) {
      return res.status(404).json({
        message: "Deal not found.",
      });
    }

    // Get custom field values
    const customFieldValues = await CustomFieldValue.findAll({
      where: {
        entityId: dealId.toString(),
        entityType,
        masterUserID,
      },
      include: [
        {
          model: CustomField,
          as: "CustomField",
          where: { isActive: true },
          required: true,
        },
      ],
      order: [
        [{ model: CustomField, as: "CustomField" }, "category", "ASC"],
        [{ model: CustomField, as: "CustomField" }, "fieldGroup", "ASC"],
        [{ model: CustomField, as: "CustomField" }, "displayOrder", "ASC"],
      ],
    });

    // Format the response
    const formattedValues = {};
    const fieldsByCategory = {};
    const fieldsByGroup = {};

    customFieldValues.forEach((value) => {
      const field = value.CustomField;
      const category = field.category || "Details";
      const fieldGroup = field.fieldGroup || "Default";

      formattedValues[field.fieldId] = {
        fieldId: field.fieldId,
        fieldName: field.fieldName,
        fieldLabel: field.fieldLabel,
        fieldType: field.fieldType,
        value: value.value,
        options: field.options,
        isRequired: field.isRequired,
        isImportant: field.isImportant,
        category: category,
        fieldGroup: fieldGroup,
      };

      if (!fieldsByCategory[category]) {
        fieldsByCategory[category] = [];
      }
      fieldsByCategory[category].push(formattedValues[field.fieldId]);

      if (!fieldsByGroup[fieldGroup]) {
        fieldsByGroup[fieldGroup] = [];
      }
      fieldsByGroup[fieldGroup].push(formattedValues[field.fieldId]);
    });

    res.status(200).json({
      message: "Deal retrieved successfully.",
      deal: {
        dealId: deal.dealId,
        title: deal.title,
        value: deal.value,
        currency: deal.currency,
        pipeline: deal.pipeline,
        pipelineStage: deal.pipelineStage,
        status: deal.status,
        expectedCloseDate: deal.expectedCloseDate,
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt,
      },
      customFields: {
        values: formattedValues,
        fieldsByCategory,
        fieldsByGroup,
      },
    });
  } catch (error) {
    console.error("Error fetching deal:", error);
    res.status(500).json({
      message: "Failed to fetch deal.",
      error: error.message,
    });
  }
};

// Update a deal with custom fields
exports.updateDeal = async (req, res) => {
  const { dealId } = req.params;
  const { customFields } = req.body;
  const masterUserID = req.adminId;
  const entityType = "deal";

  try {
    // Check if deal exists
    const deal = await Deal.findOne({
      where: { dealId, masterUserID },
    });

    if (!deal) {
      return res.status(404).json({
        message: "Deal not found.",
      });
    }

    if (!customFields) {
      return res.status(400).json({
        message: "customFields are required.",
      });
    }

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      const updatedValues = [];
      const validationErrors = [];

      // Process each custom field
      for (const [fieldKey, value] of Object.entries(customFields)) {
        let customField;

        // Check if it's a fieldId (numeric) or fieldName (string)
        if (isNaN(fieldKey)) {
          // It's a fieldName - search by fieldName
          customField = await CustomField.findOne({
            where: { fieldName: fieldKey, masterUserID, entityType },
            transaction,
          });
        } else {
          // It's a fieldId - search by fieldId
          customField = await CustomField.findOne({
            where: { fieldId: fieldKey, masterUserID, entityType },
            transaction,
          });
        }

        if (!customField) {
          continue; // Skip invalid fields
        }

        // Validate required fields
        if (
          customField.isRequired &&
          (value === null || value === "" || value === undefined)
        ) {
          validationErrors.push(
            `Field "${customField.fieldLabel}" is required.`
          );
          continue;
        }

        // Validate value based on field type
        let processedValue = value;

        if (
          customField.fieldType === "number" &&
          value !== null &&
          value !== ""
        ) {
          processedValue = parseFloat(value);
          if (isNaN(processedValue)) {
            validationErrors.push(
              `Invalid number value for field "${customField.fieldLabel}".`
            );
            continue;
          }
        }

        if (customField.fieldType === "email" && value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            validationErrors.push(
              `Invalid email format for field "${customField.fieldLabel}".`
            );
            continue;
          }
        }

        // Find or create the field value
        let fieldValue = await CustomFieldValue.findOne({
          where: {
            fieldId: customField.fieldId,
            entityId: dealId.toString(),
            entityType,
            masterUserID,
          },
          transaction,
        });

        if (fieldValue) {
          // Update existing value
          await fieldValue.update({ value: processedValue }, { transaction });
        } else {
          // Create new value
          fieldValue = await CustomFieldValue.create(
            {
              fieldId: customField.fieldId,
              entityId: dealId.toString(),
              entityType,
              value: processedValue,
              masterUserID,
            },
            { transaction }
          );
        }

        updatedValues.push({
          fieldId: customField.fieldId,
          fieldName: customField.fieldName,
          fieldLabel: customField.fieldLabel,
          fieldType: customField.fieldType,
          value: processedValue,
          isRequired: customField.isRequired,
          isImportant: customField.isImportant,
        });
      }

      // Check for validation errors
      if (validationErrors.length > 0) {
        await transaction.rollback();
        return res.status(400).json({
          message: "Validation errors occurred.",
          errors: validationErrors,
        });
      }

      // Commit the transaction
      await transaction.commit();

      // 🔔 Send Notifications - Deal Updated/Assigned/Won/Lost
      try {
        // Check if owner changed (deal assigned)
        const ownerField = updatedValues.find(f => f.fieldName === 'ownerId');
        if (ownerField && ownerField.value && ownerField.value !== deal.ownerId) {
          await NotificationTriggers.dealAssigned(
            dealId,
            ownerField.value,
            masterUserID
          );
        }

        // Check if status changed to won
        const statusField = updatedValues.find(f => f.fieldName === 'status');
        if (statusField && statusField.value === 'won' && deal.status !== 'won') {
          await NotificationTriggers.dealWon(
            dealId,
            deal.ownerId || masterUserID,
            masterUserID
          );
        }

        // Check if status changed to lost
        if (statusField && statusField.value === 'lost' && deal.status !== 'lost') {
          await NotificationTriggers.dealLost(
            dealId,
            deal.ownerId || masterUserID,
            masterUserID
          );
        }
      } catch (notifError) {
        console.error('Failed to send deal update notification:', notifError);
        // Don't fail the request if notification fails
      }

      // Log the update
      await historyLogger(
        PROGRAMS.LEAD_MANAGEMENT,
        "DEAL_UPDATE",
        masterUserID,
        dealId,
        null,
        `Deal updated with custom fields`,
        { customFields: updatedValues }
      );

      res.status(200).json({
        message: "Deal updated successfully with custom fields.",
        dealId: dealId,
        customFields: updatedValues,
        totalFields: updatedValues.length,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error updating deal:", error);
    res.status(500).json({
      message: "Failed to update deal.",
      error: error.message,
    });
  }
};

// Delete a deal
exports.deleteDeal = async (req, res) => {
  const { dealId } = req.params;
  const masterUserID = req.adminId;
  const entityType = "deal";

  try {
    // Check if deal exists
    const deal = await Deal.findOne({
      where: { dealId, masterUserID },
    });

    if (!deal) {
      return res.status(404).json({
        message: "Deal not found.",
      });
    }

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Delete all custom field values
      await CustomFieldValue.destroy({
        where: {
          entityId: dealId.toString(),
          entityType,
          masterUserID,
        },
        transaction,
      });

      // Delete the deal
      await deal.destroy({ transaction });

      // Commit the transaction
      await transaction.commit();

      // Log the deletion
      await historyLogger(
        PROGRAMS.LEAD_MANAGEMENT,
        "DEAL_DELETION",
        masterUserID,
        dealId,
        null,
        `Deal deleted`,
        null
      );

      res.status(200).json({
        message: "Deal deleted successfully.",
        dealId: dealId,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error deleting deal:", error);
    res.status(500).json({
      message: "Failed to delete deal.",
      error: error.message,
    });
  }
};
