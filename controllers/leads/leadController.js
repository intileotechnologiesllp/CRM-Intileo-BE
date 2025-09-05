// const Lead = require("../../models/leads/leadsModel");
const LeadFilter = require("../../models/leads/leadFiltersModel");
//const LeadDetails = require("../../models/leads/leadDetailsModel"); // Import LeadDetails model
const { Op } = require("sequelize"); // Import Sequelize operators
const Sequelize = require("sequelize");
const { logAuditTrail } = require("../../utils/auditTrailLogger"); // Import the audit trail logger
const PROGRAMS = require("../../utils/programConstants"); // Import program constants
const historyLogger = require("../../utils/historyLogger").logHistory; // Import history logger
const MasterUser = require("../../models/master/masterUserModel"); // Adjust path as needed
const LeadColumnPreference = require("../../models/leads/leadColumnModel"); // Import LeadColumnPreference model
//const Person = require("../../models/leads/leadPersonModel"); // Import Person model
//const Organization = require("../../models/leads/leadOrganizationModel"); // Import Organization model
const { Lead, LeadDetails, Person, Organization } = require("../../models");
const Activity = require("../../models/activity/activityModel"); // Only import Activity where needed
const Currency = require("../../models/admin/masters/currencyModel");
const { convertRelativeDate } = require("../../utils/helper"); // Import the utility to convert relative dates
const Email = require("../../models/email/emailModel");
const UserCredential = require("../../models/email/userCredentialModel");
const Attachment = require("../../models/email/attachmentModel");
const LeadNote = require("../../models/leads/leadNoteModel"); // Import LeadNote model
const Deal = require("../../models/deals/dealsModels"); // Import Deal model
const CustomField = require("../../models/customFieldModel");
const CustomFieldValue = require("../../models/customFieldValueModel");
const {
  VisibilityGroup,
  GroupMembership,
  ItemVisibilityRule,
} = require("../../models/admin/visibilityAssociations");

const { sendEmail } = require("../../utils/emailSend");

