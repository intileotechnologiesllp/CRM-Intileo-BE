const CustomField = require("../models/customFieldModel");
const CustomFieldValue = require("../models/customFieldValueModel");
const { Op } = require("sequelize");
const sequelize = require("../config/db");
const { logAuditTrail } = require("../utils/auditTrailLogger");
const PROGRAMS = require("../utils/programConstants");
const historyLogger = require("../utils/historyLogger").logHistory;

// Create a new custom field
exports.createCustomField = async (req, res) => {
  const {
    fieldName,
    fieldLabel,
    fieldType,
    entityType,
    fieldSource,
    options,
    validationRules,
    defaultValue,
    isRequired,
    isImportant,
    category,
    fieldGroup,
    description,
    displayOrder,
  } = req.body;

  const masterUserID = req.adminId;

  try {
    // Validate required fields
    if (!fieldName || !fieldLabel || !fieldType || !entityType) {
      return res.status(400).json({
        message:
          "fieldName, fieldLabel, fieldType, and entityType are required.",
      });
    }

    // Check if field name already exists for this entity type and user
    const existingField = await CustomField.findOne({
      where: {
        fieldName: fieldName.toLowerCase().replace(/\s+/g, "_"),
        entityType,
        masterUserID,
      },
    });

    if (existingField) {
      return res.status(409).json({
        message: `A custom field with name "${fieldName}" already exists for ${entityType}.`,
      });
    }

    // Validate field type specific requirements
    if (["select", "multiselect", "radio"].includes(fieldType) && !options) {
      return res.status(400).json({
        message: `Options are required for ${fieldType} field type.`,
      });
    }

    // Create the custom field
    const customField = await CustomField.create({
      fieldName: fieldName.toLowerCase().replace(/\s+/g, "_"),
      fieldLabel,
      fieldType,
      entityType,
      fieldSource: fieldSource || "custom",
      options: options || null,
      validationRules: validationRules || null,
      defaultValue: defaultValue || null,
      isRequired: isRequired || false,
      isImportant: isImportant || false,
      category: category || "Details",
      fieldGroup: fieldGroup || null,
      description: description || null,
      displayOrder: displayOrder || 0,
      masterUserID,
    });

    await historyLogger(
      PROGRAMS.LEAD_MANAGEMENT,
      "CUSTOM_FIELD_CREATION",
      masterUserID,
      customField.fieldId,
      null,
      `Custom field "${fieldLabel}" created for ${entityType}`,
      null
    );

    res.status(201).json({
      message: "Custom field created successfully.",
      customField,
    });
  } catch (error) {
    console.error("Error creating custom field:", error);
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "CUSTOM_FIELD_CREATION",
      null,
      "Error creating custom field: " + error.message,
      null
    );
    res.status(500).json({
      message: "Failed to create custom field.",
      error: error.message,
    });
  }
};

