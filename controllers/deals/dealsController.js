const Deal = require("../../models/deals/dealsModels");
const Lead = require("../../models/leads/leadsModel");
const Person = require("../../models/leads/leadPersonModel");
const Organization = require("../../models/leads/leadOrganizationModel");
const CustomField = require("../../models/customFieldModel");
const CustomFieldValue = require("../../models/customFieldValueModel");
const { Op } = require("sequelize");
const { fn, col, literal } = require("sequelize");
const DealDetails = require("../../models/deals/dealsDetailModel");
const DealStageHistory = require("../../models/deals/dealsStageHistoryModel");
const DealParticipant = require("../../models/deals/dealPartcipentsModel");
const MasterUser = require("../../models/master/masterUserModel");
const DealNote = require("../../models/deals/delasNoteModel");
const LeadNote = require("../../models/leads/leadNoteModel");
const Email = require("../../models/email/emailModel");
const Attachment = require("../../models/email/attachmentModel");
const LeadFilter = require("../../models/leads/leadFiltersModel");
const { convertRelativeDate } = require("../../utils/helper");
const Activity = require("../../models/activity/activityModel");
const DealColumnPreference = require("../../models/deals/dealColumnModel"); // Adjust path as needed
const { logAuditTrail } = require("../../utils/auditTrailLogger"); // Adjust path as needed
const historyLogger = require("../../utils/historyLogger").logHistory; // Import history logger

