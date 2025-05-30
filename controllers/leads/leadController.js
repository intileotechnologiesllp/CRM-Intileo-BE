const Lead = require("../../models/leads/leadsModel");
const LeadFilter = require("../../models/leads/leadFiltersModel");
const LeadDetails = require("../../models/leads/leadDetailsModel"); // Import LeadDetails model
const { Op } = require("sequelize"); // Import Sequelize operators
const { logAuditTrail } = require("../../utils/auditTrailLogger"); // Import the audit trail logger
const PROGRAMS = require("../../utils/programConstants"); // Import program constants
const historyLogger = require("../../utils/historyLogger").logHistory; // Import history logger
const MasterUser = require("../../models/master/masterUserModel"); // Adjust path as needed
const LeadColumnPreference = require("../../models/leads/leadColumnModel"); // Import LeadColumnPreference model
// const Person = require("../../models/leads/leadPersonModel"); // Import Person model
// const Organization = require("../../models/leads/leadOrganizationModel"); // Import Organization model
//  const { Lead, LeadDetails, Person, Organization } = require("../../models");
const {convertRelativeDate} = require("../../utils/helper"); // Import the utility to convert relative dates
const Email = require("../../models/email/emailModel");
const UserCredential = require("../../models/email/userCredentialModel");
const Attachment = require("../../models/email/attachmentModel");
const LeadNote = require("../../models/leads/leadNoteModel"); // Import LeadNote model
// exports.createLead = async (req, res) => {
//   const {
//     contactPerson,
//     organization,
//     title,
//     valueLabels,
//     expectedCloseDate,
//     sourceChannel,
//     sourceChannelID,
//     serviceType,
//     scopeOfServiceType,
//     phone,
//     email,
//     company,
//     proposalValue,
//     esplProposalNo,
//     projectLocation,
//     organizationCountry,
//     proposalSentDate,
//     status
//   } = req.body;

//   console.log(req.role, "role of the user............");

//   try {
//     // Ensure only admins can create leads
//     // if (req.user.role !== "admin") {
//     //   return res
//     //     .status(403)
//     //     .json({ message: "Access denied. Only admins can create leads." });
//     // }

//     // Create the lead with the masterUserID from the authenticated user
//     if (!["admin", "general", "master"].includes(req.role)) {
//       await logAuditTrail(
//         PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
//         "LEAD_CREATION", // Mode
//         null, // No user ID for failed sign-in
//         "Access denied. You do not have permission to create leads.", // Error description
//         null
//       );
//       return res.status(403).json({
//         message: "Access denied. You do not have permission to create leads.",
//       });
//     }
//     // // 1. Find or create Organization
//     // let orgRecord = await Organization.findOne({ where: { organization } });
//     // if (!orgRecord) {
//     //   orgRecord = await Organization.create({ organization,masterUserID: req.adminId });
//     // }

//     // // 2. Find or create Person (linked to organization)
//     // let personRecord = await Person.findOne({ where: { email } });
//     // if (!personRecord) {
//     //   personRecord = await Person.create({
//     //     contactPerson,
//     //     email,
//     //     phone,
//     //     organizationId: orgRecord.organizationId,
//     //     masterUserID: req.adminId
//     //   });
//     // }
//     // 1. Find or create Organization
// let orgRecord = await Organization.findOne({ where: { organization } });
// if (!orgRecord) {
//   orgRecord = await Organization.create({ organization, masterUserID: req.adminId });
// }

// // 2. Find or create Person (linked to organization)
// let personRecord = await Person.findOne({ where: { email } });
// if (!personRecord) {
//   personRecord = await Person.create({
//     contactPerson,
//     email,
//     phone,
//     organizationId: orgRecord.organizationId,
//     masterUserID: req.adminId
//   });
// }

// // 3. Check for duplicate lead (same person, organization, and title)
// const existingLead = await Lead.findOne({
//   where: {
//     personId: personRecord.personId,
//     organizationId: orgRecord.organizationId,
//     title
//   }
// });