// Get all custom fields for an entity type
exports.getCustomFields = async (req, res) => {
  const { entityType, includeInactive } = req.query;
  const masterUserID = req.adminId;

  try {
    let whereClause = { masterUserID };

    if (entityType) {
      whereClause.entityType = entityType;
    }

    if (includeInactive !== "true") {
      whereClause.isActive = true;
    }

    const customFields = await CustomField.findAll({
      where: whereClause,
      order: [
        ["category", "ASC"],
        ["fieldGroup", "ASC"],
        ["displayOrder", "ASC"],
        ["fieldLabel", "ASC"],
      ],
    });

    // Organize fields into Pipedrive-style sections
    const organizedFields = {
      summary: [],
      ungroupedCustomFields: [],
      defaultFields: [],
      systemFields: [],
      customGroups: {},
    };

    const fieldCounts = {
      summary: 0,
      ungroupedCustomFields: 0,
      defaultFields: 0,
      systemFields: 0,
    };

    customFields.forEach((field) => {
      const fieldObj = field.toJSON();

      if (field.isImportant && field.category === "Summary") {
        // Summary - Important fields marked for quick access
        organizedFields.summary.push(fieldObj);
        fieldCounts.summary++;
      } else if (
        field.fieldSource === "custom" &&
        (!field.fieldGroup || field.fieldGroup === "Default")
      ) {
        // Ungrouped Custom Fields - Custom fields without specific groups
        organizedFields.ungroupedCustomFields.push(fieldObj);
        fieldCounts.ungroupedCustomFields++;
      } else if (field.fieldSource === "default") {
        // Default Fields - Built-in CRM fields
        organizedFields.defaultFields.push(fieldObj);
        fieldCounts.defaultFields++;
      } else if (field.fieldSource === "system") {
        // System Fields - Read-only system fields
        organizedFields.systemFields.push(fieldObj);
        fieldCounts.systemFields++;
      } else if (
        field.fieldSource === "custom" &&
        field.fieldGroup &&
        field.fieldGroup !== "Default"
      ) {
        // Custom Groups - User-defined field groups
        if (!organizedFields.customGroups[field.fieldGroup]) {
          organizedFields.customGroups[field.fieldGroup] = [];
        }
        organizedFields.customGroups[field.fieldGroup].push(fieldObj);
      } else {
        // Fallback to ungrouped custom fields
        organizedFields.ungroupedCustomFields.push(fieldObj);
        fieldCounts.ungroupedCustomFields++;
      }
    });

    res.status(200).json({
      message: "Custom fields retrieved successfully.",
      fields: customFields,
      organizedFields,
      fieldCounts,
      // Legacy support for existing code
      groupedFields: customFields.reduce((acc, field) => {
        const category = field.category || "Details";
        const fieldGroup = field.fieldGroup || "Default";

        if (!acc[category]) {
          acc[category] = {};
        }
        if (!acc[category][fieldGroup]) {
          acc[category][fieldGroup] = [];
        }
        acc[category][fieldGroup].push(field);
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error("Error fetching custom fields:", error);
    res.status(500).json({
      message: "Failed to fetch custom fields.",
      error: error.message,
    });
  }
};

// Update a custom field
exports.updateCustomField = async (req, res) => {
  const { fieldId } = req.params;
  const {
    fieldLabel,
    fieldType,
    fieldSource,
    options,
    validationRules,
    defaultValue,
    isRequired,
    isImportant,
    category,
    fieldGroup,
    description,
    displayOrder,
    isActive,
  } = req.body;

  const masterUserID = req.adminId;

  try {
    const customField = await CustomField.findOne({
      where: { fieldId, masterUserID },
    });

    if (!customField) {
      return res.status(404).json({
        message: "Custom field not found.",
      });
    }

    // Store old values for history
    const oldValues = { ...customField.toJSON() };

    // Update the field
    await customField.update({
      fieldLabel: fieldLabel || customField.fieldLabel,
      fieldType: fieldType || customField.fieldType,
      fieldSource: fieldSource || customField.fieldSource,
      options: options !== undefined ? options : customField.options,
      validationRules:
        validationRules !== undefined
          ? validationRules
          : customField.validationRules,
      defaultValue:
        defaultValue !== undefined ? defaultValue : customField.defaultValue,
      isRequired:
        isRequired !== undefined ? isRequired : customField.isRequired,
      isImportant:
        isImportant !== undefined ? isImportant : customField.isImportant,
      category: category || customField.category,
      fieldGroup:
        fieldGroup !== undefined ? fieldGroup : customField.fieldGroup,
      description:
        description !== undefined ? description : customField.description,
      displayOrder:
        displayOrder !== undefined ? displayOrder : customField.displayOrder,
      isActive: isActive !== undefined ? isActive : customField.isActive,
    });

    await historyLogger(
      PROGRAMS.LEAD_MANAGEMENT,
      "CUSTOM_FIELD_UPDATE",
      masterUserID,
      customField.fieldId,
      null,
      `Custom field "${customField.fieldLabel}" updated`,
      { old: oldValues, new: customField.toJSON() }
    );

    res.status(200).json({
      message: "Custom field updated successfully.",
      customField,
    });
  } catch (error) {
    console.error("Error updating custom field:", error);
    res.status(500).json({
      message: "Failed to update custom field.",
      error: error.message,
    });
  }
};

// Delete a custom field
exports.deleteCustomField = async (req, res) => {
  const { fieldId } = req.params;
  const masterUserID = req.adminId;

  try {
    const customField = await CustomField.findOne({
      where: { fieldId, masterUserID },
    });

    if (!customField) {
      return res.status(404).json({
        message: "Custom field not found.",
      });
    }

    // Delete all associated values first
    await CustomFieldValue.destroy({
      where: { fieldId, masterUserID },
    });

    // Delete the custom field
    await customField.destroy();

    await historyLogger(
      PROGRAMS.LEAD_MANAGEMENT,
      "CUSTOM_FIELD_DELETION",
      masterUserID,
      fieldId,
      null,
      `Custom field "${customField.fieldLabel}" deleted`,
      null
    );

    res.status(200).json({
      message: "Custom field deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting custom field:", error);
    res.status(500).json({
      message: "Failed to delete custom field.",
      error: error.message,
    });
  }
};

// Save custom field values for an entity
exports.saveCustomFieldValues = async (req, res) => {
  const { entityId, entityType, fieldValues } = req.body;
  const masterUserID = req.adminId;

  try {
    if (!entityId || !entityType || !fieldValues) {
      return res.status(400).json({
        message: "entityId, entityType, and fieldValues are required.",
      });
    }

    const savedValues = [];

    for (const [fieldKey, value] of Object.entries(fieldValues)) {
      let customField;

      // Check if it's a fieldId (numeric) or fieldName (string)
      if (isNaN(fieldKey)) {
        // It's a fieldName - search by fieldName
        customField = await CustomField.findOne({
          where: { fieldName: fieldKey, masterUserID, entityType },
        });
      } else {
        // It's a fieldId - search by fieldId
        customField = await CustomField.findOne({
          where: { fieldId: fieldKey, masterUserID, entityType },
        });
      }

      if (!customField) {
        continue; // Skip invalid fields
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
          return res.status(400).json({
            message: `Invalid number value for field "${customField.fieldLabel}".`,
          });
        }
      }

      // Check if value already exists
      let fieldValue = await CustomFieldValue.findOne({
        where: {
          fieldId: customField.fieldId,
          entityId,
          entityType,
          masterUserID,
        },
      });

      if (fieldValue) {
        // Update existing value
        await fieldValue.update({ value: processedValue });
      } else {
        // Create new value
        fieldValue = await CustomFieldValue.create({
          fieldId: customField.fieldId,
          entityId,
          entityType,
          value: processedValue,
          masterUserID,
        });
      }

      savedValues.push(fieldValue);
    }

    res.status(200).json({
      message: "Custom field values saved successfully.",
      savedValues,
    });
  } catch (error) {
    console.error("Error saving custom field values:", error);
    res.status(500).json({
      message: "Failed to save custom field values.",
      error: error.message,
    });
  }
};

// Get custom field values for an entity
exports.getCustomFieldValues = async (req, res) => {
  const { entityId, entityType } = req.params;
  const masterUserID = req.adminId;

  try {
    const customFieldValues = await CustomFieldValue.findAll({
      where: { entityId, entityType, masterUserID },
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
      message: "Custom field values retrieved successfully.",
      values: formattedValues,
      fieldsByCategory,
      fieldsByGroup,
    });
  } catch (error) {
    console.error("Error fetching custom field values:", error);
    res.status(500).json({
      message: "Failed to fetch custom field values.",
      error: error.message,
    });
  }
};

// Bulk update display order
exports.updateFieldDisplayOrder = async (req, res) => {
  const { fieldOrders } = req.body; // Array of { fieldId, displayOrder }
  const masterUserID = req.adminId;

  try {
    for (const { fieldId, displayOrder } of fieldOrders) {
      await CustomField.update(
        { displayOrder },
        { where: { fieldId, masterUserID } }
      );
    }

    res.status(200).json({
      message: "Field display order updated successfully.",
    });
  } catch (error) {
    console.error("Error updating field display order:", error);
    res.status(500).json({
      message: "Failed to update field display order.",
      error: error.message,
    });
  }
};

// Update custom field values for an entity
exports.updateCustomFieldValues = async (req, res) => {
  const { entityId, entityType } = req.params;
  const { fieldValues } = req.body;
  const masterUserID = req.adminId;

  try {
    if (!fieldValues || Object.keys(fieldValues).length === 0) {
      return res.status(400).json({
        message: "fieldValues is required.",
      });
    }

    const updatedValues = [];

    for (const [fieldKey, value] of Object.entries(fieldValues)) {
      let customField;

      // Check if it's a fieldId (numeric) or fieldName (string)
      if (isNaN(fieldKey)) {
        // It's a fieldName - search by fieldName
        customField = await CustomField.findOne({
          where: { fieldName: fieldKey, masterUserID, entityType },
        });
      } else {
        // It's a fieldId - search by fieldId
        customField = await CustomField.findOne({
          where: { fieldId: fieldKey, masterUserID, entityType },
        });
      }

      if (!customField) {
        continue; // Skip invalid fields
      }

      // Find or create the field value
      let fieldValue = await CustomFieldValue.findOne({
        where: {
          fieldId: customField.fieldId,
          entityId,
          entityType,
          masterUserID,
        },
      });

      if (fieldValue) {
        // Update existing value
        await fieldValue.update({ value: value });
      } else {
        // Create new value
        fieldValue = await CustomFieldValue.create({
          fieldId: customField.fieldId,
          entityId,
          entityType,
          value: value,
          masterUserID,
        });
      }

      updatedValues.push(fieldValue);
    }

    res.status(200).json({
      message: "Custom field values updated successfully.",
      updatedValues,
    });
  } catch (error) {
    console.error("Error updating custom field values:", error);
    res.status(500).json({
      message: "Failed to update custom field values.",
      error: error.message,
    });
  }
};

// Delete a custom field value
exports.deleteCustomFieldValue = async (req, res) => {
  const { valueId } = req.params;
  const masterUserID = req.adminId;

  try {
    const fieldValue = await CustomFieldValue.findOne({
      where: { valueId, masterUserID },
    });

    if (!fieldValue) {
      return res.status(404).json({
        message: "Custom field value not found.",
      });
    }

    await fieldValue.destroy();

    res.status(200).json({
      message: "Custom field value deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting custom field value:", error);
    res.status(500).json({
      message: "Failed to delete custom field value.",
      error: error.message,
    });
  }
};

// Update field order
exports.updateFieldOrder = async (req, res) => {
  const { fieldId } = req.params;
  const { displayOrder } = req.body;
  const masterUserID = req.adminId;

  try {
    const customField = await CustomField.findOne({
      where: { fieldId, masterUserID },
    });

    if (!customField) {
      return res.status(404).json({
        message: "Custom field not found.",
      });
    }

    await customField.update({ displayOrder });

    res.status(200).json({
      message: "Field order updated successfully.",
      customField,
    });
  } catch (error) {
    console.error("Error updating field order:", error);
    res.status(500).json({
      message: "Failed to update field order.",
      error: error.message,
    });
  }
};

// Update field category
exports.updateFieldCategory = async (req, res) => {
  const { fieldId } = req.params;
  const { category } = req.body;
  const masterUserID = req.adminId;

  try {
    const customField = await CustomField.findOne({
      where: { fieldId, masterUserID },
    });

    if (!customField) {
      return res.status(404).json({
        message: "Custom field not found.",
      });
    }

    await customField.update({ category });

    res.status(200).json({
      message: "Field category updated successfully.",
      customField,
    });
  } catch (error) {
    console.error("Error updating field category:", error);
    res.status(500).json({
      message: "Failed to update field category.",
      error: error.message,
    });
  }
};

// Update field group
exports.updateFieldGroup = async (req, res) => {
  const { fieldId } = req.params;
  const { fieldGroup } = req.body;
  const masterUserID = req.adminId;

  try {
    const customField = await CustomField.findOne({
      where: { fieldId, masterUserID },
    });

    if (!customField) {
      return res.status(404).json({
        message: "Custom field not found.",
      });
    }

    await customField.update({ fieldGroup });

    res.status(200).json({
      message: "Field group updated successfully.",
      customField,
    });
  } catch (error) {
    console.error("Error updating field group:", error);
    res.status(500).json({
      message: "Failed to update field group.",
      error: error.message,
    });
  }
};

// Get all custom fields for a specific entity type with statistics
exports.getCustomFieldsWithStats = async (req, res) => {
  const { entityType } = req.params;
  const masterUserID = req.adminId;

  try {
    const customFields = await CustomField.findAll({
      where: { entityType, masterUserID },
      include: [
        {
          model: CustomFieldValue,
          as: "values",
          required: false,
          attributes: ["entityId", "value"],
        },
      ],
      order: [
        ["category", "ASC"],
        ["fieldGroup", "ASC"],
        ["displayOrder", "ASC"],
        ["fieldLabel", "ASC"],
      ],
    });

    // Calculate statistics for each field
    const fieldsWithStats = customFields.map((field) => {
      const fieldObj = field.toJSON();
      const values = fieldObj.values || [];

      fieldObj.statistics = {
        totalValues: values.length,
        filledValues: values.filter((v) => v.value !== null && v.value !== "")
          .length,
        emptyValues: values.filter((v) => v.value === null || v.value === "")
          .length,
        usage:
          values.length > 0
            ? Math.round(
                (values.filter((v) => v.value !== null && v.value !== "")
                  .length /
                  values.length) *
                  100
              )
            : 0,
      };

      delete fieldObj.values; // Remove values from response
      return fieldObj;
    });

    res.status(200).json({
      message: "Custom fields with statistics retrieved successfully.",
      fields: fieldsWithStats,
    });
  } catch (error) {
    console.error("Error fetching custom fields with stats:", error);
    res.status(500).json({
      message: "Failed to fetch custom fields with statistics.",
      error: error.message,
    });
  }
};

// Get all available field groups for an entity type
exports.getFieldGroups = async (req, res) => {
  const { entityType } = req.params;
  const masterUserID = req.adminId;

  try {
    const fieldGroups = await CustomField.findAll({
      where: { entityType, masterUserID, isActive: true },
      attributes: ["fieldGroup"],
      group: ["fieldGroup"],
      having: sequelize.where(sequelize.col("fieldGroup"), "IS NOT", null),
    });

    const groups = fieldGroups.map((field) => field.fieldGroup).filter(Boolean);

    res.status(200).json({
      message: "Field groups retrieved successfully.",
      groups,
    });
  } catch (error) {
    console.error("Error fetching field groups:", error);
    res.status(500).json({
      message: "Failed to fetch field groups.",
      error: error.message,
    });
  }
};

// Get default fields for an entity type (built-in CRM fields)
exports.getDefaultFields = async (req, res) => {
  const { entityType } = req.params;

  try {
    // Define default fields for each entity type
    const defaultFieldsConfig = {
      lead: [
        {
          fieldName: "title",
          fieldLabel: "Title",
          fieldType: "text",
          isRequired: true,
        },
        {
          fieldName: "value",
          fieldLabel: "Value",
          fieldType: "currency",
          isRequired: false,
        },
        {
          fieldName: "probability",
          fieldLabel: "Probability",
          fieldType: "number",
          isRequired: false,
        },
        {
          fieldName: "expected_close_date",
          fieldLabel: "Expected close date",
          fieldType: "date",
          isRequired: false,
        },
        {
          fieldName: "stage",
          fieldLabel: "Stage",
          fieldType: "select",
          isRequired: true,
        },
        {
          fieldName: "owner",
          fieldLabel: "Owner",
          fieldType: "select",
          isRequired: true,
        },
        {
          fieldName: "organization",
          fieldLabel: "Organization",
          fieldType: "organization",
          isRequired: false,
        },
        {
          fieldName: "contact_person",
          fieldLabel: "Contact person",
          fieldType: "person",
          isRequired: false,
        },
        {
          fieldName: "label",
          fieldLabel: "Label",
          fieldType: "multiselect",
          isRequired: false,
        },
        {
          fieldName: "status",
          fieldLabel: "Status",
          fieldType: "select",
          isRequired: true,
        },
      ],
      deal: [
        {
          fieldName: "title",
          fieldLabel: "Title",
          fieldType: "text",
          isRequired: true,
        },
        {
          fieldName: "value",
          fieldLabel: "Value",
          fieldType: "currency",
          isRequired: false,
        },
        {
          fieldName: "probability",
          fieldLabel: "Probability",
          fieldType: "number",
          isRequired: false,
        },
        {
          fieldName: "expected_close_date",
          fieldLabel: "Expected close date",
          fieldType: "date",
          isRequired: false,
        },
        {
          fieldName: "stage",
          fieldLabel: "Stage",
          fieldType: "select",
          isRequired: true,
        },
        {
          fieldName: "owner",
          fieldLabel: "Owner",
          fieldType: "select",
          isRequired: true,
        },
        {
          fieldName: "organization",
          fieldLabel: "Organization",
          fieldType: "organization",
          isRequired: false,
        },
        {
          fieldName: "contact_person",
          fieldLabel: "Contact person",
          fieldType: "person",
          isRequired: false,
        },
        {
          fieldName: "label",
          fieldLabel: "Label",
          fieldType: "multiselect",
          isRequired: false,
        },
        {
          fieldName: "status",
          fieldLabel: "Status",
          fieldType: "select",
          isRequired: true,
        },
      ],
      person: [
        {
          fieldName: "name",
          fieldLabel: "Name",
          fieldType: "text",
          isRequired: true,
        },
        {
          fieldName: "email",
          fieldLabel: "Email",
          fieldType: "email",
          isRequired: false,
        },
        {
          fieldName: "phone",
          fieldLabel: "Phone",
          fieldType: "phone",
          isRequired: false,
        },
        {
          fieldName: "organization",
          fieldLabel: "Organization",
          fieldType: "organization",
          isRequired: false,
        },
        {
          fieldName: "owner",
          fieldLabel: "Owner",
          fieldType: "select",
          isRequired: true,
        },
        {
          fieldName: "label",
          fieldLabel: "Label",
          fieldType: "multiselect",
          isRequired: false,
        },
      ],
      organization: [
        {
          fieldName: "name",
          fieldLabel: "Name",
          fieldType: "text",
          isRequired: true,
        },
        {
          fieldName: "address",
          fieldLabel: "Address",
          fieldType: "textarea",
          isRequired: false,
        },
        {
          fieldName: "owner",
          fieldLabel: "Owner",
          fieldType: "select",
          isRequired: true,
        },
        {
          fieldName: "label",
          fieldLabel: "Label",
          fieldType: "multiselect",
          isRequired: false,
        },
      ],
    };

    const defaultFields = defaultFieldsConfig[entityType] || [];

    res.status(200).json({
      message: "Default fields retrieved successfully.",
      fields: defaultFields,
      count: defaultFields.length,
    });
  } catch (error) {
    console.error("Error fetching default fields:", error);
    res.status(500).json({
      message: "Failed to fetch default fields.",
      error: error.message,
    });
  }
};

// Get system fields for an entity type (read-only system fields)
exports.getSystemFields = async (req, res) => {
  const { entityType } = req.params;

  try {
    // Define system fields for each entity type
    const systemFieldsConfig = {
      lead: [
        {
          fieldName: "id",
          fieldLabel: "ID",
          fieldType: "number",
          isReadOnly: true,
        },
        {
          fieldName: "created_at",
          fieldLabel: "Created",
          fieldType: "datetime",
          isReadOnly: true,
        },
        {
          fieldName: "updated_at",
          fieldLabel: "Last modified",
          fieldType: "datetime",
          isReadOnly: true,
        },
        {
          fieldName: "won_time",
          fieldLabel: "Won time",
          fieldType: "datetime",
          isReadOnly: true,
        },
        {
          fieldName: "lost_time",
          fieldLabel: "Lost time",
          fieldType: "datetime",
          isReadOnly: true,
        },
        {
          fieldName: "lost_reason",
          fieldLabel: "Lost reason",
          fieldType: "text",
          isReadOnly: true,
        },
        {
          fieldName: "activities_count",
          fieldLabel: "Activities",
          fieldType: "number",
          isReadOnly: true,
        },
        {
          fieldName: "notes_count",
          fieldLabel: "Notes",
          fieldType: "number",
          isReadOnly: true,
        },
        {
          fieldName: "followers_count",
          fieldLabel: "Followers",
          fieldType: "number",
          isReadOnly: true,
        },
      ],
      deal: [
        {
          fieldName: "id",
          fieldLabel: "ID",
          fieldType: "number",
          isReadOnly: true,
        },
        {
          fieldName: "created_at",
          fieldLabel: "Created",
          fieldType: "datetime",
          isReadOnly: true,
        },
        {
          fieldName: "updated_at",
          fieldLabel: "Last modified",
          fieldType: "datetime",
          isReadOnly: true,
        },
        {
          fieldName: "won_time",
          fieldLabel: "Won time",
          fieldType: "datetime",
          isReadOnly: true,
        },
        {
          fieldName: "lost_time",
          fieldLabel: "Lost time",
          fieldType: "datetime",
          isReadOnly: true,
        },
        {
          fieldName: "lost_reason",
          fieldLabel: "Lost reason",
          fieldType: "text",
          isReadOnly: true,
        },
        {
          fieldName: "activities_count",
          fieldLabel: "Activities",
          fieldType: "number",
          isReadOnly: true,
        },
        {
          fieldName: "notes_count",
          fieldLabel: "Notes",
          fieldType: "number",
          isReadOnly: true,
        },
        {
          fieldName: "followers_count",
          fieldLabel: "Followers",
          fieldType: "number",
          isReadOnly: true,
        },
      ],
      person: [
        {
          fieldName: "id",
          fieldLabel: "ID",
          fieldType: "number",
          isReadOnly: true,
        },
        {
          fieldName: "created_at",
          fieldLabel: "Created",
          fieldType: "datetime",
          isReadOnly: true,
        },
        {
          fieldName: "updated_at",
          fieldLabel: "Last modified",
          fieldType: "datetime",
          isReadOnly: true,
        },
        {
          fieldName: "last_activity_date",
          fieldLabel: "Last activity date",
          fieldType: "datetime",
          isReadOnly: true,
        },
        {
          fieldName: "activities_count",
          fieldLabel: "Activities",
          fieldType: "number",
          isReadOnly: true,
        },
        {
          fieldName: "notes_count",
          fieldLabel: "Notes",
          fieldType: "number",
          isReadOnly: true,
        },
      ],
      organization: [
        {
          fieldName: "id",
          fieldLabel: "ID",
          fieldType: "number",
          isReadOnly: true,
        },
        {
          fieldName: "created_at",
          fieldLabel: "Created",
          fieldType: "datetime",
          isReadOnly: true,
        },
        {
          fieldName: "updated_at",
          fieldLabel: "Last modified",
          fieldType: "datetime",
          isReadOnly: true,
        },
        {
          fieldName: "people_count",
          fieldLabel: "People",
          fieldType: "number",
          isReadOnly: true,
        },
        {
          fieldName: "activities_count",
          fieldLabel: "Activities",
          fieldType: "number",
          isReadOnly: true,
        },
        {
          fieldName: "notes_count",
          fieldLabel: "Notes",
          fieldType: "number",
          isReadOnly: true,
        },
      ],
    };

    const systemFields = systemFieldsConfig[entityType] || [];

    res.status(200).json({
      message: "System fields retrieved successfully.",
      fields: systemFields,
      count: systemFields.length,
    });
  } catch (error) {
    console.error("Error fetching system fields:", error);
    res.status(500).json({
      message: "Failed to fetch system fields.",
      error: error.message,
    });
  }
};

// Add field to summary section
exports.addFieldToSummary = async (req, res) => {
  const { fieldId } = req.params;
  const masterUserID = req.adminId;

  try {
    const customField = await CustomField.findOne({
      where: { fieldId, masterUserID },
    });

    if (!customField) {
      return res.status(404).json({
        message: "Custom field not found.",
      });
    }

    await customField.update({
      isImportant: true,
      category: "Summary",
    });

    res.status(200).json({
      message: "Field added to summary successfully.",
      customField,
    });
  } catch (error) {
    console.error("Error adding field to summary:", error);
    res.status(500).json({
      message: "Failed to add field to summary.",
      error: error.message,
    });
  }
};

// Remove field from summary section
exports.removeFieldFromSummary = async (req, res) => {
  const { fieldId } = req.params;
  const masterUserID = req.adminId;

  try {
    const customField = await CustomField.findOne({
      where: { fieldId, masterUserID },
    });

    if (!customField) {
      return res.status(404).json({
        message: "Custom field not found.",
      });
    }

    await customField.update({
      isImportant: false,
      category: customField.fieldGroup ? customField.fieldGroup : "Details",
    });

    res.status(200).json({
      message: "Field removed from summary successfully.",
      customField,
    });
  } catch (error) {
    console.error("Error removing field from summary:", error);
    res.status(500).json({
      message: "Failed to remove field from summary.",
      error: error.message,
    });
  }
};

// Create entity with only custom fields (pure custom approach)
exports.createEntityWithCustomFields = async (req, res) => {
  const { entityType, customFields } = req.body;
  const masterUserID = req.adminId;

  try {
    if (!entityType || !customFields) {
      return res.status(400).json({
        message: "entityType and customFields are required.",
      });
    }

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Create a temporary entity ID (in a real scenario, this would be your actual entity creation)
      // For now, we'll generate a UUID-like ID
      const entityId = `${entityType}_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

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
            entityId,
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

      // Log the creation
      await historyLogger(
        PROGRAMS.LEAD_MANAGEMENT,
        `${entityType.toUpperCase()}_CREATION`,
        masterUserID,
        entityId,
        null,
        `${entityType} created with custom fields only`,
        { customFields: savedValues }
      );

      res.status(201).json({
        message: `${entityType} created successfully with custom fields.`,
        entityId,
        entityType,
        customFields: savedValues,
        totalFields: savedValues.length,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error creating entity with custom fields:", error);
    res.status(500).json({
      message: "Failed to create entity with custom fields.",
      error: error.message,
    });
  }
};

// Create person with only custom fields
exports.createPersonWithCustomFields = async (req, res) => {
  const { customFields } = req.body;
  const masterUserID = req.adminId;
  const entityType = "person";

  try {
    if (!customFields) {
      return res.status(400).json({
        message: "customFields are required.",
      });
    }

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Create a temporary entity ID (in a real scenario, this would be your actual entity creation)
      const entityId = `${entityType}_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

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
            entityId,
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

      // Log the creation
      await historyLogger(
        PROGRAMS.LEAD_MANAGEMENT,
        "PERSON_CREATION",
        masterUserID,
        entityId,
        null,
        `Person created with custom fields only`,
        { customFields: savedValues }
      );

      res.status(201).json({
        message: "Person created successfully with custom fields.",
        entityId,
        entityType,
        customFields: savedValues,
        totalFields: savedValues.length,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error creating person with custom fields:", error);
    res.status(500).json({
      message: "Failed to create person with custom fields.",
      error: error.message,
    });
  }
};

// Create organization with only custom fields
exports.createOrganizationWithCustomFields = async (req, res) => {
  const { customFields } = req.body;
  const masterUserID = req.adminId;
  const entityType = "organization";

  try {
    if (!customFields) {
      return res.status(400).json({
        message: "customFields are required.",
      });
    }

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Create a temporary entity ID (in a real scenario, this would be your actual entity creation)
      const entityId = `${entityType}_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

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
            entityId,
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

      // Log the creation
      await historyLogger(
        PROGRAMS.LEAD_MANAGEMENT,
        "ORGANIZATION_CREATION",
        masterUserID,
        entityId,
        null,
        `Organization created with custom fields only`,
        { customFields: savedValues }
      );

      res.status(201).json({
        message: "Organization created successfully with custom fields.",
        entityId,
        entityType,
        customFields: savedValues,
        totalFields: savedValues.length,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error creating organization with custom fields:", error);
    res.status(500).json({
      message: "Failed to create organization with custom fields.",
      error: error.message,
    });
  }
};

// Get person with custom fields
exports.getPersonWithCustomFields = async (req, res) => {
  const { entityId } = req.params;
  const masterUserID = req.adminId;
  const entityType = "person";

  try {
    const customFieldValues = await CustomFieldValue.findAll({
      where: { entityId, entityType, masterUserID },
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
      message: "Person custom field values retrieved successfully.",
      entityId,
      entityType,
      values: formattedValues,
      fieldsByCategory,
      fieldsByGroup,
    });
  } catch (error) {
    console.error("Error fetching person custom field values:", error);
    res.status(500).json({
      message: "Failed to fetch person custom field values.",
      error: error.message,
    });
  }
};

// Get organization with custom fields
exports.getOrganizationWithCustomFields = async (req, res) => {
  const { entityId } = req.params;
  const masterUserID = req.adminId;
  const entityType = "organization";

  try {
    const customFieldValues = await CustomFieldValue.findAll({
      where: { entityId, entityType, masterUserID },
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
      message: "Organization custom field values retrieved successfully.",
      entityId,
      entityType,
      values: formattedValues,
      fieldsByCategory,
      fieldsByGroup,
    });
  } catch (error) {
    console.error("Error fetching organization custom field values:", error);
    res.status(500).json({
      message: "Failed to fetch organization custom field values.",
      error: error.message,
    });
  }
};
