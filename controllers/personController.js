const CustomField = require("../models/customFieldModel");
const CustomFieldValue = require("../models/customFieldValueModel");
const LeadPerson = require("../models/leads/leadPersonModel");
const { Op } = require("sequelize");
const sequelize = require("../config/db");
const { logAuditTrail } = require("../utils/auditTrailLogger");
const PROGRAMS = require("../utils/programConstants");
const historyLogger = require("../utils/historyLogger").logHistory;

// Create a new person with custom fields
exports.createPerson = async (req, res) => {
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
      // Create the person in the database first
      const personData = {
        masterUserID,
        // Initialize with minimal required fields
        contactPerson: "",
        email: "",
      };

      // Extract essential fields from customFields if present
      const essentialFields = ["name", "contactPerson", "email", "phone"];
      for (const essentialField of essentialFields) {
        if (customFields[essentialField]) {
          if (essentialField === "name" || essentialField === "contactPerson") {
            personData.contactPerson = customFields[essentialField];
          } else if (essentialField === "email") {
            personData.email = customFields[essentialField];
          } else if (essentialField === "phone") {
            personData.phone = customFields[essentialField];
          }
        }
      }

      // Check for duplicate email if email is provided
      if (personData.email) {
        const existingEmailPerson = await LeadPerson.findOne({
          where: { email: personData.email },
          transaction,
        });
        if (existingEmailPerson) {
          await transaction.rollback();
          return res.status(409).json({
            message: `A person with email address "${personData.email}" already exists.`,
            existingPerson: {
              personId: existingEmailPerson.personId,
              contactPerson: existingEmailPerson.contactPerson,
              email: existingEmailPerson.email,
            },
          });
        }
      }

      // Create the person record
      const person = await LeadPerson.create(personData, { transaction });
      const entityId = person.personId;

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
        PROGRAMS.LEAD_MANAGEMENT,
        "PERSON_CREATION",
        masterUserID,
        entityId,
        null,
        `Person created with custom fields`,
        { customFields: savedValues }
      );

      res.status(201).json({
        message: "Person created successfully with custom fields.",
        personId: entityId,
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

    // Handle database constraint violations
    if (error.name === "SequelizeUniqueConstraintError") {
      const field = error.errors[0]?.path || "unknown";
      const value = error.errors[0]?.value || "unknown";

      if (field === "email") {
        return res.status(409).json({
          message: `A person with email address "${value}" already exists.`,
          field: "email",
          value: value,
        });
      }

      return res.status(409).json({
        message: `A person with this ${field} already exists.`,
        field: field,
        value: value,
      });
    }

    res.status(500).json({
      message: "Failed to create person with custom fields.",
      error: error.message,
    });
  }
};

// Get all persons with custom fields
exports.getAllPersons = async (req, res) => {
  const masterUserID = req.adminId;
  const entityType = "person";

  try {
    // Get all persons for this user
    const persons = await LeadPerson.findAll({
      where: { masterUserID },
      order: [["createdAt", "DESC"]],
    });

    const personsWithCustomFields = [];

    for (const person of persons) {
      const customFieldValues = await CustomFieldValue.findAll({
        where: {
          entityId: person.personId.toString(),
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

      personsWithCustomFields.push({
        personId: person.personId,
        contactPerson: person.contactPerson,
        email: person.email,
        phone: person.phone,
        createdAt: person.createdAt,
        updatedAt: person.updatedAt,
        customFields: formattedCustomFields,
      });
    }

    res.status(200).json({
      message: "Persons retrieved successfully.",
      persons: personsWithCustomFields,
      totalPersons: personsWithCustomFields.length,
    });
  } catch (error) {
    console.error("Error fetching persons:", error);
    res.status(500).json({
      message: "Failed to fetch persons.",
      error: error.message,
    });
  }
};

// Get a specific person with custom fields
exports.getPersonById = async (req, res) => {
  const { personId } = req.params;
  const masterUserID = req.adminId;
  const entityType = "person";

  try {
    // Get the person
    const person = await LeadPerson.findOne({
      where: { personId, masterUserID },
    });

    if (!person) {
      return res.status(404).json({
        message: "Person not found.",
      });
    }

    // Get custom field values
    const customFieldValues = await CustomFieldValue.findAll({
      where: {
        entityId: personId.toString(),
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
      message: "Person retrieved successfully.",
      person: {
        personId: person.personId,
        contactPerson: person.contactPerson,
        email: person.email,
        phone: person.phone,
        createdAt: person.createdAt,
        updatedAt: person.updatedAt,
      },
      customFields: {
        values: formattedValues,
        fieldsByCategory,
        fieldsByGroup,
      },
    });
  } catch (error) {
    console.error("Error fetching person:", error);
    res.status(500).json({
      message: "Failed to fetch person.",
      error: error.message,
    });
  }
};

// Update a person with custom fields
exports.updatePerson = async (req, res) => {
  const { personId } = req.params;
  const { customFields } = req.body;
  const masterUserID = req.adminId;
  const entityType = "person";

  try {
    // Check if person exists
    const person = await LeadPerson.findOne({
      where: { personId, masterUserID },
    });

    if (!person) {
      return res.status(404).json({
        message: "Person not found.",
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
            entityId: personId.toString(),
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
              entityId: personId.toString(),
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
        PROGRAMS.LEAD_MANAGEMENT,
        "PERSON_UPDATE",
        masterUserID,
        personId,
        null,
        `Person updated with custom fields`,
        { customFields: updatedValues }
      );

      res.status(200).json({
        message: "Person updated successfully with custom fields.",
        personId: personId,
        customFields: updatedValues,
        totalFields: updatedValues.length,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error updating person:", error);
    res.status(500).json({
      message: "Failed to update person.",
      error: error.message,
    });
  }
};

// Delete a person
exports.deletePerson = async (req, res) => {
  const { personId } = req.params;
  const masterUserID = req.adminId;
  const entityType = "person";

  try {
    // Check if person exists
    const person = await LeadPerson.findOne({
      where: { personId, masterUserID },
    });

    if (!person) {
      return res.status(404).json({
        message: "Person not found.",
      });
    }

    // Start a transaction
    const transaction = await sequelize.transaction();

    try {
      // Delete all custom field values
      await CustomFieldValue.destroy({
        where: {
          entityId: personId.toString(),
          entityType,
          masterUserID,
        },
        transaction,
      });

      // Delete the person
      await person.destroy({ transaction });

      // Commit the transaction
      await transaction.commit();

      // Log the deletion
      await historyLogger(
        PROGRAMS.LEAD_MANAGEMENT,
        "PERSON_DELETION",
        masterUserID,
        personId,
        null,
        `Person deleted`,
        null
      );

      res.status(200).json({
        message: "Person deleted successfully.",
        personId: personId,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error deleting person:", error);
    res.status(500).json({
      message: "Failed to delete person.",
      error: error.message,
    });
  }
};