const { getProgramId } = require("../../utils/programCache");
const PipelineStage = require("../../models/deals/pipelineStageModel");
// Create a new deal with validation
exports.createDeal = async (req, res) => {
  try {
    const dealProgramId = getProgramId("DEALS");
    const {
      contactPerson,
      organization,
      title,
      value,
      currency,
      pipeline,
      pipelineStage,
      expectedCloseDate,
      sourceChannel,
      sourceChannelId,
      serviceType,
      proposalValue,
      proposalCurrency,
      esplProposalNo,
      projectLocation,
      organizationCountry,
      proposalSentDate,
      sourceRequired,
      questionerShared,
      sectorialSector,
      sbuClass,
      phone,
      email,
      sourceOrgin,
      source,
      // Custom fields will be processed from remaining req.body fields
    } = req.body;

    // Validate required fields here...
    let ownerId = req.user?.id || req.adminId || req.body.ownerId;

    // --- Enhanced validation similar to createLead ---
    // Validate required fields
    if (!contactPerson || !organization || !title || !email) {
      await logAuditTrail(
        dealProgramId,
        "DEAL_CREATION",
        req.role,
        `Deal creation failed: contactPerson, organization, title, and email are required.`,
        req.adminId
      );
      return res.status(400).json({
        message: "contactPerson, organization, title, and email are required.",
      });
    }

    // Validate contactPerson
    if (typeof contactPerson !== "string" || !contactPerson.trim()) {
      await logAuditTrail(
        dealProgramId,
        "DEAL_CREATION",
        req.role,
        `Deal creation failed: contactPerson must be a non-empty string.`,
        req.adminId
      );
      return res.status(400).json({
        message: "contactPerson must be a non-empty string.",
      });
    }

    // Validate organization
    if (typeof organization !== "string" || !organization.trim()) {
      await logAuditTrail(
        dealProgramId,
        "DEAL_CREATION",
        req.role,
        `Deal creation failed: organization must be a non-empty string.`,
        req.adminId
      );
      return res.status(400).json({
        message: "organization must be a non-empty string.",
      });
    }

    // Validate title
    if (typeof title !== "string" || !title.trim()) {
      await logAuditTrail(
        dealProgramId,
        "DEAL_CREATION",
        req.role,
        `Deal creation failed: title must be a non-empty string.`,
        req.adminId
      );
      return res.status(400).json({
        message: "title must be a non-empty string.",
      });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await logAuditTrail(
        dealProgramId,
        "DEAL_CREATION",
        req.role,
        `Deal creation failed: Invalid email format.`,
        req.adminId
      );
      return res.status(400).json({
        message: "Invalid email format.",
      });
    }

    // Validate phone if provided
    if (phone && !/^\+?\d{7,15}$/.test(phone)) {
      await logAuditTrail(
        dealProgramId,
        "DEAL_CREATION",
        req.role,
        `Deal creation failed: Invalid phone number format.`,
        req.adminId
      );
      return res.status(400).json({
        message: "Invalid phone number format.",
      });
    }

    // Validate proposalValue if provided
    if (proposalValue && proposalValue < 0) {
      await logAuditTrail(
        dealProgramId,
        "DEAL_CREATION",
        req.role,
        `Deal creation failed: Proposal value must be positive.`,
        req.adminId
      );
      return res.status(400).json({
        message: "Proposal value must be positive.",
      });
    }

    // Validate value if provided
    if (value && value < 0) {
      await logAuditTrail(
        dealProgramId,
        "DEAL_CREATION",
        req.role,
        `Deal creation failed: Deal value must be positive.`,
        req.adminId
      );
      return res.status(400).json({
        message: "Deal value must be positive.",
      });
    }
    // Find or create Person and Organization here...
    // Check for duplicate combination of contactPerson, organization, AND title (similar to createLead)
    const existingContactOrgTitleDeal = await Deal.findOne({
      where: {
        contactPerson: contactPerson,
        organization: organization,
        title: title,
      },
    });
    if (existingContactOrgTitleDeal) {
      await logAuditTrail(
        dealProgramId,
        "DEAL_CREATION",
        req.role,
        `Deal creation failed: A deal with this exact combination of contact person, organization, and title already exists.`,
        req.adminId
      );
      return res.status(409).json({
        message:
          "A deal with this exact combination of contact person, organization, and title already exists. Please use a different title for a new deal with the same contact.",
        existingDealId: existingContactOrgTitleDeal.dealId,
        existingDealTitle: existingContactOrgTitleDeal.title,
      });
    }
    // 1. Set masterUserID at the top, before using it anywhere
    const masterUserID = req.adminId;
    // 1. Check if a matching lead exists

    let existingLead = null;

    // 2. If sourceOrgin is '2', require and use leadId
    let leadId = req.body.leadId;
    if (sourceOrgin === "2" || sourceOrgin === 2) {
      if (!leadId) {
        await logAuditTrail(
          dealProgramId,
          "DEAL_CREATION",
          req.role,
          `Deal creation failed: leadId is required when sourceOrgin is 2.`,
          req.adminId
        );
        return res
          .status(400)
          .json({ message: "leadId is required when sourceOrgin is 2." });
      }
      existingLead = await Lead.findByPk(leadId);
      if (!existingLead) {
        await logAuditTrail(
          dealProgramId,
          "DEAL_CREATION",
          req.role,
          `Deal creation failed: Lead with leadId ${leadId} not found.`,
          req.adminId
        );
        return res.status(404).json({ message: "Lead not found." });
      }
      ownerId = existingLead.ownerId; // assign, don't redeclare
      leadId = existingLead.leadId; // assign, don't redeclare
      // Optionally, update the lead after deal creation
    }
    // 1. Find or create Organization
    let org = null;
    if (organization) {
      org = await Organization.findOne({ where: { organization } });
      if (!org) {
        org = await Organization.create({
          organization,
          masterUserID, // make sure this is set
        });
      }
    }
    // 2. Find or create Person
    let person = null;
    if (contactPerson) {
      const masterUserID = req.adminId;

      person = await Person.findOne({ where: { email } });
      if (!person) {
        person = await Person.create({
          contactPerson,
          email,
          phone,
          leadOrganizationId: org ? org.leadOrganizationId : null,
          masterUserID,
        });
      }
    }
    // Create the lead
    console.log(person.personId, " before deal creation");
    // Before saving to DB
    if (sourceOrgin === "2" || sourceOrgin === 2) {
      if (!leadId) {
        await logAuditTrail(
          dealProgramId,
          "DEAL_CREATION",
          req.role,
          `Deal creation failed: leadId is required when sourceOrgin is 2.`,
          req.adminId
        );
        return res
          .status(400)
          .json({ message: "leadId is required when sourceOrgin is 2." });
      }
      existingLead = await Lead.findByPk(leadId);
      if (!existingLead) {
        return res.status(404).json({ message: "Lead not found." });
      }
      // Prevent conversion if already converted to a deal
      if (existingLead.dealId) {
        await logAuditTrail(
          dealProgramId,
          "DEAL_CREATION",
          req.role,
          `Deal creation failed: This lead is already converted to a deal.`,
          req.adminId
        );
        return res
          .status(400)
          .json({ message: "This lead is already converted to a deal." });
      }
      ownerId = existingLead.ownerId;
      leadId = existingLead.leadId;
    }
    const deal = await Deal.create({
      // contactPerson: person ? person.contactPerson : null,
      contactPerson: person ? person.contactPerson : contactPerson,
      organization: org ? org.organization : null,
      personId: person ? person.personId : null,
      leadOrganizationId: org ? org.leadOrganizationId : null,
      //       personId: person.personId,
      // leadOrganizationId: org.leadOrganizationId,
      leadId, // link to the lead if found
      title,
      value,
      currency,
      pipeline,
      pipelineStage,
      expectedCloseDate,
      sourceChannel,
      sourceChannelId,
      serviceType,
      proposalValue,
      proposalCurrency,
      esplProposalNo,
      projectLocation,
      organizationCountry,
      proposalSentDate,
      sourceRequired,
      questionerShared,
      sectorialSector,
      sbuClass,
      phone,
      email,
      sourceOrgin,
      masterUserID: req.adminId, // Ensure masterUserID is set from the request
      ownerId,
      status: "open", // Default status
      source,
      // Add personId, organizationId, etc. as needed
    });
    let responsiblePerson = null;
    if (sourceOrgin === "2" || sourceOrgin === 2) {
      // Use ownerId for responsible person
      const owner = await MasterUser.findOne({
        where: { masterUserID: ownerId },
      });
      responsiblePerson = owner ? owner.name : null;
    } else {
      // Use masterUserID for responsible person
      const user = await MasterUser.findOne({
        where: { masterUserID: req.adminId },
      });
      responsiblePerson = user ? user.name : null;
    }

    if ((sourceOrgin === 0 || sourceOrgin === "0") && req.body.emailID) {
      await Email.update(
        { dealId: deal.dealId },
        { where: { emailID: req.body.emailID } }
      );
    }
    await DealDetails.create({
      dealId: deal.dealId, // or deal.id depending on your PK
      responsiblePerson,
      ownerName: responsiblePerson, // or any other field you want to set
      // ...other dealDetails fields if needed
    });
    // Optionally, update the lead with the new dealId
    await DealStageHistory.create({
      dealId: deal.dealId,
      stageName: deal.pipelineStage,
      enteredAt: deal.createdAt, // or new Date()
    });
    if (person || org) {
      await DealParticipant.create({
        dealId: deal.dealId,
        personId: person ? person.personId : null,
        leadOrganizationId: org ? org.leadOrganizationId : null,
      });
    }

    if (existingLead) {
      await existingLead.update({ dealId: deal.dealId });
    } else if (leadId) {
      // If leadId is provided but not from sourceOrgin 2, still update the Lead with dealId
      const leadToUpdate = await Lead.findByPk(leadId);
      if (leadToUpdate) {
        await leadToUpdate.update({ dealId: deal.dealId });
      }
    }

    // Handle custom fields - extract from req.body directly
    const savedCustomFields = {};

    // Define standard Deal model fields that should not be treated as custom fields
    // const standardDealFields = [
    //   'contactPerson', 'organization', 'title', 'value', 'currency', 'pipeline',
    //   'pipelineStage', 'expectedCloseDate', 'sourceChannel', 'sourceChannelId',
    //   'serviceType', 'proposalValue', 'proposalCurrency', 'esplProposalNo',
    //   'projectLocation', 'organizationCountry', 'proposalSentDate', 'sourceRequired',
    //   'questionerShared', 'sectorialSector', 'sbuClass', 'phone', 'email',
    //   'sourceOrgin', 'source', 'leadId', 'ownerId', 'emailID'
    // ];
    const standardDealFields = [
      "title",
      "ownerId",
      "sourceChannel",
      "sourceChannelID",
    ];

    // Extract potential custom fields from req.body
    const potentialCustomFields = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (
        !standardDealFields.includes(key) &&
        value !== null &&
        value !== undefined &&
        value !== ""
      ) {
        potentialCustomFields[key] = value;
      }
    }

    console.log("=== CUSTOM FIELDS DEBUG ===");
    console.log("Potential custom fields extracted:", potentialCustomFields);
    console.log("req.adminId:", req.adminId);
    console.log("deal.dealId:", deal ? deal.dealId : "Deal not created yet");

    // Check if CustomField and CustomFieldValue models are loaded
    console.log("CustomField model available:", typeof CustomField);
    console.log("CustomFieldValue model available:", typeof CustomFieldValue);

    if (Object.keys(potentialCustomFields).length > 0) {
      try {
        console.log(
          "Processing",
          Object.keys(potentialCustomFields).length,
          "potential custom fields"
        );

        for (const [fieldKey, value] of Object.entries(potentialCustomFields)) {
          console.log(`\n--- Processing field: ${fieldKey} = ${value} ---`);
          let customField;

          // Check if it's a fieldId (numeric) or fieldName (string)
          if (isNaN(fieldKey)) {
            // It's a fieldName - search by fieldName
            console.log("Searching by fieldName:", fieldKey);
            customField = await CustomField.findOne({
              where: {
                fieldName: fieldKey,
                entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support deal, both, and lead fields
                isActive: true,
                [Op.or]: [
                  { masterUserID: req.adminId },
                  { fieldSource: "default" },
                  { fieldSource: "system" },
                ],
              },
            });
          } else {
            // It's a fieldId - search by fieldId
            console.log("Searching by fieldId:", parseInt(fieldKey));
            customField = await CustomField.findOne({
              where: {
                fieldId: parseInt(fieldKey),
                entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support deal, both, and lead fields
                isActive: true,
                [Op.or]: [
                  { masterUserID: req.adminId },
                  { fieldSource: "default" },
                  { fieldSource: "system" },
                ],
              },
            });
          }

          console.log(
            "CustomField found:",
            customField
              ? {
                  fieldId: customField.fieldId,
                  fieldName: customField.fieldName,
                  fieldType: customField.fieldType,
                  entityType: customField.entityType,
                  isActive: customField.isActive,
                  masterUserID: customField.masterUserID,
                  fieldSource: customField.fieldSource,
                }
              : "NOT FOUND"
          );

          if (
            customField &&
            value !== null &&
            value !== undefined &&
            value !== ""
          ) {
            // Validate value based on field type
            let processedValue = value;

            if (
              customField.fieldType === "number" &&
              value !== null &&
              value !== ""
            ) {
              processedValue = parseFloat(value);
              if (isNaN(processedValue)) {
                console.warn(
                  `Invalid number value for field "${customField.fieldLabel}"`
                );
                continue;
              }
            }

            if (customField.fieldType === "email" && value) {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(value)) {
                console.warn(
                  `Invalid email format for field "${customField.fieldLabel}"`
                );
                continue;
              }
            }

            console.log("Creating CustomFieldValue:", {
              fieldId: customField.fieldId,
              entityId: deal.dealId,
              entityType: "deal",
              value:
                typeof processedValue === "object"
                  ? JSON.stringify(processedValue)
                  : String(processedValue),
              masterUserID: req.adminId,
            });

            await CustomFieldValue.create({
              fieldId: customField.fieldId,
              entityId: deal.dealId,
              entityType: "deal",
              value:
                typeof processedValue === "object"
                  ? JSON.stringify(processedValue)
                  : String(processedValue),
              masterUserID: req.adminId,
            });

            // Store the saved custom field for response using fieldName as key
            savedCustomFields[customField.fieldName] = {
              fieldName: customField.fieldName,
              fieldType: customField.fieldType,
              value: processedValue,
            };

            console.log(
              "✅ Custom field saved successfully:",
              customField.fieldName
            );
          } else if (!customField) {
            console.warn(`❌ Custom field not found for key: ${fieldKey}`);
          } else {
            console.warn(`❌ Invalid value for field ${fieldKey}:`, value);
          }
        }
        console.log(
          `🎉 Saved ${
            Object.keys(savedCustomFields).length
          } custom field values for deal ${deal.dealId}`
        );
      } catch (customFieldError) {
        console.error("❌ Error saving custom fields:", customFieldError);
        // Don't fail the deal creation, just log the error
      }
    } else {
      console.log("❌ No potential custom fields found in request body");
    }

    await historyLogger(
      dealProgramId,
      "DEAL_CREATION",
      deal.masterUserID,
      deal.dealId,
      null,
      `Deal is created by ${req.role}`,
      null
    );

    // Prepare response with both default and custom fields
    const dealResponse = {
      ...deal.toJSON(),
      customFields: savedCustomFields,
    };

    res.status(201).json({
      message: "deal created successfully",
      deal: dealResponse,
      customFieldsSaved: Object.keys(savedCustomFields).length,
    });
  } catch (error) {
    console.log("Error creating deal:", error);

    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getDeals = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    sortBy = "createdAt",
    order = "DESC",
    pipeline,
    pipelineStage,
    ownerId,
    masterUserID,
    isArchived,
    filterId,
  } = req.query;

  const offset = (page - 1) * limit;

  try {
    // Build the base where clause
    let where = {};

    // --- Handle column preferences ---
    const pref = await DealColumnPreference.findOne();
    let attributes = [];
    let dealDetailsAttributes = [];

    if (pref && pref.columns) {
      const columns =
        typeof pref.columns === "string"
          ? JSON.parse(pref.columns)
          : pref.columns;

      // Get all Deal and DealDetails fields
      const dealFields = Object.keys(Deal.rawAttributes);
      const dealDetailsFields = DealDetails
        ? Object.keys(DealDetails.rawAttributes)
        : [];

      // Filter checked columns by table
      const checkedColumns = columns.filter((col) => col.check);

      dealFields.forEach((field) => {
        const col = checkedColumns.find((c) => c.key === field);
        if (col) attributes.push(field);
      });

      dealDetailsFields.forEach((field) => {
        const col = checkedColumns.find((c) => c.key === field);
        if (col) dealDetailsAttributes.push(field);
      });

      // Always include dealId for relationships
      if (!attributes.includes("dealId")) {
        attributes.unshift("dealId");
      }
      // Always include status column from database
      if (!attributes.includes("status")) {
        attributes.push("status");
      }

      if (attributes.length === 0) attributes = undefined;
      if (dealDetailsAttributes.length === 0) dealDetailsAttributes = undefined;
    }

    // --- Handle dynamic filtering ---
    let include = [];
    let customFieldsConditions = { all: [], any: [] };

    if (filterId) {
      console.log("Processing filter with filterId:", filterId);

      // Fetch the saved filter
      const filter = await LeadFilter.findByPk(filterId);
      if (!filter) {
        return res.status(404).json({ message: "Filter not found." });
      }

      console.log("Found filter:", filter.filterName);

      const filterConfig =
        typeof filter.filterConfig === "string"
          ? JSON.parse(filter.filterConfig)
          : filter.filterConfig;

      console.log("Filter config:", JSON.stringify(filterConfig, null, 2));

      const { all = [], any = [] } = filterConfig;
      const dealFields = Object.keys(Deal.rawAttributes);
      const dealDetailsFields = Object.keys(DealDetails.rawAttributes);

      let filterWhere = {};
      let dealDetailsWhere = {};

      console.log("Available deal fields:", dealFields);
      console.log("Available dealDetails fields:", dealDetailsFields);

      // Process 'all' conditions (AND logic)
      if (all.length > 0) {
        console.log("Processing 'all' conditions:", all);

        filterWhere[Op.and] = [];
        dealDetailsWhere[Op.and] = [];

        all.forEach((cond) => {
          console.log("Processing condition:", cond);

          if (dealFields.includes(cond.field)) {
            console.log(`Field '${cond.field}' found in Deal fields`);
            filterWhere[Op.and].push(buildCondition(cond));
          } else if (dealDetailsFields.includes(cond.field)) {
            console.log(`Field '${cond.field}' found in DealDetails fields`);
            dealDetailsWhere[Op.and].push(buildCondition(cond));
          } else {
            console.log(
              `Field '${cond.field}' NOT found in standard fields, treating as custom field`
            );
            // Handle custom fields
            customFieldsConditions.all.push(cond);
          }
        });

        if (filterWhere[Op.and].length === 0) delete filterWhere[Op.and];
        if (dealDetailsWhere[Op.and].length === 0)
          delete dealDetailsWhere[Op.and];
      }

      // Process 'any' conditions (OR logic)
      if (any.length > 0) {
        console.log("Processing 'any' conditions:", any);

        filterWhere[Op.or] = [];
        dealDetailsWhere[Op.or] = [];

        any.forEach((cond) => {
          if (dealFields.includes(cond.field)) {
            filterWhere[Op.or].push(buildCondition(cond));
          } else if (dealDetailsFields.includes(cond.field)) {
            dealDetailsWhere[Op.or].push(buildCondition(cond));
          } else {
            // Handle custom fields
            customFieldsConditions.any.push(cond);
          }
        });

        if (filterWhere[Op.or].length === 0) delete filterWhere[Op.or];
        if (dealDetailsWhere[Op.or].length === 0)
          delete dealDetailsWhere[Op.or];
      }

      // Apply masterUserID filtering logic for filters
      if (req.role === "admin") {
        // Admin can filter by specific masterUserID or see all deals
        if (masterUserID && masterUserID !== "all") {
          if (filterWhere[Op.or]) {
            // If there's already an Op.or condition from filters, combine properly
            filterWhere[Op.and] = [
              { [Op.or]: filterWhere[Op.or] },
              {
                [Op.or]: [
                  { masterUserID: masterUserID },
                  { ownerId: masterUserID },
                ],
              },
            ];
            delete filterWhere[Op.or];
          } else {
            filterWhere[Op.or] = [
              { masterUserID: masterUserID },
              { ownerId: masterUserID },
            ];
          }
        }
      } else {
        // Non-admin users: filter by their own deals or specific user if provided
        const userId =
          masterUserID && masterUserID !== "all" ? masterUserID : req.adminId;

        if (filterWhere[Op.or]) {
          // If there's already an Op.or condition from filters, combine properly
          filterWhere[Op.and] = [
            { [Op.or]: filterWhere[Op.or] },
            { [Op.or]: [{ masterUserID: userId }, { ownerId: userId }] },
          ];
          delete filterWhere[Op.or];
        } else {
          filterWhere[Op.or] = [{ masterUserID: userId }, { ownerId: userId }];
        }
      }

      // Add DealDetails include with filtering
      if (Object.keys(dealDetailsWhere).length > 0) {
        include.push({
          model: DealDetails,
          as: "details",
          where: dealDetailsWhere,
          required: true,
          attributes: dealDetailsAttributes,
        });
      } else if (dealDetailsAttributes && dealDetailsAttributes.length > 0) {
        include.push({
          model: DealDetails,
          as: "details",
          required: false,
          attributes: dealDetailsAttributes,
        });
      }

      // Handle custom field filtering
      if (
        customFieldsConditions.all.length > 0 ||
        customFieldsConditions.any.length > 0
      ) {
        console.log(
          "Processing custom field conditions:",
          customFieldsConditions
        );

        // Debug: Show all custom fields in the database
        const allCustomFields = await CustomField.findAll({
          where: {
            isActive: true,
            [Op.or]: [
              { masterUserID: req.adminId },
              { fieldSource: "default" },
              { fieldSource: "system" },
            ],
          },
          attributes: [
            "fieldId",
            "fieldName",
            "entityType",
            "fieldSource",
            "isActive",
            "masterUserID",
          ],
        });

        console.log(
          "All custom fields in database:",
          allCustomFields.map((f) => ({
            fieldId: f.fieldId,
            fieldName: f.fieldName,
            entityType: f.entityType,
            fieldSource: f.fieldSource,
            isActive: f.isActive,
            masterUserID: f.masterUserID,
          }))
        );

        const customFieldFilters = await buildCustomFieldFilters(
          customFieldsConditions,
          req.adminId
        );
        console.log("Built custom field filters:", customFieldFilters);

        if (customFieldFilters.length > 0) {
          // Apply custom field filtering by finding deals that match the custom field conditions
          const matchingDealIds = await getDealIdsByCustomFieldFilters(
            customFieldFilters,
            req.adminId
          );

          console.log(
            "Matching deal IDs from custom field filtering:",
            matchingDealIds
          );

          if (matchingDealIds.length > 0) {
            // If we already have other conditions, combine them
            if (filterWhere[Op.and]) {
              filterWhere[Op.and].push({
                dealId: { [Op.in]: matchingDealIds },
              });
            } else if (filterWhere[Op.or]) {
              filterWhere[Op.and] = [
                { [Op.or]: filterWhere[Op.or] },
                { dealId: { [Op.in]: matchingDealIds } },
              ];
              delete filterWhere[Op.or];
            } else {
              filterWhere.dealId = { [Op.in]: matchingDealIds };
            }
          } else {
            // No deals match the custom field conditions, so return empty result
            console.log(
              "No matching deals found for custom field filters, setting empty result"
            );
            filterWhere.dealId = { [Op.in]: [] };
          }
        } else {
          // Custom field conditions exist but no valid filters were built (field not found)
          console.log(
            "Custom field conditions exist but no valid filters found, setting empty result"
          );
          filterWhere.dealId = { [Op.in]: [] };
        }
      }

      where = filterWhere;
    } else {
      // --- Standard filtering without filterId ---
      // Handle masterUserID filtering based on role
      if (req.role !== "admin") {
        where[Op.or] = [
          { masterUserID: req.adminId },
          { ownerId: req.adminId },
        ];
      } else if (masterUserID && masterUserID !== "all") {
        where[Op.or] = [
          { masterUserID: masterUserID },
          { ownerId: masterUserID },
        ];
      }

      // Basic search functionality
      if (search) {
        where[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { contactPerson: { [Op.like]: `%${search}%` } },
          { organization: { [Op.like]: `%${search}%` } },
        ];
      }

      // Filter by pipeline
      if (pipeline) {
        where.pipeline = pipeline;
      }

      // Filter by pipelineStage
      if (pipelineStage) {
        where.pipelineStage = pipelineStage;
      }

      // Filter by ownerId
      if (ownerId) {
        where.ownerId = ownerId;
      }

      // Add isArchived filter if provided
      if (typeof isArchived !== "undefined") {
        where.isArchived = isArchived === "true";
      }

      // Add default DealDetails include if not added by filtering
      if (dealDetailsAttributes && dealDetailsAttributes.length > 0) {
        include.push({
          model: DealDetails,
          as: "details",
          attributes: dealDetailsAttributes,
          required: false,
        });
      }
    }

    console.log("→ Final where clause:", JSON.stringify(where, null, 2));
    console.log("→ Final include:", JSON.stringify(include, null, 2));

    const { rows: deals, count: total } = await Deal.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [[sortBy, order.toUpperCase()]],
      attributes,
      include,
    });

    console.log("→ Query executed. Total records:", total);

    // Fetch custom field values for all deals
    const dealIds = deals.map((deal) => deal.dealId);

    console.log("→ Fetching custom fields for dealIds:", dealIds);
    console.log("→ Current user adminId:", req.adminId);

    // First, let's check if there are any custom field values for these deals
    const allCustomFieldValues = await CustomFieldValue.findAll({
      where: {
        entityType: "deal",
        entityId: dealIds,
      },
      attributes: [
        "fieldId",
        "entityId",
        "entityType",
        "value",
        "masterUserID",
      ],
    });

    console.log(
      "→ All custom field values for these deals:",
      allCustomFieldValues.length
    );
    allCustomFieldValues.forEach((value) => {
      console.log(
        `  - Deal ${value.entityId}: Field ${value.fieldId} = ${value.value} (MasterUserID: ${value.masterUserID})`
      );
    });

    // Now check custom fields that match our criteria and have dealCheck = true
    const allCustomFields = await CustomField.findAll({
      where: {
        isActive: true,
        entityType: { [Op.in]: ["deal", "both", "lead"] },
        dealCheck: true, // Only include custom fields where dealCheck is true
        [Op.or]: [
          { masterUserID: req.adminId },
          { fieldSource: "default" },
          { fieldSource: "system" },
        ],
      },
      attributes: [
        "fieldId",
        "fieldName",
        "entityType",
        "fieldSource",
        "masterUserID",
        "isActive",
        "dealCheck",
      ],
    });

    console.log(
      "→ Available custom fields with dealCheck=true:",
      allCustomFields.length
    );
    allCustomFields.forEach((field) => {
      console.log(
        `  - ${field.fieldName} (ID: ${field.fieldId}, EntityType: ${field.entityType}, Source: ${field.fieldSource}, MasterUserID: ${field.masterUserID}, dealCheck: ${field.dealCheck})`
      );
    });

    const customFieldValues = await CustomFieldValue.findAll({
      where: {
        entityType: "deal",
        entityId: dealIds,
      },
      include: [
        {
          model: CustomField,
          as: "CustomField",
          where: {
            isActive: true,
            entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support unified fields including lead
            dealCheck: true, // Only include custom fields where dealCheck is true
            [Op.or]: [
              { masterUserID: req.adminId },
              { fieldSource: "default" },
              { fieldSource: "system" },
            ],
          },
          required: true,
        },
      ],
    });

    console.log("→ Found custom field values:", customFieldValues.length);

    console.log("→ Found custom field values:", customFieldValues.length);

    // Group custom field values by dealId
    const customFieldsByDeal = {};
    customFieldValues.forEach((value) => {
      if (!customFieldsByDeal[value.entityId]) {
        customFieldsByDeal[value.entityId] = {};
      }
      customFieldsByDeal[value.entityId][value.CustomField.fieldName] = {
        label: value.CustomField.fieldLabel,
        value: value.value,
        type: value.CustomField.fieldType,
        isImportant: value.CustomField.isImportant,
      };
    });

    console.log(
      "→ Grouped custom fields by deal:",
      Object.keys(customFieldsByDeal).length,
      "deals have custom fields"
    );

    // Debug each deal's custom fields
    Object.keys(customFieldsByDeal).forEach((dealId) => {
      console.log(
        `  - Deal ${dealId} has custom fields:`,
        Object.keys(customFieldsByDeal[dealId])
      );
    });

    // Attach custom fields and status to each deal
    const dealsWithCustomFields = deals.map((deal) => {
      const dealObj = deal.toJSON();

      // Flatten dealDetails into the main deal object if present
      if (dealObj.details) {
        Object.assign(dealObj, dealObj.details);
        delete dealObj.details;
      }

      // Add custom fields
      dealObj.customFields = customFieldsByDeal[dealObj.dealId] || {};

      // Ensure status is present (from deal or details)
      if (!("status" in dealObj)) {
        // Try to get status from original deal instance if not present
        dealObj.status = deal.status || null;
      }

      return dealObj;
    });

    // --- Deal summary calculation (like getDealSummary) ---
    // Use the filtered deals for summary
    const summaryDeals = dealsWithCustomFields;
    // If dealsWithCustomFields is empty, summary will be zeroed
    let totalValue = 0;
    let totalWeightedValue = 0;
    let totalDealCount = 0;
    const currencyMap = {};

    // Fetch pipeline stage probabilities
    let stageProbabilities = {};
    try {
      const pipelineStages = await PipelineStage.findAll({
        attributes: ["stageName", "probability"],
        where: { isActive: true },
      });
      stageProbabilities = pipelineStages.reduce((acc, stage) => {
        acc[stage.stageName] = stage.probability || 0;
        return acc;
      }, {});
    } catch (e) {
      // fallback: all probabilities 0
    }

    summaryDeals.forEach((deal) => {
      const currency = deal.currency;
      const value = deal.value || 0;
      const pipelineStage = deal.pipelineStage;
      if (!currencyMap[currency]) {
        currencyMap[currency] = {
          totalValue: 0,
          weightedValue: 0,
          dealCount: 0,
        };
      }
      currencyMap[currency].totalValue += value;
      currencyMap[currency].weightedValue +=
        (value * (stageProbabilities[pipelineStage] || 0)) / 100;
      currencyMap[currency].dealCount += 1;
      totalValue += value;
      totalWeightedValue +=
        (value * (stageProbabilities[pipelineStage] || 0)) / 100;
      totalDealCount += 1;
    });

    const summary = Object.entries(currencyMap).map(([currency, data]) => ({
      currency,
      totalValue: data.totalValue,
      weightedValue: data.weightedValue,
      dealCount: data.dealCount,
    }));
    summary.sort((a, b) => b.totalValue - a.totalValue);

    res.status(200).json({
      message: "Deals fetched successfully",
      totalDeals: total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      deals: dealsWithCustomFields,
      role: req.role,
      totalValue,
      totalWeightedValue,
      totalDealCount,
      summary,
    });
  } catch (error) {
    console.error("Error fetching deals:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Helper functions for custom field filtering
async function buildCustomFieldFilters(customFieldsConditions, masterUserID) {
  const filters = [];

  // Handle 'all' conditions (AND logic)
  if (customFieldsConditions.all.length > 0) {
    for (const cond of customFieldsConditions.all) {
      console.log("Processing 'all' condition:", cond);

      // Try to find the custom field by fieldName first, then by fieldId
      let customField = null;

      // First try to find by fieldName
      customField = await CustomField.findOne({
        where: {
          fieldName: cond.field,
          entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support unified fields including lead
          isActive: true,
          dealCheck: true, // Only include custom fields where dealCheck is true
          [Op.or]: [
            { masterUserID: masterUserID },
            { fieldSource: "default" },
            { fieldSource: "system" },
          ],
        },
      });

      // If not found by fieldName, try by fieldId
      if (!customField) {
        customField = await CustomField.findOne({
          where: {
            fieldId: cond.field,
            entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support unified fields including lead
            isActive: true,
            dealCheck: true, // Only include custom fields where dealCheck is true
            [Op.or]: [
              { masterUserID: masterUserID },
              { fieldSource: "default" },
              { fieldSource: "system" },
            ],
          },
        });
      }

      console.log(
        "Custom field search result:",
        customField
          ? {
              fieldId: customField.fieldId,
              fieldName: customField.fieldName,
              entityType: customField.entityType,
              fieldSource: customField.fieldSource,
            }
          : "NOT FOUND"
      );

      if (customField) {
        console.log(
          "Found custom field for 'all' condition:",
          customField.fieldName,
          "entityType:",
          customField.entityType
        );
        filters.push({
          fieldId: customField.fieldId,
          condition: cond,
          logicType: "all",
          entityType: customField.entityType,
        });
      } else {
        console.log("Custom field not found for 'all' condition:", cond.field);
      }
    }
  }

  // Handle 'any' conditions (OR logic) - any condition can be met
  if (customFieldsConditions.any.length > 0) {
    for (const cond of customFieldsConditions.any) {
      console.log("Processing 'any' condition:", cond);

      // Try to find the custom field by fieldName first, then by fieldId
      let customField = null;

      // First try to find by fieldName
      customField = await CustomField.findOne({
        where: {
          fieldName: cond.field,
          entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support unified fields including lead
          isActive: true,
          dealCheck: true, // Only include custom fields where dealCheck is true
          [Op.or]: [
            { masterUserID: masterUserID },
            { fieldSource: "default" },
            { fieldSource: "system" },
          ],
        },
      });

      // If not found by fieldName, try by fieldId
      if (!customField) {
        customField = await CustomField.findOne({
          where: {
            fieldId: cond.field,
            entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support unified fields including lead
            isActive: true,
            dealCheck: true, // Only include custom fields where dealCheck is true
            [Op.or]: [
              { masterUserID: masterUserID },
              { fieldSource: "default" },
              { fieldSource: "system" },
            ],
          },
        });
      }

      console.log(
        "Custom field search result:",
        customField
          ? {
              fieldId: customField.fieldId,
              fieldName: customField.fieldName,
              entityType: customField.entityType,
              fieldSource: customField.fieldSource,
            }
          : "NOT FOUND"
      );

      if (customField) {
        console.log(
          "Found custom field for 'any' condition:",
          customField.fieldName,
          "entityType:",
          customField.entityType
        );
        filters.push({
          fieldId: customField.fieldId,
          condition: cond,
          logicType: "any",
          entityType: customField.entityType,
        });
      } else {
        console.log("Custom field not found for 'any' condition:", cond.field);
      }
    }
  }

  return filters;
}

async function getDealIdsByCustomFieldFilters(
  customFieldFilters,
  masterUserID
) {
  if (customFieldFilters.length === 0) return [];

  const allFilters = customFieldFilters.filter((f) => f.logicType === "all");
  const anyFilters = customFieldFilters.filter((f) => f.logicType === "any");

  let dealIds = [];

  // Handle 'all' filters (AND logic) - all conditions must be met
  if (allFilters.length > 0) {
    let allConditionDealIds = null;

    for (const filter of allFilters) {
      const whereCondition = buildCustomFieldCondition(
        filter.condition,
        filter.fieldId
      );

      console.log(
        "Searching for custom field values with condition:",
        whereCondition
      );
      console.log("Filter fieldId:", filter.fieldId);
      console.log("Filter condition:", filter.condition);

      // Search for custom field values - handle different entity types
      const customFieldValues = await CustomFieldValue.findAll({
        where: {
          fieldId: filter.fieldId,
          // Look for values in both deal and lead entity types since some fields might be unified
          entityType: { [Op.in]: ["deal", "lead"] },
          ...whereCondition,
        },
        attributes: ["entityId", "entityType", "value"],
      });

      console.log("Found custom field values:", customFieldValues.length);
      customFieldValues.forEach((cfv) => {
        console.log(
          `  - EntityType: ${cfv.entityType}, EntityId: ${cfv.entityId}, Value: ${cfv.value}`
        );
      });

      let currentDealIds = [];

      // Process each custom field value
      for (const cfv of customFieldValues) {
        if (cfv.entityType === "deal") {
          // Direct deal association
          currentDealIds.push(cfv.entityId);
        } else if (cfv.entityType === "lead") {
          // Lead association - need to find corresponding deal
          // Since leads can be converted to deals, we need to find deals that have this leadId
          try {
            const dealsFromLead = await Deal.findAll({
              where: { leadId: cfv.entityId },
              attributes: ["dealId"],
            });

            dealsFromLead.forEach((deal) => {
              currentDealIds.push(deal.dealId);
            });

            console.log(
              `  - Found ${dealsFromLead.length} deals from lead ${cfv.entityId}`
            );
          } catch (error) {
            console.error("Error finding deals from lead:", error);
          }
        }
      }

      // Remove duplicates
      currentDealIds = [...new Set(currentDealIds)];
      console.log("Current deal IDs for filter:", currentDealIds);

      if (allConditionDealIds === null) {
        allConditionDealIds = currentDealIds;
      } else {
        // Intersection - only keep deals that match all conditions
        allConditionDealIds = allConditionDealIds.filter((id) =>
          currentDealIds.includes(id)
        );
      }
    }

    dealIds = allConditionDealIds || [];
  }

  // Handle 'any' filters (OR logic) - any condition can be met
  if (anyFilters.length > 0) {
    let anyConditionDealIds = [];

    for (const filter of anyFilters) {
      const whereCondition = buildCustomFieldCondition(
        filter.condition,
        filter.fieldId
      );

      const customFieldValues = await CustomFieldValue.findAll({
        where: {
          fieldId: filter.fieldId,
          entityType: { [Op.in]: ["deal", "lead"] }, // Look for values in both deal and lead entity types
          ...whereCondition,
        },
        attributes: ["entityId", "entityType", "value"],
      });

      let currentDealIds = [];

      for (const cfv of customFieldValues) {
        if (cfv.entityType === "deal") {
          currentDealIds.push(cfv.entityId);
        } else if (cfv.entityType === "lead") {
          // Lead association - need to find corresponding deal
          try {
            const dealsFromLead = await Deal.findAll({
              where: { leadId: cfv.entityId },
              attributes: ["dealId"],
            });

            dealsFromLead.forEach((deal) => {
              currentDealIds.push(deal.dealId);
            });
          } catch (error) {
            console.error("Error finding deals from lead:", error);
          }
        }
      }

      currentDealIds = [...new Set(currentDealIds)];
      anyConditionDealIds = [...anyConditionDealIds, ...currentDealIds];
    }

    // Remove duplicates
    anyConditionDealIds = [...new Set(anyConditionDealIds)];

    if (dealIds.length > 0) {
      // If we have both 'all' and 'any' conditions, combine them with AND logic
      dealIds = dealIds.filter((id) => anyConditionDealIds.includes(id));
    } else {
      dealIds = anyConditionDealIds;
    }
  }

  console.log("Final deal IDs from custom field filtering:", dealIds);
  return dealIds;
}

function buildCustomFieldCondition(condition, fieldId) {
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
  };

  let operator = condition.operator;

  // Map operator names to internal operators
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
    "is later than": "gt",
  };

  if (operatorMap[operator]) {
    operator = operatorMap[operator];
  }

  // Handle "is empty" and "is not empty"
  if (operator === "isEmpty") {
    return { value: { [Op.is]: null } };
  }
  if (operator === "isNotEmpty") {
    return { value: { [Op.not]: null, [Op.ne]: "" } };
  }

  // Handle "contains" and "does not contain" for text fields
  if (operator === "like") {
    return { value: { [Op.like]: `%${condition.value}%` } };
  }
  if (operator === "notLike") {
    return { value: { [Op.notLike]: `%${condition.value}%` } };
  }

  // Default condition
  return {
    value: {
      [ops[operator] || Op.eq]: condition.value,
    },
  };
}

