const CustomField = require("../models/customFieldModel");
const CustomFieldValue = require("../models/customFieldValueModel");
const { Op } = require("sequelize");
const sequelize = require("../config/db");
const { logAuditTrail } = require("../utils/auditTrailLogger");
const PROGRAMS = require("../utils/programConstants");
const historyLogger = require("../utils/historyLogger").logHistory;

// Utility function to validate field types and entity types
const validateFieldAndEntityTypes = (fieldType, entityType) => {
  const allowedFieldTypes = [
    "text",
    "textarea",
    "number",
    "decimal",
    "email",
    "phone",
    "url",
    "date",
    "datetime",
    "select",
    "multiselect",
    "checkbox",
    "radio",
    "file",
    "currency",
    "organization",
    "person",
  ];

  const allowedEntityTypes = [
    "lead",
    "deal",
    "both",
    "person",
    "organization",
    "activity",
  ];

  const errors = [];

  if (fieldType && !allowedFieldTypes.includes(fieldType)) {
    errors.push(
      `Invalid fieldType "${fieldType}". Allowed values are: ${allowedFieldTypes.join(
        ", "
      )}.`
    );
  }

  if (entityType && !allowedEntityTypes.includes(entityType)) {
    errors.push(
      `Invalid entityType "${entityType}". Allowed values are: ${allowedEntityTypes.join(
        ", "
      )}.`
    );
  }

  return errors;
};

