const Deal = require("../../models/deals/dealsModels");
const Lead = require("../../models/leads/leadsModel");
const Person = require("../../models/leads/leadPersonModel");
const Organization = require("../../models/leads/leadOrganizationModel");
const { Op } = require("sequelize");
// Create a new deal with validation
exports.createDeal = async (req, res) => {
  try {
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
      sourceOrgin
    } = req.body;

    // Validate required fields here...



 // Validation
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "Title is required." });
    }
    if (!email || !/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
      return res.status(400).json({ message: "A valid email is required." });
    }
    if (!phone || !/^\+?\d{7,15}$/.test(phone)) {
      return res.status(400).json({ message: "A valid phone number is required." });
    }
    // Find or create Person and Organization here...
    // Check for unique title
    const existingDeal = await Deal.findOne({ where: { title } });
    if (existingDeal) {
      return res.status(400).json({ message: "A deal with this title already exists." });
    }
    // 1. Set masterUserID at the top, before using it anywhere
const masterUserID = req.adminId
        // 1. Check if a matching lead exists
    const existingLead = await Lead.findOne({
      where: {
        contactPerson,
        organization,
        title
        // You can adjust the matching logic as needed
      }
    });
        let ownerId = req.adminId// fallback if no lead
    if (existingLead) {
      ownerId = existingLead.ownerId; // use the lead's ownerId if converting
    }
    //const masterUserID = req.user?.id || req.adminId || req.body.masterUserID;
    let leadId = null;
    if (existingLead) {
      leadId = existingLead.leadId;

      // Optionally, mark the lead as converted or link the deal
      // await existingLead.update({ convertedToDeal: true }); // if you have such a field
      // Or: await existingLead.update({ dealId: newDealId });
      //  // after deal is created
      await existingLead.update({ dealId: deal.dealId });
    }
        // 1. Find or create Organization
    let org = null;
    if (organization) {
      org = await Organization.findOrCreate({
        where: { organization },
        defaults: { organization }
      });
      org = org[0]; // findOrCreate returns [instance, created]
    }
        // 2. Find or create Person
    let person = null;
    if (contactPerson) {
  const masterUserID = req.adminId;

person = await Person.findOrCreate({
  where: { contactPerson, email },
  defaults: {
    contactPerson,
    email,
    phone,
    leadOrganizationId: org ? org.leadOrganizationId : null,
    masterUserID // <-- Make sure this is present and not null!
  }
});
      person = person[0];
    }
    // Create the lead
    const deal = await Deal.create({
      contactPerson: person ? person.contactPerson : null,
      organization: org ? org.organization : null,
      personId: person ? person.personId : null,
      leadOrganizationId: org ? org.leadOrganizationId : null,
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
      // Add personId, organizationId, etc. as needed
    });
    // Optionally, update the lead with the new dealId
    if (existingLead) {
      await existingLead.update({ dealId: deal.dealId });
    }
    res.status(201).json({ message: "Lead created successfully", deal });
  } catch (error) {
    console.log("Error creating deal:", error);
    
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getDeals = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      pipeline,
      pipelineStage,
      ownerId
    } = req.query;

    const where = {};

    // Search by title, contactPerson, or organization
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { contactPerson: { [Op.like]: `%${search}%` } },
        { organization: { [Op.like]: `%${search}%` } }
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

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows: deals, count: total } = await Deal.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [["createdAt", "DESC"]]
    });

    res.status(200).json({
      deals,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateDeal = async (req, res) => {
  try {
    const { dealId } = req.params;
    const updateFields = req.body;

    // Optionally: Validate fields here

    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }

    await deal.update(updateFields);

    res.status(200).json({ message: "Deal updated successfully", deal });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};