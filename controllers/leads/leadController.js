const Lead = require("../../models/leads/leadsModel");
const LeadDetails = require("../../models/leads/leadDetailsModel"); // Import LeadDetails model
const { Op } = require("sequelize"); // Import Sequelize operators
const { logAuditTrail } = require("../../utils/auditTrailLogger"); // Import the audit trail logger
const PROGRAMS = require("../../utils/programConstants"); // Import program constants
const historyLogger = require("../../utils/historyLogger").logHistory; // Import history logger
const MasterUser = require("../../models/master/masterUserModel"); // Adjust path as needed
const LeadColumnPreference = require("../../models/leads/leadColumnModel"); // Import LeadColumnPreference model

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
    status
  } = req.body;

  console.log(req.role, "role of the user............");

  try {
    // Ensure only admins can create leads
    // if (req.user.role !== "admin") {
    //   return res
    //     .status(403)
    //     .json({ message: "Access denied. Only admins can create leads." });
    // }

    // Create the lead with the masterUserID from the authenticated user
    if (!["admin", "general", "master"].includes(req.role)) {
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
        "LEAD_CREATION", // Mode
        null, // No user ID for failed sign-in
        "Access denied. You do not have permission to create leads.", // Error description
        null
      );
      return res.status(403).json({
        message: "Access denied. You do not have permission to create leads.",
      });
    }
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
      masterUserID: req.adminId, // Associate the lead with the authenticated user
    });
    await historyLogger(
      PROGRAMS.LEAD_MANAGEMENT, // Program ID for currency management
      "LEAD_CREATION", // Mode
      lead.masterUserID, // Created by (Admin ID)
      lead.leadId, // Record ID (Country ID)
      null,
      `Lead is created by  ${req.role}`, // Description
      null // Changes logged as JSON
    );
    res.status(201).json({ message: "Lead created successfully", lead });
  } catch (error) {
    console.error("Error creating lead:", error);

    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
      "LEAD_CREATION", // Mode
      null, // No user ID for failed sign-in
      "Error creating lead: " + error.message, // Error description
      null
    );
    res.status(500).json(error);
  }
};

exports.archiveLead = async (req, res) => {
  const { leadId } = req.params; // Use leadId instead of id

  try {
    const lead = await Lead.findByPk(leadId); // Find lead by leadId
    if (!lead) {
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
        "LEAD_ARCHIVE", // Mode
        req.role, // No user ID for failed sign-in
        "Lead not found", // Error description
        req.adminId
      );
      return res.status(404).json({ message: "Lead not found" });
    }

    lead.isArchived = true; // Set the lead as archived
    lead.archiveTime = new Date(); // Set the archive time to now
    await lead.save();
    await historyLogger(
      PROGRAMS.LEAD_MANAGEMENT, // Program ID for currency management
      "LEAD_ARCHIVE", // Mode
      lead.masterUserID, // Admin ID from the authenticated request
      leadId, // Record ID (Currency ID)
      req.adminId,
      `Lead is archived by "${req.role}"`, // Description
      null
    );
    res.status(200).json({ message: "Lead archived successfully", lead });
  } catch (error) {
    console.error("Error archiving lead:", error);
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
      "LEAD_ARCHIVE", // Mode
      null, // No user ID for failed sign-in
      "Error archiving lead: " + error.message, // Error description
      null
    );
    res.status(500).json(error);
  }
};

