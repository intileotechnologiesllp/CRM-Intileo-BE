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

    // Check for duplicate person in the same organization (or globally if no org)
    const whereClause = organization
      ? { contactPerson, organization }
      : { contactPerson, organization: null };

    const existingPerson = await Person.findOne({ where: whereClause });
    if (existingPerson) {
      return res.status(409).json({
        message: "Person already exists" + (organization ? " in this organization." : "."),
        person: existingPerson,
      });
    }

    let org = null;
    if (organization) {
      // Only create/find organization if provided
      [org] = await Organization.findOrCreate({
        where: { organization },
        defaults: { organization,masterUserID} // <-- add masterUserID here
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
    res.status(500).json({ message: "Internal server error", error });
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
      return res
        .status(409)
        .json({
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
    res
      .status(201)
      .json({
        message: "Organization created successfully",
        organization: org,
      });
  } catch (error) {
    console.error("Error creating organization:", error);
    res.status(500).json({ message: "Internal server error"});
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

    // Fetch related emails
    // const emails = await Email.findAll({ where: { leadId: leads.map(l => l.leadId) } });

    // Fetch emails linked to leads
    const leadIds = leads.map((l) => l.leadId);
    const emailsByLead = await Email.findAll({ where: { leadId: leadIds } });

    // Fetch emails where person's email is sender or recipient
    const emailsByAddress = await Email.findAll({
      where: {
        [Op.or]: [
          { sender: person.email },
          { recipient: { [Op.like]: `%${person.email}%` } },
        ],
      },
    });
    console.log("leadIds:", leadIds);
    console.log("emailsByLead:", emailsByLead.length);
    console.log("emailsByAddress:", emailsByAddress.length);
    // Merge and deduplicate emails
    const allEmailsMap = new Map();
    emailsByLead.forEach((email) => allEmailsMap.set(email.emailID, email));
    emailsByAddress.forEach((email) => allEmailsMap.set(email.emailID, email));
    const allEmails = Array.from(allEmailsMap.values());

    // Fetch all attachments for these emails from the Attachments model
    const emailIDs = allEmails.map((email) => email.emailID);
    let files = [];
    if (emailIDs.length > 0) {
      files = await Attachment.findAll({
        where: { emailID: emailIDs },
      });
      console.log(files.length, "files found for emails");
      // Build a map for quick email lookup
      const emailMap = new Map();
      allEmails.forEach((email) => emailMap.set(email.emailID, email));

      // Combine each attachment with its related email
      files = files.map((file) => ({
        ...file.toJSON(),
        email: emailMap.get(file.emailID) || null,
      }));
    }

    // Fetch related notes
    const notes = await LeadNote.findAll({
      where: { leadId: leads.map((l) => l.leadId) },
    });

    res.status(200).json({
      person,
      leads,
      deals,
      emails: allEmails,
      notes,
      files,
    });
  } catch (error) {
    console.error("Error fetching person timeline:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getOrganizationTimeline = async (req, res) => {
  const { organizationId } = req.params;
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
    organization.dataValues.persons = persons.map(p => ({
      personId: p.personId,
      contactPerson: p.contactPerson
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
    //     // Fetch all deals for this organization (directly or via persons)
    // const deals = await Deal.findAll({
    //   where: {
    //     [Op.or]: [
    //       { organizationId: organizationId }, // If you have this field
    //       { leadOrganizationId: organizationId }, // Or this field, depending on your schema
    //       { personId: personIds },
    //     ],
    //   },
    // });
    // const leadOrganizationId=organizationId
const deals = await Deal.findAll({ where: { leadOrganizationId:organizationId } });
    // Fetch all emails linked to these leads
    const leadIds = leads.map((l) => l.leadId);
    const emailsByLead = await Email.findAll({ where: { leadId: leadIds } });

    // Fetch emails where any person's email is sender or recipient
    const personEmails = persons.map((p) => p.email).filter(Boolean);
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
      });
    }

    // Merge and deduplicate emails by emailID
    const allEmailsMap = new Map();
    emailsByLead.forEach((email) => allEmailsMap.set(email.emailID, email));
    emailsByAddress.forEach((email) => allEmailsMap.set(email.emailID, email));
    const allEmails = Array.from(allEmailsMap.values());

    // Fetch all attachments for these emails from the Attachments model
    const emailIDs = allEmails.map((email) => email.emailID);
    let files = [];
    if (emailIDs.length > 0) {
      files = await Attachment.findAll({
        where: { emailID: emailIDs },
      });

      // Build a map for quick email lookup
      const emailMap = new Map();
      allEmails.forEach((email) => emailMap.set(email.emailID, email));

      // Combine each attachment with its related email
      files = files.map((file) => ({
        ...file.toJSON(),
        email: emailMap.get(file.emailID) || null,
      }));
    }

    // Fetch all notes linked to these leads
    const notes = await LeadNote.findAll({ where: { leadId: leadIds } });

    res.status(200).json({
      organization,
      persons,
      leads,
      deals,
      emails: allEmails,
      notes,
      files, // Attachments with related email data
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

    res
      .status(200)
      .json({
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

    if (person.leadOrganizationId && person.leadOrganizationId !== leadOrganizationId) {
      return res.status(400).json({
        message: "Person is already linked to another organization.",
        currentOrganizationId: person.leadOrganizationId
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
      person
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
      createdBy: req.adminId // or req.user.id
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
  const {content } = req.body;
  try {
    // You should have an OrganizationNote model/table
    const note = await OrganizationNote.create({
      leadOrganizationId,
      content,
      createdBy: req.adminId
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

    const where = search
      ? { contactPerson: { [Op.like]: `%${search}%` } }
      : {};

    // Include organization using association
    const { count, rows: persons } = await Person.findAndCountAll({
      where,
      attributes: ["personId", "contactPerson", "email", "leadOrganizationId"],
      include: [
        {
          model: Organization,
          as: "LeadOrganization", // Make sure this matches your association
          attributes: ["leadOrganizationId", "organization"]
        }
      ],
      order: [["contactPerson", "ASC"]],
      limit: parseInt(limit),
      offset,
    });

    // Format response to include organization info at top level
    const contactPersons = persons.map(person => ({
      personId: person.personId,
      contactPerson: person.contactPerson,
      email: person.email,
      organization: person.LeadOrganization
        ? {
            leadOrganizationId: person.LeadOrganization.leadOrganizationId,
            organization: person.LeadOrganization.organization
          }
        : null
    }));

    res.status(200).json({
      contactPersons,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
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
        "organization"
      ],
      order: [["contactPerson", "ASC"]]
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
    const personsWithOwner = persons.map(person => ({
      ...person.toJSON(),
      ownerName
    }));

    res.status(200).json({
      organization: organization.organization,
      persons: personsWithOwner
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};