// Operator label to backend key mapping
const operatorMap = {
  is: "eq",
  "is not": "ne",
  "is empty": "is empty",
  "is not empty": "is not empty",
  "is exactly or earlier than": "lte",
  "is earlier than": "lt",
  "is exactly or later than": "gte",
  "is later than": "gt",
  // New mappings for frontend operators
  "is before": "lt",
  "is after": "gt",
  "is exactly on or before": "lte",
  "is exactly on or after": "gte",
};

// Helper to build a single condition
function buildCondition(cond) {
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
  };

  let operator = cond.operator;
  if (operatorMap[operator]) {
    operator = operatorMap[operator];
  }

  // Handle "is empty" and "is not empty"
  if (operator === "is empty") {
    return { [cond.field]: { [Op.is]: null } };
  }
  if (operator === "is not empty") {
    return { [cond.field]: { [Op.not]: null, [Op.ne]: "" } };
  }

  // Handle date fields
  const dealDateFields = Object.entries(Deal.rawAttributes)
    .filter(([_, attr]) => attr.type && attr.type.key === "DATE")
    .map(([key]) => key);

  const dealDetailsDateFields = Object.entries(DealDetails.rawAttributes)
    .filter(([_, attr]) => attr.type && attr.type.key === "DATE")
    .map(([key]) => key);

  const allDateFields = [...dealDateFields, ...dealDetailsDateFields];

  if (allDateFields.includes(cond.field)) {
    // Support new date operators
    const dateStr = cond.value;
    if (!dateStr) return {};
    // For exact date (full day)
    if (cond.useExactDate || operator === "eq") {
      const start = new Date(dateStr + "T00:00:00");
      const end = new Date(dateStr + "T23:59:59.999");
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return {};
      return {
        [cond.field]: {
          [Op.between]: [start, end],
        },
      };
    }
    // is before: strictly less than start of day
    if (operator === "lt") {
      const start = new Date(dateStr + "T00:00:00");
      if (isNaN(start.getTime())) return {};
      return {
        [cond.field]: {
          [Op.lt]: start,
        },
      };
    }
    // is after: strictly greater than end of day
    if (operator === "gt") {
      const end = new Date(dateStr + "T23:59:59.999");
      if (isNaN(end.getTime())) return {};
      return {
        [cond.field]: {
          [Op.gt]: end,
        },
      };
    }
    // is exactly on or before: less than or equal to end of day
    if (operator === "lte") {
      const end = new Date(dateStr + "T23:59:59.999");
      if (isNaN(end.getTime())) return {};
      return {
        [cond.field]: {
          [Op.lte]: end,
        },
      };
    }
    // is exactly on or after: greater than or equal to start of day
    if (operator === "gte") {
      const start = new Date(dateStr + "T00:00:00");
      if (isNaN(start.getTime())) return {};
      return {
        [cond.field]: {
          [Op.gte]: start,
        },
      };
    }
    // Otherwise, use relative date conversion
    const dateRange = convertRelativeDate(cond.value);
    const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());

    if (
      dateRange &&
      isValidDate(dateRange.start) &&
      isValidDate(dateRange.end)
    ) {
      return {
        [cond.field]: {
          [Op.between]: [dateRange.start, dateRange.end],
        },
      };
    }
    if (dateRange && isValidDate(dateRange.start)) {
      return {
        [cond.field]: {
          [ops[operator] || Op.eq]: dateRange.start,
        },
      };
    }
  }

  // Handle "contains" for text fields
  if (operator === "like") {
    return { [cond.field]: { [Op.like]: `%${cond.value}%` } };
  }

  // Default condition
  return {
    [cond.field]: {
      [ops[operator] || Op.eq]: cond.value,
    },
  };
}
exports.updateDeal = async (req, res) => {
  try {
    const { dealId } = req.params;

    // Debug: Log the complete request body
    console.log("=== UPDATE DEAL REQUEST DEBUG ===");
    console.log("dealId:", dealId);
    console.log("req.body:", JSON.stringify(req.body, null, 2));
    console.log("req.body type:", typeof req.body);
    console.log("req.body keys:", Object.keys(req.body));
    console.log("req.adminId:", req.adminId);
    console.log("req.role:", req.role);
    console.log("req.user:", req.user);

    const updateFields = { ...req.body };

    // Separate DealDetails fields
    const dealDetailsFields = {};
    if ("statusSummary" in updateFields)
      dealDetailsFields.statusSummary = updateFields.statusSummary;
    if ("responsiblePerson" in updateFields)
      dealDetailsFields.responsiblePerson = updateFields.responsiblePerson;
    if ("rfpReceivedDate" in updateFields)
      dealDetailsFields.rfpReceivedDate = updateFields.rfpReceivedDate;

    // Remove DealDetails fields from main update
    delete updateFields.statusSummary;
    delete updateFields.responsiblePerson;
    delete updateFields.rfpReceivedDate;

    // Update Deal
    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      await logAuditTrail(
        getProgramId("DEALS"),
        "DEAL_UPDATE",
        req.role,
        `Deal update failed: Deal with ID ${dealId} not found.`,
        req.adminId
      );
      return res.status(404).json({ message: "Deal not found." });
    }
    // Check if pipelineStage is changing
    // Only check for pipelineStage if it's in the request body
    if (
      updateFields.pipelineStage &&
      updateFields.pipelineStage !== deal.pipelineStage
    ) {
      await DealStageHistory.create({
        dealId: deal.dealId,
        stageName: updateFields.pipelineStage,
        enteredAt: new Date(),
      });
    }
    await deal.update({ ...updateFields });

    // Update or create DealDetails
    if (Object.keys(dealDetailsFields).length > 0) {
      let dealDetails = await DealDetails.findOne({ where: { dealId } });
      if (dealDetails) {
        await dealDetails.update(dealDetailsFields);
      } else {
        await DealDetails.create({ dealId, ...dealDetailsFields });
      }
    }

    // Update all fields of Person
    if (deal.personId) {
      const person = await Person.findByPk(deal.personId);
      if (person) {
        // Only update fields that exist in the Person model
        const personAttributes = Object.keys(Person.rawAttributes);
        const personUpdate = {};
        for (const key of personAttributes) {
          if (key in req.body) {
            personUpdate[key] = req.body[key];
          }
        }
        if (Object.keys(personUpdate).length > 0) {
          await person.update(personUpdate);
        }
      }
    }

    // Update all fields of Organization
    if (deal.leadOrganizationId) {
      const org = await Organization.findByPk(deal.leadOrganizationId);
      if (org) {
        // Only update fields that exist in the Organization model
        const orgAttributes = Object.keys(Organization.rawAttributes);
        const orgUpdate = {};
        for (const key of orgAttributes) {
          if (key in req.body) {
            orgUpdate[key] = req.body[key];
          }
        }
        if (Object.keys(orgUpdate).length > 0) {
          await org.update(orgUpdate);
        }
      }
    }

    // Handle custom fields update - Check for custom fields directly in req.body
    let updatedCustomFields = {};

    console.log("=== CUSTOM FIELDS UPDATE DEBUG ===");
    console.log("req.adminId:", req.adminId);
    console.log("dealId:", dealId);

    // Get all available custom fields for this user
    const availableCustomFields = await CustomField.findAll({
      where: {
        entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support unified fields
        isActive: true,
        [Op.or]: [
          { masterUserID: req.adminId },
          { fieldSource: "default" },
          { fieldSource: "system" },
        ],
      },
    });

    console.log(
      "Available custom fields:",
      availableCustomFields.map((f) => f.fieldName)
    );

    if (availableCustomFields.length > 0) {
      try {
        // Check each available custom field to see if it's in the request body
        for (const customField of availableCustomFields) {
          const fieldName = customField.fieldName;

          // Check if this field is in the request body
          if (fieldName in req.body) {
            const value = req.body[fieldName];

            console.log(`\n--- Processing field: ${fieldName} = ${value} ---`);
            console.log("CustomField found:", {
              fieldId: customField.fieldId,
              fieldName: customField.fieldName,
              fieldType: customField.fieldType,
              entityType: customField.entityType,
              isActive: customField.isActive,
              masterUserID: customField.masterUserID,
              fieldSource: customField.fieldSource,
            });

            if (value !== null && value !== undefined) {
              // Validate value based on field type
              let processedValue = value;

              if (
                customField.fieldType === "number" &&
                value !== null &&
                value !== ""
              ) {
                processedValue = parseFloat(value);
                if (isNaN(processedValue)) {
                  console.warn(
                    `Invalid number value for field "${customField.fieldLabel}"`
                  );
                  continue;
                }
              }

              if (customField.fieldType === "email" && value) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                  console.warn(
                    `Invalid email format for field "${customField.fieldLabel}"`
                  );
                  continue;
                }
              }

              // Handle empty values (allow clearing fields)
              if (value === "" || value === null) {
                processedValue = null;
              }

              console.log("Processing custom field value:", {
                fieldId: customField.fieldId,
                fieldName: customField.fieldName,
                dealId: dealId,
                processedValue: processedValue,
                originalValue: value,
              });

              // Find or create the field value
              let fieldValue = await CustomFieldValue.findOne({
                where: {
                  fieldId: customField.fieldId,
                  entityId: dealId,
                  entityType: "deal",
                },
              });

              if (fieldValue) {
                // Update existing value
                if (processedValue === null || processedValue === "") {
                  // Delete the field value if it's being cleared
                  await fieldValue.destroy();
                  console.log(
                    `✅ Deleted custom field value for: ${customField.fieldName}`
                  );
                } else {
                  await fieldValue.update({
                    value:
                      typeof processedValue === "object"
                        ? JSON.stringify(processedValue)
                        : String(processedValue),
                  });
                  console.log(
                    `✅ Updated custom field value for: ${customField.fieldName}`
                  );
                }
              } else if (processedValue !== null && processedValue !== "") {
                // Create new value only if it's not empty
                await CustomFieldValue.create({
                  fieldId: customField.fieldId,
                  entityId: dealId,
                  entityType: "deal",
                  value:
                    typeof processedValue === "object"
                      ? JSON.stringify(processedValue)
                      : String(processedValue),
                  masterUserID: req.adminId,
                });
                console.log(
                  `✅ Created new custom field value for: ${customField.fieldName}`
                );
              }

              // Store the updated custom field for response
              updatedCustomFields[customField.fieldName] = {
                fieldName: customField.fieldName,
                fieldType: customField.fieldType,
                value: processedValue,
              };

              // Remove the custom field from updateFields to prevent it from being updated in the main Deal table
              delete updateFields[fieldName];
            } else {
              console.warn(`❌ Invalid value for field ${fieldName}:`, value);
            }
          }
        }

        console.log(
          `🎉 Updated ${
            Object.keys(updatedCustomFields).length
          } custom field values for deal ${dealId}`
        );
      } catch (customFieldError) {
        console.error("❌ Error updating custom fields:", customFieldError);
        // Don't fail the deal update, just log the error
      }
    } else {
      console.log("❌ No custom fields available for this user");
    }

    // After all updates and before sending the response:
    const updatedDeal = await Deal.findByPk(dealId, {
      include: [
        { model: DealDetails, as: "details" },
        { model: Person, as: "Person" },
        { model: Organization, as: "Organization" },
      ],
    });

    // Calculate pipeline stage days
    const stageHistory = await DealStageHistory.findAll({
      where: { dealId },
      order: [["enteredAt", "ASC"]],
    });

    const now = new Date();
    const pipelineStages = [];
    for (let i = 0; i < stageHistory.length; i++) {
      const stage = stageHistory[i];
      const nextStage = stageHistory[i + 1];
      const start = new Date(stage.enteredAt);
      const end = nextStage ? new Date(nextStage.enteredAt) : now;
      const days = Math.max(
        0,
        Math.floor((end - start) / (1000 * 60 * 60 * 24))
      );
      pipelineStages.push({
        stageName: stage.stageName,
        days,
      });
    }
    const pipelineOrder = [
      "Qualified",
      "Contact Made",
      "Proposal Made",
      "Negotiations Started",
    ];

    const stageDaysMap = new Map();
    for (const stage of pipelineStages) {
      if (!stageDaysMap.has(stage.stageName)) {
        stageDaysMap.set(stage.stageName, stage.days);
      } else {
        stageDaysMap.set(
          stage.stageName,
          stageDaysMap.get(stage.stageName) + stage.days
        );
      }
    }

    let currentStageName = pipelineStages.length
      ? pipelineStages[pipelineStages.length - 1].stageName
      : null;

    let pipelineStagesUnique = [];
    if (currentStageName && pipelineOrder.includes(currentStageName)) {
      const currentIdx = pipelineOrder.indexOf(currentStageName);
      pipelineStagesUnique = pipelineOrder
        .slice(0, currentIdx + 1)
        .map((stageName) => ({
          stageName,
          days: stageDaysMap.get(stageName) || 0,
        }));
    }

    //res.status(200).json({ message: "Deal, person, and organization updated successfully",deal });
    await historyLogger(
      getProgramId("DEALS"),
      "DEAL_UPDATE",
      req.adminId,
      deal.dealId,
      null,
      `Deal updated by ${req.role}`,
      null
    );

    // Prepare response with updated custom fields
    const dealResponse = {
      ...updatedDeal.toJSON(),
      customFields: updatedCustomFields,
    };

    res.status(200).json({
      message: "Deal, person, and organization updated successfully",
      deal: dealResponse,
      person: updatedDeal.Person ? [updatedDeal.Person] : [],
      organization: updatedDeal.Organization ? [updatedDeal.Organization] : [],
      pipelineStages: pipelineStagesUnique,
      currentStage: currentStageName,
      customFieldsUpdated: Object.keys(updatedCustomFields).length,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Internal server error" });
  }
};