exports.unarchiveLead = async (req, res) => {
  const { leadId } = req.params; // Use leadId instead of id

  try {
    const lead = await Lead.findByPk(leadId); // Find lead by leadId
    if (!lead) {
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
        "LEAD_UNARCHIVE", // Mode
        req.role, // No user ID for failed sign-in
        "Lead not found", // Error description
        req.adminId
      );
      return res.status(404).json({ message: "Lead not found" });
    }

    lead.isArchived = false; // Set the lead as unarchived
    await lead.save();
    await historyLogger(
      PROGRAMS.LEAD_MANAGEMENT, // Program ID for currency management
      "LEAD_UNARCHIVE", // Mode
      lead.masterUserID, // Admin ID from the authenticated request
      leadId, // Record ID (Currency ID)
      req.adminId,
      `Lead is unarchived by "${req.role}"`, // Description
      null
    );
    res.status(200).json({ message: "Lead unarchived successfully", lead });
  } catch (error) {
    console.error("Error unarchiving lead:", error);
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
      "LEAD_UNARCHIVE", // Mode
      null, // No user ID for failed sign-in
      "Error unarchiving lead: " + error.message, // Error description
      null
    );
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

  const { valueLabels } = req.body || {}; // Get valueLabels from the request body

  try {
    const whereClause = {};

    // Update valueLabels for all records if provided
    if (valueLabels) {
      const [updatedCount] = await Lead.update(
        { valueLabels }, // Set the new value for valueLabels
        { where: {} } // Update all records
      );

      // Log the update in the audit trail
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
        "LEAD_UPDATE_ALL_LABELS", // Mode
        req.adminId, // Admin ID of the user making the update
        `Updated valueLabels for ${updatedCount} records`, // Description
        null
      );
    }

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

  //   // Pagination
    const offset = (page - 1) * limit;

  //       // --- Get user column preferences ---
  //   const masterUserID = req.adminId;
  //   const pref = await LeadColumnPreference.findOne({ where: { masterUserID } });
  //   const columns = pref ? pref.columns : null;
  //   const leadAttributes = columns && columns.length
  // ? columns.map(col => typeof col === "string" ? col : col.key)
  // : undefined;
    // Fetch leads with pagination, filtering, sorting, searching, and leadDetails
    const leads = await Lead.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: LeadDetails,
          as: "details", // Use the alias defined in the association
          required: false, // Include leads even if they don't have leadDetails
        },
      ],
      limit: parseInt(limit), // Number of records per page
      offset: parseInt(offset), // Skip records for pagination
      order: [[sortBy, order.toUpperCase()]], // Sorting (e.g., createdAt DESC)
      // attributes:leadAttributes, // Only these columns
    });

    res.status(200).json({
      message: "Leads fetched successfully",
      totalRecords: leads.count, // Total number of records
      totalPages: Math.ceil(leads.count / limit), // Total number of pages
      currentPage: parseInt(page), // Current page
      leads: leads.rows, // Leads data with leadDetails
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
      "LEAD_FETCH", // Mode
      null, // No user ID for failed sign-in
      "Error fetching leads: " + error.message, // Error description
      null
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateLead = async (req, res) => {
  const { leadId } = req.params; // Use leadId from the request parameters
  const { leadDetails, ...updatedData } = req.body; // Separate leadDetails from other data

  try {
    const lead = await Lead.findByPk(leadId); // Find the lead by leadId
    if (!lead) {
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
        "LEAD_UPDATE", // Mode
        req.role, // No user ID for failed sign-in
        "Lead not found", // Error description
        req.adminId
      );
      return res.status(404).json({ message: "Lead not found" });
    }

    // Capture the original data before the update
    const originalData = {
      contactPerson: lead.contactPerson,
      organization: lead.organization,
      title: lead.title,
      valueLabels: lead.valueLabels,
      expectedCloseDate: lead.expectedCloseDate,
      sourceChannel: lead.sourceChannel,
      sourceChannelID: lead.sourceChannelID,
      serviceType: lead.serviceType,
      scopeOfServiceType: lead.scopeOfServiceType,
      phone: lead.phone,
      email: lead.email,
      company: lead.company,
      proposalValue: lead.proposalValue,
      esplProposalNo: lead.esplProposalNo,
      projectLocation: lead.projectLocation,
      organizationCountry: lead.organizationCountry,
      proposalSentDate: lead.proposalSentDate,
      status: lead.status,
    };

    // Update the lead with the provided data
    await lead.update(updatedData);

    // Handle leadDetails if provided
    if (leadDetails) {
      const existingLeadDetails = await LeadDetails.findOne({
        where: { leadId },
      });

      if (existingLeadDetails) {
        // Update existing leadDetails
        await existingLeadDetails.update(leadDetails);
      } else {
        // Create new leadDetails
        await LeadDetails.create({
          leadId,
          ...leadDetails,
        });
      }
    }

    // Capture the updated data
    const updatedLead = {
      contactPerson: lead.contactPerson,
      organization: lead.organization,
      title: lead.title,
      valueLabels: lead.valueLabels,
      expectedCloseDate: lead.expectedCloseDate,
      sourceChannel: lead.sourceChannel,
      sourceChannelID: lead.sourceChannelID,
      serviceType: lead.serviceType,
      scopeOfServiceType: lead.scopeOfServiceType,
      phone: lead.phone,
      email: lead.email,
      company: lead.company,
      proposalValue: lead.proposalValue,
      esplProposalNo: lead.esplProposalNo,
      projectLocation: lead.projectLocation,
      organizationCountry: lead.organizationCountry,
      proposalSentDate: lead.proposalSentDate,
      status: lead.status,
    };

    // Calculate the changes
    const changes = {};
    for (const key in updatedLead) {
      if (originalData[key] !== updatedLead[key]) {
        changes[key] = { from: originalData[key], to: updatedLead[key] };
      }
    }

    await historyLogger(
      PROGRAMS.LEAD_MANAGEMENT, // Program ID for lead management
      "LEAD_UPDATE", // Mode
      lead.masterUserID, // Created by (Admin ID)
      leadId, // Record ID (Lead ID)
      req.adminId, // Modified by (Admin ID)
      `Lead with ID ${leadId} updated by user ${req.role}`, // Description
      changes // Changes logged as JSON
    );

    res.status(200).json({ message: "Lead updated successfully", lead });
  } catch (error) {
    console.error("Error updating lead:", error);
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
      "LEAD_UPDATE", // Mode
      null, // No user ID for failed sign-in
      "Error updating lead: " + error.message, // Error description
      null
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteLead = async (req, res) => {
  const { leadId } = req.params; // Use leadId from the request parameters

  try {
    const lead = await Lead.findByPk(leadId); // Find the lead by leadId
    if (!lead) {
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
        "LEAD_DELETE", // Mode
        req.role, // No user ID for failed sign-in
        "Lead not found", // Error description
        req.adminId
      );
      return res.status(404).json({ message: "Lead not found" });
    }

    // Delete the lead
    await lead.destroy();
    await historyLogger(
      PROGRAMS.LEAD_MANAGEMENT, // Program ID for currency management
      "LEAD_DELETE", // Mode
      lead.masterUserID, // Admin ID from the authenticated request
      leadId, // Record ID (Currency ID)
      req.adminId,
      `Lead "${lead}" deleted by "${req.role}"`, // Description
      null // No changes to log for deletion
    );
    res.status(200).json({ message: "Lead deleted successfully" });
  } catch (error) {
    console.error("Error deleting lead:", error);
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
      "LEAD_DELETE", // Mode
      null, // No user ID for failed sign-in
      "Error deleting lead: " + error.message, // Error description
      null
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateAllLabels = async (req, res) => {
  try {
    const { valueLabels } = req.body; // Get valueLabels from the request body

    // Validate input
    if (!valueLabels) {
      return res.status(400).json({ message: "valueLabels is required." });
    }

    // Update valueLabels for all records
    const [updatedCount] = await Lead.update(
      { valueLabels }, // Set the new value for valueLabels
      { where: {} } // Update all records
    );

    // Log the update in the audit trail
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
      "LEAD_UPDATE_ALL_LABELS", // Mode
      req.adminId, // Admin ID of the user making the update
      `Updated valueLabels for ${updatedCount} records`, // Description
      null
    );

    res.status(200).json({
      message: `Value labels updated successfully for ${updatedCount} records.`,
    });
  } catch (error) {
    console.error("Error updating all labels:", error);
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
      "LEAD_UPDATE_ALL_LABELS", // Mode
      null, // No user ID for failed operation
      "Error updating all labels: " + error.message, // Error description
      null
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

//......................................................
exports.updateLeadCustomFields = async (req, res) => {
  const { leadId } = req.params;
  const { customFields } = req.body;

  if (!customFields || typeof customFields !== "object") {
    return res.status(400).json({ message: "customFields must be a valid object." });
  }

  try {
    const lead = await Lead.findByPk(leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Save original customFields for history
    const originalCustomFields = lead.customFields || {};

    // Update only customFields
    await lead.update({ customFields });

    // Log the change (optional)
    await historyLogger(
      PROGRAMS.LEAD_MANAGEMENT,
      "LEAD_UPDATE_CUSTOM_FIELDS",
      lead.masterUserID,
      leadId,
      req.adminId,
      `Custom fields updated for lead ${leadId} by user ${req.role}`,
      { from: originalCustomFields, to: customFields }
    );

    res.status(200).json({ message: "Custom fields updated successfully", customFields: lead.customFields });
  } catch (error) {
    console.error("Error updating custom fields:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getNonAdminMasterUserNames = async (req, res) => {
  try {
    const users = await MasterUser.findAll({
      where: { userType: { [Op.ne]: "admin" } },
      attributes: ["masterUserID", "name"], // Only return id and name
    });
    res.status(200).json({ users });
  } catch (error) {
    console.error("Error fetching master users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getLeadsByMasterUser = async (req, res) => {
  const { masterUserID, name } = req.body;

  try {
    let whereClause = {};

    if (masterUserID) {
      whereClause.masterUserID = masterUserID;
    } else if (name) {
      // Find masterUserID by name
      const user = await MasterUser.findOne({ where: { name } });
      if (!user) {
        return res.status(404).json({ message: "Master user not found." });
      }
      whereClause.masterUserID = user.masterUserID;
    } else {
      return res.status(400).json({ message: "Please provide masterUserID or name." });
    }

    const leads = await Lead.findAll({ where: whereClause });
    res.status(200).json({ leads });
  } catch (error) {
    console.error("Error fetching leads by master user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
