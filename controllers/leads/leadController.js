const Lead = require("../../models/leads/leadsModel");
const { Op } = require("sequelize"); // Import Sequelize operators

exports.createLead = async (req, res) => {
  const {
    contactPerson,
    organization,
    title,
    valueLabels,
    expectedCloseDate,
    sourceChannel,
    sourceChannelID,
    serviceType,
    scopeOfServiceType,
    phone,
    email,
    company,
    proposalValue,
    esplProposalNo,
    projectLocation,
    organizationCountry,
    proposalSentDate,
    status,
  } = req.body;

  try {
    // Ensure only admins can create leads
    // if (req.user.role !== "admin") {
    //   return res
    //     .status(403)
    //     .json({ message: "Access denied. Only admins can create leads." });
    // }

    // Create the lead with the userId from the authenticated user
    const lead = await Lead.create({
      contactPerson,
      organization,
      title,
      valueLabels,
      expectedCloseDate,
      sourceChannel,
      sourceChannelID,
      serviceType,
      scopeOfServiceType,
      phone,
      email,
      company,
      proposalValue,
      esplProposalNo,
      projectLocation,
      organizationCountry,
      proposalSentDate,
      status,
      userId: req.adminId, // Associate the lead with the authenticated user
    });

    res.status(201).json({ message: "Lead created successfully", lead });
  } catch (error) {
    console.error("Error creating lead:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.archiveLead = async (req, res) => {
  const { leadId } = req.params; // Use leadId instead of id

  try {
    const lead = await Lead.findByPk(leadId); // Find lead by leadId
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    lead.isArchived = true; // Set the lead as archived
    await lead.save();

    res.status(200).json({ message: "Lead archived successfully", lead });
  } catch (error) {
    console.error("Error archiving lead:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.unarchiveLead = async (req, res) => {
  const { leadId } = req.params; // Use leadId instead of id

  try {
    const lead = await Lead.findByPk(leadId); // Find lead by leadId
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    lead.isArchived = false; // Set the lead as unarchived
    await lead.save();

    res.status(200).json({ message: "Lead unarchived successfully", lead });
  } catch (error) {
    console.error("Error unarchiving lead:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getLeads = async (req, res) => {
  const {
    isArchived,
    search,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    order = "DESC",
  } = req.query;

  try {
    const whereClause = {};

    // Filter by archive status if `isArchived` is provided
    if (isArchived !== undefined) {
      whereClause.isArchived = isArchived === "true"; // Convert string to boolean
    }

    // Add search functionality
    if (search) {
      whereClause[Op.or] = [
        { contactPerson: { [Op.like]: `%${search}%` } }, // Search by contact person
        { organization: { [Op.like]: `%${search}%` } }, // Search by organization
        { title: { [Op.like]: `%${search}%` } }, // Search by title
        { email: { [Op.like]: `%${search}%` } }, // Search by email
        { phone: { [Op.like]: `%${search}%` } }, // Search by phone
      ];
    }

    // Pagination
    const offset = (page - 1) * limit;

    // Fetch leads with pagination, filtering, sorting, and searching
    const leads = await Lead.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit), // Number of records per page
      offset: parseInt(offset), // Skip records for pagination
      order: [[sortBy, order.toUpperCase()]], // Sorting (e.g., createdAt DESC)
    });

    res.status(200).json({
      message: "Leads fetched successfully",
      totalRecords: leads.count, // Total number of records
      totalPages: Math.ceil(leads.count / limit), // Total number of pages
      currentPage: parseInt(page), // Current page
      leads: leads.rows, // Leads data
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