// exports.getDealSummary = async (req, res) => {
//   try {
//     // 1. Per-currency summary
//     const currencySummary = await Deal.findAll({
//       attributes: [
//         "currency",
//         [fn("SUM", col("value")), "totalValue"],
//         // Replace with your actual weighted value logic if needed
//         [fn("SUM", col("value")), "weightedValue"],
//         [fn("COUNT", col("dealId")), "dealCount"]
//       ],
//       group: ["currency"]
//     });

//     // 2. Overall summary
//     const overall = await Deal.findAll({
//       attributes: [
//         [fn("SUM", col("value")), "totalValue"],
//         [fn("SUM", col("value")), "weightedValue"],
//         [fn("COUNT", col("dealId")), "dealCount"]
//       ]
//     });

//     res.status(200).json({
//       overall: overall[0],         // { totalValue, weightedValue, dealCount }
//       currencySummary              // array of per-currency summaries
//     });
//   } catch (error) {
//     console.log(error);

//     res.status(500).json({ message: "Internal server error" });
//   }
// };
exports.getDealSummary = async (req, res) => {
  try {
    // Fetch all deals with value, currency, and pipelineStage
    const deals = await Deal.findAll({
      attributes: ["value", "currency", "pipelineStage"],
      raw: true,
    });

    // Probabilities for each stage
    // Fetch dynamic probabilities from pipeline stages
    const pipelineStages = await PipelineStage.findAll({
      attributes: ["stageName", "probability"],
      where: { isActive: true },
    });

    const stageProbabilities = pipelineStages.reduce((acc, stage) => {
      acc[stage.stageName] = stage.probability || 0;
      return acc;
    }, {});

    // Group deals by currency
    const currencyMap = {};

    let totalValue = 0;
    let totalWeightedValue = 0;
    let totalDealCount = 0;

    deals.forEach((deal) => {
      const { currency, value, pipelineStage } = deal;
      if (!currencyMap[currency]) {
        currencyMap[currency] = {
          totalValue: 0,
          weightedValue: 0,
          dealCount: 0,
        };
      }
      currencyMap[currency].totalValue += value || 0;
      currencyMap[currency].weightedValue +=
        ((value || 0) * (stageProbabilities[pipelineStage] || 0)) / 100;
      currencyMap[currency].dealCount += 1;

      totalValue += value || 0;
      totalWeightedValue +=
        ((value || 0) * (stageProbabilities[pipelineStage] || 0)) / 100;
      totalDealCount += 1;
    });

    // Format result as array
    const summary = Object.entries(currencyMap).map(([currency, data]) => ({
      currency,
      totalValue: data.totalValue,
      weightedValue: data.weightedValue,
      dealCount: data.dealCount,
    }));

    // Optionally, sort by totalValue descending
    summary.sort((a, b) => b.totalValue - a.totalValue);

    res.status(200).json({
      totalValue,
      totalWeightedValue,
      totalDealCount,
      summary,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.archiveDeal = async (req, res) => {
  try {
    const { dealId } = req.params;
    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }
    await deal.update({ isArchived: true });
    res.status(200).json({ message: "Deal archived successfully.", deal });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Internal server error" });
  }
};
exports.unarchiveDeal = async (req, res) => {
  try {
    const { dealId } = req.params;
    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }
    await deal.update({ isArchived: false });
    res.status(200).json({ message: "Deal unarchived successfully.", deal });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getDealsByStage = async (req, res) => {
  try {
    const allStages = [
      "Qualified",
      "Contact Made",
      "Proposal Made",
      "Negotiations Started",
      // ...add all your stages here
    ];

    const result = [];
    let totalDeals = 0;

    for (const stage of allStages) {
      const deals = await Deal.findAll({
        where: { pipelineStage: stage },
        order: [["createdAt", "DESC"]],
      });

      const totalValue = deals.reduce(
        (sum, deal) => sum + (deal.value || 0),
        0
      );
      const dealCount = deals.length;
      totalDeals += dealCount;

      result.push({
        stage,
        totalValue,
        dealCount,
        deals,
      });
    }

    res.status(200).json({
      totalDeals,
      stages: result,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

//this latest version of getDealsByStage function is used to get deals by stage with rotten days logic

// exports.getDealsByStage = async (req, res) => {
//   try {
//     // Get dynamic stages from pipeline system, fallback to hardcoded if needed
//     const Pipeline = require("../../models/deals/pipelineModel");
//     const PipelineStage = require("../../models/deals/pipelineStageModel");

//     let allStages = [
//       "Qualified",
//       "Contact Made",
//       "Proposal Made",
//       "Negotiations Started",
//     ];

//     // Apply user filtering for non-admin users
//     let baseWhere = {};
//     if (req.role !== "admin") {
//       baseWhere.masterUserID = req.adminId;
//     }

//     // Try to get stages from pipeline system with rotten days info
//     let stageRottenDaysMap = new Map();
//     try {
//       const masterUserID = req.adminId;
//       const defaultPipeline = await Pipeline.findOne({
//         where: {
//           masterUserID,
//           isDefault: true,
//           isActive: true,
//         },
//         include: [
//           {
//             model: PipelineStage,
//             as: "stages",
//             where: { isActive: true },
//             required: false,
//             order: [["stageOrder", "ASC"]],
//           },
//         ],
//       });

//       if (
//         defaultPipeline &&
//         defaultPipeline.stages &&
//         defaultPipeline.stages.length > 0
//       ) {
//         allStages = defaultPipeline.stages.map((stage) => stage.stageName);
//         // Create map of stage name to rotten days
//         defaultPipeline.stages.forEach((stage) => {
//           stageRottenDaysMap.set(stage.stageName, {
//             dealRottenDays: stage.dealRottenDays,
//             stageColor: stage.color,
//           });
//         });
//       }
//     } catch (pipelineError) {
//       console.log(
//         "Pipeline system not available, using hardcoded stages:",
//         pipelineError.message
//       );
//     }

//     const result = [];
//     let totalDeals = 0;

//     for (const stage of allStages) {
//       const deals = await Deal.findAll({
//         where: {
//           ...baseWhere,
//           pipelineStage: stage,
//         },
//         order: [["createdAt", "DESC"]],
//       });

//       // Process deals with rotten logic
//       const processedDeals = deals.map((deal) => {
//         const dealObj = deal.toJSON();
//         const stageInfo = stageRottenDaysMap.get(stage);

//         if (stageInfo && stageInfo.dealRottenDays) {
//           // Calculate days since deal entered this stage
//           const daysSinceCreated = Math.floor(
//             (new Date() - new Date(deal.createdAt)) / (1000 * 60 * 60 * 24)
//           );

//           const isRotten = daysSinceCreated > stageInfo.dealRottenDays;

//           // Add rotten deal indicators
//           dealObj.daysSinceCreated = daysSinceCreated;
//           dealObj.isRotten = isRotten;
//           dealObj.dealRottenDays = stageInfo.dealRottenDays;
//           dealObj.daysOverdue = isRotten
//             ? daysSinceCreated - stageInfo.dealRottenDays
//             : 0;

//           // Change color for rotten deals
//           dealObj.displayColor = isRotten ? "#FF4444" : stageInfo.stageColor; // Red for rotten
//           dealObj.rottenStatus = isRotten ? "rotten" : "fresh";
//         } else {
//           // No rotten days configured
//           dealObj.isRotten = false;
//           dealObj.rottenStatus = "fresh";
//           dealObj.displayColor = stageInfo?.stageColor || "#007BFF";
//         }

//         return dealObj;
//       });

//       // Calculate stage statistics including rotten deals
//       const rottenDealsCount = processedDeals.filter(
//         (deal) => deal.isRotten
//       ).length;
//       const totalValue = processedDeals.reduce(
//         (sum, deal) => sum + (deal.value || 0),
//         0
//       );
//       const dealCount = processedDeals.length;
//       totalDeals += dealCount;

//       // Get stage info for display
//       const stageInfo = stageRottenDaysMap.get(stage);

//       result.push({
//         stage,
//         totalValue,
//         dealCount,
//         rottenDealsCount,
//         freshDealsCount: dealCount - rottenDealsCount,
//         rottenPercentage:
//           dealCount > 0 ? Math.round((rottenDealsCount / dealCount) * 100) : 0,
//         deals: processedDeals,
//         stageInfo: {
//           dealRottenDays: stageInfo?.dealRottenDays || null,
//           stageColor: stageInfo?.stageColor || "#007BFF",
//           hasRottenDaysConfigured: !!stageInfo?.dealRottenDays,
//         },
//       });
//     }

//     res.status(200).json({
//       totalDeals,
//       stages: result,
//       rottenDealsInfo: {
//         description:
//           "Deals are marked as 'rotten' when they exceed the configured days for their stage",
//         colorCoding: {
//           fresh: "Original stage color",
//           rotten: "#FF4444 (Red)",
//         },
//       },
//     });
//   } catch (error) {
//     console.error("Error in getDealsByStage:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// this function is latest version of getDealsByStage

// exports.getDealsByStage = async (req, res) => {
//   try {
//     // Get dynamic stages from pipeline system, fallback to hardcoded if needed
//     const Pipeline = require("../../models/deals/pipelineModel");
//     const PipelineStage = require("../../models/deals/pipelineStageModel");

//     let allStages = [
//       "Qualified",
//       "Contact Made",
//       "Proposal Made",
//       "Negotiations Started",
//     ];

//     // Try to get stages from pipeline system
//     try {
//       const masterUserID = req.adminId;
//       const defaultPipeline = await Pipeline.findOne({
//         where: {
//           masterUserID,
//           isDefault: true,
//           isActive: true,
//         },
//         include: [
//           {
//             model: PipelineStage,
//             as: "stages",
//             where: { isActive: true },
//             required: false,
//             order: [["stageOrder", "ASC"]],
//           },
//         ],
//       });

//       if (
//         defaultPipeline &&
//         defaultPipeline.stages &&
//         defaultPipeline.stages.length > 0
//       ) {
//         allStages = defaultPipeline.stages.map((stage) => stage.stageName);
//       }
//     } catch (pipelineError) {
//       console.log(
//         "Pipeline system not available, using hardcoded stages:",
//         pipelineError.message
//       );
//     }

//     const result = [];
//     let totalDeals = 0;

//     // Apply user filtering for non-admin users
//     let baseWhere = {};
//     if (req.role !== "admin") {
//       baseWhere.masterUserID = req.adminId;
//     }

//     for (const stage of allStages) {
//       const deals = await Deal.findAll({
//         where: {
//           ...baseWhere,
//           pipelineStage: stage,
//         },
//         order: [["createdAt", "DESC"]],
//       });

//       const totalValue = deals.reduce(
//         (sum, deal) => sum + (deal.value || 0),
//         0
//       );
//       const dealCount = deals.length;
//       totalDeals += dealCount;

//       result.push({
//         stage,
//         totalValue,
//         dealCount,
//         deals,
//       });
//     }

//     res.status(200).json({
//       totalDeals,
//       stages: result,
//     });
//   } catch (error) {
//     console.error("Error in getDealsByStage:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// ...existing code...
exports.getDealDetail = async (req, res) => {
  try {
    const { dealId } = req.params;

    // Email optimization parameters
    const { emailPage = 1, emailLimit = 10 } = req.query;
    const emailOffset = (parseInt(emailPage) - 1) * parseInt(emailLimit);
    const MAX_EMAIL_LIMIT = 50;
    const safeEmailLimit = Math.min(parseInt(emailLimit), MAX_EMAIL_LIMIT);

    const deal = await Deal.findByPk(dealId, {
      include: [
        { model: DealDetails, as: "details" },
        { model: Person, as: "Person" },
        { model: Organization, as: "Organization" },
      ],
    });

    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }

    // Enhanced Pipeline Stage Processing like Pipedrive
    const stageHistory = await DealStageHistory.findAll({
      where: { dealId },
      order: [["enteredAt", "ASC"]],
    });

    const now = new Date();
    const dealCreatedAt = new Date(deal.createdAt);

    // Define your complete pipeline order (customize as needed)
    const pipelineOrder = [
      "Qualified",
      "Contact Made",
      "Proposal Made",
      "Negotiations Started",
      "Won",
      "Lost",
    ];

    // Initialize pipeline stages with comprehensive tracking
    let pipelineStagesDetail = [];
    let currentStageName = deal.pipelineStage || "Qualified";
    let totalDealDays = Math.floor(
      (now - dealCreatedAt) / (1000 * 60 * 60 * 24)
    );

    // Process stage history to calculate time spent in each stage
    if (stageHistory.length > 0) {
      // Calculate time spent in each historical stage
      for (let i = 0; i < stageHistory.length; i++) {
        const stage = stageHistory[i];
        const nextStage = stageHistory[i + 1];
        const stageStart = new Date(stage.enteredAt);
        const stageEnd = nextStage ? new Date(nextStage.enteredAt) : now;

        // Calculate days spent in this stage
        const daysInStage = Math.max(
          0,
          Math.floor((stageEnd - stageStart) / (1000 * 60 * 60 * 24))
        );

        // Calculate hours and minutes for more precision
        const totalMinutes = Math.floor((stageEnd - stageStart) / (1000 * 60));
        const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
        const minutes = totalMinutes % 60;

        pipelineStagesDetail.push({
          stageName: stage.stageName,
          enteredAt: stage.enteredAt,
          exitedAt: nextStage ? nextStage.enteredAt : null,
          days: daysInStage,
          hours: hours,
          minutes: minutes,
          totalMinutes: totalMinutes,
          isActive: !nextStage, // Current stage if no next stage
          stageOrder: pipelineOrder.indexOf(stage.stageName),
        });
      }

      // Update current stage name from the last history entry
      currentStageName = stageHistory[stageHistory.length - 1].stageName;
    } else {
      // If no stage history, deal is still in initial stage
      const daysInCurrentStage = Math.floor(
        (now - dealCreatedAt) / (1000 * 60 * 60 * 24)
      );
      const totalMinutes = Math.floor((now - dealCreatedAt) / (1000 * 60));
      const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
      const minutes = totalMinutes % 60;

      pipelineStagesDetail.push({
        stageName: currentStageName,
        enteredAt: deal.createdAt,
        exitedAt: null,
        days: daysInCurrentStage,
        hours: hours,
        minutes: minutes,
        totalMinutes: totalMinutes,
        isActive: true,
        stageOrder: pipelineOrder.indexOf(currentStageName),
      });
    }

    // Create aggregated stages map for duplicate stage handling
    const stageDaysMap = new Map();
    const stageDetailsMap = new Map();

    pipelineStagesDetail.forEach((stage) => {
      if (!stageDaysMap.has(stage.stageName)) {
        stageDaysMap.set(stage.stageName, stage.days);
        stageDetailsMap.set(stage.stageName, {
          ...stage,
          totalDays: stage.days,
          visits: 1,
          firstEntry: stage.enteredAt,
          lastEntry: stage.enteredAt,
        });
      } else {
        // Handle multiple visits to the same stage
        const existingDays = stageDaysMap.get(stage.stageName);
        const existingDetails = stageDetailsMap.get(stage.stageName);

        stageDaysMap.set(stage.stageName, existingDays + stage.days);
        stageDetailsMap.set(stage.stageName, {
          ...existingDetails,
          totalDays: existingDays + stage.days,
          visits: existingDetails.visits + 1,
          lastEntry: stage.enteredAt,
          isActive: stage.isActive || existingDetails.isActive,
        });
      }
    });

    // Create pipeline stages for frontend (Pipedrive-like structure)
    const currentStageIndex = pipelineOrder.indexOf(currentStageName);

    const pipelineStagesUnique = pipelineOrder.map((stageName, index) => {
      const stageData = stageDetailsMap.get(stageName);
      const days = stageDaysMap.get(stageName) || 0;

      // Determine if this stage should be shown based on current stage
      const shouldShow = index <= currentStageIndex;

      // For stages that haven't been visited but are before current stage,
      // show them as completed with 0 days
      const hasBeenVisited = stageDetailsMap.has(stageName);
      const isBeforeCurrentStage = index < currentStageIndex;
      const isCurrentStage = index === currentStageIndex;

      return {
        stageName,
        days,
        hours: stageData?.hours || 0,
        minutes: stageData?.minutes || 0,
        totalMinutes: stageData?.totalMinutes || 0,
        isActive: stageData?.isActive || false,
        isCurrent: isCurrentStage,
        isPassed: isBeforeCurrentStage || (hasBeenVisited && !isCurrentStage),
        isFuture: index > currentStageIndex,
        visits: stageData?.visits || 0,
        firstEntry: stageData?.firstEntry || null,
        lastEntry: stageData?.lastEntry || null,
        stageOrder: index,
        hasBeenVisited,
        shouldShow,
        // Add percentage of total time spent
        percentage:
          totalDealDays > 0 ? Math.round((days / totalDealDays) * 100) : 0,
      };
    });

    // Add pipeline insights (like Pipedrive)
    const visitedStages = pipelineStagesUnique.filter((s) => s.hasBeenVisited);

    const pipelineInsights = {
      totalDealAge: totalDealDays,
      currentStage: currentStageName,
      currentStageIndex: currentStageIndex,
      currentStageDays:
        pipelineStagesUnique.find((s) => s.isCurrent)?.days || 0,
      stagesCompleted: pipelineStagesUnique.filter((s) => s.isPassed).length,
      stagesVisited: visitedStages.length,
      totalStages: pipelineOrder.length,
      progressPercentage: Math.round(
        ((currentStageIndex + 1) / pipelineOrder.length) * 100
      ),
      stageChanges: pipelineStagesDetail.length,
      averageDaysPerStage:
        visitedStages.length > 0
          ? Math.round(totalDealDays / visitedStages.length)
          : 0,
      // Add stage completion timeline
      stageTimeline: pipelineStagesUnique.map((stage) => ({
        stageName: stage.stageName,
        status: stage.isCurrent
          ? "current"
          : stage.isPassed
          ? "completed"
          : "future",
        days: stage.days,
        percentage: stage.percentage,
      })),
    };

    // Calculate avgTimeToWon for all won deals
    const wonDeals = await Deal.findAll({ where: { status: "won" } });
    let avgTimeToWon = 0;
    if (wonDeals.length) {
      const totalDays = wonDeals.reduce((sum, d) => {
        if (d.wonDate && d.createdAt) {
          const days = Math.floor(
            (d.wonDate - d.createdAt) / (1000 * 60 * 60 * 24)
          );
          return sum + days;
        }
        return sum;
      }, 0);
      avgTimeToWon = Math.round(totalDays / wonDeals.length);
    }

    // Overview calculations
    const createdAt = deal.createdAt;
    const dealAgeDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
    const dealAge = dealAgeDays < 1 ? "< 1 day" : `${dealAgeDays} days`;
    const inactiveDays = 0; // Placeholder until you have activities

    // Send all person data
    const personArr = deal.Person
      ? [deal.Person.toJSON ? deal.Person.toJSON() : deal.Person]
      : [];

    // Send all organization data
    const orgArr = deal.Organization
      ? [
          deal.Organization.toJSON
            ? deal.Organization.toJSON()
            : deal.Organization,
        ]
      : [];

    // Flat deal object (as before)
    const dealObj = {
      dealId: deal.dealId,
      title: deal.title,
      value: deal.value,
      pipeline: deal.pipeline,
      pipelineStage: deal.pipelineStage,
      status: deal.status || "open",
      createdAt: deal.createdAt,
      expectedCloseDate: deal.expectedCloseDate,
      serviceType: deal.serviceType,
      proposalValue: deal.proposalValue,
      esplProposalNo: deal.esplProposalNo,
      projectLocation: deal.projectLocation,
      organizationCountry: deal.organizationCountry,
      proposalSentDate: deal.proposalSentDate,
      sourceOrgin: deal.sourceOrgin,
      sourceChannel: deal.sourceChannel,
      sourceChannelId: deal.sourceChannelId,
      statusSummary: deal.details?.statusSummary,
      responsiblePerson: deal.details?.responsiblePerson,
      rfpReceivedDate: deal.details?.rfpReceivedDate,
      wonTime: deal.details?.wonTime,
      lostTime: deal.details?.lostTime,
      lostReason: deal.details?.lostReason,
      // ...other deal fields
    };

    // Fetch participants for this deal
    const participants = await DealParticipant.findAll({
      where: { dealId },
      include: [
        {
          model: Person,
          as: "Person",
          attributes: ["personId", "contactPerson", "email"],
        },
        {
          model: Organization,
          as: "Organization",
          attributes: ["leadOrganizationId", "organization", "masterUserID"],
        },
      ],
    });

    const participantArr = await Promise.all(
      participants.map(async (p) => {
        const person = p.Person;
        const organization = p.Organization;

        let closedDeals = 0,
          openDeals = 0,
          ownerName = null;

        if (person) {
          closedDeals = await Deal.count({
            where: { personId: person.personId, status: "won" },
          });
          openDeals = await Deal.count({
            where: { personId: person.personId, status: "open" },
          });
          console.log(
            "Person found:",
            person.contactPerson,
            "Closed Deals:",
            closedDeals,
            "Open Deals:",
            openDeals
          );

          // Use ownerId or masterUserID from organization
          console.log(organization.masterUserID, " organization masterUserID");
          console.log(organization, " organization");

          let ownerIdToUse = organization
            ? organization.ownerId || organization.masterUserID
            : null;
          console.log(ownerIdToUse, " ownerIdToUse");

          if (ownerIdToUse) {
            const owner = await MasterUser.findOne({
              where: { masterUserID: ownerIdToUse },
            });
            ownerName = owner ? owner.name : null;
          }
        }

        return {
          name: person ? person.contactPerson : null,
          organization: organization ? organization.organization : null,
          email: person ? person.email : null,
          phone: person ? person.phone : null,
          closedDeals,
          openDeals,
          owner: ownerName,
        };
      })
    );

    // Optimized email fetching with pagination
    // Get total email count first
    const totalEmailsCount = await Email.count({
      where: {
        [Op.or]: [
          { dealId },
          ...(deal.email
            ? [
                { sender: deal.email },
                { recipient: { [Op.like]: `%${deal.email}%` } },
              ]
            : []),
        ],
      },
    });

    // Fetch emails linked to this deal with pagination and essential fields only
    const emailsByDeal = await Email.findAll({
      where: { dealId },
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

    // Fetch emails by address with pagination and essential fields only
    let emailsByAddress = [];
    if (deal.email) {
      emailsByAddress = await Email.findAll({
        where: {
          [Op.or]: [
            { sender: deal.email },
            { recipient: { [Op.like]: `%${deal.email}%` } },
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

    // Merge and deduplicate emails
    const allEmailsMap = new Map();
    emailsByDeal.forEach((email) => allEmailsMap.set(email.emailID, email));
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

    // Fetch notes for this deal
    let notes = await DealNote.findAll({
      where: { dealId },
      limit: 20,
      order: [["createdAt", "DESC"]],
    });
    let leadNotes = [];
    if (deal.leadId) {
      leadNotes = await LeadNote.findAll({
        where: { leadId: deal.leadId },
        limit: 20,
        order: [["createdAt", "DESC"]],
      });
    }
    if (leadNotes.length > 0) {
      const noteMap = new Map();
      notes.forEach((n) => noteMap.set(n.noteId || n.id, n));
      leadNotes.forEach((n) => noteMap.set(n.noteId || n.id, n));
      notes = Array.from(noteMap.values());
    }

    // Fetch activities for this deal and its linked lead (if any)
    // Fetch activities for this deal and its linked lead (if any) using Activity model
    let activities = await Activity.findAll({
      where: {
        [Op.or]: [
          { dealId },
          deal.leadId ? { leadId: deal.leadId } : null,
        ].filter(Boolean),
      },
      limit: 40, // fetch more to cover both
      order: [["startDateTime", "DESC"]],
    });
    // Deduplicate activities by activityId or id
    if (activities.length > 0) {
      const actMap = new Map();
      activities.forEach((a) => actMap.set(a.activityId || a.id, a));
      activities = Array.from(actMap.values());
    }

    // Fetch custom field values for this deal
    const customFieldValues = await CustomFieldValue.findAll({
      where: {
        entityId: dealId.toString(),
        entityType: "deal",
        masterUserID: req.adminId,
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

    // Format custom fields
    const formattedCustomFields = {};
    const fieldsByCategory = {};
    const fieldsByGroup = {};

    customFieldValues.forEach((value) => {
      const field = value.CustomField;
      const category = field.category || "Details";
      const fieldGroup = field.fieldGroup || "Default";

      formattedCustomFields[field.fieldId] = {
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
      fieldsByCategory[category].push(formattedCustomFields[field.fieldId]);

      if (!fieldsByGroup[fieldGroup]) {
        fieldsByGroup[fieldGroup] = [];
      }
      fieldsByGroup[fieldGroup].push(formattedCustomFields[field.fieldId]);
    });

    console.log(
      `Deal detail: ${optimizedEmails.length} emails, ${files.length} files, ${notes.length} notes, ${activities.length} activities`
    );
    console.log(
      `Pipeline: ${currentStageName} (${pipelineInsights.currentStageDays} days), Total: ${pipelineInsights.totalDealAge} days, Progress: ${pipelineInsights.progressPercentage}%`
    );
    console.log(
      `Stages:`,
      pipelineStagesUnique.map((s) => `${s.stageName}:${s.days}d`).join(", ")
    );

    res.status(200).json({
      deal: dealObj,
      person: personArr,
      organization: orgArr,
      pipelineStages: pipelineStagesUnique, // Enhanced pipeline stages like Pipedrive (but maintains frontend compatibility)
      currentStage: currentStageName,
      overview: {
        dealAge: `${totalDealDays} days`,
        avgTimeToWon,
        inactiveDays,
        createdAt,
        totalDealDays,
      },
      participants: participantArr,
      emails: optimizedEmails,
      notes,
      activities,
      files,
      customFields: {
        values: formattedCustomFields,
        fieldsByCategory,
        fieldsByGroup,
      },
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
      // Enhanced pipeline data (optional for frontend to use)
      _pipelineMetadata: {
        pipelineStagesDetail: pipelineStagesDetail, // Detailed stage history
        pipelineInsights: pipelineInsights, // Pipeline analytics
        stageTimeline: pipelineInsights.stageTimeline, // Stage completion timeline
      },
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteDeal = async (req, res) => {
  try {
    const { dealId } = req.params;
    const deal = await Deal.findByPk(dealId);

    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }

    await deal.destroy();

    res.status(200).json({ message: "Deal deleted successfully." });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Internal server error" });
  }
};
exports.linkParticipant = async (req, res) => {
  try {
    const { dealId } = req.params;
    const { personId } = req.body;

    // Require at least personId
    if (!dealId || !personId) {
      return res
        .status(400)
        .json({ message: "dealId and personId are required." });
    }

    // Optionally, check if participant already linked
    const exists = await DealParticipant.findOne({
      where: { dealId, personId },
    });
    if (exists) {
      return res
        .status(409)
        .json({ message: "Participant already linked to this deal." });
    }

    const participant = await DealParticipant.create({
      dealId,
      personId,
    });

    res
      .status(201)
      .json({ message: "Participant linked successfully.", participant });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.createNote = async (req, res) => {
  try {
    const { dealId } = req.params;
    const { content } = req.body;
    const createdBy = req.user?.masterUserID || req.adminId; // Adjust as per your auth

    if (!content) {
      return res.status(400).json({ message: "Note content is required." });
    }

    const note = await DealNote.create({
      dealId,
      content,
      createdBy,
    });

    res.status(201).json({ message: "Note created successfully.", note });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getNotes = async (req, res) => {
  try {
    const { dealId } = req.params;
    const notes = await DealNote.findAll({
      where: { dealId },
      order: [["createdAt", "DESC"]],
    });
    res.status(200).json({ notes });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.saveAllDealFieldsWithCheck = async (req, res) => {
  // Get all field names from Deal and DealDetails models
  const dealFields = Object.keys(Deal.rawAttributes);
  const dealDetailsFields = DealDetails
    ? Object.keys(DealDetails.rawAttributes)
    : [];
  const allFieldNames = Array.from(
    new Set([...dealFields, ...dealDetailsFields])
  );

  // Exclude fields that are likely IDs (case-insensitive, ends with 'id' or is 'id')
  const filteredFieldNames = allFieldNames.filter(
    (field) => !/^id$/i.test(field) && !/id$/i.test(field)
  );

  // Accept array of { value, check } from req.body
  const { checkedFields } = req.body || {};

  // Build columns array to save: always include all fields, set check from checkedFields if provided
  let columnsToSave = filteredFieldNames.map((field) => {
    let check = false;
    if (Array.isArray(checkedFields)) {
      const found = checkedFields.find((item) => item.value === field);
      check = found ? !!found.check : false;
    }
    return { key: field, check };
  });

  try {
    let pref = await DealColumnPreference.findOne();
    if (!pref) {
      // Create the record if it doesn't exist
      pref = await DealColumnPreference.create({ columns: columnsToSave });
    } else {
      // Update the existing record
      pref.columns = columnsToSave;
      await pref.save();
    }
    res
      .status(200)
      .json({ message: "All deal columns saved", columns: pref.columns });
  } catch (error) {
    console.log("Error saving all deal columns:", error);
    res.status(500).json({ message: "Error saving all deal columns" });
  }
};
exports.getDealFields = async (req, res) => {
  try {
    // Get deal column preferences
    const pref = await DealColumnPreference.findOne({ where: {} });

    let columns = [];
    if (pref) {
      // Parse columns if it's a string
      columns =
        typeof pref.columns === "string"
          ? JSON.parse(pref.columns)
          : pref.columns;
    }

    // Optionally: parse filterConfig for each column if needed
    columns = columns.map((col) => {
      if (col.filterConfig) {
        col.filterConfig =
          typeof col.filterConfig === "string"
            ? JSON.parse(col.filterConfig)
            : col.filterConfig;
      }
      return col;
    });

    // Fetch custom fields for deals (only if user is authenticated)
    let customFields = [];
    if (req.adminId) {
      try {
        customFields = await CustomField.findAll({
          where: {
            entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support unified fields
            isActive: true,
            [Op.or]: [
              { masterUserID: req.adminId },
              { fieldSource: "default" },
              { fieldSource: "system" },
            ],
          },
          attributes: [
            "fieldId",
            "fieldName",
            "fieldLabel",
            "fieldType",
            "isRequired",
            "isImportant",
            "fieldSource",
            "entityType",
            "check",
            "dealCheck", // Add dealCheck field
          ],
          order: [["fieldName", "ASC"]],
        });
      } catch (customFieldError) {
        console.error("Error fetching custom fields:", customFieldError);
        // Continue without custom fields if there's an error
      }
    } else {
      console.warn("No adminId found in request - skipping custom fields");
    }

    // Format custom fields for column preferences
    const customFieldColumns = customFields.map((field) => ({
      key: field.fieldName,
      label: field.fieldLabel,
      type: field.fieldType,
      isCustomField: true,
      fieldId: field.fieldId,
      isRequired: field.isRequired,
      isImportant: field.isImportant,
      fieldSource: field.fieldSource,
      entityType: field.entityType,
      check: field.check || false, // Include check field for leads
      dealCheck: field.dealCheck || false, // Include dealCheck field for deals
    }));

    // Check if custom fields already exist in preferences and sync their dealCheck status
    customFieldColumns.forEach((customCol) => {
      const existingCol = columns.find((col) => col.key === customCol.key);
      if (existingCol) {
        // Keep the dealCheck value from database, don't override it
        // existingCol.check is for leads, customCol.dealCheck is for deals
        existingCol.dealCheck = customCol.dealCheck;
      }
    });

    // Merge regular columns with custom field columns
    const allColumns = [...columns, ...customFieldColumns];

    // Remove duplicates (custom fields might already be in preferences)
    const uniqueColumns = [];
    const seenKeys = new Set();

    allColumns.forEach((col) => {
      if (!seenKeys.has(col.key)) {
        seenKeys.add(col.key);
        uniqueColumns.push(col);
      }
    });

    res.status(200).json({
      columns: uniqueColumns,
      customFieldsCount: customFields.length,
      totalColumns: uniqueColumns.length,
      regularColumns: columns.length,
    });
  } catch (error) {
    console.error("Error fetching deal fields:", error);
    res.status(500).json({ message: "Error fetching deal fields" });
  }
};
exports.updateDealColumnChecks = async (req, res) => {
  // Expecting: { columns: [ { key: "columnName", check: true/false, dealCheck: true/false }, ... ] }
  const { columns } = req.body;

  if (!Array.isArray(columns)) {
    return res.status(400).json({ message: "Columns array is required." });
  }

  try {
    console.log("=== UPDATE DEAL COLUMN CHECKS DEBUG ===");
    console.log("Incoming columns:", JSON.stringify(columns, null, 2));
    console.log("adminId:", req.adminId);

    // Find the global DealColumnPreference record
    let pref = await DealColumnPreference.findOne();
    if (!pref) {
      return res.status(404).json({ message: "Preferences not found." });
    }

    // Parse columns if stored as string
    let prefColumns =
      typeof pref.columns === "string"
        ? JSON.parse(pref.columns)
        : pref.columns;

    // Get custom fields to validate incoming custom field columns
    let customFields = [];
    if (req.adminId) {
      try {
        customFields = await CustomField.findAll({
          where: {
            entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support unified fields
            isActive: true,
            [Op.or]: [
              { masterUserID: req.adminId },
              { fieldSource: "default" },
              { fieldSource: "system" },
            ],
          },
          attributes: [
            "fieldId",
            "fieldName",
            "fieldLabel",
            "fieldType",
            "isRequired",
            "isImportant",
            "fieldSource",
            "entityType",
            "check",
            "dealCheck", // Add dealCheck field
          ],
        });
      } catch (customFieldError) {
        console.error("Error fetching custom fields:", customFieldError);
      }
    }

    console.log("Found custom fields:", customFields.length);
    console.log(
      "Custom field names:",
      customFields.map((f) => f.fieldName)
    );

    // Create a map of custom field names for quick lookup
    const customFieldMap = {};
    customFields.forEach((field) => {
      customFieldMap[field.fieldName] = {
        fieldId: field.fieldId,
        fieldLabel: field.fieldLabel,
        fieldType: field.fieldType,
        isRequired: field.isRequired,
        isImportant: field.isImportant,
        fieldSource: field.fieldSource,
        entityType: field.entityType,
      };
    });

    console.log("Custom field map keys:", Object.keys(customFieldMap));

    // Update check and dealCheck status for existing columns
    prefColumns = prefColumns.map((col) => {
      const found = columns.find((c) => c.key === col.key);
      if (found) {
        return {
          ...col,
          check: found.check !== undefined ? !!found.check : col.check,
          dealCheck:
            found.dealCheck !== undefined ? !!found.dealCheck : col.dealCheck,
        };
      }
      return col;
    });

    // Handle new custom field columns that don't exist in preferences yet
    const existingKeys = new Set(prefColumns.map((col) => col.key));

    columns.forEach((incomingCol) => {
      // If this column doesn't exist in preferences but is a custom field, add it
      if (
        !existingKeys.has(incomingCol.key) &&
        customFieldMap[incomingCol.key]
      ) {
        const customFieldInfo = customFieldMap[incomingCol.key];
        prefColumns.push({
          key: incomingCol.key,
          label: customFieldInfo.fieldLabel,
          type: customFieldInfo.fieldType,
          isCustomField: true,
          fieldId: customFieldInfo.fieldId,
          isRequired: customFieldInfo.isRequired,
          isImportant: customFieldInfo.isImportant,
          fieldSource: customFieldInfo.fieldSource,
          entityType: customFieldInfo.entityType,
          check: incomingCol.check !== undefined ? !!incomingCol.check : false,
          dealCheck:
            incomingCol.dealCheck !== undefined
              ? !!incomingCol.dealCheck
              : false,
        });
      }
    });

    // Update check and dealCheck fields in CustomField table for custom fields
    // 'check' field is for leads, 'dealCheck' field is for deals
    const customFieldUpdates = [];

    console.log("Processing custom field updates...");
    columns.forEach((incomingCol) => {
      console.log(`Processing column: ${incomingCol.key}`);

      if (customFieldMap[incomingCol.key]) {
        console.log(`Found custom field mapping for: ${incomingCol.key}`);

        const customField = customFields.find(
          (f) => f.fieldName === incomingCol.key
        );

        if (customField) {
          console.log(
            `Found custom field in database: ${customField.fieldName}, current check: ${customField.check}, current dealCheck: ${customField.dealCheck}`
          );

          const updates = {};

          // Update check field if provided (for leads)
          if (
            incomingCol.check !== undefined &&
            customField.check !== !!incomingCol.check
          ) {
            updates.check = !!incomingCol.check;
            console.log(`Will update check field to: ${updates.check}`);
          }

          // Update dealCheck field if provided (for deals)
          if (
            incomingCol.dealCheck !== undefined &&
            customField.dealCheck !== !!incomingCol.dealCheck
          ) {
            updates.dealCheck = !!incomingCol.dealCheck;
            console.log(`Will update dealCheck field to: ${updates.dealCheck}`);
          }

          // Only add to updates if there are changes
          if (Object.keys(updates).length > 0) {
            customFieldUpdates.push({
              fieldId: customField.fieldId,
              updates: updates,
            });
            console.log(
              `Added update for fieldId: ${customField.fieldId}`,
              updates
            );
          } else {
            console.log(`No changes needed for field: ${incomingCol.key}`);
          }
        } else {
          console.log(
            `Custom field not found in database for: ${incomingCol.key}`
          );
        }
      } else {
        console.log(`No custom field mapping found for: ${incomingCol.key}`);
      }
    });

    console.log(
      "Total custom field updates to process:",
      customFieldUpdates.length
    );

    // Perform bulk update of CustomField check and dealCheck values
    // 'check' field affects leads, 'dealCheck' field affects deals
    if (customFieldUpdates.length > 0) {
      console.log("Executing custom field updates...");

      for (const update of customFieldUpdates) {
        console.log(`Updating fieldId ${update.fieldId} with:`, update.updates);

        // First, let's check what record we're trying to update
        const existingRecord = await CustomField.findOne({
          where: { fieldId: update.fieldId },
          attributes: [
            "fieldId",
            "fieldName",
            "masterUserID",
            "fieldSource",
            "check",
            "dealCheck",
          ],
        });

        console.log(
          `Current record for fieldId ${update.fieldId}:`,
          existingRecord ? existingRecord.toJSON() : "NOT FOUND"
        );

        const result = await CustomField.update(update.updates, {
          where: {
            fieldId: update.fieldId,
            // Make the WHERE clause more flexible - either the user owns it OR it's a default/system field
            [Op.or]: [
              { masterUserID: req.adminId },
              { fieldSource: "default" },
              { fieldSource: "system" },
              { fieldSource: "custom" }, // Add custom fields that might belong to this user
            ],
          },
        });

        console.log(`Update result for fieldId ${update.fieldId}:`, result);

        // If no rows were updated, try a more relaxed update
        if (result[0] === 0) {
          console.log(
            `No rows updated with restrictive WHERE clause, trying more relaxed update...`
          );

          const relaxedResult = await CustomField.update(update.updates, {
            where: {
              fieldId: update.fieldId,
              // Only check fieldId - less restrictive
            },
          });

          console.log(
            `Relaxed update result for fieldId ${update.fieldId}:`,
            relaxedResult
          );
        }
      }

      console.log(
        `Updated ${customFieldUpdates.length} custom field check/dealCheck values`
      );
    } else {
      console.log("No custom field updates to process");
    }

    // Save updated preferences
    pref.columns = prefColumns;
    await pref.save();

    res.status(200).json({
      message: "Deal columns updated",
      columns: pref.columns,
      customFieldsUpdated: customFieldUpdates.length,
      totalColumns: prefColumns.length,
      updatedFields: {
        checkUpdates: customFieldUpdates.filter(
          (u) => u.updates.check !== undefined
        ).length,
        dealCheckUpdates: customFieldUpdates.filter(
          (u) => u.updates.dealCheck !== undefined
        ).length,
      },
    });
  } catch (error) {
    console.error("Error updating deal columns:", error);
    res.status(500).json({ message: "Error updating columns" });
  }
};

exports.markDealAsWon = async (req, res) => {
  try {
    const { dealId } = req.params;

    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }

    // Update status to 'won'
    await deal.update({ status: "won" });

    // Update DealDetails: wonTime and dealClosedOn
    const now = new Date();
    let dealDetails = await DealDetails.findOne({ where: { dealId } });
    if (dealDetails) {
      await dealDetails.update({
        wonTime: now,
        dealClosedOn: now,
      });
    } else {
      await DealDetails.create({
        dealId,
        wonTime: now,
        dealClosedOn: now,
      });
    }

    // Add a new entry to DealStageHistory
    await DealStageHistory.create({
      dealId,
      stageName: deal.pipelineStage, // keep current stage
      enteredAt: now,
      note: "Marked as won",
    });

    res.status(200).json({ message: "Deal marked as won", deal });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Internal server error" });
  }
};

exports.markDealAsLost = async (req, res) => {
  try {
    const { dealId } = req.params;
    const { lostReason } = req.body; // Accept lostReason from request body

    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }

    await deal.update({ status: "lost" });

    // Update DealDetails: lostTime and lostReason
    const now = new Date();
    let dealDetails = await DealDetails.findOne({ where: { dealId } });
    if (dealDetails) {
      await dealDetails.update({
        lostTime: now,
        lostReason: lostReason || dealDetails.lostReason,
      });
    } else {
      await DealDetails.create({
        dealId,
        lostTime: now,
        lostReason: lostReason || null,
      });
    }

    res.status(200).json({ message: "Deal marked as lost", deal });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Internal server error" });
  }
};

exports.markDealAsOpen = async (req, res) => {
  try {
    const { dealId } = req.params;
    const initialStage = "Qualified"; // Set your initial pipeline stage here

    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }

    // Update deal status and reset pipelineStage
    await deal.update({ status: "open", pipelineStage: initialStage });

    // Reset closure fields in DealDetails
    let dealDetails = await DealDetails.findOne({ where: { dealId } });
    if (dealDetails) {
      await dealDetails.update({
        wonTime: null,
        lostTime: null,
        dealClosedOn: null,
        lostReason: null,
      });
    }

    // Add a new entry to DealStageHistory to track reopening
    await DealStageHistory.create({
      dealId,
      stageName: initialStage,
      enteredAt: new Date(),
    });

    res.status(200).json({ message: "Deal marked as open", deal });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getDealFieldsForFilter = (req, res) => {
  const fields = [
    { value: "dealId", label: "Deal ID" },
    { value: "title", label: "Title" },
    { value: "value", label: "Value" },
    { value: "pipeline", label: "Pipeline" },
    { value: "pipelineStage", label: "Pipeline Stage" },
    { value: "status", label: "Status" },
    { value: "expectedCloseDate", label: "Expected Close Date" },
    { value: "serviceType", label: "Service Type" },
    { value: "scopeOfServiceType", label: "Scope of Service Type" },
    { value: "proposalValue", label: "Proposal Value" },
    { value: "esplProposalNo", label: "ESPL Proposal No." },
    { value: "projectLocation", label: "Project Location" },
    { value: "organizationCountry", label: "Organization Country" },
    { value: "proposalSentDate", label: "Proposal Sent Date" },
    { value: "ownerId", label: "Owner" },
    { value: "createdAt", label: "Deal Created" },
    { value: "updatedAt", label: "Last Updated" },
    { value: "masterUserID", label: "Creator" },
    { value: "currency", label: "Currency" },
    { value: "nextActivityDate", label: "Next Activity Date" },
    { value: "responsiblePerson", label: "Responsible Person" },
    { value: "rfpReceivedDate", label: "RFP Received Date" },
    { value: "statusSummary", label: "Status Summary" },
    { value: "wonTime", label: "Won Time" },
    { value: "lostTime", label: "Lost Time" },
    { value: "dealClosedOn", label: "Deal Closed On" },
    { value: "lostReason", label: "Lost Reason" },
    {
      value: "stateAndCountryProjectLocation",
      label: "State and Country Project Location",
    },
    { value: "visibleTo", label: "Visible To" },
    { value: "archiveTime", label: "Archive Time" },
    // ...add more as needed
  ];
  res.status(200).json({ fields });
};