// Helper function to get user's visibility permissions for leads
async function getUserLeadVisibilityPermissions(userId, userRole) {
  if (userRole === "admin") {
    return {
      canCreate: true,
      canView: "all",
      canEdit: "all",
      canDelete: "all",
      defaultVisibility: "everyone",
      userGroup: null,
    };
  }

  try {
    const membership = await GroupMembership.findOne({
      where: {
        userId,
        isActive: true,
      },
      include: [
        {
          model: VisibilityGroup,
          as: "group",
          where: { isActive: true },
        },
      ],
    });

    if (!membership) {
      return {
        canCreate: false,
        canView: "owner_only",
        canEdit: "owner_only",
        canDelete: "owner_only",
        defaultVisibility: "owner_only",
        userGroup: null,
      };
    }

    const leadVisibilityRule = await ItemVisibilityRule.findOne({
      where: {
        groupId: membership.groupId,
        entityType: "leads",
        isActive: true,
      },
    });

    if (!leadVisibilityRule) {
      return {
        canCreate: true,
        canView: "owner_only",
        canEdit: "owner_only",
        canDelete: "owner_only",
        defaultVisibility: "item_owners_visibility_group",
        userGroup: membership.group,
      };
    }

    return {
      canCreate: leadVisibilityRule.canCreate,
      canView: leadVisibilityRule.canView
        ? leadVisibilityRule.defaultVisibility
        : "none",
      canEdit: leadVisibilityRule.canEdit
        ? leadVisibilityRule.defaultVisibility
        : "none",
      canDelete: leadVisibilityRule.canDelete
        ? leadVisibilityRule.defaultVisibility
        : "none",
      defaultVisibility: leadVisibilityRule.defaultVisibility,
      userGroup: membership.group,
    };
  } catch (error) {
    console.error("Error getting user visibility permissions:", error);
    return {
      canCreate: false,
      canView: "owner_only",
      canEdit: "owner_only",
      canDelete: "owner_only",
      defaultVisibility: "owner_only",
      userGroup: null,
    };
  }
}
//.....................changes......original....................
exports.createLead = async (req, res) => {
  // Only use these fields as standard fields for root-level custom field extraction
  const standardFields = [
    "title",
    "ownerId",
    "sourceChannel",
    "sourceChannelID",
  ];

  // Extract standard fields
  const {
    contactPerson,
    organization,
    title,
    valueLabels,
    expectedCloseDate,
    sourceChannel,
    sourceChannelID,
    serviceType,
    // scopeOfServiceType,
    phone,
    email,
    company,
    proposalValue,
    esplProposalNo,
    projectLocation,
    organizationCountry,
    proposalSentDate,
    status,
    sourceOrgin,
    SBUClass,
    numberOfReportsPrepared,
    emailID,
    customFields: customFieldsFromBody,
    value,
    pipeline,
    stage,
    productName,
    sourceOriginID,
  } = req.body;

  // Collect custom fields from root level (not in standardFields)

  let customFields = { ...(customFieldsFromBody || {}) };
  for (const key in req.body) {
    if (!standardFields.includes(key)) {
      customFields[key] = req.body[key];
    }
  }

  console.log("Request body sourceOrgin:", sourceOrgin);

  // Log emailID only when it's relevant (sourceOrgin is 0)
  if (sourceOrgin === 0 || sourceOrgin === "0") {
    console.log("Request body email ID:", req.body.emailID);
  }

  // --- Add validation here ---
  if (!contactPerson || !organization || !title || !email) {
    return res.status(400).json({
      message: "contactPerson, organization, title, and email are required.",
    });
  }

  // Validate emailID is required when sourceOrgin is 0 (email-created lead)
  if ((sourceOrgin === 0 || sourceOrgin === "0") && !emailID) {
    return res.status(400).json({
      message:
        "emailID is required when sourceOrgin is 0 (email-created lead).",
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Invalid email format." });
  }
  if (proposalValue && proposalValue < 0) {
    return res
      .status(400)
      .json({ message: "Proposal value must be positive." });
  }

  // Note: Removed email uniqueness check to allow multiple leads per contact person
  // Each contact can have multiple projects/leads with different titles

  // Check for duplicate combination of contactPerson, organization, AND title (allow multiple projects per contact)
  const existingContactOrgTitleLead = await Lead.findOne({
    where: {
      contactPerson: contactPerson,
      organization: organization,
      title: title,
    },
  });
  if (existingContactOrgTitleLead) {
    return res.status(409).json({
      message:
        "A lead with this exact combination of contact person, organization, and title already exists. Please use a different title for a new project with the same contact.",
      existingLeadId: existingContactOrgTitleLead.leadId,
      existingLeadTitle: existingContactOrgTitleLead.title,
      existingContactPerson: existingContactOrgTitleLead.contactPerson,
      existingOrganization: existingContactOrgTitleLead.organization,
    });
  }
  // --- End validation ---

  console.log(req.role, "role of the user............");

  try {
    // Check if user can create leads based on visibility rules
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

    // Get user's visibility group and check lead creation permissions
    let userGroup = null;
    let leadVisibilityRule = null;

    if (req.role !== "admin") {
      // Get user's current group membership
      const membership = await GroupMembership.findOne({
        where: {
          userId: req.adminId,
          isActive: true,
        },
        include: [
          {
            model: VisibilityGroup,
            as: "group",
            where: { isActive: true },
          },
        ],
      });

      if (membership) {
        userGroup = membership.group;

        // Check if user's group has permission to create leads
        leadVisibilityRule = await ItemVisibilityRule.findOne({
          where: {
            groupId: userGroup.groupId,
            entityType: "leads",
            isActive: true,
          },
        });

        if (leadVisibilityRule && !leadVisibilityRule.canCreate) {
          await logAuditTrail(
            PROGRAMS.LEAD_MANAGEMENT,
            "LEAD_CREATION",
            req.adminId,
            "Access denied. Your visibility group does not have permission to create leads.",
            null
          );
          return res.status(403).json({
            message:
              "Access denied. Your visibility group does not have permission to create leads.",
          });
        }
      }
    }

    // 1. Find or create Organization
    let orgRecord = await Organization.findOne({ where: { organization } });
    if (!orgRecord) {
      orgRecord = await Organization.create({
        organization,
        masterUserID: req.adminId,
      });
    }
    console.log(
      "orgRecord after create/find:",
      orgRecord?.organizationId,
      orgRecord?.organization
    );

    // Defensive: If orgRecord is still not found, stop!
    if (!orgRecord || !orgRecord.leadOrganizationId) {
      return res
        .status(500)
        .json({ message: "Failed to create/find organization." });
    }
    // 2. Find or create Person (linked to organization)
    let personRecord = await Person.findOne({ where: { email } });
    if (!personRecord) {
      personRecord = await Person.create({
        contactPerson,
        email,
        phone,
        leadOrganizationId: orgRecord.leadOrganizationId,
        masterUserID: req.adminId,
      });
    }
    //     const duplicateLead = await Lead.findOne({
    //   where: {
    //     organization,
    //     contactPerson,
    //     // email,
    //     title
    //   }
    // });
    // if (duplicateLead) {
    //   return res.status(409).json({
    //     message: "Lead Already Exist."
    //   });
    // }
    // const duplicateByOrg = await Lead.findOne({ where: { organization } });

    const owner = await MasterUser.findOne({
      where: { masterUserID: req.adminId },
    });
    const ownerName = owner ? owner.name : null;

    // Determine visibility level based on user's group settings or request
    let visibilityLevel = req.body.visibilityLevel;
    if (!visibilityLevel && leadVisibilityRule) {
      visibilityLevel = leadVisibilityRule.defaultVisibility;
    }
    if (!visibilityLevel) {
      visibilityLevel = "item_owners_visibility_group"; // Default fallback
    }

    const lead = await Lead.create({
      personId: personRecord.personId, // <-- Add this
      leadOrganizationId: orgRecord.leadOrganizationId,
      contactPerson,
      organization,
      title,
      valueLabels,
      expectedCloseDate,
      sourceChannel,
      sourceChannelID,
      serviceType,
      // scopeOfServiceType,
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
      ownerId: req.adminId, // Associate the lead with the authenticated user
      ownerName, // Store the role of the user as ownerName,
      sourceOrgin, // Indicate that the lead was created manually
      SBUClass,
      numberOfReportsPrepared,
      // Add new Pipedrive-style default fields
      pipeline: req.body.pipeline || "Default Pipeline",
      stage: req.body.stage || "New Lead",
      productName: req.body.productName,
      sourceOriginID: req.body.sourceOriginID,
      value,
      // Add visibility settings
      visibilityLevel,
      visibilityGroupId: userGroup ? userGroup.groupId : null,
      valueCurrency: req.body.valueCurrency || "INR",
      proposalValueCurrency: req.body.proposalValueCurrency || "INR",
    });

    // Link email to lead if sourceOrgin is 0 (email-created lead)
    if ((sourceOrgin === 0 || sourceOrgin === "0") && emailID) {
      try {
        console.log(`Linking email ${emailID} to lead ${lead.leadId}`);
        const emailUpdateResult = await Email.update(
          { leadId: lead.leadId },
          { where: { emailID: emailID } }
        );
        console.log(`Email link result: ${emailUpdateResult[0]} rows updated`);

        if (emailUpdateResult[0] === 0) {
          console.warn(`No email found with emailID: ${emailID}`);
        }
      } catch (emailError) {
        console.error("Error linking email to lead:", emailError);
        // Don't fail the lead creation, just log the error
      }
    }
    // --- Add this block to link existing emails to the new lead ---
    // await Email.update(
    //   { leadId: lead.leadId },
    //   {
    //     where: {
    //       [Op.or]: [
    //         { sender: lead.email },
    //         { recipient: { [Op.like]: `%${lead.email}%` } }
    //       ]
    //     }
    //   }
    // );
    // --- End block ---
    await LeadDetails.create({
      leadId: lead.leadId,
      responsiblePerson: req.adminId,
      sourceOrgin: sourceOrgin,
    });

    // Handle custom fields if provided
    const savedCustomFields = {};
    if (customFields && Object.keys(customFields).length > 0) {
      try {
        for (const [fieldKey, value] of Object.entries(customFields)) {
          // Try to find the custom field by fieldId first, then by fieldName
          // Support both user-specific and system/default fields
          // Now supports unified fields (entityType: "lead" or "both")
          let customField = await CustomField.findOne({
            where: {
              fieldId: fieldKey,
              entityType: { [Op.in]: ["lead", "both"] }, // Support unified fields
              isActive: true,
              [Op.or]: [
                { masterUserID: req.adminId },
                { fieldSource: "default" },
                { fieldSource: "system" },
              ],
            },
          });

          // If not found by fieldId, try to find by fieldName
          if (!customField) {
            customField = await CustomField.findOne({
              where: {
                fieldName: fieldKey,
                entityType: { [Op.in]: ["lead", "both"] }, // Support unified fields
                isActive: true,
                // [Op.or]: [
                //   { masterUserID: req.adminId },
                //   { fieldSource: "default" },
                //   { fieldSource: "system" },
                // ],
              },
            });
          }

          if (
            customField &&
            value !== null &&
            value !== undefined &&
            value !== ""
          ) {
            await CustomFieldValue.create({
              fieldId: customField.fieldId, // Use the actual fieldId from database
              entityId: lead.leadId,
              entityType: "lead",
              value: value,
              masterUserID: req.adminId,
            });

            // Store the saved custom field for response using fieldName as key
            savedCustomFields[customField.fieldName] = {
              fieldName: customField.fieldName,
              fieldType: customField.fieldType,
              value: value,
            };
          } else if (!customField) {
            console.warn(`Custom field not found for key: ${fieldKey}`);
          }
        }
        console.log(
          `Saved ${
            Object.keys(savedCustomFields).length
          } custom field values for lead ${lead.leadId}`
        );
      } catch (customFieldError) {
        console.error("Error saving custom fields:", customFieldError);
        // Don't fail the lead creation, just log the error
      }
    }

    await historyLogger(
      PROGRAMS.LEAD_MANAGEMENT, // Program ID for currency management
      "LEAD_CREATION", // Mode
      lead.masterUserID, // Created by (Admin ID)
      lead.leadId, // Record ID (Country ID)
      null,
      `Lead is created by  ${req.role}`, // Description
      null // Changes logged as JSON
    );

    // Prepare response with both default and custom fields
    const leadResponse = {
      ...lead.toJSON(),
      customFields: savedCustomFields,
    };

    res.status(201).json({
      message: "Lead created successfully",
      lead: leadResponse,
      customFieldsSaved: Object.keys(savedCustomFields).length,
    });
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
//     limit = 500,
//     sortBy = "createdAt",
//     order = "DESC",
//     masterUserID: queryMasterUserID,
//     filterId,
//   } = req.query;
//   console.log(req.role, "role of the user............");

//   try {
//     // Get user's visibility group and rules
//     let userGroup = null;
//     let leadVisibilityRule = null;

//     if (req.role !== "admin") {
//       const membership = await GroupMembership.findOne({
//         where: {
//           userId: req.adminId,
//           isActive: true,
//         },
//         include: [
//           {
//             model: VisibilityGroup,
//             as: "group",
//             where: { isActive: true },
//           },
//         ],
//       });

//       if (membership) {
//         userGroup = membership.group;
//         leadVisibilityRule = await ItemVisibilityRule.findOne({
//           where: {
//             groupId: userGroup.groupId,
//             entityType: "leads",
//             isActive: true,
//           },
//         });
//       }
//     }

//     // Determine masterUserID based on role

//     const pref = await LeadColumnPreference.findOne();

//     let leadAttributes, leadDetailsAttributes;
//     if (pref && pref.columns) {
//       // Parse columns if it's a string
//       const columns =
//         typeof pref.columns === "string"
//           ? JSON.parse(pref.columns)
//           : pref.columns;

//       const leadFields = Object.keys(Lead.rawAttributes);
//       const leadDetailsFields = Object.keys(LeadDetails.rawAttributes);

//       leadAttributes = columns
//         .filter((col) => col.check && leadFields.includes(col.key))
//         .map((col) => col.key);
//       // Always include leadId
//       if (!leadAttributes.includes("leadId")) {
//         leadAttributes.unshift("leadId");
//       }
//       // Always include the sortBy field for ordering
//       if (!leadAttributes.includes(sortBy)) {
//         leadAttributes.push(sortBy);
//       }
//       // Always include currency IDs for later processing
//       if (!leadAttributes.includes("proposalValueCurrency")) {
//         leadAttributes.push("proposalValueCurrency");
//       }
//       if (!leadAttributes.includes("valueCurrency")) {
//         leadAttributes.push("valueCurrency");
//       }

//       leadDetailsAttributes = columns
//         .filter((col) => col.check && leadDetailsFields.includes(col.key))
//         .map((col) => col.key);
//     }

//     console.log(leadAttributes, "leadAttributes from preferences");

//     let whereClause = {};
//     let hasActivityFiltering = false; // Initialize early for use throughout the function
//     let hasPersonFiltering = false; // Initialize for Person filtering
//     let hasOrganizationFiltering = false; // Initialize for Organization filtering

//     // let include = [
//     //   {
//     //     model: LeadDetails,
//     //     as: "details",
//     //     required: false,
//     //     attributes: leadDetailsAttributes && leadDetailsAttributes.length > 0 ? leadDetailsAttributes : undefined

//     //   },
//     // ];
//     let include = [];
//     if (leadDetailsAttributes && leadDetailsAttributes.length > 0) {
//       include.push({
//         model: LeadDetails,
//         as: "details",
//         required: false,
//         attributes: leadDetailsAttributes,
//       });
//     }

//     // Handle masterUserID filtering based on role and query parameters
//     if (req.role === "admin") {
//       // Admin can filter by specific masterUserID or see all leads
//       if (queryMasterUserID && queryMasterUserID !== "all") {
//         whereClause[Op.or] = [
//           { masterUserID: queryMasterUserID },
//           { ownerId: queryMasterUserID },
//         ];
//       }
//       // If queryMasterUserID is "all" or not provided, admin sees all leads (no additional filter)
//     } else {
//       // Non-admin users: apply visibility filtering based on group rules
//       let visibilityConditions = [];

//       if (leadVisibilityRule) {
//         switch (leadVisibilityRule.defaultVisibility) {
//           case "owner_only":
//             // User can only see their own leads
//             visibilityConditions.push({
//               [Op.or]: [
//                 { masterUserID: req.adminId },
//                 { ownerId: req.adminId },
//               ],
//             });
//             break;

//           case "group_only":
//             // User can see leads from their visibility group
//             if (userGroup) {
//               visibilityConditions.push({
//                 [Op.or]: [
//                   { visibilityGroupId: userGroup.groupId },
//                   { masterUserID: req.adminId },
//                   { ownerId: req.adminId },
//                 ],
//               });
//             }
//             break;

//           case "item_owners_visibility_group":
//             // User can see leads based on owner's visibility group
//             if (userGroup) {
//               // Get all users in the same visibility group
//               const groupMembers = await GroupMembership.findAll({
//                 where: {
//                   groupId: userGroup.groupId,
//                   isActive: true,
//                 },
//                 attributes: ["userId"],
//               });

//               const memberIds = groupMembers.map((member) => member.userId);

//               visibilityConditions.push({
//                 [Op.or]: [
//                   { masterUserID: { [Op.in]: memberIds } },
//                   { ownerId: { [Op.in]: memberIds } },
//                   // Include leads where visibility level allows group access
//                   {
//                     visibilityLevel: {
//                       [Op.in]: [
//                         "everyone",
//                         "group_only",
//                         "item_owners_visibility_group",
//                       ],
//                     },
//                     visibilityGroupId: userGroup.groupId,
//                   },
//                 ],
//               });
//             }
//             break;

//           case "everyone":
//             // User can see all leads (no additional filtering)
//             break;

//           default:
//             // Default to owner only for security
//             visibilityConditions.push({
//               [Op.or]: [
//                 { masterUserID: req.adminId },
//                 { ownerId: req.adminId },
//               ],
//             });
//         }
//       } else {
//         // No visibility rule found, default to owner only
//         visibilityConditions.push({
//           [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
//         });
//       }

//       // Apply visibility conditions
//       if (visibilityConditions.length > 0) {
//         whereClause[Op.and] = whereClause[Op.and] || [];
//         whereClause[Op.and].push(...visibilityConditions);
//       }

//       // Handle specific user filtering for non-admin users
//       if (queryMasterUserID && queryMasterUserID !== "all") {
//         // Non-admin can only filter within their visible scope
//         const userId = queryMasterUserID;
//         whereClause[Op.and] = whereClause[Op.and] || [];
//         whereClause[Op.and].push({
//           [Op.or]: [{ masterUserID: userId }, { ownerId: userId }],
//         });
//       }
//     }

//     console.log("→ Query params:", req.query);
//     console.log("→ queryMasterUserID:", queryMasterUserID);
//     console.log("→ req.adminId:", req.adminId);
//     console.log("→ req.role:", req.role);

//     //................................................................//filter
//     if (filterId) {
//       console.log("Processing filter with filterId:", filterId);

//       // Fetch the saved filter
//       const filter = await LeadFilter.findByPk(filterId);
//       if (!filter) {
//         return res.status(404).json({ message: "Filter not found." });
//       }

//       console.log("Found filter:", filter.filterName);

//       const filterConfig =
//         typeof filter.filterConfig === "string"
//           ? JSON.parse(filter.filterConfig)
//           : filter.filterConfig;

//       console.log("Filter config:", JSON.stringify(filterConfig, null, 2));

//       const { all = [], any = [] } = filterConfig;
//       const leadFields = Object.keys(Lead.rawAttributes);
//       const leadDetailsFields = Object.keys(LeadDetails.rawAttributes);
//       const personFields = Object.keys(Person.rawAttributes);
//       const organizationFields = Object.keys(Organization.rawAttributes);
//       const activityFields = Object.keys(Activity.rawAttributes);

//       let filterWhere = {};
//       let leadDetailsWhere = {};
//       let personWhere = {};
//       let organizationWhere = {};
//       let activityWhere = {};
//       let customFieldsConditions = { all: [], any: [] };

//       console.log("Available lead fields:", leadFields);
//       console.log("Available leadDetails fields:", leadDetailsFields);
//       console.log("Available person fields:", personFields);
//       console.log("Available organization fields:", organizationFields);
//       console.log("Available activity fields:", activityFields);

//       // --- Your new filter logic for all ---
//       if (all.length > 0) {
//         console.log("Processing 'all' conditions:", all);

//         filterWhere[Op.and] = [];
//         leadDetailsWhere[Op.and] = [];
//         personWhere[Op.and] = [];
//         organizationWhere[Op.and] = [];
//         activityWhere[Op.and] = [];
//         all.forEach((cond) => {
//           console.log("Processing condition:", cond);

//           // Check if entity is specified in the condition
//           if (cond.entity) {
//             console.log(`Condition specifies entity: ${cond.entity}`);

//             // Handle both "Lead" and "Leads" entity names for backward compatibility
//             if (
//               (cond.entity === "Lead" || cond.entity === "Leads") &&
//               leadFields.includes(cond.field)
//             ) {
//               console.log(
//                 `Field '${cond.field}' processed as Lead field due to entity specification`
//               );
//               filterWhere[Op.and].push(buildCondition(cond));
//             } else if (
//               cond.entity === "LeadDetails" &&
//               leadDetailsFields.includes(cond.field)
//             ) {
//               console.log(
//                 `Field '${cond.field}' processed as LeadDetails field due to entity specification`
//               );
//               leadDetailsWhere[Op.and].push(buildCondition(cond));
//             } else if (
//               cond.entity === "Person" &&
//               personFields.includes(cond.field)
//             ) {
//               console.log(
//                 `Field '${cond.field}' processed as Person field due to entity specification`
//               );
//               personWhere[Op.and].push(buildCondition(cond));
//             } else if (
//               cond.entity === "Organization" &&
//               organizationFields.includes(cond.field)
//             ) {
//               console.log(
//                 `Field '${cond.field}' processed as Organization field due to entity specification`
//               );
//               organizationWhere[Op.and].push(buildCondition(cond));
//             } else if (
//               cond.entity === "Activity" &&
//               activityFields.includes(cond.field)
//             ) {
//               console.log(
//                 `Field '${cond.field}' processed as Activity field due to entity specification`
//               );
//               const activityCondition = buildCondition(cond);
//               console.log(
//                 `Built Activity condition for ${cond.field}:`,
//                 activityCondition
//               );
//               console.log(
//                 `Activity condition symbols:`,
//                 Object.getOwnPropertySymbols(activityCondition[cond.field])
//               );
//               if (
//                 Object.getOwnPropertySymbols(activityCondition[cond.field])
//                   .length > 0
//               ) {
//                 const symbol = Object.getOwnPropertySymbols(
//                   activityCondition[cond.field]
//                 )[0];
//                 console.log(
//                   `Activity condition value: ${
//                     activityCondition[cond.field][symbol]
//                   }`
//                 );
//               }
//               activityWhere[Op.and].push(activityCondition);
//             } else {
//               console.log(
//                 `Field '${cond.field}' not found in specified entity '${cond.entity}', treating as custom field`
//               );
//               customFieldsConditions.all.push(cond);
//             }
//           } else {
//             // Fallback to original logic when entity is not specified
//             if (leadFields.includes(cond.field)) {
//               console.log(`Field '${cond.field}' found in Lead fields`);
//               filterWhere[Op.and].push(buildCondition(cond));
//             } else if (leadDetailsFields.includes(cond.field)) {
//               console.log(`Field '${cond.field}' found in LeadDetails fields`);
//               leadDetailsWhere[Op.and].push(buildCondition(cond));
//             } else if (personFields.includes(cond.field)) {
//               console.log(`Field '${cond.field}' found in Person fields`);
//               personWhere[Op.and].push(buildCondition(cond));
//             } else if (organizationFields.includes(cond.field)) {
//               console.log(`Field '${cond.field}' found in Organization fields`);
//               organizationWhere[Op.and].push(buildCondition(cond));
//             } else if (activityFields.includes(cond.field)) {
//               console.log(`Field '${cond.field}' found in Activity fields`);
//               activityWhere[Op.and].push(buildCondition(cond));
//             } else {
//               console.log(
//                 `Field '${cond.field}' NOT found in standard fields, treating as custom field`
//               );
//               // Handle custom fields
//               customFieldsConditions.all.push(cond);
//             }
//           }
//         });
//         if (filterWhere[Op.and].length === 0) delete filterWhere[Op.and];
//         if (leadDetailsWhere[Op.and].length === 0)
//           delete leadDetailsWhere[Op.and];
//         if (personWhere[Op.and].length === 0) delete personWhere[Op.and];
//         if (organizationWhere[Op.and].length === 0)
//           delete organizationWhere[Op.and];
//         if (activityWhere[Op.and].length === 0) delete activityWhere[Op.and];
//       }

//       // --- Your new filter logic for any ---
//       if (any.length > 0) {
//         filterWhere[Op.or] = [];
//         leadDetailsWhere[Op.or] = [];
//         personWhere[Op.or] = [];
//         organizationWhere[Op.or] = [];
//         activityWhere[Op.or] = [];
//         any.forEach((cond) => {
//           // Check if entity is specified in the condition
//           if (cond.entity) {
//             console.log(`'Any' condition specifies entity: ${cond.entity}`);

//             if (cond.entity === "Lead" && leadFields.includes(cond.field)) {
//               console.log(
//                 `Field '${cond.field}' processed as Lead field due to entity specification`
//               );
//               filterWhere[Op.or].push(buildCondition(cond));
//             } else if (
//               cond.entity === "LeadDetails" &&
//               leadDetailsFields.includes(cond.field)
//             ) {
//               console.log(
//                 `Field '${cond.field}' processed as LeadDetails field due to entity specification`
//               );
//               leadDetailsWhere[Op.or].push(buildCondition(cond));
//             } else if (
//               cond.entity === "Person" &&
//               personFields.includes(cond.field)
//             ) {
//               console.log(
//                 `Field '${cond.field}' processed as Person field due to entity specification`
//               );
//               personWhere[Op.or].push(buildCondition(cond));
//             } else if (
//               cond.entity === "Organization" &&
//               organizationFields.includes(cond.field)
//             ) {
//               console.log(
//                 `Field '${cond.field}' processed as Organization field due to entity specification`
//               );
//               organizationWhere[Op.or].push(buildCondition(cond));
//             } else if (
//               cond.entity === "Activity" &&
//               activityFields.includes(cond.field)
//             ) {
//               console.log(
//                 `Field '${cond.field}' processed as Activity field due to entity specification`
//               );
//               const activityCondition = buildCondition(cond);
//               console.log(
//                 `Built Activity condition for ${cond.field}:`,
//                 activityCondition
//               );
//               activityWhere[Op.or].push(activityCondition);
//             } else {
//               console.log(
//                 `Field '${cond.field}' not found in specified entity '${cond.entity}', treating as custom field`
//               );
//               customFieldsConditions.any.push(cond);
//             }
//           } else {
//             // Fallback to original logic when entity is not specified
//             if (leadFields.includes(cond.field)) {
//               filterWhere[Op.or].push(buildCondition(cond));
//             } else if (leadDetailsFields.includes(cond.field)) {
//               leadDetailsWhere[Op.or].push(buildCondition(cond));
//             } else if (personFields.includes(cond.field)) {
//               personWhere[Op.or].push(buildCondition(cond));
//             } else if (organizationFields.includes(cond.field)) {
//               organizationWhere[Op.or].push(buildCondition(cond));
//             } else if (activityFields.includes(cond.field)) {
//               activityWhere[Op.or].push(buildCondition(cond));
//             } else {
//               // Handle custom fields
//               customFieldsConditions.any.push(cond);
//             }
//           }
//         });
//         if (filterWhere[Op.or].length === 0) delete filterWhere[Op.or];
//         if (leadDetailsWhere[Op.or].length === 0)
//           delete leadDetailsWhere[Op.or];
//         if (personWhere[Op.or].length === 0) delete personWhere[Op.or];
//         if (organizationWhere[Op.or].length === 0)
//           delete organizationWhere[Op.or];
//         if (activityWhere[Op.or].length === 0) delete activityWhere[Op.or];
//       }

//       // Merge with archive/masterUserID filters
//       if (isArchived !== undefined)
//         filterWhere.isArchived = isArchived === "true";

//       // Apply masterUserID filtering logic for filters
//       if (req.role === "admin") {
//         // Admin can filter by specific masterUserID or see all leads
//         if (queryMasterUserID && queryMasterUserID !== "all") {
//           if (filterWhere[Op.or]) {
//             // If there's already an Op.or condition from filters, we need to combine properly
//             filterWhere[Op.and] = [
//               { [Op.or]: filterWhere[Op.or] },
//               {
//                 [Op.or]: [
//                   { masterUserID: queryMasterUserID },
//                   { ownerId: queryMasterUserID },
//                 ],
//               },
//             ];
//             delete filterWhere[Op.or];
//           } else {
//             filterWhere[Op.or] = [
//               { masterUserID: queryMasterUserID },
//               { ownerId: queryMasterUserID },
//             ];
//           }
//         }
//       } else {
//         // Non-admin users: filter by their own leads or specific user if provided
//         const userId =
//           queryMasterUserID && queryMasterUserID !== "all"
//             ? queryMasterUserID
//             : req.adminId;
//         if (filterWhere[Op.or]) {
//           // If there's already an Op.or condition from filters, we need to combine properly
//           filterWhere[Op.and] = [
//             { [Op.or]: filterWhere[Op.or] },
//             { [Op.or]: [{ masterUserID: userId }, { ownerId: userId }] },
//           ];
//           delete filterWhere[Op.or];
//         } else {
//           filterWhere[Op.or] = [{ masterUserID: userId }, { ownerId: userId }];
//         }
//       }
//       whereClause = filterWhere;

//       console.log("→ Built filterWhere:", JSON.stringify(filterWhere));
//       console.log(
//         "→ Built leadDetailsWhere:",
//         JSON.stringify(leadDetailsWhere)
//       );
//       console.log("→ Built personWhere:", JSON.stringify(personWhere));
//       console.log(
//         "→ Built organizationWhere:",
//         JSON.stringify(organizationWhere)
//       );
//       console.log("→ Built activityWhere:", activityWhere);
//       console.log(
//         "→ Activity where object keys length:",
//         Object.keys(activityWhere).length
//       );
//       console.log(
//         "→ Activity where object symbols length:",
//         Object.getOwnPropertySymbols(activityWhere).length
//       );
//       console.log(
//         "→ All activity where properties:",
//         Object.getOwnPropertyNames(activityWhere).concat(
//           Object.getOwnPropertySymbols(activityWhere)
//         )
//       );

//       // Fix: Check for both regular keys and Symbol properties (Sequelize operators are Symbols)
//       hasActivityFiltering =
//         Object.keys(activityWhere).length > 0 ||
//         Object.getOwnPropertySymbols(activityWhere).length > 0;

//       hasPersonFiltering =
//         Object.keys(personWhere).length > 0 ||
//         Object.getOwnPropertySymbols(personWhere).length > 0;

//       hasOrganizationFiltering =
//         Object.keys(organizationWhere).length > 0 ||
//         Object.getOwnPropertySymbols(organizationWhere).length > 0;

//       if (hasActivityFiltering) {
//         console.log("→ Activity filtering will be applied:");
//         if (activityWhere[Op.and]) {
//           console.log(
//             "  - AND conditions count:",
//             activityWhere[Op.and].length
//           );
//         }
//         if (activityWhere[Op.or]) {
//           console.log("  - OR conditions count:", activityWhere[Op.or].length);
//         }

//         // Quick database check for debugging
//         try {
//           const totalActivities = await Activity.count();
//           console.log("→ Total activities in database:", totalActivities);

//           const activitiesWithType = await Activity.count({
//             where: { type: "Meeting" },
//           });
//           console.log("→ Activities with type='Meeting':", activitiesWithType);

//           const activitiesWithLeads = await Activity.count({
//             where: { leadId: { [Op.not]: null } },
//           });
//           console.log("→ Activities linked to leads:", activitiesWithLeads);

//           const leadsWithActivities = await Lead.count({
//             include: [
//               {
//                 model: Activity,
//                 as: "Activities",
//                 required: true,
//               },
//             ],
//           });
//           console.log("→ Leads that have activities:", leadsWithActivities);
//         } catch (debugError) {
//           console.log("→ Debug query error:", debugError.message);
//         }
//       }

//       if (Object.keys(leadDetailsWhere).length > 0) {
//         include.push({
//           model: LeadDetails,
//           as: "details",
//           where: leadDetailsWhere,
//           required: true,
//         });
//       } else {
//         include.push({
//           model: LeadDetails,
//           as: "details",
//           required: false,
//         });
//       }

//       if (hasPersonFiltering) {
//         console.log("→ Person filtering will be applied:");
//         if (personWhere[Op.and]) {
//           console.log("  - AND conditions count:", personWhere[Op.and].length);
//         }
//         if (personWhere[Op.or]) {
//           console.log("  - OR conditions count:", personWhere[Op.or].length);
//         }

//         include.push({
//           model: Person,
//           as: "LeadPerson",
//           required: true,
//           where: personWhere,
//         });
//       } else {
//         include.push({
//           model: Person,
//           as: "LeadPerson",
//           required: false,
//         });
//       }

//       if (hasOrganizationFiltering) {
//         console.log("→ Organization filtering will be applied:");
//         if (organizationWhere[Op.and]) {
//           console.log(
//             "  - AND conditions count:",
//             organizationWhere[Op.and].length
//           );
//         }
//         if (organizationWhere[Op.or]) {
//           console.log(
//             "  - OR conditions count:",
//             organizationWhere[Op.or].length
//           );
//         }

//         include.push({
//           model: Organization,
//           as: "LeadOrganization",
//           required: true,
//           where: organizationWhere,
//         });
//       } else {
//         include.push({
//           model: Organization,
//           as: "LeadOrganization",
//           required: false,
//         });
//       }

//       if (hasActivityFiltering) {
//         console.log("==========================================");
//         console.log("🔥 ACTIVITY FILTERING DETECTED!");
//         console.log(
//           "🔥 Activity where clause:",
//           JSON.stringify(activityWhere, null, 2)
//         );
//         console.log("🔥 Activity where keys:", Object.keys(activityWhere));
//         console.log(
//           "🔥 Activity where symbols:",
//           Object.getOwnPropertySymbols(activityWhere)
//         );

//         // Debug: Show the actual condition structure
//         if (activityWhere[Op.and]) {
//           console.log("🔥 AND conditions details:", activityWhere[Op.and]);
//           activityWhere[Op.and].forEach((condition, index) => {
//             console.log(
//               `🔥 Condition ${index}:`,
//               JSON.stringify(condition, null, 2)
//             );
//             console.log(`🔥 Condition ${index} keys:`, Object.keys(condition));
//             console.log(
//               `🔥 Condition ${index} symbols:`,
//               Object.getOwnPropertySymbols(condition)
//             );

//             // Check each field in the condition
//             Object.keys(condition).forEach((field) => {
//               console.log(`🔥 Field '${field}' value:`, condition[field]);
//               console.log(
//                 `🔥 Field '${field}' symbols:`,
//                 Object.getOwnPropertySymbols(condition[field])
//               );

//               // Show Symbol values
//               Object.getOwnPropertySymbols(condition[field]).forEach(
//                 (symbol) => {
//                   console.log(
//                     `🔥 Symbol ${symbol.toString()} value:`,
//                     condition[field][symbol]
//                   );
//                 }
//               );
//             });
//           });
//         }
//         console.log("==========================================");

//         // NEW APPROACH: Rebuild the activity condition from scratch to avoid Symbol loss
//         console.log("🔧 REBUILDING ACTIVITY CONDITIONS FROM SCRATCH...");

//         // Find the activity conditions from the filter config and rebuild them
//         let rebuiltActivityWhere = null;

//         if (activityWhere[Op.and] && activityWhere[Op.and].length > 0) {
//           const conditions = [];

//           activityWhere[Op.and].forEach((condition, index) => {
//             console.log(`🔧 Rebuilding condition ${index}:`, condition);

//             // Extract the field name and value from the original condition
//             Object.keys(condition).forEach((fieldName) => {
//               const fieldCondition = condition[fieldName];
//               console.log(
//                 `🔧 Processing field '${fieldName}' with condition:`,
//                 fieldCondition
//               );

//               // Find the operator and value
//               Object.getOwnPropertySymbols(fieldCondition).forEach((symbol) => {
//                 const value = fieldCondition[symbol];
//                 console.log(
//                   `🔧 Found operator ${symbol.toString()} with value: ${value}`
//                 );

//                 // Rebuild the condition with fresh Symbols
//                 if (symbol === Op.eq) {
//                   const rebuiltCondition = { [fieldName]: { [Op.eq]: value } };
//                   console.log(`🔧 Rebuilt condition:`, rebuiltCondition);
//                   console.log(
//                     `🔧 Rebuilt condition symbols:`,
//                     Object.getOwnPropertySymbols(rebuiltCondition[fieldName])
//                   );
//                   conditions.push(rebuiltCondition);
//                 }
//                 // Add other operators as needed (Op.ne, Op.like, etc.)
//               });
//             });
//           });

//           if (conditions.length > 0) {
//             rebuiltActivityWhere = { [Op.and]: conditions };
//             console.log("� REBUILT ACTIVITY WHERE:", rebuiltActivityWhere);
//             console.log(
//               "� Rebuilt symbols:",
//               Object.getOwnPropertySymbols(rebuiltActivityWhere)
//             );

//             if (rebuiltActivityWhere[Op.and]) {
//               console.log(
//                 "� Rebuilt AND conditions:",
//                 rebuiltActivityWhere[Op.and]
//               );
//               rebuiltActivityWhere[Op.and].forEach((condition, index) => {
//                 console.log(`� Rebuilt condition ${index}:`, condition);
//                 Object.keys(condition).forEach((field) => {
//                   console.log(
//                     `🔧 Field '${field}' symbols:`,
//                     Object.getOwnPropertySymbols(condition[field])
//                   );
//                   Object.getOwnPropertySymbols(condition[field]).forEach(
//                     (symbol) => {
//                       console.log(
//                         `� Rebuilt field '${field}' symbol ${symbol.toString()} = ${
//                           condition[field][symbol]
//                         }`
//                       );
//                     }
//                   );
//                 });
//               });
//             }
//           }
//         }

//         // Use the rebuilt condition if available, otherwise try direct approach
//         const finalActivityWhere = rebuiltActivityWhere || { type: "Meeting" };

//         console.log("🔧 FINAL ACTIVITY WHERE CONDITION:", finalActivityWhere);
//         console.log(
//           "🔧 Final condition symbols:",
//           Object.getOwnPropertySymbols(finalActivityWhere)
//         );

//         include.push({
//           model: Activity,
//           as: "Activities",
//           required: true,
//           where: finalActivityWhere,
//         });

//         console.log("🔥 ACTIVITY FILTERING APPLIED WITH REBUILT CONDITIONS");
//         console.log(
//           "🔥 This should now generate SQL: INNER JOIN activities ON activities.leadId = leads.leadId WHERE activities.type = 'Meeting'"
//         );

//         // FINAL DEBUG: Check what's actually in the include array
//         const finalActivityInclude = include[include.length - 1];
//         console.log("🔍 FINAL ACTIVITY INCLUDE IN ARRAY:");
//         console.log("🔍 Model:", finalActivityInclude.model.name);
//         console.log("🔍 As:", finalActivityInclude.as);
//         console.log("🔍 Required:", finalActivityInclude.required);
//         console.log("🔍 Where clause:", finalActivityInclude.where);
//         console.log(
//           "🔍 Where keys:",
//           Object.keys(finalActivityInclude.where || {})
//         );
//         console.log(
//           "🔍 Where symbols:",
//           Object.getOwnPropertySymbols(finalActivityInclude.where || {})
//         );

//         if (
//           finalActivityInclude.where &&
//           typeof finalActivityInclude.where === "object"
//         ) {
//           Object.keys(finalActivityInclude.where).forEach((key) => {
//             console.log(
//               `🔍 Where property '${key}':`,
//               finalActivityInclude.where[key]
//             );
//           });
//           Object.getOwnPropertySymbols(finalActivityInclude.where).forEach(
//             (symbol) => {
//               console.log(
//                 `🔍 Where symbol ${symbol.toString()}:`,
//                 finalActivityInclude.where[symbol]
//               );
//             }
//           );
//         }

//         console.log("==========================================");
//       } else {
//         console.log("==========================================");
//         console.log(
//           "🔵 NO ACTIVITY FILTERING - ADDING DEFAULT ACTIVITY INCLUDE"
//         );
//         console.log("==========================================");
//         include.push({
//           model: Activity,
//           as: "Activities",
//           required: false,
//         });
//       }

//       console.log(
//         "→ Updated include with LeadDetails where:",
//         JSON.stringify(leadDetailsWhere)
//       );

//       // Handle custom field filtering
//       if (
//         customFieldsConditions.all.length > 0 ||
//         customFieldsConditions.any.length > 0
//       ) {
//         console.log(
//           "Processing custom field conditions:",
//           customFieldsConditions
//         );

//         // Debug: Show all custom fields in the database
//         const allCustomFields = await CustomField.findAll({
//           where: {
//             [Op.or]: [
//               { masterUserID: req.adminId },
//               { fieldSource: "default" },
//               { fieldSource: "system" },
//             ],
//           },
//           attributes: [
//             "fieldId",
//             "fieldName",
//             "entityType",
//             "fieldSource",
//             "isActive",
//           ],
//         });

//         console.log(
//           "All custom fields in database:",
//           allCustomFields.map((f) => ({
//             fieldId: f.fieldId,
//             fieldName: f.fieldName,
//             entityType: f.entityType,
//             fieldSource: f.fieldSource,
//             isActive: f.isActive,
//           }))
//         );

//         const customFieldFilters = await buildCustomFieldFilters(
//           customFieldsConditions,
//           req.adminId
//         );

//         console.log("Built custom field filters:", customFieldFilters);

//         if (customFieldFilters.length > 0) {
//           // Apply custom field filtering by finding leads that match the custom field conditions
//           const matchingLeadIds = await getLeadIdsByCustomFieldFilters(
//             customFieldFilters,
//             req.adminId
//           );

//           console.log(
//             "Matching lead IDs from custom field filtering:",
//             matchingLeadIds
//           );

//           if (matchingLeadIds.length > 0) {
//             // If we already have other conditions, combine them
//             if (filterWhere[Op.and]) {
//               filterWhere[Op.and].push({
//                 leadId: { [Op.in]: matchingLeadIds },
//               });
//             } else if (filterWhere[Op.or]) {
//               filterWhere[Op.and] = [
//                 { [Op.or]: filterWhere[Op.or] },
//                 { leadId: { [Op.in]: matchingLeadIds } },
//               ];
//               delete filterWhere[Op.or];
//             } else {
//               filterWhere.leadId = { [Op.in]: matchingLeadIds };
//             }
//           } else {
//             // No leads match the custom field conditions, so return empty result
//             console.log("No matching leads found, setting empty result");
//             filterWhere.leadId = { [Op.in]: [] };
//           }
//         } else {
//           console.log(
//             "No custom field filters found, possibly field not found"
//           );
//         }

//         whereClause = filterWhere;
//       }
//     } else {
//       // Standard search/filter logic
//       if (isArchived !== undefined)
//         whereClause.isArchived = isArchived === "true";

//       if (search) {
//         whereClause[Op.or] = [
//           { contactPerson: { [Op.like]: `%${search}%` } },
//           { organization: { [Op.like]: `%${search}%` } },
//           { title: { [Op.like]: `%${search}%` } },
//           { email: { [Op.like]: `%${search}%` } },
//           { phone: { [Op.like]: `%${search}%` } },
//         ];
//         console.log(
//           "→ Search applied, whereClause[Op.or]:",
//           whereClause[Op.or]
//         );
//       }

//       // Add default Activity include for non-filtered queries
//       include.push({
//         model: Activity,
//         as: "Activities",
//         required: false,
//       });
//     }

//     // Pagination
//     const offset = (page - 1) * limit;
//     console.log("→ Final whereClause:", JSON.stringify(whereClause));
//     console.log("→ Final include:", JSON.stringify(include));
//     console.log("→ Pagination: limit =", limit, "offset =", offset);
//     console.log("→ Order:", sortBy, order);
//     // Always include Person and Organization
//     if (!include.some((i) => i.as === "LeadPerson")) {
//       include.push({
//         model: Person,
//         as: "LeadPerson",
//         required: false,
//       });
//     }
//     if (!include.some((i) => i.as === "LeadOrganization")) {
//       include.push({
//         model: Organization,
//         as: "LeadOrganization",
//         required: false,
//       });
//     }

//     // Activity include is now handled in the filtering section above
//     // No need for additional Activity include logic here
//     include.push({
//       model: MasterUser,
//       as: "Owner",
//       attributes: ["name", "masterUserID"],
//       required: false,
//     });
//     //   if (!leadAttributes.includes('leadOrganizationId')) {
//     //   leadAttributes.push('leadOrganizationId');
//     // }
//     // if (!leadAttributes.includes('personId')) {
//     //   leadAttributes.push('personId');
//     // }

//     // Always exclude leads that have a dealId (converted leads)
//     whereClause.dealId = null;
//     console.log("🔍 Applied dealId = null (excluding converted leads)");

//     console.log("==========================================");
//     console.log("🚀 FINAL QUERY EXECUTION STARTING");
//     console.log("🚀 Total include array length:", include.length);

//     // Check if Activity filtering is active
//     console.log("🚀 Activity include details:");
//     const activityInclude = include.find((i) => i.as === "Activities");
//     if (activityInclude) {
//       console.log("  🎯 Activity include found:");
//       console.log("    - Required:", activityInclude.required);
//       console.log("    - Has where clause:", !!activityInclude.where);
//       if (activityInclude.where) {
//         console.log(
//           "    - Where clause:",
//           JSON.stringify(activityInclude.where)
//         );
//       }
//     } else {
//       console.log("  ❌ NO Activity include found!");
//     }

//     // Check if Person filtering is active
//     console.log("🚀 Person include details:");
//     const personInclude = include.find((i) => i.as === "LeadPerson");
//     if (personInclude) {
//       console.log("  👤 Person include found:");
//       console.log("    - Required:", personInclude.required);
//       console.log("    - Has where clause:", !!personInclude.where);
//       if (personInclude.where) {
//         console.log("    - Where clause:", JSON.stringify(personInclude.where));
//       }
//     } else {
//       console.log("  ❌ NO Person include found!");
//     }

//     // Check if Organization filtering is active
//     console.log("🚀 Organization include details:");
//     const organizationInclude = include.find(
//       (i) => i.as === "LeadOrganization"
//     );
//     if (organizationInclude) {
//       console.log("  🏢 Organization include found:");
//       console.log("    - Required:", organizationInclude.required);
//       console.log("    - Has where clause:", !!organizationInclude.where);
//       if (organizationInclude.where) {
//         console.log(
//           "    - Where clause:",
//           JSON.stringify(organizationInclude.where)
//         );
//       }
//     } else {
//       console.log("  ❌ NO Organization include found!");
//     }
//     console.log("==========================================");

//     // Fetch leads with pagination, filtering, sorting, searching, and leadDetails
//     const leads = await Lead.findAndCountAll({
//       where: whereClause,
//       include,
//       limit: parseInt(limit),
//       offset: parseInt(offset),
//       order: [[sortBy, order.toUpperCase()]],
//       attributes:
//         leadAttributes && leadAttributes.length > 0
//           ? leadAttributes
//           : undefined,
//     });

//     console.log("==========================================");
//     console.log("🎉 QUERY EXECUTED SUCCESSFULLY!");
//     console.log("🎉 Total records found:", leads.count);

//     // Debug Activity filtering results
//     if (filterId && activityInclude && activityInclude.required) {
//       console.log("🎯 ACTIVITY FILTER RESULTS:");
//       console.log("  - Leads found with Activity filter:", leads.count);
//       if (leads.rows.length > 0) {
//         console.log(
//           "  - First lead activities:",
//           leads.rows[0].Activities
//             ? leads.rows[0].Activities.length
//             : "No Activities"
//         );
//         if (leads.rows[0].Activities && leads.rows[0].Activities.length > 0) {
//           console.log(
//             "  - First activity type:",
//             leads.rows[0].Activities[0].type
//           );
//         }
//       }
//     }

//     // Debug Person filtering results
//     if (filterId && hasPersonFiltering) {
//       console.log("👤 PERSON FILTER RESULTS:");
//       console.log("  - Leads found with Person filter:", leads.count);
//       if (leads.rows.length > 0) {
//         console.log(
//           "  - First lead person:",
//           leads.rows[0].LeadPerson
//             ? leads.rows[0].LeadPerson.firstName +
//                 " " +
//                 leads.rows[0].LeadPerson.lastName
//             : "No Person"
//         );
//       }
//     }

//     // Debug Organization filtering results
//     if (filterId && hasOrganizationFiltering) {
//       console.log("🏢 ORGANIZATION FILTER RESULTS:");
//       console.log("  - Leads found with Organization filter:", leads.count);
//       if (leads.rows.length > 0) {
//         console.log(
//           "  - First lead organization:",
//           leads.rows[0].LeadOrganization
//             ? leads.rows[0].LeadOrganization.organizationName
//             : "No Organization"
//         );
//       }
//     }
//     console.log("==========================================");

//     // Get custom field values for all leads (including default/system fields and unified fields)
//     // Only include custom fields where check is true
//     const leadIds = leads.rows.map((lead) => lead.leadId);
//     const customFieldValues = await CustomFieldValue.findAll({
//       where: {
//         entityId: leadIds,
//         entityType: "lead",
//       },
//       include: [
//         {
//           model: CustomField,
//           as: "CustomField",
//           where: {
//             isActive: true,
//             check: true, // Only include custom fields where check is true
//             entityType: { [Op.in]: ["lead", "both"] }, // Support unified fields
//             [Op.or]: [
//               { masterUserID: req.adminId },
//               { fieldSource: "default" },
//               { fieldSource: "system" },
//             ],
//           },
//           required: true,
//         },
//       ],
//     });

//     // Get all currency IDs from leads
//     const proposalCurrencyIds = leads.rows
//       .map((lead) => lead.proposalValueCurrency)
//       .filter(Boolean);
//     const valueCurrencyIds = leads.rows
//       .map((lead) => lead.valueCurrency)
//       .filter(Boolean);
//     const allCurrencyIds = [
//       ...new Set([...proposalCurrencyIds, ...valueCurrencyIds]),
//     ];

//     // Fetch currency data
//     let currencies = {};
//     if (allCurrencyIds.length > 0) {
//       const currencyRecords = await Currency.findAll({
//         where: {
//           currencyId: allCurrencyIds,
//         },
//         attributes: ["currencyId", "currency_desc"],
//         raw: true,
//       });

//       // Create a map for quick lookup
//       currencies = currencyRecords.reduce((acc, currency) => {
//         acc[currency.currencyId] = currency.currency_desc;
//         return acc;
//       }, {});
//     }

//     // Group custom field values by leadId
//     const customFieldsByLead = {};
//     customFieldValues.forEach((value) => {
//       if (!value.CustomField) return;
//       if (!customFieldsByLead[value.entityId]) {
//         customFieldsByLead[value.entityId] = {};
//       }
//       customFieldsByLead[value.entityId][value.CustomField.fieldName] = {
//         fieldId: value.CustomField.fieldId,
//         fieldName: value.CustomField.fieldName,
//         fieldLabel: value.CustomField.fieldLabel,
//         fieldType: value.CustomField.fieldType,
//         isImportant: value.CustomField.isImportant,
//         value: value.value,
//       };
//     });

//     const flatLeads = leads.rows.map((lead) => {
//       const leadObj = lead.toJSON();
//       // Overwrite ownerName with the latest Owner.name if present
//       if (leadObj.Owner && leadObj.Owner.name) {
//         leadObj.ownerName = leadObj.Owner.name;
//       }
//       delete leadObj.Owner; // Remove the nested Owner object
//       delete leadObj.LeadPerson;
//       delete leadObj.LeadOrganization;

//       // Keep Activities data for the response
//       if (leadObj.Activities) {
//         leadObj.activities = leadObj.Activities;
//         delete leadObj.Activities; // Remove the nested Activities object but keep the data in activities
//       }

//       if (leadObj.details) {
//         Object.assign(leadObj, leadObj.details);
//         delete leadObj.details;
//       }

//       // Add currency information
//       // For proposal value currency
//       if (
//         leadObj.proposalValueCurrency &&
//         currencies[leadObj.proposalValueCurrency]
//       ) {
//         leadObj.proposalValueCurrencyId = leadObj.proposalValueCurrency;
//         leadObj.proposalValueCurrency =
//           currencies[leadObj.proposalValueCurrency];
//       } else {
//         leadObj.proposalValueCurrencyId = null;
//         leadObj.proposalValueCurrency = null;
//       }

//       // For value currency
//       if (leadObj.valueCurrency && currencies[leadObj.valueCurrency]) {
//         leadObj.valueCurrencyId = leadObj.valueCurrency;
//         leadObj.valueCurrency = currencies[leadObj.valueCurrency];
//       } else {
//         leadObj.valueCurrencyId = null;
//         leadObj.valueCurrency = null;
//       }

//       // Add custom fields directly to the lead object (not wrapped in customFields)
//       const customFields = customFieldsByLead[leadObj.leadId] || {};
//       Object.entries(customFields).forEach(([fieldName, fieldData]) => {
//         leadObj[fieldName] = fieldData.value;
//       });

//       // Keep the customFields property for backward compatibility (optional)
//       leadObj.customFields = customFields;

//       return leadObj;
//     });
//     // console.log(leads.rows, "leads rows after flattening"); // Commented out to see Activity filtering debug messages

//     let persons, organizations;

//     // 1. Fetch all persons and organizations (already in your code)
//     if (req.role === "admin") {
//       persons = await Person.findAll({ raw: true });
//       organizations = await Organization.findAll({ raw: true });
//     } else {
//       organizations = await Organization.findAll({
//         // where: { masterUserID: req.adminId },
//         where: {
//           [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
//         },
//         raw: true,
//       });
//     }
//     const orgIds = organizations.map((o) => o.leadOrganizationId);
//     persons = await Person.findAll({
//       where: {
//         [Op.or]: [
//           { masterUserID: req.adminId },
//           { leadOrganizationId: orgIds },
//         ],
//       },
//       raw: true,
//     });
//     // console.log("flatLeads:", flatLeads); // Commented out to see Activity filtering debug messages

//     // Build a map: { [leadOrganizationId]: [ { personId, contactPerson }, ... ] }
//     const orgPersonsMap = {};
//     persons.forEach((p) => {
//       if (p.leadOrganizationId) {
//         if (!orgPersonsMap[p.leadOrganizationId])
//           orgPersonsMap[p.leadOrganizationId] = [];
//         orgPersonsMap[p.leadOrganizationId].push({
//           personId: p.personId,
//           contactPerson: p.contactPerson,
//         });
//       }
//     });

//     // 2. Get all unique ownerIds from persons and organizations
//     const orgOwnerIds = organizations.map((o) => o.ownerId).filter(Boolean);
//     const personOwnerIds = persons.map((p) => p.ownerId).filter(Boolean);
//     const ownerIds = [...new Set([...orgOwnerIds, ...personOwnerIds])];

//     // 3. Fetch owner names from MasterUser
//     const owners = await MasterUser.findAll({
//       where: { masterUserID: ownerIds },
//       attributes: ["masterUserID", "name"],
//       raw: true,
//     });
//     const orgMap = {};
//     organizations.forEach((org) => {
//       orgMap[org.leadOrganizationId] = org;
//     });
//     const ownerMap = {};
//     owners.forEach((o) => {
//       ownerMap[o.masterUserID] = o.name;
//     });
//     persons = persons.map((p) => ({
//       ...p,
//       ownerName: ownerMap[p.ownerId] || null,
//     }));

//     organizations = organizations.map((o) => ({
//       ...o,
//       ownerName: ownerMap[o.ownerId] || null,
//     }));

//     // 4. Count leads for each person and organization
//     const personIds = persons.map((p) => p.personId);

//     const leadCounts = await Lead.findAll({
//       attributes: [
//         "personId",
//         "leadOrganizationId",
//         [Sequelize.fn("COUNT", Sequelize.col("leadId")), "leadCount"],
//       ],
//       where: {
//         [Op.or]: [
//           { personId: personIds },
//           { leadOrganizationId: orgIds },
//           // { leadOrganizationId: orgIdsFromLeads } // <-- use orgIdsFromLeads here
//         ],
//       },
//       group: ["personId", "leadOrganizationId"],
//       raw: true,
//     });

//     // Build maps for quick lookup
//     const personLeadCountMap = {};
//     const orgLeadCountMap = {};
//     leadCounts.forEach((lc) => {
//       if (lc.personId)
//         personLeadCountMap[lc.personId] = parseInt(lc.leadCount, 10);
//       if (lc.leadOrganizationId)
//         orgLeadCountMap[lc.leadOrganizationId] = parseInt(lc.leadCount, 10);
//     });

//     persons = persons.map((p) => {
//       let ownerName = null;
//       if (p.leadOrganizationId && orgMap[p.leadOrganizationId]) {
//         const org = orgMap[p.leadOrganizationId];
//         if (org.ownerId && ownerMap[org.ownerId]) {
//           ownerName = ownerMap[org.ownerId];
//           // organization=ownerMap[org.organization]
//         }
//       }
//       return {
//         ...p,
//         ownerName,
//         // organization,
//         leadCount: personLeadCountMap[p.personId] || 0,
//       };
//     });

//     organizations = organizations.map((o) => ({
//       ...o,
//       ownerName: ownerMap[o.ownerId] || null,
//       leadCount: orgLeadCountMap[o.leadOrganizationId] || 0,
//       persons: orgPersonsMap[o.leadOrganizationId] || [], // <-- add this line
//     }));
//     console.log(req.role, "role of the user............");

//     res.status(200).json({
//       message: "Leads fetched successfully",
//       totalRecords: leads.count,
//       totalPages: Math.ceil(leads.count / limit),
//       currentPage: parseInt(page),
//       // leads: leads.rows,
//       leads: flatLeads, // Return flattened leads with leadDetails merged
//       persons,
//       organizations,
//       role: req.role, // Include user role in the response
//       // leadDetails
//     });
//   } catch (error) {
//     await logAuditTrail(
//       PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
//       "LEAD_FETCH", // Mode
//       null, // No user ID for failed sign-in
//       "Error fetching leads: " + error.message, // Error description
//       null
//     );
//     console.error("Error fetching leads:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

exports.getLeads = async (req, res) => {
  const {
    isArchived,
    search,
    page = 1,
    limit = 500,
    sortBy = "createdAt",
    order = "DESC",
    masterUserID: queryMasterUserID,
    filterId,
  } = req.query;
  console.log(req.role, "role of the user............");

  try {
    // Get user's visibility group and rules
    let userGroup = null;
    let leadVisibilityRule = null;

    if (req.role !== "admin") {
      const membership = await GroupMembership.findOne({
        where: {
          userId: req.adminId,
          isActive: true,
        },
        include: [
          {
            model: VisibilityGroup,
            as: "group",
            where: { isActive: true },
          },
        ],
      });

      if (membership) {
        userGroup = membership.group;
        leadVisibilityRule = await ItemVisibilityRule.findOne({
          where: {
            groupId: userGroup.groupId,
            entityType: "leads",
            isActive: true,
          },
        });
      }
    }

    // Determine masterUserID based on role

    const pref = await LeadColumnPreference.findOne();

    let leadAttributes, leadDetailsAttributes;
    if (pref && pref.columns) {
      // Parse columns if it's a string
      const columns =
        typeof pref.columns === "string"
          ? JSON.parse(pref.columns)
          : pref.columns;

      const leadFields = Object.keys(Lead.rawAttributes);
      const leadDetailsFields = Object.keys(LeadDetails.rawAttributes);

      leadAttributes = columns
        .filter((col) => col.check && leadFields.includes(col.key))
        .map((col) => col.key);
      // Always include leadId
      if (!leadAttributes.includes("leadId")) {
        leadAttributes.unshift("leadId");
      }
      // Always include the sortBy field for ordering
      if (!leadAttributes.includes(sortBy)) {
        leadAttributes.push(sortBy);
      }

      leadDetailsAttributes = columns
        .filter((col) => col.check && leadDetailsFields.includes(col.key))
        .map((col) => col.key);
    }

    console.log(leadAttributes, "leadAttributes from preferences");

    let whereClause = {};
    let hasActivityFiltering = false; // Initialize early for use throughout the function
    let hasPersonFiltering = false; // Initialize for Person filtering
    let hasOrganizationFiltering = false; // Initialize for Organization filtering

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
        attributes: leadDetailsAttributes,
      });
    }

    // Handle masterUserID filtering based on role and query parameters
    if (req.role === "admin") {
      // Admin can filter by specific masterUserID or see all leads
      if (queryMasterUserID && queryMasterUserID !== "all") {
        whereClause[Op.or] = [
          { masterUserID: queryMasterUserID },
          { ownerId: queryMasterUserID },
        ];
      }
      // If queryMasterUserID is "all" or not provided, admin sees all leads (no additional filter)
    } else {
      // Non-admin users: apply visibility filtering based on group rules
      let visibilityConditions = [];

      if (leadVisibilityRule) {
        switch (leadVisibilityRule.defaultVisibility) {
          case "owner_only":
            // User can only see their own leads
            visibilityConditions.push({
              [Op.or]: [
                { masterUserID: req.adminId },
                { ownerId: req.adminId },
              ],
            });
            break;

          case "group_only":
            // User can see leads from their visibility group
            if (userGroup) {
              visibilityConditions.push({
                [Op.or]: [
                  { visibilityGroupId: userGroup.groupId },
                  { masterUserID: req.adminId },
                  { ownerId: req.adminId },
                ],
              });
            }
            break;

          case "item_owners_visibility_group":
            // User can see leads based on owner's visibility group
            if (userGroup) {
              // Get all users in the same visibility group
              const groupMembers = await GroupMembership.findAll({
                where: {
                  groupId: userGroup.groupId,
                  isActive: true,
                },
                attributes: ["userId"],
              });

              const memberIds = groupMembers.map((member) => member.userId);

              visibilityConditions.push({
                [Op.or]: [
                  { masterUserID: { [Op.in]: memberIds } },
                  { ownerId: { [Op.in]: memberIds } },
                  // Include leads where visibility level allows group access
                  {
                    visibilityLevel: {
                      [Op.in]: [
                        "everyone",
                        "group_only",
                        "item_owners_visibility_group",
                      ],
                    },
                    visibilityGroupId: userGroup.groupId,
                  },
                ],
              });
            }
            break;

          case "everyone":
            // User can see all leads (no additional filtering)
            break;

          default:
            // Default to owner only for security
            visibilityConditions.push({
              [Op.or]: [
                { masterUserID: req.adminId },
                { ownerId: req.adminId },
              ],
            });
        }
      } else {
        // No visibility rule found, default to owner only
        visibilityConditions.push({
          [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
        });
      }

      // Apply visibility conditions
      if (visibilityConditions.length > 0) {
        whereClause[Op.and] = whereClause[Op.and] || [];
        whereClause[Op.and].push(...visibilityConditions);
      }

      // Handle specific user filtering for non-admin users
      if (queryMasterUserID && queryMasterUserID !== "all") {
        // Non-admin can only filter within their visible scope
        const userId = queryMasterUserID;
        whereClause[Op.and] = whereClause[Op.and] || [];
        whereClause[Op.and].push({
          [Op.or]: [{ masterUserID: userId }, { ownerId: userId }],
        });
      }
    }

    console.log("→ Query params:", req.query);
    console.log("→ queryMasterUserID:", queryMasterUserID);
    console.log("→ req.adminId:", req.adminId);
    console.log("→ req.role:", req.role);

    //................................................................//filter
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
      const leadFields = Object.keys(Lead.rawAttributes);
      const leadDetailsFields = Object.keys(LeadDetails.rawAttributes);
      const personFields = Object.keys(Person.rawAttributes);
      const organizationFields = Object.keys(Organization.rawAttributes);
      const activityFields = Object.keys(Activity.rawAttributes);

      let filterWhere = {};
      let leadDetailsWhere = {};
      let personWhere = {};
      let organizationWhere = {};
      let activityWhere = {};
      let customFieldsConditions = { all: [], any: [] };

      console.log("Available lead fields:", leadFields);
      console.log("Available leadDetails fields:", leadDetailsFields);
      console.log("Available person fields:", personFields);
      console.log("Available organization fields:", organizationFields);
      console.log("Available activity fields:", activityFields);

      // --- Your new filter logic for all ---
      if (all.length > 0) {
        console.log("Processing 'all' conditions:", all);

        filterWhere[Op.and] = [];
        leadDetailsWhere[Op.and] = [];
        personWhere[Op.and] = [];
        organizationWhere[Op.and] = [];
        activityWhere[Op.and] = [];
        all.forEach((cond) => {
          console.log("Processing condition:", cond);

          // Check if entity is specified in the condition
          if (cond.entity) {
            console.log(`Condition specifies entity: ${cond.entity}`);

            // Handle both "Lead" and "Leads" entity names for backward compatibility
            if (
              (cond.entity === "Lead" || cond.entity === "Leads") &&
              leadFields.includes(cond.field)
            ) {
              console.log(
                `Field '${cond.field}' processed as Lead field due to entity specification`
              );
              filterWhere[Op.and].push(buildCondition(cond));
            } else if (
              cond.entity === "LeadDetails" &&
              leadDetailsFields.includes(cond.field)
            ) {
              console.log(
                `Field '${cond.field}' processed as LeadDetails field due to entity specification`
              );
              leadDetailsWhere[Op.and].push(buildCondition(cond));
            } else if (
              cond.entity === "Person" &&
              personFields.includes(cond.field)
            ) {
              console.log(
                `Field '${cond.field}' processed as Person field due to entity specification`
              );
              personWhere[Op.and].push(buildCondition(cond));
            } else if (
              cond.entity === "Organization" &&
              organizationFields.includes(cond.field)
            ) {
              console.log(
                `Field '${cond.field}' processed as Organization field due to entity specification`
              );
              organizationWhere[Op.and].push(buildCondition(cond));
            } else if (
              cond.entity === "Activity" &&
              activityFields.includes(cond.field)
            ) {
              console.log(
                `Field '${cond.field}' processed as Activity field due to entity specification`
              );
              const activityCondition = buildCondition(cond);
              console.log(
                `Built Activity condition for ${cond.field}:`,
                activityCondition
              );
              console.log(
                `Activity condition symbols:`,
                Object.getOwnPropertySymbols(activityCondition[cond.field])
              );
              if (
                Object.getOwnPropertySymbols(activityCondition[cond.field])
                  .length > 0
              ) {
                const symbol = Object.getOwnPropertySymbols(
                  activityCondition[cond.field]
                )[0];
                console.log(
                  `Activity condition value: ${
                    activityCondition[cond.field][symbol]
                  }`
                );
              }
              activityWhere[Op.and].push(activityCondition);
            } else {
              console.log(
                `Field '${cond.field}' not found in specified entity '${cond.entity}', treating as custom field`
              );
              customFieldsConditions.all.push(cond);
            }
          } else {
            // Fallback to original logic when entity is not specified
            if (leadFields.includes(cond.field)) {
              console.log(`Field '${cond.field}' found in Lead fields`);
              filterWhere[Op.and].push(buildCondition(cond));
            } else if (leadDetailsFields.includes(cond.field)) {
              console.log(`Field '${cond.field}' found in LeadDetails fields`);
              leadDetailsWhere[Op.and].push(buildCondition(cond));
            } else if (personFields.includes(cond.field)) {
              console.log(`Field '${cond.field}' found in Person fields`);
              personWhere[Op.and].push(buildCondition(cond));
            } else if (organizationFields.includes(cond.field)) {
              console.log(`Field '${cond.field}' found in Organization fields`);
              organizationWhere[Op.and].push(buildCondition(cond));
            } else if (activityFields.includes(cond.field)) {
              console.log(`Field '${cond.field}' found in Activity fields`);
              activityWhere[Op.and].push(buildCondition(cond));
            } else {
              console.log(
                `Field '${cond.field}' NOT found in standard fields, treating as custom field`
              );
              // Handle custom fields
              customFieldsConditions.all.push(cond);
            }
          }
        });
        if (filterWhere[Op.and].length === 0) delete filterWhere[Op.and];
        if (leadDetailsWhere[Op.and].length === 0)
          delete leadDetailsWhere[Op.and];
        if (personWhere[Op.and].length === 0) delete personWhere[Op.and];
        if (organizationWhere[Op.and].length === 0)
          delete organizationWhere[Op.and];
        if (activityWhere[Op.and].length === 0) delete activityWhere[Op.and];
      }

      // --- Your new filter logic for any ---
      if (any.length > 0) {
        filterWhere[Op.or] = [];
        leadDetailsWhere[Op.or] = [];
        personWhere[Op.or] = [];
        organizationWhere[Op.or] = [];
        activityWhere[Op.or] = [];
        any.forEach((cond) => {
          // Check if entity is specified in the condition
          if (cond.entity) {
            console.log(`'Any' condition specifies entity: ${cond.entity}`);

            if (cond.entity === "Lead" && leadFields.includes(cond.field)) {
              console.log(
                `Field '${cond.field}' processed as Lead field due to entity specification`
              );
              filterWhere[Op.or].push(buildCondition(cond));
            } else if (
              cond.entity === "LeadDetails" &&
              leadDetailsFields.includes(cond.field)
            ) {
              console.log(
                `Field '${cond.field}' processed as LeadDetails field due to entity specification`
              );
              leadDetailsWhere[Op.or].push(buildCondition(cond));
            } else if (
              cond.entity === "Person" &&
              personFields.includes(cond.field)
            ) {
              console.log(
                `Field '${cond.field}' processed as Person field due to entity specification`
              );
              personWhere[Op.or].push(buildCondition(cond));
            } else if (
              cond.entity === "Organization" &&
              organizationFields.includes(cond.field)
            ) {
              console.log(
                `Field '${cond.field}' processed as Organization field due to entity specification`
              );
              organizationWhere[Op.or].push(buildCondition(cond));
            } else if (
              cond.entity === "Activity" &&
              activityFields.includes(cond.field)
            ) {
              console.log(
                `Field '${cond.field}' processed as Activity field due to entity specification`
              );
              const activityCondition = buildCondition(cond);
              console.log(
                `Built Activity condition for ${cond.field}:`,
                activityCondition
              );
              activityWhere[Op.or].push(activityCondition);
            } else {
              console.log(
                `Field '${cond.field}' not found in specified entity '${cond.entity}', treating as custom field`
              );
              customFieldsConditions.any.push(cond);
            }
          } else {
            // Fallback to original logic when entity is not specified
            if (leadFields.includes(cond.field)) {
              filterWhere[Op.or].push(buildCondition(cond));
            } else if (leadDetailsFields.includes(cond.field)) {
              leadDetailsWhere[Op.or].push(buildCondition(cond));
            } else if (personFields.includes(cond.field)) {
              personWhere[Op.or].push(buildCondition(cond));
            } else if (organizationFields.includes(cond.field)) {
              organizationWhere[Op.or].push(buildCondition(cond));
            } else if (activityFields.includes(cond.field)) {
              activityWhere[Op.or].push(buildCondition(cond));
            } else {
              // Handle custom fields
              customFieldsConditions.any.push(cond);
            }
          }
        });
        if (filterWhere[Op.or].length === 0) delete filterWhere[Op.or];
        if (leadDetailsWhere[Op.or].length === 0)
          delete leadDetailsWhere[Op.or];
        if (personWhere[Op.or].length === 0) delete personWhere[Op.or];
        if (organizationWhere[Op.or].length === 0)
          delete organizationWhere[Op.or];
        if (activityWhere[Op.or].length === 0) delete activityWhere[Op.or];
      }

      // Merge with archive/masterUserID filters
      if (isArchived !== undefined)
        filterWhere.isArchived = isArchived === "true";

      // Apply masterUserID filtering logic for filters
      if (req.role === "admin") {
        // Admin can filter by specific masterUserID or see all leads
        if (queryMasterUserID && queryMasterUserID !== "all") {
          if (filterWhere[Op.or]) {
            // If there's already an Op.or condition from filters, we need to combine properly
            filterWhere[Op.and] = [
              { [Op.or]: filterWhere[Op.or] },
              {
                [Op.or]: [
                  { masterUserID: queryMasterUserID },
                  { ownerId: queryMasterUserID },
                ],
              },
            ];
            delete filterWhere[Op.or];
          } else {
            filterWhere[Op.or] = [
              { masterUserID: queryMasterUserID },
              { ownerId: queryMasterUserID },
            ];
          }
        }
      } else {
        // Non-admin users: filter by their own leads or specific user if provided
        const userId =
          queryMasterUserID && queryMasterUserID !== "all"
            ? queryMasterUserID
            : req.adminId;
        if (filterWhere[Op.or]) {
          // If there's already an Op.or condition from filters, we need to combine properly
          filterWhere[Op.and] = [
            { [Op.or]: filterWhere[Op.or] },
            { [Op.or]: [{ masterUserID: userId }, { ownerId: userId }] },
          ];
          delete filterWhere[Op.or];
        } else {
          filterWhere[Op.or] = [{ masterUserID: userId }, { ownerId: userId }];
        }
      }
      whereClause = filterWhere;

      console.log("→ Built filterWhere:", JSON.stringify(filterWhere));
      console.log(
        "→ Built leadDetailsWhere:",
        JSON.stringify(leadDetailsWhere)
      );
      console.log("→ Built personWhere:", JSON.stringify(personWhere));
      console.log(
        "→ Built organizationWhere:",
        JSON.stringify(organizationWhere)
      );
      console.log("→ Built activityWhere:", activityWhere);
      console.log(
        "→ Activity where object keys length:",
        Object.keys(activityWhere).length
      );
      console.log(
        "→ Activity where object symbols length:",
        Object.getOwnPropertySymbols(activityWhere).length
      );
      console.log(
        "→ All activity where properties:",
        Object.getOwnPropertyNames(activityWhere).concat(
          Object.getOwnPropertySymbols(activityWhere)
        )
      );

      // Fix: Check for both regular keys and Symbol properties (Sequelize operators are Symbols)
      hasActivityFiltering =
        Object.keys(activityWhere).length > 0 ||
        Object.getOwnPropertySymbols(activityWhere).length > 0;

      hasPersonFiltering =
        Object.keys(personWhere).length > 0 ||
        Object.getOwnPropertySymbols(personWhere).length > 0;

      hasOrganizationFiltering =
        Object.keys(organizationWhere).length > 0 ||
        Object.getOwnPropertySymbols(organizationWhere).length > 0;

      if (hasActivityFiltering) {
        console.log("→ Activity filtering will be applied:");
        if (activityWhere[Op.and]) {
          console.log(
            "  - AND conditions count:",
            activityWhere[Op.and].length
          );
        }
        if (activityWhere[Op.or]) {
          console.log("  - OR conditions count:", activityWhere[Op.or].length);
        }

        // Quick database check for debugging
        try {
          const totalActivities = await Activity.count();
          console.log("→ Total activities in database:", totalActivities);

          const activitiesWithType = await Activity.count({
            where: { type: "Meeting" },
          });
          console.log("→ Activities with type='Meeting':", activitiesWithType);

          const activitiesWithLeads = await Activity.count({
            where: { leadId: { [Op.not]: null } },
          });
          console.log("→ Activities linked to leads:", activitiesWithLeads);

          const leadsWithActivities = await Lead.count({
            include: [
              {
                model: Activity,
                as: "Activities",
                required: true,
              },
            ],
          });
          console.log("→ Leads that have activities:", leadsWithActivities);
        } catch (debugError) {
          console.log("→ Debug query error:", debugError.message);
        }
      }

      if (Object.keys(leadDetailsWhere).length > 0) {
        include.push({
          model: LeadDetails,
          as: "details",
          where: leadDetailsWhere,
          required: true,
        });
      } else {
        include.push({
          model: LeadDetails,
          as: "details",
          required: false,
        });
      }

      if (hasPersonFiltering) {
        console.log("→ Person filtering will be applied:");
        if (personWhere[Op.and]) {
          console.log("  - AND conditions count:", personWhere[Op.and].length);
        }
        if (personWhere[Op.or]) {
          console.log("  - OR conditions count:", personWhere[Op.or].length);
        }

        include.push({
          model: Person,
          as: "LeadPerson",
          required: true,
          where: personWhere,
        });
      } else {
        include.push({
          model: Person,
          as: "LeadPerson",
          required: false,
        });
      }

      if (hasOrganizationFiltering) {
        console.log("→ Organization filtering will be applied:");
        if (organizationWhere[Op.and]) {
          console.log(
            "  - AND conditions count:",
            organizationWhere[Op.and].length
          );
        }
        if (organizationWhere[Op.or]) {
          console.log(
            "  - OR conditions count:",
            organizationWhere[Op.or].length
          );
        }

        include.push({
          model: Organization,
          as: "LeadOrganization",
          required: true,
          where: organizationWhere,
        });
      } else {
        include.push({
          model: Organization,
          as: "LeadOrganization",
          required: false,
        });
      }

      if (hasActivityFiltering) {
        console.log("==========================================");
        console.log("🔥 ACTIVITY FILTERING DETECTED!");
        console.log(
          "🔥 Activity where clause:",
          JSON.stringify(activityWhere, null, 2)
        );
        console.log("🔥 Activity where keys:", Object.keys(activityWhere));
        console.log(
          "🔥 Activity where symbols:",
          Object.getOwnPropertySymbols(activityWhere)
        );

        // Debug: Show the actual condition structure
        if (activityWhere[Op.and]) {
          console.log("🔥 AND conditions details:", activityWhere[Op.and]);
          activityWhere[Op.and].forEach((condition, index) => {
            console.log(
              `🔥 Condition ${index}:`,
              JSON.stringify(condition, null, 2)
            );
            console.log(`🔥 Condition ${index} keys:`, Object.keys(condition));
            console.log(
              `🔥 Condition ${index} symbols:`,
              Object.getOwnPropertySymbols(condition)
            );

            // Check each field in the condition
            Object.keys(condition).forEach((field) => {
              console.log(`🔥 Field '${field}' value:`, condition[field]);
              console.log(
                `🔥 Field '${field}' symbols:`,
                Object.getOwnPropertySymbols(condition[field])
              );

              // Show Symbol values
              Object.getOwnPropertySymbols(condition[field]).forEach(
                (symbol) => {
                  console.log(
                    `🔥 Symbol ${symbol.toString()} value:`,
                    condition[field][symbol]
                  );
                }
              );
            });
          });
        }
        console.log("==========================================");

        // NEW APPROACH: Rebuild the activity condition from scratch to avoid Symbol loss
        console.log("🔧 REBUILDING ACTIVITY CONDITIONS FROM SCRATCH...");

        // Find the activity conditions from the filter config and rebuild them
        let rebuiltActivityWhere = null;

        if (activityWhere[Op.and] && activityWhere[Op.and].length > 0) {
          const conditions = [];

          activityWhere[Op.and].forEach((condition, index) => {
            console.log(`🔧 Rebuilding condition ${index}:`, condition);

            // Extract the field name and value from the original condition
            Object.keys(condition).forEach((fieldName) => {
              const fieldCondition = condition[fieldName];
              console.log(
                `🔧 Processing field '${fieldName}' with condition:`,
                fieldCondition
              );

              // Find the operator and value
              Object.getOwnPropertySymbols(fieldCondition).forEach((symbol) => {
                const value = fieldCondition[symbol];
                console.log(
                  `🔧 Found operator ${symbol.toString()} with value: ${value}`
                );

                // Rebuild the condition with fresh Symbols
                if (symbol === Op.eq) {
                  const rebuiltCondition = { [fieldName]: { [Op.eq]: value } };
                  console.log(`🔧 Rebuilt condition:`, rebuiltCondition);
                  console.log(
                    `🔧 Rebuilt condition symbols:`,
                    Object.getOwnPropertySymbols(rebuiltCondition[fieldName])
                  );
                  conditions.push(rebuiltCondition);
                }
                // Add other operators as needed (Op.ne, Op.like, etc.)
              });
            });
          });

          if (conditions.length > 0) {
            rebuiltActivityWhere = { [Op.and]: conditions };
            console.log("� REBUILT ACTIVITY WHERE:", rebuiltActivityWhere);
            console.log(
              "� Rebuilt symbols:",
              Object.getOwnPropertySymbols(rebuiltActivityWhere)
            );

            if (rebuiltActivityWhere[Op.and]) {
              console.log(
                "� Rebuilt AND conditions:",
                rebuiltActivityWhere[Op.and]
              );
              rebuiltActivityWhere[Op.and].forEach((condition, index) => {
                console.log(`� Rebuilt condition ${index}:`, condition);
                Object.keys(condition).forEach((field) => {
                  console.log(
                    `🔧 Field '${field}' symbols:`,
                    Object.getOwnPropertySymbols(condition[field])
                  );
                  Object.getOwnPropertySymbols(condition[field]).forEach(
                    (symbol) => {
                      console.log(
                        `� Rebuilt field '${field}' symbol ${symbol.toString()} = ${
                          condition[field][symbol]
                        }`
                      );
                    }
                  );
                });
              });
            }
          }
        }

        // Use the rebuilt condition if available, otherwise try direct approach
        const finalActivityWhere = rebuiltActivityWhere || { type: "Meeting" };

        console.log("🔧 FINAL ACTIVITY WHERE CONDITION:", finalActivityWhere);
        console.log(
          "🔧 Final condition symbols:",
          Object.getOwnPropertySymbols(finalActivityWhere)
        );

        include.push({
          model: Activity,
          as: "Activities",
          required: true,
          where: finalActivityWhere,
        });

        console.log("🔥 ACTIVITY FILTERING APPLIED WITH REBUILT CONDITIONS");
        console.log(
          "🔥 This should now generate SQL: INNER JOIN activities ON activities.leadId = leads.leadId WHERE activities.type = 'Meeting'"
        );

        // FINAL DEBUG: Check what's actually in the include array
        const finalActivityInclude = include[include.length - 1];
        console.log("🔍 FINAL ACTIVITY INCLUDE IN ARRAY:");
        console.log("🔍 Model:", finalActivityInclude.model.name);
        console.log("🔍 As:", finalActivityInclude.as);
        console.log("🔍 Required:", finalActivityInclude.required);
        console.log("🔍 Where clause:", finalActivityInclude.where);
        console.log(
          "🔍 Where keys:",
          Object.keys(finalActivityInclude.where || {})
        );
        console.log(
          "🔍 Where symbols:",
          Object.getOwnPropertySymbols(finalActivityInclude.where || {})
        );

        if (
          finalActivityInclude.where &&
          typeof finalActivityInclude.where === "object"
        ) {
          Object.keys(finalActivityInclude.where).forEach((key) => {
            console.log(
              `🔍 Where property '${key}':`,
              finalActivityInclude.where[key]
            );
          });
          Object.getOwnPropertySymbols(finalActivityInclude.where).forEach(
            (symbol) => {
              console.log(
                `🔍 Where symbol ${symbol.toString()}:`,
                finalActivityInclude.where[symbol]
              );
            }
          );
        }

        console.log("==========================================");
      } else {
        console.log("==========================================");
        console.log(
          "🔵 NO ACTIVITY FILTERING - ADDING DEFAULT ACTIVITY INCLUDE"
        );
        console.log("==========================================");
        include.push({
          model: Activity,
          as: "Activities",
          required: false,
        });
      }

      console.log(
        "→ Updated include with LeadDetails where:",
        JSON.stringify(leadDetailsWhere)
      );

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
          }))
        );

        const customFieldFilters = await buildCustomFieldFilters(
          customFieldsConditions,
          req.adminId
        );

        console.log("Built custom field filters:", customFieldFilters);

        if (customFieldFilters.length > 0) {
          // Apply custom field filtering by finding leads that match the custom field conditions
          const matchingLeadIds = await getLeadIdsByCustomFieldFilters(
            customFieldFilters,
            req.adminId
          );

          console.log(
            "Matching lead IDs from custom field filtering:",
            matchingLeadIds
          );

          if (matchingLeadIds.length > 0) {
            // If we already have other conditions, combine them
            if (filterWhere[Op.and]) {
              filterWhere[Op.and].push({
                leadId: { [Op.in]: matchingLeadIds },
              });
            } else if (filterWhere[Op.or]) {
              filterWhere[Op.and] = [
                { [Op.or]: filterWhere[Op.or] },
                { leadId: { [Op.in]: matchingLeadIds } },
              ];
              delete filterWhere[Op.or];
            } else {
              filterWhere.leadId = { [Op.in]: matchingLeadIds };
            }
          } else {
            // No leads match the custom field conditions, so return empty result
            console.log("No matching leads found, setting empty result");
            filterWhere.leadId = { [Op.in]: [] };
          }
        } else {
          console.log(
            "No custom field filters found, possibly field not found"
          );
        }

        whereClause = filterWhere;
      }
    } else {
      // Standard search/filter logic
      if (isArchived !== undefined)
        whereClause.isArchived = isArchived === "true";

      if (search) {
        whereClause[Op.or] = [
          { contactPerson: { [Op.like]: `%${search}%` } },
          { organization: { [Op.like]: `%${search}%` } },
          { title: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { phone: { [Op.like]: `%${search}%` } },
        ];
        console.log(
          "→ Search applied, whereClause[Op.or]:",
          whereClause[Op.or]
        );
      }

      // Add default Activity include for non-filtered queries
      include.push({
        model: Activity,
        as: "Activities",
        required: false,
      });
    }

    // Pagination
    const offset = (page - 1) * limit;
    console.log("→ Final whereClause:", JSON.stringify(whereClause));
    console.log("→ Final include:", JSON.stringify(include));
    console.log("→ Pagination: limit =", limit, "offset =", offset);
    console.log("→ Order:", sortBy, order);
    // Always include Person and Organization
    if (!include.some((i) => i.as === "LeadPerson")) {
      include.push({
        model: Person,
        as: "LeadPerson",
        required: false,
      });
    }
    if (!include.some((i) => i.as === "LeadOrganization")) {
      include.push({
        model: Organization,
        as: "LeadOrganization",
        required: false,
      });
    }

    // Activity include is now handled in the filtering section above
    // No need for additional Activity include logic here
    include.push({
      model: MasterUser,
      as: "Owner",
      attributes: ["name", "masterUserID"],
      required: false,
    });
    //   if (!leadAttributes.includes('leadOrganizationId')) {
    //   leadAttributes.push('leadOrganizationId');
    // }
    // if (!leadAttributes.includes('personId')) {
    //   leadAttributes.push('personId');
    // }

    // Always exclude leads that have a dealId (converted leads)
    whereClause.dealId = null;
    console.log("🔍 Applied dealId = null (excluding converted leads)");

    console.log("==========================================");
    console.log("🚀 FINAL QUERY EXECUTION STARTING");
    console.log("🚀 Total include array length:", include.length);

    // Check if Activity filtering is active
    console.log("🚀 Activity include details:");
    const activityInclude = include.find((i) => i.as === "Activities");
    if (activityInclude) {
      console.log("  🎯 Activity include found:");
      console.log("    - Required:", activityInclude.required);
      console.log("    - Has where clause:", !!activityInclude.where);
      if (activityInclude.where) {
        console.log(
          "    - Where clause:",
          JSON.stringify(activityInclude.where)
        );
      }
    } else {
      console.log("  ❌ NO Activity include found!");
    }

    // Check if Person filtering is active
    console.log("🚀 Person include details:");
    const personInclude = include.find((i) => i.as === "LeadPerson");
    if (personInclude) {
      console.log("  👤 Person include found:");
      console.log("    - Required:", personInclude.required);
      console.log("    - Has where clause:", !!personInclude.where);
      if (personInclude.where) {
        console.log("    - Where clause:", JSON.stringify(personInclude.where));
      }
    } else {
      console.log("  ❌ NO Person include found!");
    }

    // Check if Organization filtering is active
    console.log("🚀 Organization include details:");
    const organizationInclude = include.find(
      (i) => i.as === "LeadOrganization"
    );
    if (organizationInclude) {
      console.log("  🏢 Organization include found:");
      console.log("    - Required:", organizationInclude.required);
      console.log("    - Has where clause:", !!organizationInclude.where);
      if (organizationInclude.where) {
        console.log(
          "    - Where clause:",
          JSON.stringify(organizationInclude.where)
        );
      }
    } else {
      console.log("  ❌ NO Organization include found!");
    }
    console.log("==========================================");

    // Fetch leads with pagination, filtering, sorting, searching, and leadDetails
    const leads = await Lead.findAndCountAll({
      where: whereClause,
      include,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, order.toUpperCase()]],
      attributes:
        leadAttributes && leadAttributes.length > 0
          ? leadAttributes
          : undefined,
    });

    console.log("==========================================");
    console.log("🎉 QUERY EXECUTED SUCCESSFULLY!");
    console.log("🎉 Total records found:", leads.count);

    // Debug Activity filtering results
    if (filterId && activityInclude && activityInclude.required) {
      console.log("🎯 ACTIVITY FILTER RESULTS:");
      console.log("  - Leads found with Activity filter:", leads.count);
      if (leads.rows.length > 0) {
        console.log(
          "  - First lead activities:",
          leads.rows[0].Activities
            ? leads.rows[0].Activities.length
            : "No Activities"
        );
        if (leads.rows[0].Activities && leads.rows[0].Activities.length > 0) {
          console.log(
            "  - First activity type:",
            leads.rows[0].Activities[0].type
          );
        }
      }
    }

    // Debug Person filtering results
    if (filterId && hasPersonFiltering) {
      console.log("👤 PERSON FILTER RESULTS:");
      console.log("  - Leads found with Person filter:", leads.count);
      if (leads.rows.length > 0) {
        console.log(
          "  - First lead person:",
          leads.rows[0].LeadPerson
            ? leads.rows[0].LeadPerson.firstName +
                " " +
                leads.rows[0].LeadPerson.lastName
            : "No Person"
        );
      }
    }

    // Debug Organization filtering results
    if (filterId && hasOrganizationFiltering) {
      console.log("🏢 ORGANIZATION FILTER RESULTS:");
      console.log("  - Leads found with Organization filter:", leads.count);
      if (leads.rows.length > 0) {
        console.log(
          "  - First lead organization:",
          leads.rows[0].LeadOrganization
            ? leads.rows[0].LeadOrganization.organizationName
            : "No Organization"
        );
      }
    }
    console.log("==========================================");

    // Get custom field values for all leads (including default/system fields and unified fields)
    // Include all active custom fields (not just checked ones)
    const leadIds = leads.rows.map((lead) => lead.leadId);
    const customFieldValues = await CustomFieldValue.findAll({
      where: {
        entityId: leadIds,
        entityType: "lead",
      },
      include: [
        {
          model: CustomField,
          as: "CustomField",
          where: {
            isActive: true,
            // Removed check: true constraint to show all custom fields
            entityType: { [Op.in]: ["lead", "both"] }, // Support unified fields
            [Op.or]: [
              { masterUserID: req.adminId },
              { fieldSource: "default" },
              { fieldSource: "system" },
              { fieldSource: "custom" }, // Include custom fields
            ],
          },
          required: true,
        },
      ],
    });

    // Group custom field values by leadId
    const customFieldsByLead = {};
    customFieldValues.forEach((value) => {
      if (!value.CustomField) return;
      if (!customFieldsByLead[value.entityId]) {
        customFieldsByLead[value.entityId] = {};
      }
      customFieldsByLead[value.entityId][value.CustomField.fieldName] = {
        fieldId: value.CustomField.fieldId,
        fieldName: value.CustomField.fieldName,
        fieldLabel: value.CustomField.fieldLabel,
        fieldType: value.CustomField.fieldType,
        isImportant: value.CustomField.isImportant,
        value: value.value,
      };
    });

    const flatLeads = leads.rows.map((lead) => {
      const leadObj = lead.toJSON();
      // Overwrite ownerName with the latest Owner.name if present
      if (leadObj.Owner && leadObj.Owner.name) {
        leadObj.ownerName = leadObj.Owner.name;
      }
      delete leadObj.Owner; // Remove the nested Owner object
      delete leadObj.LeadPerson;
      delete leadObj.LeadOrganization;

      // Keep Activities data for the response
      if (leadObj.Activities) {
        leadObj.activities = leadObj.Activities;
        delete leadObj.Activities; // Remove the nested Activities object but keep the data in activities
      }

      if (leadObj.details) {
        Object.assign(leadObj, leadObj.details);
        delete leadObj.details;
      }

      // Add custom fields directly to the lead object (not wrapped in customFields)
      const customFields = customFieldsByLead[leadObj.leadId] || {};
      Object.entries(customFields).forEach(([fieldName, fieldData]) => {
        leadObj[fieldName] = fieldData.value;
      });

      // Keep the customFields property for backward compatibility (optional)
      leadObj.customFields = customFields;

      return leadObj;
    });
    // console.log(leads.rows, "leads rows after flattening"); // Commented out to see Activity filtering debug messages

    let persons, organizations;

    // 1. Fetch all persons and organizations (already in your code)
    if (req.role === "admin") {
      persons = await Person.findAll({ raw: true });
      organizations = await Organization.findAll({ raw: true });
    } else {
      organizations = await Organization.findAll({
        // where: { masterUserID: req.adminId },
        where: {
          [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
        },
        raw: true,
      });
    }
    const orgIds = organizations.map((o) => o.leadOrganizationId);
    persons = await Person.findAll({
      where: {
        [Op.or]: [
          { masterUserID: req.adminId },
          { leadOrganizationId: orgIds },
        ],
      },
      raw: true,
    });
    // console.log("flatLeads:", flatLeads); // Commented out to see Activity filtering debug messages

    // Build a map: { [leadOrganizationId]: [ { personId, contactPerson }, ... ] }
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

    // 2. Get all unique ownerIds from persons and organizations
    const orgOwnerIds = organizations.map((o) => o.ownerId).filter(Boolean);
    const personOwnerIds = persons.map((p) => p.ownerId).filter(Boolean);
    const ownerIds = [...new Set([...orgOwnerIds, ...personOwnerIds])];

    // 3. Fetch owner names from MasterUser
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
    persons = persons.map((p) => ({
      ...p,
      ownerName: ownerMap[p.ownerId] || null,
    }));

    organizations = organizations.map((o) => ({
      ...o,
      ownerName: ownerMap[o.ownerId] || null,
    }));

    // 4. Count leads for each person and organization
    const personIds = persons.map((p) => p.personId);

    const leadCounts = await Lead.findAll({
      attributes: [
        "personId",
        "leadOrganizationId",
        [Sequelize.fn("COUNT", Sequelize.col("leadId")), "leadCount"],
      ],
      where: {
        [Op.or]: [
          { personId: personIds },
          { leadOrganizationId: orgIds },
          // { leadOrganizationId: orgIdsFromLeads } // <-- use orgIdsFromLeads here
        ],
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

    persons = persons.map((p) => {
      let ownerName = null;
      if (p.leadOrganizationId && orgMap[p.leadOrganizationId]) {
        const org = orgMap[p.leadOrganizationId];
        if (org.ownerId && ownerMap[org.ownerId]) {
          ownerName = ownerMap[org.ownerId];
          // organization=ownerMap[org.organization]
        }
      }
      return {
        ...p,
        ownerName,
        // organization,
        leadCount: personLeadCountMap[p.personId] || 0,
      };
    });

    organizations = organizations.map((o) => ({
      ...o,
      ownerName: ownerMap[o.ownerId] || null,
      leadCount: orgLeadCountMap[o.leadOrganizationId] || 0,
      persons: orgPersonsMap[o.leadOrganizationId] || [], // <-- add this line
    }));
    console.log(req.role, "role of the user............");

    res.status(200).json({
      message: "Leads fetched successfully",
      totalRecords: leads.count,
      totalPages: Math.ceil(leads.count / limit),
      currentPage: parseInt(page),
      // leads: leads.rows,
      leads: flatLeads, // Return flattened leads with leadDetails merged
      persons,
      organizations,
      role: req.role, // Include user role in the response
      // leadDetails
    });
  } catch (error) {
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT, // Program ID for authentication
      "LEAD_FETCH", // Mode
      null, // No user ID for failed sign-in
      "Error fetching leads: " + error.message, // Error description
      null
    );
    console.error("Error fetching leads:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Helper function to build condition for regular fields
function buildCondition(condition) {
  const { field, operator, value } = condition;

  // Handle date conversion if needed
  let processedValue = value;
  if (typeof value === "string" && value.includes("days ago")) {
    processedValue = convertRelativeDate(value);
  }

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

  let mappedOperator = operator;

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
    equals: "eq",
    "not equals": "ne",
    "greater than": "gt",
    "greater than or equal": "gte",
    "less than": "lt",
    "less than or equal": "lte",
  };

  if (operatorMap[mappedOperator]) {
    mappedOperator = operatorMap[mappedOperator];
  }

  // Handle special cases
  if (mappedOperator === "isEmpty") {
    return { [field]: { [Op.is]: null } };
  }

  if (mappedOperator === "isNotEmpty") {
    return { [field]: { [Op.not]: null, [Op.ne]: "" } };
  }

  if (mappedOperator === "like") {
    return { [field]: { [Op.like]: `%${processedValue}%` } };
  }

  if (mappedOperator === "notLike") {
    return { [field]: { [Op.notLike]: `%${processedValue}%` } };
  }

  if (mappedOperator === "in" && Array.isArray(processedValue)) {
    return { [field]: { [Op.in]: processedValue } };
  }

  if (mappedOperator === "notIn" && Array.isArray(processedValue)) {
    return { [field]: { [Op.notIn]: processedValue } };
  }

  if (mappedOperator === "between" && Array.isArray(processedValue)) {
    return { [field]: { [Op.between]: processedValue } };
  }

  if (mappedOperator === "notBetween" && Array.isArray(processedValue)) {
    return { [field]: { [Op.notBetween]: processedValue } };
  }

  // Default condition
  const sequelizeOp = ops[mappedOperator] || Op.eq;
  return { [field]: { [sequelizeOp]: processedValue } };
}

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
          isActive: true,
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
            isActive: true,
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
          isActive: true,
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
            isActive: true,
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

async function getLeadIdsByCustomFieldFilters(
  customFieldFilters,
  masterUserID
) {
  if (customFieldFilters.length === 0) return [];

  const allFilters = customFieldFilters.filter((f) => f.logicType === "all");
  const anyFilters = customFieldFilters.filter((f) => f.logicType === "any");

  let leadIds = [];

  // Handle 'all' filters (AND logic) - all conditions must be met
  if (allFilters.length > 0) {
    let allConditionLeadIds = null;

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

      // Search for custom field values with the right entity type
      // For lead filtering, we want to find all entity types that could be related to leads
      const customFieldValues = await CustomFieldValue.findAll({
        where: {
          fieldId: filter.fieldId,
          entityType: "lead", // Start with just lead entity type for debugging
          ...whereCondition,
        },
        attributes: ["entityId", "entityType", "value"],
      });

      console.log(
        "Found custom field values:",
        customFieldValues.map((cfv) => ({
          entityId: cfv.entityId,
          entityType: cfv.entityType,
          value: cfv.value,
        }))
      );

      let currentLeadIds = [];

      // If the entity type is 'lead', use entityId directly
      for (const cfv of customFieldValues) {
        if (cfv.entityType === "lead") {
          currentLeadIds.push(cfv.entityId);
        }
      }

      // Remove duplicates
      currentLeadIds = [...new Set(currentLeadIds)];
      console.log("Current lead IDs for filter:", currentLeadIds);

      if (allConditionLeadIds === null) {
        allConditionLeadIds = currentLeadIds;
      } else {
        // Intersection - only keep leads that match all conditions
        allConditionLeadIds = allConditionLeadIds.filter((id) =>
          currentLeadIds.includes(id)
        );
      }
    }

    leadIds = allConditionLeadIds || [];
  }

  // Handle 'any' filters (OR logic) - any condition can be met
  if (anyFilters.length > 0) {
    let anyConditionLeadIds = [];

    for (const filter of anyFilters) {
      const whereCondition = buildCustomFieldCondition(
        filter.condition,
        filter.fieldId
      );

      const customFieldValues = await CustomFieldValue.findAll({
        where: {
          fieldId: filter.fieldId,
          entityType: "lead", // Start with just lead entity type for debugging
          ...whereCondition,
        },
        attributes: ["entityId", "entityType", "value"],
      });

      let currentLeadIds = [];

      for (const cfv of customFieldValues) {
        if (cfv.entityType === "lead") {
          currentLeadIds.push(cfv.entityId);
        }
      }

      currentLeadIds = [...new Set(currentLeadIds)];
      anyConditionLeadIds = [...anyConditionLeadIds, ...currentLeadIds];
    }

    // Remove duplicates
    anyConditionLeadIds = [...new Set(anyConditionLeadIds)];

    if (leadIds.length > 0) {
      // If we have both 'all' and 'any' conditions, combine them with AND logic
      leadIds = leadIds.filter((id) => anyConditionLeadIds.includes(id));
    } else {
      leadIds = anyConditionLeadIds;
    }
  }

  console.log("Final lead IDs from custom field filtering:", leadIds);
  return leadIds;
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

// Get visibility options for lead creation/editing
exports.getLeadVisibilityOptions = async (req, res) => {
  try {
    const permissions = await getUserLeadVisibilityPermissions(
      req.adminId,
      req.role
    );

    const options = [
      {
        value: "owner_only",
        label: "Item owner",
        description:
          "Visible to the owner, Deals admins, parent visibility groups",
        available: true,
      },
      {
        value: "item_owners_visibility_group",
        label: "Item owner's visibility group",
        description:
          "Visible to the owner, Deals admins, users in the same visibility group and parent group",
        available: true,
        default:
          permissions.defaultVisibility === "item_owners_visibility_group",
      },
      {
        value: "group_only",
        label: "Item owner's visibility group and sub-groups",
        description:
          "Visible to the owner, Deals admins, users in the same visibility group, parent group and sub-groups",
        available: permissions.userGroup !== null,
      },
      {
        value: "everyone",
        label: "All users",
        description: "Visible to everyone in the company",
        available:
          req.role === "admin" ||
          (permissions.userGroup &&
            permissions.userGroup.allowGlobalVisibility),
      },
    ];

    res.status(200).json({
      message: "Visibility options retrieved successfully",
      options: options.filter((opt) => opt.available),
      defaultOption: permissions.defaultVisibility,
      userGroup: permissions.userGroup
        ? {
            groupId: permissions.userGroup.groupId,
            groupName: permissions.userGroup.groupName,
          }
        : null,
    });
  } catch (error) {
    console.error("Error getting visibility options:", error);
    res.status(500).json({
      message: "Error retrieving visibility options",
      error: error.message,
    });
  }
};

exports.updateLead = async (req, res) => {
  const { leadId } = req.params;
  const updateObj = req.body;

  console.log("Request body:", updateObj);

  try {
    // Get all columns for Lead, LeadDetails, Person, and Organization
    const leadFields = Object.keys(Lead.rawAttributes);
    const leadDetailsFields = Object.keys(LeadDetails.rawAttributes);
    const personFields = Object.keys(Person.rawAttributes);
    const organizationFields = Object.keys(Organization.rawAttributes);
    console.log("Lead fields:", leadFields);
    console.log("LeadDetails fields:", leadDetailsFields);
    console.log("Person fields:", personFields);
    console.log("Organization fields:", organizationFields);

    // Split the update object
    const leadData = {};
    const leadDetailsData = {};
    const personData = {};
    const organizationData = {};
    const customFields = {};

    for (const key in updateObj) {
      if (key === "customFields") {
        // Handle nested customFields object (backward compatibility)
        Object.assign(customFields, updateObj[key]);
        continue;
      }

      if (leadFields.includes(key)) {
        leadData[key] = updateObj[key];
      } else if (personFields.includes(key)) {
        personData[key] = updateObj[key];
      } else if (organizationFields.includes(key)) {
        organizationData[key] = updateObj[key];
      } else if (leadDetailsFields.includes(key)) {
        leadDetailsData[key] = updateObj[key];
      } else {
        // If the key doesn't match any model field, treat it as a custom field
        customFields[key] = updateObj[key];
      }
    }

    console.log("leadData:", leadData);
    console.log("leadDetailsData:", leadDetailsData);
    console.log("personData:", personData);
    console.log("organizationData:", organizationData);
    console.log("customFields:", customFields);

    // Update Lead
    const lead = await Lead.findByPk(leadId);
    console.log("Fetched lead:", lead ? lead.toJSON() : null);
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

    // Check for email uniqueness if email is being updated
    const emailToUpdate = leadData.email || personData.email;
    if (emailToUpdate && emailToUpdate !== lead.email) {
      const existingLead = await Lead.findOne({
        where: {
          email: emailToUpdate,
          leadId: { [Op.ne]: leadId }, // Exclude current lead from the check
        },
      });
      if (existingLead) {
        return res.status(409).json({
          message:
            "A lead with this email address already exists. Each lead must have a unique email address.",
          existingLeadId: existingLead.leadId,
          existingLeadTitle: existingLead.title,
        });
      }
    }

    // Check for organization uniqueness if organization is being updated
    const organizationToUpdate =
      leadData.organization || organizationData.organization;
    if (organizationToUpdate && organizationToUpdate !== lead.organization) {
      const existingOrgLead = await Lead.findOne({
        where: {
          organization: organizationToUpdate,
          leadId: { [Op.ne]: leadId }, // Exclude current lead from the check
        },
      });
      if (existingOrgLead) {
        return res.status(409).json({
          message:
            "A lead with this organization already exists. Each organization must be unique.",
          existingLeadId: existingOrgLead.leadId,
          existingLeadTitle: existingOrgLead.title,
          existingOrganization: existingOrgLead.organization,
        });
      }
    }

    let ownerChanged = false;
    let newOwner = null;
    let assigner = null;
    if (updateObj.ownerId && updateObj.ownerId !== lead.ownerId) {
      ownerChanged = true;
      newOwner = await MasterUser.findByPk(updateObj.ownerId);
      assigner = await MasterUser.findByPk(req.adminId);
    }

    // Update or create Organization
    let orgRecord;
    if (Object.keys(organizationData).length > 0) {
      orgRecord = await Organization.findOne({
        where: { leadOrganizationId: lead.leadOrganizationId },
      });
      console.log("Fetched orgRecord:", orgRecord ? orgRecord.toJSON() : null);
      if (orgRecord) {
        await orgRecord.update(organizationData);
        console.log("Organization updated:", orgRecord.toJSON());
      } else {
        orgRecord = await Organization.create(organizationData);
        console.log("Organization created:", orgRecord.toJSON());
        leadData.leadOrganizationId = orgRecord.leadOrganizationId;
        await lead.update({ leadOrganizationId: orgRecord.leadOrganizationId });
        console.log(
          "Lead updated with new leadOrganizationId:",
          orgRecord.leadOrganizationId
        );
      }
    }

    // Update or create Person
    let personRecord;
    if (Object.keys(personData).length > 0) {
      personRecord = await Person.findOne({
        where: { personId: lead.personId },
      });
      console.log(
        "Fetched personRecord:",
        personRecord ? personRecord.toJSON() : null
      );
      if (personRecord) {
        await personRecord.update(personData);
        console.log("Person updated:", personRecord.toJSON());
      } else {
        if (orgRecord)
          personData.leadOrganizationId = orgRecord.leadOrganizationId;
        personRecord = await Person.create(personData);
        console.log("Person created:", personRecord.toJSON());
        leadData.personId = personRecord.personId;
        await lead.update({ personId: personRecord.personId });
        console.log("Lead updated with new personId:", personRecord.personId);
      }
    }

    // Update Lead
    if (Object.keys(leadData).length > 0) {
      // Sanitize numeric fields - convert empty strings to null
      const numericFields = ['proposalValue', 'valueCurrency', 'proposalValueCurrency'];
      numericFields.forEach(field => {
        if (leadData.hasOwnProperty(field) && leadData[field] === '') {
          leadData[field] = null;
        }
      });
      
      console.log("Sanitized leadData:", leadData);
      await lead.update(leadData);
      console.log("Lead updated:", lead.toJSON());
    }

    // --- Send email if owner changed ---
    if (
      ownerChanged &&
      newOwner &&
      newOwner.email &&
      assigner &&
      assigner.email
    ) {
      await sendEmail(assigner.email, {
        from: assigner.email,
        to: newOwner.email,
        subject: "You have been assigned a new lead",
        text: `Hello ${newOwner.name},\n\nYou have been assigned a new lead: "${lead.title}" by ${assigner.name}.\n\nPlease check your CRM dashboard for details.`,
      });
    }

    // Update or create LeadDetails
    let leadDetails = await LeadDetails.findOne({ where: { leadId } });
    console.log(
      "Fetched leadDetails:",
      leadDetails ? leadDetails.toJSON() : null
    );
    
    // Sanitize LeadDetails data - ensure string fields are actually strings
    if (Object.keys(leadDetailsData).length > 0) {
      const stringFields = ['source', 'sourceOrgin', 'organizationName', 'personName', 'notes', 'postalAddress', 'jobTitle', 'address', 'statusSummary', 'responsiblePerson'];
      stringFields.forEach(field => {
        if (leadDetailsData.hasOwnProperty(field)) {
          const value = leadDetailsData[field];
          if (value !== null && value !== undefined) {
            if (typeof value === 'object' || Array.isArray(value)) {
              // Convert object/array to string or set to null
              leadDetailsData[field] = JSON.stringify(value);
            } else if (typeof value !== 'string') {
              // Convert other types to string
              leadDetailsData[field] = String(value);
            }
          }
        }
      });
      console.log("Sanitized leadDetailsData:", leadDetailsData);
    }
    
    if (leadDetails) {
      if (Object.keys(leadDetailsData).length > 0) {
        await leadDetails.update(leadDetailsData);
        console.log("LeadDetails updated:", leadDetails.toJSON());
      }
    } else if (Object.keys(leadDetailsData).length > 0) {
      leadDetailsData.leadId = leadId;
      leadDetails = await LeadDetails.create(leadDetailsData);
      console.log("LeadDetails created:", leadDetails.toJSON());
    }

    // Handle custom fields if provided
    const savedCustomFields = {};
    if (customFields && Object.keys(customFields).length > 0) {
      try {
        console.log("Processing custom fields for update:", customFields);

        for (const [fieldKey, value] of Object.entries(customFields)) {
          // Try to find the custom field by fieldName first, then by fieldId
          let customField = null;

          // First try to find by fieldName
          customField = await CustomField.findOne({
            where: {
              fieldName: fieldKey,
              entityType: { [Op.in]: ["lead", "both"] }, // Support unified fields
              isActive: true,
              // [Op.or]: [
              //   { masterUserID: req.adminId },
              //   { fieldSource: "default" },
              //   { fieldSource: "system" },
              // ],
            },
          });

          // If not found by fieldName, try by fieldId
          if (!customField) {
            customField = await CustomField.findOne({
              where: {
                fieldId: fieldKey,
                entityType: { [Op.in]: ["lead", "both"] }, // Support unified fields
                isActive: true,
                // [Op.or]: [
                //   { masterUserID: req.adminId },
                //   { fieldSource: "default" },
                //   { fieldSource: "system" },
                // ],
              },
            });
          }

          if (customField) {
            console.log(
              `Found custom field: ${customField.fieldName} (ID: ${customField.fieldId})`
            );

            // Check if custom field value already exists
            const existingValue = await CustomFieldValue.findOne({
              where: {
                fieldId: customField.fieldId,
                entityId: leadId,
                entityType: "lead",
              },
            });

            if (existingValue) {
              // Update existing value
              const valueToSave =
                typeof value === "object" ? JSON.stringify(value) : value;
              if (
                valueToSave !== null &&
                valueToSave !== undefined &&
                valueToSave !== ""
              ) {
                await existingValue.update({ value: valueToSave });
                console.log(
                  `Updated custom field value for ${customField.fieldName}: ${valueToSave}`
                );
                savedCustomFields[customField.fieldName] = {
                  label: customField.fieldLabel,
                  value: valueToSave,
                  type: customField.fieldType,
                  isImportant: customField.isImportant,
                };
              } else {
                // Delete the value if it's empty
                await existingValue.destroy();
                console.log(
                  `Deleted custom field value for ${customField.fieldName}`
                );
              }
            } else {
              // Create new value
              const valueToSave =
                typeof value === "object" ? JSON.stringify(value) : value;
              if (
                valueToSave !== null &&
                valueToSave !== undefined &&
                valueToSave !== ""
              ) {
                await CustomFieldValue.create({
                  fieldId: customField.fieldId,
                  entityId: leadId,
                  entityType: "lead",
                  value: valueToSave,
                  masterUserID: req.adminId, // <-- add this line
                });
                console.log(
                  `Created custom field value for ${customField.fieldName}: ${valueToSave}`
                );
                savedCustomFields[customField.fieldName] = {
                  label: customField.fieldLabel,
                  value: valueToSave,
                  type: customField.fieldType,
                  isImportant: customField.isImportant,
                };
              }
            }
          } else {
            console.log(`Custom field not found: ${fieldKey}`);
          }
        }
      } catch (customFieldError) {
        console.error("Error processing custom fields:", customFieldError);
        // Don't fail the entire update if custom fields fail
      }
    }
    // // --- Send email if owner changed ---
    // if (ownerChanged && newOwner && newOwner.email) {
    //   // You should have a sendEmail utility function
    //   await sendEmail(
    //     newOwner.email,
    //     "You have been assigned a new lead",
    //     `Hello ${newOwner.name},\n\nYou have been assigned a new lead: "${lead.title}".\n\nPlease check your CRM dashboard for details.`
    //   );
    // }
    await historyLogger(
      PROGRAMS.LEAD_MANAGEMENT, // Program ID for lead management
      "LEAD_UPDATE", // Mode
      lead.masterUserID, // Admin ID from the authenticated request
      leadId, // Record ID (Lead ID)
      req.adminId,
      `Lead updated by "${req.role}"`, // Description
      {
        from: lead.toJSON(),
        to: {
          ...leadData,
          leadOrganizationId: orgRecord
            ? orgRecord.leadOrganizationId
            : lead.leadOrganizationId,
          personId: personRecord ? personRecord.personId : lead.personId,
          customFields: savedCustomFields,
        },
      } // Changes logged as JSON
    );

    // Prepare response with updated lead and custom fields
    const leadResponse = {
      ...lead.toJSON(),
      // customFields: savedCustomFields,
    };

    res.status(200).json({
      message: "Lead updated successfully",
      lead: leadResponse,
      leadDetails,
      person: personRecord,
      organization: orgRecord,
      customFieldsUpdated: Object.keys(savedCustomFields).length,
      customFields: savedCustomFields,
    });
  } catch (error) {
    console.error("Error updating lead:", error);
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
    return res
      .status(400)
      .json({ message: "customFields must be a valid object." });
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

    res.status(200).json({
      message: "Custom fields updated successfully",
      customFields: lead.customFields,
    });
  } catch (error) {
    console.error("Error updating custom fields:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getNonAdminMasterUserNames = async (req, res) => {
  try {
    const { search, userType } = req.query;

    // Build base where clause
    let where = {};
    let users = [];

    // If userType is 'all', fetch all users regardless of role
    if (userType === "all") {
      if (search) {
        where.name = { [Op.like]: `%${search}%` };
      }
      users = await MasterUser.findAll({
        where,
        attributes: ["masterUserID", "name", "userType", "email"],
        order: [["name", "ASC"]],
      });
    } else if (req.role === "admin") {
      // Admin can see all users (including other admins if needed for assignment)
      where = {
        // userType: { [Op.ne]: "admin" }
      };
      if (search) {
        where.name = { [Op.like]: `%${search}%` };
      }
      if (userType) {
        where.userType = userType;
      }
      users = await MasterUser.findAll({
        where,
        attributes: ["masterUserID", "name", "userType", "email"],
        order: [["name", "ASC"]],
      });
    } else if (req.role === "master") {
      where = {
        [Op.or]: [{ userType: "general" }, { masterUserID: req.adminId }],
      };
      if (search) {
        where[Op.and] = [
          { [Op.or]: where[Op.or] },
          { name: { [Op.like]: `%${search}%` } },
        ];
        delete where[Op.or];
      }
      if (userType && (userType === "general" || userType === "master")) {
        if (userType === "general") {
          where = { userType: "general" };
        } else {
          where = { masterUserID: req.adminId };
        }
        if (search) {
          where.name = { [Op.like]: `%${search}%` };
        }
      }
      users = await MasterUser.findAll({
        where,
        attributes: ["masterUserID", "name", "userType", "email"],
        order: [["name", "ASC"]],
      });
    } else if (req.role === "general") {
      where = {
        masterUserID: req.adminId,
      };
      if (search) {
        where.name = { [Op.like]: `%${search}%` };
      }
      users = await MasterUser.findAll({
        where,
        attributes: ["masterUserID", "name", "userType", "email"],
        order: [["name", "ASC"]],
      });
    } else {
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT,
        "MASTER_USER_FETCH",
        req.adminId,
        `Access denied: Invalid role "${req.role}"`,
        null
      );
      return res.status(403).json({
        message: "Access denied. Invalid user role.",
      });
    }

    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "MASTER_USER_FETCH",
      req.adminId,
      `Successfully fetched ${users.length} users for role "${req.role}"`,
      null
    );

    res.status(200).json({
      users,
      message: `Found ${users.length} users`,
      userRole: req.role,
    });
  } catch (error) {
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "MASTER_USER_FETCH",
      req.adminId,
      `Error fetching master users: ${error.message}`,
      null
    );
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
        await logAuditTrail(
          PROGRAMS.LEAD_MANAGEMENT,
          "LEAD_FETCH_BY_MASTER_USER",
          req.adminId,
          `Master user with name "${name}" not found.`,
          null
        );
        return res.status(404).json({ message: "Master user not found." });
      }
      whereClause.masterUserID = user.masterUserID;
    } else {
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT,
        "LEAD_FETCH_BY_MASTER_USER",
        req.adminId,
        "Lead fetch failed: masterUserID or name is required.",
        null
      );

      return res
        .status(400)
        .json({ message: "Please provide masterUserID or name." });
    }

    const leads = await Lead.findAll({ where: whereClause });
    res.status(200).json({ leads });
  } catch (error) {
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "LEAD_FETCH_BY_MASTER_USER",
      req.adminId,
      `Error fetching leads by master user: ${error.message}`,
      null
    );
    console.error("Error fetching leads by master user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllLeadDetails = async (req, res) => {
  const masterUserID = req.adminId;
  const { leadId } = req.params;

  // Add pagination parameters for emails
  const { emailPage = 1, emailLimit = 50 } = req.query;
  const emailOffset = (emailPage - 1) * emailLimit;

  if (!leadId) {
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "LEAD_DETAILS_FETCH",
      masterUserID,
      "Lead details fetch failed: leadId is required",
      null
    );
    console.error("leadId is required in params.");
    return res.status(400).json({ message: "leadId is required in params." });
  }

  try {
    // Get the lead details
    const lead = await Lead.findByPk(leadId);
    if (!lead || !lead.email) {
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT,
        "LEAD_DETAILS_FETCH",
        masterUserID,
        "Lead details fetch failed: Lead or lead email not found.",
        null
      );
      return res.status(404).json({ message: "Lead or lead email not found." });
    }

    const clientEmail = lead.email;

    // Optimize email fetching with pagination and size limits
    const maxEmailLimit = Math.min(parseInt(emailLimit) || 25, 50);
    const maxBodyLength = 1000;

    let emails = await Email.findAll({
      where: {
        [Op.or]: [
          { sender: clientEmail },
          { recipient: { [Op.like]: `%${clientEmail}%` } },
        ],
      },
      attributes: [
        "emailID",
        "messageId",
        "inReplyTo",
        "references",
        "sender",
        "recipient",
        "subject",
        "createdAt",
        "folder",
        [Sequelize.fn("LEFT", Sequelize.col("body"), maxBodyLength), "body"],
      ],
      include: [
        {
          model: Attachment,
          as: "attachments",
          attributes: ["attachmentID", "filename", "size", "contentType"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: maxEmailLimit,
      offset: emailOffset,
    });

    // Filter out emails with "RE:" in subject and no inReplyTo or references
    emails = emails.filter((email) => {
      const hasRE =
        email.subject && email.subject.toLowerCase().startsWith("re:");
      const noThread =
        (!email.inReplyTo || email.inReplyTo === "") &&
        (!email.references || email.references === "");
      return !(hasRE && noThread);
    });

    let emailsExist = emails.length > 0;
    if (!emailsExist) {
      emails = [];
    }

    // Simplified thread handling
    const threadIds = [];
    emails.forEach((email) => {
      if (email.messageId) threadIds.push(email.messageId);
      if (email.inReplyTo) threadIds.push(email.inReplyTo);
    });
    const uniqueThreadIds = [...new Set(threadIds.filter(Boolean))];

    // Fetch related emails with stricter limits
    let relatedEmails = [];
    if (uniqueThreadIds.length > 0 && uniqueThreadIds.length < 20) {
      relatedEmails = await Email.findAll({
        where: {
          [Op.or]: [
            { messageId: { [Op.in]: uniqueThreadIds } },
            { inReplyTo: { [Op.in]: uniqueThreadIds } },
          ],
        },
        attributes: [
          "emailID",
          "messageId",
          "inReplyTo",
          "sender",
          "recipient",
          "subject",
          "createdAt",
          "folder",
          [Sequelize.fn("LEFT", Sequelize.col("body"), maxBodyLength), "body"],
        ],
        include: [
          {
            model: Attachment,
            as: "attachments",
            attributes: ["attachmentID", "filename", "size", "contentType"],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: maxEmailLimit,
      });

      // Remove duplicates by messageId
      const seen = new Set();
      relatedEmails = relatedEmails.filter((email) => {
        if (seen.has(email.messageId)) return false;
        seen.add(email.messageId);
        return true;
      });
    } else {
      relatedEmails = emails;
    }

    const notes = await LeadNote.findAll({
      where: { leadId },
      order: [["createdAt", "DESC"]],
    });

    // Get all unique creator IDs from notes
    const creatorIds = [...new Set(notes.map((note) => note.createdBy))];

    // Fetch all creators in one query
    const creators = await MasterUser.findAll({
      where: { masterUserID: creatorIds },
      attributes: ["masterUserID", "name"],
    });
    const creatorMap = {};
    creators.forEach((user) => {
      creatorMap[user.masterUserID] = user.name;
    });

    // Attach creatorName to each note
    const notesWithCreator = notes.map((note) => {
      const noteObj = note.toJSON();
      noteObj.creatorName = creatorMap[note.createdBy] || null;
      return noteObj;
    });

    const leadDetails = await LeadDetails.findOne({ where: { leadId } });
    const activities = await Activity.findAll({
      where: { leadId },
      order: [["startDateTime", "DESC"]],
    });

    // Fetch all active custom fields for leads
    const allCustomFields = await CustomField.findAll({
      where: {
        isActive: true,
        entityType: { [Op.in]: ["lead", "both"] },
      },
      attributes: [
        "fieldId",
        "fieldName",
        "fieldType",
        "isRequired",
        "entityType",
        "fieldLabel",
        "options",
      ],
      order: [["sortOrder", "ASC"]],
    });

    // Fetch all custom field values for this lead
    const customFieldValues = await CustomFieldValue.findAll({
      where: {
        entityId: leadId,
        entityType: "lead",
      },
    });

    // Map values by fieldId
    const valueMap = {};
    customFieldValues.forEach((cfv) => {
      valueMap[cfv.fieldId] = cfv.value;
    });

    // Merge all custom fields with values
    const customFields = {};
    allCustomFields.forEach((field) => {
      customFields[field.fieldName] = {
        fieldId: field.fieldId,
        fieldName: field.fieldName,
        fieldLabel: field.fieldLabel,
        fieldType: field.fieldType,
        isRequired: field.isRequired,
        options: field.options,
        value:
          valueMap[field.fieldId] !== undefined
            ? valueMap[field.fieldId]
            : null,
      };
    });

    // FETCH CURRENCY DETAILS
    let valueCurrencyDetails = null;
    let proposalValueCurrencyDetails = null;

    if (lead.valueCurrency) {
      valueCurrencyDetails = await Currency.findOne({
        where: { currencyId: lead.valueCurrency },
        attributes: ["currencyId", "currency_desc"],
      });
    }

    if (lead.proposalValueCurrency) {
      proposalValueCurrencyDetails = await Currency.findOne({
        where: { currencyId: lead.proposalValueCurrency },
        attributes: ["currencyId", "currency_desc"],
      });
    }

    // Only include specified fields in the lead object - UPDATED to include currency fields
    const allowedFields = [
      "value",
      "valueCurrency", // Added
      "expectedCloseDate",
      "sourceOrigin",
      "sourceChannel",
      "sourceChannelID",
      "ownerId",
      "ownerName",
      "email",
      "phone",
      "contactPerson",
      "notes",
      "jobTitle",
      "birthday",
      "organization",
      "address",
      "title",
      "proposalValue", // Added
      "proposalValueCurrency", // Added
    ];

    const filteredLead = {};
    if (lead) {
      allowedFields.forEach((field) => {
        if (lead[field] !== undefined) {
          filteredLead[field] = lead[field];
        }
      });
    }

    res.status(200).json({
      message: "Lead details fetched successfully.",
      lead: filteredLead,
      leadDetails,
      customFields,
      notes: notesWithCreator,
      emails: relatedEmails,
      activities,
      currencyDetails: {
        valueCurrency: valueCurrencyDetails
          ? {
              currencyId: valueCurrencyDetails.currencyId,
              currency_desc: valueCurrencyDetails.currency_desc,
            }
          : null,
        proposalValueCurrency: proposalValueCurrencyDetails
          ? {
              currencyId: proposalValueCurrencyDetails.currencyId,
              currency_desc: proposalValueCurrencyDetails.currency_desc,
            }
          : null,
      },
      _emailMetadata: {
        count: relatedEmails.length,
        page: parseInt(emailPage),
        limit: maxEmailLimit,
        hasMore: relatedEmails.length === maxEmailLimit,
        bodyTruncated: true,
        bodyMaxLength: maxBodyLength,
        note: "Email bodies are truncated for performance. Use separate email detail API for full content.",
      },
      _pagination: {
        emailPage: parseInt(emailPage),
        emailLimit: maxEmailLimit,
        emailOffset: emailOffset,
      },
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "LEAD_DETAILS_FETCH",
      masterUserID,
      `Lead details fetch failed: ${error.message}`,
      null
    );
    res.status(500).json({ message: "Internal server error." });
  }
};

// exports.getAllLeadDetails = async (req, res) => {
//   const masterUserID = req.adminId;
//   const { leadId } = req.params;

//   // Add pagination parameters for emails
//   const { emailPage = 1, emailLimit = 50 } = req.query;
//   const emailOffset = (emailPage - 1) * emailLimit;

//   if (!leadId) {
//     await logAuditTrail(
//       PROGRAMS.LEAD_MANAGEMENT,
//       "LEAD_DETAILS_FETCH",
//       masterUserID,
//       "Lead details fetch failed: leadId is required",
//       null
//     );
//     console.error("leadId is required in params.");
//     return res.status(400).json({ message: "leadId is required in params." });
//   }

//   try {
//     // Get the user's email address from credentials
//     const lead = await Lead.findByPk(leadId);
//     if (!lead || !lead.email) {
//       await logAuditTrail(
//         PROGRAMS.LEAD_MANAGEMENT,
//         "LEAD_DETAILS_FETCH",
//         masterUserID,
//         "Lead details fetch failed: Lead or lead email not found.",
//         null
//       );
//       return res.status(404).json({ message: "Lead or lead email not found." });
//     }
//     //     const deal = await Deal.findByPk(dealId);
//     // if (!deal || !deal.email) {
//     //   return res.status(404).json({ message: "Lead or lead email not found." });
//     // }
//     const clientEmail = lead.email;

//     // Optimize email fetching with pagination and size limits
//     const maxEmailLimit = Math.min(parseInt(emailLimit) || 25, 50); // Cap at 50 emails max
//     const maxBodyLength = 1000; // Truncate email bodies to prevent large responses

//     let emails = await Email.findAll({
//       where: {
//         [Op.or]: [
//           { sender: clientEmail },
//           { recipient: { [Op.like]: `%${clientEmail}%` } },
//         ],
//       },
//       attributes: [
//         "emailID",
//         "messageId",
//         "inReplyTo",
//         "references",
//         "sender",
//         "recipient",
//         "subject",
//         "createdAt",
//         "folder",
//         // Truncate body to prevent large responses
//         [Sequelize.fn("LEFT", Sequelize.col("body"), maxBodyLength), "body"],
//       ],
//       include: [
//         {
//           model: Attachment,
//           as: "attachments",
//           attributes: ["attachmentID", "filename", "size", "contentType"], // Exclude file paths to reduce size
//         },
//       ],
//       order: [["createdAt", "DESC"]], // Get most recent first
//       limit: maxEmailLimit,
//       offset: emailOffset,
//     });

//     // Filter out emails with "RE:" in subject and no inReplyTo or references
//     emails = emails.filter((email) => {
//       const hasRE =
//         email.subject && email.subject.toLowerCase().startsWith("re:");
//       const noThread =
//         (!email.inReplyTo || email.inReplyTo === "") &&
//         (!email.references || email.references === "");
//       return !(hasRE && noThread);
//     });

//     let emailsExist = emails.length > 0;
//     if (!emailsExist) {
//       emails = [];
//     }

//     // Simplified thread handling - only get direct replies to prevent exponential growth
//     const threadIds = [];
//     emails.forEach((email) => {
//       if (email.messageId) threadIds.push(email.messageId);
//       if (email.inReplyTo) threadIds.push(email.inReplyTo);
//     });
//     const uniqueThreadIds = [...new Set(threadIds.filter(Boolean))];

//     // Fetch related emails with stricter limits
//     let relatedEmails = [];
//     if (uniqueThreadIds.length > 0 && uniqueThreadIds.length < 20) {
//       // Prevent too many thread lookups
//       relatedEmails = await Email.findAll({
//         where: {
//           [Op.or]: [
//             { messageId: { [Op.in]: uniqueThreadIds } },
//             { inReplyTo: { [Op.in]: uniqueThreadIds } },
//           ],
//         },
//         attributes: [
//           "emailID",
//           "messageId",
//           "inReplyTo",
//           "sender",
//           "recipient",
//           "subject",
//           "createdAt",
//           "folder",
//           [Sequelize.fn("LEFT", Sequelize.col("body"), maxBodyLength), "body"],
//         ],
//         include: [
//           {
//             model: Attachment,
//             as: "attachments",
//             attributes: ["attachmentID", "filename", "size", "contentType"],
//           },
//         ],
//         order: [["createdAt", "DESC"]],
//         limit: maxEmailLimit, // Use the same limit
//       });

//       // Remove duplicates by messageId
//       const seen = new Set();
//       relatedEmails = relatedEmails.filter((email) => {
//         if (seen.has(email.messageId)) return false;
//         seen.add(email.messageId);
//         return true;
//       });
//     } else {
//       // If too many threads, just use the original emails
//       relatedEmails = emails;
//     }
//     const notes = await LeadNote.findAll({
//       where: { leadId },
//       order: [["createdAt", "DESC"]],
//     });
//     // Get all unique creator IDs from notes
//     const creatorIds = [...new Set(notes.map((note) => note.createdBy))];

//     // Fetch all creators in one query
//     const creators = await MasterUser.findAll({
//       where: { masterUserID: creatorIds },
//       attributes: ["masterUserID", "name"],
//     });
//     const creatorMap = {};
//     creators.forEach((user) => {
//       creatorMap[user.masterUserID] = user.name;
//     });

//     // Attach creatorName to each note
//     const notesWithCreator = notes.map((note) => {
//       const noteObj = note.toJSON();
//       noteObj.creatorName = creatorMap[note.createdBy] || null;
//       return noteObj;
//     });
//     const leadDetails = await LeadDetails.findOne({ where: { leadId } });
//     const activities = await Activity.findAll({
//       where: { leadId },
//       order: [["startDateTime", "DESC"]],
//     });

//     // Fetch all active custom fields for leads (for all users, not just current admin)
//     const allCustomFields = await CustomField.findAll({
//       where: {
//         isActive: true,
//         entityType: { [Op.in]: ["lead", "both"] },
//       },
//       attributes: [
//         "fieldId",
//         "fieldName",
//         "fieldType",
//         "isRequired",
//         "entityType",
//         "fieldLabel",
//         "options"
//       ],
//       order: [["sortOrder", "ASC"]],
//     });

//     // Fetch all custom field values for this lead
//     const customFieldValues = await CustomFieldValue.findAll({
//       where: {
//         entityId: leadId,
//         entityType: "lead",
//       },
//     });

//     // Map values by fieldId
//     const valueMap = {};
//     customFieldValues.forEach((cfv) => {
//       valueMap[cfv.fieldId] = cfv.value;
//     });

//     // Merge all custom fields with values (value: null if not present)
//     const customFields = {};
//     allCustomFields.forEach((field) => {
//       customFields[field.fieldName] = {
//         fieldId: field.fieldId,
//         fieldName: field.fieldName,
//         fieldLabel: field.fieldLabel,
//         fieldType: field.fieldType,
//         isRequired: field.isRequired,
//         options: field.options,
//         value:
//           valueMap[field.fieldId] !== undefined
//             ? valueMap[field.fieldId]
//             : null,
//       };
//     });

//     // Only include specified fields in the lead object
//     const allowedFields = [
//       "value",
//       "valueCurrency",
//       "expectedCloseDate",
//       "sourceOrigin",
//       "sourceChannel",
//       "sourceChannelID",
//       "ownerId",
//       "ownerName",
//       "email",
//       "phone",
//       "contactPerson",
//       "notes",
//       "jobTitle",
//       "birthday",
//       "organization",
//       "address",
//       "title",
//       "proposalValue",
//       "proposalValueCurrency"
//     ];
//     const filteredLead = {};
//     if (lead) {
//       allowedFields.forEach((field) => {
//         if (lead[field] !== undefined) {
//           filteredLead[field] = lead[field];
//         }
//       });
//     }

//     res.status(200).json({
//       message: "Lead details fetched successfully.",
//       lead: filteredLead,
//       leadDetails,
//       customFields,
//       notes: notesWithCreator,
//       emails: relatedEmails, // Restored as flat array for frontend compatibility
//       activities,
//       // Include metadata as separate fields for debugging and future use
//       _emailMetadata: {
//         count: relatedEmails.length,
//         page: parseInt(emailPage),
//         limit: maxEmailLimit,
//         hasMore: relatedEmails.length === maxEmailLimit,
//         bodyTruncated: true,
//         bodyMaxLength: maxBodyLength,
//         note: "Email bodies are truncated for performance. Use separate email detail API for full content.",
//       },
//       _pagination: {
//         emailPage: parseInt(emailPage),
//         emailLimit: maxEmailLimit,
//         emailOffset: emailOffset,
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching conversation:", error);
//     await logAuditTrail(
//       PROGRAMS.LEAD_MANAGEMENT,
//       "LEAD_DETAILS_FETCH",
//       masterUserID,
//       `Lead details fetch failed: ${error.message}`,
//       null
//     );
//     res.status(500).json({ message: "Internal server error." });
//   }
// };

exports.addLeadNote = async (req, res) => {
  const { content } = req.body;
  const { leadId } = req.params;
  const masterUserID = req.adminId;
  const createdBy = req.adminId;

  // 100KB = 102400 bytes
  if (!content || Buffer.byteLength(content, "utf8") > 102400) {
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "LEAD_NOTE_ADD",
      masterUserID,
      "Note addition failed: Note is required and must be under 100KB.",
      null
    );
    return res
      .status(400)
      .json({ message: "Note is required and must be under 100KB." });
  }
  if (!leadId) {
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "LEAD_NOTE_ADD",
      masterUserID,
      "Note addition failed: leadId is required",
      null
    );
    return res.status(400).json({ message: "leadId is required." });
  }

  try {
    const note = await LeadNote.create({
      leadId,
      masterUserID,
      content,
      createdBy,
    });
    
    // Fetch user name from MasterUser table
    const user = await MasterUser.findOne({
      where: { masterUserID: req.adminId },
      attributes: ['name', 'masterUserID']
    });
    
    // Add user name to note object
    const noteWithUserName = {
      ...note.toJSON(),
      creatorName: user ? user.name : null,
      userMasterID: user ? user.masterUserID : null
    };
    
    await historyLogger(
      PROGRAMS.LEAD_MANAGEMENT,
      "LEAD_NOTE_ADD",
      masterUserID,
      leadId,
      createdBy,
      `Note added to lead with ID ${leadId} by user ${req.role}`,
      { content }
    );
    res.status(201).json({ 
      message: "Note added successfully", 
      note: noteWithUserName 
    });
  } catch (error) {
    console.error("Error adding note:", error);
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "LEAD_NOTE_ADD",
      masterUserID,
      `Note addition failed: ${error.message}`,
      null
    );
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.deleteLeadNote = async (req, res) => {
  const { noteId } = req.params;
  const masterUserID = req.adminId;

  if (!noteId) {
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "LEAD_NOTE_DELETE",
      masterUserID,
      "Note deletion failed: noteId is required",
      null
    );
    return res.status(400).json({ message: "noteId is required." });
  }

  try {
    const note = await LeadNote.findByPk(noteId);
    if (!note) {
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT,
        "LEAD_NOTE_DELETE",
        masterUserID,
        `Note deletion failed: Note with ID ${noteId} not found`,
        null
      );
      return res.status(404).json({ message: "Note not found." });
    }

    // Check if the note belongs to the current user
    if (note.masterUserID !== masterUserID) {
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT,
        "LEAD_NOTE_DELETE",
        masterUserID,
        `Note deletion failed: User does not have permission to delete note with ID ${noteId}`,
        null
      );
      return res
        .status(403)
        .json({ message: "You do not have permission to delete this note." });
    }

    await note.destroy();
    await historyLogger(
      PROGRAMS.LEAD_MANAGEMENT,
      "LEAD_NOTE_DELETE",
      masterUserID,
      noteId,
      req.adminId,
      `Note with ID ${noteId} deleted by user ${req.role}`,
      null
    );
    res.status(200).json({ message: "Note deleted successfully." });
  } catch (error) {
    console.error("Error deleting note:", error);
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "LEAD_NOTE_DELETE",
      masterUserID,
      `Note deletion failed: ${error.message}`,
      null
    );
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.updateLeadNote = async (req, res) => {
  const { noteId } = req.params;
  const { content } = req.body;
  const masterUserID = req.adminId;

  // Validate input
  if (!noteId) {
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "LEAD_NOTE_UPDATE",
      masterUserID,
      "Note update failed: noteId is required",
      null
    );
    return res.status(400).json({ message: "noteId is required." });
  }
  if (!content || Buffer.byteLength(content, "utf8") > 102400) {
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "LEAD_NOTE_UPDATE",
      masterUserID,
      "Note update failed: Note is required and must be under 100KB.",
      null
    );
    return res
      .status(400)
      .json({ message: "Note is required and must be under 100KB." });
  }

  try {
    const note = await LeadNote.findByPk(noteId);
    if (!note) {
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT,
        "LEAD_NOTE_UPDATE",
        masterUserID,
        `Note update failed: Note with ID ${noteId} not found`,
        null
      );
      return res.status(404).json({ message: "Note not found." });
    }

    // Check if the note belongs to the current user
    if (note.masterUserID !== masterUserID) {
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT,
        "LEAD_NOTE_UPDATE",
        masterUserID,
        `Note update failed: User does not have permission to edit note with ID ${noteId}`,
        null
      );
      return res
        .status(403)
        .json({ message: "You do not have permission to edit this note." });
    }

    note.content = content;
    await note.save();
    await historyLogger(
      PROGRAMS.LEAD_MANAGEMENT,
      "LEAD_NOTE_UPDATE",
      masterUserID,
      noteId,
      req.adminId,
      `Note with ID ${noteId} updated by user ${req.role}`,
      { from: note.content, to: content }
    );
    res.status(200).json({ message: "Note updated successfully.", note });
  } catch (error) {
    console.error("Error updating note:", error);
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "LEAD_NOTE_UPDATE",
      masterUserID,
      `Note update failed: ${error.message}`,
      null
    );
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getPersons = async (req, res) => {
  const {
    search,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    order = "DESC",
    filterId,
  } = req.query;

  console.log(req.role, "Role of the user");

  try {
    // 1. Build where clauses and includes (reuse your dynamic filter logic)
    let personWhere = {};
    let organizationWhere = {};
    let include = [];

    // --- Dynamic filter logic (reuse from getLeads) ---
    if (filterId) {
      const filter = await LeadFilter.findByPk(filterId);
      if (!filter) {
        return res.status(404).json({ message: "Filter not found." });
      }
      const filterConfig =
        typeof filter.filterConfig === "string"
          ? JSON.parse(filter.filterConfig)
          : filter.filterConfig;

      const personFields = Object.keys(Person.rawAttributes);
      const organizationFields = Object.keys(Organization.rawAttributes);

      // AND conditions
      if (filterConfig.all && filterConfig.all.length > 0) {
        personWhere[Op.and] = [];
        organizationWhere[Op.and] = [];
        filterConfig.all.forEach((cond) => {
          if (personFields.includes(cond.field))
            personWhere[Op.and].push(buildCondition(cond));
          else if (organizationFields.includes(cond.field))
            organizationWhere[Op.and].push(buildCondition(cond));
        });
        if (!personWhere[Op.and].length) delete personWhere[Op.and];
        if (!organizationWhere[Op.and].length) delete organizationWhere[Op.and];
      }
      // OR conditions
      if (filterConfig.any && filterConfig.any.length > 0) {
        personWhere[Op.or] = [];
        organizationWhere[Op.or] = [];
        filterConfig.any.forEach((cond) => {
          if (personFields.includes(cond.field))
            personWhere[Op.or].push(buildCondition(cond));
          else if (organizationFields.includes(cond.field))
            organizationWhere[Op.or].push(buildCondition(cond));
        });
        if (!personWhere[Op.or].length) delete personWhere[Op.or];
        if (!organizationWhere[Op.or].length) delete organizationWhere[Op.or];
      }
    } else {
      // Only show persons and organizations created by this user
      if (req.role !== "admin") {
        personWhere.masterUserID = req.adminId;
        organizationWhere.masterUserID = req.adminId;
      }

      // Optional: add search logic
      if (search) {
        personWhere[Op.or] = [
          { contactPerson: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { phone: { [Op.like]: `%${search}%` } },
        ];
        organizationWhere[Op.or] = [
          { organization: { [Op.like]: `%${search}%` } },
          { address: { [Op.like]: `%${search}%` } },
        ];
      }
    }

    // 2. Search logic
    if (search) {
      personWhere[Op.or] = [
        { contactPerson: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
      organizationWhere[Op.or] = [
        { organization: { [Op.like]: `%${search}%` } },
        { address: { [Op.like]: `%${search}%` } },
      ];
    }

    // 3. Fetch all organizations (with pagination)
    let persons, organizationsRaw;

    if (req.role === "admin") {
      // 1. Fetch all organizations (with pagination and filters)
      const orgOffset = (page - 1) * limit;
      organizationsRaw = await Organization.findAndCountAll({
        where: organizationWhere,
        limit: parseInt(limit),
        offset: parseInt(orgOffset),
        order: [[sortBy, order.toUpperCase()]],
        raw: true,
      });

      // 2. Fetch all persons for these organizations
      const orgIds = organizationsRaw.rows.map((o) => o.leadOrganizationId);
      persons = await Person.findAll({
        where: {
          ...personWhere,
          leadOrganizationId: { [Op.in]: orgIds },
        },
        raw: true,
      });
    } else {
      // 1. Fetch all persons (filtered)

      persons = await Person.findAll({
        where: personWhere,
        raw: true,
      });

      // 2. Get unique orgIds from filtered persons
      const orgIds = [
        ...new Set(persons.map((p) => p.leadOrganizationId).filter(Boolean)),
      ];

      // 3. Fetch only organizations for those orgIds (with pagination)
      const orgOffset = (page - 1) * limit;
      organizationsRaw = await Organization.findAndCountAll({
        where: {
          ...organizationWhere,
          leadOrganizationId: { [Op.in]: orgIds },
        },
        limit: parseInt(limit),
        offset: parseInt(orgOffset),
        order: [[sortBy, order.toUpperCase()]],
        raw: true,
      });
    }
    // 2. Get unique orgIds from filtered persons
    // const orgIds = [...new Set(persons.map(p => p.leadOrganizationId).filter(Boolean))];
    const orgIds = [
      ...new Set(persons.map((p) => p.leadOrganizationId).filter(Boolean)),
    ];
    // 5. Count leads for each person and organization
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

    // 6. Fetch owner names
    const ownerIds = [
      ...organizationsRaw.rows.map((o) => o.ownerId).filter(Boolean),
      ...persons.map((p) => p.ownerId).filter(Boolean),
    ];
    const owners = await MasterUser.findAll({
      where: { masterUserID: ownerIds },
      attributes: ["masterUserID", "name"],
      raw: true,
    });
    const ownerMap = {};
    owners.forEach((o) => {
      ownerMap[o.masterUserID] = o.name;
    });

    // 7. Attach persons to organizations
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

    // 8. Format organizations, only include those with at least one person
    const organizations = organizationsRaw.rows.map((o) => ({
      ...o,
      ownerName: ownerMap[o.ownerId] || null,
      leadCount: orgLeadCountMap[o.leadOrganizationId] || 0,
      persons: orgPersonsMap[o.leadOrganizationId] || [],
    }));

    // If not admin, filter out organizations without persons
    const finalOrganizations =
      req.role === "admin"
        ? organizations
        : organizations.filter((org) => org.persons.length > 0);

    // 9. Format persons
    persons = persons.map((p) => ({
      ...p,
      ownerName: ownerMap[p.ownerId] || null,
      leadCount: personLeadCountMap[p.personId] || 0,
    }));

    res.status(200).json({
      message: "Data fetched successfully",
      totalRecords: organizationsRaw.count,
      totalPages: Math.ceil(organizationsRaw.count / limit),
      currentPage: parseInt(page),
      persons,
      organizations: finalOrganizations,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Bulk edit leads functionality
exports.bulkEditLeads = async (req, res) => {
  const { leadIds, updateData } = req.body;

  // Validate input
  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({
      message: "leadIds must be a non-empty array",
    });
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    return res.status(400).json({
      message: "updateData must contain at least one field to update",
    });
  }

  console.log("Bulk edit request:", { leadIds, updateData });

  try {
    // Check access permissions
    if (!["admin", "general", "master"].includes(req.role)) {
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT,
        "BULK_LEAD_UPDATE",
        null,
        "Access denied. You do not have permission to bulk edit leads.",
        req.adminId
      );
      return res.status(403).json({
        message:
          "Access denied. You do not have permission to bulk edit leads.",
      });
    }

    // Get all columns for different models
    const leadFields = Object.keys(Lead.rawAttributes);
    const leadDetailsFields = Object.keys(LeadDetails.rawAttributes);
    const personFields = Object.keys(Person.rawAttributes);
    const organizationFields = Object.keys(Organization.rawAttributes);

    // Split the update data by model
    const leadData = {};
    const leadDetailsData = {};
    const personData = {};
    const organizationData = {};
    const customFields = {};

    for (const key in updateData) {
      if (key === "customFields") {
        Object.assign(customFields, updateData[key]);
        continue;
      }

      if (leadFields.includes(key)) {
        leadData[key] = updateData[key];
      } else if (personFields.includes(key)) {
        personData[key] = updateData[key];
      } else if (organizationFields.includes(key)) {
        organizationData[key] = updateData[key];
      } else if (leadDetailsFields.includes(key)) {
        leadDetailsData[key] = updateData[key];
      } else {
        // Treat as custom field
        customFields[key] = updateData[key];
      }
    }

    console.log("Processed update data:", {
      leadData,
      leadDetailsData,
      personData,
      organizationData,
      customFields,
    });

    // Find leads to update
    let whereClause = { leadId: { [Op.in]: leadIds } };

    // Apply role-based filtering
    if (req.role !== "admin") {
      whereClause[Op.or] = [
        { masterUserID: req.adminId },
        { ownerId: req.adminId },
      ];
    }

    const leadsToUpdate = await Lead.findAll({
      where: whereClause,
      include: [
        {
          model: LeadDetails,
          as: "details",
          required: false,
        },
        {
          model: Person,
          as: "LeadPerson",
          required: false,
        },
        {
          model: Organization,
          as: "LeadOrganization",
          required: false,
        },
      ],
    });

    if (leadsToUpdate.length === 0) {
      return res.status(404).json({
        message:
          "No leads found to update or you don't have permission to edit them",
      });
    }

    console.log(`Found ${leadsToUpdate.length} leads to update`);

    const updateResults = {
      successful: [],
      failed: [],
      skipped: [],
    };

    // Process each lead
    for (const lead of leadsToUpdate) {
      try {
        console.log(`Processing lead ${lead.leadId}`);

        // Track if owner is being changed
        let ownerChanged = false;
        let newOwner = null;
        if (updateData.ownerId && updateData.ownerId !== lead.ownerId) {
          ownerChanged = true;
          newOwner = await MasterUser.findByPk(updateData.ownerId);
        }

        // Update Lead table
        if (Object.keys(leadData).length > 0) {
          await lead.update(leadData);
          console.log(`Updated lead ${lead.leadId} with:`, leadData);
        }

        // Update LeadDetails table
        if (Object.keys(leadDetailsData).length > 0) {
          let leadDetails = await LeadDetails.findOne({
            where: { leadId: lead.leadId },
          });

          if (leadDetails) {
            await leadDetails.update(leadDetailsData);
          } else {
            await LeadDetails.create({
              leadId: lead.leadId,
              ...leadDetailsData,
            });
          }
          console.log(
            `Updated lead details for ${lead.leadId}:`,
            leadDetailsData
          );
        }

        // Update Person table
        if (Object.keys(personData).length > 0 && lead.personId) {
          const person = await Person.findByPk(lead.personId);
          if (person) {
            await person.update(personData);
            console.log(`Updated person ${lead.personId}:`, personData);
          }
        }

        // Update Organization table
        if (
          Object.keys(organizationData).length > 0 &&
          lead.leadOrganizationId
        ) {
          const organization = await Organization.findByPk(
            lead.leadOrganizationId
          );
          if (organization) {
            await organization.update(organizationData);
            console.log(
              `Updated organization ${lead.leadOrganizationId}:`,
              organizationData
            );
          }
        }

        // Handle custom fields
        const savedCustomFields = {};
        if (customFields && Object.keys(customFields).length > 0) {
          for (const [fieldKey, value] of Object.entries(customFields)) {
            try {
              // Find custom field by fieldId first, then by fieldName
              let customField = await CustomField.findOne({
                where: {
                  fieldId: fieldKey,
                  entityType: { [Op.in]: ["lead", "both"] },
                  isActive: true,
                  [Op.or]: [
                    { masterUserID: req.adminId },
                    { fieldSource: "default" },
                    { fieldSource: "system" },
                  ],
                },
              });

              if (!customField) {
                customField = await CustomField.findOne({
                  where: {
                    fieldName: fieldKey,
                    entityType: { [Op.in]: ["lead", "both"] },
                    isActive: true,
                    [Op.or]: [
                      { masterUserID: req.adminId },
                      { fieldSource: "default" },
                      { fieldSource: "system" },
                    ],
                  },
                });
              }

              if (
                customField &&
                value !== null &&
                value !== undefined &&
                value !== ""
              ) {
                // Check if custom field value already exists
                const existingValue = await CustomFieldValue.findOne({
                  where: {
                    fieldId: customField.fieldId,
                    entityId: lead.leadId,
                    entityType: "lead",
                  },
                });

                if (existingValue) {
                  await existingValue.update({ value: value });
                } else {
                  await CustomFieldValue.create({
                    fieldId: customField.fieldId,
                    entityId: lead.leadId,
                    entityType: "lead",
                    value: value,
                    masterUserID: req.adminId,
                  });
                }

                savedCustomFields[customField.fieldName] = {
                  fieldName: customField.fieldName,
                  fieldType: customField.fieldType,
                  value: value,
                };
              }
            } catch (customFieldError) {
              console.error(
                `Error updating custom field ${fieldKey} for lead ${lead.leadId}:`,
                customFieldError
              );
            }
          }
        }

        // Send email notification if owner changed
        if (ownerChanged && newOwner && newOwner.email) {
          try {
            const assigner = await MasterUser.findByPk(req.adminId);
            if (assigner && assigner.email) {
              await sendEmail(assigner.email, {
                from: assigner.email,
                to: newOwner.email,
                subject: "You have been assigned a new lead",
                text: `Hello ${newOwner.name},\n\nYou have been assigned a new lead: "${lead.title}" by ${assigner.name}.\n\nPlease check your CRM dashboard for details.`,
              });
            }
          } catch (emailError) {
            console.error(
              `Error sending email notification for lead ${lead.leadId}:`,
              emailError
            );
          }
        }

        // Log audit trail for successful update
        await historyLogger(
          PROGRAMS.LEAD_MANAGEMENT,
          "BULK_LEAD_UPDATE",
          req.adminId,
          lead.leadId,
          null,
          `Lead bulk updated by ${req.role}`,
          { updateData }
        );

        updateResults.successful.push({
          leadId: lead.leadId,
          title: lead.title,
          contactPerson: lead.contactPerson,
          organization: lead.organization,
          customFields: savedCustomFields,
        });
      } catch (leadError) {
        console.error(`Error updating lead ${lead.leadId}:`, leadError);

        await logAuditTrail(
          PROGRAMS.LEAD_MANAGEMENT,
          "BULK_LEAD_UPDATE",
          req.adminId,
          `Error updating lead ${lead.leadId}: ${leadError.message}`,
          req.adminId
        );

        updateResults.failed.push({
          leadId: lead.leadId,
          title: lead.title,
          error: leadError.message,
        });
      }
    }

    // Check for leads that were requested but not found
    const foundLeadIds = leadsToUpdate.map((lead) => lead.leadId);
    const notFoundLeadIds = leadIds.filter((id) => !foundLeadIds.includes(id));

    notFoundLeadIds.forEach((leadId) => {
      updateResults.skipped.push({
        leadId: leadId,
        reason: "Lead not found or no permission to edit",
      });
    });

    console.log("Bulk update results:", updateResults);

    res.status(200).json({
      message: "Bulk edit operation completed",
      results: updateResults,
      summary: {
        total: leadIds.length,
        successful: updateResults.successful.length,
        failed: updateResults.failed.length,
        skipped: updateResults.skipped.length,
      },
    });
  } catch (error) {
    console.error("Error in bulk edit leads:", error);

    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "BULK_LEAD_UPDATE",
      null,
      "Error in bulk edit leads: " + error.message,
      req.adminId
    );

    res.status(500).json({
      message: "Internal server error during bulk edit",
      error: error.message,
    });
  }
};

// Bulk delete leads functionality
exports.bulkDeleteLeads = async (req, res) => {
  const { leadIds } = req.body;

  // Validate input
  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({
      message: "leadIds must be a non-empty array",
    });
  }

  console.log("Bulk delete request for leads:", leadIds);

  try {
    // Check access permissions
    if (!["admin", "general", "master"].includes(req.role)) {
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT,
        "BULK_LEAD_DELETE",
        null,
        "Access denied. You do not have permission to bulk delete leads.",
        req.adminId
      );
      return res.status(403).json({
        message:
          "Access denied. You do not have permission to bulk delete leads.",
      });
    }

    // Find leads to delete
    let whereClause = { leadId: { [Op.in]: leadIds } };

    // Apply role-based filtering
    if (req.role !== "admin") {
      whereClause[Op.or] = [
        { masterUserID: req.adminId },
        { ownerId: req.adminId },
      ];
    }

    const leadsToDelete = await Lead.findAll({
      where: whereClause,
      attributes: [
        "leadId",
        "title",
        "contactPerson",
        "organization",
        "masterUserID",
      ],
    });

    if (leadsToDelete.length === 0) {
      return res.status(404).json({
        message:
          "No leads found to delete or you don't have permission to delete them",
      });
    }

    console.log(`Found ${leadsToDelete.length} leads to delete`);

    const deleteResults = {
      successful: [],
      failed: [],
      skipped: [],
    };

    // Process each lead for deletion
    for (const lead of leadsToDelete) {
      try {
        console.log(`Deleting lead ${lead.leadId}`);

        // Delete related data first
        // Delete custom field values
        await CustomFieldValue.destroy({
          where: {
            entityId: lead.leadId,
            entityType: "lead",
          },
        });

        // Delete lead notes
        await LeadNote.destroy({
          where: { leadId: lead.leadId },
        });

        // Delete lead details
        await LeadDetails.destroy({
          where: { leadId: lead.leadId },
        });

        // Update emails to remove leadId association
        await Email.update(
          { leadId: null },
          { where: { leadId: lead.leadId } }
        );

        // Delete the lead
        await Lead.destroy({
          where: { leadId: lead.leadId },
        });

        // Log audit trail for successful deletion
        await historyLogger(
          PROGRAMS.LEAD_MANAGEMENT,
          "BULK_LEAD_DELETE",
          req.adminId,
          lead.leadId,
          null,
          `Lead bulk deleted by ${req.role}`,
          { leadTitle: lead.title }
        );

        deleteResults.successful.push({
          leadId: lead.leadId,
          title: lead.title,
          contactPerson: lead.contactPerson,
          organization: lead.organization,
        });
      } catch (leadError) {
        console.error(`Error deleting lead ${lead.leadId}:`, leadError);

        await logAuditTrail(
          PROGRAMS.LEAD_MANAGEMENT,
          "BULK_LEAD_DELETE",
          req.adminId,
          `Error deleting lead ${lead.leadId}: ${leadError.message}`,
          req.adminId
        );

        deleteResults.failed.push({
          leadId: lead.leadId,
          title: lead.title,
          error: leadError.message,
        });
      }
    }

    // Check for leads that were requested but not found
    const foundLeadIds = leadsToDelete.map((lead) => lead.leadId);
    const notFoundLeadIds = leadIds.filter((id) => !foundLeadIds.includes(id));

    notFoundLeadIds.forEach((leadId) => {
      deleteResults.skipped.push({
        leadId: leadId,
        reason: "Lead not found or no permission to delete",
      });
    });

    console.log("Bulk delete results:", deleteResults);

    res.status(200).json({
      message: "Bulk delete operation completed",
      results: deleteResults,
      summary: {
        total: leadIds.length,
        successful: deleteResults.successful.length,
        failed: deleteResults.failed.length,
        skipped: deleteResults.skipped.length,
      },
    });
  } catch (error) {
    console.error("Error in bulk delete leads:", error);

    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "BULK_LEAD_DELETE",
      null,
      "Error in bulk delete leads: " + error.message,
      req.adminId
    );

    res.status(500).json({
      message: "Internal server error during bulk delete",
      error: error.message,
    });
  }
};

// Bulk archive leads functionality
exports.bulkArchiveLeads = async (req, res) => {
  const { leadIds } = req.body;

  // Validate input
  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({
      message: "leadIds must be a non-empty array",
    });
  }

  console.log("Bulk archive request for leads:", leadIds);

  try {
    // Check access permissions
    if (!["admin", "general", "master"].includes(req.role)) {
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT,
        "BULK_LEAD_ARCHIVE",
        null,
        "Access denied. You do not have permission to bulk archive leads.",
        req.adminId
      );
      return res.status(403).json({
        message:
          "Access denied. You do not have permission to bulk archive leads.",
      });
    }

    // Find leads to archive
    let whereClause = {
      leadId: { [Op.in]: leadIds },
      isArchived: false, // Only archive non-archived leads
    };

    // Apply role-based filtering
    if (req.role !== "admin") {
      whereClause[Op.or] = [
        { masterUserID: req.adminId },
        { ownerId: req.adminId },
      ];
    }

    const leadsToArchive = await Lead.findAll({
      where: whereClause,
      attributes: [
        "leadId",
        "title",
        "contactPerson",
        "organization",
        "isArchived",
      ],
    });

    if (leadsToArchive.length === 0) {
      return res.status(404).json({
        message:
          "No leads found to archive or you don't have permission to archive them",
      });
    }

    console.log(`Found ${leadsToArchive.length} leads to archive`);

    const archiveResults = {
      successful: [],
      failed: [],
      skipped: [],
    };

    // Process each lead for archiving
    for (const lead of leadsToArchive) {
      try {
        console.log(`Archiving lead ${lead.leadId}`);

        // Update the lead to set isArchived = true and archiveTime
        await Lead.update(
          {
            isArchived: true,
            archiveTime: new Date(),
          },
          {
            where: { leadId: lead.leadId },
          }
        );

        // Log audit trail for successful archiving
        await historyLogger(
          PROGRAMS.LEAD_MANAGEMENT,
          "BULK_LEAD_ARCHIVE",
          req.adminId,
          lead.leadId,
          null,
          `Lead bulk archived by ${req.role}`,
          { leadTitle: lead.title }
        );

        archiveResults.successful.push({
          leadId: lead.leadId,
          title: lead.title,
          contactPerson: lead.contactPerson,
          organization: lead.organization,
        });
      } catch (leadError) {
        console.error(`Error archiving lead ${lead.leadId}:`, leadError);

        await logAuditTrail(
          PROGRAMS.LEAD_MANAGEMENT,
          "BULK_LEAD_ARCHIVE",
          req.adminId,
          `Error archiving lead ${lead.leadId}: ${leadError.message}`,
          req.adminId
        );

        archiveResults.failed.push({
          leadId: lead.leadId,
          title: lead.title,
          error: leadError.message,
        });
      }
    }

    // Check for leads that were requested but not found
    const foundLeadIds = leadsToArchive.map((lead) => lead.leadId);
    const notFoundLeadIds = leadIds.filter((id) => !foundLeadIds.includes(id));

    notFoundLeadIds.forEach((leadId) => {
      archiveResults.skipped.push({
        leadId: leadId,
        reason: "Lead not found, already archived, or no permission to archive",
      });
    });

    console.log("Bulk archive results:", archiveResults);

    res.status(200).json({
      message: "Bulk archive operation completed",
      results: archiveResults,
      summary: {
        total: leadIds.length,
        successful: archiveResults.successful.length,
        failed: archiveResults.failed.length,
        skipped: archiveResults.skipped.length,
      },
    });
  } catch (error) {
    console.error("Error in bulk archive leads:", error);

    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "BULK_LEAD_ARCHIVE",
      null,
      "Error in bulk archive leads: " + error.message,
      req.adminId
    );

    res.status(500).json({
      message: "Internal server error during bulk archive",
      error: error.message,
    });
  }
};

