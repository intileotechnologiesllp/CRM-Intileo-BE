// Bulk update organizations with custom fields (accepts { leadOrganizationId: [], updateData: {} })
exports.bulkUpdateOrganizations = async (req, res) => {
  const { leadOrganizationId, updateData } = req.body; // { leadOrganizationId: [1,2,3], updateData: { field1: value1, ... } }
  const adminId = req.adminId;
  const entityType = "organization";
  const CustomField = require("../../models/customFieldModel");
  const CustomFieldValue = require("../../models/customFieldValueModel");
  const Organization = require("../../models/leads/leadOrganizationModel");
  const sequelize = require("../../config/db");

  if (
    !Array.isArray(leadOrganizationId) ||
    leadOrganizationId.length === 0 ||
    !updateData ||
    typeof updateData !== "object" ||
    Object.keys(updateData).length === 0
  ) {
    return res.status(400).json({
      message:
        "'leadOrganizationId' array and 'updateData' object are required.",
    });
  }

  const results = [];
  // Get all organization model fields
  const orgFields = Object.keys(Organization.rawAttributes);
  for (const orgId of leadOrganizationId) {
    const fields = { ...updateData };
    const transaction = await sequelize.transaction();
    try {
      // Admins can update any organization, others only their own
      let organization;
      if (req.role === "admin") {
        organization = await Organization.findOne({
          where: { leadOrganizationId: orgId },
          transaction,
        });
      } else {
        organization = await Organization.findOne({
          where: { leadOrganizationId: orgId, masterUserID: adminId },
          transaction,
        });
      }
      if (!organization) {
        await transaction.rollback();
        results.push({
          leadOrganizationId: orgId,
          success: false,
          error: "Organization not found.",
        });
        continue;
      }
      const updatedValues = [];
      const validationErrors = [];

      // Separate standard and custom fields
      const standardFieldUpdates = {};
      const customFieldUpdates = {};
      for (const [fieldKey, value] of Object.entries(fields)) {
        if (orgFields.includes(fieldKey)) {
          standardFieldUpdates[fieldKey] = value;
        } else {
          customFieldUpdates[fieldKey] = value;
        }
      }

      // Update standard fields if any
      if (Object.keys(standardFieldUpdates).length > 0) {
        await organization.update(standardFieldUpdates, { transaction });
        // Add updated standard fields to updatedValues for response
        for (const [fieldKey, value] of Object.entries(standardFieldUpdates)) {
          updatedValues.push({
            fieldName: fieldKey,
            value,
            isStandard: true,
          });
        }
      }

      // Update custom fields as before
      for (const [fieldKey, value] of Object.entries(customFieldUpdates)) {
        let customField;
        if (isNaN(fieldKey)) {
          customField = await CustomField.findOne({
            where: { fieldName: fieldKey, masterUserID: adminId, entityType },
            transaction,
          });
        } else {
          customField = await CustomField.findOne({
            where: { fieldId: fieldKey, masterUserID: adminId, entityType },
            transaction,
          });
        }
        if (!customField) continue;
        if (
          customField.isRequired &&
          (value === null || value === "" || value === undefined)
        ) {
          validationErrors.push(
            `Field \"${customField.fieldLabel}\" is required.`
          );
          continue;
        }
        let processedValue = value;
        if (
          customField.fieldType === "number" &&
          value !== null &&
          value !== ""
        ) {
          processedValue = parseFloat(value);
          if (isNaN(processedValue)) {
            validationErrors.push(
              `Invalid number value for field \"${customField.fieldLabel}\".`
            );
            continue;
          }
        }
        if (customField.fieldType === "email" && value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            validationErrors.push(
              `Invalid email format for field \"${customField.fieldLabel}\".`
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
              `Invalid option \"${value}\" for field \"${customField.fieldLabel}\".`
            );
            continue;
          }
        }
        let fieldValue = await CustomFieldValue.findOne({
          where: {
            fieldId: customField.fieldId,
            entityId: orgId.toString(),
            entityType,
            masterUserID: adminId,
          },
          transaction,
        });
        if (fieldValue) {
          await fieldValue.update({ value: processedValue }, { transaction });
        } else {
          fieldValue = await CustomFieldValue.create(
            {
              fieldId: customField.fieldId,
              entityId: orgId.toString(),
              entityType,
              value: processedValue,
              masterUserID: adminId,
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

      if (validationErrors.length > 0) {
        await transaction.rollback();
        results.push({
          leadOrganizationId: orgId,
          success: false,
          errors: validationErrors,
        });
        continue;
      }
      await transaction.commit();
      results.push({
        leadOrganizationId: orgId,
        success: true,
        updatedFields: updatedValues,
      });
    } catch (error) {
      await transaction.rollback();
      results.push({
        leadOrganizationId: orgId,
        success: false,
        error: error.message,
      });
    }
  }
  res.status(200).json({
    message: "Bulk update completed.",
    results,
    total: results.length,
    successCount: results.filter((r) => r.success).length,
    failureCount: results.filter((r) => !r.success).length,
  });
};
// Bulk update persons with custom fields (accepts { personId: [], updateData: {} })
exports.bulkUpdatePersons = async (req, res) => {
  const { personId, updateData } = req.body; // { personId: [1,2,3], updateData: { field1: value1, ... } }
  const adminId = req.adminId;
  const entityType = "person";
  const CustomField = require("../../models/customFieldModel");
  const CustomFieldValue = require("../../models/customFieldValueModel");
  const Person = require("../../models/leads/leadPersonModel");
  const sequelize = require("../../config/db");

  if (
    !Array.isArray(personId) ||
    personId.length === 0 ||
    !updateData ||
    typeof updateData !== "object" ||
    Object.keys(updateData).length === 0
  ) {
    return res.status(400).json({
      message: "'personId' array and 'updateData' object are required.",
    });
  }

  const results = [];
  // Get all person model fields
  const personFields = Object.keys(Person.rawAttributes);
  for (const pId of personId) {
    const fields = { ...updateData };
    const transaction = await sequelize.transaction();
    try {
      // Admins can update any person, others only their own
      let person;
      if (req.role === "admin") {
        person = await Person.findOne({
          where: { personId: pId },
          transaction,
        });
      } else {
        person = await Person.findOne({
          where: { personId: pId, masterUserID: adminId },
          transaction,
        });
      }
      if (!person) {
        await transaction.rollback();
        results.push({
          personId: pId,
          success: false,
          error: "Person not found.",
        });
        continue;
      }
      const updatedValues = [];
      const validationErrors = [];

      // Separate standard and custom fields
      const standardFieldUpdates = {};
      const customFieldUpdates = {};
      for (const [fieldKey, value] of Object.entries(fields)) {
        if (personFields.includes(fieldKey)) {
          standardFieldUpdates[fieldKey] = value;
        } else {
          customFieldUpdates[fieldKey] = value;
        }
      }

      // Update standard fields if any
      if (Object.keys(standardFieldUpdates).length > 0) {
        await person.update(standardFieldUpdates, { transaction });
        // Add updated standard fields to updatedValues for response
        for (const [fieldKey, value] of Object.entries(standardFieldUpdates)) {
          updatedValues.push({
            fieldName: fieldKey,
            value,
            isStandard: true,
          });
        }
      }

      // Update custom fields as before
      for (const [fieldKey, value] of Object.entries(customFieldUpdates)) {
        let customField;
        if (isNaN(fieldKey)) {
          customField = await CustomField.findOne({
            where: { fieldName: fieldKey, masterUserID: adminId, entityType },
            transaction,
          });
        } else {
          customField = await CustomField.findOne({
            where: { fieldId: fieldKey, masterUserID: adminId, entityType },
            transaction,
          });
        }
        if (!customField) continue;
        if (
          customField.isRequired &&
          (value === null || value === "" || value === undefined)
        ) {
          validationErrors.push(
            `Field \"${customField.fieldLabel}\" is required.`
          );
          continue;
        }
        let processedValue = value;
        if (
          customField.fieldType === "number" &&
          value !== null &&
          value !== ""
        ) {
          processedValue = parseFloat(value);
          if (isNaN(processedValue)) {
            validationErrors.push(
              `Invalid number value for field \"${customField.fieldLabel}\".`
            );
            continue;
          }
        }
        if (customField.fieldType === "email" && value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            validationErrors.push(
              `Invalid email format for field \"${customField.fieldLabel}\".`
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
              `Invalid option \"${value}\" for field \"${customField.fieldLabel}\".`
            );
            continue;
          }
        }
        let fieldValue = await CustomFieldValue.findOne({
          where: {
            fieldId: customField.fieldId,
            entityId: pId.toString(),
            entityType,
            masterUserID: adminId,
          },
          transaction,
        });
        if (fieldValue) {
          await fieldValue.update({ value: processedValue }, { transaction });
        } else {
          fieldValue = await CustomFieldValue.create(
            {
              fieldId: customField.fieldId,
              entityId: pId.toString(),
              entityType,
              value: processedValue,
              masterUserID: adminId,
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

      if (validationErrors.length > 0) {
        await transaction.rollback();
        results.push({
          personId: pId,
          success: false,
          errors: validationErrors,
        });
        continue;
      }
      await transaction.commit();
      results.push({
        personId: pId,
        success: true,
        updatedFields: updatedValues,
      });
    } catch (error) {
      await transaction.rollback();
      results.push({ personId: pId, success: false, error: error.message });
    }
  }
  res.status(200).json({
    message: "Bulk update completed.",
    results,
    total: results.length,
    successCount: results.filter((r) => r.success).length,
    failureCount: results.filter((r) => !r.success).length,
  });
};
// Get organizations with persons, leadCount, and ownerName, supporting dynamic filtering
exports.getOrganizationsAndPersons = async (req, res) => {
  try {
    // Import required models at the beginning of the function
    const { Lead, LeadDetails, Person, Organization } = require("../../models");
    const Deal = require("../../models/deals/dealsModels");
    const MasterUser = require("../../models/master/masterUserModel");
    const CustomField = require("../../models/customFieldModel");
    const CustomFieldValue = require("../../models/customFieldValueModel");

    // Pagination and search for organizations
    const orgPage = parseInt(req.query.orgPage) || 1;
    const orgLimit = parseInt(req.query.orgLimit) || 20;
    const orgOffset = (orgPage - 1) * orgLimit;
    const orgSearch = req.query.orgSearch || "";

    // Dynamic filter config (from body or query)
    const LeadFilter = require("../../models/leads/leadFiltersModel");
    let filterConfig = null;
    let filterIdRaw = null;
    if (req.body && req.body.filterId !== undefined) {
      filterIdRaw = req.body.filterId;
    } else if (req.query && req.query.filterId !== undefined) {
      filterIdRaw = req.query.filterId;
    }
    if (filterIdRaw !== null && filterIdRaw !== undefined) {
      if (typeof filterIdRaw === "string" && /^\d+$/.test(filterIdRaw)) {
        const filterRow = await LeadFilter.findByPk(parseInt(filterIdRaw));
        if (filterRow && filterRow.filterConfig) {
          // Parse the filterConfig if it's a JSON string from database
          if (typeof filterRow.filterConfig === "string") {
            try {
              filterConfig = JSON.parse(filterRow.filterConfig);
              console.log(
                "[DEBUG] Parsed filterConfig from DB string:",
                JSON.stringify(filterConfig, null, 2)
              );
            } catch (e) {
              console.log(
                "[DEBUG] Error parsing filterConfig string from DB:",
                e.message
              );
              filterConfig = null;
            }
          } else {
            filterConfig = filterRow.filterConfig;
          }
        }
      } else if (typeof filterIdRaw === "number") {
        const filterRow = await LeadFilter.findByPk(filterIdRaw);
        if (filterRow && filterRow.filterConfig) {
          // Parse the filterConfig if it's a JSON string from database
          if (typeof filterRow.filterConfig === "string") {
            try {
              filterConfig = JSON.parse(filterRow.filterConfig);
              console.log(
                "[DEBUG] Parsed filterConfig from DB string:",
                JSON.stringify(filterConfig, null, 2)
              );
            } catch (e) {
              console.log(
                "[DEBUG] Error parsing filterConfig string from DB:",
                e.message
              );
              filterConfig = null;
            }
          } else {
            filterConfig = filterRow.filterConfig;
          }
        }
      } else {
        try {
          filterConfig =
            typeof filterIdRaw === "string"
              ? JSON.parse(filterIdRaw)
              : filterIdRaw;
        } catch (e) {
          filterConfig = null;
        }
      }
    }

    let organizationWhere = {};
    let personWhere = {};
    let leadWhere = {};
    let dealWhere = {};
    let activityWhere = {};

    const { Op } = require("sequelize");
    const Sequelize = require("sequelize");

    // Debug: print filterConfig
    console.log("[DEBUG] filterConfig:", JSON.stringify(filterConfig, null, 2));
    console.log("[DEBUG] Available model fields:");
    console.log("[DEBUG] - Lead fields:", Object.keys(Lead.rawAttributes));
    console.log("[DEBUG] - Person fields:", Object.keys(Person.rawAttributes));
    console.log(
      "[DEBUG] - Organization fields:",
      Object.keys(Organization.rawAttributes)
    );
    const ops = {
      eq: Op.eq,
      ne: Op.ne,
      like: Op.like,
      notLike: Op.notLike,
      gt: Op.gt,
      gte: Op.gte,
      lt: Op.lt,
      lte: Op.lte,
      in: Op.in,
      notIn: Op.notIn,
      is: Op.eq,
      isNot: Op.ne,
      isEmpty: Op.is,
      isNotEmpty: Op.not,
      between: Op.between,
      notBetween: Op.notBetween,
    };
    const operatorMap = {
      is: "eq",
      "is not": "ne",
      "is empty": "isEmpty",
      "is not empty": "isNotEmpty",
      contains: "like",
      "does not contain": "notLike",
      "is exactly or earlier than": "lte",
      "is earlier than": "lt",
      "is exactly or later than": "gte",
      "not equals": "ne",
      "greater than": "gt",
      "greater than or equal": "gte",
      "less than": "lt",
      "less than or equal": "lte",
    };

    // Helper function to build a single condition - following the pattern from other APIs
    function buildCondition(cond) {
      console.log(
        "[DEBUG] buildCondition called with:",
        JSON.stringify(cond, null, 2)
      );

      const ops = {
        eq: Op.eq,
        ne: Op.ne,
        like: Op.like,
        notLike: Op.notLike,
        gt: Op.gt,
        gte: Op.gte,
        lt: Op.lt,
        lte: Op.lte,
        in: Op.in,
        notIn: Op.notIn,
        is: Op.eq,
        isNot: Op.ne,
        isEmpty: Op.is,
        isNotEmpty: Op.not,
        between: Op.between,
        notBetween: Op.notBetween,
      };

      let operator = cond.operator;
      console.log("[DEBUG] Original operator:", operator);

      if (operatorMap[operator]) {
        operator = operatorMap[operator];
        console.log("[DEBUG] Mapped operator:", operator);
      }

      // Handle "is empty" and "is not empty"
      if (operator === "isEmpty" || operator === "is empty") {
        const result = { [cond.field]: { [Op.is]: null } };
        console.log(
          "[DEBUG] isEmpty condition result:",
          JSON.stringify(result, null, 2)
        );
        return result;
      }
      if (operator === "isNotEmpty" || operator === "is not empty") {
        const result = { [cond.field]: { [Op.not]: null, [Op.ne]: "" } };
        console.log(
          "[DEBUG] isNotEmpty condition result:",
          JSON.stringify(result, null, 2)
        );
        return result;
      }

      // Handle "contains" and "does not contain" for text fields
      if (operator === "like" || operator === "contains") {
        const result = { [cond.field]: { [Op.like]: `%${cond.value}%` } };
        console.log(
          "[DEBUG] like condition result:",
          JSON.stringify(result, null, 2)
        );
        return result;
      }
      if (operator === "notLike" || operator === "does not contain") {
        const result = { [cond.field]: { [Op.notLike]: `%${cond.value}%` } };
        console.log(
          "[DEBUG] notLike condition result:",
          JSON.stringify(result, null, 2)
        );
        return result;
      }

      // Default condition
      const finalOperator = ops[operator] || Op.eq;
      console.log("[DEBUG] Final operator symbol:", finalOperator.toString());
      console.log("[DEBUG] Condition value:", cond.value);
      console.log("[DEBUG] Condition field:", cond.field);

      const result = {
        [cond.field]: {
          [finalOperator]: cond.value,
        },
      };

      // Special logging for sequelize operators (they don't serialize well with JSON.stringify)
      console.log("[DEBUG] Default condition result:", {
        field: cond.field,
        operator: finalOperator.toString(),
        value: cond.value,
        resultStructure: `{ ${cond.field}: { ${finalOperator.toString()}: "${
          cond.value
        }" } }`,
      });

      // Additional validation
      if (cond.value === undefined || cond.value === null) {
        console.log("[DEBUG] WARNING: cond.value is undefined or null!");
      }

      return result;
    }

    // Get model field names for validation
    const personFields = Object.keys(Person.rawAttributes);
    const leadFields = Object.keys(Lead.rawAttributes);
    const dealFields = Object.keys(Deal.rawAttributes);
    const organizationFields = Object.keys(Organization.rawAttributes);

    let activityFields = [];
    try {
      const Activity = require("../../models/activity/activityModel");
      activityFields = Object.keys(Activity.rawAttributes);
    } catch (e) {
      console.log("[DEBUG] Activity model not available:", e.message);
    }

    console.log("[DEBUG] Available fields:");
    console.log("- Person fields:", personFields.slice(0, 5), "...");
    console.log("- Lead fields:", leadFields.slice(0, 5), "...");
    console.log("- Deal fields:", dealFields.slice(0, 5), "...");
    console.log(
      "- Organization fields:",
      organizationFields.slice(0, 5),
      "..."
    );
    console.log("- Activity fields:", activityFields.slice(0, 5), "...");

    // If filterConfig is provided, build AND/OR logic for all entities
    if (filterConfig && typeof filterConfig === "object") {
      // AND conditions
      if (Array.isArray(filterConfig.all) && filterConfig.all.length > 0) {
        console.log("[DEBUG] Processing 'all' conditions:", filterConfig.all);

        filterConfig.all.forEach(function (cond) {
          console.log(`[DEBUG] Processing AND condition:`, cond);

          if (cond.entity) {
            // Entity is explicitly specified
            switch (cond.entity.toLowerCase()) {
              case "person":
                if (personFields.includes(cond.field)) {
                  if (!personWhere[Op.and]) personWhere[Op.and] = [];
                  personWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Person AND condition for field: ${cond.field}`
                  );
                }
                break;
              case "lead":
                if (leadFields.includes(cond.field)) {
                  if (!leadWhere[Op.and]) leadWhere[Op.and] = [];
                  leadWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Lead AND condition for field: ${cond.field}`
                  );
                }
                break;
              case "deal":
                if (dealFields.includes(cond.field)) {
                  if (!dealWhere[Op.and]) dealWhere[Op.and] = [];
                  dealWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Deal AND condition for field: ${cond.field}`
                  );
                }
                break;
              case "organization":
                if (organizationFields.includes(cond.field)) {
                  if (!organizationWhere[Op.and])
                    organizationWhere[Op.and] = [];
                  organizationWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Organization AND condition for field: ${cond.field}`
                  );
                }
                break;
              case "activity":
                if (activityFields.includes(cond.field)) {
                  if (!activityWhere[Op.and]) activityWhere[Op.and] = [];
                  activityWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Activity AND condition for field: ${cond.field}`
                  );
                }
                break;
              default:
                console.log(`[DEBUG] Unknown entity: ${cond.entity}`);
            }
          } else {
            // Auto-detect entity based on field name
            if (personFields.includes(cond.field)) {
              if (!personWhere[Op.and]) personWhere[Op.and] = [];
              personWhere[Op.and].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Person AND condition for field: ${cond.field}`
              );
            } else if (leadFields.includes(cond.field)) {
              if (!leadWhere[Op.and]) leadWhere[Op.and] = [];
              leadWhere[Op.and].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Lead AND condition for field: ${cond.field}`
              );
            } else if (dealFields.includes(cond.field)) {
              if (!dealWhere[Op.and]) dealWhere[Op.and] = [];
              dealWhere[Op.and].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Deal AND condition for field: ${cond.field}`
              );
            } else if (organizationFields.includes(cond.field)) {
              if (!organizationWhere[Op.and]) organizationWhere[Op.and] = [];
              organizationWhere[Op.and].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Organization AND condition for field: ${cond.field}`
              );
            } else if (activityFields.includes(cond.field)) {
              if (!activityWhere[Op.and]) activityWhere[Op.and] = [];
              activityWhere[Op.and].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Activity AND condition for field: ${cond.field}`
              );
            } else {
              console.log(
                `[DEBUG] Field '${cond.field}' not found in any entity`
              );
            }
          }
        });
      }

      // OR conditions
      if (Array.isArray(filterConfig.any) && filterConfig.any.length > 0) {
        console.log("[DEBUG] Processing 'any' conditions:", filterConfig.any);

        filterConfig.any.forEach(function (cond) {
          console.log(`[DEBUG] Processing OR condition:`, cond);

          if (cond.entity) {
            // Entity is explicitly specified
            switch (cond.entity.toLowerCase()) {
              case "person":
                if (personFields.includes(cond.field)) {
                  if (!personWhere[Op.or]) personWhere[Op.or] = [];
                  personWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Person OR condition for field: ${cond.field}`
                  );
                }
                break;
              case "lead":
                if (leadFields.includes(cond.field)) {
                  if (!leadWhere[Op.or]) leadWhere[Op.or] = [];
                  leadWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Lead OR condition for field: ${cond.field}`
                  );
                }
                break;
              case "deal":
                if (dealFields.includes(cond.field)) {
                  if (!dealWhere[Op.or]) dealWhere[Op.or] = [];
                  dealWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Deal OR condition for field: ${cond.field}`
                  );
                }
                break;
              case "organization":
                if (organizationFields.includes(cond.field)) {
                  if (!organizationWhere[Op.or]) organizationWhere[Op.or] = [];
                  organizationWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Organization OR condition for field: ${cond.field}`
                  );
                }
                break;
              case "activity":
                if (activityFields.includes(cond.field)) {
                  if (!activityWhere[Op.or]) activityWhere[Op.or] = [];
                  activityWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Activity OR condition for field: ${cond.field}`
                  );
                }
                break;
              default:
                console.log(`[DEBUG] Unknown entity: ${cond.entity}`);
            }
          } else {
            // Auto-detect entity based on field name
            if (personFields.includes(cond.field)) {
              if (!personWhere[Op.or]) personWhere[Op.or] = [];
              personWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Person OR condition for field: ${cond.field}`
              );
            } else if (leadFields.includes(cond.field)) {
              if (!leadWhere[Op.or]) leadWhere[Op.or] = [];
              leadWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Lead OR condition for field: ${cond.field}`
              );
            } else if (dealFields.includes(cond.field)) {
              if (!dealWhere[Op.or]) dealWhere[Op.or] = [];
              dealWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Deal OR condition for field: ${cond.field}`
              );
            } else if (organizationFields.includes(cond.field)) {
              if (!organizationWhere[Op.or]) organizationWhere[Op.or] = [];
              organizationWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Organization OR condition for field: ${cond.field}`
              );
            } else if (activityFields.includes(cond.field)) {
              if (!activityWhere[Op.or]) activityWhere[Op.or] = [];
              activityWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Activity OR condition for field: ${cond.field}`
              );
            } else {
              console.log(
                `[DEBUG] Field '${cond.field}' not found in any entity`
              );
            }
          }
        });
      }
    } else if (orgSearch) {
      // Fallback to search logic if no filterConfig
      organizationWhere[Op.or] = [
        { organization: { [Op.like]: `%${orgSearch}%` } },
        { organizationLabels: { [Op.like]: `%${orgSearch}%` } },
        { address: { [Op.like]: `%${orgSearch}%` } },
      ];
    }

    // Debug: log all where clauses
    console.log("[DEBUG] Final where clauses:");
    console.log("- personWhere:", JSON.stringify(personWhere, null, 2));
    console.log("- leadWhere:", JSON.stringify(leadWhere, null, 2));
    console.log("- leadWhere keys:", Object.keys(leadWhere));
    console.log("- leadWhere[Op.and]:", leadWhere[Op.and]);
    console.log("- dealWhere:", JSON.stringify(dealWhere, null, 2));
    console.log(
      "- organizationWhere:",
      JSON.stringify(organizationWhere, null, 2)
    );
    console.log("- activityWhere:", JSON.stringify(activityWhere, null, 2));

    // Apply Lead filters to get relevant organization IDs
    let leadFilteredOrgIds = [];
    const hasLeadFilters =
      leadWhere[Op.and]?.length > 0 ||
      leadWhere[Op.or]?.length > 0 ||
      Object.keys(leadWhere).some((key) => typeof key === "string");

    if (hasLeadFilters) {
      console.log("[DEBUG] Applying Lead filters to find organizations");
      console.log("[DEBUG] leadWhere has filters:", {
        andConditions: leadWhere[Op.and]?.length || 0,
        orConditions: leadWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(leadWhere).filter(
          (key) => typeof key === "string"
        ),
      });

      let leadFilterResults = [];
      if (req.role === "admin") {
        leadFilterResults = await Lead.findAll({
          where: leadWhere,
          attributes: ["leadOrganizationId", "organization"],
          raw: true,
        });
      } else {
        leadFilterResults = await Lead.findAll({
          where: {
            ...leadWhere,
            [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
          },
          attributes: ["leadOrganizationId", "organization"],
          raw: true,
        });
      }

      console.log(
        "[DEBUG] Lead filter results:",
        leadFilterResults.length,
        "leads found"
      );

      // Get organization IDs from leads
      leadFilteredOrgIds = leadFilterResults
        .map((lead) => lead.leadOrganizationId)
        .filter(Boolean);

      // Also get organization names directly from leads that don't have leadOrganizationId but have organization name
      const leadOrgNames = leadFilterResults
        .map((lead) => lead.organization)
        .filter(Boolean);

      console.log("[DEBUG] Lead-filtered org IDs:", leadFilteredOrgIds);
      console.log("[DEBUG] Lead organization names:", leadOrgNames);

      // If we have organization names from leads, also find organizations by name
      if (leadOrgNames.length > 0) {
        const orgsByName = await Organization.findAll({
          where: {
            organization: { [Op.in]: leadOrgNames },
          },
          attributes: ["leadOrganizationId"],
          raw: true,
        });

        const additionalOrgIds = orgsByName.map(
          (org) => org.leadOrganizationId
        );
        leadFilteredOrgIds = [
          ...new Set([...leadFilteredOrgIds, ...additionalOrgIds]),
        ];

        console.log(
          "[DEBUG] Additional org IDs from lead org names:",
          additionalOrgIds
        );
        console.log(
          "[DEBUG] Combined lead-filtered org IDs:",
          leadFilteredOrgIds
        );
      }
    }

    // Apply Activity filters to get relevant organization IDs
    let activityFilteredOrgIds = [];
    const hasActivityFilters =
      activityWhere[Op.and]?.length > 0 ||
      activityWhere[Op.or]?.length > 0 ||
      Object.keys(activityWhere).some((key) => typeof key === "string");

    if (hasActivityFilters) {
      console.log("[DEBUG] Applying Activity filters to find organizations");
      console.log("[DEBUG] activityWhere has filters:", {
        andConditions: activityWhere[Op.and]?.length || 0,
        orConditions: activityWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(activityWhere).filter(
          (key) => typeof key === "string"
        ),
      });

      try {
        const Activity = require("../../models/activity/activityModel");
        let activityFilterResults = [];

        if (req.role === "admin") {
          activityFilterResults = await Activity.findAll({
            where: activityWhere,
            attributes: ["leadOrganizationId", "organization"],
            raw: true,
          });
        } else {
          activityFilterResults = await Activity.findAll({
            where: {
              ...activityWhere,
              [Op.or]: [
                { masterUserID: req.adminId },
                { assignedTo: req.adminId },
              ],
            },
            attributes: ["leadOrganizationId", "organization"],
            raw: true,
          });
        }

        console.log(
          "[DEBUG] Activity filter results:",
          activityFilterResults.length,
          "activities found"
        );

        // Get organization IDs from activities
        activityFilteredOrgIds = activityFilterResults
          .map((activity) => activity.leadOrganizationId)
          .filter(Boolean);

        // Also get organization names directly from activities that don't have leadOrganizationId but have organization name
        const activityOrgNames = activityFilterResults
          .map((activity) => activity.organization)
          .filter(Boolean);

        console.log(
          "[DEBUG] Activity-filtered org IDs:",
          activityFilteredOrgIds
        );
        console.log("[DEBUG] Activity organization names:", activityOrgNames);

        // If we have organization names from activities, also find organizations by name
        if (activityOrgNames.length > 0) {
          const orgsByName = await Organization.findAll({
            where: {
              organization: { [Op.in]: activityOrgNames },
            },
            attributes: ["leadOrganizationId"],
            raw: true,
          });

          const additionalOrgIds = orgsByName.map(
            (org) => org.leadOrganizationId
          );
          activityFilteredOrgIds = [
            ...new Set([...activityFilteredOrgIds, ...additionalOrgIds]),
          ];

          console.log(
            "[DEBUG] Additional org IDs from activity org names:",
            additionalOrgIds
          );
          console.log(
            "[DEBUG] Combined activity-filtered org IDs:",
            activityFilteredOrgIds
          );
        }
      } catch (e) {
        console.log("[DEBUG] Error applying Activity filters:", e.message);
      }
    }

    // Apply Person filters to get relevant organization IDs
    let personFilteredOrgIds = [];
    const hasPersonFilters =
      personWhere[Op.and]?.length > 0 ||
      personWhere[Op.or]?.length > 0 ||
      Object.keys(personWhere).some((key) => typeof key === "string");

    if (hasPersonFilters) {
      console.log("[DEBUG] Applying Person filters to find organizations");
      console.log("[DEBUG] personWhere has filters:", {
        andConditions: personWhere[Op.and]?.length || 0,
        orConditions: personWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(personWhere).filter(
          (key) => typeof key === "string"
        ),
      });

      let personFilterResults = [];
      if (req.role === "admin") {
        personFilterResults = await Person.findAll({
          where: personWhere,
          attributes: ["leadOrganizationId", "organization"],
          raw: true,
        });
      }else {
        personFilterResults = await Person.findAll({
          where: {
            ...personWhere,
            [Op.or]: [{ masterUserID: req.adminId }],
          },
          attributes: ["leadOrganizationId", "organization"],
          raw: true,
        });
      }

      console.log(
        "[DEBUG] Person filter results:",
        personFilterResults.length,
        "persons found"
      );

      // Get organization IDs from persons
      personFilteredOrgIds = personFilterResults
        .map((person) => person.leadOrganizationId)
        .filter(Boolean);

      // Also get organization names directly from persons that don't have leadOrganizationId but have organization name
      const personOrgNames = personFilterResults
        .map((person) => person.organization)
        .filter(Boolean);

      console.log("[DEBUG] Person-filtered org IDs:", personFilteredOrgIds);
      console.log("[DEBUG] Person organization names:", personOrgNames);

      // If we have organization names from persons, also find organizations by name
      if (personOrgNames.length > 0) {
        const orgsByName = await Organization.findAll({
          where: {
            organization: { [Op.in]: personOrgNames },
          },
          attributes: ["leadOrganizationId"],
          raw: true,
        });

        const additionalOrgIds = orgsByName.map(
          (org) => org.leadOrganizationId
        );
        personFilteredOrgIds = [
          ...new Set([...personFilteredOrgIds, ...additionalOrgIds]),
        ];

        console.log(
          "[DEBUG] Additional org IDs from person org names:",
          additionalOrgIds
        );
        console.log(
          "[DEBUG] Combined person-filtered org IDs:",
          personFilteredOrgIds
        );
      }
    }

    // Apply Deal filters to get relevant organization IDs
    let dealFilteredOrgIds = [];
    const hasDealFilters =
      dealWhere[Op.and]?.length > 0 ||
      dealWhere[Op.or]?.length > 0 ||
      Object.keys(dealWhere).some((key) => typeof key === "string");

    if (hasDealFilters) {
      console.log("[DEBUG] Applying Deal filters to find organizations");
      console.log("[DEBUG] dealWhere has filters:", {
        andConditions: dealWhere[Op.and]?.length || 0,
        orConditions: dealWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(dealWhere).filter(
          (key) => typeof key === "string"
        ),
      });

      let dealFilterResults = [];
      if (req.role === "admin") {
        dealFilterResults = await Deal.findAll({
          where: dealWhere,
          attributes: ["leadOrganizationId", "organization"],
          raw: true,
        });
      } else {
        dealFilterResults = await Deal.findAll({
          where: {
            ...dealWhere,
            [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
          },
          attributes: ["leadOrganizationId", "organization"],
          raw: true,
        });
      }

      console.log(
        "[DEBUG] Deal filter results:",
        dealFilterResults.length,
        "deals found"
      );

      // Get organization IDs from deals
      dealFilteredOrgIds = dealFilterResults
        .map((deal) => deal.leadOrganizationId)
        .filter(Boolean);

      // Also get organization names directly from deals that don't have leadOrganizationId but have organization name
      const dealOrgNames = dealFilterResults
        .map((deal) => deal.organization)
        .filter(Boolean);

      console.log("[DEBUG] Deal-filtered org IDs:", dealFilteredOrgIds);
      console.log("[DEBUG] Deal organization names:", dealOrgNames);

      // If we have organization names from deals, also find organizations by name
      if (dealOrgNames.length > 0) {
        const orgsByName = await Organization.findAll({
          where: {
            organization: { [Op.in]: dealOrgNames },
          },
          attributes: ["leadOrganizationId"],
          raw: true,
        });

        const additionalOrgIds = orgsByName.map(
          (org) => org.leadOrganizationId
        );
        dealFilteredOrgIds = [
          ...new Set([...dealFilteredOrgIds, ...additionalOrgIds]),
        ];

        console.log(
          "[DEBUG] Additional org IDs from deal org names:",
          additionalOrgIds
        );
        console.log(
          "[DEBUG] Combined deal-filtered org IDs:",
          dealFilteredOrgIds
        );
      }
    }

    // Apply Organization filters directly
    let orgFilteredOrgIds = [];
    const hasOrgFilters =
      organizationWhere[Op.and]?.length > 0 ||
      organizationWhere[Op.or]?.length > 0 ||
      Object.keys(organizationWhere).some((key) => typeof key === "string");

    if (hasOrgFilters) {
      console.log(
        "[DEBUG] Applying Organization filters to find organizations"
      );
      console.log("[DEBUG] organizationWhere has filters:", {
        andConditions: organizationWhere[Op.and]?.length || 0,
        orConditions: organizationWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(organizationWhere).filter(
          (key) => typeof key === "string"
        ),
      });

      let orgFilterResults = [];
      if (req.role === "admin" && !req.query.masterUserID) {
        orgFilterResults = await Organization.findAll({
          where: organizationWhere,
          attributes: ["leadOrganizationId"],
          raw: true,
        });
      }else if (req.query.masterUserID) {
        organizationWhere.masterUserID = req.query.masterUserID;
        orgFilterResults = await Organization.findAll({
          where:organizationWhere,
          attributes: ["leadOrganizationId"],
          raw: true,
        });
      }
      else {
        orgFilterResults = await Organization.findAll({
          where: {
            ...organizationWhere,
            [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
          },
          attributes: ["leadOrganizationId"],
          raw: true,
        });
      }

      console.log(
        "[DEBUG] Organization filter results:",
        orgFilterResults.length,
        "organizations found"
      );

      // Get organization IDs from organizations
      orgFilteredOrgIds = orgFilterResults
        .map((org) => org.leadOrganizationId)
        .filter(Boolean);

      console.log("[DEBUG] Organization-filtered org IDs:", orgFilteredOrgIds);
    }

    // Role-based filtering logic for organizations - same as getLeads API
    let orgWhere = orgSearch
      ? {
          [Op.or]: [
            { organization: { [Op.like]: `%${orgSearch}%` } },
            { organizationLabels: { [Op.like]: `%${orgSearch}%` } },
            { address: { [Op.like]: `%${orgSearch}%` } },
          ],
        }
      : {};

    // Merge organizationWhere from filters with orgWhere from search
    if (Object.keys(organizationWhere).length > 0) {
      orgWhere = { ...orgWhere, ...organizationWhere };
    }

    // Apply Lead, Activity, Person, Deal, and Organization filters by restricting to organizations found in those entities
    const allFilteredOrgIds = [
      ...new Set([
        ...leadFilteredOrgIds,
        ...activityFilteredOrgIds,
        ...personFilteredOrgIds,
        ...dealFilteredOrgIds,
        ...orgFilteredOrgIds,
      ]),
    ];

    if (allFilteredOrgIds.length > 0) {
      console.log(
        "[DEBUG] Applying combined filters: restricting to org IDs:",
        allFilteredOrgIds
      );
      console.log(
        "[DEBUG] - From leads:",
        leadFilteredOrgIds.length,
        "org IDs"
      );
      console.log(
        "[DEBUG] - From activities:",
        activityFilteredOrgIds.length,
        "org IDs"
      );
      console.log(
        "[DEBUG] - From persons:",
        personFilteredOrgIds.length,
        "org IDs"
      );
      console.log(
        "[DEBUG] - From deals:",
        dealFilteredOrgIds.length,
        "org IDs"
      );
      console.log(
        "[DEBUG] - From organizations:",
        orgFilteredOrgIds.length,
        "org IDs"
      );

      if (Object.keys(orgWhere).length > 0) {
        // Combine with existing filters using AND
        orgWhere = {
          [Op.and]: [
            orgWhere,
            { leadOrganizationId: { [Op.in]: allFilteredOrgIds } },
          ],
        };
      } else {
        // Only entity filters apply
        orgWhere = { leadOrganizationId: { [Op.in]: allFilteredOrgIds } };
      }
    } else if (
      hasLeadFilters ||
      hasActivityFilters ||
      hasPersonFilters ||
      hasDealFilters ||
      hasOrgFilters
    ) {
      // If entity filters were applied but no matching organizations found, return empty results
      console.log(
        "[DEBUG] Entity filters applied but no matching organizations found - returning empty results"
      );
      return res.status(200).json({
        totalRecords: 0,
        totalPages: 0,
        currentPage: orgPage,
        organizations: [],
      });
    }

    console.log("[DEBUG] Final orgWhere:", JSON.stringify(orgWhere, null, 2));

    // Fetch organizations using EXACT same logic as getLeads API
    let organizations = [];
    if (req.role === "admin") {
      organizations = await Organization.findAll({
        where: orgWhere,
        raw: true,
      });
    } else {
      organizations = await Organization.findAll({
        where: {
          ...orgWhere,
          [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
        },
        raw: true,
      });
    }

    console.log(
      "[DEBUG] Found",
      organizations.length,
      "organizations after filtering"
    );
    if (organizations.length > 0) {
      console.log(
        "[DEBUG] Sample organizations:",
        organizations.slice(0, 3).map((o) => ({
          id: o.leadOrganizationId,
          name: o.organization,
        }))
      );
    }

    const orgIds = organizations.map((o) => o.leadOrganizationId);

    // Merge personWhere from filters with role-based filtering - same as getLeads API
    let finalPersonWhere = { ...personWhere };

    // Fetch persons using EXACT same logic as getLeads API
    let persons = [];
    if (req.role === "admin") {
      persons = await Person.findAll({
        where: finalPersonWhere,
        raw: true,
      });
    } else {
      const roleBasedPersonFilter = {
        [Op.or]: [
          { masterUserID: req.adminId },
          { leadOrganizationId: orgIds },
        ],
      };

      // Merge filter conditions with role-based access control
      if (Object.keys(finalPersonWhere).length > 0) {
        finalPersonWhere = {
          [Op.and]: [finalPersonWhere, roleBasedPersonFilter],
        };
      } else {
        finalPersonWhere = roleBasedPersonFilter;
      }

      persons = await Person.findAll({
        where: finalPersonWhere,
        raw: true,
      });
    }

    // Build a map: { [leadOrganizationId]: [ { personId, contactPerson }, ... ] } - same as getLeads API
    const orgPersonsMap = {};
    persons.forEach((p) => {
      if (p.leadOrganizationId) {
        if (!orgPersonsMap[p.leadOrganizationId])
          orgPersonsMap[p.leadOrganizationId] = [];
        orgPersonsMap[p.leadOrganizationId].push({
          personId: p.personId,
          contactPerson: p.contactPerson,
        });
      }
    });

    // Get all unique ownerIds from persons and organizations - same as getLeads API
    const orgOwnerIds = organizations.map((o) => o.ownerId).filter(Boolean);
    const personOwnerIds = persons.map((p) => p.ownerId).filter(Boolean);
    const ownerIds = [...new Set([...orgOwnerIds, ...personOwnerIds])];

    // Fetch owner names from MasterUser - same as getLeads API
    const owners = await MasterUser.findAll({
      where: { masterUserID: ownerIds },
      attributes: ["masterUserID", "name"],
      raw: true,
    });
    const orgMap = {};
    organizations.forEach((org) => {
      orgMap[org.leadOrganizationId] = org;
    });
    const ownerMap = {};
    owners.forEach((o) => {
      ownerMap[o.masterUserID] = o.name;
    });

    // Add ownerName to organizations - same as getLeads API
    organizations = organizations.map((o) => ({
      ...o,
      ownerName: ownerMap[o.ownerId] || null,
    }));

    // Count leads for each organization - same as getLeads API
    const leadCounts = await Lead.findAll({
      attributes: [
        "personId",
        "leadOrganizationId",
        [Sequelize.fn("COUNT", Sequelize.col("leadId")), "leadCount"],
      ],
      where: {
        [Op.or]: [{ leadOrganizationId: orgIds }],
      },
      group: ["personId", "leadOrganizationId"],
      raw: true,
    });

    // Build maps for quick lookup
    const orgLeadCountMap = {};
    leadCounts.forEach((lc) => {
      if (lc.leadOrganizationId)
        orgLeadCountMap[lc.leadOrganizationId] = parseInt(lc.leadCount, 10);
    });

    // Add leadCount and persons array to organizations - EXACT same format as getLeads API
    organizations = organizations.map((o) => ({
      ...o,
      ownerName: ownerMap[o.ownerId] || null,
      leadCount: orgLeadCountMap[o.leadOrganizationId] || 0,
      persons: orgPersonsMap[o.leadOrganizationId] || [], // <-- same as getLeads API
    }));

    // Fetch custom field values for all organizations - same as getLeads API
    const orgIdsForCustomFields = organizations.map(
      (o) => o.leadOrganizationId
    );
    let orgCustomFieldValues = [];
    if (orgIdsForCustomFields.length > 0) {
      orgCustomFieldValues = await CustomFieldValue.findAll({
        where: {
          entityId: orgIdsForCustomFields,
          entityType: "organization",
        },
        raw: true,
      });
    }

    // Fetch all custom fields for organization entity
    const allOrgCustomFields = await CustomField.findAll({
      where: {
        entityType: { [Sequelize.Op.in]: ["organization", "both"] },
        isActive: true,
      },
      raw: true,
    });

    const orgCustomFieldIdToName = {};
    allOrgCustomFields.forEach((cf) => {
      orgCustomFieldIdToName[cf.fieldId] = cf.fieldName;
    });

    // Map orgId to their custom field values as { fieldName: value }
    const orgCustomFieldsMap = {};
    orgCustomFieldValues.forEach((cfv) => {
      const fieldName = orgCustomFieldIdToName[cfv.fieldId] || cfv.fieldId;
      if (!orgCustomFieldsMap[cfv.entityId])
        orgCustomFieldsMap[cfv.entityId] = {};
      orgCustomFieldsMap[cfv.entityId][fieldName] = cfv.value;
    });

    // Attach custom fields as direct properties to each organization - same as getLeads API
    organizations = organizations.map((o) => {
      const customFields = orgCustomFieldsMap[o.leadOrganizationId] || {};
      return { ...o, ...customFields };
    });

    // Return organizations in EXACT same format as getLeads API
    res.status(200).json({
      totalRecords: organizations.length,
      totalPages: Math.ceil(organizations.length / orgLimit),
      currentPage: orgPage,
      organizations: organizations, // Return organizations exactly as they are in getLeads API
    });
  } catch (error) {
    console.error("Error fetching organizations and persons:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const { Lead, LeadDetails, Person, Organization } = require("../../models");
const { Op } = require("sequelize");
const Sequelize = require("sequelize");
const Email = require("../../models/email/emailModel");
const LeadNote = require("../../models/leads/leadNoteModel");
const MasterUser = require("../../models/master/masterUserModel");
const Attachment = require("../../models/email/attachmentModel");
const OrganizationNote = require("../../models/leads/organizationNoteModel");
const PersonNote = require("../../models/leads/personNoteModel");
const Deal = require("../../models/deals/dealsModels");

exports.createPerson = async (req, res) => {
  try {
    const masterUserID = req.adminId;
    if (!req.body || !req.body.contactPerson || !req.body.email) {
      return res
        .status(400)
        .json({ message: "Contact person and email are required." });
    }
    const {
      contactPerson,
      email,
      phone,
      notes,
      postalAddress,
      birthday,
      jobTitle,
      personLabels,
      organization, // may be undefined or empty
      ...rest
    } = req.body;

    // Check for duplicate email (email must be unique across all persons)
    const existingEmailPerson = await Person.findOne({ where: { email } });
    if (existingEmailPerson) {
      return res.status(409).json({
        message: "A person with this email address already exists.",
        person: {
          personId: existingEmailPerson.personId,
          contactPerson: existingEmailPerson.contactPerson,
          email: existingEmailPerson.email,
          organization: existingEmailPerson.organization,
        },
      });
    }

    // Check for duplicate person in the same organization (or globally if no org)
    const whereClause = organization
      ? { contactPerson, organization }
      : { contactPerson, organization: null };

    const existingPerson = await Person.findOne({ where: whereClause });
    if (existingPerson) {
      return res.status(409).json({
        message:
          "Person already exists" +
          (organization ? " in this organization." : "."),
        person: existingPerson,
      });
    }

    let org = null;
    if (organization) {
      // Only create/find organization if provided
      [org] = await Organization.findOrCreate({
        where: { organization },
        defaults: { organization, masterUserID },
      });
    }

    // Get all person model fields
    const personFields = Object.keys(Person.rawAttributes);

    // Split custom fields from standard fields
    const customFields = {};
    for (const key in rest) {
      if (!personFields.includes(key)) {
        customFields[key] = rest[key];
      }
    }

    // Create the person
    const person = await Person.create({
      contactPerson,
      email,
      phone,
      notes,
      postalAddress,
      birthday,
      jobTitle,
      personLabels,
      organization: org ? org.organization : null,
      leadOrganizationId: org ? org.leadOrganizationId : null,
      masterUserID,
    });

    // Save custom fields if any
    const CustomField = require("../../models/customFieldModel");
    const CustomFieldValue = require("../../models/customFieldValueModel");
    for (const [fieldKey, value] of Object.entries(customFields)) {
      if (value === undefined || value === null || value === "") continue;
      // Find custom field by fieldId or fieldName
      let customField = await CustomField.findOne({
        where: {
          [Sequelize.Op.or]: [{ fieldId: fieldKey }, { fieldName: fieldKey }],
          entityType: { [Sequelize.Op.in]: ["person", "both"] },
          isActive: true,
        },
      });
      if (customField) {
        await CustomFieldValue.create({
          fieldId: customField.fieldId,
          entityId: person.personId,
          entityType: "person",
          value: value,
          masterUserID,
        });
      }
    }

    res.status(201).json({ message: "Person created successfully", person });
  } catch (error) {
    console.error("Error creating person:", error);

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

    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

exports.createOrganization = async (req, res) => {
  try {
    const masterUserID = req.adminId; // Get the master user ID from the request
    const ownerId = req.body.ownerId || masterUserID;
    if (!req.body || !req.body.organization) {
      return res
        .status(400)
        .json({ message: "Organization name is required." });
    }
    const { organization, organizationLabels, address, visibleTo, ...rest } =
      req.body;

    // Check if organization already exists
    const existingOrg = await Organization.findOne({ where: { organization } });
    if (existingOrg) {
      return res.status(409).json({
        message: "Organization already exists.",
        organization: existingOrg,
      });
    }

    // Get all organization model fields
    const orgFields = Object.keys(Organization.rawAttributes);

    // Split custom fields from standard fields
    const customFields = {};
    for (const key in rest) {
      if (!orgFields.includes(key)) {
        customFields[key] = rest[key];
      }
    }

    // Create the organization
    const org = await Organization.create({
      organization,
      organizationLabels,
      address,
      visibleTo,
      masterUserID,
      ownerId, // Set the owner ID if provided
    });

    // Save custom fields if any
    const CustomField = require("../../models/customFieldModel");
    const CustomFieldValue = require("../../models/customFieldValueModel");
    const Sequelize = require("sequelize");
    for (const [fieldKey, value] of Object.entries(customFields)) {
      if (value === undefined || value === null || value === "") continue;
      // Find custom field by fieldId or fieldName
      let customField = await CustomField.findOne({
        where: {
          [Sequelize.Op.or]: [{ fieldId: fieldKey }, { fieldName: fieldKey }],
          entityType: { [Sequelize.Op.in]: ["organization", "both"] },
          isActive: true,
        },
      });
      if (customField) {
        await CustomFieldValue.create({
          fieldId: customField.fieldId,
          entityId: org.leadOrganizationId,
          entityType: "organization",
          value: value,
          masterUserID,
        });
      }
    }

    res.status(201).json({
      message: "Organization created successfully",
      organization: org,
    });
  } catch (error) {
    console.error("Error creating organization:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getContactTimeline = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Search
    const search = req.query.search || "";
    const searchFilter = search
      ? {
          [Op.or]: [
            { contactPerson: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
            { phone: { [Op.like]: `%${search}%` } },
            { jobTitle: { [Op.like]: `%${search}%` } },
            { personLabels: { [Op.like]: `%${search}%` } },
            { organization: { [Op.like]: `%${search}%` } }, // Assuming organization is a field in Person
          ],
        }
      : {};

    // Date filter (monthsBack)
    const monthsBack = parseInt(req.query.monthsBack) || 3;
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - monthsBack);

    // Main query
    const { count, rows: persons } = await Person.findAndCountAll({
      where: {
        ...searchFilter,
        createdAt: { [Op.gte]: fromDate },
      },
      include: [
        {
          model: Organization,
          as: "LeadOrganization",
          attributes: ["leadOrganizationId", "organization"],
        },
      ],
      attributes: [
        "personId",
        "contactPerson",
        "email",
        "phone",
        "jobTitle",
        "personLabels",
        "leadOrganizationId",
        "createdAt",
      ],
      order: [["contactPerson", "ASC"]],
      limit,
      offset,
    });

    res.status(200).json({
      message: "Contact timeline fetched successfully",
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
      filter: { monthsBack, fromDate },
      search,
      persons,
    });
  } catch (error) {
    console.error("Error fetching contact timeline:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getPersonTimeline = async (req, res) => {
  const { personId } = req.params;

  // Email optimization parameters
  const { emailPage = 1, emailLimit = 10 } = req.query;
  const emailOffset = (parseInt(emailPage) - 1) * parseInt(emailLimit);
  const MAX_EMAIL_LIMIT = 50;
  const safeEmailLimit = Math.min(parseInt(emailLimit), MAX_EMAIL_LIMIT);

  try {
    const person = await Person.findByPk(personId, {
      include: [
        {
          model: Organization,
          as: "LeadOrganization",
          attributes: ["leadOrganizationId", "organization"],
        },
      ],
    });
    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }

    // Fetch related leads
    const leads = await Lead.findAll({ where: { personId } });
    const deals = await Deal.findAll({ where: { personId } });

    // Optimized email fetching with pagination and essential fields only
    const leadIds = leads.map((l) => l.leadId);

    // Get total email count first
    const totalEmailsCount = await Email.count({
      where: {
        [Op.or]: [
          ...(leadIds.length > 0 ? [{ leadId: leadIds }] : []),
          { sender: person.email },
          { recipient: { [Op.like]: `%${person.email}%` } },
        ],
      },
    });

    // Fetch emails with pagination and essential fields only
    const emailsByLead =
      leadIds.length > 0
        ? await Email.findAll({
            where: { leadId: leadIds },
            attributes: [
              "emailID",
              "messageId",
              "sender",
              "senderName",
              "recipient",
              "cc",
              "bcc",
              "subject",
              "createdAt",
              "folder",
              "isRead",
              "leadId",
              "dealId",
            ],
            order: [["createdAt", "DESC"]],
            limit: Math.ceil(safeEmailLimit / 2),
            offset: Math.floor(emailOffset / 2),
          })
        : [];

    // Fetch emails where person's email is sender or recipient
    const emailsByAddress = await Email.findAll({
      where: {
        [Op.or]: [
          { sender: person.email },
          { recipient: { [Op.like]: `%${person.email}%` } },
        ],
      },
      attributes: [
        "emailID",
        "messageId",
        "sender",
        "senderName",
        "recipient",
        "cc",
        "bcc",
        "subject",
        "createdAt",
        "folder",
        "isRead",
        "leadId",
        "dealId",
      ],
      order: [["createdAt", "DESC"]],
      limit: Math.ceil(safeEmailLimit / 2),
      offset: Math.floor(emailOffset / 2),
    });

    // Merge and deduplicate emails
    const allEmailsMap = new Map();
    emailsByLead.forEach((email) => allEmailsMap.set(email.emailID, email));
    emailsByAddress.forEach((email) => allEmailsMap.set(email.emailID, email));
    const allEmails = Array.from(allEmailsMap.values());

    // Limit final email results and add optimization metadata
    const limitedEmails = allEmails.slice(0, safeEmailLimit);

    // Process emails for optimization
    const optimizedEmails = limitedEmails.map((email) => {
      const emailData = email.toJSON();

      // Truncate email body if present (for memory optimization)
      if (emailData.body) {
        emailData.body =
          emailData.body.length > 1000
            ? emailData.body.substring(0, 1000) + "... [truncated]"
            : emailData.body;
      }

      return emailData;
    });

    // Optimized file/attachment fetching with size limits
    const emailIDs = limitedEmails.map((email) => email.emailID);
    let files = [];
    if (emailIDs.length > 0) {
      files = await Attachment.findAll({
        where: { emailID: emailIDs },
        attributes: [
          "attachmentID",
          "emailID",
          "filename",
          "contentType",
          "size",
          "filePath",
          "createdAt",
        ],
        order: [["createdAt", "DESC"]],
        limit: 20, // Limit attachments to prevent large responses
      });

      // Build a map for quick email lookup
      const emailMap = new Map();
      limitedEmails.forEach((email) => emailMap.set(email.emailID, email));

      // Combine each attachment with minimal email data
      files = files.map((file) => {
        const email = emailMap.get(file.emailID);
        return {
          ...file.toJSON(),
          email: email
            ? {
                emailID: email.emailID,
                subject: email.subject,
                createdAt: email.createdAt,
                sender: email.sender,
                senderName: email.senderName,
              }
            : null,
        };
      });
    }

    // Fetch related notes
    const notes = await LeadNote.findAll({
      where: { leadId: leadIds },
      limit: 20, // Limit notes to prevent large responses
      order: [["createdAt", "DESC"]],
    });

    console.log(
      `Person timeline: ${optimizedEmails.length} emails, ${files.length} files, ${notes.length} notes`
    );

    res.status(200).json({
      person,
      leads,
      deals,
      emails: optimizedEmails,
      notes,
      files,
      // Add metadata for debugging and pagination (maintaining response structure)
      _emailMetadata: {
        totalEmails: totalEmailsCount,
        returnedEmails: optimizedEmails.length,
        emailPage: parseInt(emailPage),
        emailLimit: safeEmailLimit,
        hasMoreEmails: totalEmailsCount > emailOffset + optimizedEmails.length,
        truncatedBodies: optimizedEmails.some(
          (e) => e.body && e.body.includes("[truncated]")
        ),
      },
    });
  } catch (error) {
    console.error("Error fetching person timeline:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getOrganizationTimeline = async (req, res) => {
  const { organizationId } = req.params;

  // Email optimization parameters
  const { emailPage = 1, emailLimit = 10 } = req.query;
  const emailOffset = (parseInt(emailPage) - 1) * parseInt(emailLimit);
  const MAX_EMAIL_LIMIT = 50;
  const safeEmailLimit = Math.min(parseInt(emailLimit), MAX_EMAIL_LIMIT);

  try {
    // Fetch the organization
    const organization = await Organization.findByPk(organizationId);
    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Fetch all persons in this organization
    const persons = await Person.findAll({
      where: { leadOrganizationId: organizationId },
    });
    // Add array of { personId, contactPerson } to organization object
    organization.dataValues.persons = persons.map((p) => ({
      personId: p.personId,
      contactPerson: p.contactPerson,
    }));

    // Fetch all leads for this organization (directly or via persons)
    const personIds = persons.map((p) => p.personId);
    const leads = await Lead.findAll({
      where: {
        [Op.or]: [
          { leadOrganizationId: organizationId },
          { personId: personIds },
        ],
      },
    });

    // Fetch all deals for this organization
    const deals = await Deal.findAll({
      where: { leadOrganizationId: organizationId },
    });

    // Optimized email fetching with pagination
    const leadIds = leads.map((l) => l.leadId);
    const personEmails = persons.map((p) => p.email).filter(Boolean);

    // Get total email count first
    const emailWhereConditions = [
      ...(leadIds.length > 0 ? [{ leadId: leadIds }] : []),
      ...(personEmails.length > 0
        ? [
            { sender: { [Op.in]: personEmails } },
            {
              recipient: {
                [Op.or]: personEmails.map((email) => ({
                  [Op.like]: `%${email}%`,
                })),
              },
            },
          ]
        : []),
    ];

    const totalEmailsCount =
      emailWhereConditions.length > 0
        ? await Email.count({
            where: { [Op.or]: emailWhereConditions },
          })
        : 0;

    // Fetch emails with pagination and essential fields only
    const emailsByLead =
      leadIds.length > 0
        ? await Email.findAll({
            where: { leadId: leadIds },
            attributes: [
              "emailID",
              "messageId",
              "sender",
              "senderName",
              "recipient",
              "cc",
              "bcc",
              "subject",
              "createdAt",
              "folder",
              "isRead",
              "leadId",
              "dealId",
            ],
            order: [["createdAt", "DESC"]],
            limit: Math.ceil(safeEmailLimit / 2),
            offset: Math.floor(emailOffset / 2),
          })
        : [];

    // Fetch emails where any person's email is sender or recipient
    let emailsByAddress = [];
    if (personEmails.length > 0) {
      emailsByAddress = await Email.findAll({
        where: {
          [Op.or]: [
            { sender: { [Op.in]: personEmails } },
            {
              recipient: {
                [Op.or]: personEmails.map((email) => ({
                  [Op.like]: `%${email}%`,
                })),
              },
            },
          ],
        },
        attributes: [
          "emailID",
          "messageId",
          "sender",
          "senderName",
          "recipient",
          "cc",
          "bcc",
          "subject",
          "createdAt",
          "folder",
          "isRead",
          "leadId",
          "dealId",
        ],
        order: [["createdAt", "DESC"]],
        limit: Math.ceil(safeEmailLimit / 2),
        offset: Math.floor(emailOffset / 2),
      });
    }

    // Merge and deduplicate emails by emailID
    const allEmailsMap = new Map();
    emailsByLead.forEach((email) => allEmailsMap.set(email.emailID, email));
    emailsByAddress.forEach((email) => allEmailsMap.set(email.emailID, email));
    const allEmails = Array.from(allEmailsMap.values());

    // Limit final email results and add optimization metadata
    const limitedEmails = allEmails.slice(0, safeEmailLimit);

    // Process emails for optimization
    const optimizedEmails = limitedEmails.map((email) => {
      const emailData = email.toJSON();

      // Truncate email body if present (for memory optimization)
      if (emailData.body) {
        emailData.body =
          emailData.body.length > 1000
            ? emailData.body.substring(0, 1000) + "... [truncated]"
            : emailData.body;
      }

      return emailData;
    });

    // Optimized file/attachment fetching with size limits
    const emailIDs = limitedEmails.map((email) => email.emailID);
    let files = [];
    if (emailIDs.length > 0) {
      files = await Attachment.findAll({
        where: { emailID: emailIDs },
        attributes: [
          "attachmentID",
          "emailID",
          "filename",
          "contentType",
          "size",
          "filePath",
          "createdAt",
        ],
        order: [["createdAt", "DESC"]],
        limit: 20, // Limit attachments to prevent large responses
      });

      // Build a map for quick email lookup
      const emailMap = new Map();
      limitedEmails.forEach((email) => emailMap.set(email.emailID, email));

      // Combine each attachment with minimal email data
      files = files.map((file) => {
        const email = emailMap.get(file.emailID);
        return {
          ...file.toJSON(),
          email: email
            ? {
                emailID: email.emailID,
                subject: email.subject,
                createdAt: email.createdAt,
                sender: email.sender,
                senderName: email.senderName,
              }
            : null,
        };
      });
    }

    // Fetch all notes linked to these leads with limit
    const notes = await LeadNote.findAll({
      where: { leadId: leadIds },
      limit: 20, // Limit notes to prevent large responses
      order: [["createdAt", "DESC"]],
    });

    console.log(
      `Organization timeline: ${optimizedEmails.length} emails, ${files.length} files, ${notes.length} notes`
    );

    res.status(200).json({
      organization,
      persons,
      leads,
      deals,
      emails: optimizedEmails,
      notes,
      files, // Attachments with related email data
      // Add metadata for debugging and pagination (maintaining response structure)
      _emailMetadata: {
        totalEmails: totalEmailsCount,
        returnedEmails: optimizedEmails.length,
        emailPage: parseInt(emailPage),
        emailLimit: safeEmailLimit,
        hasMoreEmails: totalEmailsCount > emailOffset + optimizedEmails.length,
        truncatedBodies: optimizedEmails.some(
          (e) => e.body && e.body.includes("[truncated]")
        ),
      },
    });
  } catch (error) {
    console.error("Error fetching organization timeline:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getPersonFields = async (req, res) => {
  try {
    // You can customize or fetch this list from your model or config if needed
    const fields = [
      { value: "contactPerson", label: "Name" },
      // { key: "firstName", label: "First name" },
      // { key: "lastName", label: "Last name" },
      { value: "email", label: "Email" },
      { value: "phone", label: "Phone" },
      { value: "jobTitle", label: "Job title" },
      { value: "birthday", label: "Birthday" },
      { value: "personLabels", label: "Labels" },
      { value: "organization", label: "Organization" },
      // { value: "owner", label: "Owner" },
      // { value: "notes", label: "Notes" },
      { value: "postalAddress", label: "Postal address" },
      // { value: "postalAddressDetails", label: "Postal address (details)" },
      // { value: "visibleTo", label: "Visible to" },
      { value: "createdAt", label: "Person created" },
      { value: "updatedAt", label: "Update time" },
      // { key: "activitiesToDo", label: "Activities to do" },
      // { key: "doneActivities", label: "Done activities" },
      // { key: "closedDeals", label: "Closed deals" },
      // { key: "openDeals", label: "Open deals" },
      // { key: "wonDeals", label: "Won deals" },
      // { key: "lostDeals", label: "Lost deals" },
      // { key: "totalActivities", label: "Total activities" },
      // { key: "lastActivityDate", label: "Last activity date" },
      // { key: "nextActivityDate", label: "Next activity date" },
      // { key: "lastEmailReceived", label: "Last email received" },
      // { key: "lastEmailSent", label: "Last email sent" },
      // { key: "emailMessagesCount", label: "Email messages count" },
      // { key: "instantMessenger", label: "Instant messenger" },
    ];
    res.status(200).json({ fields });
  } catch (error) {
    console.error("Error fetching person fields:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getOrganizationFields = async (req, res) => {
  try {
    const fields = [
      { value: "organization", label: "Organization name" },
      { value: "organizationLabels", label: "Labels" },
      { value: "address", label: "Address" },
      // { value: "addressDetails", label: "Address (details)" },
      // { value: "visibleTo", label: "Visible to" },
      { value: "createdAt", label: "Organization created" },
      { value: "updatedAt", label: "Update time" },
      { value: "ownerId", label: "Owner" },
      // { key: "people", label: "People" },
      // { key: "notes", label: "Notes" },
      // { key: "activitiesToDo", label: "Activities to do" },
      // { key: "doneActivities", label: "Done activities" },
      // { key: "closedDeals", label: "Closed deals" },
      // { key: "openDeals", label: "Open deals" },
      // { key: "wonDeals", label: "Won deals" },
      // { key: "lostDeals", label: "Lost deals" },
      // { key: "totalActivities", label: "Total activities" },
      // { key: "lastActivityDate", label: "Last activity date" },
      // { key: "nextActivityDate", label: "Next activity date" },
      // { key: "lastEmailReceived", label: "Last email received" },
      // { key: "lastEmailSent", label: "Last email sent" },
      // { key: "emailMessagesCount", label: "Email messages count" },
    ];
    res.status(200).json({ fields });
  } catch (error) {
    console.error("Error fetching organization fields:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.updateOrganization = async (req, res) => {
  try {
    const { leadOrganizationId } = req.params; // Use leadOrganizationId from params
    const updateFields = req.body;

    // Find the organization by leadOrganizationId
    const org = await Organization.findByPk(leadOrganizationId);
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Update all fields provided in req.body
    await org.update(updateFields);

    res.status(200).json({
      message: "Organization updated successfully",
      organization: org,
    });
  } catch (error) {
    console.error("Error updating organization:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.updatePerson = async (req, res) => {
  try {
    const { personId } = req.params;
    const updateFields = req.body;

    // Find the person
    const person = await Person.findByPk(personId);
    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }

    // If ownerId is being updated, also update it in the related organization
    if (updateFields.ownerId && person.leadOrganizationId) {
      const org = await Organization.findByPk(person.leadOrganizationId);
      if (org) {
        await org.update({ ownerId: updateFields.ownerId });
      }
    }

    // Update all fields provided in req.body for the person
    await person.update(updateFields);

    // Fetch ownerName via organization.ownerId and MasterUser
    let ownerName = null;
    if (person.leadOrganizationId) {
      const org = await Organization.findByPk(person.leadOrganizationId);
      if (org && org.ownerId) {
        const owner = await MasterUser.findByPk(org.ownerId);
        if (owner) {
          ownerName = owner.name;
        }
      }
    }

    res.status(200).json({
      message: "Person updated successfully",
      person: { ...person.toJSON(), ownerName },
    });
  } catch (error) {
    console.error("Error updating person:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.linkPersonToOrganization = async (req, res) => {
  const { personId, leadOrganizationId } = req.body;
  try {
    const person = await Person.findByPk(personId);
    if (!person) return res.status(404).json({ message: "Person not found" });

    if (
      person.leadOrganizationId &&
      person.leadOrganizationId !== leadOrganizationId
    ) {
      return res.status(400).json({
        message: "Person is already linked to another organization.",
        currentOrganizationId: person.leadOrganizationId,
      });
    }

    // Fetch the organization name
    const organization = await Organization.findByPk(leadOrganizationId);
    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    person.leadOrganizationId = leadOrganizationId;
    person.organization = organization.organization; // Update the organization column
    await person.save();

    res.status(200).json({
      message: "Person linked to organization",
      person,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.addPersonNote = async (req, res) => {
  const { personId } = req.params; // Get personId from params
  if (!personId) {
    return res.status(400).json({ message: "Person ID is required." });
  }
  const { content } = req.body;
  if (!content || content.trim() === "") {
    return res.status(400).json({ message: "Note content is required." });
  }
  try {
    // Verify person exists
    const person = await Person.findByPk(personId);
    if (!person) {
      return res.status(404).json({ message: "Person not found." });
    }

    const note = await PersonNote.create({
      personId,
      masterUserID: req.adminId,
      content: content.trim(),
      createdBy: req.adminId,
    });

    // Fetch the created note with creator details
    const noteWithCreator = await PersonNote.findByPk(note.noteId, {
      include: [
        {
          model: MasterUser,
          as: "creator",
          attributes: ["masterUserID", "name"],
        },
      ],
    });

    res.status(201).json({
      message: "Note added to person successfully",
      note: noteWithCreator,
    });
  } catch (error) {
    console.error("Error adding person note:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.addOrganizationNote = async (req, res) => {
  const { leadOrganizationId } = req.params; // Get leadOrganizationId from params
  if (!leadOrganizationId) {
    return res.status(400).json({ message: "Organization ID is required." });
  }
  const { content } = req.body;
  if (!content || content.trim() === "") {
    return res.status(400).json({ message: "Note content is required." });
  }
  try {
    // Verify organization exists
    const organization = await Organization.findByPk(leadOrganizationId);
    if (!organization) {
      return res.status(404).json({ message: "Organization not found." });
    }

    const note = await OrganizationNote.create({
      leadOrganizationId,
      masterUserID: req.adminId,
      content: content.trim(),
      createdBy: req.adminId,
    });

    // Fetch the created note with creator details
    const noteWithCreator = await OrganizationNote.findByPk(note.noteId, {
      include: [
        {
          model: MasterUser,
          as: "creator",
          attributes: ["masterUserID", "name"],
        },
      ],
    });

    res.status(201).json({
      message: "Note added to organization successfully",
      note: noteWithCreator,
    });
  } catch (error) {
    console.error("Error adding organization note:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all notes for a person
exports.getPersonNotes = async (req, res) => {
  const { personId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    // Verify person exists
    const person = await Person.findByPk(personId);
    if (!person) {
      return res.status(404).json({ message: "Person not found." });
    }

    const { count, rows: notes } = await PersonNote.findAndCountAll({
      where: { personId },
      include: [
        {
          model: MasterUser,
          as: "creator",
          attributes: ["masterUserID", "name"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset,
    });

    res.status(200).json({
      message: "Person notes fetched successfully",
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
      notes,
    });
  } catch (error) {
    console.error("Error fetching person notes:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all notes for an organization
exports.getOrganizationNotes = async (req, res) => {
  const { leadOrganizationId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    // Verify organization exists
    const organization = await Organization.findByPk(leadOrganizationId);
    if (!organization) {
      return res.status(404).json({ message: "Organization not found." });
    }

    const { count, rows: notes } = await OrganizationNote.findAndCountAll({
      where: { leadOrganizationId },
      include: [
        {
          model: MasterUser,
          as: "creator",
          attributes: ["masterUserID", "name"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset,
    });

    res.status(200).json({
      message: "Organization notes fetched successfully",
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
      notes,
    });
  } catch (error) {
    console.error("Error fetching organization notes:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update a person note
exports.updatePersonNote = async (req, res) => {
  const { personId, noteId } = req.params;
  const { content } = req.body;

  if (!content || content.trim() === "") {
    return res.status(400).json({ message: "Note content is required." });
  }

  try {
    // Find the note
    const note = await PersonNote.findOne({
      where: { noteId, personId },
    });

    if (!note) {
      return res.status(404).json({ message: "Note not found." });
    }

    // Check if user has permission to update (only creator or admin)
    if (note.createdBy !== req.adminId && req.role !== "admin") {
      return res
        .status(403)
        .json({ message: "You don't have permission to update this note." });
    }

    // Update the note
    await note.update({ content: content.trim() });

    // Fetch updated note with creator details
    const updatedNote = await PersonNote.findByPk(noteId, {
      include: [
        {
          model: MasterUser,
          as: "creator",
          attributes: ["masterUserID", "name"],
        },
      ],
    });

    res.status(200).json({
      message: "Person note updated successfully",
      note: updatedNote,
    });
  } catch (error) {
    console.error("Error updating person note:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update an organization note
exports.updateOrganizationNote = async (req, res) => {
  const { leadOrganizationId, noteId } = req.params;
  const { content } = req.body;

  if (!content || content.trim() === "") {
    return res.status(400).json({ message: "Note content is required." });
  }

  try {
    // Find the note
    const note = await OrganizationNote.findOne({
      where: { noteId, leadOrganizationId },
    });

    if (!note) {
      return res.status(404).json({ message: "Note not found." });
    }

    // Check if user has permission to update (only creator or admin)
    if (note.createdBy !== req.adminId && req.role !== "admin") {
      return res
        .status(403)
        .json({ message: "You don't have permission to update this note." });
    }

    // Update the note
    await note.update({ content: content.trim() });

    // Fetch updated note with creator details
    const updatedNote = await OrganizationNote.findByPk(noteId, {
      include: [
        {
          model: MasterUser,
          as: "creator",
          attributes: ["masterUserID", "name"],
        },
      ],
    });

    res.status(200).json({
      message: "Organization note updated successfully",
      note: updatedNote,
    });
  } catch (error) {
    console.error("Error updating organization note:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a person note
exports.deletePersonNote = async (req, res) => {
  const { personId, noteId } = req.params;

  try {
    // Find the note
    const note = await PersonNote.findOne({
      where: { noteId, personId },
    });

    if (!note) {
      return res.status(404).json({ message: "Note not found." });
    }

    // Check if user has permission to delete (only creator or admin)
    if (note.createdBy !== req.adminId && req.role !== "admin") {
      return res
        .status(403)
        .json({ message: "You don't have permission to delete this note." });
    }

    // Delete the note
    await note.destroy();

    res.status(200).json({
      message: "Person note deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting person note:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete an organization note
exports.deleteOrganizationNote = async (req, res) => {
  const { leadOrganizationId, noteId } = req.params;

  try {
    // Find the note
    const note = await OrganizationNote.findOne({
      where: { noteId, leadOrganizationId },
    });

    if (!note) {
      return res.status(404).json({ message: "Note not found." });
    }

    // Check if user has permission to delete (only creator or admin)
    if (note.createdBy !== req.adminId && req.role !== "admin") {
      return res
        .status(403)
        .json({ message: "You don't have permission to delete this note." });
    }

    // Delete the note
    await note.destroy();

    res.status(200).json({
      message: "Organization note deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting organization note:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// exports.getAllContactPersons = async (req, res) => {
//   try {
//     const { search = "" } = req.query;

//     const where = search
//       ? { contactPerson: { [Op.like]: `%${search}%` } }
//       : {};

//     const persons = await Person.findAll({
//       where,
//       attributes: ["personId", "contactPerson", "email"],
//       order: [["contactPerson", "ASC"]],
//       raw: true
//     });

//     res.status(200).json({
//       contactPersons: persons // Array of { personId, contactPerson }
//     });
//   } catch (error) {
//     console.error("Error fetching contact persons:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

exports.getAllContactPersons = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = search ? { contactPerson: { [Op.like]: `%${search}%` } } : {};

    // Include organization using association
    const { count, rows: persons } = await Person.findAndCountAll({
      where,
      attributes: ["personId", "contactPerson", "email", "leadOrganizationId"],
      include: [
        {
          model: Organization,
          as: "LeadOrganization", // Make sure this matches your association
          attributes: ["leadOrganizationId", "organization"],
        },
      ],
      order: [["contactPerson", "ASC"]],
      limit: parseInt(limit),
      offset,
    });

    // Format response to include organization info at top level
    const contactPersons = persons.map((person) => ({
      personId: person.personId,
      contactPerson: person.contactPerson,
      email: person.email,
      organization: person.LeadOrganization
        ? {
            leadOrganizationId: person.LeadOrganization.leadOrganizationId,
            organization: person.LeadOrganization.organization,
          }
        : null,
    }));

    res.status(200).json({
      contactPersons,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching contact persons:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getPersonsByOrganization = async (req, res) => {
  const { leadOrganizationId } = req.params;
  try {
    // Find the organization
    const organization = await Organization.findByPk(leadOrganizationId);
    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Find all persons linked to this organization
    const persons = await Person.findAll({
      where: { leadOrganizationId },
      attributes: [
        "personId",
        "contactPerson",
        "email",
        "phone",
        "jobTitle",
        "personLabels",
        "organization",
      ],
      order: [["contactPerson", "ASC"]],
    });

    // Fetch ownerName from MasterUser using organization.ownerId
    let ownerName = null;
    if (organization.ownerId) {
      const owner = await MasterUser.findByPk(organization.ownerId);
      if (owner) {
        ownerName = owner.name;
      }
    }

    // Add ownerName to each person object
    const personsWithOwner = persons.map((person) => ({
      ...person.toJSON(),
      ownerName,
    }));

    res.status(200).json({
      organization: organization.organization,
      persons: personsWithOwner,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getPersonsAndOrganizations = async (req, res) => {
  try {
    // Import required models at the beginning of the function
    const { Lead, LeadDetails, Person, Organization } = require("../../models");
    const Deal = require("../../models/deals/dealsModels");
    const MasterUser = require("../../models/master/masterUserModel");
    // const CustomField = require("../../models/customFieldModel");
    // const CustomFieldValue = require("../../models/customFieldValueModel");
    const { Op } = require("sequelize");
    const Sequelize = require("sequelize");

    // Pagination and search for persons
    const personPage = parseInt(req.query.personPage) || 1;
    const personLimit = parseInt(req.query.personLimit) || 20;
    const personOffset = (personPage - 1) * personLimit;
    const personSearch = req.query.personSearch || "";

    // Pagination and search for organizations
    const orgPage = parseInt(req.query.orgPage) || 1;
    const orgLimit = parseInt(req.query.orgLimit) || 20;
    const orgOffset = (orgPage - 1) * orgLimit;
    const orgSearch = req.query.orgSearch || "";

    // Dynamic filter config (from body or query) -- now supports filterId as number or object
    const LeadFilter = require("../../models/leads/leadFiltersModel");
    let filterConfig = null;
    let filterIdRaw = null;
    if (req.body && req.body.filterId !== undefined) {
      filterIdRaw = req.body.filterId;
    } else if (req.query && req.query.filterId !== undefined) {
      filterIdRaw = req.query.filterId;
    }

    // If filterIdRaw is a number, fetch filterConfig from DB
    if (filterIdRaw !== null && filterIdRaw !== undefined) {
      if (typeof filterIdRaw === "string" && /^\d+$/.test(filterIdRaw)) {
        // filterIdRaw is a string number
        const filterRow = await LeadFilter.findByPk(parseInt(filterIdRaw));
        if (filterRow && filterRow.filterConfig) {
          // Parse the filterConfig if it's a JSON string from database
          if (typeof filterRow.filterConfig === "string") {
            try {
              filterConfig = JSON.parse(filterRow.filterConfig);
              console.log(
                "[DEBUG] Parsed filterConfig from DB string:",
                JSON.stringify(filterConfig, null, 2)
              );
            } catch (e) {
              console.log(
                "[DEBUG] Error parsing filterConfig string from DB:",
                e.message
              );
              filterConfig = null;
            }
          } else {
            filterConfig = filterRow.filterConfig;
          }
        }
      } else if (typeof filterIdRaw === "number") {
        const filterRow = await LeadFilter.findByPk(filterIdRaw);
        if (filterRow && filterRow.filterConfig) {
          // Parse the filterConfig if it's a JSON string from database
          if (typeof filterRow.filterConfig === "string") {
            try {
              filterConfig = JSON.parse(filterRow.filterConfig);
              console.log(
                "[DEBUG] Parsed filterConfig from DB string:",
                JSON.stringify(filterConfig, null, 2)
              );
            } catch (e) {
              console.log(
                "[DEBUG] Error parsing filterConfig string from DB:",
                e.message
              );
              filterConfig = null;
            }
          } else {
            filterConfig = filterRow.filterConfig;
          }
        }
      } else {
        // Try to parse as JSON object
        try {
          filterConfig =
            typeof filterIdRaw === "string"
              ? JSON.parse(filterIdRaw)
              : filterIdRaw;
        } catch (e) {
          filterConfig = null;
        }
      }
    }

    let personWhere = {};
    let leadWhere = {};
    let dealWhere = {};
    let organizationWhere = {};
    let activityWhere = {};
    // Debug: print filterConfig
    console.log("[DEBUG] filterConfig:", JSON.stringify(filterConfig, null, 2));
    const ops = {
      eq: Op.eq,
      ne: Op.ne,
      like: Op.like,
      notLike: Op.notLike,
      gt: Op.gt,
      gte: Op.gte,
      lt: Op.lt,
      lte: Op.lte,
      in: Op.in,
      notIn: Op.notIn,
      is: Op.eq,
      isNot: Op.ne,
      isEmpty: Op.is,
      isNotEmpty: Op.not,
      between: Op.between,
      notBetween: Op.notBetween,
    };
    const operatorMap = {
      is: "eq",
      "is not": "ne",
      "is empty": "isEmpty",
      "is not empty": "isNotEmpty",
      contains: "like",
      "does not contain": "notLike",
      "is exactly or earlier than": "lte",
      "is earlier than": "lt",
      "is exactly or later than": "gte",
      "not equals": "ne",
      "greater than": "gt",
      "greater than or equal": "gte",
      "less than": "lt",
      "less than or equal": "lte",
    };

    // Helper function to build a single condition - following the pattern from other APIs
    function buildCondition(cond) {
      console.log(
        "[DEBUG] buildCondition called with:",
        JSON.stringify(cond, null, 2)
      );

      const ops = {
        eq: Op.eq,
        ne: Op.ne,
        like: Op.like,
        notLike: Op.notLike,
        gt: Op.gt,
        gte: Op.gte,
        lt: Op.lt,
        lte: Op.lte,
        in: Op.in,
        notIn: Op.notIn,
        is: Op.eq,
        isNot: Op.ne,
        isEmpty: Op.is,
        isNotEmpty: Op.not,
        between: Op.between,
        notBetween: Op.notBetween,
      };

      let operator = cond.operator;
      console.log("[DEBUG] Original operator:", operator);

      if (operatorMap[operator]) {
        operator = operatorMap[operator];
        console.log("[DEBUG] Mapped operator:", operator);
      }

      // Handle "is empty" and "is not empty"
      if (operator === "isEmpty" || operator === "is empty") {
        const result = { [cond.field]: { [Op.is]: null } };
        console.log(
          "[DEBUG] isEmpty condition result:",
          JSON.stringify(result, null, 2)
        );
        return result;
      }
      if (operator === "isNotEmpty" || operator === "is not empty") {
        const result = {
          [Op.and]: [
            { [cond.field]: { [Op.not]: null } },
            { [cond.field]: { [Op.ne]: "" } },
          ],
        };
        console.log(
          "[DEBUG] isNotEmpty condition result:",
          JSON.stringify(result, null, 2)
        );
        return result;
      }

      // Handle "contains" and "does not contain" for text fields
      if (operator === "like" || operator === "contains") {
        const result = { [cond.field]: { [Op.like]: `%${cond.value}%` } };
        console.log(
          "[DEBUG] like condition result:",
          JSON.stringify(result, null, 2)
        );
        return result;
      }
      if (operator === "notLike" || operator === "does not contain") {
        const result = { [cond.field]: { [Op.notLike]: `%${cond.value}%` } };
        console.log(
          "[DEBUG] notLike condition result:",
          JSON.stringify(result, null, 2)
        );
        return result;
      }

      // Handle "is" operator for exact match
      if (operator === "is" || operator === "eq") {
        const result = { [cond.field]: cond.value };
        console.log(
          "[DEBUG] is/eq condition result:",
          JSON.stringify(result, null, 2)
        );
        return result;
      }

      // Default condition
      const finalOperator = ops[operator] || Op.eq;
      console.log("[DEBUG] Final operator symbol:", finalOperator);
      console.log("[DEBUG] Condition value:", cond.value);
      console.log("[DEBUG] Condition field:", cond.field);

      const result = {
        [cond.field]: {
          [finalOperator]: cond.value,
        },
      };
      console.log(
        "[DEBUG] Default condition result:",
        JSON.stringify(result, null, 2)
      );

      // Additional validation
      if (cond.value === undefined || cond.value === null) {
        console.log("[DEBUG] WARNING: cond.value is undefined or null!");
        console.log(
          "[DEBUG] Full condition object:",
          JSON.stringify(cond, null, 2)
        );
      }

      return result;
    }

    // Get model field names for validation
    const personFields = Object.keys(Person.rawAttributes);
    const leadFields = Object.keys(Lead.rawAttributes);
    const dealFields = Object.keys(Deal.rawAttributes);
    const organizationFields = Object.keys(Organization.rawAttributes);

    let activityFields = [];
    try {
      const Activity = require("../../models/activity/activityModel");
      activityFields = Object.keys(Activity.rawAttributes);
    } catch (e) {
      console.log("[DEBUG] Activity model not available:", e.message);
    }

    console.log("[DEBUG] Available fields:");
    console.log("- Person fields:", personFields.slice(0, 5), "...");
    console.log("- Lead fields:", leadFields.slice(0, 5), "...");
    console.log("- Deal fields:", dealFields.slice(0, 5), "...");
    console.log(
      "- Organization fields:",
      organizationFields.slice(0, 5),
      "..."
    );
    console.log("- Activity fields:", activityFields.slice(0, 5), "...");

    // If filterConfig is provided, build AND/OR logic for all entities
    if (filterConfig && typeof filterConfig === "object") {
      // AND conditions
      if (Array.isArray(filterConfig.all) && filterConfig.all.length > 0) {
        console.log("[DEBUG] Processing 'all' conditions:", filterConfig.all);

        filterConfig.all.forEach(function (cond) {
          console.log(`[DEBUG] Processing AND condition:`, cond);

          if (cond.entity) {
            // Entity is explicitly specified
            switch (cond.entity.toLowerCase()) {
              case "person":
                if (personFields.includes(cond.field)) {
                  if (!personWhere[Op.and]) personWhere[Op.and] = [];
                  personWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Person AND condition for field: ${cond.field}`
                  );
                }
                break;
              case "lead":
                if (leadFields.includes(cond.field)) {
                  if (!leadWhere[Op.and]) leadWhere[Op.and] = [];
                  leadWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Lead AND condition for field: ${cond.field}`
                  );
                }
                break;
              case "deal":
                if (dealFields.includes(cond.field)) {
                  if (!dealWhere[Op.and]) dealWhere[Op.and] = [];
                  dealWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Deal AND condition for field: ${cond.field}`
                  );
                }
                break;
              case "organization":
                if (organizationFields.includes(cond.field)) {
                  if (!organizationWhere[Op.and])
                    organizationWhere[Op.and] = [];
                  organizationWhere[Op.and].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Organization AND condition for field: ${cond.field}`
                  );
                }
                break;
              case "activity":
                console.log(`[DEBUG] Processing activity condition:`, cond);
                console.log(
                  `[DEBUG] Available activity fields:`,
                  activityFields
                );
                console.log(
                  `[DEBUG] Checking if field '${cond.field}' is in activity fields`
                );
                if (activityFields.includes(cond.field)) {
                  if (!activityWhere[Op.and]) activityWhere[Op.and] = [];
                  const condition = buildCondition(cond);
                  console.log(
                    `[DEBUG] Built activity condition:`,
                    JSON.stringify(condition, null, 2)
                  );
                  activityWhere[Op.and].push(condition);
                  console.log(
                    `[DEBUG] Added Activity AND condition for field: ${cond.field}`
                  );
                  console.log(
                    `[DEBUG] Current activityWhere[Op.and]:`,
                    JSON.stringify(activityWhere[Op.and], null, 2)
                  );
                  console.log(
                    `[DEBUG] Current activityWhere:`,
                    JSON.stringify(activityWhere, null, 2)
                  );
                } else {
                  console.log(
                    `[DEBUG] Field '${cond.field}' NOT found in activity fields:`,
                    activityFields
                  );
                }
                break;
              default:
                console.log(`[DEBUG] Unknown entity: ${cond.entity}`);
            }
          } else {
            // Auto-detect entity based on field name
            if (personFields.includes(cond.field)) {
              if (!personWhere[Op.and]) personWhere[Op.and] = [];
              personWhere[Op.and].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Person AND condition for field: ${cond.field}`
              );
            } else if (leadFields.includes(cond.field)) {
              if (!leadWhere[Op.and]) leadWhere[Op.and] = [];
              leadWhere[Op.and].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Lead AND condition for field: ${cond.field}`
              );
            } else if (dealFields.includes(cond.field)) {
              if (!dealWhere[Op.and]) dealWhere[Op.and] = [];
              dealWhere[Op.and].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Deal AND condition for field: ${cond.field}`
              );
            } else if (organizationFields.includes(cond.field)) {
              if (!organizationWhere[Op.and]) organizationWhere[Op.and] = [];
              organizationWhere[Op.and].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Organization AND condition for field: ${cond.field}`
              );
            } else if (activityFields.includes(cond.field)) {
              console.log(
                `[DEBUG] Auto-detecting activity condition for field: ${cond.field}`
              );
              if (!activityWhere[Op.and]) activityWhere[Op.and] = [];
              const condition = buildCondition(cond);
              console.log(
                `[DEBUG] Built auto-detected activity condition:`,
                JSON.stringify(condition, null, 2)
              );
              activityWhere[Op.and].push(condition);
              console.log(
                `[DEBUG] Auto-detected Activity AND condition for field: ${cond.field}`
              );
              console.log(
                `[DEBUG] Current activityWhere after auto-detection:`,
                JSON.stringify(activityWhere, null, 2)
              );
            } else {
              console.log(
                `[DEBUG] Field '${cond.field}' not found in any entity`
              );
              console.log(`[DEBUG] Available fields summary:`);
              console.log(`  - Person: ${personFields.length} fields`);
              console.log(`  - Lead: ${leadFields.length} fields`);
              console.log(`  - Deal: ${dealFields.length} fields`);
              console.log(
                `  - Organization: ${organizationFields.length} fields`
              );
              console.log(`  - Activity: ${activityFields.length} fields`);
            }
          }
        });
      }

      // OR conditions
      if (Array.isArray(filterConfig.any) && filterConfig.any.length > 0) {
        console.log("[DEBUG] Processing 'any' conditions:", filterConfig.any);

        filterConfig.any.forEach(function (cond) {
          console.log(`[DEBUG] Processing OR condition:`, cond);

          if (cond.entity) {
            // Entity is explicitly specified
            switch (cond.entity.toLowerCase()) {
              case "person":
                if (personFields.includes(cond.field)) {
                  if (!personWhere[Op.or]) personWhere[Op.or] = [];
                  personWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Person OR condition for field: ${cond.field}`
                  );
                }
                break;
              case "lead":
                if (leadFields.includes(cond.field)) {
                  if (!leadWhere[Op.or]) leadWhere[Op.or] = [];
                  leadWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Lead OR condition for field: ${cond.field}`
                  );
                }
                break;
              case "deal":
                if (dealFields.includes(cond.field)) {
                  if (!dealWhere[Op.or]) dealWhere[Op.or] = [];
                  dealWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Deal OR condition for field: ${cond.field}`
                  );
                }
                break;
              case "organization":
                if (organizationFields.includes(cond.field)) {
                  if (!organizationWhere[Op.or]) organizationWhere[Op.or] = [];
                  organizationWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Organization OR condition for field: ${cond.field}`
                  );
                }
                break;
              case "activity":
                if (activityFields.includes(cond.field)) {
                  if (!activityWhere[Op.or]) activityWhere[Op.or] = [];
                  activityWhere[Op.or].push(buildCondition(cond));
                  console.log(
                    `[DEBUG] Added Activity OR condition for field: ${cond.field}`
                  );
                }
                break;
              default:
                console.log(`[DEBUG] Unknown entity: ${cond.entity}`);
            }
          } else {
            // Auto-detect entity based on field name
            if (personFields.includes(cond.field)) {
              if (!personWhere[Op.or]) personWhere[Op.or] = [];
              personWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Person OR condition for field: ${cond.field}`
              );
            } else if (leadFields.includes(cond.field)) {
              if (!leadWhere[Op.or]) leadWhere[Op.or] = [];
              leadWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Lead OR condition for field: ${cond.field}`
              );
            } else if (dealFields.includes(cond.field)) {
              if (!dealWhere[Op.or]) dealWhere[Op.or] = [];
              dealWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Deal OR condition for field: ${cond.field}`
              );
            } else if (organizationFields.includes(cond.field)) {
              if (!organizationWhere[Op.or]) organizationWhere[Op.or] = [];
              organizationWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Organization OR condition for field: ${cond.field}`
              );
            } else if (activityFields.includes(cond.field)) {
              if (!activityWhere[Op.or]) activityWhere[Op.or] = [];
              activityWhere[Op.or].push(buildCondition(cond));
              console.log(
                `[DEBUG] Auto-detected Activity OR condition for field: ${cond.field}`
              );
            } else {
              console.log(
                `[DEBUG] Field '${cond.field}' not found in any entity`
              );
            }
          }
        });
      }
    } else if (personSearch) {
      // Fallback to search logic if no filterConfig
      personWhere[Op.or] = [
        { contactPerson: { [Op.like]: `%${personSearch}%` } },
        { email: { [Op.like]: `%${personSearch}%` } },
        { phone: { [Op.like]: `%${personSearch}%` } },
        { jobTitle: { [Op.like]: `%${personSearch}%` } },
        { personLabels: { [Op.like]: `%${personSearch}%` } },
        { organization: { [Op.like]: `%${personSearch}%` } },
      ];
    }

    // Debug: log all where clauses
    console.log("[DEBUG] Final where clauses:");
    console.log("- personWhere:", JSON.stringify(personWhere, null, 2));
    console.log("- leadWhere:", JSON.stringify(leadWhere, null, 2));
    console.log("- dealWhere:", JSON.stringify(dealWhere, null, 2));
    console.log(
      "- organizationWhere:",
      JSON.stringify(organizationWhere, null, 2)
    );
    console.log("- activityWhere:", JSON.stringify(activityWhere, null, 2));

    // Additional debug for contactPerson filtering
    if (filterConfig && filterConfig.all && filterConfig.all.length > 0) {
      const contactPersonFilter = filterConfig.all.find(
        (cond) => cond.field === "contactPerson" && cond.entity === "Person"
      );
      if (contactPersonFilter) {
        console.log("[DEBUG] Found contactPerson filter:", contactPersonFilter);
        console.log(
          "[DEBUG] Checking if personWhere contains contactPerson condition..."
        );

        // Test the exact query that will be run
        const testQuery = await Person.findAll({
          where: { contactPerson: contactPersonFilter.value },
          attributes: ["personId", "contactPerson"],
          limit: 5,
          raw: true,
        });
        console.log(
          "[DEBUG] Test query for exact contactPerson match:",
          testQuery
        );
      }
    }

    // Check if any conditions exist (including Op.and arrays)
    const hasActivityFilters =
      Object.keys(activityWhere).length > 0 ||
      (activityWhere[Op.and] && activityWhere[Op.and].length > 0);
    const hasLeadFilters =
      Object.keys(leadWhere).length > 0 ||
      (leadWhere[Op.and] && leadWhere[Op.and].length > 0);
    const hasDealFilters =
      Object.keys(dealWhere).length > 0 ||
      (dealWhere[Op.and] && dealWhere[Op.and].length > 0);
    const hasOrgFilters =
      Object.keys(organizationWhere).length > 0 ||
      (organizationWhere[Op.and] && organizationWhere[Op.and].length > 0);

    console.log("[DEBUG] Filter detection:");
    console.log("- hasActivityFilters:", hasActivityFilters);
    console.log("- hasLeadFilters:", hasLeadFilters);
    console.log("- hasDealFilters:", hasDealFilters);
    console.log("- hasOrgFilters:", hasOrgFilters);

    if (hasActivityFilters) {
      console.log(
        "[DEBUG] Activity filter conditions:",
        activityWhere[Op.and] || activityWhere
      );
    }

    // Apply Lead filters to get relevant person IDs
    let leadFilteredPersonIds = [];
    const hasLeadFiltersSymbol =
      leadWhere[Op.and]?.length > 0 ||
      leadWhere[Op.or]?.length > 0 ||
      Object.keys(leadWhere).some((key) => typeof key === "string");

    if (hasLeadFiltersSymbol) {
      console.log("[DEBUG] Applying Lead filters to find persons");
      console.log("[DEBUG] leadWhere has filters:", {
        andConditions: leadWhere[Op.and]?.length || 0,
        orConditions: leadWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(leadWhere).filter(
          (key) => typeof key === "string"
        ),
      });

      let leadFilterResults = [];
      if (req.role === "admin") {
        leadFilterResults = await Lead.findAll({
          where: leadWhere,
          attributes: ["personId", "leadOrganizationId"],
          raw: true,
        });
      } else {
        leadFilterResults = await Lead.findAll({
          where: {
            ...leadWhere,
            [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
          },
          attributes: ["personId", "leadOrganizationId"],
          raw: true,
        });
      }

      console.log(
        "[DEBUG] Lead filter results:",
        leadFilterResults.length,
        "leads found"
      );

      // Get person IDs directly from leads
      const directPersonIds = leadFilterResults
        .map((lead) => lead.personId)
        .filter(Boolean);

      // Get organization IDs from leads, then find persons in those organizations
      const leadOrgIds = leadFilterResults
        .map((lead) => lead.leadOrganizationId)
        .filter(Boolean);

      let orgPersonIds = [];
      if (leadOrgIds.length > 0) {
        const personsInOrgs = await Person.findAll({
          where: { leadOrganizationId: { [Op.in]: leadOrgIds } },
          attributes: ["personId"],
          raw: true,
        });
        orgPersonIds = personsInOrgs.map((p) => p.personId);
      }

      leadFilteredPersonIds = [
        ...new Set([...directPersonIds, ...orgPersonIds]),
      ];

      console.log(
        "[DEBUG] Lead-filtered person IDs:",
        leadFilteredPersonIds.length
      );
    }

    // Apply Activity filters to get relevant person IDs
    let activityFilteredPersonIds = [];
    const hasActivityFiltersSymbol =
      activityWhere[Op.and]?.length > 0 ||
      activityWhere[Op.or]?.length > 0 ||
      Object.keys(activityWhere).some((key) => typeof key === "string");

    if (hasActivityFiltersSymbol) {
      console.log("[DEBUG] Applying Activity filters to find persons");
      console.log("[DEBUG] activityWhere has filters:", {
        andConditions: activityWhere[Op.and]?.length || 0,
        orConditions: activityWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(activityWhere).filter(
          (key) => typeof key === "string"
        ),
      });

      try {
        const Activity = require("../../models/activity/activityModel");
        let activityFilterResults = [];

        if (req.role === "admin") {
          activityFilterResults = await Activity.findAll({
            where: activityWhere,
            attributes: ["personId", "leadOrganizationId"],
            raw: true,
          });
        } else {
          activityFilterResults = await Activity.findAll({
            where: {
              ...activityWhere,
              [Op.or]: [
                { masterUserID: req.adminId },
                { assignedTo: req.adminId },
              ],
            },
            attributes: ["personId", "leadOrganizationId"],
            raw: true,
          });
        }

        console.log(
          "[DEBUG] Activity filter results:",
          activityFilterResults.length,
          "activities found"
        );

        // Get person IDs directly from activities
        const directPersonIds = activityFilterResults
          .map((activity) => activity.personId)
          .filter(Boolean);

        // Get organization IDs from activities, then find persons in those organizations
        const activityOrgIds = activityFilterResults
          .map((activity) => activity.leadOrganizationId)
          .filter(Boolean);

        let orgPersonIds = [];
        if (activityOrgIds.length > 0) {
          const personsInOrgs = await Person.findAll({
            where: { leadOrganizationId: { [Op.in]: activityOrgIds } },
            attributes: ["personId"],
            raw: true,
          });
          orgPersonIds = personsInOrgs.map((p) => p.personId);
        }

        activityFilteredPersonIds = [
          ...new Set([...directPersonIds, ...orgPersonIds]),
        ];

        console.log(
          "[DEBUG] Activity-filtered person IDs:",
          activityFilteredPersonIds.length
        );
      } catch (e) {
        console.log("[DEBUG] Error applying Activity filters:", e.message);
      }
    }

    // Apply Deal filters to get relevant person IDs
    let dealFilteredPersonIds = [];
    const hasDealFiltersSymbol =
      dealWhere[Op.and]?.length > 0 ||
      dealWhere[Op.or]?.length > 0 ||
      Object.keys(dealWhere).some((key) => typeof key === "string");

    if (hasDealFiltersSymbol) {
      console.log("[DEBUG] Applying Deal filters to find persons");
      console.log("[DEBUG] dealWhere has filters:", {
        andConditions: dealWhere[Op.and]?.length || 0,
        orConditions: dealWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(dealWhere).filter(
          (key) => typeof key === "string"
        ),
      });

      let dealFilterResults = [];
      if (req.role === "admin") {
        dealFilterResults = await Deal.findAll({
          where: dealWhere,
          attributes: ["personId", "leadOrganizationId"],
          raw: true,
        });
      } else {
        dealFilterResults = await Deal.findAll({
          where: {
            ...dealWhere,
            [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
          },
          attributes: ["personId", "leadOrganizationId"],
          raw: true,
        });
      }

      console.log(
        "[DEBUG] Deal filter results:",
        dealFilterResults.length,
        "deals found"
      );

      // Get person IDs directly from deals
      const directPersonIds = dealFilterResults
        .map((deal) => deal.personId)
        .filter(Boolean);

      // Get organization IDs from deals, then find persons in those organizations
      const dealOrgIds = dealFilterResults
        .map((deal) => deal.leadOrganizationId)
        .filter(Boolean);

      let orgPersonIds = [];
      if (dealOrgIds.length > 0) {
        const personsInOrgs = await Person.findAll({
          where: { leadOrganizationId: { [Op.in]: dealOrgIds } },
          attributes: ["personId"],
          raw: true,
        });
        orgPersonIds = personsInOrgs.map((p) => p.personId);
      }

      dealFilteredPersonIds = [
        ...new Set([...directPersonIds, ...orgPersonIds]),
      ];

      console.log(
        "[DEBUG] Deal-filtered person IDs:",
        dealFilteredPersonIds.length
      );
    }

    // Apply Organization filters to get relevant person IDs
    let orgFilteredPersonIds = [];
    const hasOrgFiltersSymbol =
      organizationWhere[Op.and]?.length > 0 ||
      organizationWhere[Op.or]?.length > 0 ||
      Object.keys(organizationWhere).some((key) => typeof key === "string");

    if (hasOrgFiltersSymbol) {
      console.log("[DEBUG] Applying Organization filters to find persons");
      console.log("[DEBUG] organizationWhere has filters:", {
        andConditions: organizationWhere[Op.and]?.length || 0,
        orConditions: organizationWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(organizationWhere).filter(
          (key) => typeof key === "string"
        ),
      });

      let orgFilterResults = [];
      if (req.role === "admin") {
        orgFilterResults = await Organization.findAll({
          where: organizationWhere,
          attributes: ["leadOrganizationId"],
          raw: true,
        });
      } else {
        orgFilterResults = await Organization.findAll({
          where: {
            ...organizationWhere,
            [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
          },
          attributes: ["leadOrganizationId"],
          raw: true,
        });
      }

      console.log(
        "[DEBUG] Organization filter results:",
        orgFilterResults.length,
        "organizations found"
      );

      // Get organization IDs, then find persons in those organizations
      const orgIds = orgFilterResults.map((org) => org.leadOrganizationId);

      if (orgIds.length > 0) {
        const personsInOrgs = await Person.findAll({
          where: { leadOrganizationId: { [Op.in]: orgIds } },
          attributes: ["personId"],
          raw: true,
        });
        orgFilteredPersonIds = personsInOrgs.map((p) => p.personId);
      }

      console.log(
        "[DEBUG] Organization-filtered person IDs:",
        orgFilteredPersonIds.length
      );
    }

    // Apply Person filters directly
    let personFilteredPersonIds = [];
    const hasPersonFiltersSymbol =
      personWhere[Op.and]?.length > 0 ||
      personWhere[Op.or]?.length > 0 ||
      Object.keys(personWhere).some((key) => typeof key === "string");

    if (hasPersonFiltersSymbol) {
      console.log("[DEBUG] Applying Person filters to find persons");
      console.log("[DEBUG] personWhere has filters:", {
        andConditions: personWhere[Op.and]?.length || 0,
        orConditions: personWhere[Op.or]?.length || 0,
        stringKeys: Object.keys(personWhere).filter(
          (key) => typeof key === "string"
        ),
        fullPersonWhere: JSON.stringify(personWhere, null, 2),
      });

      let personFilterResults = [];
      if (req.role === "admin") {
        personFilterResults = await Person.findAll({
          where: personWhere,
          attributes: ["personId"],
          raw: true,
        });
      } else {
        // For non-admin users, we need to be careful about combining filters
        const userAccessWhere = {
          [Op.or]: [{ masterUserID: req.adminId }],
        };

        const combinedWhere = {
          [Op.and]: [personWhere, userAccessWhere],
        };

        console.log(
          "[DEBUG] Combined where for non-admin:",
          JSON.stringify(combinedWhere, null, 2)
        );

        personFilterResults = await Person.findAll({
          where: combinedWhere,
          attributes: ["personId"],
          raw: true,
        });
      }

      console.log(
        "[DEBUG] Person filter results:",
        personFilterResults.length,
        "persons found"
      );

      // Get person IDs directly from person filters
      personFilteredPersonIds = personFilterResults.map(
        (person) => person.personId
      );

      console.log(
        "[DEBUG] Person-filtered person IDs:",
        personFilteredPersonIds.length
      );
    }

    // Role-based filtering logic for organizations
    let orgWhere = orgSearch
      ? {
          [Op.or]: [
            { organization: { [Op.like]: `%${orgSearch}%` } },
            { organizationLabels: { [Op.like]: `%${orgSearch}%` } },
            { address: { [Op.like]: `%${orgSearch}%` } },
          ],
        }
      : {};

    // Fetch organizations first - same logic as getLeads API
    let organizations = [];
    if (req.role === "admin") {
      organizations = await Organization.findAll({
        where: orgWhere,
        raw: true,
      });
    } else {
      organizations = await Organization.findAll({
        where: {
          ...orgWhere,
          [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
        },
        raw: true,
      });
    }

    const orgIds = organizations.map((o) => o.leadOrganizationId);

    // Apply Lead, Activity, Deal, Organization, and Person filters by restricting to persons found in those entities
    const allFilteredPersonIds = [
      ...new Set([
        ...leadFilteredPersonIds,
        ...activityFilteredPersonIds,
        ...dealFilteredPersonIds,
        ...orgFilteredPersonIds,
        ...personFilteredPersonIds,
      ]),
    ];

    // Merge personWhere from filters with filtered person IDs
    let finalPersonWhere = { ...personWhere };

    if (allFilteredPersonIds.length > 0) {
      console.log(
        "[DEBUG] Applying combined filters: restricting to person IDs:",
        allFilteredPersonIds.length
      );
      console.log(
        "[DEBUG] - From leads:",
        leadFilteredPersonIds.length,
        "person IDs"
      );
      console.log(
        "[DEBUG] - From activities:",
        activityFilteredPersonIds.length,
        "person IDs"
      );
      console.log(
        "[DEBUG] - From deals:",
        dealFilteredPersonIds.length,
        "person IDs"
      );
      console.log(
        "[DEBUG] - From organizations:",
        orgFilteredPersonIds.length,
        "person IDs"
      );
      console.log(
        "[DEBUG] - From persons:",
        personFilteredPersonIds.length,
        "person IDs"
      );

      if (Object.keys(finalPersonWhere).length > 0) {
        // Combine with existing filters using AND
        finalPersonWhere = {
          [Op.and]: [
            finalPersonWhere,
            { personId: { [Op.in]: allFilteredPersonIds } },
          ],
        };
      } else {
        // Only entity filters apply
        finalPersonWhere = { personId: { [Op.in]: allFilteredPersonIds } };
      }
    } else if (
      hasLeadFiltersSymbol ||
      hasActivityFiltersSymbol ||
      hasDealFiltersSymbol ||
      hasOrgFiltersSymbol ||
      hasPersonFiltersSymbol
    ) {
      // If entity filters were applied but no matching persons found, return empty results
      console.log(
        "[DEBUG] Entity filters applied but no matching persons found - returning empty results"
      );
      return res.status(200).json({
        totalRecords: 0,
        totalPages: 0,
        currentPage: personPage,
        persons: [],
      });
    }

    console.log(
      "[DEBUG] Final finalPersonWhere:",
      JSON.stringify(finalPersonWhere, null, 2)
    );

    // Fetch persons using updated filtering logic
    let persons = [];
    if (req.role === "admin" && !req.query.masterUserID) {
      persons = await Person.findAll({
        where: finalPersonWhere,
        raw: true,
      });
    } else if (req.query.masterUserID) {
      // If masterUserID is provided, filter by that as well
      finalPersonWhere.masterUserID = req.query.masterUserID;
      persons = await Person.findAll({
        where: finalPersonWhere,
        raw: true,
      });
    } else {
      const roleBasedPersonFilter = {
        [Op.or]: [
          { masterUserID: req.adminId },
          { leadOrganizationId: orgIds },
        ],
      };

      // Merge filter conditions with role-based access control
      if (Object.keys(finalPersonWhere).length > 0) {
        finalPersonWhere = {
          [Op.and]: [finalPersonWhere, roleBasedPersonFilter],
        };
      } else {
        finalPersonWhere = roleBasedPersonFilter;
      }

      persons = await Person.findAll({
        where: finalPersonWhere,
        raw: true,
      });
    }

    console.log("[DEBUG] persons count:", persons.length);
    console.log(
      "[DEBUG] persons sample:",
      persons && persons.length > 0 ? persons[0] : null
    );

    // Build org map for quick lookup
    const orgMap = {};
    organizations.forEach((org) => {
      orgMap[org.leadOrganizationId] = org;
    });

    // Get all unique ownerIds from persons and organizations
    const orgOwnerIds = organizations.map((o) => o.ownerId).filter(Boolean);
    const personOwnerIds = persons.map((p) => p.ownerId).filter(Boolean);
    const ownerIds = [...new Set([...orgOwnerIds, ...personOwnerIds])];

    // Fetch owner names from MasterUser
    const owners = await MasterUser.findAll({
      where: { masterUserID: ownerIds },
      attributes: ["masterUserID", "name"],
      raw: true,
    });
    const ownerMap = {};
    owners.forEach((o) => {
      ownerMap[o.masterUserID] = o.name;
    });

    // Add ownerName to persons - same logic as getLeads API
    persons = persons.map((p) => ({
      ...p,
      ownerName: ownerMap[p.ownerId] || null,
    }));

    // Count leads for each person using the same approach as getLeads API
    const personIds = persons.map((p) => p.personId);
    const leadCounts = await Lead.findAll({
      attributes: [
        "personId",
        "leadOrganizationId",
        [Sequelize.fn("COUNT", Sequelize.col("leadId")), "leadCount"],
      ],
      where: {
        [Op.or]: [{ personId: personIds }, { leadOrganizationId: orgIds }],
      },
      group: ["personId", "leadOrganizationId"],
      raw: true,
    });

    // Build maps for quick lookup
    const personLeadCountMap = {};
    const orgLeadCountMap = {};
    leadCounts.forEach((lc) => {
      if (lc.personId)
        personLeadCountMap[lc.personId] = parseInt(lc.leadCount, 10);
      if (lc.leadOrganizationId)
        orgLeadCountMap[lc.leadOrganizationId] = parseInt(lc.leadCount, 10);
    });

    // Add leadCount to persons - same logic as getLeads API
    persons = persons.map((p) => {
      let ownerName = null;
      if (p.leadOrganizationId && orgMap[p.leadOrganizationId]) {
        const org = orgMap[p.leadOrganizationId];
        if (org.ownerId && ownerMap[org.ownerId]) {
          ownerName = ownerMap[org.ownerId];
        }
      }
      return {
        ...p,
        ownerName,
        leadCount: personLeadCountMap[p.personId] || 0,
      };
    });

    // Fetch custom field values for all persons - same as getLeads API
    const CustomField = require("../../models/customFieldModel");
    const CustomFieldValue = require("../../models/customFieldValueModel");
    const personIdsForCustomFields = persons.map((p) => p.personId);
    let customFieldValues = [];
    if (personIdsForCustomFields.length > 0) {
      customFieldValues = await CustomFieldValue.findAll({
        where: {
          entityId: personIdsForCustomFields,
          entityType: "person",
        },
        raw: true,
      });
    }

    // Fetch all custom fields for person entity
    const allCustomFields = await CustomField.findAll({
      where: {
        entityType: { [Sequelize.Op.in]: ["person", "both"] },
        isActive: true,
      },
      raw: true,
    });

    const customFieldIdToName = {};
    allCustomFields.forEach((cf) => {
      customFieldIdToName[cf.fieldId] = cf.fieldName;
    });

    // Map personId to their custom field values as { fieldName: value }
    const personCustomFieldsMap = {};
    customFieldValues.forEach((cfv) => {
      const fieldName = customFieldIdToName[cfv.fieldId] || cfv.fieldId;
      if (!personCustomFieldsMap[cfv.entityId])
        personCustomFieldsMap[cfv.entityId] = {};
      personCustomFieldsMap[cfv.entityId][fieldName] = cfv.value;
    });

    // Attach custom fields as direct properties to each person - same as getLeads API
    persons = persons.map((p) => {
      const customFields = personCustomFieldsMap[p.personId] || {};
      return { ...p, ...customFields };
    });

    // Return persons in EXACT same format as getLeads API
    res.status(200).json({
      totalRecords: persons.length,
      totalPages: Math.ceil(persons.length / personLimit),
      currentPage: personPage,
      persons: persons, // Return persons exactly as they are in getLeads API
    });
  } catch (error) {
    console.error("Error fetching persons and organizations:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
