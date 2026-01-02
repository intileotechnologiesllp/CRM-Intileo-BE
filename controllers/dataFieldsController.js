const { Op } = require("sequelize");
const CustomField = require("../models/customFieldModel");
const CustomFieldValue = require("../models/customFieldValueModel");
const { logAuditTrail } = require("../utils/auditTrailLogger");
const PROGRAMS = require("../utils/programConstants");

// Get all data fields with Pipedrive-style organization
exports.getDataFields = async (req, res) => {
  const {  CustomField, CustomFieldValue, AuditTrail } = req.models;
  try {
    const { entityType = "lead" } = req.query; // Default to lead, can be "lead", "deal", "person", "organization"

    // Get fields that apply to the requested entity type
    const whereClause = {
      isActive: true,
    };

    if (entityType === "lead") {
      whereClause.entityType = { [Op.in]: ["lead", "both"] };
    } else if (entityType === "deal") {
      whereClause.entityType = { [Op.in]: ["deal", "both"] };
    } else {
      whereClause.entityType = entityType;
    }

    // For non-admin users, include their custom fields + default/system fields
    if (req.role !== "admin") {
      whereClause[Op.or] = [
        { masterUserID: req.adminId },
        { fieldSource: ["default", "system"] },
      ];
    }

    const fields = await CustomField.findAll({
      where: whereClause,
      order: [
        ["category", "ASC"],
        ["displayOrder", "ASC"],
      ],
    });

    // Group fields by category (like Pipedrive's sections)
    const groupedFields = {};
    const fieldStats = {
      totalFields: fields.length,
      customFields: 0,
      defaultFields: 0,
      systemFields: 0,
      categories: new Set(),
    };

    fields.forEach((field) => {
      const category = field.category || "Ungrouped custom fields";

      if (!groupedFields[category]) {
        groupedFields[category] = {
          name: category,
          fields: [],
          isCollapsible: field.isCollapsible !== false,
          fieldCount: 0,
        };
      }

      groupedFields[category].fields.push({
        fieldId: field.fieldId,
        fieldName: field.fieldName,
        fieldLabel: field.fieldLabel,
        fieldType: field.fieldType,
        entityType: field.entityType,
        fieldSource: field.fieldSource,
        isRequired: field.isRequired,
        isImportant: field.isImportant,
        isSystemField: field.isSystemField,
        displayOrder: field.displayOrder,
        options: field.options,
        defaultValue: field.defaultValue,
        description: field.description,
      });

      groupedFields[category].fieldCount++;

      // Update stats
      fieldStats.categories.add(category);
      if (field.fieldSource === "custom") fieldStats.customFields++;
      else if (field.fieldSource === "default") fieldStats.defaultFields++;
      else if (field.fieldSource === "system") fieldStats.systemFields++;
    });

    // Convert categories Set to Array for response
    fieldStats.categories = Array.from(fieldStats.categories);

    // Sort categories to match Pipedrive order: Summary, Custom groups, Default fields, System fields
    const orderedCategories = {};
    const categoryOrder = ["Summary", "Default fields", "System fields"];

    // Add predefined categories first
    categoryOrder.forEach((catName) => {
      if (groupedFields[catName]) {
        orderedCategories[catName] = groupedFields[catName];
      }
    });

    // Add custom categories (not in predefined list)
    Object.keys(groupedFields).forEach((catName) => {
      if (!categoryOrder.includes(catName)) {
        orderedCategories[catName] = groupedFields[catName];
      }
    });

    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_MANAGEMENT,
      "DATA_FIELDS_FETCH",
      req.adminId,
      `Fetched ${fields.length} data fields for ${entityType}`,
      null
    );

    res.status(200).json({
      message: "Data fields retrieved successfully",
      entityType,
      fieldGroups: orderedCategories,
      statistics: fieldStats,
      userRole: req.role,
    });
  } catch (error) {
    console.error("Error fetching data fields:", error);
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_MANAGEMENT,
      "DATA_FIELDS_FETCH",
      req.adminId,
      `Error fetching data fields: ${error.message}`,
      null
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

// Create a new custom field
exports.createCustomField = async (req, res) => {
  const {  CustomField, CustomFieldValue, AuditTrail } = req.models;
  try {
    const {
      fieldName,
      fieldLabel,
      fieldType = "text",
      entityType = "lead",
      category = "Ungrouped custom fields",
      fieldGroup,
      isRequired = false,
      isImportant = false,
      options,
      defaultValue,
      description,
      displayOrder = 0,
    } = req.body;

    // Validation
    if (!fieldName || !fieldLabel) {
      return res.status(400).json({
        message: "fieldName and fieldLabel are required",
      });
    }

    // Check for duplicate field name for this entity and user
    const existingField = await CustomField.findOne({
      where: {
        fieldName,
        entityType,
        masterUserID: req.adminId,
        isActive: true,
      },
    });

    if (existingField) {
      return res.status(409).json({
        message: `A field with name "${fieldName}" already exists for ${entityType}`,
      });
    }

    const customField = await CustomField.create({
      fieldName,
      fieldLabel,
      fieldType,
      entityType,
      fieldSource: "custom",
      category,
      fieldGroup,
      isRequired,
      isImportant,
      options,
      defaultValue,
      description,
      displayOrder,
      masterUserID: req.adminId,
    });

    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_MANAGEMENT,
      "CUSTOM_FIELD_CREATE",
      req.adminId,
      `Created custom field: ${fieldLabel} for ${entityType}`,
      customField
    );

    res.status(201).json({
      message: "Custom field created successfully",
      field: customField,
    });
  } catch (error) {
    console.error("Error creating custom field:", error);
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_MANAGEMENT,
      "CUSTOM_FIELD_CREATE",
      req.adminId,
      `Error creating custom field: ${error.message}`,
      null
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update a custom field
exports.updateCustomField = async (req, res) => {
  const {  CustomField, CustomFieldValue, AuditTrail } = req.models;
  try {
    const { fieldId } = req.params;
    const updateData = req.body;

    const customField = await CustomField.findOne({
      where: {
        fieldId,
        masterUserID: req.adminId, // Only allow updating own fields
      },
    });

    if (!customField) {
      return res.status(404).json({ message: "Custom field not found" });
    }

    // Don't allow updating system or default fields
    if (customField.fieldSource !== "custom") {
      return res.status(403).json({
        message: "Cannot modify system or default fields",
      });
    }

    await customField.update(updateData);

    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_MANAGEMENT,
      "CUSTOM_FIELD_UPDATE",
      req.adminId,
      `Updated custom field: ${customField.fieldLabel}`,
      { from: customField._previousDataValues, to: updateData }
    );

    res.status(200).json({
      message: "Custom field updated successfully",
      field: customField,
    });
  } catch (error) {
    console.error("Error updating custom field:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a custom field
exports.deleteCustomField = async (req, res) => {
  const {  CustomField, CustomFieldValue, AuditTrail } = req.models;
  try {
    const { fieldId } = req.params;

    const customField = await CustomField.findOne({
      where: {
        fieldId,
        masterUserID: req.adminId, // Only allow deleting own fields
      },
    });

    if (!customField) {
      return res.status(404).json({ message: "Custom field not found" });
    }

    // Don't allow deleting system or default fields
    if (customField.fieldSource !== "custom") {
      return res.status(403).json({
        message: "Cannot delete system or default fields",
      });
    }

    // Soft delete by setting isActive to false
    await customField.update({ isActive: false });

    // Also delete all field values for this field
    await CustomFieldValue.destroy({
      where: { fieldId },
    });

    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_MANAGEMENT,
      "CUSTOM_FIELD_DELETE",
      req.adminId,
      `Deleted custom field: ${customField.fieldLabel}`,
      customField
    );

    res.status(200).json({
      message: "Custom field deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting custom field:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Reorder fields within a category
exports.reorderFields = async (req, res) => {
  const {  CustomField, CustomFieldValue, AuditTrail } = req.models;
  try {
    const { category, fieldOrders } = req.body; // fieldOrders: [{ fieldId, displayOrder }, ...]

    if (!category || !Array.isArray(fieldOrders)) {
      return res.status(400).json({
        message: "category and fieldOrders array are required",
      });
    }

    // Update display order for each field
    for (const { fieldId, displayOrder } of fieldOrders) {
      await CustomField.update(
        { displayOrder },
        {
          where: {
            fieldId,
            category,
            masterUserID: req.adminId, // Only allow reordering own fields
          },
        }
      );
    }

    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_MANAGEMENT,
      "FIELDS_REORDER",
      req.adminId,
      `Reordered ${fieldOrders.length} fields in category: ${category}`,
      fieldOrders
    );

    res.status(200).json({
      message: "Fields reordered successfully",
    });
  } catch (error) {
    console.error("Error reordering fields:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Organize fields - update categories, groups, and order
exports.organizeFields = async (req, res) => {
  const {  CustomField, CustomFieldValue, AuditTrail } = req.models;
  try {
    const { updates } = req.body; // Array of { fieldId, category, fieldGroup, displayOrder }

    if (!Array.isArray(updates)) {
      return res.status(400).json({
        message: "updates must be an array of field update objects",
      });
    }

    const updatedFields = [];

    for (const update of updates) {
      const { fieldId, ...updateData } = update;

      const field = await CustomField.findOne({
        where: {
          fieldId,
          masterUserID: req.adminId, // Only allow organizing own fields
        },
      });

      if (field && field.fieldSource === "custom") {
        await field.update(updateData);
        updatedFields.push(field);
      }
    }

    await logAuditTrail(
      AuditTrail,
      PROGRAMS.LEAD_MANAGEMENT,
      "FIELDS_ORGANIZE",
      req.adminId,
      `Organized ${updatedFields.length} fields`,
      updates
    );

    res.status(200).json({
      message: "Fields organized successfully",
      updatedCount: updatedFields.length,
    });
  } catch (error) {
    console.error("Error organizing fields:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get field usage statistics
exports.getFieldStatistics = async (req, res) => {
  const {  CustomField, CustomFieldValue, AuditTrail } = req.models;
  try {
    const { entityType = "lead" } = req.query;

    const stats = await CustomField.findAll({
      attributes: [
        "fieldSource",
        [
          CustomField.sequelize.fn(
            "COUNT",
            CustomField.sequelize.col("fieldId")
          ),
          "count",
        ],
      ],
      where: {
        entityType:
          entityType === "lead"
            ? { [Op.in]: ["lead", "both"] }
            : entityType === "deal"
            ? { [Op.in]: ["deal", "both"] }
            : entityType,
        isActive: true,
        masterUserID: req.adminId,
      },
      group: ["fieldSource"],
      raw: true,
    });

    const totalFieldValues = await CustomFieldValue.count({
      where: {
        entityType,
        masterUserID: req.adminId,
      },
    });

    res.status(200).json({
      message: "Field statistics retrieved successfully",
      entityType,
      fieldCounts: stats,
      totalFieldValues,
    });
  } catch (error) {
    console.error("Error fetching field statistics:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get field values for a specific entity
exports.getFieldValues = async (req, res) => {
  const {  CustomField, CustomFieldValue, AuditTrail } = req.models;
  try {
    const { entityType, entityId } = req.params;

    // Get all custom field values for this entity
    const fieldValues = await CustomFieldValue.findAll({
      where: {
        entityType,
        entityId,
      },
      include: [
        {
          model: CustomField,
          as: "CustomField",
          where: {
            isActive: true,
            [Op.or]: [
              { masterUserID: req.adminId },
              { fieldSource: ["default", "system"] },
            ],
          },
          required: true,
        },
      ],
      order: [["CustomField", "displayOrder", "ASC"]],
    });

    // Group by category for organized display
    const groupedValues = {};

    fieldValues.forEach((fieldValue) => {
      const field = fieldValue.CustomField;
      const category = field.category || "Ungrouped custom fields";

      if (!groupedValues[category]) {
        groupedValues[category] = {
          name: category,
          fields: [],
        };
      }

      groupedValues[category].fields.push({
        fieldId: field.fieldId,
        fieldName: field.fieldName,
        fieldLabel: field.fieldLabel,
        fieldType: field.fieldType,
        value: fieldValue.value,
        isRequired: field.isRequired,
        isImportant: field.isImportant,
        options: field.options,
      });
    });

    res.status(200).json({
      message: "Field values retrieved successfully",
      entityType,
      entityId,
      fieldGroups: groupedValues,
    });
  } catch (error) {
    console.error("Error fetching field values:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