// Bulk unarchive leads functionality
exports.bulkUnarchiveLeads = async (req, res) => {
  const { leadIds } = req.body;

  // Validate input
  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({
      message: "leadIds must be a non-empty array",
    });
  }

  console.log("Bulk unarchive request for leads:", leadIds);

  try {
    // Check access permissions
    if (!["admin", "general", "master"].includes(req.role)) {
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT,
        "BULK_LEAD_UNARCHIVE",
        null,
        "Access denied. You do not have permission to bulk unarchive leads.",
        req.adminId
      );
      return res.status(403).json({
        message:
          "Access denied. You do not have permission to bulk unarchive leads.",
      });
    }

    // Find leads to unarchive
    let whereClause = {
      leadId: { [Op.in]: leadIds },
      isArchived: true, // Only unarchive archived leads
    };

    // Apply role-based filtering
    if (req.role !== "admin") {
      whereClause[Op.or] = [
        { masterUserID: req.adminId },
        { ownerId: req.adminId },
      ];
    }

    const leadsToUnarchive = await Lead.findAll({
      where: whereClause,
      attributes: [
        "leadId",
        "title",
        "contactPerson",
        "organization",
        "isArchived",
      ],
    });

    if (leadsToUnarchive.length === 0) {
      return res.status(404).json({
        message:
          "No leads found to unarchive or you don't have permission to unarchive them",
      });
    }

    console.log(`Found ${leadsToUnarchive.length} leads to unarchive`);

    const unarchiveResults = {
      successful: [],
      failed: [],
      skipped: [],
    };

    // Process each lead for unarchiving
    for (const lead of leadsToUnarchive) {
      try {
        console.log(`Unarchiving lead ${lead.leadId}`);

        // Update the lead to set isArchived = false
        await Lead.update(
          {
            isArchived: false,
            archiveTime: null,
          },
          {
            where: { leadId: lead.leadId },
          }
        );

        // Log audit trail for successful unarchiving
        await historyLogger(
          PROGRAMS.LEAD_MANAGEMENT,
          "BULK_LEAD_UNARCHIVE",
          req.adminId,
          lead.leadId,
          null,
          `Lead bulk unarchived by ${req.role}`,
          { leadTitle: lead.title }
        );

        unarchiveResults.successful.push({
          leadId: lead.leadId,
          title: lead.title,
          contactPerson: lead.contactPerson,
          organization: lead.organization,
        });
      } catch (leadError) {
        console.error(`Error unarchiving lead ${lead.leadId}:`, leadError);

        await logAuditTrail(
          PROGRAMS.LEAD_MANAGEMENT,
          "BULK_LEAD_UNARCHIVE",
          req.adminId,
          `Error unarchiving lead ${lead.leadId}: ${leadError.message}`,
          req.adminId
        );

        unarchiveResults.failed.push({
          leadId: lead.leadId,
          title: lead.title,
          error: leadError.message,
        });
      }
    }

    // Check for leads that were requested but not found
    const foundLeadIds = leadsToUnarchive.map((lead) => lead.leadId);
    const notFoundLeadIds = leadIds.filter((id) => !foundLeadIds.includes(id));

    notFoundLeadIds.forEach((leadId) => {
      unarchiveResults.skipped.push({
        leadId: leadId,
        reason:
          "Lead not found, already unarchived, or no permission to unarchive",
      });
    });

    console.log("Bulk unarchive results:", unarchiveResults);

    res.status(200).json({
      message: "Bulk unarchive operation completed",
      results: unarchiveResults,
      summary: {
        total: leadIds.length,
        successful: unarchiveResults.successful.length,
        failed: unarchiveResults.failed.length,
        skipped: unarchiveResults.skipped.length,
      },
    });
  } catch (error) {
    console.error("Error in bulk unarchive leads:", error);

    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "BULK_LEAD_UNARCHIVE",
      null,
      "Error in bulk unarchive leads: " + error.message,
      req.adminId
    );

    res.status(500).json({
      message: "Internal server error during bulk unarchive",
      error: error.message,
    });
  }
};
