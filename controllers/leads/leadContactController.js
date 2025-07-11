const { Lead, LeadDetails, Person, Organization } = require("../../models");
const { Op } = require("sequelize");
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
        defaults: { organization, masterUserID }, // <-- add masterUserID here
      });
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
    const { organization, organizationLabels, address, visibleTo } = req.body;
    // Check if organization already exists
    const existingOrg = await Organization.findOne({ where: { organization } });
    if (existingOrg) {
      return res.status(409).json({
        message: "Organization already exists.",
        organization: existingOrg,
      });
    }
    const org = await Organization.create({
      organization,
      organizationLabels,
      address,
      visibleTo,
      masterUserID,
      ownerId, // Set the owner ID if provided
    });
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
  try {
    // You should have a PersonNote model/table
    const note = await PersonNote.create({
      personId,
      content,
      createdBy: req.adminId, // or req.user.id
    });
    res.status(201).json({ message: "Note added to person", note });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.addOrganizationNote = async (req, res) => {
  const { leadOrganizationId } = req.params; // Get leadOrganizationId from params
  if (!leadOrganizationId) {
    return res.status(400).json({ message: "Organization ID is required." });
  }
  const { content } = req.body;
  try {
    // You should have an OrganizationNote model/table
    const note = await OrganizationNote.create({
      leadOrganizationId,
      content,
      createdBy: req.adminId,
    });
    res.status(201).json({ message: "Note added to organization", note });
  } catch (error) {
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
