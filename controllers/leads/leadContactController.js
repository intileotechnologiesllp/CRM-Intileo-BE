 const { Lead, LeadDetails, Person, Organization } = require("../../models");
const { Op } = require("sequelize");
const Email = require("../../models/email/emailModel");
const LeadNote = require("../../models/leads/leadNoteModel");


exports.createPerson = async (req, res) => {
  try {
    const masterUserID = req.adminId; // Get the master user ID from the request
    if (!req.body || !req.body.contactPerson || !req.body.email) {
      return res.status(400).json({ message: "Contact person and email are required." });
    }
    const { contactPerson, email, phone, notes, postalAddress, birthday, jobTitle, personLabels, organization } = req.body;
   // Check for duplicate person in the same organization
    const existingPerson = await Person.findOne({
      where: {
        contactPerson,
        organization,
        // Optionally, also check email for even stricter uniqueness:
        // email
      }
    });
    if (existingPerson) {
      return res.status(409).json({ message: "Person already exists in this organization.", person: existingPerson });
    }
    // Create or find the organization
    const org = await Organization.findOrCreate({
      where: { organization },
      defaults: { organization }
    });

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
      organization: org[0].organization,
      leadOrganizationId: org[0].leadOrganizationId, // Link to org
      masterUserID
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
    if (!req.body || !req.body.organization) {
      return res.status(400).json({ message: "Organization name is required." });
    }
    const { organization, organizationLabels, address, visibleTo } = req.body;
    // Check if organization already exists
    const existingOrg = await Organization.findOne({ where: { organization } });
    if (existingOrg) {
      return res.status(409).json({ message: "Organization already exists.", organization: existingOrg });
    }
    const org = await Organization.create({
      organization,
      organizationLabels,
      address,
      visibleTo,
      masterUserID
    });
    res.status(201).json({ message: "Organization created successfully", organization: org });
  } catch (error) {
    console.error("Error creating organization:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getContactTimeline = async (req, res) => {
  try {
    // Get monthsBack from query, default to 3
    const monthsBack = parseInt(req.query.monthsBack) || 3;
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - monthsBack);

    // Fetch all persons with their organization
    const persons = await Person.findAll({
      include: [
        {
          model: Organization,
          as: "LeadOrganization",
          attributes: ["leadOrganizationId", "organization"]
        }
      ],
      attributes: [
        "personId",
        "contactPerson",
        "email",
        "phone",
        "jobTitle",
        "personLabels",
        "leadOrganizationId"
      ],
      order: [["contactPerson", "ASC"]]
    });

    // Optionally, fetch recent activities for each person (leads, emails, notes)
    // Example: filter leads, emails, notes by createdAt >= fromDate
    // You can add similar filters for emails and notes if you include them here

    res.status(200).json({
      message: "Contact timeline fetched successfully",
      persons,
      filter: { monthsBack, fromDate }
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
          attributes: ["leadOrganizationId", "organization"]
        }
      ]
    });
    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }

    // Fetch related leads
    const leads = await Lead.findAll({ where: { personId } });

    // Fetch related emails
    const emails = await Email.findAll({ where: { leadId: leads.map(l => l.leadId) } });

    // Fetch emails linked to leads
    // const leadIds = leads.map(l => l.leadId);
    // const emailsByLead = await Email.findAll({ where: { leadId: leadIds } });

    // // Fetch emails where person's email is sender or recipient
    // const emailsByAddress = await Email.findAll({
    //   where: {
    //     [Op.or]: [
    //       { sender: person.email },
    //       { recipient: { [Op.like]: `%${person.email}%` } }
    //     ]
    //   }
    // });

    // // Merge and deduplicate emails
    // const allEmailsMap = new Map();
    // emailsByLead.forEach(email => allEmailsMap.set(email.emailId, email));
    // emailsByAddress.forEach(email => allEmailsMap.set(email.emailId, email));
    // const allEmails = Array.from(allEmailsMap.values());

    // Fetch related notes
    const notes = await LeadNote.findAll({ where: { leadId: leads.map(l => l.leadId) } });

    res.status(200).json({
      person,
      leads,
      emails,
      notes
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
    const persons = await Person.findAll({ where: { leadOrganizationId: organizationId } });

    // Fetch all leads for this organization (directly or via persons)
    const personIds = persons.map(p => p.personId);
    const leads = await Lead.findAll({
      where: {
        [Op.or]: [
          { leadOrganizationId: organizationId },
          { personId: personIds }
        ]
      }
    });

    // Fetch all emails linked to these leads
    const leadIds = leads.map(l => l.leadId);
    const emails = await Email.findAll({ where: { leadId: leadIds } });

    // Fetch all notes linked to these leads
    const notes = await LeadNote.findAll({ where: { leadId: leadIds } });

    res.status(200).json({
      organization,
      persons,
      leads,
      emails,
      notes
    });
  } catch (error) {
    console.error("Error fetching organization timeline:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};