// if (existingLead) {
//   return res.status(409).json({
//     message: "A lead with this person, organization, and title already exists."
//   });
// }

//     // const lead = await Lead.create({
//     //   contactPerson,
//     //   organization,
//     //   title,
//     //   valueLabels,
//     //   expectedCloseDate,
//     //   sourceChannel,
//     //   sourceChannelID,
//     //   serviceType,
//     //   scopeOfServiceType,
//     //   phone,
//     //   email,
//     //   company,
//     //   proposalValue,
//     //   esplProposalNo,
//     //   projectLocation,
//     //   organizationCountry,
//     //   proposalSentDate,
//     //   status,
//     //   masterUserID: req.adminId, // Associate the lead with the authenticated user
//     // });
//         const lead = await Lead.create({
//       personId: personRecord.personId,
//       organizationId: orgRecord.organizationId,
//       title,
//       valueLabels,
//       expectedCloseDate,
//       sourceChannel,
//       sourceChannelID,
//       serviceType,
//       scopeOfServiceType,
//       company,
//       proposalValue,
//       esplProposalNo,
//       projectLocation,
//       organizationCountry,
//       proposalSentDate,
//       status,
//       masterUserID: req.adminId
//     });
//     await historyLogger(
//       PROGRAMS.LEAD_MANAGEMENT, // Program ID for currency management
//       "LEAD_CREATION", // Mode
//       lead.masterUserID, // Created by (Admin ID)
//       lead.leadId, // Record ID (Country ID)
//       null,
//       `Lead is created by  ${req.role}`, // Description
//       null // Changes logged as JSON
//     );
//     res.status(201).json({ message: "Lead created successfully", lead });
//   } catch (error) {
//     console.error("Error creating lead:", error);

//     await logAuditTrail(
//       PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
//       "LEAD_CREATION", // Mode
//       null, // No user ID for failed sign-in
//       "Error creating lead: " + error.message, // Error description
//       null
//     );
//     res.status(500).json(error);
//   }
// };