// Create a new custom field
exports.createCustomField = async (req, res) => {
  const {
    fieldName,
    fieldLabel,
    fieldType,
    entityType,
    options,
    validationRules,
    defaultValue,
    isRequired,
    isImportant,
    category,
    fieldGroup,
    description,
    displayOrder,
    // Additional UI form fields
    userSpecifications,
    editingPermissions,
    placesWhereShown,
    pipelineRestrictions,
    showInAddView,
    showInDetailView,
    showInListView,
    qualityRules,
  } = req.body;

  const masterUserID = req.adminId;

  try {
    // Debug: Log the incoming request data
    console.log(
      "CreateCustomField - Request body:",
      JSON.stringify(req.body, null, 2)
    );
    console.log("CreateCustomField - fieldType:", fieldType);
    console.log("CreateCustomField - entityType:", entityType);

    // Validate required fields (fieldLabel is now optional)
    if (!fieldName || !fieldType || !entityType) {
      return res.status(400).json({
        message: "fieldName, fieldType, and entityType are required.",
      });
    }

    // Validate fieldType and entityType against allowed values
    const validationErrors = validateFieldAndEntityTypes(fieldType, entityType);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: validationErrors.join(" "),
      });
    }

    // Validate field lengths to prevent truncation
    if (fieldName && fieldName.length > 100) {
      return res.status(400).json({
        message: "fieldName cannot exceed 100 characters.",
      });
    }

    if (fieldLabel && fieldLabel.length > 150) {
      return res.status(400).json({
        message: "fieldLabel cannot exceed 150 characters.",
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

    // Validate user specifications
    if (
      userSpecifications &&
      userSpecifications.editingUsers === "specific" &&
      (!userSpecifications.editingUsersList ||
        userSpecifications.editingUsersList.length === 0)
    ) {
      return res.status(400).json({
        message:
          "editingUsersList is required when editingUsers is set to 'specific'.",
      });
    }

    // Validate pipeline restrictions
    if (
      pipelineRestrictions &&
      Array.isArray(pipelineRestrictions) &&
      pipelineRestrictions.length === 0
    ) {
      return res.status(400).json({
        message:
          "At least one pipeline must be selected when using pipeline restrictions.",
      });
    }

    // Process user specifications and permissions
    const processedUserSpecs = userSpecifications || {
      editingUsers: "all", // "all", "specific", "owner_only"
      editingUsersList: [], // Array of user IDs if "specific"
      viewingUsers: "all", // "all", "specific", "owner_only"
      viewingUsersList: [], // Array of user IDs if "specific"
    };

    // Process places where shown
    const processedPlacesShown = placesWhereShown || {
      leadView: showInAddView !== undefined ? showInAddView : true,
      dealView: showInDetailView !== undefined ? showInDetailView : true,
      listView: showInListView !== undefined ? showInListView : false,
      pipelines: pipelineRestrictions || "all", // "all" or array of pipeline IDs
    };

    // Process quality rules (merge with existing isRequired/isImportant)
    const processedQualityRules = qualityRules || {};
    const finalIsRequired =
      isRequired !== undefined
        ? isRequired
        : processedQualityRules.required || false;
    const finalIsImportant =
      isImportant !== undefined
        ? isImportant
        : processedQualityRules.important || false;

    // Create the custom field
    const customField = await CustomField.create({
      fieldName: fieldName.toLowerCase().replace(/\s+/g, "_"),
      fieldLabel: fieldLabel || fieldName, // Use fieldName as fallback if fieldLabel is not provided
      fieldType,
      entityType,
      fieldSource: "custom", // Always custom for user-created fields
      options: options || null,
      validationRules: validationRules || null,
      defaultValue: defaultValue || null,
      isRequired: finalIsRequired,
      isImportant: finalIsImportant,
      category: category || "Details",
      fieldGroup: fieldGroup || null,
      description: description || null,
      displayOrder: displayOrder || 0,
      masterUserID,
      // Additional UI-specific fields
      userSpecifications: processedUserSpecs,
      placesWhereShown: processedPlacesShown,
      editingPermissions: editingPermissions || "all",
      pipelineRestrictions: pipelineRestrictions || "all",
      // Backward compatibility fields
      showInAddView: processedPlacesShown.leadView,
      showInDetailView: processedPlacesShown.dealView,
      showInListView: processedPlacesShown.listView,
      // New UI-aligned fields
      leadView: processedPlacesShown.leadView,
      dealView: processedPlacesShown.dealView,
      qualityRules: {
        required: finalIsRequired,
        important: finalIsImportant,
        ...processedQualityRules,
      },
    });

    console.log(
      "CreateCustomField - Successfully created:",
      customField.fieldId
    );

    await historyLogger(
      PROGRAMS.LEAD_MANAGEMENT,
      "CUSTOM_FIELD_CREATION",
      masterUserID,
      customField.fieldId,
      null,
      `Custom field "${customField.fieldLabel}" created for ${entityType}`,
      null
    );

    res.status(201).json({
      message: "Custom field created successfully.",
      customField,
      // Additional information about field configuration
      fieldConfiguration: {
        basicInfo: {
          fieldName: customField.fieldName,
          fieldLabel: customField.fieldLabel,
          fieldType: customField.fieldType,
          entityType: customField.entityType,
        },
        userSpecifications: processedUserSpecs,
        placesWhereShown: processedPlacesShown,
        qualityRules: {
          required: finalIsRequired,
          important: finalIsImportant,
        },
        grouping: {
          category: customField.category,
          fieldGroup: customField.fieldGroup,
          displayOrder: customField.displayOrder,
        },
      },
      // For UI feedback
      uiConfiguration: {
        showInForms: {
          leadView: processedPlacesShown.leadView,
          dealView: processedPlacesShown.dealView,
          listView: processedPlacesShown.listView,
        },
        permissions: {
          editingUsers: processedUserSpecs.editingUsers,
          viewingUsers: processedUserSpecs.viewingUsers,
        },
        pipelines: processedPlacesShown.pipelines,
      },
    });
  } catch (error) {
    console.error("Error creating custom field:", error);

    // Handle specific database errors
    if (error.code === "WARN_DATA_TRUNCATED") {
      console.error("Data truncation error details:", {
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
        sql: error.sql,
      });

      return res.status(400).json({
        message: "Data validation error: " + error.sqlMessage,
        details:
          "Please check that all field values are within allowed limits and types.",
        validationTip:
          "Ensure fieldType is one of the allowed values and field lengths are within limits.",
      });
    }

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
    let whereClause = {
      masterUserID,
      fieldSource: "custom", // Only get custom fields
    };

    if (entityType) {
      // Include fields specific to this entity type AND fields that work for both
      whereClause.entityType = {
        [Op.in]: [entityType, "both"],
      };
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

    // Organize fields into sections
    const organizedFields = {
      summary: [],
      ungroupedCustomFields: [],
      customGroups: {},
    };

    const fieldCounts = {
      summary: 0,
      ungroupedCustomFields: 0,
      customGroups: 0,
    };

    customFields.forEach((field) => {
      const fieldObj = field.toJSON();

      // Parse JSON fields that might be stored as strings
      const parsedUserSpecs = (() => {
        try {
          return typeof field.userSpecifications === "string"
            ? JSON.parse(field.userSpecifications)
            : field.userSpecifications || {};
        } catch (e) {
          return {};
        }
      })();

      const parsedQualityRules = (() => {
        try {
          return typeof field.qualityRules === "string"
            ? JSON.parse(field.qualityRules)
            : field.qualityRules || {};
        } catch (e) {
          return {};
        }
      })();

      const parsedPipelineRestrictions = (() => {
        try {
          return typeof field.pipelineRestrictions === "string"
            ? JSON.parse(field.pipelineRestrictions)
            : field.pipelineRestrictions || "all";
        } catch (e) {
          return "all";
        }
      })();

      const parsedPlacesWhereShown = (() => {
        try {
          return typeof field.placesWhereShown === "string"
            ? JSON.parse(field.placesWhereShown)
            : field.placesWhereShown || {};
        } catch (e) {
          return {};
        }
      })();

      // Update fieldObj with parsed values
      fieldObj.userSpecifications = parsedUserSpecs;
      fieldObj.qualityRules = parsedQualityRules;
      fieldObj.pipelineRestrictions = parsedPipelineRestrictions;
      fieldObj.placesWhereShown = parsedPlacesWhereShown;

      // Enhance field object with UI configuration and ensure new field structure
      fieldObj.uiConfiguration = {
        showInForms: {
          leadView: field.leadView ?? field.showInAddView ?? false,
          dealView: field.dealView ?? field.showInDetailView ?? false,
          listView: field.showInListView ?? false,
        },
        permissions: {
          editingUsers: parsedUserSpecs.editingUsers || "all",
          viewingUsers: parsedUserSpecs.viewingUsers || "all",
        },
        pipelines: parsedPipelineRestrictions,
        qualityRules: {
          required: field.isRequired || false,
          important: field.isImportant || false,
          ...parsedQualityRules,
        },
      };

      // Ensure places where shown structure includes new field names
      if (
        !fieldObj.placesWhereShown ||
        Object.keys(fieldObj.placesWhereShown).length === 0
      ) {
        fieldObj.placesWhereShown = {
          leadView: field.leadView ?? field.showInAddView ?? false,
          dealView: field.dealView ?? field.showInDetailView ?? false,
          listView: field.showInListView ?? false,
          pipelines: parsedPipelineRestrictions,
        };
      } else if (
        !fieldObj.placesWhereShown.leadView &&
        !fieldObj.placesWhereShown.dealView
      ) {
        // Update old structure to new structure
        fieldObj.placesWhereShown = {
          leadView:
            fieldObj.placesWhereShown.addView ??
            field.leadView ??
            field.showInAddView ??
            false,
          dealView:
            fieldObj.placesWhereShown.detailView ??
            field.dealView ??
            field.showInDetailView ??
            false,
          listView:
            fieldObj.placesWhereShown.listView ?? field.showInListView ?? false,
          pipelines:
            fieldObj.placesWhereShown.pipelines ?? parsedPipelineRestrictions,
        };
      }

      // Ensure new field names exist in the main object
      if (fieldObj.leadView === undefined) {
        fieldObj.leadView = field.leadView ?? field.showInAddView ?? false;
      }
      if (fieldObj.dealView === undefined) {
        fieldObj.dealView = field.dealView ?? field.showInDetailView ?? false;
      }

      if (field.isImportant && field.category === "Summary") {
        // Summary - Important fields marked for quick access
        organizedFields.summary.push(fieldObj);
        fieldCounts.summary++;
      } else if (field.fieldGroup && field.fieldGroup !== "Default") {
        // Custom Groups - User-defined field groups
        if (!organizedFields.customGroups[field.fieldGroup]) {
          organizedFields.customGroups[field.fieldGroup] = [];
        }
        organizedFields.customGroups[field.fieldGroup].push(fieldObj);
      } else {
        // Ungrouped Custom Fields - Custom fields without specific groups
        organizedFields.ungroupedCustomFields.push(fieldObj);
        fieldCounts.ungroupedCustomFields++;
      }
    });

    fieldCounts.customGroups = Object.keys(organizedFields.customGroups).length;

    // Process custom fields for enhanced response
    const enhancedCustomFields = customFields.map((field) => {
      const fieldObj = field.toJSON();

      // Parse JSON fields that might be stored as strings
      const parsedUserSpecs = (() => {
        try {
          return typeof field.userSpecifications === "string"
            ? JSON.parse(field.userSpecifications)
            : field.userSpecifications || {};
        } catch (e) {
          return {};
        }
      })();

      const parsedQualityRules = (() => {
        try {
          return typeof field.qualityRules === "string"
            ? JSON.parse(field.qualityRules)
            : field.qualityRules || {};
        } catch (e) {
          return {};
        }
      })();

      const parsedPipelineRestrictions = (() => {
        try {
          return typeof field.pipelineRestrictions === "string"
            ? JSON.parse(field.pipelineRestrictions)
            : field.pipelineRestrictions || "all";
        } catch (e) {
          return "all";
        }
      })();

      const parsedPlacesWhereShown = (() => {
        try {
          return typeof field.placesWhereShown === "string"
            ? JSON.parse(field.placesWhereShown)
            : field.placesWhereShown || {};
        } catch (e) {
          return {};
        }
      })();

      // Update fieldObj with parsed values
      fieldObj.userSpecifications = parsedUserSpecs;
      fieldObj.qualityRules = parsedQualityRules;
      fieldObj.pipelineRestrictions = parsedPipelineRestrictions;
      fieldObj.placesWhereShown = parsedPlacesWhereShown;

      // Add UI configuration for consistency with create/update responses
      fieldObj.uiConfiguration = {
        showInForms: {
          leadView: field.leadView ?? field.showInAddView ?? false,
          dealView: field.dealView ?? field.showInDetailView ?? false,
          listView: field.showInListView ?? false,
        },
        permissions: {
          editingUsers: parsedUserSpecs.editingUsers || "all",
          viewingUsers: parsedUserSpecs.viewingUsers || "all",
        },
        pipelines: parsedPipelineRestrictions,
        qualityRules: {
          required: field.isRequired || false,
          important: field.isImportant || false,
          ...parsedQualityRules,
        },
      };

      // Ensure places where shown structure is consistent
      if (
        !fieldObj.placesWhereShown ||
        Object.keys(fieldObj.placesWhereShown).length === 0
      ) {
        fieldObj.placesWhereShown = {
          leadView: field.leadView ?? field.showInAddView ?? false,
          dealView: field.dealView ?? field.showInDetailView ?? false,
          listView: field.showInListView ?? false,
          pipelines: parsedPipelineRestrictions,
        };
      }

      // Ensure new field names exist
      fieldObj.leadView = field.leadView ?? field.showInAddView ?? false;
      fieldObj.dealView = field.dealView ?? field.showInDetailView ?? false;

      return fieldObj;
    });

    res.status(200).json({
      message: "Custom fields retrieved successfully.",
      customFields: enhancedCustomFields,
      // organizedFields,
      fieldCounts,
      // // Summary statistics
      // statistics: {
      //   totalFields: customFields.length,
      //   activeFields: customFields.filter((f) => f.isActive).length,
      //   requiredFields: customFields.filter((f) => f.isRequired).length,
      //   importantFields: customFields.filter((f) => f.isImportant).length,
      //   fieldsByType: customFields.reduce((acc, field) => {
      //     acc[field.fieldType] = (acc[field.fieldType] || 0) + 1;
      //     return acc;
      //   }, {}),
      // },
      // UI metadata
      // uiMetadata: {
      //   supportedFieldTypes: [
      //     "text",
      //     "textarea",
      //     "number",
      //     "decimal",
      //     "email",
      //     "phone",
      //     "url",
      //     "date",
      //     "datetime",
      //     "select",
      //     "multiselect",
      //     "checkbox",
      //     "radio",
      //     "file",
      //     "currency",
      //     "organization",
      //     "person",
      //   ],
      //   fieldTypeDetails: {
      //     text: {
      //       label: "Text",
      //       description: "Single line text input",
      //       supportsOptions: false,
      //       supportsValidation: true,
      //     },
      //     textarea: {
      //       label: "Textarea",
      //       description: "Multi-line text input",
      //       supportsOptions: false,
      //       supportsValidation: true,
      //     },
      //     number: {
      //       label: "Number",
      //       description: "Whole number input",
      //       supportsOptions: false,
      //       supportsValidation: true,
      //     },
      //     decimal: {
      //       label: "Decimal",
      //       description: "Decimal number input",
      //       supportsOptions: false,
      //       supportsValidation: true,
      //     },
      //     email: {
      //       label: "Email",
      //       description: "Email address input with validation",
      //       supportsOptions: false,
      //       supportsValidation: true,
      //     },
      //     phone: {
      //       label: "Phone",
      //       description: "Phone number input",
      //       supportsOptions: false,
      //       supportsValidation: true,
      //     },
      //     url: {
      //       label: "URL",
      //       description: "Website URL input",
      //       supportsOptions: false,
      //       supportsValidation: true,
      //     },
      //     date: {
      //       label: "Date",
      //       description: "Date picker",
      //       supportsOptions: false,
      //       supportsValidation: true,
      //     },
      //     datetime: {
      //       label: "Date & Time",
      //       description: "Date and time picker",
      //       supportsOptions: false,
      //       supportsValidation: true,
      //     },
      //     select: {
      //       label: "Single Select",
      //       description: "Dropdown with single selection",
      //       supportsOptions: true,
      //       supportsValidation: true,
      //       requiresOptions: true,
      //     },
      //     multiselect: {
      //       label: "Multi Select",
      //       description: "Dropdown with multiple selections",
      //       supportsOptions: true,
      //       supportsValidation: true,
      //       requiresOptions: true,
      //     },
      //     checkbox: {
      //       label: "Checkbox",
      //       description: "Single checkbox (true/false)",
      //       supportsOptions: false,
      //       supportsValidation: false,
      //     },
      //     radio: {
      //       label: "Radio Button",
      //       description: "Radio button group",
      //       supportsOptions: true,
      //       supportsValidation: true,
      //       requiresOptions: true,
      //     },
      //     file: {
      //       label: "File Upload",
      //       description: "File upload field",
      //       supportsOptions: false,
      //       supportsValidation: true,
      //     },
      //     currency: {
      //       label: "Currency",
      //       description: "Currency amount input",
      //       supportsOptions: false,
      //       supportsValidation: true,
      //     },
      //     organization: {
      //       label: "Organization",
      //       description: "Link to organization entity",
      //       supportsOptions: false,
      //       supportsValidation: false,
      //     },
      //     person: {
      //       label: "Person",
      //       description: "Link to person entity",
      //       supportsOptions: false,
      //       supportsValidation: false,
      //     },
      //   },
      //   placesWhereShownOptions: {
      //     leadView: "Show in lead creation/edit forms",
      //     dealView: "Show in deal creation/edit forms",
      //     listView: "Show in list/table views",
      //     pipelines: "Restrict to specific pipelines",
      //   },
      //   permissionOptions: {
      //     editingUsers: ["all", "specific", "owner_only"],
      //     viewingUsers: ["all", "specific", "owner_only"],
      //   },
      //   categoryOptions: [
      //     "Summary",
      //     "Details",
      //     "Business Information",
      //     "Contact Information",
      //     "Location Information",
      //     "Service Information",
      //     "Source Information",
      //     "Additional Information",
      //     "Lead Details",
      //     "Custom",
      //   ],
      //   validationRulesOptions: {
      //     required: "Field is required",
      //     minLength: "Minimum length validation",
      //     maxLength: "Maximum length validation",
      //     pattern: "Regular expression pattern",
      //     unique: "Field value must be unique",
      //     email: "Valid email format",
      //     url: "Valid URL format",
      //     phone: "Valid phone number format",
      //     dateRange: "Date must be within range",
      //     numberRange: "Number must be within range",
      //   },
      //   qualityRulesOptions: {
      //     required: "Mark field as required",
      //     important: "Mark field as important/summary",
      //     unique: "Ensure field value is unique",
      //     minLength: "Minimum character length",
      //     maxLength: "Maximum character length",
      //     pattern: "Custom validation pattern",
      //     customMessage: "Custom validation message",
      //   },
      // },
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
    // Additional UI form fields
    userSpecifications,
    editingPermissions,
    placesWhereShown,
    pipelineRestrictions,
    showInAddView,
    showInDetailView,
    showInListView,
    qualityRules,
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

    // Validate fieldType if provided
    if (fieldType) {
      const validationErrors = validateFieldAndEntityTypes(fieldType, null);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          message: validationErrors.join(" "),
        });
      }
    }

    // Validate user specifications if provided
    if (
      userSpecifications &&
      userSpecifications.editingUsers === "specific" &&
      (!userSpecifications.editingUsersList ||
        userSpecifications.editingUsersList.length === 0)
    ) {
      return res.status(400).json({
        message:
          "editingUsersList is required when editingUsers is set to 'specific'.",
      });
    }

    // Validate pipeline restrictions if provided
    if (
      pipelineRestrictions &&
      Array.isArray(pipelineRestrictions) &&
      pipelineRestrictions.length === 0
    ) {
      return res.status(400).json({
        message:
          "At least one pipeline must be selected when using pipeline restrictions.",
      });
    }

    // Process user specifications and permissions (only if provided)
    let processedUserSpecs;
    if (userSpecifications) {
      processedUserSpecs = {
        editingUsers: userSpecifications.editingUsers || "all",
        editingUsersList: userSpecifications.editingUsersList || [],
        viewingUsers: userSpecifications.viewingUsers || "all",
        viewingUsersList: userSpecifications.viewingUsersList || [],
      };
    }

    // Process places where shown (only if provided)
    let processedPlacesShown;
    if (
      placesWhereShown ||
      showInAddView !== undefined ||
      showInDetailView !== undefined ||
      showInListView !== undefined ||
      pipelineRestrictions !== undefined
    ) {
      processedPlacesShown = {
        leadView:
          showInAddView !== undefined
            ? showInAddView
            : placesWhereShown?.leadView ??
              placesWhereShown?.addView ??
              customField.leadView ??
              customField.showInAddView,
        dealView:
          showInDetailView !== undefined
            ? showInDetailView
            : placesWhereShown?.dealView ??
              placesWhereShown?.detailView ??
              customField.dealView ??
              customField.showInDetailView,
        listView:
          showInListView !== undefined
            ? showInListView
            : placesWhereShown?.listView ?? customField.showInListView,
        pipelines:
          pipelineRestrictions !== undefined
            ? pipelineRestrictions
            : placesWhereShown?.pipelines ?? customField.pipelineRestrictions,
      };
    }

    // Process quality rules (merge with existing isRequired/isImportant)
    let finalIsRequired = customField.isRequired;
    let finalIsImportant = customField.isImportant;
    let processedQualityRules = customField.qualityRules || {};

    if (qualityRules) {
      processedQualityRules = { ...processedQualityRules, ...qualityRules };
      finalIsRequired =
        qualityRules.required !== undefined
          ? qualityRules.required
          : finalIsRequired;
      finalIsImportant =
        qualityRules.important !== undefined
          ? qualityRules.important
          : finalIsImportant;
    }

    if (isRequired !== undefined) {
      finalIsRequired = isRequired;
    }
    if (isImportant !== undefined) {
      finalIsImportant = isImportant;
    }

    // Store old values for history
    const oldValues = { ...customField.toJSON() };

    // Update the field
    await customField.update({
      fieldLabel: fieldLabel || customField.fieldLabel,
      fieldType: fieldType || customField.fieldType,
      options: options !== undefined ? options : customField.options,
      validationRules:
        validationRules !== undefined
          ? validationRules
          : customField.validationRules,
      defaultValue:
        defaultValue !== undefined ? defaultValue : customField.defaultValue,
      isRequired: finalIsRequired,
      isImportant: finalIsImportant,
      category: category || customField.category,
      fieldGroup:
        fieldGroup !== undefined ? fieldGroup : customField.fieldGroup,
      description:
        description !== undefined ? description : customField.description,
      displayOrder:
        displayOrder !== undefined ? displayOrder : customField.displayOrder,
      isActive: isActive !== undefined ? isActive : customField.isActive,
      // Additional UI-specific fields (only update if provided)
      userSpecifications:
        processedUserSpecs !== undefined
          ? processedUserSpecs
          : customField.userSpecifications,
      placesWhereShown:
        processedPlacesShown !== undefined
          ? processedPlacesShown
          : customField.placesWhereShown,
      editingPermissions:
        editingPermissions !== undefined
          ? editingPermissions
          : customField.editingPermissions,
      pipelineRestrictions:
        pipelineRestrictions !== undefined
          ? pipelineRestrictions
          : customField.pipelineRestrictions,
      // Backward compatibility fields
      showInAddView:
        processedPlacesShown?.leadView !== undefined
          ? processedPlacesShown.leadView
          : customField.showInAddView,
      showInDetailView:
        processedPlacesShown?.dealView !== undefined
          ? processedPlacesShown.dealView
          : customField.showInDetailView,
      showInListView:
        processedPlacesShown?.listView !== undefined
          ? processedPlacesShown.listView
          : customField.showInListView,
      // New UI-aligned fields
      leadView:
        processedPlacesShown?.leadView !== undefined
          ? processedPlacesShown.leadView
          : customField.leadView ?? customField.showInAddView,
      dealView:
        processedPlacesShown?.dealView !== undefined
          ? processedPlacesShown.dealView
          : customField.dealView ?? customField.showInDetailView,
      qualityRules: {
        required: finalIsRequired,
        important: finalIsImportant,
        ...processedQualityRules,
      },
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
      // Additional information about field configuration
      fieldConfiguration: {
        basicInfo: {
          fieldName: customField.fieldName,
          fieldLabel: customField.fieldLabel,
          fieldType: customField.fieldType,
          entityType: customField.entityType,
        },
        userSpecifications:
          customField.userSpecifications || processedUserSpecs,
        placesWhereShown: customField.placesWhereShown || processedPlacesShown,
        qualityRules: {
          required: finalIsRequired,
          important: finalIsImportant,
        },
        grouping: {
          category: customField.category,
          fieldGroup: customField.fieldGroup,
          displayOrder: customField.displayOrder,
        },
      },
      // For UI feedback
      uiConfiguration: {
        showInForms: {
          leadView: customField.leadView ?? customField.showInAddView,
          dealView: customField.dealView ?? customField.showInDetailView,
          listView: customField.showInListView,
        },
        permissions: {
          editingUsers: customField.userSpecifications?.editingUsers || "all",
          viewingUsers: customField.userSpecifications?.viewingUsers || "all",
        },
        pipelines: customField.pipelineRestrictions || "all",
      },
      // What was changed
      changes: {
        old: oldValues,
        new: customField.toJSON(),
      },
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
      where: {
        entityType: {
          [Op.in]: [entityType, "both"],
        },
        masterUserID,
      },
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
      where: {
        entityType: {
          [Op.in]: [entityType, "both"],
        },
        masterUserID,
        isActive: true,
      },
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
        // Basic Lead Information
        {
          fieldName: "title",
          fieldLabel: "Title",
          fieldType: "text",
          isRequired: false,
          section: "Summary",
          displayOrder: 1,
        },
        {
          fieldName: "contactPerson",
          fieldLabel: "Contact Person",
          fieldType: "text",
          isRequired: true,
          section: "Summary",
          displayOrder: 2,
        },
        {
          fieldName: "organization",
          fieldLabel: "Organization",
          fieldType: "text",
          isRequired: false,
          section: "Summary",
          displayOrder: 3,
        },
        {
          fieldName: "email",
          fieldLabel: "Email",
          fieldType: "email",
          isRequired: false,
          section: "Summary",
          displayOrder: 4,
        },
        {
          fieldName: "phone",
          fieldLabel: "Phone",
          fieldType: "phone",
          isRequired: false,
          section: "Summary",
          displayOrder: 5,
        },
        {
          fieldName: "status",
          fieldLabel: "Status",
          fieldType: "select",
          isRequired: false,
          section: "Summary",
          displayOrder: 6,
          options: [
            "New",
            "Contacted",
            "Qualified",
            "Proposal",
            "Negotiation",
            "Closed Won",
            "Closed Lost",
          ],
        },
        {
          fieldName: "ownerId",
          fieldLabel: "Owner ID",
          fieldType: "number",
          isRequired: false,
          section: "Summary",
          displayOrder: 7,
        },
        {
          fieldName: "ownerName",
          fieldLabel: "Owner Name",
          fieldType: "text",
          isRequired: false,
          section: "Summary",
          displayOrder: 8,
        },

        // Business Information
        {
          fieldName: "proposalValue",
          fieldLabel: "Proposal Value",
          fieldType: "currency",
          isRequired: false,
          section: "Business Information",
          displayOrder: 10,
        },
        {
          fieldName: "expectedCloseDate",
          fieldLabel: "Expected Close Date",
          fieldType: "date",
          isRequired: false,
          section: "Business Information",
          displayOrder: 11,
        },
        {
          fieldName: "esplProposalNo",
          fieldLabel: "ESPL Proposal Number",
          fieldType: "text",
          isRequired: false,
          section: "Business Information",
          displayOrder: 12,
        },
        {
          fieldName: "proposalSentDate",
          fieldLabel: "Proposal Sent Date",
          fieldType: "date",
          isRequired: false,
          section: "Business Information",
          displayOrder: 13,
        },
        {
          fieldName: "currency",
          fieldLabel: "Currency",
          fieldType: "select",
          isRequired: false,
          section: "Business Information",
          displayOrder: 14,
          options: ["USD", "EUR", "GBP", "INR", "CAD", "AUD"],
        },

        // Service Information
        {
          fieldName: "serviceType",
          fieldLabel: "Service Type",
          fieldType: "text",
          isRequired: false,
          section: "Service Information",
          displayOrder: 20,
        },
        {
          fieldName: "scopeOfServiceType",
          fieldLabel: "Scope of Service Type",
          fieldType: "text",
          isRequired: false,
          section: "Service Information",
          displayOrder: 21,
        },
        {
          fieldName: "SBUClass",
          fieldLabel: "SBU Class",
          fieldType: "text",
          isRequired: false,
          section: "Service Information",
          displayOrder: 22,
        },
        {
          fieldName: "sectoralSector",
          fieldLabel: "Sectoral Sector",
          fieldType: "text",
          isRequired: false,
          section: "Service Information",
          displayOrder: 23,
        },
        {
          fieldName: "numberOfReportsPrepared",
          fieldLabel: "Number of Reports Prepared",
          fieldType: "number",
          isRequired: false,
          section: "Service Information",
          displayOrder: 24,
        },

        // Source Information
        {
          fieldName: "sourceChannel",
          fieldLabel: "Source Channel",
          fieldType: "text",
          isRequired: false,
          section: "Source Information",
          displayOrder: 30,
        },
        {
          fieldName: "sourceChannelID",
          fieldLabel: "Source Channel ID",
          fieldType: "text",
          isRequired: false,
          section: "Source Information",
          displayOrder: 31,
        },
        {
          fieldName: "sourceOrigin",
          fieldLabel: "Source Origin",
          fieldType: "text",
          isRequired: false,
          section: "Source Information",
          displayOrder: 32,
        },
        {
          fieldName: "sourceOriginID",
          fieldLabel: "Source Origin ID",
          fieldType: "text",
          isRequired: false,
          section: "Source Information",
          displayOrder: 33,
        },

        // Location Information
        {
          fieldName: "projectLocation",
          fieldLabel: "Project Location",
          fieldType: "text",
          isRequired: false,
          section: "Location Information",
          displayOrder: 40,
        },
        {
          fieldName: "organizationCountry",
          fieldLabel: "Organization Country",
          fieldType: "text",
          isRequired: false,
          section: "Location Information",
          displayOrder: 41,
        },

        // Additional Information
        {
          fieldName: "valueLabels",
          fieldLabel: "Value Labels",
          fieldType: "text",
          isRequired: false,
          section: "Additional Information",
          displayOrder: 50,
        },
        {
          fieldName: "company",
          fieldLabel: "Company",
          fieldType: "text",
          isRequired: false,
          section: "Additional Information",
          displayOrder: 51,
        },
        {
          fieldName: "visibleTo",
          fieldLabel: "Visible To",
          fieldType: "select",
          isRequired: false,
          section: "Additional Information",
          displayOrder: 52,
          options: ["Public", "Private", "Team", "Owner Only"],
        },
        {
          fieldName: "questionShared",
          fieldLabel: "Question Shared",
          fieldType: "boolean",
          isRequired: false,
          section: "Additional Information",
          displayOrder: 53,
        },

        // Lead Details Fields
        {
          fieldName: "RFP_receivedDate",
          fieldLabel: "RFP Received Date",
          fieldType: "date",
          isRequired: false,
          section: "Lead Details",
          displayOrder: 60,
        },
        {
          fieldName: "statusSummary",
          fieldLabel: "Status Summary",
          fieldType: "textarea",
          isRequired: false,
          section: "Lead Details",
          displayOrder: 61,
        },
        {
          fieldName: "responsibleId",
          fieldLabel: "Responsible ID",
          fieldType: "number",
          isRequired: false,
          section: "Lead Details",
          displayOrder: 62,
        },
        {
          fieldName: "responsiblePerson",
          fieldLabel: "Responsible Person",
          fieldType: "text",
          isRequired: false,
          section: "Lead Details",
          displayOrder: 63,
        },
        {
          fieldName: "organizationName",
          fieldLabel: "Organization Name",
          fieldType: "text",
          isRequired: false,
          section: "Lead Details",
          displayOrder: 64,
        },
        {
          fieldName: "source",
          fieldLabel: "Source",
          fieldType: "text",
          isRequired: false,
          section: "Lead Details",
          displayOrder: 65,
        },
        {
          fieldName: "personName",
          fieldLabel: "Person Name",
          fieldType: "text",
          isRequired: false,
          section: "Lead Details",
          displayOrder: 66,
        },
        {
          fieldName: "notes",
          fieldLabel: "Notes",
          fieldType: "textarea",
          isRequired: false,
          section: "Lead Details",
          displayOrder: 67,
        },
        {
          fieldName: "nextActivityDate",
          fieldLabel: "Next Activity Date",
          fieldType: "date",
          isRequired: false,
          section: "Lead Details",
          displayOrder: 68,
        },
        {
          fieldName: "nextActivityStatus",
          fieldLabel: "Next Activity Status",
          fieldType: "select",
          isRequired: false,
          section: "Lead Details",
          displayOrder: 69,
          options: ["Pending", "In Progress", "Completed", "Cancelled"],
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

// Get custom fields organized by sections
exports.getHybridFieldsSections = async (req, res) => {
  const { entityType } = req.params;
  const masterUserID = req.adminId;

  try {
    // Get all custom fields from database
    const customFields = await CustomField.findAll({
      where: {
        entityType,
        masterUserID,
        isActive: true,
        fieldSource: "custom",
      },
      order: [
        ["category", "ASC"],
        ["fieldGroup", "ASC"],
        ["displayOrder", "ASC"],
        ["fieldLabel", "ASC"],
      ],
    });

    // Define default fields for the UI (matches your screenshot)
    const defaultFields = [
      { fieldName: "user", fieldLabel: "User", fieldType: "user", icon: "👤" },
      {
        fieldName: "pipeline",
        fieldLabel: "Pipeline",
        fieldType: "number",
        icon: "123",
      },
      {
        fieldName: "stage",
        fieldLabel: "Stage",
        fieldType: "stage",
        icon: "⚪",
      },
      {
        fieldName: "visibleTo",
        fieldLabel: "Visible to",
        fieldType: "visibility",
        icon: "👥",
      },
      {
        fieldName: "productName",
        fieldLabel: "Product name",
        fieldType: "text",
        icon: "abc",
      },
      {
        fieldName: "sourceOrigin",
        fieldLabel: "Source origin",
        fieldType: "select",
        icon: "🔽",
      },
      {
        fieldName: "sourceOriginID",
        fieldLabel: "Source origin ID",
        fieldType: "text",
        icon: "abc",
      },
      {
        fieldName: "sourceChannel",
        fieldLabel: "Source channel",
        fieldType: "select",
        icon: "🔽",
      },
      {
        fieldName: "sourceChannelID",
        fieldLabel: "Source channel ID",
        fieldType: "text",
        icon: "abc",
      },
    ];

    // Define system fields for the UI (matches your screenshot)
    const systemFields = [
      { fieldName: "id", fieldLabel: "ID", fieldType: "number", icon: "123" },
      {
        fieldName: "creator",
        fieldLabel: "Creator",
        fieldType: "user",
        icon: "👤",
      },
      {
        fieldName: "weightedValue",
        fieldLabel: "Weighted value",
        fieldType: "currency",
        icon: "💲",
      },
      {
        fieldName: "status",
        fieldLabel: "Status",
        fieldType: "status",
        icon: "✅",
      },
      {
        fieldName: "dealCreated",
        fieldLabel: "Deal created",
        fieldType: "date",
        icon: "📅",
      },
      {
        fieldName: "updateTime",
        fieldLabel: "Update time",
        fieldType: "date",
        icon: "📅",
      },
      {
        fieldName: "lastStageChange",
        fieldLabel: "Last stage change",
        fieldType: "date",
        icon: "📅",
      },
      {
        fieldName: "nextActivityDate",
        fieldLabel: "Next activity date",
        fieldType: "date",
        icon: "📅",
      },
      {
        fieldName: "lastActivityDate",
        fieldLabel: "Last activity date",
        fieldType: "date",
        icon: "📅",
      },
      {
        fieldName: "wonTime",
        fieldLabel: "Won time",
        fieldType: "date",
        icon: "📅",
      },
      {
        fieldName: "lastEmailReceived",
        fieldLabel: "Last email received",
        fieldType: "date",
        icon: "📅",
      },
      {
        fieldName: "lastEmailSent",
        fieldLabel: "Last email sent",
        fieldType: "date",
        icon: "📅",
      },
      {
        fieldName: "lostTime",
        fieldLabel: "Lost time",
        fieldType: "date",
        icon: "📅",
      },
      {
        fieldName: "dealClosedOn",
        fieldLabel: "Deal closed on",
        fieldType: "date",
        icon: "📅",
      },
      {
        fieldName: "lostReason",
        fieldLabel: "Lost reason",
        fieldType: "select",
        icon: "🔽",
      },
      {
        fieldName: "totalActivities",
        fieldLabel: "Total activities",
        fieldType: "number",
        icon: "123",
      },
      {
        fieldName: "doneActivities",
        fieldLabel: "Done activities",
        fieldType: "number",
        icon: "123",
      },
      {
        fieldName: "activitiesToDo",
        fieldLabel: "Activities to do",
        fieldType: "number",
        icon: "123",
      },
      {
        fieldName: "emailMessagesCount",
        fieldLabel: "Email messages count",
        fieldType: "number",
        icon: "123",
      },
      {
        fieldName: "productQuantity",
        fieldLabel: "Product quantity",
        fieldType: "number",
        icon: "123",
      },
      {
        fieldName: "productAmount",
        fieldLabel: "Product amount",
        fieldType: "number",
        icon: "123",
      },
      {
        fieldName: "mrr",
        fieldLabel: "MRR",
        fieldType: "currency",
        icon: "💲",
      },
      {
        fieldName: "arr",
        fieldLabel: "ARR",
        fieldType: "currency",
        icon: "💲",
      },
      {
        fieldName: "acv",
        fieldLabel: "ACV",
        fieldType: "currency",
        icon: "💲",
      },
      {
        fieldName: "archiveStatus",
        fieldLabel: "Archive status",
        fieldType: "select",
        icon: "🔽",
      },
      {
        fieldName: "archiveTime",
        fieldLabel: "Archive time",
        fieldType: "date",
        icon: "📅",
      },
    ];

    // Organize custom fields into sections
    const organizedFields = {
      summary: [],
      ungroupedCustomFields: [],
      customGroups: {},
      defaultFields: defaultFields,
      systemFields: systemFields,
    };

    const fieldCounts = {
      summary: 0,
      ungroupedCustomFields: 0,
      customGroups: 0,
      defaultFields: defaultFields.length,
      systemFields: systemFields.length,
    };

    // Process custom fields
    customFields.forEach((field) => {
      const fieldObj = field.toJSON();
      fieldObj.source = "custom";

      if (field.isImportant && field.category === "Summary") {
        organizedFields.summary.push(fieldObj);
        fieldCounts.summary++;
      } else if (field.fieldGroup && field.fieldGroup !== "Default") {
        if (!organizedFields.customGroups[field.fieldGroup]) {
          organizedFields.customGroups[field.fieldGroup] = [];
        }
        organizedFields.customGroups[field.fieldGroup].push(fieldObj);
      } else {
        organizedFields.ungroupedCustomFields.push(fieldObj);
        fieldCounts.ungroupedCustomFields++;
      }
    });

    fieldCounts.customGroups = Object.keys(organizedFields.customGroups).length;

    // Create sections array for the UI
    const sections = [
      {
        key: "summary",
        label: "Summary",
        fields: organizedFields.summary,
        count: fieldCounts.summary,
        collapsible: true,
        defaultCollapsed: false,
      },
      {
        key: "ungroupedCustomFields",
        label: "Ungrouped custom fields",
        fields: organizedFields.ungroupedCustomFields,
        count: fieldCounts.ungroupedCustomFields,
        collapsible: true,
        defaultCollapsed: false,
      },
    ];

    // Add custom groups as sections
    Object.keys(organizedFields.customGroups).forEach((groupName) => {
      sections.push({
        key: `customGroup_${groupName}`,
        label: groupName,
        fields: organizedFields.customGroups[groupName],
        count: organizedFields.customGroups[groupName].length,
        collapsible: true,
        defaultCollapsed: false,
      });
    });

    // Add default and system fields sections
    sections.push(
      {
        key: "defaultFields",
        label: "Default fields",
        fields: organizedFields.defaultFields,
        count: fieldCounts.defaultFields,
        collapsible: true,
        defaultCollapsed: true,
        readonly: false,
      },
      {
        key: "systemFields",
        label: "System fields",
        fields: organizedFields.systemFields,
        count: fieldCounts.systemFields,
        collapsible: true,
        defaultCollapsed: true,
        readonly: true,
      }
    );

    res.status(200).json({
      message: "Hybrid field sections retrieved successfully.",
      entityType,
      sections,
      organizedFields,
      fieldCounts,
      totalFields:
        fieldCounts.summary +
        fieldCounts.ungroupedCustomFields +
        Object.values(organizedFields.customGroups).reduce(
          (acc, group) => acc + group.length,
          0
        ) +
        fieldCounts.defaultFields +
        fieldCounts.systemFields,
    });
  } catch (error) {
    console.error("Error fetching hybrid field sections:", error);
    res.status(500).json({
      message: "Failed to fetch hybrid field sections.",
      error: error.message,
    });
  }
};

// Bulk update leadView and dealView for multiple fields
exports.bulkUpdateFieldVisibility = async (req, res) => {
  const { fieldUpdates } = req.body; // Array of { fieldId, leadView, dealView, listView, pipelines }
  const masterUserID = req.adminId;

  try {
    if (
      !fieldUpdates ||
      !Array.isArray(fieldUpdates) ||
      fieldUpdates.length === 0
    ) {
      return res.status(400).json({
        message:
          "fieldUpdates array is required and must contain at least one update.",
      });
    }

    const updatedFields = [];
    const errors = [];

    for (const update of fieldUpdates) {
      const { fieldId, leadView, dealView, listView, pipelines } = update;

      if (!fieldId) {
        errors.push(
          `fieldId is required for update: ${JSON.stringify(update)}`
        );
        continue;
      }

      try {
        const customField = await CustomField.findOne({
          where: { fieldId, masterUserID },
        });

        if (!customField) {
          errors.push(`Custom field with ID ${fieldId} not found.`);
          continue;
        }

        // Store old values for history
        const oldValues = { ...customField.toJSON() };

        // Prepare the updated places where shown structure
        const updatedPlacesShown = {
          leadView:
            leadView !== undefined
              ? leadView
              : customField.leadView ?? customField.showInAddView ?? false,
          dealView:
            dealView !== undefined
              ? dealView
              : customField.dealView ?? customField.showInDetailView ?? false,
          listView:
            listView !== undefined ? listView : customField.showInListView,
          pipelines:
            pipelines !== undefined
              ? pipelines
              : customField.pipelineRestrictions || "all",
        };

        // Update the field
        await customField.update({
          // New UI-aligned fields
          leadView: updatedPlacesShown.leadView,
          dealView: updatedPlacesShown.dealView,
          showInListView: updatedPlacesShown.listView,
          pipelineRestrictions: updatedPlacesShown.pipelines,
          // Backward compatibility fields
          showInAddView: updatedPlacesShown.leadView,
          showInDetailView: updatedPlacesShown.dealView,
          // Updated places where shown structure
          placesWhereShown: updatedPlacesShown,
        });

        // Log the update
        await historyLogger(
          PROGRAMS.LEAD_MANAGEMENT,
          "CUSTOM_FIELD_BULK_UPDATE",
          masterUserID,
          customField.fieldId,
          null,
          `Field visibility updated for "${customField.fieldLabel}"`,
          {
            old: {
              leadView: oldValues.leadView ?? oldValues.showInAddView,
              dealView: oldValues.dealView ?? oldValues.showInDetailView,
              listView: oldValues.showInListView,
              pipelines: oldValues.pipelineRestrictions,
            },
            new: updatedPlacesShown,
          }
        );

        updatedFields.push({
          fieldId: customField.fieldId,
          fieldName: customField.fieldName,
          fieldLabel: customField.fieldLabel,
          updatedVisibility: updatedPlacesShown,
        });
      } catch (error) {
        errors.push(`Error updating field ${fieldId}: ${error.message}`);
      }
    }

    const response = {
      message: `Bulk update completed. Updated ${updatedFields.length} fields.`,
      updatedFields,
      successCount: updatedFields.length,
      totalRequested: fieldUpdates.length,
    };

    if (errors.length > 0) {
      response.errors = errors;
      response.errorCount = errors.length;
    }

    const statusCode = errors.length > 0 ? 207 : 200; // 207 for partial success
    res.status(statusCode).json(response);
  } catch (error) {
    console.error("Error in bulk update field visibility:", error);
    res.status(500).json({
      message: "Failed to bulk update field visibility.",
      error: error.message,
    });
  }
};

// Migrate existing fields to use new leadView/dealView structure
exports.migrateFieldsToNewStructure = async (req, res) => {
  const { entityType, dryRun = false } = req.query;
  const masterUserID = req.adminId;

  try {
    let whereClause = {
      masterUserID,
      fieldSource: "custom",
    };

    if (entityType) {
      whereClause.entityType = entityType;
    }

    const customFields = await CustomField.findAll({
      where: whereClause,
    });

    const fieldsToMigrate = [];
    const alreadyMigrated = [];

    customFields.forEach((field) => {
      // Check if field needs migration
      const needsMigration =
        field.leadView === null ||
        field.leadView === undefined ||
        field.dealView === null ||
        field.dealView === undefined ||
        !field.placesWhereShown ||
        (!field.placesWhereShown.leadView && !field.placesWhereShown.dealView);

      if (needsMigration) {
        fieldsToMigrate.push({
          fieldId: field.fieldId,
          fieldName: field.fieldName,
          fieldLabel: field.fieldLabel,
          currentState: {
            leadView: field.leadView,
            dealView: field.dealView,
            showInAddView: field.showInAddView,
            showInDetailView: field.showInDetailView,
            showInListView: field.showInListView,
            placesWhereShown: field.placesWhereShown,
          },
          proposedState: {
            leadView: field.leadView ?? field.showInAddView ?? false,
            dealView: field.dealView ?? field.showInDetailView ?? false,
            listView: field.showInListView ?? false,
            pipelines: field.pipelineRestrictions || "all",
          },
        });
      } else {
        alreadyMigrated.push({
          fieldId: field.fieldId,
          fieldName: field.fieldName,
          fieldLabel: field.fieldLabel,
        });
      }
    });

    if (!dryRun && fieldsToMigrate.length > 0) {
      // Perform actual migration
      for (const fieldData of fieldsToMigrate) {
        const customField = await CustomField.findOne({
          where: { fieldId: fieldData.fieldId, masterUserID },
        });

        if (customField) {
          await customField.update({
            leadView: fieldData.proposedState.leadView,
            dealView: fieldData.proposedState.dealView,
            placesWhereShown: fieldData.proposedState,
          });

          await historyLogger(
            PROGRAMS.LEAD_MANAGEMENT,
            "CUSTOM_FIELD_MIGRATION",
            masterUserID,
            customField.fieldId,
            null,
            `Field migrated to new leadView/dealView structure: "${customField.fieldLabel}"`,
            {
              old: fieldData.currentState,
              new: fieldData.proposedState,
            }
          );
        }
      }
    }

    res.status(200).json({
      message: dryRun
        ? "Migration analysis completed (dry run)"
        : `Migration completed. Updated ${fieldsToMigrate.length} fields.`,
      totalFields: customFields.length,
      fieldsToMigrate: fieldsToMigrate.length,
      alreadyMigrated: alreadyMigrated.length,
      dryRun,
      fieldsToMigrate: dryRun ? fieldsToMigrate : undefined,
      alreadyMigrated: dryRun ? alreadyMigrated : undefined,
      migrationSummary: {
        needsMigration: fieldsToMigrate.length,
        alreadyUpToDate: alreadyMigrated.length,
        totalProcessed: customFields.length,
      },
    });
  } catch (error) {
    console.error("Error in field migration:", error);
    res.status(500).json({
      message: "Failed to migrate fields to new structure.",
      error: error.message,
    });
  }
};
