// Get organizations with persons, leadCount, and ownerName, supporting dynamic filtering
exports.getOrganizationsAndPersons = async (req, res) => {
  try {
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
          filterConfig = filterRow.filterConfig;
        }
      } else if (typeof filterIdRaw === "number") {
        const filterRow = await LeadFilter.findByPk(filterIdRaw);
        if (filterRow && filterRow.filterConfig) {
          filterConfig = filterRow.filterConfig;
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
    function buildCondition(cond) {
      let operator = cond.operator;
      if (operatorMap[operator]) operator = operatorMap[operator];
      if (operator === "isEmpty" || operator === "is empty")
        return { [cond.field]: { [Op.is]: null } };
      if (operator === "isNotEmpty" || operator === "is not empty")
        return { [cond.field]: { [Op.not]: null, [Op.ne]: "" } };
      if (operator === "like" || operator === "contains")
        return { [cond.field]: { [Op.like]: `%${cond.value}%` } };
      if (operator === "notLike" || operator === "does not contain")
        return { [cond.field]: { [Op.notLike]: `%${cond.value}%` } };
      return { [cond.field]: { [ops[operator] || Op.eq]: cond.value } };
    }

    // Get model field names for validation
    const Organization = require("../../models").Organization;
    const Person = require("../../models").Person;
    const Lead = require("../../models").Lead;
    const Deal = require("../../models").Deal;
    let Activity,
      activityFields = [];
    try {
      Activity = require("../../models/activity/activityModel");
      activityFields = Object.keys(Activity.rawAttributes);
    } catch {}
    const organizationFields = Object.keys(Organization.rawAttributes);
    const personFields = Object.keys(Person.rawAttributes);
    const leadFields = Object.keys(Lead.rawAttributes);
    const dealFields = Object.keys(Deal.rawAttributes);

    // Build where clauses from filterConfig
    if (filterConfig && typeof filterConfig === "object") {
      if (Array.isArray(filterConfig.all) && filterConfig.all.length > 0) {
        // Process conditions in parallel for async operations
        const processConditions = await Promise.all(
          filterConfig.all.map(async function (cond) {
            if (cond.entity) {
              switch (cond.entity.toLowerCase()) {
                case "organization":
                  if (organizationFields.includes(cond.field)) {
                    if (!organizationWhere[Op.and])
                      organizationWhere[Op.and] = [];
                    organizationWhere[Op.and].push(buildCondition(cond));
                  }
                  break;
                case "person":
                  if (personFields.includes(cond.field)) {
                    if (!personWhere[Op.and]) personWhere[Op.and] = [];
                    personWhere[Op.and].push(buildCondition(cond));
                  }
                  break;
                case "lead":
                  if (leadFields.includes(cond.field)) {
                    if (!leadWhere[Op.and]) leadWhere[Op.and] = [];
                    leadWhere[Op.and].push(buildCondition(cond));
                  }
                  break;
                case "deal":
                  if (dealFields.includes(cond.field)) {
                    if (!dealWhere[Op.and]) dealWhere[Op.and] = [];
                    dealWhere[Op.and].push(buildCondition(cond));
                  }
                  break;
                case "activity":
                  if (activityFields.includes(cond.field)) {
                    if (!activityWhere[Op.and]) activityWhere[Op.and] = [];
                    activityWhere[Op.and].push(buildCondition(cond));
                  }
                  break;
              }
            } else {
              // Auto-detect entity based on field name
              if (organizationFields.includes(cond.field)) {
                if (!organizationWhere[Op.and]) organizationWhere[Op.and] = [];
                organizationWhere[Op.and].push(buildCondition(cond));
              } else if (personFields.includes(cond.field)) {
                if (!personWhere[Op.and]) personWhere[Op.and] = [];
                personWhere[Op.and].push(buildCondition(cond));
              } else if (leadFields.includes(cond.field)) {
                if (!leadWhere[Op.and]) leadWhere[Op.and] = [];
                leadWhere[Op.and].push(buildCondition(cond));
              } else if (dealFields.includes(cond.field)) {
                if (!dealWhere[Op.and]) dealWhere[Op.and] = [];
                dealWhere[Op.and].push(buildCondition(cond));
              } else if (activityFields.includes(cond.field)) {
                if (!activityWhere[Op.and]) activityWhere[Op.and] = [];
                activityWhere[Op.and].push(buildCondition(cond));
              }
            }
          })
        );
      }
      // (OR conditions can be added similarly if needed)
    } else if (orgSearch) {
      organizationWhere[Op.or] = [
        { organization: { [Op.like]: `%${orgSearch}%` } },
        { organizationLabels: { [Op.like]: `%${orgSearch}%` } },
        { address: { [Op.like]: `%${orgSearch}%` } },
      ];
    }

    let organizations, orgCount, persons, leads;

    // Check if we have lead filtering
    const hasLeadFiltering =
      Object.keys(leadWhere).length > 0 ||
      Object.getOwnPropertySymbols(leadWhere).length > 0;

    if (hasLeadFiltering) {
      // When filtering by leads, first find matching leads, then get their organizations
      const filteredLeads = await Lead.findAll({
        where: leadWhere,
        attributes: ["leadId", "leadOrganizationId"],
        raw: true,
      });

      // Get unique organization IDs from filtered leads
      const leadOrgIds = [
        ...new Set(
          filteredLeads.map((l) => l.leadOrganizationId).filter(Boolean)
        ),
      ];

      if (leadOrgIds.length === 0) {
        // No leads match the filter, return empty results
        organizations = [];
        orgCount = 0;
        persons = [];
        leads = [];
      } else {
        // Combine lead org filtering with other organization filters
        const combinedOrgWhere = {
          ...organizationWhere,
          leadOrganizationId: leadOrgIds,
        };

        // Fetch organizations with pagination and filtering
        const orgResult = await Organization.findAndCountAll({
          where: combinedOrgWhere,
          limit: orgLimit,
          offset: orgOffset,
          order: [["organization", "ASC"]],
          raw: true,
        });

        organizations = orgResult.rows;
        orgCount = orgResult.count;

        // Get final org IDs after pagination
        const orgIds = organizations.map((o) => o.leadOrganizationId);

        // Fetch persons for these organizations
        persons = await Person.findAll({
          where: {
            leadOrganizationId: orgIds.length > 0 ? orgIds : -1,
            ...personWhere,
          },
          attributes: ["personId", "contactPerson", "leadOrganizationId"],
          raw: true,
        });

        // Fetch leads for these organizations (with lead filtering applied)
        leads = await Lead.findAll({
          where: {
            leadOrganizationId: orgIds.length > 0 ? orgIds : -1,
            ...leadWhere,
          },
          attributes: ["leadId", "leadOrganizationId"],
          raw: true,
        });
      }
    } else {
      // No lead filtering, use original logic
      const orgResult = await Organization.findAndCountAll({
        where: organizationWhere,
        limit: orgLimit,
        offset: orgOffset,
        order: [["organization", "ASC"]],
        raw: true,
      });

      organizations = orgResult.rows;
      orgCount = orgResult.count;

      // Fetch all persons for these organizations
      const orgIds = organizations.map((o) => o.leadOrganizationId);
      persons = await Person.findAll({
        where: {
          leadOrganizationId: orgIds.length > 0 ? orgIds : -1,
          ...personWhere,
        },
        attributes: ["personId", "contactPerson", "leadOrganizationId"],
        raw: true,
      });

      // Fetch all leads for these organizations
      leads = await Lead.findAll({
        where: {
          leadOrganizationId: orgIds.length > 0 ? orgIds : -1,
          ...leadWhere,
        },
        attributes: ["leadId", "leadOrganizationId"],
        raw: true,
      });
    }

    // Fetch all owners for these organizations
    const ownerIds = organizations.map((o) => o.ownerId).filter(Boolean);
    const MasterUser = require("../../models/master/masterUserModel");
    const owners = await MasterUser.findAll({
      where: { masterUserID: ownerIds },
      attributes: ["masterUserID", "name"],
      raw: true,
    });
    const ownerMap = {};
    owners.forEach((o) => {
      ownerMap[o.masterUserID] = o.name;
    });

    // Build persons map by org
    const orgPersonsMap = {};
    persons.forEach((p) => {
      if (!orgPersonsMap[p.leadOrganizationId])
        orgPersonsMap[p.leadOrganizationId] = [];
      orgPersonsMap[p.leadOrganizationId].push({
        personId: p.personId,
        contactPerson: p.contactPerson,
      });
    });

    // Build lead count by org
    const orgLeadCount = {};
    leads.forEach((l) => {
      orgLeadCount[l.leadOrganizationId] =
        (orgLeadCount[l.leadOrganizationId] || 0) + 1;
    });

    // Fetch custom field values for all organizations
    const CustomField = require("../../models/customFieldModel");
    const CustomFieldValue = require("../../models/customFieldValueModel");
    const Sequelize = require("sequelize");
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

    // Attach custom fields as direct properties to each organization
    const orgsOut = organizations.map((o) => {
      const customFields = orgCustomFieldsMap[o.leadOrganizationId] || {};
      return {
        ...o,
        ...customFields,
        ownerName: o.ownerId ? ownerMap[o.ownerId] || null : null,
        leadCount: orgLeadCount[o.leadOrganizationId] || 0,
        persons: orgPersonsMap[o.leadOrganizationId] || [],
      };
    });

    res.status(200).json({
      message: "Organizations fetched successfully",
      organizationsPagination: {
        totalRecords: orgCount,
        totalPages: Math.ceil(orgCount / orgLimit),
        currentPage: orgPage,
        limit: orgLimit,
      },
      organizations: orgsOut,
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
      { key: "contactPerson", label: "Name" },
      { key: "firstName", label: "First name" },
      { key: "lastName", label: "Last name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "jobTitle", label: "Job title" },
      { key: "birthday", label: "Birthday" },
      { key: "personLabels", label: "Labels" },
      { key: "organization", label: "Organization" },
      { key: "owner", label: "Owner" },
      { key: "notes", label: "Notes" },
      { key: "postalAddress", label: "Postal address" },
      { key: "postalAddressDetails", label: "Postal address (details)" },
      { key: "visibleTo", label: "Visible to" },
      { key: "createdAt", label: "Person created" },
      { key: "updatedAt", label: "Update time" },
      { key: "activitiesToDo", label: "Activities to do" },
      { key: "doneActivities", label: "Done activities" },
      { key: "closedDeals", label: "Closed deals" },
      { key: "openDeals", label: "Open deals" },
      { key: "wonDeals", label: "Won deals" },
      { key: "lostDeals", label: "Lost deals" },
      { key: "totalActivities", label: "Total activities" },
      { key: "lastActivityDate", label: "Last activity date" },
      { key: "nextActivityDate", label: "Next activity date" },
      { key: "lastEmailReceived", label: "Last email received" },
      { key: "lastEmailSent", label: "Last email sent" },
      { key: "emailMessagesCount", label: "Email messages count" },
      { key: "instantMessenger", label: "Instant messenger" },
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
      { key: "organization", label: "Organization name" },
      { key: "organizationLabels", label: "Labels" },
      { key: "address", label: "Address" },
      { key: "addressDetails", label: "Address (details)" },
      { key: "visibleTo", label: "Visible to" },
      { key: "createdAt", label: "Organization created" },
      { key: "updatedAt", label: "Update time" },
      { key: "owner", label: "Owner" },
      { key: "people", label: "People" },
      { key: "notes", label: "Notes" },
      { key: "activitiesToDo", label: "Activities to do" },
      { key: "doneActivities", label: "Done activities" },
      { key: "closedDeals", label: "Closed deals" },
      { key: "openDeals", label: "Open deals" },
      { key: "wonDeals", label: "Won deals" },
      { key: "lostDeals", label: "Lost deals" },
      { key: "totalActivities", label: "Total activities" },
      { key: "lastActivityDate", label: "Last activity date" },
      { key: "nextActivityDate", label: "Next activity date" },
      { key: "lastEmailReceived", label: "Last email received" },
      { key: "lastEmailSent", label: "Last email sent" },
      { key: "emailMessagesCount", label: "Email messages count" },
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
    // ...existing code...
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
          filterConfig = filterRow.filterConfig;
        }
      } else if (typeof filterIdRaw === "number") {
        const filterRow = await LeadFilter.findByPk(filterIdRaw);
        if (filterRow && filterRow.filterConfig) {
          filterConfig = filterRow.filterConfig;
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

    // Restrict by role (admin sees all, non-admin sees only their own or owned)
    if (req.role !== "admin") {
      // For organizations: only those where user is masterUserID or ownerId
      orgWhere[Op.or] = orgWhere[Op.or] || [];
      orgWhere[Op.or].push({ masterUserID: req.adminId });
      orgWhere[Op.or].push({ ownerId: req.adminId });

      // For persons: only those where user is masterUserID or in user's organizations
      // First, get organizations user can see
      const userOrgs = await Organization.findAll({
        where: {
          [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
        },
        attributes: ["leadOrganizationId"],
        raw: true,
      });
      const userOrgIds = userOrgs.map((o) => o.leadOrganizationId);
      personWhere[Op.or] = personWhere[Op.or] || [];
      personWhere[Op.or].push({ masterUserID: req.adminId });
      if (userOrgIds.length > 0) {
        personWhere[Op.or].push({ leadOrganizationId: userOrgIds });
      }
    }

    // Fetch organizations with pagination
    let { count: orgCount, rows: organizations } =
      await Organization.findAndCountAll({
        where: orgWhere,
        limit: orgLimit,
        offset: orgOffset,
        order: [["organization", "ASC"]],
        raw: true,
      });
    console.log("[DEBUG] organizations count:", orgCount);
    console.log(
      "[DEBUG] organizations sample:",
      organizations && organizations.length > 0 ? organizations[0] : null
    );

    // Build include array for related models
    const includeArr = [];

    // Always include organization (left join)
    if (hasOrgFilters) {
      includeArr.push({
        model: Organization,
        as: "LeadOrganization",
        where: organizationWhere,
        required: true, // Inner join when filtering
      });
      console.log(
        "[DEBUG] Added Organization include with filtering (INNER JOIN)"
      );
    } else {
      includeArr.push({
        model: Organization,
        as: "LeadOrganization",
        required: false, // Left join when not filtering
      });
      console.log(
        "[DEBUG] Added Organization include without filtering (LEFT JOIN)"
      );
    }

    // Always include Leads with required: true (inner join)
    if (hasLeadFilters) {
      includeArr.push({
        model: Lead,
        as: "Leads",
        where: leadWhere,
        required: true,
        attributes: [],
      });
      console.log("[DEBUG] Added Lead include with filtering (INNER JOIN)");
    } else {
      includeArr.push({
        model: Lead,
        as: "Leads",
        required: true,
        attributes: [],
      });
      console.log("[DEBUG] Added Lead include without filtering (INNER JOIN)");
    }

    // Include Deals if filtering is applied
    if (hasDealFilters) {
      includeArr.push({
        model: Deal,
        as: "Deals",
        where: dealWhere,
        required: true,
      });
      console.log("[DEBUG] Added Deal include with filtering (INNER JOIN)");
    }

    // Include Activities if filtering is applied
    try {
      const Activity = require("../../models/activity/activityModel");
      console.log("[DEBUG] Activity model loaded successfully");
      console.log(
        "[DEBUG] Activity model fields:",
        Object.keys(Activity.rawAttributes)
      );

      if (hasActivityFilters) {
        console.log("[DEBUG] Activity filtering detected!");
        console.log(
          "[DEBUG] activityWhere:",
          JSON.stringify(activityWhere, null, 2)
        );

        // Check if Person-Activity association exists
        console.log(
          "[DEBUG] Person model associations:",
          Object.keys(Person.associations || {})
        );

        includeArr.push({
          model: Activity,
          as: "Activities",
          where: activityWhere,
          required: true, // Inner join to filter persons by activities
        });
        console.log(
          "[DEBUG] Added Activity include with filtering (INNER JOIN)"
        );

        // Debug: log the Activities include object
        console.log(
          "[DEBUG] Activities include object:",
          JSON.stringify(
            {
              model: "Activity",
              as: "Activities",
              where: activityWhere,
              required: true,
            },
            null,
            2
          )
        );
      } else {
        console.log(
          "[DEBUG] No activity filtering applied, Activities not included in includeArr"
        );
        console.log(
          "[DEBUG] activityWhere is empty or undefined:",
          activityWhere
        );
      }
    } catch (e) {
      console.log("[DEBUG] Error including Activities:", e.message);
      console.log("[DEBUG] Full error stack:", e.stack);
    }
    // Debug logging for includeArr
    console.log("[DEBUG] includeArr:", JSON.stringify(includeArr, null, 2));
    // Debug logging for leadWhere and includeArr
    console.log("[DEBUG] leadWhere:", JSON.stringify(leadWhere, null, 2));
    console.log("[DEBUG] includeArr:", JSON.stringify(includeArr, null, 2));

    // Fetch persons with pagination and dynamic filter
    // Debug: log SQL query generated by Sequelize
    const SequelizeLogger = {
      log: (msg) => console.log("[SEQUELIZE SQL]", msg),
    };
    let { count: personCount, rows: persons } = await Person.findAndCountAll({
      where: personWhere,
      include: includeArr,
      limit: personLimit,
      offset: personOffset,
      order: [["contactPerson", "ASC"]],
      logging: SequelizeLogger.log,
    });
    console.log("[DEBUG] persons count:", personCount);
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

    // Count leads for each person and organization
    const orgIds = organizations.map((o) => o.leadOrganizationId);
    const personIds = persons.map((p) => p.personId);

    // Only include persons with at least one lead
    // Fix: Do not filter by Leads array length, as required: true join guarantees only persons with matching leads
    // Remove the filter step entirely
    // Deduplicate persons by personId
    const personMap = new Map();
    persons.forEach((p) => {
      let ownerName = ownerMap[p.ownerId] || null;
      let organization = p.LeadOrganization
        ? {
            leadOrganizationId: p.LeadOrganization.leadOrganizationId,
            organization: p.LeadOrganization.organization,
          }
        : null;
      let leadCount = 0;
      if (Array.isArray(p.Leads)) {
        leadCount = p.Leads.length;
      } else if (p.Leads && typeof p.Leads === "object") {
        leadCount = 1;
      }
      // If already present, increment leadCount
      if (personMap.has(p.personId)) {
        const existing = personMap.get(p.personId);
        existing.leadCount += leadCount;
      } else {
        personMap.set(p.personId, {
          personId: p.personId,
          contactPerson: p.contactPerson,
          email: p.email,
          phone: p.phone,
          jobTitle: p.jobTitle,
          personLabels: p.personLabels,
          organization,
          ownerName,
          leadCount,
        });
      }
    });
    persons = Array.from(personMap.values());

    // Fetch custom field values for all persons
    const CustomField = require("../../models/customFieldModel");
    const CustomFieldValue = require("../../models/customFieldValueModel");
    const Sequelize = require("sequelize");
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

    // Attach custom fields as direct properties to each person
    persons = persons.map((p) => {
      const customFields = personCustomFieldsMap[p.personId] || {};
      return { ...p, ...customFields };
    });

    // Build orgPersonsMap for organizations
    const orgPersonsMap = {};
    persons.forEach((p) => {
      if (p.organization && p.organization.leadOrganizationId) {
        if (!orgPersonsMap[p.organization.leadOrganizationId])
          orgPersonsMap[p.organization.leadOrganizationId] = [];
        orgPersonsMap[p.organization.leadOrganizationId].push({
          personId: p.personId,
          contactPerson: p.contactPerson,
        });
      }
    });

    // Build organizations array with ownerName, leadCount, and persons array
    organizations = organizations.map((o) => ({
      ...o,
      ownerName: ownerMap[o.ownerId] || null,
      // leadCount for orgs can be calculated similarly if needed
      persons: orgPersonsMap[o.leadOrganizationId] || [],
    }));

    res.status(200).json({
      message: "Persons fetched successfully",
      personsPagination: {
        totalRecords: persons.length,
        totalPages: Math.ceil(persons.length / personLimit),
        currentPage: personPage,
        limit: personLimit,
      },
      persons,
    });
  } catch (error) {
    console.error("Error fetching persons and organizations:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
