const CustomField = require("../models/customFieldModel");
const CustomFieldValue = require("../models/customFieldValueModel");
const LeadOrganization = require("../models/leads/leadOrganizationModel");
const { Op } = require("sequelize");
const sequelize = require("../config/db");
const { logAuditTrail } = require("../utils/auditTrailLogger");
const PROGRAMS = require("../utils/programConstants");
const historyLogger = require("../utils/historyLogger").logHistory;

// Create a new organization with custom fields
exports.createOrganization = async (req, res) => {
  const {  CustomField, CustomFieldValue, AuditTrail, Deal, History, LeadPerson, LeadOrganization, Lead, Activity, RecentSearch, Email } = req.models;
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
      // Create the organization in the database first
      const organizationData = {
        masterUserID,
        // Initialize with minimal required fields
        organization: "",
      };

      // Extract essential fields from customFields if present
      const essentialFields = ["name", "organization", "address"];
      for (const essentialField of essentialFields) {
        if (customFields[essentialField]) {
          if (essentialField === "name" || essentialField === "organization") {
            organizationData.organization = customFields[essentialField];
          } else if (essentialField === "address") {
            organizationData.address = customFields[essentialField];
          }
        }
      }

      // Create the organization record
      const organization = await LeadOrganization.create(organizationData, {
        transaction,
      });
      const entityId = organization.leadOrganizationId;

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

      // Log the creation
      await historyLogger(
        History,
        PROGRAMS.LEAD_MANAGEMENT,
        "ORGANIZATION_CREATION",
        masterUserID,
        entityId,
        null,
        `Organization created with custom fields`,
        { customFields: savedValues }
      );

      res.status(201).json({
        message: "Organization created successfully with custom fields.",
        organizationId: entityId,
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

// Get all organizations with custom fields
exports.getAllOrganizations = async (req, res) => {
  const {  CustomField, CustomFieldValue, AuditTrail, Deal, History, LeadPerson, LeadOrganization, Lead, Activity, RecentSearch, Email } = req.models;
  const masterUserID = req.adminId;
  const entityType = "organization";

  try {
    // Get all organizations for this user
    const organizations = await LeadOrganization.findAll({
      where: { masterUserID },
      order: [["createdAt", "DESC"]],
    });

    const organizationsWithCustomFields = [];

    for (const organization of organizations) {
      const customFieldValues = await CustomFieldValue.findAll({
        where: {
          entityId: organization.leadOrganizationId.toString(),
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

      organizationsWithCustomFields.push({
        organizationId: organization.leadOrganizationId,
        organization: organization.organization,
        address: organization.address,
        organizationLabels: organization.organizationLabels,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
        customFields: formattedCustomFields,
      });
    }

    res.status(200).json({
      message: "Organizations retrieved successfully.",
      organizations: organizationsWithCustomFields,
      totalOrganizations: organizationsWithCustomFields.length,
    });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({
      message: "Failed to fetch organizations.",
      error: error.message,
    });
  }
};

// Get a specific organization with custom fields
exports.getOrganizationById = async (req, res) => {
  const {  CustomField, CustomFieldValue, AuditTrail, Deal, History, LeadPerson, LeadOrganization, Lead, Activity, RecentSearch, Email } = req.models;
  const { organizationId } = req.params;
  const masterUserID = req.adminId;
  const entityType = "organization";

  try {
    // Get the organization
    const organization = await LeadOrganization.findOne({
      where: { leadOrganizationId: organizationId, masterUserID },
    });

    if (!organization) {
      return res.status(404).json({
        message: "Organization not found.",
      });
    }

    // Get custom field values
    const customFieldValues = await CustomFieldValue.findAll({
      where: {
        entityId: organizationId.toString(),
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
      message: "Organization retrieved successfully.",
      organization: {
        organizationId: organization.leadOrganizationId,
        organization: organization.organization,
        address: organization.address,
        organizationLabels: organization.organizationLabels,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
      customFields: {
        values: formattedValues,
        fieldsByCategory,
        fieldsByGroup,
      },
    });
  } catch (error) {
    console.error("Error fetching organization:", error);
    res.status(500).json({
      message: "Failed to fetch organization.",
      error: error.message,
    });
  }
};

// Update an organization with custom fields
exports.updateOrganization = async (req, res) => {
  const {  CustomField, CustomFieldValue, AuditTrail, Deal, History, LeadPerson, LeadOrganization, Lead, Activity, RecentSearch, Email } = req.models;
  const { organizationId } = req.params;
  const { customFields } = req.body;
  const masterUserID = req.adminId;
  const entityType = "organization";

  try {
    // Check if organization exists
    const organization = await LeadOrganization.findOne({
      where: { leadOrganizationId: organizationId, masterUserID },
    });

    if (!organization) {
      return res.status(404).json({
        message: "Organization not found.",
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
            entityId: organizationId.toString(),
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
              entityId: organizationId.toString(),
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

      // Log the update
      await historyLogger(
        History,
        PROGRAMS.LEAD_MANAGEMENT,
        "ORGANIZATION_UPDATE",
        masterUserID,
        organizationId,
        null,
        `Organization updated with custom fields`,
        { customFields: updatedValues }
      );

      res.status(200).json({
        message: "Organization updated successfully with custom fields.",
        organizationId: organizationId,
        customFields: updatedValues,
        totalFields: updatedValues.length,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error updating organization:", error);
    res.status(500).json({
      message: "Failed to update organization.",
      error: error.message,
    });
  }
};

// Delete an organization
exports.deleteOrganization = async (req, res) => {
  const {  CustomField, CustomFieldValue, AuditTrail, Deal, History, LeadPerson, LeadOrganization, Lead, Activity, RecentSearch, Email } = req.models;
  const { organizationId } = req.params;
  const masterUserID = req.adminId;
  const role = req.role;
  const entityType = "organization";

  try {
    // Build the where condition based on role
    const whereCondition = { leadOrganizationId : organizationId };
    
    // Only include masterUserID if role is not admin
    if (role !== 'admin') {
      whereCondition.masterUserID = masterUserID;
    }

    // Check if organization exists
    const organization = await LeadOrganization.findOne({
      where: whereCondition,
    });

    if (!organization) {
      return res.status(404).json({
        message: "Organization not found.",
      });
    }

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Build where condition for custom field values deletion
      const customFieldWhereCondition = {
        entityId: organizationId.toString(),
        entityType,
      };
      
      // Only include masterUserID if role is not admin
      if (role !== 'admin') {
        customFieldWhereCondition.masterUserID = masterUserID;
      }

      // Delete all custom field values
      await CustomFieldValue.destroy({
        where: customFieldWhereCondition,
        transaction,
      });

      // Delete the organization
      await organization.destroy({ transaction });

      // Commit the transaction
      await transaction.commit();

      // Log the deletion
      await historyLogger(
        History,
        PROGRAMS.LEAD_MANAGEMENT,
        "ORGANIZATION_DELETION",
        masterUserID,
        organizationId,
        null,
        `Organization deleted`,
        null
      );

      res.status(200).json({
        message: "Organization deleted successfully.",
        leadOrganizationId: organizationId,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error deleting organization:", error);
    res.status(500).json({
      message: "Failed to delete organization.",
      error: error.message,
    });
  }
};
// exports.deleteOrganization = async (req, res) => {
//   const { organizationId } = req.params;
//   const masterUserID = req.adminId;
//   const entityType = "organization";

//   try {
//     // Check if organization exists
//     const organization = await LeadOrganization.findOne({
//       where: { leadOrganizationId: organizationId, masterUserID },
//     });

//     if (!organization) {
//       return res.status(404).json({
//         message: "Organization not found.",
//       });
//     }

//     // Start a transaction
//     const transaction = await sequelize.transaction();

//     try {
//       // Delete all custom field values
//       await CustomFieldValue.destroy({
//         where: {
//           entityId: organizationId.toString(),
//           entityType,
//           masterUserID,
//         },
//         transaction,
//       });

//       // Delete the organization
//       await organization.destroy({ transaction });

//       // Commit the transaction
//       await transaction.commit();

//       // Log the deletion
//       await historyLogger(
//         PROGRAMS.LEAD_MANAGEMENT,
//         "ORGANIZATION_DELETION",
//         masterUserID,
//         organizationId,
//         null,
//         `Organization deleted`,
//         null
//       );

//       res.status(200).json({
//         message: "Organization deleted successfully.",
//         organizationId: organizationId,
//       });
//     } catch (error) {
//       await transaction.rollback();
//       throw error;
//     }
//   } catch (error) {
//     console.error("Error deleting organization:", error);
//     res.status(500).json({
//       message: "Failed to delete organization.",
//       error: error.message,
//     });
//   }
// };