//.....................changes......original....................
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
    sourceOrigin
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
        const duplicateLead = await Lead.findOne({
      where: {
        organization,
        contactPerson,
        email,
        title
      }
    });
    if (duplicateLead) {
      return res.status(409).json({
        message: "Lead Already Exist."
      });
    }
     const owner = await MasterUser.findOne({ where: { masterUserID: req.adminId } });
    const ownerName = owner ? owner.name : null;
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
      masterUserID: req.adminId,
      ownerId:req.adminId,// Associate the lead with the authenticated user
      ownerName,// Store the role of the user as ownerName,
      sourceOrigin // Indicate that the lead was created manually
    });
    await LeadDetails.create({
      leadId: lead.leadId,
      responsiblePerson:req.adminId,
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

// exports.getLeads = async (req, res) => {
//   const {
//     isArchived,
//     search,
//     page = 1,
//     limit = 10,
//     sortBy = "createdAt",
//     order = "DESC",
//     masterUserID:queryMasterUserID
//   } = req.query;

//   const { valueLabels } = req.body || {}; // Get valueLabels from the request body

//   try {
//     const whereClause = {};
// //let masterUserID = queryMasterUserID || req.adminId;
//     // Allow masterUserID=all to fetch all leads, otherwise filter
//     let masterUserID = queryMasterUserID === "all" ? null : (queryMasterUserID || req.adminId);
//     // Update valueLabels for all records if provided
//     if (valueLabels) {
//       const [updatedCount] = await Lead.update(
//         { valueLabels }, // Set the new value for valueLabels
//         { where: {} } // Update all records
//       );

//       // Log the update in the audit trail
//       await logAuditTrail(
//         PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
//         "LEAD_UPDATE_ALL_LABELS", // Mode
//         req.adminId, // Admin ID of the user making the update
//         `Updated valueLabels for ${updatedCount} records`, // Description
//         null
//       );
//     }

//     // Filter by archive status if `isArchived` is provided
//     if (isArchived !== undefined) {
//       whereClause.isArchived = isArchived === "true"; // Convert string to boolean
//     }
//         if (masterUserID) {
//       whereClause.masterUserID = masterUserID;
//     }

//     // Add search functionality
//     if (search) {
//       whereClause[Op.or] = [
//         { contactPerson: { [Op.like]: `%${search}%` } }, // Search by contact person
//         { organization: { [Op.like]: `%${search}%` } }, // Search by organization
//         { title: { [Op.like]: `%${search}%` } }, // Search by title
//         { email: { [Op.like]: `%${search}%` } }, // Search by email
//         { phone: { [Op.like]: `%${search}%` } }, // Search by phone
//       ];
//     }

//   //   // Pagination
//     const offset = (page - 1) * limit;
//     // --- Get user column preferences ---
//     // const masterUserID = req.adminId;
//     // const pref = await LeadColumnPreference.findOne({ where: { masterUserID } });
//     // const columns = pref ? pref.columns : null;
//     //     // Only use valid Lead fields
//     // const validLeadFields = Object.keys(Lead.rawAttributes);
//     // const leadAttributes = columns && columns.length
//     //   ? columns
//     //       .map(col => typeof col === "string" ? col : col.key)
//     //       .filter(key => validLeadFields.includes(key))
//     //   : undefined;

//     // Fetch leads with pagination, filtering, sorting, searching, and leadDetails
//     const leads = await Lead.findAndCountAll({
//       where: whereClause,
//       include: [
//         {
//           model: LeadDetails,
//           as: "details", // Use the alias defined in the association
//           required: false, // Include leads even if they don't have leadDetails
//         },
//       ],
//       limit: parseInt(limit), // Number of records per page
//       offset: parseInt(offset), // Skip records for pagination
//       order: [[sortBy, order.toUpperCase()]], // Sorting (e.g., createdAt DESC)
//       // attributes:leadAttributes, // Only these columns
//     });

//     res.status(200).json({
//       message: "Leads fetched successfully",
//       totalRecords: leads.count, // Total number of records
//       totalPages: Math.ceil(leads.count / limit), // Total number of pages
//       currentPage: parseInt(page), // Current page
//       leads: leads.rows, // Leads data with leadDetails
//     });
//   } catch (error) {
//     console.error("Error fetching leads:", error);
//     await logAuditTrail(
//       PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
//       "LEAD_FETCH", // Mode
//       null, // No user ID for failed sign-in
//       "Error fetching leads: " + error.message, // Error description
//       null
//     );
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

//...................new code..........................
exports.getLeads = async (req, res) => {
  const {
    isArchived,
    search,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    order = "DESC",
    masterUserID: queryMasterUserID,
    filterId
  } = req.query;

  try {
        const pref = await LeadColumnPreference.findOne();
    // let leadAttributes, leadDetailsAttributes;
    // if (pref && Array.isArray(pref.columns)) {
    //   const leadFields = Object.keys(Lead.rawAttributes);
    //   const leadDetailsFields = Object.keys(LeadDetails.rawAttributes);

    //   leadAttributes = pref.columns
    //     .filter(col => col.check && leadFields.includes(col.key))
    //     .map(col => col.key);

    //   leadDetailsAttributes = pref.columns
    //     .filter(col => col.check && leadDetailsFields.includes(col.key))
    //     .map(col => col.key);
    // }
    let leadAttributes, leadDetailsAttributes;
if (pref && pref.columns) {
  // Parse columns if it's a string
  const columns = typeof pref.columns === "string"
    ? JSON.parse(pref.columns)
    : pref.columns;

  const leadFields = Object.keys(Lead.rawAttributes);
  const leadDetailsFields = Object.keys(LeadDetails.rawAttributes);

  leadAttributes = columns
    .filter(col => col.check && leadFields.includes(col.key))
    .map(col => col.key);

  leadDetailsAttributes = columns
    .filter(col => col.check && leadDetailsFields.includes(col.key))
    .map(col => col.key);
}

    console.log(leadAttributes, "leadAttributes from preferences");
    

    let whereClause = {};
    // let include = [
    //   {
    //     model: LeadDetails,
    //     as: "details",
    //     required: false,
    //     attributes: leadDetailsAttributes && leadDetailsAttributes.length > 0 ? leadDetailsAttributes : undefined
      
    //   },
    // ];
    let include = [];
if (leadDetailsAttributes && leadDetailsAttributes.length > 0) {
  include.push({
    model: LeadDetails,
    as: "details",
    required: false,
    attributes: leadDetailsAttributes
  });
}

    let masterUserID = queryMasterUserID === "all" ? null : (queryMasterUserID || req.adminId);

    console.log("→ Query params:", req.query);
    console.log("→ masterUserID resolved:", masterUserID);

    if (filterId) {
      // Fetch the saved filter
      const filter = await LeadFilter.findByPk(filterId);
      if (!filter) {
        console.log("→ Filter not found for filterId:", filterId);
        return res.status(404).json({ message: "Filter not found." });
      }
      console.log("→ Loaded filterConfig:", JSON.stringify(filter.filterConfig));
const filterConfig = typeof filter.filterConfig === "string"
  ? JSON.parse(filter.filterConfig)
  : filter.filterConfig;

      const { all = [], any = [] } =filterConfig;
      const leadFields = Object.keys(Lead.rawAttributes);
      const leadDetailsFields = Object.keys(LeadDetails.rawAttributes);

      let filterWhere = {};
      let leadDetailsWhere = {};

if (all.length > 0) {
  filterWhere[Op.and] = [];
  leadDetailsWhere[Op.and] = [];
  all.forEach(cond => {
    console.log("→ Processing 'all' condition:", cond);
    if (leadFields.includes(cond.field)) {
      const condition = buildCondition(cond);
      console.log("→ Lead condition:", condition);
      filterWhere[Op.and].push(condition);
    } else if (leadDetailsFields.includes(cond.field)) {
      const condition = buildCondition(cond);
      console.log("→ LeadDetails condition:", condition);
      leadDetailsWhere[Op.and].push(condition);
    } else {
      console.log("→ Field not found in Lead or LeadDetails:", cond.field);
    }
  });
  if (filterWhere[Op.and].length === 0) delete filterWhere[Op.and];
  if (leadDetailsWhere[Op.and].length === 0) delete leadDetailsWhere[Op.and];
}
if (any.length > 0) {
  filterWhere[Op.or] = [];
  leadDetailsWhere[Op.or] = [];
  any.forEach(cond => {
    console.log("→ Processing 'any' condition:", cond);
    if (leadFields.includes(cond.field)) {
      const condition = buildCondition(cond);
      console.log("→ Lead condition (OR):", condition);
      filterWhere[Op.or].push(condition);
    } else if (leadDetailsFields.includes(cond.field)) {
      const condition = buildCondition(cond);
      console.log("→ LeadDetails condition (OR):", condition);
      leadDetailsWhere[Op.or].push(condition);
    } else {
      console.log("→ Field not found in Lead or LeadDetails (OR):", cond.field);
    }
  });
  if (filterWhere[Op.or].length === 0) delete filterWhere[Op.or];
  if (leadDetailsWhere[Op.or].length === 0) delete leadDetailsWhere[Op.or];
}

      // Merge with archive/masterUserID filters
      if (isArchived !== undefined) filterWhere.isArchived = isArchived === "true";
      if (masterUserID) filterWhere.masterUserID = masterUserID;

      whereClause = filterWhere;

      console.log("→ Built filterWhere:", JSON.stringify(filterWhere));
      console.log("→ Built leadDetailsWhere:", JSON.stringify(leadDetailsWhere));

      // Add LeadDetails filter if needed
      if (Object.keys(leadDetailsWhere).length > 0) {
        include = [
          ...include,
          {
            model: LeadDetails,
            as: "details",
            where: leadDetailsWhere,
            required: true
            
          }
        ];
        console.log("→ Updated include with LeadDetails where:", JSON.stringify(leadDetailsWhere));
      }
    } else {
      // Standard search/filter logic
      if (isArchived !== undefined) whereClause.isArchived = isArchived === "true";
      if (masterUserID) whereClause.masterUserID = masterUserID;

      if (search) {
        whereClause[Op.or] = [
          { contactPerson: { [Op.like]: `%${search}%` } },
          { organization: { [Op.like]: `%${search}%` } },
          { title: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { phone: { [Op.like]: `%${search}%` } },
        ];
        console.log("→ Search applied, whereClause[Op.or]:", whereClause[Op.or]);
      }
    }

    // Pagination
    const offset = (page - 1) * limit;
    console.log("→ Final whereClause:", JSON.stringify(whereClause));
    console.log("→ Final include:", JSON.stringify(include));
    console.log("→ Pagination: limit =", limit, "offset =", offset);
    console.log("→ Order:", sortBy, order);

    // Fetch leads with pagination, filtering, sorting, searching, and leadDetails
    const leads = await Lead.findAndCountAll({
      where: whereClause,
      include,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, order.toUpperCase()]],
      attributes: leadAttributes && leadAttributes.length > 0 ? leadAttributes : undefined
    });

    console.log("→ Query executed. Total records:", leads.count);
    const flatLeads = leads.rows.map(lead => {
  const leadObj = lead.toJSON();
  if (leadObj.details) {
    Object.assign(leadObj, leadObj.details);
    delete leadObj.details;
  }
  return leadObj;
});

    res.status(200).json({
      message: "Leads fetched successfully",
      totalRecords: leads.count,
      totalPages: Math.ceil(leads.count / limit),
      currentPage: parseInt(page),
      // leads: leads.rows,
      leads: flatLeads // Return flattened leads with leadDetails merged
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// --- Helper functions (reuse from your prompt) ---

const operatorMap = {
  "is": "eq",
  "is not": "ne",
  "is empty": "is empty",
  "is not empty": "is not empty",
  "is exactly or earlier than": "lte",
  "is earlier than": "lt",
  "is exactly or later than": "gte",
  "is later than": "gt"
  // Add more mappings if needed
};

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
  const leadDateFields = Object.entries(Lead.rawAttributes)
  .filter(([_, attr]) => attr.type && attr.type.key === 'DATE')
  .map(([key]) => key);

const leadDetailsDateFields = Object.entries(LeadDetails.rawAttributes)
  .filter(([_, attr]) => attr.type && attr.type.key === 'DATE')
  .map(([key]) => key);

const allDateFields = [...leadDateFields, ...leadDetailsDateFields];
  // if (
  //   ["createdAt", "updatedAt", "expectedCloseDate", "proposalSentDate", "nextActivityDate", "archiveTime"].includes(cond.field)
  // ) {
  //   // If useExactDate is true, use the value directly
  //   if (cond.useExactDate) {
  //     // Validate the date
  //     const date = new Date(cond.value);
  //     if (isNaN(date.getTime())) return {};
  //     return {
  //       [cond.field]: {
  //         [ops[operator] || Op.eq]: date,
  //       },
  //     };
  //   }
  if (allDateFields.includes(cond.field)) {
    if (cond.useExactDate) {
      const date = new Date(cond.value);
      if (isNaN(date.getTime())) return {};
      return {
        [cond.field]: {
          [ops[operator] || Op.eq]: date,
        },
      };
    }
    // Otherwise, use relative date conversion
    const dateRange = convertRelativeDate(cond.value);
    const isValidDate = d => d instanceof Date && !isNaN(d.getTime());

    if (dateRange && isValidDate(dateRange.start) && isValidDate(dateRange.end)) {
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
    return {};
  }

  // Default
  return {
    [cond.field]: {
      [ops[operator] || Op.eq]: cond.value,
    },
  };
}

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
      ownerId: lead.ownerId, // Include ownerId if needed
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
      ownerId: lead.ownerId, // Include ownerId if needed
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



// exports.getConversationWithClient = async (req, res) => {
//   const masterUserID = req.adminId;
//   const { clientEmail } = req.body;

//   if (!clientEmail) {
//     return res.status(400).json({ message: "clientEmail is required." });
//   }

//   try {
//     // Get the user's email address from credentials
//     const userCredential = await UserCredential.findOne({ where: { masterUserID } });
//     if (!userCredential) {
//       return res.status(404).json({ message: "User credentials not found." });
//     }
//     const userEmail = userCredential.email.toLowerCase();

//     // Find all emails between user and client (both directions)
//     const emails = await Email.findAll({
//       where: {
//         [Op.or]: [
//           {
//             sender: userEmail,
//             recipient: { [Op.like]: `%${clientEmail}%` }
//           },
//           {
//             sender: clientEmail,
//             recipient: { [Op.like]: `%${userEmail}%` }
//           }
//         ]
//       },
//       include: [{ model: Attachment, as: "attachments" }],
//       order: [["createdAt", "ASC"]]
//     });

//     if (!emails.length) {
//       return res.status(404).json({ message: "No emails found for this conversation." });
//     }

//     // Gather all thread IDs from these emails
//     const threadIds = [];
//     emails.forEach(email => {
//       if (email.messageId) threadIds.push(email.messageId);
//       if (email.inReplyTo) threadIds.push(email.inReplyTo);
//       if (email.references) threadIds.push(...email.references.split(" "));
//     });
//     const uniqueThreadIds = [...new Set(threadIds.filter(Boolean))];

//     // Fetch all related emails in the thread (across all users)
//     let relatedEmails = await Email.findAll({
//       where: {
//         [Op.or]: [
//           { messageId: { [Op.in]: uniqueThreadIds } },
//           { inReplyTo: { [Op.in]: uniqueThreadIds } },
//           {
//             references: {
//               [Op.or]: uniqueThreadIds.map(id => ({
//                 [Op.like]: `%${id}%`
//               }))
//             }
//           }
//         ]
//       },
//       include: [{ model: Attachment, as: "attachments" }],
//       order: [["createdAt", "ASC"]]
//     });

//     // Remove duplicates by messageId
//     const seen = new Set();
//     relatedEmails = relatedEmails.filter(email => {
//       if (seen.has(email.messageId)) return false;
//       seen.add(email.messageId);
//       return true;
//     });

//     res.status(200).json({
//       message: "Conversation fetched successfully.",
//       emails: relatedEmails
//     });
//   } catch (error) {
//     console.error("Error fetching conversation:", error);
//     res.status(500).json({ message: "Internal server error." });
//   }
// };

// exports.getConversationWithClient = async (req, res) => {
//   const { clientEmail } = req.body;
//   const { leadId } = req.params;

//   if (!clientEmail) {
//     return res.status(400).json({ message: "clientEmail is required." });
//   }
//     if (!leadId) {
//     return res.status(400).json({ message: "leadId is required in params." });
//   }

//   try {
//     // 1. Find all emails where clientEmail is sender or recipient (sent/received)
//     const baseEmails = await Email.findAll({
//       where: {
//         [Op.or]: [
//           { sender: clientEmail },
//           { recipient: { [Op.like]: `%${clientEmail}%` } }
//         ]
//       },
//       include: [{ model: Attachment, as: "attachments" }],
//       order: [["createdAt", "ASC"]]
//     });

//     if (!baseEmails.length) {
//       return res.status(404).json({ message: "No emails found for this client." });
//     }

//     // 2. Collect all thread IDs (messageId, inReplyTo, references)
//     const threadIds = [];
//     baseEmails.forEach(email => {
//       if (email.messageId) threadIds.push(email.messageId);
//       if (email.inReplyTo) threadIds.push(email.inReplyTo);
//       if (email.references) threadIds.push(...email.references.split(" "));
//     });
//     const uniqueThreadIds = [...new Set(threadIds.filter(Boolean))];

//     // 3. Fetch all related emails in the thread (replied/conversation)
//     let repliedEmails = [];
//     if (uniqueThreadIds.length > 0) {
//       repliedEmails = await Email.findAll({
//         where: {
//           [Op.or]: [
//             { messageId: { [Op.in]: uniqueThreadIds } },
//             { inReplyTo: { [Op.in]: uniqueThreadIds } },
//             {
//               references: {
//                 [Op.or]: uniqueThreadIds.map(id => ({
//                   [Op.like]: `%${id}%`
//                 }))
//               }
//             }
//           ]
//         },
//         include: [{ model: Attachment, as: "attachments" }],
//         order: [["createdAt", "ASC"]]
//       });
//     }

//     // 4. Combine and deduplicate by messageId
//     const allEmails = [...baseEmails, ...repliedEmails];
//     const seen = new Set();
//     const uniqueEmails = allEmails.filter(email => {
//       if (seen.has(email.messageId)) return false;
//       seen.add(email.messageId);
//       return true;
//     });

//       //Fetch notes for this leadId
//     const notes = await LeadNote.findAll({
//       where: { leadId },
//       order: [["createdAt", "DESC"]],
//     });

//     res.status(200).json({
//       message: "Conversation and related emails fetched successfully.",
//       emails: uniqueEmails,
//       notes
//     });
//   } catch (error) {
//     console.error("Error fetching conversation:", error);
//     res.status(500).json({ message: "Internal server error." });
//   }
// };

//........................only reply thread for client conversation................./
exports.getConversationWithClient = async (req, res) => {
  const { clientEmail } = req.body;

  if (!clientEmail) {
    return res.status(400).json({ message: "clientEmail is required." });
  }

  try {
    // Step 1: Find all emails where clientEmail is sender or recipient
    const baseEmails = await Email.findAll({
      where: {
        [Op.or]: [
          { sender: clientEmail },
          { recipient: { [Op.like]: `%${clientEmail}%` } }
        ]
      },
      include: [{ model: Attachment, as: "attachments" }],
      order: [["createdAt", "ASC"]]
    });

    if (!baseEmails.length) {
      return res.status(404).json({ message: "No emails found for this client." });
    }

    // Step 2: Collect all thread IDs (messageId, inReplyTo, references)
    const threadIds = [];
    baseEmails.forEach(email => {
      if (email.messageId) threadIds.push(email.messageId);
      if (email.inReplyTo) threadIds.push(email.inReplyTo);
      if (email.references) threadIds.push(...email.references.split(" "));
    });
    const uniqueThreadIds = [...new Set(threadIds.filter(Boolean))];

    // Step 3: Fetch only replied/conversation emails (those with inReplyTo or references in the thread)
    const repliedEmails = await Email.findAll({
      where: {
        [Op.or]: [
          { inReplyTo: { [Op.in]: uniqueThreadIds } },
          {
            references: {
              [Op.or]: uniqueThreadIds.map(id => ({
                [Op.like]: `%${id}%`
              }))
            }
          }
        ]
      },
      include: [{ model: Attachment, as: "attachments" }],
      order: [["createdAt", "ASC"]]
    });

    if (!repliedEmails.length) {
      return res.status(404).json({ message: "No replied conversation emails found for this client." });
    }

    res.status(200).json({
      message: "Replied conversation emails fetched successfully.",
      emails: repliedEmails
    });
  } catch (error) {
    console.error("Error fetching replied conversation emails:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.addLeadNote = async (req, res) => {
  const {content} = req.body;
  const { leadId } = req.params;
  const masterUserID = req.adminId;
  const createdBy = req.adminId;

  // 100KB = 102400 bytes
  if (!content || Buffer.byteLength(content, 'utf8') > 102400) {
    return res.status(400).json({ message: "Note is required and must be under 100KB." });
  }
  if (!leadId) {
    return res.status(400).json({ message: "leadId is required." });
  }

  try {
    const note = await LeadNote.create({
      leadId,
      masterUserID,
      content,
      createdBy,
    });
    res.status(201).json({ message: "Note added successfully", note });
  } catch (error) {
    console.error("Error adding note:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


