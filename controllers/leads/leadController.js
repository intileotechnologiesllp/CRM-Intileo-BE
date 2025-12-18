// const Lead = require("../../models/leads/leadsModel");
const LeadFilter = require("../../models/leads/leadFiltersModel");
//const LeadDetails = require("../../models/leads/leadDetailsModel"); // Import LeadDetails model
const { Op } = require("sequelize"); // Import Sequelize operators
const Sequelize = require("sequelize");
const sequelize = require("../../config/db"); // Import sequelize instance for transactions
const { logAuditTrail } = require("../../utils/auditTrailLogger"); // Import the audit trail logger
const PROGRAMS = require("../../utils/programConstants"); // Import program constants
const historyLogger = require("../../utils/historyLogger").logHistory; // Import history logger
const MasterUser = require("../../models/master/masterUserModel"); // Adjust path as needed
const NotificationTriggers = require("../../services/notification/notificationTriggers"); // 🔔 Notification triggers
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
const DealDetails = require("../../models/deals/dealsDetailModel"); // Import DealDetails model
const DealNote = require("../../models/deals/delasNoteModel"); // Import DealNote model
const CustomField = require("../../models/customFieldModel");
const CustomFieldValue = require("../../models/customFieldValueModel");
const Label = require("../../models/admin/masters/labelModel"); // Import Label model
const UserFavorites = require("../../models/favorites/userFavoritesModel"); // Import UserFavorites model
const {
  VisibilityGroup,
  GroupMembership,
  ItemVisibilityRule,
} = require("../../models/admin/visibilityAssociations");

const { sendEmail } = require("../../utils/emailSend");

// Import Excel/CSV handling utilities
const XLSX = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const GroupVisibility = require("../../models/admin/groupVisibilityModel");

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, '../../uploads/excel_imports/'),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only Excel and CSV files
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/csv'
    ];
    
    if (allowedTypes.includes(file.mimetype) || 
        file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'), false);
    }
  }
});

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
  // If this lead is being created as a conversion from a deal, update all emails with this leadId to also set the dealId
  // (This is a defensive addition in case you ever support lead creation from a deal conversion)
  if (req.body.dealId) {
    try {
      const updated = await Email.update(
        { dealId: req.body.dealId },
        { where: { leadId: req.body.leadId } }
      );
      console.log(`[LEAD->DEAL] Updated ${updated[0]} emails to set dealId=${req.body.dealId} for leadId=${req.body.leadId}`);
    } catch (err) {
      console.error(`[LEAD->DEAL] Error updating emails for leadId=${req.body.leadId}:`, err);
    }
  }
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
    // Activity ID to link existing activity (similar to emailID)
    activityId,
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

  console.log("Request body sourceOrgin:", sourceOrgin);

  // Log emailID only when it's relevant (sourceOrgin is 0)
  if (sourceOrgin === 0 || sourceOrgin === "0") {
    console.log("Request body email ID:", req.body.emailID);
  }

  // Note: Removed email uniqueness check to allow multiple leads per contact person
  // Each contact can have multiple projects/leads with different titles

  // Check for duplicate combination of contactPerson, organization, AND title (allow multiple projects per contact)
  // Only check duplicates if all three fields have values
  if (contactPerson && organization && title) {
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
  }

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

    // 1. Find or create Organization (only if organization is provided)
    let orgRecord = null;
    if (organization && organization.trim() !== "") {
      orgRecord = await Organization.findOne({ where: { organization } });
      if (!orgRecord) {
        orgRecord = await Organization.create({
          organization,
          masterUserID: req.adminId,
        });
      }
    }
    console.log(
      "orgRecord after create/find:",
      orgRecord?.organizationId,
      orgRecord?.organization
    );

    // Defensive: If organization was provided but failed to create/find, stop!
    if (organization && organization.trim() !== "" && (!orgRecord || !orgRecord.leadOrganizationId)) {
      return res
        .status(500)
        .json({ message: "Failed to create/find organization." });
    }
    
    // 2. Find or create Person (linked to organization if available)
    let personRecord = null;
    if (email && email.trim() !== "") {
      personRecord = await Person.findOne({ where: { email } });
    }
    if (!personRecord && (email && email.trim() !== "")) {
      personRecord = await Person.create({
        contactPerson,
        email,
        phone,
        leadOrganizationId: orgRecord ? orgRecord.leadOrganizationId : null,
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
      personId: personRecord ? personRecord.personId : null,
      leadOrganizationId: orgRecord ? orgRecord.leadOrganizationId : null,
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
      groupId: req.body.groupId || null,
      visibleGroup: req.body.visibleGroup || null,
    });

    // 🔔 Send Notification - Lead Created
    console.log('🔔 ========== NOTIFICATION DEBUG START ==========');
    console.log('🔔 Lead created successfully:', {
      leadId: lead.leadId,
      ownerId: lead.ownerId,
      title: lead.title,
      masterUserID: lead.masterUserID
    });
    
    try {
      console.log('🔔 Step 1: Fetching creator details for req.adminId:', req.adminId);
      
      // Get creator details for notification
      const creator = await MasterUser.findByPk(req.adminId, {
        attributes: ['masterUserID', 'name']
      });
      
      console.log('🔔 Step 2: Creator found:', creator ? {
        masterUserID: creator.masterUserID,
        name: creator.name
      } : 'NULL - Creator not found!');
      
      const leadObject = {
        leadId: lead.leadId,
        ownerId: lead.ownerId,
        leadTitle: lead.title
      };
      
      const creatorObject = {
        userId: req.adminId,
        name: creator ? creator.name : 'Unknown User'
      };
      
      console.log('🔔 Step 3: Calling NotificationTriggers.leadCreated with:', {
        leadObject,
        creatorObject
      });
      
      await NotificationTriggers.leadCreated(leadObject, creatorObject);
      
      console.log('🔔 Step 4: Notification trigger completed successfully! ✅');
    } catch (notifError) {
      console.error('🔔 ❌ NOTIFICATION ERROR:', notifError);
      console.error('🔔 Error name:', notifError.name);
      console.error('🔔 Error message:', notifError.message);
      console.error('🔔 Error stack:', notifError.stack);
    }
    
    console.log('🔔 ========== NOTIFICATION DEBUG END ==========');

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
        const responsiblePerson = await MasterUser.findOne({
      where: { masterUserID: req.adminId },
    });
    const responsiblePersonName = responsiblePerson ? responsiblePerson.name : null;
    await LeadDetails.create({
      leadId: lead.leadId,
      responsiblePerson: responsiblePersonName,
      sourceOrgin: sourceOrgin,
    });

    // Link activity to lead if activityId is provided (similar to emailID linking)
    if (activityId) {
      try {
        console.log(`Linking activity ${activityId} to lead ${lead.leadId}`);
        const activityUpdateResult = await Activity.update(
          { leadId: lead.leadId },
          { where: { activityId: activityId } }
        );
        console.log(`Activity link result: ${activityUpdateResult[0]} rows updated`);

        if (activityUpdateResult[0] === 0) {
          console.warn(`No activity found with activityId: ${activityId}`);
        } else {
          // Log the activity linking in history
          await historyLogger(
            PROGRAMS.LEAD_MANAGEMENT,
            "ACTIVITY_LINKING",
            req.adminId,
            activityId,
            req.adminId,
            `Activity ${activityId} linked to lead ${lead.leadId} by ${req.role}`,
            {
              leadId: lead.leadId,
              activityId: activityId,
            }
          );
        }
      } catch (activityError) {
        console.error("Error linking activity to lead:", activityError);
        // Don't fail the lead creation, just log the error
      }
    }

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

    const response = {
      message: activityId 
        ? "Lead created and linked to activity successfully" 
        : "Lead created successfully",
      lead: leadResponse,
      customFieldsSaved: Object.keys(savedCustomFields).length,
    };

    // Add activity information to response if activity was linked
    if (activityId) {
      response.activityLinked = true;
      response.linkedActivityId = activityId;
    } else {
      response.activityLinked = false;
    }

    res.status(201).json(response);
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
    limit = 300,
    sortBy = "createdAt",
    order = "DESC",
    masterUserID: queryMasterUserID,
    favoriteId, // Add favoriteId parameter for filtering by favorite user
    favoriteFilterId, // Add favoriteFilterId parameter for applying favorite filters
    filterId,
    labels, // Add labels parameter for filtering by labels
    groupId
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

    // Handle favoriteId parameter - convert to masterUserID
    let effectiveMasterUserID = queryMasterUserID;
    
    if (favoriteId) {
      console.log("→ favoriteId parameter received:", favoriteId);
      
      // Look up the favorite record to get the favoriteUserId
      const favoriteRecord = await UserFavorites.findOne({
        where: {
          favoriteId: favoriteId,
          userId: req.adminId, // Only allow users to use their own favorites
          isActive: true
        }
      });
      
      if (favoriteRecord) {
        effectiveMasterUserID = favoriteRecord.favoriteUserId;
        console.log("→ Found favorite record, using favoriteUserId as masterUserID:", effectiveMasterUserID);
        
        // Get favorite user details for logging
        const favoriteUser = await MasterUser.findByPk(favoriteRecord.favoriteUserId, {
          attributes: ['masterUserID', 'name']
        });
        
        if (favoriteUser) {
          console.log("→ Fetching leads for favorite user:", favoriteUser.name, "(ID:", favoriteUser.masterUserID, ")");
        }
      } else {
        console.log("→ Favorite record not found or not accessible");
        return res.status(404).json({
          message: "Favorite not found or you don't have access to it."
        });
      }
    }

    // Handle favoriteFilterId parameter - convert to filterId
    let effectiveFilterId = filterId;
    
    if (favoriteFilterId) {
      console.log("→ favoriteFilterId parameter received:", favoriteFilterId);
      
      // Look up the favorite filter (filter with isFavorite = true and matching filterId)
      const favoriteFilter = await LeadFilter.findOne({
        where: {
          filterId: favoriteFilterId,
          isFavorite: true,
          [Op.or]: [
            { masterUserID: req.adminId }, // User's own filter
            { visibility: 'Public' }       // Public filter
          ]
        }
      });
      
      if (favoriteFilter) {
        effectiveFilterId = favoriteFilter.filterId;
        console.log("→ Found favorite filter, using filterId:", effectiveFilterId);
        console.log("→ Applying favorite filter:", favoriteFilter.filterName, "(ID:", favoriteFilter.filterId, ")");
      } else {
        console.log("→ Favorite filter not found or not accessible");
        return res.status(404).json({
          message: "Favorite filter not found or you don't have access to it."
        });
      }
    }

    // Determine masterUserID based on role

    const pref = await LeadColumnPreference.findOne();

    let leadAttributes, leadDetailsAttributes, checkedColumnKeys = [];
    if (pref && pref.columns) {
      // Parse columns if it's a string
      const columns =
        typeof pref.columns === "string"
          ? JSON.parse(pref.columns)
          : pref.columns;

      const leadFields = Object.keys(Lead.rawAttributes);
      const leadDetailsFields = Object.keys(LeadDetails.rawAttributes);

      // Get checked columns based on preferences
      const checkedColumns = columns.filter((col) => col.check);
      checkedColumnKeys = checkedColumns.map((col) => col.key);
      
      leadAttributes = checkedColumns
        .filter((col) => leadFields.includes(col.key))
        .map((col) => col.key);
        
      // Always include leadId
      if (!leadAttributes.includes("leadId")) {
        leadAttributes.unshift("leadId");
      }
      // if (!leadAttributes.includes("valueCurrency")) {
      //   leadAttributes.unshift("valueCurrency");
      // }
      // Always include the sortBy field for ordering
      if (!leadAttributes.includes(sortBy)) {
        leadAttributes.push(sortBy);
      }
      
      // Only include currency fields if they are checked in preferences
      // (Remove the forced inclusion of currency fields)
      
      // Always include relationship fields for proper data joining
      if (!leadAttributes.includes('leadOrganizationId')) {
        leadAttributes.push('leadOrganizationId');
      }
      if (!leadAttributes.includes('personId')) {
        leadAttributes.push('personId');
      }
      // Always include ownership fields
      if (!leadAttributes.includes('ownerId')) {
        leadAttributes.push('ownerId');
      }
      if (!leadAttributes.includes('masterUserID')) {
        leadAttributes.push('masterUserID');
      }
      // Always include valueLabels for label functionality
      if (!leadAttributes.includes('valueLabels')) {
        leadAttributes.push('valueLabels');
      }

      leadDetailsAttributes = columns
        .filter((col) => col.check && leadDetailsFields.includes(col.key) && !col.isCustomField)
        .map((col) => col.key);
    }
    
    // Debug: Check if currency fields are included
    if (leadAttributes) {
      const currencyFields = leadAttributes.filter(attr => 
        attr.includes('Currency') || attr.includes('currency')
      );
    }

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
    // Always include LeadDetails but only fetch checked attributes if preferences exist
    if (leadDetailsAttributes && leadDetailsAttributes.length > 0) {
      // Ensure currency field is included if it exists in LeadDetails
      if (!leadDetailsAttributes.includes("currency") && Object.keys(LeadDetails.rawAttributes).includes("currency")) {
        leadDetailsAttributes.push("currency");
      }
      include.push({
        model: LeadDetails,
        as: "details",
        required: false,
        attributes: leadDetailsAttributes,
      });
    } else if (pref && pref.columns) {
      // If preferences exist but no LeadDetails columns are checked, include minimal LeadDetails with currency
      const minimalAttributes = ['leadDetailsId'];
      if (Object.keys(LeadDetails.rawAttributes).includes("currency")) {
        minimalAttributes.push("currency");
      }
      include.push({
        model: LeadDetails,
        as: "details",
        required: false,
        attributes: minimalAttributes
      });
    } else {
      // If no preferences, include all LeadDetails
      include.push({
        model: LeadDetails,
        as: "details",
        required: false,
      });
    }

    // Handle masterUserID filtering based on role and query parameters
    if (req.role === "admin") {
      // Admin can filter by specific masterUserID or see all leads
      if (effectiveMasterUserID && effectiveMasterUserID !== "all") {
        whereClause[Op.or] = [
          { masterUserID: effectiveMasterUserID },
          { ownerId: effectiveMasterUserID },
        ];
      }
      // If effectiveMasterUserID is "all" or not provided, admin sees all leads (no additional filter)
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
      if (effectiveMasterUserID && effectiveMasterUserID !== "all") {
        // Non-admin can only filter within their visible scope
        const userId = effectiveMasterUserID;
        whereClause[Op.and] = whereClause[Op.and] || [];
        whereClause[Op.and].push({
          [Op.or]: [{ masterUserID: userId }, { ownerId: userId }],
        });
      }
    }

    // console.log("→ Query params:", req.query);
    // console.log("→ queryMasterUserID:", queryMasterUserID);
    // console.log("→ favoriteId:", favoriteId);
    // console.log("→ favoriteFilterId:", favoriteFilterId);
    // console.log("→ effectiveMasterUserID:", effectiveMasterUserID);
    // console.log("→ effectiveFilterId:", effectiveFilterId);
    // console.log("→ req.adminId:", req.adminId);
    // console.log("→ req.role:", req.role);

    //................................................................//filter
    if (effectiveFilterId) {
      // console.log("Processing filter with effectiveFilterId:", effectiveFilterId);

      // Fetch the saved filter
      const filter = await LeadFilter.findByPk(effectiveFilterId);
      if (!filter) {
        return res.status(404).json({ message: "Filter not found." });
      }

      // console.log("Found filter:", filter.filterName);

      const filterConfig =
        typeof filter.filterConfig === "string"
          ? JSON.parse(filter.filterConfig)
          : filter.filterConfig;

      // console.log("Filter config:", JSON.stringify(filterConfig, null, 2));

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

      // console.log("Available lead fields:", leadFields);
      // console.log("Available leadDetails fields:", leadDetailsFields);
      // console.log("Available person fields:", personFields);
      // console.log("Available organization fields:", organizationFields);
      // console.log("Available activity fields:", activityFields);

      // --- Your new filter logic for all ---
      if (all.length > 0) {
        // console.log("Processing 'all' conditions:", all);

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
        if (effectiveMasterUserID && effectiveMasterUserID !== "all") {
          if (filterWhere[Op.or]) {
            // If there's already an Op.or condition from filters, we need to combine properly
            filterWhere[Op.and] = [
              { [Op.or]: filterWhere[Op.or] },
              {
                [Op.or]: [
                  { masterUserID: effectiveMasterUserID },
                  { ownerId: effectiveMasterUserID },
                ],
              },
            ];
            delete filterWhere[Op.or];
          } else {
            filterWhere[Op.or] = [
              { masterUserID: effectiveMasterUserID },
              { ownerId: effectiveMasterUserID },
            ];
          }
        }
      } else {
        // Non-admin users: filter by their own leads or specific user if provided
        const userId =
          effectiveMasterUserID && effectiveMasterUserID !== "all"
            ? effectiveMasterUserID
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

      // Handle label filtering in filtered queries too
      if (labels) {
        // console.log("→ Labels parameter received in filtered query:", labels);
        
        // Parse labels - could be comma-separated string or array
        let labelArray;
        if (typeof labels === 'string') {
          labelArray = labels.split(',').map(label => label.trim()).filter(label => label);
        } else if (Array.isArray(labels)) {
          labelArray = labels.filter(label => label && label.trim());
        } else {
          labelArray = [];
        }
        
        // console.log("→ Parsed label array in filtered query:", labelArray);
        
        if (labelArray.length > 0) {
          // console.log("→ Searching for labels in filtered query:", labelArray);
          
          // Since valueLabels contains label names directly, we can filter by names
          // But let's also check if labels exist in the Label table for validation
          const validLabels = await Label.findAll({
            where: {
              labelName: { [Op.in]: labelArray },
              isActive: true
            },
            attributes: ['labelId', 'labelName'],
            raw: true
          });
          
          // console.log("→ Found labels in database for filtered query:", validLabels);
          
          // Use the provided label names for filtering (regardless of Label table)
          // since the valueLabels column stores names directly
          // console.log("→ Filtering by label names directly from valueLabels column in filtered query");
          
          // Create OR conditions for each label name with proper LIKE patterns
          const labelOrConditions = [];
          labelArray.forEach(labelName => {
            // Handle different formats: "Hot", "Hot,Warm", "Warm,Hot,Cold", etc.
            labelOrConditions.push(
              { valueLabels: { [Op.like]: `%,${labelName},%` } }, // Label in middle with commas
              { valueLabels: { [Op.like]: `${labelName},%` } },   // Label at start with comma
              { valueLabels: { [Op.like]: `%,${labelName}` } },   // Label at end with comma
              { valueLabels: { [Op.eq]: `${labelName}` } },       // Only this label (exact match)
              // Additional patterns for potential spacing issues
              { valueLabels: { [Op.like]: `%, ${labelName},%` } }, // Space after comma
              { valueLabels: { [Op.like]: `%,${labelName} ,%` } }, // Space before comma
              { valueLabels: { [Op.like]: `${labelName} ,%` } },   // Space at start before comma
              { valueLabels: { [Op.like]: `%, ${labelName}` } }    // Space at end after comma
            );
          });
          
          // console.log("→ Label OR conditions for filtered query:", labelOrConditions);
          
          // Combine with existing where conditions more carefully
          if (whereClause[Op.and]) {
            // If we already have AND conditions, add label filter as another AND condition
            whereClause[Op.and].push({
              [Op.or]: labelOrConditions
            });
          } else if (whereClause[Op.or]) {
            // If we have existing OR conditions, combine them properly
            whereClause[Op.and] = [
              { [Op.or]: whereClause[Op.or] },
              { [Op.or]: labelOrConditions }
            ];
            delete whereClause[Op.or];
          } else {
            // No existing conditions, just add the label filter
            whereClause[Op.or] = labelOrConditions;
          }
          
          // console.log("→ Label filtering applied successfully using label names in filtered query");
        } else {
          // console.log("→ No valid label names provided in filtered query, no filtering applied");
        }
      }

      // console.log("→ Built filterWhere:", JSON.stringify(filterWhere));
      // console.log(
      //   "→ Built leadDetailsWhere:",
      //   JSON.stringify(leadDetailsWhere)
      // );
      // console.log("→ Built personWhere:", JSON.stringify(personWhere));
      // console.log(
      //   "→ Built organizationWhere:",
      //   JSON.stringify(organizationWhere)
      // );
      // console.log("→ Built activityWhere:", activityWhere);
      // console.log(
      //   "→ Activity where object keys length:",
      //   Object.keys(activityWhere).length
      // );
      // console.log(
      //   "→ Activity where object symbols length:",
      //   Object.getOwnPropertySymbols(activityWhere).length
      // );
      // console.log(
      //   "→ All activity where properties:",
      //   Object.getOwnPropertyNames(activityWhere).concat(
      //     Object.getOwnPropertySymbols(activityWhere)
      //   )
      // );

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
        // console.log("→ Activity filtering will be applied:");
        if (activityWhere[Op.and]) {
          // console.log(
          //   "  - AND conditions count:",
          //   activityWhere[Op.and].length
          // );
        }
        if (activityWhere[Op.or]) {
          // console.log("  - OR conditions count:", activityWhere[Op.or].length);
        }

        // Quick database check for debugging
        try {
          const totalActivities = await Activity.count();
          // console.log("→ Total activities in database:", totalActivities);

          const activitiesWithType = await Activity.count({
            where: { type: "Meeting" },
          });
          // console.log("→ Activities with type='Meeting':", activitiesWithType);

          const activitiesWithLeads = await Activity.count({
            where: { leadId: { [Op.not]: null } },
          });
          // console.log("→ Activities linked to leads:", activitiesWithLeads);

          const leadsWithActivities = await Lead.count({
            include: [
              {
                model: Activity,
                as: "Activities",
                required: true,
              },
            ],
          });
          // console.log("→ Leads that have activities:", leadsWithActivities);
        } catch (debugError) {
          // console.log("→ Debug query error:", debugError.message);
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
        // console.log("→ Person filtering will be applied:");
        if (personWhere[Op.and]) {
          // console.log("  - AND conditions count:", personWhere[Op.and].length);
        }
        if (personWhere[Op.or]) {
          // console.log("  - OR conditions count:", personWhere[Op.or].length);
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
        // console.log("→ Organization filtering will be applied:");
        if (organizationWhere[Op.and]) {
          // console.log(
          //   "  - AND conditions count:",
          //   organizationWhere[Op.and].length
          // );
        }
        if (organizationWhere[Op.or]) {
          // console.log(
          //   "  - OR conditions count:",
          //   organizationWhere[Op.or].length
          // );
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
        // console.log("==========================================");
        // console.log("🔥 ACTIVITY FILTERING DETECTED!");
        // console.log(
        //   "🔥 Activity where clause:",
        //   JSON.stringify(activityWhere, null, 2)
        // );
        // console.log("🔥 Activity where keys:", Object.keys(activityWhere));
        // console.log(
        //   "🔥 Activity where symbols:",
        //   Object.getOwnPropertySymbols(activityWhere)
        // );

        // Debug: Show the actual condition structure
        if (activityWhere[Op.and]) {
          // console.log("🔥 AND conditions details:", activityWhere[Op.and]);
          activityWhere[Op.and].forEach((condition, index) => {
            // console.log(
            //   `🔥 Condition ${index}:`,
            //   JSON.stringify(condition, null, 2)
            // );
            // console.log(`🔥 Condition ${index} keys:`, Object.keys(condition));
            // console.log(
            //   `🔥 Condition ${index} symbols:`,
            //   Object.getOwnPropertySymbols(condition)
            // );

            // Check each field in the condition
            Object.keys(condition).forEach((field) => {
              // console.log(`🔥 Field '${field}' value:`, condition[field]);
              // console.log(
              //   `🔥 Field '${field}' symbols:`,
              //   Object.getOwnPropertySymbols(condition[field])
              // );

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
        // console.log("==========================================");

        // NEW APPROACH: Rebuild the activity condition from scratch to avoid Symbol loss
        // console.log("🔧 REBUILDING ACTIVITY CONDITIONS FROM SCRATCH...");

        // Find the activity conditions from the filter config and rebuild them
        let rebuiltActivityWhere = null;

        if (activityWhere[Op.and] && activityWhere[Op.and].length > 0) {
          const conditions = [];

          activityWhere[Op.and].forEach((condition, index) => {
            // console.log(`🔧 Rebuilding condition ${index}:`, condition);

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
                  // console.log(`🔧 Rebuilt condition:`, rebuiltCondition);
                  // console.log(
                  //   `🔧 Rebuilt condition symbols:`,
                  //   Object.getOwnPropertySymbols(rebuiltCondition[fieldName])
                  // );
                  conditions.push(rebuiltCondition);
                }
                // Add other operators as needed (Op.ne, Op.like, etc.)
              });
            });
          });

          if (conditions.length > 0) {
            rebuiltActivityWhere = { [Op.and]: conditions };
            // console.log("� REBUILT ACTIVITY WHERE:", rebuiltActivityWhere);
            // console.log(
            //   "� Rebuilt symbols:",
            //   Object.getOwnPropertySymbols(rebuiltActivityWhere)
            // );

            if (rebuiltActivityWhere[Op.and]) {
              // console.log(
              //   "� Rebuilt AND conditions:",
              //   rebuiltActivityWhere[Op.and]
              // );
              rebuiltActivityWhere[Op.and].forEach((condition, index) => {
                // console.log(`� Rebuilt condition ${index}:`, condition);
                Object.keys(condition).forEach((field) => {
                  // console.log(
                  //   `🔧 Field '${field}' symbols:`,
                  //   Object.getOwnPropertySymbols(condition[field])
                  // );
                  Object.getOwnPropertySymbols(condition[field]).forEach(
                    (symbol) => {
                      // console.log(
                      //   `� Rebuilt field '${field}' symbol ${symbol.toString()} = ${
                      //     condition[field][symbol]
                      //   }`
                      // );
                    }
                  );
                });
              });
            }
          }
        }

        // Use the rebuilt condition if available, otherwise try direct approach
        const finalActivityWhere = rebuiltActivityWhere || { type: "Meeting" };

        // console.log("🔧 FINAL ACTIVITY WHERE CONDITION:", finalActivityWhere);
        // console.log(
        //   "🔧 Final condition symbols:",
        //   Object.getOwnPropertySymbols(finalActivityWhere)
        // );

        include.push({
          model: Activity,
          as: "Activities",
          required: true,
          where: finalActivityWhere,
        });

        // console.log("🔥 ACTIVITY FILTERING APPLIED WITH REBUILT CONDITIONS");
        // console.log(
        //   "🔥 This should now generate SQL: INNER JOIN activities ON activities.leadId = leads.leadId WHERE activities.type = 'Meeting'"
        // );

        // FINAL DEBUG: Check what's actually in the include array
        const finalActivityInclude = include[include.length - 1];
        // console.log("🔍 FINAL ACTIVITY INCLUDE IN ARRAY:");
        // console.log("🔍 Model:", finalActivityInclude.model.name);
        // console.log("🔍 As:", finalActivityInclude.as);
        // console.log("🔍 Required:", finalActivityInclude.required);
        // console.log("🔍 Where clause:", finalActivityInclude.where);
        // console.log(
        //   "🔍 Where keys:",
        //   Object.keys(finalActivityInclude.where || {})
        // );
        // console.log(
        //   "🔍 Where symbols:",
        //   Object.getOwnPropertySymbols(finalActivityInclude.where || {})
        // );

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

        // console.log("==========================================");
      } else {
        // console.log("==========================================");
        // console.log(
        //   "🔵 NO ACTIVITY FILTERING - ADDING DEFAULT ACTIVITY INCLUDE"
        // );
        // console.log("==========================================");
        include.push({
          model: Activity,
          as: "Activities",
          required: false,
        });
      }

      // console.log(
      //   "→ Updated include with LeadDetails where:",
      //   JSON.stringify(leadDetailsWhere)
      // );

      // Handle custom field filtering
      if (
        customFieldsConditions.all.length > 0 ||
        customFieldsConditions.any.length > 0
      ) {
        // console.log(
        //   "Processing custom field conditions:",
        //   customFieldsConditions
        // );

        // Debug: Show all custom fields in the database
        const allCustomFields = await CustomField.findAll({
          where: {
            // Removed masterUserID restriction - show all custom fields
            [Op.or]: [
              { fieldSource: "default" },
              { fieldSource: "system" },
              { fieldSource: "custom" },
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

        // console.log(
        //   "All custom fields in database:",
        //   allCustomFields.map((f) => ({
        //     fieldId: f.fieldId,
        //     fieldName: f.fieldName,
        //     entityType: f.entityType,
        //     fieldSource: f.fieldSource,
        //     isActive: f.isActive,
        //   }))
        // );

        const customFieldFilters = await buildCustomFieldFilters(
          customFieldsConditions,
          req.adminId
        );

        // console.log("Built custom field filters:", customFieldFilters);

        if (customFieldFilters.length > 0) {
          // Apply custom field filtering by finding leads that match the custom field conditions
          const matchingLeadIds = await getLeadIdsByCustomFieldFilters(
            customFieldFilters,
            req.adminId
          );

          // console.log(
          //   "Matching lead IDs from custom field filtering:",
          //   matchingLeadIds
          // );

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
            // console.log("No matching leads found, setting empty result");
            filterWhere.leadId = { [Op.in]: [] };
          }
        } else {
          // console.log(
          //   "No custom field filters found, possibly field not found"
          // );
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
        // console.log(
        //   "→ Search applied, whereClause[Op.or]:",
        //   whereClause[Op.or]
        // );
      }

      // Handle label filtering
      if (labels) {
        // console.log("→ Labels parameter received:", labels);
        
        // Parse labels - could be comma-separated string or array
        let labelArray;
        if (typeof labels === 'string') {
          labelArray = labels.split(',').map(label => label.trim()).filter(label => label);
        } else if (Array.isArray(labels)) {
          labelArray = labels.filter(label => label && label.trim());
        } else {
          labelArray = [];
        }
        
        // console.log("→ Parsed label array:", labelArray);
        
        if (labelArray.length > 0) {
          // console.log("→ Searching for labels:", labelArray);
          
          // Since valueLabels contains label names directly, we can filter by names
          // But let's also check if labels exist in the Label table for validation
          const validLabels = await Label.findAll({
            where: {
              labelName: { [Op.in]: labelArray },
              isActive: true
            },
            attributes: ['labelId', 'labelName'],
            raw: true
          });
          
          // console.log("→ Found labels in database:", validLabels);
          
          // Use the provided label names for filtering (regardless of Label table)
          // since the valueLabels column stores names directly
          // console.log("→ Filtering by label names directly from valueLabels column");
          
          // Create OR conditions for each label name with proper LIKE patterns
          const labelOrConditions = [];
          labelArray.forEach(labelName => {
            // Handle different formats: "Hot", "Hot,Warm", "Warm,Hot,Cold", etc.
            labelOrConditions.push(
              { valueLabels: { [Op.like]: `%,${labelName},%` } }, // Label in middle with commas
              { valueLabels: { [Op.like]: `${labelName},%` } },   // Label at start with comma
              { valueLabels: { [Op.like]: `%,${labelName}` } },   // Label at end with comma
              { valueLabels: { [Op.eq]: `${labelName}` } },       // Only this label (exact match)
              // Additional patterns for potential spacing issues
              { valueLabels: { [Op.like]: `%, ${labelName},%` } }, // Space after comma
              { valueLabels: { [Op.like]: `%,${labelName} ,%` } }, // Space before comma
              { valueLabels: { [Op.like]: `${labelName} ,%` } },   // Space at start before comma
              { valueLabels: { [Op.like]: `%, ${labelName}` } }    // Space at end after comma
            );
          });
          
          // console.log("→ Label OR conditions:", labelOrConditions);
          
          // Combine with existing where conditions more carefully
          if (whereClause[Op.and]) {
            // If we already have AND conditions, add label filter as another AND condition
            whereClause[Op.and].push({
              [Op.or]: labelOrConditions
            });
          } else if (whereClause[Op.or]) {
            // If we have existing OR conditions (like search), combine them properly
            whereClause[Op.and] = [
              { [Op.or]: whereClause[Op.or] },
              { [Op.or]: labelOrConditions }
            ];
            delete whereClause[Op.or];
          } else {
            // No existing conditions, just add the label filter
            whereClause[Op.or] = labelOrConditions;
          }
          
          // console.log("→ Label filtering applied successfully using label names");
        } else {
          // console.log("→ No valid label names provided, no filtering applied");
        }
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
    // console.log("→ Final whereClause:", JSON.stringify(whereClause));
    // console.log("→ Final include:", JSON.stringify(include));
    // console.log("→ Pagination: limit =", limit, "offset =", offset);
    // console.log("→ Order:", sortBy, order);
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
    // console.log("🔍 Applied dealId = null (excluding converted leads)");

    // console.log("==========================================");
    // console.log("🚀 FINAL QUERY EXECUTION STARTING");
    // console.log("🚀 Total include array length:", include.length);

    // Check if Activity filtering is active
    // console.log("🚀 Activity include details:");
    const activityInclude = include.find((i) => i.as === "Activities");
    if (activityInclude) {
      // console.log("  🎯 Activity include found:");
      // console.log("    - Required:", activityInclude.required);
      // console.log("    - Has where clause:", !!activityInclude.where);
      if (activityInclude.where) {
        console.log(
          "    - Where clause:",
          JSON.stringify(activityInclude.where)
        );
      }
    } else {
      // console.log("  ❌ NO Activity include found!");
    }

    // Check if Person filtering is active
    console.log("🚀 Person include details:");
    const personInclude = include.find((i) => i.as === "LeadPerson");
    if (personInclude) {
      // console.log("  👤 Person include found:");
      // console.log("    - Required:", personInclude.required);
      // console.log("    - Has where clause:", !!personInclude.where);
      if (personInclude.where) {
        // console.log("    - Where clause:", JSON.stringify(personInclude.where));
      }
    } else {
      // console.log("  ❌ NO Person include found!");
    }

    // Check if Organization filtering is active
    // console.log("🚀 Organization include details:");
    const organizationInclude = include.find(
      (i) => i.as === "LeadOrganization"
    );
    if (organizationInclude) {
      // console.log("  🏢 Organization include found:");
      // console.log("    - Required:", organizationInclude.required);
      // console.log("    - Has where clause:", !!organizationInclude.where);
      if (organizationInclude.where) {
        console.log(
          "    - Where clause:",
          JSON.stringify(organizationInclude.where)
        );
      }
    } else {
      // console.log("  ❌ NO Organization include found!");
    }
    // console.log("==========================================");

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

    // console.log("==========================================");
    // console.log("🎉 QUERY EXECUTED SUCCESSFULLY!");
    // console.log("🎉 Total records found:", leads.count);

    // Debug Activity filtering results
    if (filterId && activityInclude && activityInclude.required) {
      // console.log("🎯 ACTIVITY FILTER RESULTS:");
      // console.log("  - Leads found with Activity filter:", leads.count);
      if (leads.rows.length > 0) {
        // console.log(
        //   "  - First lead activities:",
        //   leads.rows[0].Activities
        //     ? leads.rows[0].Activities.length
        //     : "No Activities"
        // );
        if (leads.rows[0].Activities && leads.rows[0].Activities.length > 0) {
          // console.log(
          //   "  - First activity type:",
          //   leads.rows[0].Activities[0].type
          // );
        }
      }
    }

    // Debug Person filtering results
    if (filterId && hasPersonFiltering) {
      // console.log("👤 PERSON FILTER RESULTS:");
      // console.log("  - Leads found with Person filter:", leads.count);
      if (leads.rows.length > 0) {
        // console.log(
        //   "  - First lead person:",
        //   leads.rows[0].LeadPerson
        //     ? leads.rows[0].LeadPerson.firstName +
        //         " " +
        //         leads.rows[0].LeadPerson.lastName
        //     : "No Person"
        // );
      }
    }

    // Debug Organization filtering results
    if (filterId && hasOrganizationFiltering) {
      // console.log("🏢 ORGANIZATION FILTER RESULTS:");
      // console.log("  - Leads found with Organization filter:", leads.count);
      if (leads.rows.length > 0) {
        // console.log(
        //   "  - First lead organization:",
        //   leads.rows[0].LeadOrganization
        //     ? leads.rows[0].LeadOrganization.organizationName
        //     : "No Organization"
        // );
      }
    }
    // console.log("==========================================");

    // Get custom field values for leads (only for checked custom fields from column preferences)
    const leadIds = leads.rows.map((lead) => lead.leadId);
    
    // Get checked custom field names from column preferences
    let checkedCustomFieldNames = [];
    if (pref && pref.columns) {
      const columns = typeof pref.columns === "string" ? JSON.parse(pref.columns) : pref.columns;
      
      // Get all checked column keys
      const checkedColumnKeys = columns
        .filter((col) => col.check === true)
        .map((col) => col.key);
      
      // Filter out standard Lead and LeadDetails fields to get only custom field names
      const leadFields = Object.keys(Lead.rawAttributes);
      const leadDetailsFields = Object.keys(LeadDetails.rawAttributes);
      const standardFields = [...leadFields, ...leadDetailsFields];
      
      // Filter for custom fields - either not in standard fields OR explicitly marked as custom field
      checkedCustomFieldNames = checkedColumnKeys.filter(key => {
        const column = columns.find(col => col.key === key);
        return !standardFields.includes(key) || (column && column.isCustomField);
      });
      
      // console.log("🔍 === DEBUGGING 'source' CUSTOM FIELD ===");
      // console.log("🔍 All checked column keys:", checkedColumnKeys);
      // console.log("🔍 'source' in checked column keys:", checkedColumnKeys.includes('source'));
      // console.log("🔍 Checked custom field names from preferences:", checkedCustomFieldNames);
      // console.log("🔍 'source' in checked custom field names:", checkedCustomFieldNames.includes('source'));
      
      // Check specifically for 'source' column in preferences
      const sourceColumn = columns.find(col => col.key === 'source');
      if (sourceColumn) {
        // console.log("✅ 'source' column found in preferences:", sourceColumn);
      } else {
        // console.log("❌ 'source' column NOT found in column preferences");
      }
    }
    
    let customFieldValues = [];
    if (checkedCustomFieldNames.length > 0) {
      customFieldValues = await CustomFieldValue.findAll({
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
              fieldName: { [Op.in]: checkedCustomFieldNames }, // Only include checked custom fields
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
      
      // console.log("🔍 Custom field values fetched:", customFieldValues.length);
      
      // Check specifically for 'source' field values
      const sourceValues = customFieldValues.filter(val => val.CustomField?.fieldName === 'source');
      // console.log("🔍 'source' field values found:", sourceValues.length);
      
      if (sourceValues.length > 0) {
        // console.log("✅ First 'source' value:", {
        //   entityId: sourceValues[0].entityId,
        //   value: sourceValues[0].value,
        //   fieldName: sourceValues[0].CustomField.fieldName
        // });
      } else {
        // console.log("❌ No 'source' values found - checking why...");
        
        // Check if 'source' field exists in CustomField table
        const sourceFieldExists = await CustomField.findOne({
          where: {
            fieldName: 'source',
            isActive: true,
            entityType: { [Op.in]: ["lead", "both"] }
          },
          attributes: ['fieldId', 'fieldName', 'fieldSource', 'masterUserID'],
          raw: true
        });
        
        if (sourceFieldExists) {
          // console.log("✅ 'source' field exists in CustomField table:", sourceFieldExists);
          
          // Check if 'source' values exist for ANY leads
          const anySourceValues = await CustomFieldValue.findAll({
            where: {
              entityType: "lead"
            },
            include: [{
              model: CustomField,
              as: "CustomField",
              where: { fieldName: 'source', isActive: true },
              required: true
            }],
            limit: 5
          });
          
          // console.log("🔍 Any 'source' values in database (limit 5):", anySourceValues.length);
          if (anySourceValues.length > 0) {
            // console.log("🔍 Sample source values:", anySourceValues.map(v => ({
            //   entityId: v.entityId,
            //   value: v.value
            // })));
            
            // Check if any match current lead IDs
            const currentLeadIds = leadIds;
            const matchingIds = anySourceValues.filter(v => currentLeadIds.includes(v.entityId));
            // console.log("🔍 Source values matching current lead IDs:", matchingIds.length);
          }
        } else {
          // console.log("❌ 'source' field does NOT exist in CustomField table");
        }
      }
    } else {
      // console.log("❌ No custom fields are checked in column preferences, skipping custom field query");
    }

    // Group custom field values by leadId
    const customFieldsByLead = {};
    // console.log("🔍 Grouping", customFieldValues.length, "custom field values by leadId");
    
    customFieldValues.forEach((value) => {
      if (!value.CustomField) return;
      if (!customFieldsByLead[value.entityId]) {
        customFieldsByLead[value.entityId] = {};
      }
      
      // Debug 'source' field specifically
      if (value.CustomField.fieldName === 'source') {
        console.log("✅ Processing 'source' field for leadId:", value.entityId, "value:", value.value);
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
    
    // console.log("🔍 Total leads with custom fields:", Object.keys(customFieldsByLead).length);
    
    // Check if any lead has 'source' field
    const leadsWithSource = Object.entries(customFieldsByLead).filter(([leadId, fields]) => 
      fields.hasOwnProperty('source')
    );
    // console.log("🔍 Leads with 'source' field:", leadsWithSource.length);
    if (leadsWithSource.length > 0) {
      // console.log("✅ First lead with source field:", {
      //   leadId: leadsWithSource[0][0],
      //   sourceValue: leadsWithSource[0][1].source.value
      // });
    }

    // Fetch currency descriptions for valid currency IDs found in leads
    // Only collect currencies for fields that are checked in column preferences
    const currencyIds = new Set();
    const isValueCurrencyChecked = checkedColumnKeys.includes('valueCurrency');
    const isProposalValueCurrencyChecked = checkedColumnKeys.includes('proposalValueCurrency');
    const isCurrencyChecked = checkedColumnKeys.includes('currency');
    
    // console.log("🔍 Currency field preferences:");
    // console.log("  - valueCurrency checked:", isValueCurrencyChecked);
    // console.log("  - proposalValueCurrency checked:", isProposalValueCurrencyChecked);
    // console.log("  - currency checked:", isCurrencyChecked);
    
    leads.rows.forEach((lead) => {
      const leadObj = lead.toJSON();
      
      // Only collect currency IDs for fields that are checked in preferences
      if (isValueCurrencyChecked && leadObj.valueCurrency && leadObj.valueCurrency !== null && leadObj.valueCurrency !== '') {
        currencyIds.add(leadObj.valueCurrency);
      }
      if (isProposalValueCurrencyChecked && leadObj.proposalValueCurrency && leadObj.proposalValueCurrency !== null && leadObj.proposalValueCurrency !== '') {
        currencyIds.add(leadObj.proposalValueCurrency);
      }
      if (isCurrencyChecked && leadObj.details && leadObj.details.currency && leadObj.details.currency !== null && leadObj.details.currency !== '') {
        currencyIds.add(leadObj.details.currency);
      }
    });

    // Fetch currency descriptions from database
    let currencyMap = {};
    if (currencyIds.size > 0) {
      const currencies = await Currency.findAll({
        where: {
          currencyId: { [Op.in]: Array.from(currencyIds) }
        },
        attributes: ['currencyId', 'currency_desc'],
        raw: true
      });
      
      currencies.forEach(currency => {
        currencyMap[currency.currencyId] = currency.currency_desc;
      });
      
      console.log("🔍 Currency map created:", currencyMap);
    }

    const flatLeads = leads.rows.map((lead) => {
      const leadObj = lead.toJSON();
      // Overwrite ownerName with the latest Owner.name if present
      if (leadObj.Owner && leadObj.Owner.name) {
        leadObj.ownerName = leadObj.Owner.name;
      }
      delete leadObj.Owner; // Remove the nested Owner object
      
      // Preserve person and organization data for the response
      const person = leadObj.LeadPerson;
      const organization = leadObj.LeadOrganization;
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

      // Conditionally add currency fields based on column preferences and valid values
      
      // Handle valueCurrency - only include if checked in preferences AND has valid value
      if (isValueCurrencyChecked) {
        if (leadObj.valueCurrency && leadObj.valueCurrency !== null && leadObj.valueCurrency !== '') {
          // Keep the currency ID
        } else {
          // Remove empty/null valueCurrency fields from response
          delete leadObj.valueCurrency;
        }
      } else {
        // Remove valueCurrency field if not checked in preferences
        delete leadObj.valueCurrency;
      }
      
      // Handle proposalValueCurrency - only include if checked in preferences AND has valid value
      if (isProposalValueCurrencyChecked) {
        if (leadObj.proposalValueCurrency && leadObj.proposalValueCurrency !== null && leadObj.proposalValueCurrency !== '') {
          // Keep the currency ID
        } else {
          // Remove empty/null proposalValueCurrency fields from response
          delete leadObj.proposalValueCurrency;
        }
      } else {
        // Remove proposalValueCurrency field if not checked in preferences
        delete leadObj.proposalValueCurrency;
      }
      
      // Handle currency from LeadDetails - only include if checked in preferences AND has valid value
      if (isCurrencyChecked) {
        if (leadObj.currency && leadObj.currency !== null && leadObj.currency !== '') {
          // Keep the currency ID
        } else {
          // Remove empty/null currency fields from response
          delete leadObj.currency;
        }
      } else {
        // Remove currency field if not checked in preferences
        delete leadObj.currency;
      }

      // Add custom fields directly to the lead object (not wrapped in customFields)
      const customFields = customFieldsByLead[leadObj.leadId] || {};
      
      // Debug for first lead only
      if (lead === leads.rows[0]) {
        console.log("🔍 Processing first lead", leadObj.leadId);
        console.log("🔍 Custom fields available for this lead:", Object.keys(customFields));
        console.log("🔍 'source' field available:", customFields.hasOwnProperty('source'));
        if (customFields.source) {
          console.log("✅ 'source' field data:", customFields.source);
        }
      }
      
      Object.entries(customFields).forEach(([fieldName, fieldData]) => {
        leadObj[fieldName] = fieldData.value;
        
        // Debug 'source' field addition
        if (fieldName === 'source') {
          console.log("✅ Adding 'source' field to lead", leadObj.leadId, "with value:", fieldData.value);
        }
      });

      // Keep the customFields property for backward compatibility (optional)
      leadObj.customFields = customFields;

      // Process and enrich label information
      if (leadObj.valueLabels) {
        // Parse the comma-separated label names
        const labelNames = leadObj.valueLabels.split(',').map(name => name.trim()).filter(name => name);
        leadObj.labelNames = labelNames; // Store raw label names for reference
        
        // Note: Label details will be fetched separately for all leads to avoid N+1 queries
        // This will be done after the flatLeads processing
      }

      // Add person and organization data back to the lead object
      if (person) {
        leadObj.person = person;
      }
      if (organization) {
        leadObj.leadOrganization = organization;
      }

      return leadObj;
    });
    
    // Fetch and enrich label details for all leads
    // console.log(flatLeads,"🔍 === ENRICHING LABEL DETAILS ===");
    
    // Collect all unique label names from all leads
    const allLabelNames = new Set();
    flatLeads.forEach(lead => {
      if (lead.labelNames && lead.labelNames.length > 0) {
        lead.labelNames.forEach(labelName => {
          if (labelName) allLabelNames.add(labelName);
        });
      }
    });
    
    // console.log("🔍 All unique label names found:", Array.from(allLabelNames));
    
    // Fetch label details for all unique label names
    let labelDetailsMap = {};
    if (allLabelNames.size > 0) {
      const labelDetails = await Label.findAll({
        where: {
          labelName: { [Op.in]: Array.from(allLabelNames) },
          isActive: true
        },
        attributes: ['labelId', 'labelName', 'labelColor', 'description'],
        raw: true
      });
      
      // Create a map for quick lookup using label names as keys
      labelDetails.forEach(label => {
        labelDetailsMap[label.labelName] = {
          labelId: label.labelId,
          labelName: label.labelName,
          labelColor: label.labelColor,
          description: label.description
        };
      });
      
      // console.log("🔍 Label details map created:", labelDetailsMap);
    }
    
    // Enrich each lead with full label details
    flatLeads.forEach(lead => {
      if (lead.labelNames && lead.labelNames.length > 0) {
        lead.labels = lead.labelNames.map(labelName => {
          return labelDetailsMap[labelName] || {
            labelId: null,
            labelName: labelName,
            labelColor: '#gray',
            description: 'Label not found in database'
          };
        }).filter(label => label); // Remove null/undefined labels
        
        console.log(`🔍 Lead ${lead.leadId} enriched with ${lead.labels.length} labels`);
      } else {
        lead.labels = []; // No labels for this lead
      }
      
      // Clean up temporary labelNames property
      delete lead.labelNames;
    });
    
    // console.log("🔍 === LABEL ENRICHMENT COMPLETE ===");
    
    // DEBUG: Final verification of 'source' field
    // console.log("🔍 === FINAL 'source' FIELD VERIFICATION ===");
    if (flatLeads.length > 0) {
      const firstLead = flatLeads[0];
      
      // console.log("🔍 All fields in first processed lead:", Object.keys(firstLead).length, "fields");
      // console.log("🔍 'source' field in final lead object:", firstLead.hasOwnProperty('source'));
      
      if (firstLead.source !== undefined) {
        // console.log("✅ SUCCESS: 'source' field found in final response with value:", firstLead.source);
      } else {
        // console.log("❌ FAIL: 'source' field NOT found in final response");
        // console.log("🔍 Available custom fields in response:", 
        //   Object.keys(firstLead).filter(key => 
        //     !['leadId', 'contactPerson', 'organization', 'title', 'email', 'phone', 'createdAt', 'updatedAt'].includes(key)
        //   )
        // );
      }
      
      // console.log("🔍 === END 'source' CUSTOM FIELD DEBUG ===");
      
      const currencyFieldsInLead = Object.keys(firstLead).filter(key => 
        key.includes('Currency') || key.includes('currency')
      );
      // console.log("🔍 Currency fields in processed lead:", currencyFieldsInLead);
      
      // Log currency values only if they exist
      if (firstLead.proposalValueCurrency) {
        // console.log("🔍 proposalValueCurrency value:", firstLead.proposalValueCurrency);
        // console.log("🔍 proposalValueCurrency_desc value:", firstLead.proposalValueCurrency_desc);
      } else if (isProposalValueCurrencyChecked) {
        // console.log("🔍 proposalValueCurrency: Checked in preferences but not present (empty/null value)");
      } else {
        // console.log("🔍 proposalValueCurrency: Not checked in column preferences");
      }
      
      if (firstLead.valueCurrency) {
        // console.log("🔍 valueCurrency value:", firstLead.valueCurrency);
        // console.log("🔍 valueCurrency_desc value:", firstLead.valueCurrency_desc);
      } else if (isValueCurrencyChecked) {
        // console.log("🔍 valueCurrency: Checked in preferences but not present (empty/null value)");
      } else {
        // console.log("🔍 valueCurrency: Not checked in column preferences");
      }
      
      // console.log("✅ Currency fields included based on column preferences and validity");
      // console.log("✅ Currency fields respect leadColumnPreference table settings");
    }
    
    // Extract unique persons and leadOrganizations from flatLeads
    const personsFromLeads = [];
    const leadOrganizationsFromLeads = [];
    const uniquePersonIds = new Set();
    const uniqueOrganizationIds = new Set();

    flatLeads.forEach(lead => {
      // Collect unique persons
      if (lead.person && !uniquePersonIds.has(lead.person.personId)) {
        personsFromLeads.push(lead.person);
        uniquePersonIds.add(lead.person.personId);
      }
      
      // Collect unique leadOrganizations
      if (lead.leadOrganization && !uniqueOrganizationIds.has(lead.leadOrganization.leadOrganizationId)) {
        leadOrganizationsFromLeads.push(lead.leadOrganization);
        uniqueOrganizationIds.add(lead.leadOrganization.leadOrganizationId);
      }
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
    // console.log(req.role, "role of the user............");

    // Get total count of unconverted leads (leads without dealId)
    let totalLeadCountWhere = { dealId: null };
    
    // Apply same visibility rules for total count as applied to the main query
    if (req.role !== "admin") {
      let visibilityConditions = [];

      if (leadVisibilityRule) {
        switch (leadVisibilityRule.defaultVisibility) {
          case "owner_only":
            visibilityConditions.push({
              [Op.or]: [
                { masterUserID: req.adminId },
                { ownerId: req.adminId },
              ],
            });
            break;

          case "group_only":
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
            if (userGroup) {
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
            break;

          default:
            visibilityConditions.push({
              [Op.or]: [
                { masterUserID: req.adminId },
                { ownerId: req.adminId },
              ],
            });
        }
      } else {
        visibilityConditions.push({
          [Op.or]: [{ masterUserID: req.adminId }, { ownerId: req.adminId }],
        });
      }

      if (visibilityConditions.length > 0) {
        totalLeadCountWhere[Op.and] = visibilityConditions;
      }
    }

    const totalLeadCount = await Lead.count({
      where: totalLeadCountWhere,
    });

    // console.log("==========================================", flatLeads, "ambagfahfhh");


    // const filterFields = flatLeads.filter((idx)=> idx?.visibilityGroupId == groupId);
    
    const findGroup = await GroupVisibility.findOne({
      where:{
        groupId: 1 //groupId
      }
    })

    let filterLeads = [];
    
    for(let i = 0; i < flatLeads.length; i++){
      if(flatLeads[i]?.visibleGroup == "owner"){
        if(flatLeads[i]?.ownerId == req.adminId){
          filterLeads.push(flatLeads[i]);
        }
      }else if(flatLeads[i]?.visibleGroup == "visibilitygroup"){
        findGroup?.memberIds?.split(",").includes(req.adminId.toString()) && filterLeads.push(flatLeads[i]);
      }else{
        filterLeads.push(flatLeads[i]);
      }
    }


    // if(findGroup?.lead?.toLowerCase() == "visibilitygroup"){
    //   let findParentGroup = null; 
    //   if(findGroup?.parentGroupId){
    //     findParentGroup = await GroupVisibility.findOne({
    //       where: {
    //         groupId: findGroup?.parentGroupId
    //       }
    //     })
    //   }
      
    //   const filterFields = flatLeads.filter((idx)=> idx?.ownerId == req.adminId || idx?.visibilityGroupId == groupId ||  idx?.visibilityGroupId == findGroup?.parentGroupId || findParentGroup.memberIds?.split(",").includes(req.adminId.toString()));

    //   filterLeads = filterFields
    // }
    // else if(findGroup?.lead?.toLowerCase() == "owner"){
    //   let findParentGroup = null; 
    //   if(findGroup?.parentGroupId){
    //     findParentGroup = await GroupVisibility.findOne({
    //       where: {
    //         groupId: findGroup?.parentGroupId
    //       }
    //     })
    //   }

    //   const filterFields = flatLeads.filter((idx)=> idx?.ownerId == req.adminId || idx?.visibilityGroupId == findGroup?.parentGroupId || findParentGroup.memberIds?.split(",").includes(req.adminId.toString()));

    //   filterLeads = filterFields;
    // }else{
    //   filterLeads = flatLeads;
    // }

    res.status(200).json({
      message: "Leads fetched successfully",
      totalRecords: leads.count,
      totalLeadCount, // Total unconverted leads count  
      totalPages: Math.ceil(leads.count / limit),
      currentPage: parseInt(page),
      // leads: leads.rows,
      leads: filterLeads, //flatLeads, // Return flattened leads with leadDetails merged
      persons,
      organizations,
      personsFromLeads, // Persons associated with current page leads
      leadOrganizationsFromLeads, // Lead organizations associated with current page leads
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
          // Removed masterUserID restriction - allow access to all custom fields
          [Op.or]: [
            { fieldSource: "default" },
            { fieldSource: "system" },
            { fieldSource: "custom" },
          ],
        },
      });

      // If not found by fieldName, try by fieldId
      if (!customField) {
        customField = await CustomField.findOne({
          where: {
            fieldId: cond.field,
            isActive: true,
            // Removed masterUserID restriction - allow access to all custom fields
            [Op.or]: [
              { fieldSource: "default" },
              { fieldSource: "system" },
              { fieldSource: "custom" },
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
          // Removed masterUserID restriction - allow access to all custom fields
          [Op.or]: [
            { fieldSource: "default" },
            { fieldSource: "system" },
            { fieldSource: "custom" },
          ],
        },
      });

      // If not found by fieldName, try by fieldId
      if (!customField) {
        customField = await CustomField.findOne({
          where: {
            fieldId: cond.field,
            isActive: true,
            // Removed masterUserID restriction - allow access to all custom fields
            [Op.or]: [
              { fieldSource: "default" },
              { fieldSource: "system" },
              { fieldSource: "custom" },
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

  console.log("====== UPDATE LEAD API CALLED ======");
  console.log("Lead ID:", leadId);
  console.log("Request body:", JSON.stringify(updateObj, null, 2));
  console.log("Request body keys:", Object.keys(updateObj));

  try {
    // Get all columns for Lead, LeadDetails, Person, and Organization
    const leadFields = Object.keys(Lead.rawAttributes);
    const leadDetailsFields = Object.keys(LeadDetails.rawAttributes);
    const personFields = Object.keys(Person.rawAttributes);
    const organizationFields = Object.keys(Organization.rawAttributes);
    console.log("\n====== MODEL FIELDS ======");
    console.log("Lead fields:", leadFields);
    console.log("LeadDetails fields:", leadDetailsFields);
    console.log("Person fields:", personFields);
    console.log("Organization fields:", organizationFields);
    console.log("====== END MODEL FIELDS ======\n");

    // Split the update object
    const leadData = {};
    const leadDetailsData = {};
    const personData = {};
    const organizationData = {};
    const customFields = {};

    console.log("====== FIELD ROUTING PROCESS ======");
    for (const key in updateObj) {
      console.log(`→ Processing field: "${key}" with value:`, updateObj[key]);
      
      if (key === "customFields") {
        // Handle nested customFields object (backward compatibility)
        Object.assign(customFields, updateObj[key]);
        console.log(`  ✓ Routed to: customFields (nested object)`);
        continue;
      }

      // Handle special case: 'organization' field exists in both Lead and Organization tables
      // We need to update BOTH when this field is provided
      if (key === 'organization') {
        if (leadFields.includes(key)) {
          leadData[key] = updateObj[key];
          console.log(`  ✓ Routed to: LEAD table (organization field)`);
        }
        if (organizationFields.includes(key)) {
          organizationData[key] = updateObj[key];
          console.log(`  ✓ Routed to: ORGANIZATION table (organization field)`);
        }
        continue;
      }

      // Handle special case: 'address' field exists in multiple tables
      if (key === 'address') {
        // Route to Organization table by default for address updates
        if (organizationFields.includes(key)) {
          organizationData[key] = updateObj[key];
          console.log(`  ✓ Routed to: ORGANIZATION table (address field)`);
        }
        continue;
      }

      // Handle special case: 'phone' field exists in both Lead and Person tables
      if (key === 'phone') {
        if (personFields.includes(key)) {
          personData[key] = updateObj[key];
          console.log(`  ✓ Routed to: PERSON table (phone field)`);
        }
        if (leadFields.includes(key)) {
          leadData[key] = updateObj[key];
          console.log(`  ✓ Routed to: LEAD table (phone field)`);
        }
        continue;
      }

      if (leadFields.includes(key)) {
        leadData[key] = updateObj[key];
        console.log(`  ✓ Routed to: LEAD table (matched in leadFields)`);
      } else if (personFields.includes(key)) {
        personData[key] = updateObj[key];
        console.log(`  ✓ Routed to: PERSON table (matched in personFields)`);
      } else if (organizationFields.includes(key)) {
        organizationData[key] = updateObj[key];
        console.log(`  ✓ Routed to: ORGANIZATION table (matched in organizationFields)`);
      } else if (leadDetailsFields.includes(key)) {
        leadDetailsData[key] = updateObj[key];
        console.log(`  ✓ Routed to: LEADDETAILS table (matched in leadDetailsFields)`);
      } else {
        // If the key doesn't match any model field, treat it as a custom field
        customFields[key] = updateObj[key];
        console.log(`  ✓ Routed to: CUSTOM FIELDS (no match in any model)`);
      }
    }
    console.log("====== END FIELD ROUTING PROCESS ======\n");

    console.log("====== FIELD DISTRIBUTION ======");
    console.log("leadData:", leadData);
    console.log("leadDetailsData:", leadDetailsData);
    console.log("personData:", personData);
    console.log("organizationData:", organizationData);
    console.log("customFields:", customFields);
    console.log("====== END FIELD DISTRIBUTION ======");

    // --- Add validation for email and phone ---
    const emailToValidate = leadData.email || personData.email;
    const phoneToValidate = leadData.phone || personData.phone || organizationData.phone;

    // Enhanced email format validation (if email is being updated)
    if (emailToValidate) {
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!emailRegex.test(emailToValidate)) {
        return res.status(400).json({ 
          message: "Invalid email format. Please provide a valid email address." 
        });
      }

      // Validate email length
      if (emailToValidate.length > 254) {
        return res.status(400).json({ 
          message: "Email address is too long. Maximum length is 254 characters." 
        });
      }
    }

    // Phone number validation (if phone is being updated) - Only numerical values allowed
    if (phoneToValidate && phoneToValidate.trim() !== "") {
      // Strict validation: only digits and optional plus sign at the beginning
      const phoneRegex = /^\+?\d{7,15}$/;
      
      if (!phoneRegex.test(phoneToValidate.trim())) {
        return res.status(400).json({ 
          message: "Invalid phone number format. Phone number should contain only digits (7-15 digits) with optional + for country code. No spaces, dashes, or other characters allowed." 
        });
      }
    }
    // --- End validation ---

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
    console.log("====== ORGANIZATION UPDATE PROCESS START ======");
    console.log("organizationData keys count:", Object.keys(organizationData).length);
    console.log("organizationData content:", organizationData);
    
    if (Object.keys(organizationData).length > 0) {
      console.log("→ Organization data is present, proceeding with update/create");
      console.log("→ lead.leadOrganizationId:", lead.leadOrganizationId);
      
      orgRecord = await Organization.findOne({
        where: { leadOrganizationId: lead.leadOrganizationId },
      });
      console.log("→ Fetched orgRecord:", orgRecord ? orgRecord.toJSON() : null);
      
      if (orgRecord) {
        console.log("→ Organization record FOUND - attempting UPDATE");
        console.log("→ Before update - orgRecord:", orgRecord.toJSON());
        console.log("→ Data to update with:", organizationData);
        
        await orgRecord.update(organizationData);
        
        console.log("→ After update - orgRecord:", orgRecord.toJSON());
        console.log("✅ Organization UPDATED successfully in LeadOrganization table");
        
        // Sync organization data to Lead table if fields are present
        if (organizationData.organization && leadFields.includes('organization')) {
          leadData.organization = organizationData.organization;
        }
        if (organizationData.address && leadFields.includes('address')) {
          leadData.address = organizationData.address;
        }
        if (organizationData.phone && leadFields.includes('phone')) {
          leadData.phone = organizationData.phone;
        }
        
        // Sync organization data to LeadDetails table if fields are present
        if (organizationData.organization && leadDetailsFields.includes('organizationName')) {
          leadDetailsData.organizationName = organizationData.organization;
          console.log("→ Synced organizationName to LeadDetails:", organizationData.organization);
        }
        if (organizationData.address && leadDetailsFields.includes('address')) {
          leadDetailsData.address = organizationData.address;
          console.log("→ Synced address to LeadDetails:", organizationData.address);
        }
        if (organizationData.postalAddress && leadDetailsFields.includes('postalAddress')) {
          leadDetailsData.postalAddress = organizationData.postalAddress;
          console.log("→ Synced postalAddress to LeadDetails:", organizationData.postalAddress);
        }
        
      } else {
        console.log("→ Organization record NOT FOUND - attempting CREATE");
        console.log("→ Data to create with:", organizationData);
        
        orgRecord = await Organization.create(organizationData);
        
        console.log("→ After create - orgRecord:", orgRecord.toJSON());
        console.log("✅ Organization CREATED successfully in LeadOrganization table");
        leadData.leadOrganizationId = orgRecord.leadOrganizationId;
        console.log("→ Set leadOrganizationId in leadData:", orgRecord.leadOrganizationId);
        
        // Sync organization data to Lead table for new organization
        if (organizationData.organization && leadFields.includes('organization')) {
          leadData.organization = organizationData.organization;
        }
        if (organizationData.address && leadFields.includes('address')) {
          leadData.address = organizationData.address;
        }
        if (organizationData.phone && leadFields.includes('phone')) {
          leadData.phone = organizationData.phone;
        }
        
        // Sync organization data to LeadDetails table for new organization
        if (organizationData.organization && leadDetailsFields.includes('organizationName')) {
          leadDetailsData.organizationName = organizationData.organization;
        }
        if (organizationData.address && leadDetailsFields.includes('address')) {
          leadDetailsData.address = organizationData.address;
        }
        if (organizationData.postalAddress && leadDetailsFields.includes('postalAddress')) {
          leadDetailsData.postalAddress = organizationData.postalAddress;
        }
        
        await lead.update({ leadOrganizationId: orgRecord.leadOrganizationId });
        console.log(
          "Lead updated with new leadOrganizationId:",
          orgRecord.leadOrganizationId
        );
      }
      
      // Log the synced data
      const syncedToLead = Object.keys(leadData).filter(key => 
        ['organization', 'address', 'phone'].includes(key)
      );
      const syncedToLeadDetails = Object.keys(leadDetailsData).filter(key => 
        ['organizationName', 'address', 'postalAddress'].includes(key)
      );
      
      console.log("→ Organization data synced to Lead table:", syncedToLead.length > 0 ? syncedToLead : "NONE");
      console.log("→ Organization data synced to LeadDetails table:", syncedToLeadDetails.length > 0 ? syncedToLeadDetails : "NONE");
      console.log("====== ORGANIZATION UPDATE PROCESS END ======");
    } else {
      console.log("→ No organization data to update");
      console.log("====== ORGANIZATION UPDATE PROCESS END ======");
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
        
        // Sync person data to Lead table if fields are present
        if (personData.contactPerson && leadFields.includes('contactPerson')) {
          leadData.contactPerson = personData.contactPerson;
        }
        if (personData.email && leadFields.includes('email')) {
          leadData.email = personData.email;
        }
        if (personData.phone && leadFields.includes('phone')) {
          leadData.phone = personData.phone;
        }
        if (personData.jobTitle && leadFields.includes('jobTitle')) {
          leadData.jobTitle = personData.jobTitle;
        }
        if (personData.birthday && leadFields.includes('birthday')) {
          leadData.birthday = personData.birthday;
        }
        
        // Sync person data to LeadDetails table if fields are present
        if (personData.contactPerson && leadDetailsFields.includes('personName')) {
          leadDetailsData.personName = personData.contactPerson;
        }
        if (personData.jobTitle && leadDetailsFields.includes('jobTitle')) {
          leadDetailsData.jobTitle = personData.jobTitle;
        }
        if (personData.notes && leadDetailsFields.includes('notes')) {
          leadDetailsData.notes = personData.notes;
        }
        
      } else {
        if (orgRecord)
          personData.leadOrganizationId = orgRecord.leadOrganizationId;
        personRecord = await Person.create(personData);
        console.log("Person created:", personRecord.toJSON());
        leadData.personId = personRecord.personId;
        
        // Sync person data to Lead table for new person
        if (personData.contactPerson && leadFields.includes('contactPerson')) {
          leadData.contactPerson = personData.contactPerson;
        }
        if (personData.email && leadFields.includes('email')) {
          leadData.email = personData.email;
        }
        if (personData.phone && leadFields.includes('phone')) {
          leadData.phone = personData.phone;
        }
        if (personData.jobTitle && leadFields.includes('jobTitle')) {
          leadData.jobTitle = personData.jobTitle;
        }
        if (personData.birthday && leadFields.includes('birthday')) {
          leadData.birthday = personData.birthday;
        }
        
        // Sync person data to LeadDetails table for new person
        if (personData.contactPerson && leadDetailsFields.includes('personName')) {
          leadDetailsData.personName = personData.contactPerson;
        }
        if (personData.jobTitle && leadDetailsFields.includes('jobTitle')) {
          leadDetailsData.jobTitle = personData.jobTitle;
        }
        if (personData.notes && leadDetailsFields.includes('notes')) {
          leadDetailsData.notes = personData.notes;
        }
        
        await lead.update({ personId: personRecord.personId });
        console.log("Lead updated with new personId:", personRecord.personId);
      }
      
      // Log the synced data
      console.log("Person data synced to Lead table:", Object.keys(leadData).filter(key => 
        ['contactPerson', 'email', 'phone', 'jobTitle', 'birthday'].includes(key)
      ));
      console.log("Person data synced to LeadDetails table:", Object.keys(leadDetailsData).filter(key => 
        ['personName', 'jobTitle', 'notes'].includes(key)
      ));
    }

    // Update Lead (includes synced data from Person and Organization updates)
    if (Object.keys(leadData).length > 0) {
      // Sanitize numeric fields - convert empty strings to null
      const numericFields = ['proposalValue', 'valueCurrency', 'proposalValueCurrency'];
      numericFields.forEach(field => {
        if (leadData.hasOwnProperty(field) && leadData[field] === '') {
          leadData[field] = null;
        }
      });
      
      // 🔔 IMPORTANT: Store original ownerId BEFORE updating the lead
      const originalOwnerId = lead.ownerId;
      console.log('🔔 Original ownerId stored:', originalOwnerId);
      
      console.log("Final leadData to update (includes synced Person/Organization fields):", leadData);
      await lead.update(leadData);
      console.log("Lead updated:", lead.toJSON());
      
      // 🔔 Send Notification - Lead Assigned (if ownerId changed)
      console.log('🔔 ========== UPDATE LEAD NOTIFICATION DEBUG START ==========');
      console.log('🔔 Checking if ownerId changed:', {
        'leadData.ownerId': leadData.ownerId,
        'original ownerId (stored before update)': originalOwnerId,
        'current lead.ownerId (after update)': lead.ownerId,
        'has changed': leadData.ownerId && leadData.ownerId !== originalOwnerId
      });
      
      if (leadData.ownerId && leadData.ownerId !== originalOwnerId) {
        console.log('🔔 ✅ Owner changed! Sending notification...');
        try {
          console.log('🔔 Step 1: Fetching assignedBy details for req.adminId:', req.adminId);
          
          // Get assignedBy details for notification
          const assignedBy = await MasterUser.findByPk(req.adminId, {
            attributes: ['masterUserID', 'name']
          });
          
          console.log('🔔 Step 2: AssignedBy user found:', assignedBy ? {
            masterUserID: assignedBy.masterUserID,
            name: assignedBy.name
          } : 'NULL - User not found!');
          
          const leadObject = {
            leadId: lead.leadId,
            leadTitle: lead.title
          };
          
          const newOwnerId = leadData.ownerId;
          
          const assignedByObject = {
            userId: req.adminId,
            name: assignedBy ? assignedBy.name : 'Unknown User'
          };
          
          console.log('🔔 Step 3: Calling NotificationTriggers.leadAssigned with:', {
            leadObject,
            newOwnerId,
            assignedByObject
          });
          
          await NotificationTriggers.leadAssigned(
            leadObject,
            newOwnerId,
            assignedByObject
          );
          
          console.log('🔔 Step 4: Lead assigned notification sent successfully! ✅');
        } catch (notifError) {
          console.error('🔔 ❌ NOTIFICATION ERROR:', notifError);
          console.error('🔔 Error name:', notifError.name);
          console.error('🔔 Error message:', notifError.message);
          console.error('🔔 Error stack:', notifError.stack);
        }
      } else {
        console.log('🔔 ⚠️ Owner NOT changed - no notification sent');
      }
      
      console.log('🔔 ========== UPDATE LEAD NOTIFICATION DEBUG END ==========');
      
      // Synchronize relevant Lead fields to LeadDetails table
      const leadDetailsSync = {};
      const syncedDetailFields = [];
      
      // Map Lead fields to LeadDetails fields
      if (leadData.contactPerson !== undefined) {
        leadDetailsSync.personName = leadData.contactPerson;
        syncedDetailFields.push('personName');
      }
      if (leadData.organization !== undefined) {
        leadDetailsSync.organizationName = leadData.organization;
        syncedDetailFields.push('organizationName');
      }
      
      // Update LeadDetails if there are fields to sync and LeadDetails exists
      if (Object.keys(leadDetailsSync).length > 0) {
        let leadDetailsForSync = await LeadDetails.findOne({ where: { leadId } });
        if (leadDetailsForSync) {
          await leadDetailsForSync.update(leadDetailsSync);
          console.log(`Synced Lead to LeadDetails fields: ${syncedDetailFields.join(', ')}`, leadDetailsSync);
        } else if (leadDetailsSync.personName || leadDetailsSync.organizationName) {
          // Create LeadDetails if it doesn't exist and we have important fields to sync
          leadDetailsSync.leadId = leadId;
          leadDetailsForSync = await LeadDetails.create(leadDetailsSync);
          console.log(`Created LeadDetails with synced Lead fields: ${syncedDetailFields.join(', ')}`, leadDetailsSync);
        }
      }
    }

    // --- Send email if owner changed ---
    if (
      ownerChanged &&
      newOwner &&
      newOwner.email &&
      assigner &&
      assigner.email
    ) {
      try {
        const emailResult = await sendEmail(assigner.email, {
          from: assigner.email,
          to: newOwner.email,
          subject: "You have been assigned a new lead",
          text: `Hello ${newOwner.name},\n\nYou have been assigned a new lead: "${lead.title}" by ${assigner.name}.\n\nPlease check your CRM dashboard for details.`,
        });
        
        if (emailResult && emailResult.success === false) {
          console.log(`⚠️ Email notification not sent: ${emailResult.message}`);
        } else {
          console.log(`✅ Email notification sent successfully to ${newOwner.email}`);
        }
      } catch (emailError) {
        console.error(`Error sending email notification for lead ${lead.leadId}:`, emailError);
        // Don't throw - continue with the rest of the update process
      }
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
        
        // Synchronize relevant LeadDetails fields to Lead table
        const leadSyncData = {};
        const syncedFields = [];
        
        // Map LeadDetails fields to Lead fields
        if (leadDetailsData.personName && leadDetailsData.personName !== lead.contactPerson) {
          leadSyncData.contactPerson = leadDetailsData.personName;
          syncedFields.push('contactPerson');
        }
        if (leadDetailsData.organizationName && leadDetailsData.organizationName !== lead.organization) {
          leadSyncData.organization = leadDetailsData.organizationName;
          syncedFields.push('organization');
        }
        
        // Update Lead table if there are fields to sync
        if (Object.keys(leadSyncData).length > 0) {
          await lead.update(leadSyncData);
          console.log(`Synced LeadDetails to Lead fields: ${syncedFields.join(', ')}`, leadSyncData);
        }
      }
    } else if (Object.keys(leadDetailsData).length > 0) {
      leadDetailsData.leadId = leadId;
      leadDetails = await LeadDetails.create(leadDetailsData);
      console.log("LeadDetails created:", leadDetails.toJSON());
      
      // Synchronize relevant LeadDetails fields to Lead table for newly created LeadDetails
      const leadSyncData = {};
      const syncedFields = [];
      
      // Map LeadDetails fields to Lead fields
      if (leadDetailsData.personName && leadDetailsData.personName !== lead.contactPerson) {
        leadSyncData.contactPerson = leadDetailsData.personName;
        syncedFields.push('contactPerson');
      }
      if (leadDetailsData.organizationName && leadDetailsData.organizationName !== lead.organization) {
        leadSyncData.organization = leadDetailsData.organizationName;
        syncedFields.push('organization');
      }
      
      // Update Lead table if there are fields to sync
      if (Object.keys(leadSyncData).length > 0) {
        await lead.update(leadSyncData);
        console.log(`Synced new LeadDetails to Lead fields: ${syncedFields.join(', ')}`, leadSyncData);
      }
    }

    // Handle custom fields if provided
    const savedCustomFields = {};
    if (customFields && Object.keys(customFields).length > 0) {
      try {
        console.log("Processing custom fields for update:", customFields);

        for (const [fieldKey, value] of Object.entries(customFields)) {
          // Extract the actual value from the custom field data
          // Handle both direct value and object with metadata format
          let actualValue = value;
          let fieldIdFromValue = null;
          
          // Check if value is an object with custom field metadata
          if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            if (value.hasOwnProperty('value')) {
              // Extract only the value from the metadata object
              actualValue = value.value;
              console.log(`Extracted value from metadata object for ${fieldKey}:`, actualValue);
            }
            // Also extract fieldId if provided in the object
            if (value.hasOwnProperty('fieldId')) {
              fieldIdFromValue = value.fieldId;
            }
          }

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

          // If not found by fieldName, try by fieldId from the value object
          if (!customField && fieldIdFromValue) {
            customField = await CustomField.findOne({
              where: {
                fieldId: fieldIdFromValue,
                entityType: { [Op.in]: ["lead", "both"] }, // Support unified fields
                isActive: true,
              },
            });
          }

          // If still not found, try by fieldId as key
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
              // Update existing value - only store the actual value, not the metadata
              const valueToSave =
                typeof actualValue === "object" && actualValue !== null 
                  ? JSON.stringify(actualValue) 
                  : actualValue;
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
              // Create new value - only store the actual value, not the metadata
              const valueToSave =
                typeof actualValue === "object" && actualValue !== null 
                  ? JSON.stringify(actualValue) 
                  : actualValue;
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
  const { emailPage = 1, emailLimit = 10 } = req.query;
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
    if (!lead) {
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT,
        "LEAD_DETAILS_FETCH",
        masterUserID,
        "Lead details fetch failed: Lead not found.",
        null
      );
      return res.status(404).json({ message: "Lead not found." });
    }

    // Allow leads without email: proceed but warn and skip email-specific data later
    const clientEmail = lead.email || null;
    if (!clientEmail) {
      console.warn(`📌 [getAllLeadDetails] Lead ${leadId} exists but has no email; email-related data will be omitted.`);
      // Log this as an informational audit entry so admins can trace missing emails
      try {
        await logAuditTrail(
          PROGRAMS.LEAD_MANAGEMENT,
          "LEAD_DETAILS_FETCH",
          masterUserID,
          `Lead ${leadId} has no email; email-related data will be omitted.`,
          null
        );
      } catch (auditErr) {
        console.error('Error logging audit trail for missing lead email:', auditErr);
      }
    } else {
      // Debug: Check what emails exist for this email address in the database
      console.log(`🔍 [getAllLeadDetails] Lead email: ${clientEmail}`);
      const allEmailsForThisAddress = await Email.findAll({
        where: {
          [Op.or]: [
            { sender: clientEmail },
            { recipient: { [Op.like]: `%${clientEmail}%` } }
          ]
        },
        attributes: ['emailID', 'sender', 'recipient', 'subject', 'leadId', 'dealId', 'visibility', 'userEmail'],
        limit: 20
      });
      console.log(`📊 [getAllLeadDetails] Found ${allEmailsForThisAddress.length} total emails for ${clientEmail} in database:`, 
        allEmailsForThisAddress.map(e => ({
          emailID: e.emailID,
          sender: e.sender,
          recipient: e.recipient,
          subject: e.subject,
          leadId: e.leadId,
          dealId: e.dealId,
          visibility: e.visibility,
          userEmail: e.userEmail
        }))
      );
    }

    // Get user credentials for email visibility filtering
    let currentUserEmail = null;
    try {
      const userCredential = await UserCredential.findOne({
        where: { masterUserID: req.adminId },  // Using masterUserID as that's the correct column name
        attributes: ['email']
      });
      currentUserEmail = userCredential?.email;
      console.log(`👤 [getAllLeadDetails] Current user email: ${currentUserEmail}`);
    } catch (error) {
      console.error('Error fetching user credential:', error);
    }

    // Fetch person and leadOrganization data for the lead
    let person = null;
    let leadOrganization = null;

    if (lead.personId) {
      person = await Person.findByPk(lead.personId, {
        raw: true
      });
    }

    if (lead.leadOrganizationId) {
      leadOrganization = await Organization.findByPk(lead.leadOrganizationId, {
        raw: true
      });
    }

    // Optimize email fetching with pagination and size limits
    const maxEmailLimit = Math.min(parseInt(emailLimit) || 25, 50);
    const maxBodyLength = 1000;

    // Build email visibility where clause
    let emailVisibilityWhere = {};
    if (currentUserEmail) {
      emailVisibilityWhere = {
        [Op.or]: [
          { visibility: 'shared' },
          { 
            [Op.and]: [
              { visibility: 'private' },
              { userEmail: currentUserEmail }
            ]
          },
          { visibility: { [Op.is]: null } } // Include emails without visibility set (legacy)
        ]
      };
    } else {
      // If no user email found, only show shared emails and emails without visibility set
      emailVisibilityWhere = {
        [Op.or]: [
          { visibility: 'shared' },
          { visibility: { [Op.is]: null } }
        ]
      };
    }

    // Get total email count first with visibility filtering
    const totalEmailsCount = await Email.count({
      where: {
        [Op.and]: [
          {
            [Op.or]: [
              { leadId },  // Direct lead association (like deals)
              ...(lead.email
                ? [
                    { sender: lead.email },
                    { recipient: { [Op.like]: `%${lead.email}%` } }
                  ]
                : [])
            ]
          },
          emailVisibilityWhere
        ]
      }
    });

    // NEW APPROACH: Fetch emails through person/organization relationships instead of direct leadId
    console.log(`🔍 [getAllLeadDetails] Finding emails through person/organization relationships for lead: ${leadId}`);
    
    // Collect all email addresses associated with this lead
    const leadEmailAddresses = new Set();
    
    // Add lead's direct email
    if (lead.email) {
      leadEmailAddresses.add(lead.email.toLowerCase());
      console.log(`📧 [getAllLeadDetails] Added lead email: ${lead.email}`);
    }
    
    // Add person's email (if person exists)
    if (person && person.email) {
      leadEmailAddresses.add(person.email.toLowerCase());
      console.log(`� [getAllLeadDetails] Added person email: ${person.email}`);
    }
    
    // Add organization email (if organization exists and has email)
    if (leadOrganization && leadOrganization.email) {
      leadEmailAddresses.add(leadOrganization.email.toLowerCase());
      console.log(`📧 [getAllLeadDetails] Added organization email: ${leadOrganization.email}`);
    }
    
    console.log(`📧 [getAllLeadDetails] Total email addresses to search: ${leadEmailAddresses.size}`);
    
    // Fetch emails based on these email addresses (relationship-based approach)
    let emailsByRelationship = [];
    if (leadEmailAddresses.size > 0) {
      const emailAddressArray = Array.from(leadEmailAddresses);
      emailsByRelationship = await Email.findAll({
        where: {
          [Op.and]: [
            {
              [Op.or]: emailAddressArray.flatMap(email => [
                { sender: email },
                { recipient: { [Op.like]: `%${email}%` } }
              ])
            },
            emailVisibilityWhere
          ]
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
          "visibility",
          "userEmail",
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
    }
    console.log(`📧 [getAllLeadDetails] Found ${emailsByRelationship.length} emails through relationship-based approach`);

    // Merge all relationship-based emails and deduplicate
    let emails = emailsByRelationship;
    
    console.log(`� [getAllLeadDetails] Using relationship-based emails: ${emails.length}`);

    // Log visibility statistics
    const visibilityStats = emails.reduce((stats, email) => {
      const visibility = email.visibility || 'legacy';
      stats[visibility] = (stats[visibility] || 0) + 1;
      return stats;
    }, {});
    console.log(`📊 [getAllLeadDetails] Email visibility stats:`, visibilityStats);

    // Limit final email results and add optimization metadata
    const limitedEmails = emails.slice(0, maxEmailLimit);

    // Simplified thread handling for relationship-based emails
    // Since we're using relationship-based email fetching, we already have the relevant emails
    // No need for complex thread handling that might filter out results
    console.log(`🔍 [getAllLeadDetails] Simplifying email handling: using ${limitedEmails.length} relationship-based emails directly`);
    let relatedEmails = limitedEmails;

    // Enrich emails with connected person, organization, leads, and deals
    console.log(`🔗 [getAllLeadDetails] Enriching ${relatedEmails.length} emails with connected entities`);
    
    if (relatedEmails.length > 0) {
      // Extract all unique email addresses from sender and recipient fields
      const emailAddresses = new Set();
      
      relatedEmails.forEach(email => {
        if (email.sender) {
          emailAddresses.add(email.sender.toLowerCase());
        }
        if (email.recipient) {
          // Handle multiple recipients separated by comma/semicolon
          const recipients = email.recipient.split(/[,;]/).map(r => r.trim().toLowerCase());
          recipients.forEach(recipient => {
            if (recipient && recipient.includes('@')) {
              emailAddresses.add(recipient);
            }
          });
        }
      });
      
      const uniqueEmailAddresses = Array.from(emailAddresses);
      console.log(`📧 [getAllLeadDetails] Found ${uniqueEmailAddresses.length} unique email addresses to lookup`);
      
      // Bulk fetch all related entities for these email addresses
      const [connectedPersons, connectedOrganizations, connectedLeads, connectedDeals] = await Promise.all([
        // Find persons by email
        Person.findAll({
          where: {
            email: { [Op.in]: uniqueEmailAddresses }
          },
          attributes: ['personId', 'contactPerson', 'email', 'phone', 'jobTitle', 'leadOrganizationId'],
          raw: true
        }),
        
        // Find organizations by email (if organizations have email field)
        Organization.findAll({
          where: {
            ...(Organization.rawAttributes.email ? { email: { [Op.in]: uniqueEmailAddresses } } : {})
          },
          attributes: ['leadOrganizationId', 'organization', 'address'],
          raw: true
        }),
        
        // Find leads by email
        Lead.findAll({
          where: {
            email: { [Op.in]: uniqueEmailAddresses }
          },
          attributes: ['leadId', 'title', 'email', 'contactPerson', 'organization', 'ownerId', 'status'],
          raw: true
        }),
        
        // Find deals by email (if deals have email field)
        Deal.findAll({
          where: {
            ...(Deal.rawAttributes.email ? { email: { [Op.in]: uniqueEmailAddresses } } : {})
          },
          attributes: ['dealId', 'title', 'value', 'currency', 'contactPerson', 'organization', 'ownerId', 'status'],
          raw: true
        })
      ]);
      
      // Create lookup maps for efficient matching
      const personEmailMap = new Map();
      const organizationEmailMap = new Map();
      const leadEmailMap = new Map();
      const dealEmailMap = new Map();
      
      // Build person email map
      connectedPersons.forEach(person => {
        if (person.email) {
          const emailKey = person.email.toLowerCase();
          if (!personEmailMap.has(emailKey)) {
            personEmailMap.set(emailKey, []);
          }
          personEmailMap.get(emailKey).push(person);
        }
      });
      
      // Build organization email map
      connectedOrganizations.forEach(org => {
        if (org.email) {
          const emailKey = org.email.toLowerCase();
          if (!organizationEmailMap.has(emailKey)) {
            organizationEmailMap.set(emailKey, []);
          }
          organizationEmailMap.get(emailKey).push(org);
        }
      });
      
      // Build lead email map
      connectedLeads.forEach(leadItem => {
        if (leadItem.email) {
          const emailKey = leadItem.email.toLowerCase();
          if (!leadEmailMap.has(emailKey)) {
            leadEmailMap.set(emailKey, []);
          }
          leadEmailMap.get(emailKey).push(leadItem);
        }
      });
      
      // Build deal email map
      connectedDeals.forEach(deal => {
        if (deal.email) {
          const emailKey = deal.email.toLowerCase();
          if (!dealEmailMap.has(emailKey)) {
            dealEmailMap.set(emailKey, []);
          }
          dealEmailMap.get(emailKey).push(deal);
        }
      });
      
      console.log(`🔍 [getAllLeadDetails] Email mapping results - Persons: ${connectedPersons.length}, Organizations: ${connectedOrganizations.length}, Leads: ${connectedLeads.length}, Deals: ${connectedDeals.length}`);
      
      // Enrich each email with connected entities
      relatedEmails = relatedEmails.map(email => {
        const emailObj = email.toJSON ? email.toJSON() : email;
        
        // Initialize connected entities arrays
        emailObj.connectedPersons = [];
        emailObj.connectedOrganizations = [];
        emailObj.connectedLeads = [];
        emailObj.connectedDeals = [];
        
        // Helper function to add connected entities for an email address
        const addConnectedEntities = (emailAddress) => {
          const emailKey = emailAddress.toLowerCase();
          
          // Add connected persons
          if (personEmailMap.has(emailKey)) {
            emailObj.connectedPersons.push(...personEmailMap.get(emailKey));
          }
          
          // Add connected organizations
          if (organizationEmailMap.has(emailKey)) {
            emailObj.connectedOrganizations.push(...organizationEmailMap.get(emailKey));
          }
          
          // Add connected leads
          if (leadEmailMap.has(emailKey)) {
            emailObj.connectedLeads.push(...leadEmailMap.get(emailKey));
          }
          
          // Add connected deals
          if (dealEmailMap.has(emailKey)) {
            emailObj.connectedDeals.push(...dealEmailMap.get(emailKey));
          }
        };
        
        // Check sender email
        if (emailObj.sender) {
          addConnectedEntities(emailObj.sender);
        }
        
        // Check recipient emails
        if (emailObj.recipient) {
          const recipients = emailObj.recipient.split(/[,;]/).map(r => r.trim());
          recipients.forEach(recipient => {
            if (recipient && recipient.includes('@')) {
              addConnectedEntities(recipient);
            }
          });
        }
        
        // Remove duplicates from each array
        emailObj.connectedPersons = emailObj.connectedPersons.filter((person, index, self) => 
          index === self.findIndex(p => p.personId === person.personId)
        );
        emailObj.connectedOrganizations = emailObj.connectedOrganizations.filter((org, index, self) => 
          index === self.findIndex(o => o.leadOrganizationId === org.leadOrganizationId)
        );
        emailObj.connectedLeads = emailObj.connectedLeads.filter((leadItem, index, self) => 
          index === self.findIndex(l => l.leadId === leadItem.leadId)
        );
        emailObj.connectedDeals = emailObj.connectedDeals.filter((deal, index, self) => 
          index === self.findIndex(d => d.dealId === deal.dealId)
        );
        
        return emailObj;
      });
      
      // Log enrichment statistics
      const enrichmentStats = {
        totalEmails: relatedEmails.length,
        emailsWithPersons: relatedEmails.filter(e => e.connectedPersons.length > 0).length,
        emailsWithOrganizations: relatedEmails.filter(e => e.connectedOrganizations.length > 0).length,
        emailsWithLeads: relatedEmails.filter(e => e.connectedLeads.length > 0).length,
        emailsWithDeals: relatedEmails.filter(e => e.connectedDeals.length > 0).length
      };
      console.log(`📊 [getAllLeadDetails] Email enrichment stats:`, enrichmentStats);
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
    
    // Fetch activities with assigned user names
    let activities = await Activity.findAll({
      where: { leadId },
      order: [["startDateTime", "DESC"]],
    });
    
    // Add assignedToName to activities
    if (activities.length > 0) {
      // Get unique assignedTo IDs to fetch user names in bulk
      const assignedToIds = [...new Set(activities.map(a => a.assignedTo).filter(id => id))];
      
      // Fetch all assigned users in one query
      const assignedUsers = await MasterUser.findAll({
        where: {
          masterUserID: { [Op.in]: assignedToIds }
        },
        attributes: ["masterUserID", "name"],
        raw: true
      });
      
      // Create a map for quick lookup
      const userMap = new Map();
      assignedUsers.forEach(user => {
        userMap.set(user.masterUserID, user.name);
      });
      
      // Process activities and add assignedToName
      activities = activities.map(a => {
        const activityData = a.toJSON();
        // Add assignedToName using the user map
        activityData.assignedToName = userMap.get(a.assignedTo) || null;
        return activityData;
      });
    }

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
      "valueLabels",
      "proposalSentDate",
    ];

    const filteredLead = {};
    if (lead) {
      allowedFields.forEach((field) => {
        if (lead[field] !== undefined) {
          filteredLead[field] = lead[field];
        }
      });
    }

    // Add responsiblePerson from LeadDetails if available
    if (leadDetails && leadDetails.responsiblePerson !== undefined) {
      filteredLead.responsiblePerson = leadDetails.responsiblePerson;
    }

    // Add some logging for debugging email visibility
    console.log(`📧 [getAllLeadDetails] Fetching emails for lead ${leadId} with visibility filtering`);
    console.log(`[getAllLeadDetails] User ${masterUserID} fetching emails for lead ${leadId}`);
    console.log(`[getAllLeadDetails] User email: ${currentUserEmail || 'No credentials found'}`);
    console.log(`[getAllLeadDetails] Total emails found (after visibility filtering): ${relatedEmails.length}`);
    
    // Count emails by visibility for debugging
    const emailVisibilityStats = {
      shared: relatedEmails.filter(email => email.visibility === 'shared').length,
      private: relatedEmails.filter(email => email.visibility === 'private').length,
      legacy: relatedEmails.filter(email => !email.visibility).length
    };
    console.log(`[getAllLeadDetails] Email visibility breakdown:`, emailVisibilityStats);

    res.status(200).json({
      message: "Lead details fetched successfully.",
      lead: filteredLead,
      leadDetails,
      customFields,
      notes: notesWithCreator,
      emails: relatedEmails,
      activities,
      person: person ? [person] : [], // Person array (single person if exists)
      leadOrganization: leadOrganization ? [leadOrganization] : [], // Lead organization array (single organization if exists)
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
        totalEmails: relatedEmails.length,
        page: parseInt(emailPage),
        limit: maxEmailLimit,
        hasMore: relatedEmails.length === maxEmailLimit,
        bodyTruncated: true,
        bodyMaxLength: maxBodyLength,
        note: "Email bodies are truncated for performance. Use separate email detail API for full content.",
        // Email fetching approach
        fetchingMethod: {
          approach: "relationship-based",
          description: "Emails are fetched through person/organization relationships rather than direct leadId associations",
          emailSources: {
            leadEmail: lead.email || null,
            personEmails: person?.email ? [person.email] : [],
            organizationEmails: leadOrganization?.email ? [leadOrganization.email] : []
          },
          totalEmailAddresses: leadEmailAddresses.size,
          searchedAddresses: Array.from(leadEmailAddresses)
        },
        entityEnrichment: {
          enabled: true,
          description: "Each email is enriched with connected persons, organizations, leads, and deals based on email addresses",
          connectedEntityFields: [
            "connectedPersons", 
            "connectedOrganizations", 
            "connectedLeads", 
            "connectedDeals"
          ]
        },
        visibilityFiltering: {
          enabled: true,
          userEmail: currentUserEmail || null,
          hasCredentials: !!currentUserEmail,
          visibilityStats: emailVisibilityStats
        }
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

// New lightweight endpoint: Get ONLY paginated emails for a lead (for infinite scroll)
// Returns unified array of emails, activities, and notes with single pagination
exports.getLeadEmails = async (req, res) => {
  const masterUserID = req.adminId;
  const { leadId } = req.params;

  // Single pagination for all items (emails, notes, activities combined)
  const { 
    page = 1, 
    limit = 20
  } = req.query;
  
  const offset = (page - 1) * limit;
  const maxLimit = Math.min(parseInt(limit) || 20, 50);

  if (!leadId) {
    return res.status(400).json({ message: "leadId is required in params." });
  }

  try {
    // Get the lead details (basic info only)
    const lead = await Lead.findByPk(leadId, {
      attributes: ['leadId', 'email', 'personId', 'leadOrganizationId']
    });
    
    if (!lead) {
      return res.status(404).json({ message: "Lead not found." });
    }

    // Allow leads without email
    if (!lead.email) {
      return res.status(200).json({
        message: "Lead has no email address.",
        entityType: 'lead',
        entityId: leadId,
        data: [],
        pagination: {
          page: parseInt(page),
          limit: 0,
          offset: 0,
          totalItems: 0,
          totalPages: 0,
          hasMore: false
        }
      });
    }

    // Get user credentials for email visibility filtering
    let currentUserEmail = null;
    try {
      const userCredential = await UserCredential.findOne({
        where: { masterUserID: req.adminId },
        attributes: ['email']
      });
      currentUserEmail = userCredential?.email;
    } catch (error) {
      console.error('Error fetching user credential:', error);
    }

    // Fetch person and organization for email addresses
    let person = null;
    let leadOrganization = null;

    if (lead.personId) {
      person = await Person.findByPk(lead.personId, {
        attributes: ['personId', 'email'],
        raw: true
      });
    }

    if (lead.leadOrganizationId) {
      leadOrganization = await Organization.findByPk(lead.leadOrganizationId, {
        attributes: ['leadOrganizationId', 'organization'],
        raw: true
      });
    }

    const maxBodyLength = 1000;

    // Build email visibility where clause
    let emailVisibilityWhere = {};
    if (currentUserEmail) {
      emailVisibilityWhere = {
        [Op.or]: [
          { visibility: 'shared' },
          { 
            [Op.and]: [
              { visibility: 'private' },
              { userEmail: currentUserEmail }
            ]
          },
          { visibility: { [Op.is]: null } }
        ]
      };
    } else {
      emailVisibilityWhere = {
        [Op.or]: [
          { visibility: 'shared' },
          { visibility: { [Op.is]: null } }
        ]
      };
    }

    // Collect all email addresses associated with this lead
    const leadEmailAddresses = new Set();
    if (lead.email) {
      leadEmailAddresses.add(lead.email.toLowerCase());
    }
    if (person && person.email) {
      leadEmailAddresses.add(person.email.toLowerCase());
    }
    if (leadOrganization && leadOrganization.email) {
      leadEmailAddresses.add(leadOrganization.email.toLowerCase());
    }

    // Fetch ALL emails (no pagination yet - we'll paginate the combined array)
    let emailsByRelationship = [];
    if (leadEmailAddresses.size > 0) {
      const emailAddressArray = Array.from(leadEmailAddresses);
      emailsByRelationship = await Email.findAll({
        where: {
          [Op.and]: [
            {
              [Op.or]: emailAddressArray.flatMap(email => [
                { sender: email },
                { recipient: { [Op.like]: `%${email}%` } }
              ])
            },
            emailVisibilityWhere
          ]
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
          "visibility",
          "userEmail",
          [Sequelize.fn("LEFT", Sequelize.col("body"), maxBodyLength), "body"],
        ],
        include: [
          {
            model: Attachment,
            as: "attachments",
            attributes: ["attachmentID", "filename", "size", "contentType"],
          },
        ],
        order: [["createdAt", "DESC"]]
      });
    }

    // Enrich emails with connected entities (same as main API)
    let relatedEmails = emailsByRelationship;
    
    if (relatedEmails.length > 0) {
      const emailAddresses = new Set();
      
      relatedEmails.forEach(email => {
        if (email.sender) {
          emailAddresses.add(email.sender.toLowerCase());
        }
        if (email.recipient) {
          const recipients = email.recipient.split(/[,;]/).map(r => r.trim().toLowerCase());
          recipients.forEach(recipient => {
            if (recipient && recipient.includes('@')) {
              emailAddresses.add(recipient);
            }
          });
        }
      });
      
      const uniqueEmailAddresses = Array.from(emailAddresses);
      
      // Bulk fetch all related entities
      const [connectedPersons, connectedOrganizations, connectedLeads, connectedDeals] = await Promise.all([
        Person.findAll({
          where: { email: { [Op.in]: uniqueEmailAddresses } },
          attributes: ['personId', 'contactPerson', 'email', 'phone', 'jobTitle', 'leadOrganizationId'],
          raw: true
        }),
        Organization.findAll({
          where: {
            ...(Organization.rawAttributes.email ? { email: { [Op.in]: uniqueEmailAddresses } } : {})
          },
          attributes: ['leadOrganizationId', 'organization', 'address'],
          raw: true
        }),
        Lead.findAll({
          where: { email: { [Op.in]: uniqueEmailAddresses } },
          attributes: ['leadId', 'title', 'email', 'contactPerson', 'organization', 'ownerId', 'status'],
          raw: true
        }),
        Deal.findAll({
          where: {
            ...(Deal.rawAttributes.email ? { email: { [Op.in]: uniqueEmailAddresses } } : {})
          },
          attributes: ['dealId', 'title', 'value', 'currency', 'contactPerson', 'organization', 'ownerId', 'status'],
          raw: true
        })
      ]);
      
      // Create lookup maps
      const personEmailMap = new Map();
      const organizationEmailMap = new Map();
      const leadEmailMap = new Map();
      const dealEmailMap = new Map();
      
      connectedPersons.forEach(person => {
        if (person.email) {
          const emailKey = person.email.toLowerCase();
          if (!personEmailMap.has(emailKey)) {
            personEmailMap.set(emailKey, []);
          }
          personEmailMap.get(emailKey).push(person);
        }
      });
      
      connectedOrganizations.forEach(org => {
        if (org.email) {
          const emailKey = org.email.toLowerCase();
          if (!organizationEmailMap.has(emailKey)) {
            organizationEmailMap.set(emailKey, []);
          }
          organizationEmailMap.get(emailKey).push(org);
        }
      });
      
      connectedLeads.forEach(leadItem => {
        if (leadItem.email) {
          const emailKey = leadItem.email.toLowerCase();
          if (!leadEmailMap.has(emailKey)) {
            leadEmailMap.set(emailKey, []);
          }
          leadEmailMap.get(emailKey).push(leadItem);
        }
      });
      
      connectedDeals.forEach(deal => {
        if (deal.email) {
          const emailKey = deal.email.toLowerCase();
          if (!dealEmailMap.has(emailKey)) {
            dealEmailMap.set(emailKey, []);
          }
          dealEmailMap.get(emailKey).push(deal);
        }
      });
      
      // Enrich each email
      relatedEmails = relatedEmails.map(email => {
        const emailObj = email.toJSON ? email.toJSON() : email;
        
        emailObj.connectedPersons = [];
        emailObj.connectedOrganizations = [];
        emailObj.connectedLeads = [];
        emailObj.connectedDeals = [];
        
        const addConnectedEntities = (emailAddress) => {
          const emailKey = emailAddress.toLowerCase();
          
          if (personEmailMap.has(emailKey)) {
            emailObj.connectedPersons.push(...personEmailMap.get(emailKey));
          }
          if (organizationEmailMap.has(emailKey)) {
            emailObj.connectedOrganizations.push(...organizationEmailMap.get(emailKey));
          }
          if (leadEmailMap.has(emailKey)) {
            emailObj.connectedLeads.push(...leadEmailMap.get(emailKey));
          }
          if (dealEmailMap.has(emailKey)) {
            emailObj.connectedDeals.push(...dealEmailMap.get(emailKey));
          }
        };
        
        if (emailObj.sender) {
          addConnectedEntities(emailObj.sender);
        }
        
        if (emailObj.recipient) {
          const recipients = emailObj.recipient.split(/[,;]/).map(r => r.trim());
          recipients.forEach(recipient => {
            if (recipient && recipient.includes('@')) {
              addConnectedEntities(recipient);
            }
          });
        }
        
        // Remove duplicates
        emailObj.connectedPersons = emailObj.connectedPersons.filter((person, index, self) => 
          index === self.findIndex(p => p.personId === person.personId)
        );
        emailObj.connectedOrganizations = emailObj.connectedOrganizations.filter((org, index, self) => 
          index === self.findIndex(o => o.leadOrganizationId === org.leadOrganizationId)
        );
        emailObj.connectedLeads = emailObj.connectedLeads.filter((leadItem, index, self) => 
          index === self.findIndex(l => l.leadId === leadItem.leadId)
        );
        emailObj.connectedDeals = emailObj.connectedDeals.filter((deal, index, self) => 
          index === self.findIndex(d => d.dealId === deal.dealId)
        );
        
        return emailObj;
      });
    }

    // Fetch ALL lead notes (no pagination yet)
    let notes = [];
    try {
      notes = await LeadNote.findAll({
        where: { leadId },
        attributes: [
          'noteId',
          'leadId',
          'masterUserID',
          'content',
          'createdBy',
          'createdAt',
          'updatedAt'
        ],
        order: [['createdAt', 'DESC']],
        raw: true
      });
      
      // Fetch creator names for notes
      const creatorIds = [...new Set(notes.map(note => note.createdBy).filter(Boolean))];
      let creatorMap = {};
      
      if (creatorIds.length > 0) {
        const creators = await MasterUser.findAll({
          where: { masterUserID: creatorIds },
          attributes: ['masterUserID', 'name'],
          raw: true
        });
        
        creators.forEach(user => {
          creatorMap[user.masterUserID] = user.name;
        });
      }
      
      // Format notes with creator name and type identifier
      notes = notes.map(note => ({
        type: 'note', // Identifier for unified array
        noteId: note.noteId,
        leadId: note.leadId,
        masterUserID: note.masterUserID,
        content: note.content,
        createdBy: note.createdBy,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        creatorName: creatorMap[note.createdBy] || null
      }));
    } catch (error) {
      console.error('Error fetching lead notes:', error);
    }

    // Fetch ALL lead activities (no pagination yet)
    let activities = [];
    try {
      activities = await Activity.findAll({
        where: { leadId },
        attributes: [
          'activityId',
          'type',
          'subject',
          'startDateTime',
          'endDateTime',
          'priority',
          'guests',
          'location',
          'videoCallIntegration',
          'description',
          'status',
          'notes',
          'assignedTo',
          'dealId',
          'leadId',
          'personId',
          'leadOrganizationId',
          'masterUserID',
          'isDone',
          'contactPerson',
          'email',
          'organization',
          'dueDate',
          'markedAsDoneTime',
          'calendar_event_id',
          'activityTypeFlag',
          'allContactPersons',
          'createdAt',
          'updatedAt'
        ],
        order: [['createdAt', 'DESC']],
        raw: true
      });
      
      // Fetch assigned user names for activities
      const assignedToIds = [...new Set(activities.map(activity => activity.assignedTo).filter(Boolean))];
      let assignedUserMap = {};
      
      if (assignedToIds.length > 0) {
        const assignedUsers = await MasterUser.findAll({
          where: { masterUserID: assignedToIds },
          attributes: ['masterUserID', 'name'],
          raw: true
        });
        
        assignedUsers.forEach(user => {
          assignedUserMap[user.masterUserID] = user.name;
        });
      }
      
      // Format activities with assigned user name and type identifier
      activities = activities.map(activity => ({
        type: 'activity', // Identifier for unified array
        activityId: activity.activityId,
        activityType: activity.type,
        subject: activity.subject,
        startDateTime: activity.startDateTime,
        endDateTime: activity.endDateTime,
        priority: activity.priority,
        guests: activity.guests,
        location: activity.location,
        videoCallIntegration: activity.videoCallIntegration,
        description: activity.description,
        status: activity.status,
        notes: activity.notes,
        assignedTo: activity.assignedTo,
        dealId: activity.dealId,
        leadId: activity.leadId,
        personId: activity.personId,
        leadOrganizationId: activity.leadOrganizationId,
        masterUserID: activity.masterUserID,
        isDone: activity.isDone,
        contactPerson: activity.contactPerson,
        email: activity.email,
        organization: activity.organization,
        dueDate: activity.dueDate,
        markedAsDoneTime: activity.markedAsDoneTime,
        calendar_event_id: activity.calendar_event_id,
        activityTypeFlag: activity.activityTypeFlag,
        allContactPersons: activity.allContactPersons,
        createdAt: activity.createdAt,
        updatedAt: activity.updatedAt,
        assignedToName: assignedUserMap[activity.assignedTo] || null
      }));
    } catch (error) {
      console.error('Error fetching lead activities:', error);
    }

    // Add type identifier and entityType to emails
    const emailsWithType = relatedEmails.map(email => ({
      type: 'email', // Identifier for unified array
      entityType: 'lead', // Entity this timeline belongs to
      ...email
    }));

    // Add entityType to notes
    notes = notes.map(note => ({
      ...note,
      entityType: 'lead'
    }));

    // Add entityType to activities
    activities = activities.map(activity => ({
      ...activity,
      entityType: 'lead'
    }));

    // Combine all items into a single array
    const allItems = [
      ...emailsWithType,
      ...notes,
      ...activities
    ];

    // Sort by createdAt (latest first)
    allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Get total count
    const totalItems = allItems.length;

    // Apply pagination to combined array
    const paginatedItems = allItems.slice(offset, offset + maxLimit);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / maxLimit);
    const hasMore = parseInt(page) < totalPages;

    res.status(200).json({
      message: "Lead timeline fetched successfully.",
      entityType: 'lead',
      entityId: leadId,
      data: paginatedItems, // Single unified array
      pagination: {
        page: parseInt(page),
        limit: maxLimit,
        offset: offset,
        totalItems: totalItems,
        totalPages: totalPages,
        hasMore: hasMore,
        hasPrevPage: parseInt(page) > 1,
        nextPage: hasMore ? parseInt(page) + 1 : null,
        prevPage: parseInt(page) > 1 ? parseInt(page) - 1 : null
      },
      summary: {
        totalEmails: emailsWithType.length,
        totalNotes: notes.length,
        totalActivities: activities.length,
        totalItems: totalItems,
        itemsInPage: paginatedItems.length,
        sorting: "createdAt DESC (latest first)"
      },
      _metadata: {
        bodyTruncated: true,
        bodyMaxLength: maxBodyLength,
        note: "Email bodies are truncated for performance. Use separate email detail API for full content.",
        dataStructure: "Unified array with type (email, note, activity) and entityType (lead, deal, person, organization)"
      }
    });
  } catch (error) {
    console.error("Error fetching lead emails:", error);
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "LEAD_EMAILS_FETCH",
      masterUserID,
      `Lead emails fetch failed: ${error.message}`,
      null
    );
    res.status(500).json({ message: "Internal server error." });
  }
};

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

// Get unified timeline for Deal (emails, activities, notes) - same as getLeadEmails
exports.getDealTimeline = async (req, res) => {
  const masterUserID = req.adminId;
  const { dealId } = req.params;

  const { 
    page = 1, 
    limit = 20
  } = req.query;
  
  const offset = (page - 1) * limit;
  const maxLimit = Math.min(parseInt(limit) || 20, 50);

  if (!dealId) {
    return res.status(400).json({ message: "dealId is required in params." });
  }

  try {
    const deal = await Deal.findByPk(dealId, {
      attributes: ['dealId', 'email', 'personId', 'leadOrganizationId']
    });
    
    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }

    if (!deal.email) {
      return res.status(200).json({
        message: "Deal has no email address.",
        entityType: 'deal',
        entityId: dealId,
        data: [],
        pagination: {
          page: parseInt(page),
          limit: 0,
          offset: 0,
          totalItems: 0,
          totalPages: 0,
          hasMore: false
        }
      });
    }

    let currentUserEmail = null;
    try {
      const userCredential = await UserCredential.findOne({
        where: { masterUserID: req.adminId },
        attributes: ['email']
      });
      currentUserEmail = userCredential?.email;
    } catch (error) {
      console.error('Error fetching user credential:', error);
    }

    let person = null;
    let organization = null;

    if (deal.personId) {
      person = await Person.findByPk(deal.personId, {
        attributes: ['personId', 'email'],
        raw: true
      });
    }

    if (deal.leadOrganizationId) {
      organization = await Organization.findByPk(deal.leadOrganizationId, {
        attributes: ['leadOrganizationId', 'organization'],
        raw: true
      });
    }

    const maxBodyLength = 1000;

    let emailVisibilityWhere = {};
    if (currentUserEmail) {
      emailVisibilityWhere = {
        [Op.or]: [
          { visibility: 'shared' },
          { 
            [Op.and]: [
              { visibility: 'private' },
              { userEmail: currentUserEmail }
            ]
          },
          { visibility: { [Op.is]: null } }
        ]
      };
    } else {
      emailVisibilityWhere = {
        [Op.or]: [
          { visibility: 'shared' },
          { visibility: { [Op.is]: null } }
        ]
      };
    }

    const dealEmailAddresses = new Set();
    if (deal.email) dealEmailAddresses.add(deal.email.toLowerCase());
    if (person && person.email) dealEmailAddresses.add(person.email.toLowerCase());
    if (organization && organization.email) dealEmailAddresses.add(organization.email.toLowerCase());

    let emailsByRelationship = [];
    if (dealEmailAddresses.size > 0) {
      const emailAddressArray = Array.from(dealEmailAddresses);
      emailsByRelationship = await Email.findAll({
        where: {
          [Op.and]: [
            {
              [Op.or]: emailAddressArray.flatMap(email => [
                { sender: email },
                { recipient: { [Op.like]: `%${email}%` } }
              ])
            },
            emailVisibilityWhere
          ]
        },
        attributes: [
          "emailID", "messageId", "inReplyTo", "references",
          "sender", "recipient", "subject", "createdAt",
          "folder", "visibility", "userEmail",
          [Sequelize.fn("LEFT", Sequelize.col("body"), maxBodyLength), "body"],
        ],
        include: [{
          model: Attachment,
          as: "attachments",
          attributes: ["attachmentID", "filename", "size", "contentType"],
        }],
        order: [["createdAt", "DESC"]]
      });
    }

    const emailsWithType = emailsByRelationship.map(email => ({
      type: 'email',
      entityType: 'deal',
      ...(email.toJSON ? email.toJSON() : email)
    }));

    let notes = await DealNote.findAll({
      where: { dealId },
      attributes: ['noteId', 'dealId', 'content', 'createdBy', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']],
      raw: true
    });

    const creatorIds = [...new Set(notes.map(note => note.createdBy).filter(Boolean))];
    let creatorMap = {};
    
    if (creatorIds.length > 0) {
      const creators = await MasterUser.findAll({
        where: { masterUserID: creatorIds },
        attributes: ['masterUserID', 'name'],
        raw: true
      });
      creators.forEach(user => {
        creatorMap[user.masterUserID] = user.name;
      });
    }

    notes = notes.map(note => ({
      type: 'note',
      entityType: 'deal',
      noteId: note.noteId,
      dealId: note.dealId,
      content: note.content,
      createdBy: note.createdBy,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      creatorName: creatorMap[note.createdBy] || null
    }));

    let activities = await Activity.findAll({
      where: { dealId },
      attributes: [
        'activityId', 'type', 'subject', 'startDateTime', 'endDateTime',
        'priority', 'guests', 'location', 'videoCallIntegration',
        'description', 'status', 'notes', 'assignedTo', 'dealId',
        'leadId', 'personId', 'leadOrganizationId', 'masterUserID',
        'isDone', 'contactPerson', 'email', 'organization', 'dueDate',
        'markedAsDoneTime', 'calendar_event_id', 'activityTypeFlag',
        'allContactPersons', 'createdAt', 'updatedAt'
      ],
      order: [['createdAt', 'DESC']],
      raw: true
    });

    const assignedToIds = [...new Set(activities.map(activity => activity.assignedTo).filter(Boolean))];
    let assignedUserMap = {};
    
    if (assignedToIds.length > 0) {
      const assignedUsers = await MasterUser.findAll({
        where: { masterUserID: assignedToIds },
        attributes: ['masterUserID', 'name'],
        raw: true
      });
      assignedUsers.forEach(user => {
        assignedUserMap[user.masterUserID] = user.name;
      });
    }

    activities = activities.map(activity => ({
      type: 'activity',
      entityType: 'deal',
      ...activity,
      activityType: activity.type,
      assignedToName: assignedUserMap[activity.assignedTo] || null
    }));

    const allItems = [...emailsWithType, ...notes, ...activities];
    allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalItems = allItems.length;
    const paginatedItems = allItems.slice(offset, offset + maxLimit);
    const totalPages = Math.ceil(totalItems / maxLimit);
    const hasMore = parseInt(page) < totalPages;

    res.status(200).json({
      message: "Deal timeline fetched successfully.",
      entityType: 'deal',
      entityId: dealId,
      data: paginatedItems,
      pagination: {
        page: parseInt(page),
        limit: maxLimit,
        offset: offset,
        totalItems: totalItems,
        totalPages: totalPages,
        hasMore: hasMore,
        hasPrevPage: parseInt(page) > 1,
        nextPage: hasMore ? parseInt(page) + 1 : null,
        prevPage: parseInt(page) > 1 ? parseInt(page) - 1 : null
      },
      summary: {
        totalEmails: emailsWithType.length,
        totalNotes: notes.length,
        totalActivities: activities.length,
        totalItems: totalItems,
        itemsInPage: paginatedItems.length,
        sorting: "createdAt DESC (latest first)"
      },
      _metadata: {
        bodyTruncated: true,
        bodyMaxLength: maxBodyLength,
        note: "Email bodies are truncated for performance.",
        dataStructure: "Unified array with type (email, note, activity) and entityType (deal)"
      }
    });
  } catch (error) {
    console.error("Error fetching deal timeline:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Get unified timeline for Person (emails, activities, notes)
exports.getPersonTimeline = async (req, res) => {
  const masterUserID = req.adminId;
  const { personId } = req.params;

  const { 
    page = 1, 
    limit = 20
  } = req.query;
  
  const offset = (page - 1) * limit;
  const maxLimit = Math.min(parseInt(limit) || 20, 50);

  if (!personId) {
    return res.status(400).json({ message: "personId is required in params." });
  }

  try {
    const person = await Person.findByPk(personId, {
      attributes: ['personId', 'email', 'leadOrganizationId']
    });
    
    if (!person) {
      return res.status(404).json({ message: "Person not found." });
    }

    if (!person.email) {
      return res.status(200).json({
        message: "Person has no email address.",
        entityType: 'person',
        entityId: personId,
        data: [],
        pagination: {
          page: parseInt(page),
          limit: 0,
          offset: 0,
          totalItems: 0,
          totalPages: 0,
          hasMore: false
        }
      });
    }

    let currentUserEmail = null;
    try {
      const userCredential = await UserCredential.findOne({
        where: { masterUserID: req.adminId },
        attributes: ['email']
      });
      currentUserEmail = userCredential?.email;
    } catch (error) {
      console.error('Error fetching user credential:', error);
    }

    const maxBodyLength = 1000;

    let emailVisibilityWhere = {};
    if (currentUserEmail) {
      emailVisibilityWhere = {
        [Op.or]: [
          { visibility: 'shared' },
          { 
            [Op.and]: [
              { visibility: 'private' },
              { userEmail: currentUserEmail }
            ]
          },
          { visibility: { [Op.is]: null } }
        ]
      };
    } else {
      emailVisibilityWhere = {
        [Op.or]: [
          { visibility: 'shared' },
          { visibility: { [Op.is]: null } }
        ]
      };
    }

    const personEmailAddresses = new Set();
    if (person.email) personEmailAddresses.add(person.email.toLowerCase());

    let emailsByRelationship = [];
    if (personEmailAddresses.size > 0) {
      const emailAddressArray = Array.from(personEmailAddresses);
      emailsByRelationship = await Email.findAll({
        where: {
          [Op.and]: [
            {
              [Op.or]: emailAddressArray.flatMap(email => [
                { sender: email },
                { recipient: { [Op.like]: `%${email}%` } }
              ])
            },
            emailVisibilityWhere
          ]
        },
        attributes: [
          "emailID", "messageId", "inReplyTo", "references",
          "sender", "recipient", "subject", "createdAt",
          "folder", "visibility", "userEmail",
          [Sequelize.fn("LEFT", Sequelize.col("body"), maxBodyLength), "body"],
        ],
        include: [{
          model: Attachment,
          as: "attachments",
          attributes: ["attachmentID", "filename", "size", "contentType"],
        }],
        order: [["createdAt", "DESC"]]
      });
    }

    const emailsWithType = emailsByRelationship.map(email => ({
      type: 'email',
      entityType: 'person',
      ...(email.toJSON ? email.toJSON() : email)
    }));

    let activities = await Activity.findAll({
      where: { personId },
      attributes: [
        'activityId', 'type', 'subject', 'startDateTime', 'endDateTime',
        'priority', 'guests', 'location', 'videoCallIntegration',
        'description', 'status', 'notes', 'assignedTo', 'dealId',
        'leadId', 'personId', 'leadOrganizationId', 'masterUserID',
        'isDone', 'contactPerson', 'email', 'organization', 'dueDate',
        'markedAsDoneTime', 'calendar_event_id', 'activityTypeFlag',
        'allContactPersons', 'createdAt', 'updatedAt'
      ],
      order: [['createdAt', 'DESC']],
      raw: true
    });

    const assignedToIds = [...new Set(activities.map(activity => activity.assignedTo).filter(Boolean))];
    let assignedUserMap = {};
    
    if (assignedToIds.length > 0) {
      const assignedUsers = await MasterUser.findAll({
        where: { masterUserID: assignedToIds },
        attributes: ['masterUserID', 'name'],
        raw: true
      });
      assignedUsers.forEach(user => {
        assignedUserMap[user.masterUserID] = user.name;
      });
    }

    activities = activities.map(activity => ({
      type: 'activity',
      entityType: 'person',
      ...activity,
      activityType: activity.type,
      assignedToName: assignedUserMap[activity.assignedTo] || null
    }));

    const allItems = [...emailsWithType, ...activities];
    allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalItems = allItems.length;
    const paginatedItems = allItems.slice(offset, offset + maxLimit);
    const totalPages = Math.ceil(totalItems / maxLimit);
    const hasMore = parseInt(page) < totalPages;

    res.status(200).json({
      message: "Person timeline fetched successfully.",
      entityType: 'person',
      entityId: personId,
      data: paginatedItems,
      pagination: {
        page: parseInt(page),
        limit: maxLimit,
        offset: offset,
        totalItems: totalItems,
        totalPages: totalPages,
        hasMore: hasMore,
        hasPrevPage: parseInt(page) > 1,
        nextPage: hasMore ? parseInt(page) + 1 : null,
        prevPage: parseInt(page) > 1 ? parseInt(page) - 1 : null
      },
      summary: {
        totalEmails: emailsWithType.length,
        totalNotes: 0,
        totalActivities: activities.length,
        totalItems: totalItems,
        itemsInPage: paginatedItems.length,
        sorting: "createdAt DESC (latest first)"
      },
      _metadata: {
        bodyTruncated: true,
        bodyMaxLength: maxBodyLength,
        note: "Email bodies are truncated for performance. Person entity does not have notes.",
        dataStructure: "Unified array with type (email, activity) and entityType (person)"
      }
    });
  } catch (error) {
    console.error("Error fetching person timeline:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Get unified timeline for Organization (emails, activities)
exports.getOrganizationTimeline = async (req, res) => {
  const masterUserID = req.adminId;
  const { organizationId } = req.params;

  const { 
    page = 1, 
    limit = 20
  } = req.query;
  
  const offset = (page - 1) * limit;
  const maxLimit = Math.min(parseInt(limit) || 20, 50);

  if (!organizationId) {
    return res.status(400).json({ message: "organizationId is required in params." });
  }

  try {
    const organization = await Organization.findByPk(organizationId, {
      attributes: ['leadOrganizationId', 'organization']
    });
    
    if (!organization) {
      return res.status(404).json({ message: "Organization not found." });
    }

    // Find all persons belonging to this organization
    const persons = await Person.findAll({
      where: { leadOrganizationId: organizationId },
      attributes: ['personId', 'email'],
      raw: true
    });

    const orgEmailAddresses = new Set();
    persons.forEach(person => {
      if (person.email) orgEmailAddresses.add(person.email.toLowerCase());
    });

    if (orgEmailAddresses.size === 0) {
      return res.status(200).json({
        message: "Organization has no associated email addresses.",
        entityType: 'organization',
        entityId: organizationId,
        data: [],
        pagination: {
          page: parseInt(page),
          limit: 0,
          offset: 0,
          totalItems: 0,
          totalPages: 0,
          hasMore: false
        }
      });
    }

    let currentUserEmail = null;
    try {
      const userCredential = await UserCredential.findOne({
        where: { masterUserID: req.adminId },
        attributes: ['email']
      });
      currentUserEmail = userCredential?.email;
    } catch (error) {
      console.error('Error fetching user credential:', error);
    }

    const maxBodyLength = 1000;

    let emailVisibilityWhere = {};
    if (currentUserEmail) {
      emailVisibilityWhere = {
        [Op.or]: [
          { visibility: 'shared' },
          { 
            [Op.and]: [
              { visibility: 'private' },
              { userEmail: currentUserEmail }
            ]
          },
          { visibility: { [Op.is]: null } }
        ]
      };
    } else {
      emailVisibilityWhere = {
        [Op.or]: [
          { visibility: 'shared' },
          { visibility: { [Op.is]: null } }
        ]
      };
    }

    let emailsByRelationship = [];
    if (orgEmailAddresses.size > 0) {
      const emailAddressArray = Array.from(orgEmailAddresses);
      emailsByRelationship = await Email.findAll({
        where: {
          [Op.and]: [
            {
              [Op.or]: emailAddressArray.flatMap(email => [
                { sender: email },
                { recipient: { [Op.like]: `%${email}%` } }
              ])
            },
            emailVisibilityWhere
          ]
        },
        attributes: [
          "emailID", "messageId", "inReplyTo", "references",
          "sender", "recipient", "subject", "createdAt",
          "folder", "visibility", "userEmail",
          [Sequelize.fn("LEFT", Sequelize.col("body"), maxBodyLength), "body"],
        ],
        include: [{
          model: Attachment,
          as: "attachments",
          attributes: ["attachmentID", "filename", "size", "contentType"],
        }],
        order: [["createdAt", "DESC"]]
      });
    }

    const emailsWithType = emailsByRelationship.map(email => ({
      type: 'email',
      entityType: 'organization',
      ...(email.toJSON ? email.toJSON() : email)
    }));

    let activities = await Activity.findAll({
      where: { leadOrganizationId: organizationId },
      attributes: [
        'activityId', 'type', 'subject', 'startDateTime', 'endDateTime',
        'priority', 'guests', 'location', 'videoCallIntegration',
        'description', 'status', 'notes', 'assignedTo', 'dealId',
        'leadId', 'personId', 'leadOrganizationId', 'masterUserID',
        'isDone', 'contactPerson', 'email', 'organization', 'dueDate',
        'markedAsDoneTime', 'calendar_event_id', 'activityTypeFlag',
        'allContactPersons', 'createdAt', 'updatedAt'
      ],
      order: [['createdAt', 'DESC']],
      raw: true
    });

    const assignedToIds = [...new Set(activities.map(activity => activity.assignedTo).filter(Boolean))];
    let assignedUserMap = {};
    
    if (assignedToIds.length > 0) {
      const assignedUsers = await MasterUser.findAll({
        where: { masterUserID: assignedToIds },
        attributes: ['masterUserID', 'name'],
        raw: true
      });
      assignedUsers.forEach(user => {
        assignedUserMap[user.masterUserID] = user.name;
      });
    }

    activities = activities.map(activity => ({
      type: 'activity',
      entityType: 'organization',
      ...activity,
      activityType: activity.type,
      assignedToName: assignedUserMap[activity.assignedTo] || null
    }));

    const allItems = [...emailsWithType, ...activities];
    allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalItems = allItems.length;
    const paginatedItems = allItems.slice(offset, offset + maxLimit);
    const totalPages = Math.ceil(totalItems / maxLimit);
    const hasMore = parseInt(page) < totalPages;

    res.status(200).json({
      message: "Organization timeline fetched successfully.",
      entityType: 'organization',
      entityId: organizationId,
      data: paginatedItems,
      pagination: {
        page: parseInt(page),
        limit: maxLimit,
        offset: offset,
        totalItems: totalItems,
        totalPages: totalPages,
        hasMore: hasMore,
        hasPrevPage: parseInt(page) > 1,
        nextPage: hasMore ? parseInt(page) + 1 : null,
        prevPage: parseInt(page) > 1 ? parseInt(page) - 1 : null
      },
      summary: {
        totalEmails: emailsWithType.length,
        totalNotes: 0,
        totalActivities: activities.length,
        totalItems: totalItems,
        itemsInPage: paginatedItems.length,
        sorting: "createdAt DESC (latest first)"
      },
      _metadata: {
        bodyTruncated: true,
        bodyMaxLength: maxBodyLength,
        note: "Email bodies are truncated for performance. Organization entity does not have notes.",
        dataStructure: "Unified array with type (email, activity) and entityType (organization)",
        emailSources: `Fetched from ${persons.length} persons associated with this organization`
      }
    });
  } catch (error) {
    console.error("Error fetching organization timeline:", error);
    res.status(500).json({ message: "Internal server error." });
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

// Convert multiple leads to deals
exports.convertBulkLeadsToDeals = async (req, res) => {
  const { leadIds, dealData = {} } = req.body;

  // Validation
  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    return res.status(400).json({
      message: "leadIds array is required and must contain at least one lead ID.",
    });
  }

  // Limit bulk operations to reasonable size
  if (leadIds.length > 100) {
    return res.status(400).json({
      message: "Maximum 100 leads can be converted at once.",
    });
  }

  try {
    // Check if user has permission to convert leads
    if (!["admin", "general", "master"].includes(req.role)) {
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT,
        "BULK_LEAD_CONVERSION",
        req.adminId,
        "Access denied. You do not have permission to convert leads to deals.",
        null
      );
      return res.status(403).json({
        message: "Access denied. You do not have permission to convert leads to deals.",
      });
    }

    // Get user's visibility permissions for validation
    const userPermissions = await getUserLeadVisibilityPermissions(req.adminId, req.role);

    // Fetch all leads to be converted with related data
    let whereClause = {
      leadId: { [Op.in]: leadIds },
      isArchived: false, // Only convert non-archived leads
      dealId: null // Only convert leads that haven't been converted yet
    };

    // Apply visibility filtering for non-admin users
    if (req.role !== "admin") {
      if (userPermissions.canEdit === "owner_only") {
        whereClause[Op.or] = [
          { masterUserID: req.adminId },
          { ownerId: req.adminId }
        ];
      } else if (userPermissions.canEdit === "group_only" && userPermissions.userGroup) {
        // Get group members
        const groupMembers = await GroupMembership.findAll({
          where: {
            groupId: userPermissions.userGroup.groupId,
            isActive: true,
          },
          attributes: ["userId"],
        });
        const memberIds = groupMembers.map((member) => member.userId);
        
        whereClause[Op.or] = [
          { masterUserID: { [Op.in]: memberIds } },
          { ownerId: { [Op.in]: memberIds } }
        ];
      }
    }

    const leads = await Lead.findAll({
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

    if (leads.length === 0) {
      return res.status(404).json({
        message: "No eligible leads found for conversion. Leads may already be converted, archived, or you may not have permission to access them.",
        requestedIds: leadIds,
      });
    }

    if (leads.length < leadIds.length) {
      const foundIds = leads.map(lead => lead.leadId);
      const notFoundIds = leadIds.filter(id => !foundIds.includes(id));
      console.warn(`Some leads were not found or not eligible: ${notFoundIds.join(', ')}`);
    }

    // Get owner information
    const owner = await MasterUser.findOne({
      where: { masterUserID: req.adminId },
    });
    const ownerName = owner ? owner.name : null;

    const convertedDeals = [];
    const failedConversions = [];
    const transaction = await sequelize.transaction();

    try {
      // Process each lead conversion
      for (const lead of leads) {
        try {
          // Prepare deal data by mapping lead fields to deal fields
          const dealPayload = {
            // Core identification
            leadId: lead.leadId,
            personId: lead.personId,
            leadOrganizationId: lead.leadOrganizationId,
            
            // Contact information (from lead)
            contactPerson: lead.contactPerson,
            organization: lead.organization,
            phone: lead.phone,
            email: lead.email,
            
            // Deal-specific information
            title: dealData.title || lead.title || `Deal: ${lead.title}`,
            value: dealData.value || lead.value || lead.proposalValue || 0,
            currency: dealData.currency || lead.valueCurrency || lead.proposalValueCurrency || "INR",
            
            // Pipeline information
            pipeline: dealData.pipeline || lead.pipeline || "Default Pipeline",
            stage: dealData.stage || lead.stage || "New Deal",
            pipelineStage: dealData.pipelineStage || lead.stage || "New Deal",
            
            // Dates
            expectedCloseDate: dealData.expectedCloseDate || lead.expectedCloseDate,
            
            // Source information
            sourceChannel: lead.sourceChannel,
            sourceChannelId: lead.sourceChannelID,
            sourceOrgin: lead.sourceOrgin,
            source: dealData.source || lead.sourceChannel,
            
            // Business information
            serviceType: lead.serviceType,
            proposalValue: lead.proposalValue,
            proposalCurrency: lead.proposalValueCurrency || "INR",
            esplProposalNo: lead.esplProposalNo,
            projectLocation: lead.projectLocation,
            organizationCountry: lead.organizationCountry,
            proposalSentDate: lead.proposalSentDate,
            sbuClass: lead.SBUClass,
            
            // System fields
            masterUserID: req.adminId,
            ownerId: dealData.ownerId || lead.ownerId || req.adminId,
            
            // Additional deal fields
            label: dealData.label,
            productName: dealData.productName || lead.productName,
            probability: dealData.probability || 50, // Default probability
            
            // Currency fields
            valueCurrency: dealData.valueCurrency || lead.valueCurrency || "INR",
            proposalValueCurrency: dealData.proposalValueCurrency || lead.proposalValueCurrency || "INR",
            
            // Status
            status: dealData.status || "Open",
            isArchived: false,
          };

          // Create the deal
          const newDeal = await Deal.create(dealPayload, { transaction });

          // Create deal details if lead has details
          if (lead.details) {
            await DealDetails.create({
              dealId: newDeal.dealId,
              responsiblePerson: lead.details.responsiblePerson || ownerName,
              sourceOrgin: lead.details.sourceOrgin || lead.sourceOrgin,
              currency: lead.details.currency || dealPayload.currency,
            }, { transaction });
          }

          // Update the lead to mark it as converted
          await Lead.update(
            { 
              dealId: newDeal.dealId,
              status: "Converted to Deal",
            },
            { 
              where: { leadId: lead.leadId },
              transaction 
            }
          );

          // Copy custom fields from lead to deal
          try {
            const leadCustomFields = await CustomFieldValue.findAll({
              where: {
                entityId: lead.leadId,
                entityType: "lead",
              },
              include: [
                {
                  model: CustomField,
                  as: "CustomField",
                  where: {
                    isActive: true,
                    entityType: { [Op.in]: ["lead", "deal", "both"] }, // Fields that can be applied to deals
                  },
                  required: true,
                },
              ],
              transaction,
            });

            // Create corresponding deal custom fields
            for (const leadCustomField of leadCustomFields) {
              // Check if a similar custom field exists for deals
              let dealCustomField = await CustomField.findOne({
                where: {
                  fieldName: leadCustomField.CustomField.fieldName,
                  entityType: { [Op.in]: ["deal", "both"] },
                  isActive: true,
                  [Op.or]: [
                    { masterUserID: req.adminId },
                    { fieldSource: "default" },
                    { fieldSource: "system" },
                  ],
                },
                transaction,
              });

              if (dealCustomField) {
                await CustomFieldValue.create({
                  fieldId: dealCustomField.fieldId,
                  entityId: newDeal.dealId,
                  entityType: "deal",
                  value: leadCustomField.value,
                  masterUserID: req.adminId,
                }, { transaction });
              }
            }
          } catch (customFieldError) {
            console.warn(`Failed to copy custom fields for lead ${lead.leadId}:`, customFieldError.message);
            // Don't fail the conversion, just log the warning
          }

          // Link activities from lead to deal
          try {
            await Activity.update(
              { dealId: newDeal.dealId },
              { 
                where: { leadId: lead.leadId },
                transaction 
              }
            );
          } catch (activityError) {
            console.warn(`Failed to link activities for lead ${lead.leadId}:`, activityError.message);
          }

          // Link emails from lead to deal
          try {
            await Email.update(
              { dealId: newDeal.dealId },
              { 
                where: { leadId: lead.leadId },
                transaction 
              }
            );
          } catch (emailError) {
            console.warn(`Failed to link emails for lead ${lead.leadId}:`, emailError.message);
          }

          // Copy lead notes to deal notes
          try {
            const leadNotes = await LeadNote.findAll({
              where: { leadId: lead.leadId },
              transaction,
            });

            for (const note of leadNotes) {
              await DealNote.create({
                dealId: newDeal.dealId,
                note: note.note,
                masterUserID: note.masterUserID,
                createdAt: note.createdAt,
              }, { transaction });
            }
          } catch (noteError) {
            console.warn(`Failed to copy notes for lead ${lead.leadId}:`, noteError.message);
          }

          convertedDeals.push({
            leadId: lead.leadId,
            dealId: newDeal.dealId,
            title: newDeal.title,
            contactPerson: newDeal.contactPerson,
            organization: newDeal.organization,
            value: newDeal.value,
            currency: newDeal.currency,
            stage: newDeal.stage,
          });

          // Log the successful conversion
          await historyLogger(
            PROGRAMS.LEAD_MANAGEMENT,
            "LEAD_TO_DEAL_CONVERSION",
            req.adminId,
            lead.leadId,
            newDeal.dealId,
            `Lead "${lead.title}" converted to deal by ${req.role}`,
            {
              leadId: lead.leadId,
              dealId: newDeal.dealId,
              convertedBy: req.adminId,
              conversionDate: new Date(),
            },
            transaction
          );

        } catch (individualError) {
          console.error(`Failed to convert lead ${lead.leadId}:`, individualError);
          failedConversions.push({
            leadId: lead.leadId,
            title: lead.title,
            error: individualError.message,
          });
        }
      }

      // Commit the transaction if at least one conversion succeeded
      if (convertedDeals.length > 0) {
        await transaction.commit();

        // Log the bulk conversion audit trail
        await logAuditTrail(
          PROGRAMS.LEAD_MANAGEMENT,
          "BULK_LEAD_TO_DEAL_CONVERSION",
          req.adminId,
          `Bulk conversion completed: ${convertedDeals.length} leads converted to deals, ${failedConversions.length} failed`,
          {
            convertedCount: convertedDeals.length,
            failedCount: failedConversions.length,
            convertedLeadIds: convertedDeals.map(d => d.leadId),
            failedLeadIds: failedConversions.map(f => f.leadId),
          }
        );

        return res.status(200).json({
          message: `Bulk lead conversion completed successfully`,
          summary: {
            totalRequested: leadIds.length,
            totalEligible: leads.length,
            successfulConversions: convertedDeals.length,
            failedConversions: failedConversions.length,
          },
          convertedDeals,
          failedConversions: failedConversions.length > 0 ? failedConversions : undefined,
        });

      } else {
        // Rollback if no conversions succeeded
        await transaction.rollback();
        return res.status(400).json({
          message: "No leads were successfully converted to deals",
          failedConversions,
        });
      }

    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }

  } catch (error) {
    console.error("Error during bulk lead to deal conversion:", error);

    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "BULK_LEAD_TO_DEAL_CONVERSION",
      req.adminId,
      "Error during bulk lead to deal conversion: " + error.message,
      null
    );

    res.status(500).json({
      message: "Internal server error during bulk lead to deal conversion",
      error: error.message,
    });
  }
};

// ===========================================
// LABEL MANAGEMENT FUNCTIONS FOR LEADS
// ===========================================

/**
 * Get all available labels for all entity types or specific entity type
 */
exports.getLeadLabels = async (req, res) => {
  try {
    const { entityType } = req.query; // Optional query parameter to filter by entity type
    
    // Build where clause - if entityType provided, filter by it, otherwise get all active labels
    let whereClause = { isActive: true };
    
    if (entityType) {
      // Validate entity type
      const validEntityTypes = ['lead', 'deal', 'sale-inbox', 'email', 'contact',"person","organization", 'all'];
      if (!validEntityTypes.includes(entityType)) {
        return res.status(400).json({
          message: `Invalid entity type. Valid types are: ${validEntityTypes.join(', ')}`
        });
      }
      whereClause.entityType = entityType;
    }

    const labels = await Label.findAll({
      where: whereClause,
      attributes: [
        'labelId',
        'labelName', 
        'labelColor',
        'entityType',
        'description',
        'createdBy',
        'creationDate'
      ],
      order: [['entityType', 'ASC'], ['labelName', 'ASC']] // Order by entity type first, then label name
    });

    // Group labels by entity type for better organization
    const labelsByEntityType = {};
    labels.forEach(label => {
      if (!labelsByEntityType[label.entityType]) {
        labelsByEntityType[label.entityType] = [];
      }
      labelsByEntityType[label.entityType].push(label);
    });

    res.status(200).json({
      message: entityType ? 
        `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} labels fetched successfully` :
        "All labels fetched successfully",
      labels: labels,
      labelsByEntityType: labelsByEntityType,
      count: labels.length,
      entityTypeFilter: entityType || 'all',
      availableEntityTypes: Object.keys(labelsByEntityType)
    });

  } catch (error) {
    console.error("Error fetching labels:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error.message 
    });
  }
};

/**
 * Create a new label for leads
 */
exports.createLeadLabel = async (req, res) => {
  try {
    const { labelName, labelColor, description, entityType } = req.body;

    // Validation
    if (!labelName || !labelName.trim()) {
      return res.status(400).json({ 
        message: "Label name is required." 
      });
    }

    // Validate and set entityType - default to 'lead' if not provided
    const validEntityTypes = ['lead', 'deal', 'sale-inbox', 'email', 'contact',"person","organization", 'all'];
    const targetEntityType = entityType && validEntityTypes.includes(entityType) ? entityType : 'lead';

    // Check if label already exists for the same entity type
    const existingLabel = await Label.findOne({
      where: {
        labelName: labelName.trim(),
        entityType: targetEntityType,
        isActive: true
      }
    });

    if (existingLabel) {
      return res.status(409).json({
        message: `A label with this name already exists for ${targetEntityType} entity.`,
        existingLabel: {
          labelId: existingLabel.labelId,
          labelName: existingLabel.labelName,
          labelColor: existingLabel.labelColor,
          entityType: existingLabel.entityType
        }
      });
    }

    // Get user info for audit
    const user = await MasterUser.findByPk(req.adminId);
    const userName = user ? user.name : 'Unknown User';

    // Create the label
    const newLabel = await Label.create({
      labelName: labelName.trim(),
      labelColor: labelColor || '#007bff', // Default blue color
      entityType: targetEntityType,
      description: description || null,
      isActive: true,
      createdBy: userName,
      createdById: req.adminId,
      mode: 'CREATE_LABEL'
    });

    // Log audit trail
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "CREATE_LABEL",
      req.adminId,
      `Created new ${targetEntityType} label: ${labelName}`,
      newLabel.labelId
    );

    res.status(201).json({
      message: `${targetEntityType.charAt(0).toUpperCase() + targetEntityType.slice(1)} label created successfully`,
      label: {
        labelId: newLabel.labelId,
        labelName: newLabel.labelName,
        labelColor: newLabel.labelColor,
        entityType: newLabel.entityType,
        description: newLabel.description,
        createdBy: newLabel.createdBy,
        creationDate: newLabel.creationDate
      }
    });

  } catch (error) {
    console.error("Error creating lead label:", error);
    
    // Handle validation errors
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        message: "Validation error",
        errors: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    res.status(500).json({ 
      message: "Internal server error",
      error: error.message 
    });
  }
};

/**
 * Update/Edit a particular label
 */
exports.updateLeadLabel = async (req, res) => {
  try {
    const { labelId } = req.params;
    const { labelName, labelColor, description } = req.body;

    // Validation
    if (!labelId || !labelId.trim()) {
      return res.status(400).json({ 
        message: "Label ID is required." 
      });
    }

    // Find the existing label - now supports any entity type
    const existingLabel = await Label.findOne({
      where: {
        labelId: labelId.trim(),
        isActive: true
      }
    });

    if (!existingLabel) {
      return res.status(404).json({
        message: "Label not found or has been deactivated."
      });
    }

    // Prepare update data
    const updateData = {};
    
    // Only update provided fields
    if (labelName && labelName.trim() && labelName.trim() !== existingLabel.labelName) {
      // Check if new name already exists for the same entity type (excluding current label)
      const duplicateLabel = await Label.findOne({
        where: {
          labelName: labelName.trim(),
          entityType: existingLabel.entityType, // Check within same entity type
          isActive: true,
          labelId: { [Op.ne]: labelId }
        }
      });

      if (duplicateLabel) {
        return res.status(409).json({
          message: `A label with this name already exists for ${existingLabel.entityType} entity.`,
          conflictingLabel: {
            labelId: duplicateLabel.labelId,
            labelName: duplicateLabel.labelName,
            labelColor: duplicateLabel.labelColor,
            entityType: duplicateLabel.entityType
          }
        });
      }

      updateData.labelName = labelName.trim();
    }

    if (labelColor && labelColor.trim()) {
      // Validate color format (hex color)
      const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (!colorRegex.test(labelColor.trim())) {
        return res.status(400).json({
          message: "Invalid color format. Please provide a valid hex color code (e.g., #ff0000 or #f00)."
        });
      }
      updateData.labelColor = labelColor.trim();
    }

    if (description !== undefined) {
      updateData.description = description ? description.trim() : null;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: "No valid fields provided for update."
      });
    }

    // Get user info for audit
    const user = await MasterUser.findByPk(req.adminId);
    const userName = user ? user.name : 'Unknown User';

    // Add audit fields
    updateData.updatedBy = userName;
    updateData.updatedById = req.adminId;
    updateData.lastUpdated = new Date();
    updateData.mode = 'UPDATE_LABEL';

    // Update the label
    await Label.update(updateData, {
      where: { 
        labelId: labelId,
        isActive: true 
      }
    });

    // Fetch updated label
    const updatedLabel = await Label.findByPk(labelId);

    // If label name was changed, update all entities that have this label based on entity type
    if (updateData.labelName && updateData.labelName !== existingLabel.labelName) {
      let updatedEntitiesCount = 0;
      
      // Update entities based on the label's entity type
      switch (existingLabel.entityType) {
        case 'lead':
          // Find all leads with the old label name
          const leadsWithLabel = await Lead.findAll({
            where: {
              valueLabels: {
                [Op.or]: [
                  { [Op.like]: `%,${existingLabel.labelName},%` },
                  { [Op.like]: `${existingLabel.labelName},%` },
                  { [Op.like]: `%,${existingLabel.labelName}` },
                  { [Op.like]: existingLabel.labelName }
                ]
              }
            }
          });

          // Update each lead's valueLabels
          for (const lead of leadsWithLabel) {
            let labels = lead.valueLabels ? lead.valueLabels.split(',').map(l => l.trim()) : [];
            
            // Replace old label name with new label name
            labels = labels.map(label => 
              label === existingLabel.labelName ? updateData.labelName : label
            );

            await Lead.update(
              { valueLabels: labels.join(',') },
              { where: { leadId: lead.leadId } }
            );
          }
          updatedEntitiesCount = leadsWithLabel.length;
          break;

        case 'deal':
          // Similar logic for deals if you have a Deal model with labels
          // const dealsWithLabel = await Deal.findAll({ ... });
          // Update deal labels here
          console.log(`Deal entity label update not implemented yet for label: ${existingLabel.labelName}`);
          break;

        case 'sale-inbox':
          // Similar logic for sale-inbox entities
          console.log(`Sale-inbox entity label update not implemented yet for label: ${existingLabel.labelName}`);
          break;

        case 'email':
          // Similar logic for email entities
          console.log(`Email entity label update not implemented yet for label: ${existingLabel.labelName}`);
          break;

        case 'contact':
        case 'organization':
          // Similar logic for contact/organization entities
          console.log(`${existingLabel.entityType} entity label update not implemented yet for label: ${existingLabel.labelName}`);
          break;

        case 'all':
          // Update all entity types - would need to iterate through all types
          console.log(`Universal label update not implemented yet for label: ${existingLabel.labelName}`);
          break;

        default:
          console.log(`Unknown entity type: ${existingLabel.entityType} for label: ${existingLabel.labelName}`);
          break;
      }

      if (updatedEntitiesCount > 0) {
        console.log(`Updated ${updatedEntitiesCount} ${existingLabel.entityType} entities with new label name: ${existingLabel.labelName} -> ${updateData.labelName}`);
      }
    }

    // Log audit trail
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "UPDATE_LABEL",
      req.adminId,
      `Updated ${existingLabel.entityType} label: ${existingLabel.labelName} ${updateData.labelName ? `-> ${updateData.labelName}` : ''}`,
      labelId
    );

    res.status(200).json({
      message: `${existingLabel.entityType.charAt(0).toUpperCase() + existingLabel.entityType.slice(1)} label updated successfully`,
      previousLabel: {
        labelId: existingLabel.labelId,
        labelName: existingLabel.labelName,
        labelColor: existingLabel.labelColor,
        entityType: existingLabel.entityType,
        description: existingLabel.description
      },
      updatedLabel: {
        labelId: updatedLabel.labelId,
        labelName: updatedLabel.labelName,
        labelColor: updatedLabel.labelColor,
        entityType: updatedLabel.entityType,
        description: updatedLabel.description,
        updatedBy: updatedLabel.updatedBy,
        lastUpdated: updatedLabel.lastUpdated
      }
    });

  } catch (error) {
    console.error("Error updating lead label:", error);
    
    // Handle validation errors
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        message: "Validation error",
        errors: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    res.status(500).json({ 
      message: "Internal server error",
      error: error.message 
    });
  }
};

/**
 * Update labels for a specific lead
 */
exports.updateLeadLabels = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { valueLabels } = req.body;

    // Find the lead
    const lead = await Lead.findByPk(leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found." });
    }

    // Role-based access control
    if (req.role !== "admin") {
      if (lead.masterUserID !== req.adminId && lead.ownerId !== req.adminId) {
        return res.status(403).json({
          message: "Access denied. You can only update your own leads."
        });
      }
    }

    // Validate labels if provided
    if (valueLabels) {
      // If valueLabels is a string (comma-separated), convert to array
      let labelsArray = [];
      if (typeof valueLabels === 'string') {
        labelsArray = valueLabels.split(',').map(label => label.trim()).filter(label => label);
      } else if (Array.isArray(valueLabels)) {
        labelsArray = valueLabels;
      }

      // Validate that all labels exist
      if (labelsArray.length > 0) {
        const existingLabels = await Label.findAll({
          where: {
            labelName: { [Op.in]: labelsArray },
            entityType: { [Op.in]: ['lead', 'all'] },
            isActive: true
          }
        });

        const existingLabelNames = existingLabels.map(label => label.labelName);
        const invalidLabels = labelsArray.filter(label => !existingLabelNames.includes(label));

        if (invalidLabels.length > 0) {
          return res.status(400).json({
            message: "Some labels do not exist or are not active.",
            invalidLabels: invalidLabels,
            availableLabels: existingLabelNames
          });
        }

        // Convert back to comma-separated string for storage
        const finalValueLabels = labelsArray.join(', ');
        
        // Update the lead
        await lead.update({ valueLabels: finalValueLabels });
      } else {
        // Clear labels if empty array provided
        await lead.update({ valueLabels: null });
      }
    } else {
      // Clear labels if null/undefined provided
      await lead.update({ valueLabels: null });
    }

    // Log audit trail
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "UPDATE_LEAD_LABELS",
      req.adminId,
      `Updated labels for lead ${leadId}: ${valueLabels || 'cleared'}`,
      leadId
    );

    // Get updated lead with labels
    const updatedLead = await Lead.findByPk(leadId, {
      attributes: ['leadId', 'title', 'valueLabels', 'contactPerson', 'organization']
    });

    res.status(200).json({
      message: "Lead labels updated successfully",
      lead: updatedLead
    });

  } catch (error) {
    console.error("Error updating lead labels:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error.message 
    });
  }
};

/**
 * Get leads filtered by specific labels
 */
exports.getLeadsByLabels = async (req, res) => {
  try {
    const { 
      labels, // Comma-separated string or array
      page = 1, 
      limit = 20,
      sortBy = "createdAt",
      order = "DESC"
    } = req.query;

    if (!labels) {
      return res.status(400).json({
        message: "Labels parameter is required. Provide comma-separated label names."
      });
    }

    // Parse labels
    let labelsArray = [];
    if (typeof labels === 'string') {
      labelsArray = labels.split(',').map(label => label.trim()).filter(label => label);
    } else if (Array.isArray(labels)) {
      labelsArray = labels;
    }

    if (labelsArray.length === 0) {
      return res.status(400).json({
        message: "At least one label must be specified."
      });
    }

    const offset = (page - 1) * limit;

    // Build where clause for labels (OR condition - lead has any of the specified labels)
    const labelConditions = labelsArray.map(label => ({
      valueLabels: { [Op.like]: `%${label}%` }
    }));

    let where = {
      [Op.or]: labelConditions
    };

    // Apply role-based filtering
    if (req.role !== "admin") {
      where[Op.and] = [
        { [Op.or]: labelConditions },
        { 
          [Op.or]: [
            { masterUserID: req.adminId },
            { ownerId: req.adminId }
          ]
        }
      ];
      delete where[Op.or]; // Remove the outer OR since we're using AND now
    }

    // Get leads with pagination
    const { rows: leads, count: total } = await Lead.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [[sortBy, order.toUpperCase()]],
      attributes: [
        'leadId',
        'title', 
        'contactPerson',
        'organization',
        'email',
        'phone',
        'valueLabels',
        'status',
        'pipeline',
        'stage',
        'value',
        'expectedCloseDate',
        'createdAt',
        'updatedAt'
      ]
    });

    // Process leads to include label details
    const processedLeads = await Promise.all(leads.map(async (lead) => {
      const leadObj = lead.toJSON();
      
      if (leadObj.valueLabels) {
        const leadLabels = leadObj.valueLabels.split(',').map(label => label.trim());
        
        // Get label details
        const labelDetails = await Label.findAll({
          where: {
            labelName: { [Op.in]: leadLabels },
            entityType: { [Op.in]: ['lead', 'all'] },
            isActive: true
          },
          attributes: ['labelId', 'labelName', 'labelColor']
        });

        leadObj.labels = labelDetails;
      } else {
        leadObj.labels = [];
      }

      return leadObj;
    }));

    res.status(200).json({
      message: "Leads fetched successfully by labels",
      searchedLabels: labelsArray,
      totalLeads: total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      leads: processedLeads
    });

  } catch (error) {
    console.error("Error fetching leads by labels:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error.message 
    });
  }
};

/**
 * Delete a label (soft delete - set isActive to false) for any entity type
 */
exports.deleteLeadLabel = async (req, res) => {
  try {
    const { labelId } = req.params;

    // Find the label - now supports any entity type
    const label = await Label.findOne({
      where: {
        labelId,
        isActive: true
      }
    });

    if (!label) {
      return res.status(404).json({ message: "Label not found or already deleted." });
    }

    // Check if label is being used by entities based on entity type
    let entitiesUsingLabel = 0;
    let entityTypeDescription = '';
    
    switch (label.entityType) {
      case 'lead':
        entitiesUsingLabel = await Lead.count({
          where: {
            valueLabels: { [Op.like]: `%${label.labelName}%` }
          }
        });
        entityTypeDescription = 'leads';
        break;
        
      case 'deal':
        // Add deal entity check when Deal model has labels
        // entitiesUsingLabel = await Deal.count({
        //   where: { valueLabels: { [Op.like]: `%${label.labelName}%` } }
        // });
        entityTypeDescription = 'deals';
        console.log(`Deal entity label usage check not implemented yet for label: ${label.labelName}`);
        break;
        
      case 'sale-inbox':
        // Add sale-inbox entity check when model has labels
        entityTypeDescription = 'sale-inbox items';
        console.log(`Sale-inbox entity label usage check not implemented yet for label: ${label.labelName}`);
        break;
        
      case 'email':
        // Add email entity check when Email model has labels
        entityTypeDescription = 'emails';
        console.log(`Email entity label usage check not implemented yet for label: ${label.labelName}`);
        break;
        
      case 'contact':
      case 'organization':
        // Add contact/organization entity check when models have labels
        entityTypeDescription = `${label.entityType}s`;
        console.log(`${label.entityType} entity label usage check not implemented yet for label: ${label.labelName}`);
        break;
        
      case 'all':
        // Check all entity types when label is universal
        entitiesUsingLabel = await Lead.count({
          where: {
            valueLabels: { [Op.like]: `%${label.labelName}%` }
          }
        });
        // Add other entity counts here when implemented
        entityTypeDescription = 'entities';
        break;
        
      default:
        entityTypeDescription = `${label.entityType} entities`;
        console.log(`Unknown entity type: ${label.entityType} for label: ${label.labelName}`);
        break;
    }

    // Get user info for audit
    const user = await MasterUser.findByPk(req.adminId);
    const userName = user ? user.name : 'Unknown User';

    // Soft delete the label
    await label.update({
      isActive: false,
      updatedBy: userName,
      updatedById: req.adminId,
      updatedDate: new Date(),
      mode: 'DELETE_LABEL'
    });

    // Log audit trail
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "DELETE_LABEL",
      req.adminId,
      `Deleted ${label.entityType} label: ${label.labelName} (was used by ${entitiesUsingLabel} ${entityTypeDescription})`,
      labelId
    );

    res.status(200).json({
      message: `${label.entityType.charAt(0).toUpperCase() + label.entityType.slice(1)} label deleted successfully`,
      deletedLabel: {
        labelId: label.labelId,
        labelName: label.labelName,
        entityType: label.entityType,
        entitiesAffected: entitiesUsingLabel,
        entityTypeDescription: entityTypeDescription
      },
      note: entitiesUsingLabel > 0 ? 
        `This label was being used by ${entitiesUsingLabel} ${entityTypeDescription}. You may want to update those ${entityTypeDescription}.` : 
        `This label was not being used by any ${entityTypeDescription}.`
    });

  } catch (error) {
    console.error("Error deleting label:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error.message 
    });
  }
};

/**
 * Get all available labels with usage statistics
 */
exports.getLeadLabelsWithStats = async (req, res) => {
  try {
    // Get all active labels for leads
    const labels = await Label.findAll({
      where: {
        entityType: { [Op.in]: ['lead', 'all'] },
        isActive: true
      },
      attributes: [
        'labelId',
        'labelName', 
        'labelColor',
        'entityType',
        'description',
        'createdBy',
        'creationDate'
      ],
      order: [['labelName', 'ASC']]
    });

    // Get usage statistics for each label
    const labelsWithStats = await Promise.all(labels.map(async (label) => {
      const usageCount = await Lead.count({
        where: {
          valueLabels: { [Op.like]: `%${label.labelName}%` }
        }
      });

      return {
        ...label.toJSON(),
        usageCount: usageCount
      };
    }));

    // Get total leads count for percentage calculation
    const totalLeads = await Lead.count();

    // Add percentage to each label
    const finalLabels = labelsWithStats.map(label => ({
      ...label,
      usagePercentage: totalLeads > 0 ? ((label.usageCount / totalLeads) * 100).toFixed(2) : 0
    }));

    res.status(200).json({
      message: "Lead labels with statistics fetched successfully",
      labels: finalLabels,
      totalLabels: finalLabels.length,
      totalLeads: totalLeads
    });

  } catch (error) {
    console.error("Error fetching lead labels with stats:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error.message 
    });
  }
};

// Excel Import API for Leads
exports.importLeadsFromExcel = async (req, res) => {
  try {
    // Use multer middleware to handle file upload
    upload.single('excelFile')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: 'File upload error',
          error: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded. Please upload an Excel or CSV file.'
        });
      }

      try {
        // Check user permissions
        if (!["admin", "general", "master"].includes(req.role)) {
          await logAuditTrail(
            PROGRAMS.LEAD_MANAGEMENT,
            "LEAD_EXCEL_IMPORT_DENIED",
            req.adminId,
            "Access denied for Excel import. Insufficient permissions.",
            null
          );
          
          // Clean up uploaded file
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          
          return res.status(403).json({
            success: false,
            message: "Access denied. You do not have permission to import leads."
          });
        }

        // Parse the Excel/CSV file
        const parsedData = await parseUploadedFile(req.file);

        if (!parsedData || parsedData.length === 0) {
          // Clean up uploaded file
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          
          return res.status(400).json({
            success: false,
            message: 'No data found in the uploaded file or invalid file format.'
          });
        }

        // Get import options from request body
        const {
          duplicateHandling = 'skip', // 'skip', 'update', 'create_new'
          skipHeaderRow = true,
          validateEmail = true,
          validatePhone = true,
          defaultOwner = req.adminId,
          batchSize = 100
        } = req.body;

        // Process the data in batches
        const importResult = await processLeadImport(parsedData, {
          duplicateHandling,
          skipHeaderRow,
          validateEmail,
          validatePhone,
          defaultOwner,
          batchSize,
          masterUserID: req.adminId,
          role: req.role
        });

        // Clean up uploaded file
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        // Log successful import
        await logAuditTrail(
          PROGRAMS.LEAD_MANAGEMENT,
          "LEAD_EXCEL_IMPORT_COMPLETED",
          req.adminId,
          `Excel import completed. Processed: ${importResult.totalProcessed}, Created: ${importResult.successful}, Failed: ${importResult.failed}, Skipped: ${importResult.skipped}`,
          null
        );

        res.status(200).json({
          success: true,
          message: 'Excel import completed successfully',
          data: {
            totalRows: importResult.totalProcessed,
            successful: importResult.successful,
            failed: importResult.failed,
            skipped: importResult.skipped,
            duplicatesHandled: importResult.duplicatesHandled,
            errors: importResult.errors.slice(0, 10), // Show first 10 errors
            totalErrors: importResult.errors.length,
            importOptions: {
              duplicateHandling,
              skipHeaderRow,
              validateEmail,
              validatePhone
            }
          }
        });

      } catch (parseError) {
        console.error('Error processing Excel import:', parseError);
        
        // Clean up uploaded file
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        await logAuditTrail(
          PROGRAMS.LEAD_MANAGEMENT,
          "LEAD_EXCEL_IMPORT_ERROR",
          req.adminId,
          `Excel import failed: ${parseError.message}`,
          null
        );

        res.status(500).json({
          success: false,
          message: 'Failed to process Excel import',
          error: parseError.message
        });
      }
    });

  } catch (error) {
    console.error('Error in Excel import endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during Excel import',
      error: error.message
    });
  }
};

// Helper function to parse uploaded file (Excel or CSV)
async function parseUploadedFile(file) {
  return new Promise((resolve, reject) => {
    try {
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      if (fileExtension === '.csv') {
        // Parse CSV file
        const results = [];
        fs.createReadStream(file.path)
          .pipe(csv({ headers: false }))
          .on('data', (data) => {
            results.push(Object.values(data));
          })
          .on('end', () => {
            resolve(results);
          })
          .on('error', (error) => {
            reject(error);
          });
      } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
        // Parse Excel file
        const workbook = XLSX.readFile(file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        resolve(jsonData);
      } else {
        reject(new Error('Unsupported file format'));
      }
    } catch (error) {
      reject(error);
    }
  });
}

// Helper function to process lead import with createDeal-like functionality
async function processLeadImport(data, options) {
  const {
    duplicateHandling,
    skipHeaderRow,
    validateEmail,
    validatePhone,
    defaultOwner,
    batchSize,
    masterUserID,
    role
  } = options;

  let successful = 0;
  let failed = 0;
  let skipped = 0;
  let duplicatesHandled = 0;
  const errors = [];

  // Skip header row if requested
  const dataRows = skipHeaderRow ? data.slice(1) : data;
  const totalProcessed = dataRows.length;

  console.log(`Starting lead import: ${totalProcessed} rows to process`);

  // Expected column structure (can be customized)
  // [contactPerson, email, phone, company, title, proposalValue, sourceChannel, status, notes]
  const expectedColumns = [
    'contactPerson', 'email', 'phone', 'company', 'title', 
    'proposalValue', 'sourceChannel', 'status', 'notes', 'organization',
    'projectLocation', 'organizationCountry', 'serviceType'
  ];

  // Process data in batches
  for (let i = 0; i < dataRows.length; i += batchSize) {
    const batch = dataRows.slice(i, i + batchSize);
    const transaction = await sequelize.transaction();

    try {
      for (let rowIndex = 0; rowIndex < batch.length; rowIndex++) {
        const row = batch[rowIndex];
        const globalRowIndex = i + rowIndex + (skipHeaderRow ? 2 : 1); // +2 because header is row 1, data starts from 2

        try {
          // Parse row data into lead object
          const leadData = parseRowToLeadData(row, expectedColumns);

          // Validate required fields
          if (!leadData.contactPerson || leadData.contactPerson.trim() === '') {
            errors.push({
              row: globalRowIndex,
              error: 'Contact Person is required',
              data: row
            });
            failed++;
            continue;
          }

          // Email validation
          if (validateEmail && leadData.email && !isValidEmail(leadData.email)) {
            errors.push({
              row: globalRowIndex,
              error: 'Invalid email format',
              data: row
            });
            failed++;
            continue;
          }

          // Phone validation
          if (validatePhone && leadData.phone && !isValidPhone(leadData.phone)) {
            errors.push({
              row: globalRowIndex,
              error: 'Invalid phone format',
              data: row
            });
            failed++;
            continue;
          }

          // Check for duplicates (similar to createDeal logic)
          const duplicateCheck = await checkLeadDuplicate(leadData, masterUserID);

          if (duplicateCheck.isDuplicate) {
            if (duplicateHandling === 'skip') {
              skipped++;
              continue;
            } else if (duplicateHandling === 'update') {
              // Update existing lead
              await updateExistingLead(duplicateCheck.existingLead, leadData, transaction);
              duplicatesHandled++;
              continue;
            }
            // For 'create_new', proceed with creation
          }

          // Prepare lead payload (similar to createDeal structure)
          const leadPayload = {
            contactPerson: leadData.contactPerson.trim(),
            email: leadData.email ? leadData.email.trim().toLowerCase() : null,
            phone: leadData.phone ? leadData.phone.trim() : null,
            company: leadData.company ? leadData.company.trim() : null,
            organization: leadData.organization ? leadData.organization.trim() : leadData.company,
            title: leadData.title ? leadData.title.trim() : `Lead: ${leadData.contactPerson}`,
            proposalValue: parseFloat(leadData.proposalValue) || 0,
            proposalValueCurrency: 'INR',
            sourceChannel: leadData.sourceChannel ? leadData.sourceChannel.trim() : 'Excel Import',
            status: leadData.status ? leadData.status.trim() : 'New',
            notes: leadData.notes ? leadData.notes.trim() : null,
            projectLocation: leadData.projectLocation ? leadData.projectLocation.trim() : null,
            organizationCountry: leadData.organizationCountry ? leadData.organizationCountry.trim() : null,
            serviceType: leadData.serviceType ? leadData.serviceType.trim() : null,
            
            // System fields
            masterUserID: masterUserID,
            ownerId: defaultOwner,
            createdBy: masterUserID,
            
            // Import metadata
            importSource: 'Excel Import',
            importDate: new Date(),
            isArchived: false,
            
            // Default values
            priority: 'Medium',
            leadScore: 0,
            isQualified: false
          };

          // Create the lead
          const newLead = await Lead.create(leadPayload, { transaction });

          // Create lead details if needed (similar to createDeal details creation)
          if (leadData.notes || leadData.sourceChannel) {
            await LeadDetails.create({
              leadId: newLead.leadId,
              description: leadData.notes,
              sourceChannel: leadData.sourceChannel,
              createdBy: masterUserID,
              masterUserID: masterUserID
            }, { transaction });
          }

          // Create associated person if email is provided
          if (leadData.email && leadData.contactPerson) {
            try {
              const existingPerson = await Person.findOne({
                where: { email: leadData.email },
                transaction
              });

              if (!existingPerson) {
                const personPayload = {
                  contactPerson: leadData.contactPerson,
                  email: leadData.email,
                  phone: leadData.phone,
                  organization: leadData.company || leadData.organization,
                  masterUserID: masterUserID,
                  ownerId: defaultOwner,
                  createdBy: masterUserID
                };

                const newPerson = await Person.create(personPayload, { transaction });

                // Link person to lead
                await newLead.update({ personId: newPerson.personId }, { transaction });
              } else {
                // Link existing person to lead
                await newLead.update({ personId: existingPerson.personId }, { transaction });
              }
            } catch (personError) {
              console.warn(`Failed to create/link person for lead ${newLead.leadId}:`, personError.message);
            }
          }

          successful++;

        } catch (rowError) {
          console.error(`Error processing row ${globalRowIndex}:`, rowError);
          errors.push({
            row: globalRowIndex,
            error: rowError.message,
            data: row
          });
          failed++;
        }
      }

      // Commit transaction for this batch
      await transaction.commit();

    } catch (batchError) {
      // Rollback transaction for this batch
      await transaction.rollback();
      console.error(`Batch processing error for rows ${i + 1}-${i + batch.length}:`, batchError);
      
      // Mark all rows in this batch as failed
      for (let j = 0; j < batch.length; j++) {
        errors.push({
          row: i + j + (skipHeaderRow ? 2 : 1),
          error: `Batch processing failed: ${batchError.message}`,
          data: batch[j]
        });
        failed++;
      }
    }

    // Small delay to prevent overwhelming the database
    if (i + batchSize < dataRows.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return {
    totalProcessed,
    successful,
    failed,
    skipped,
    duplicatesHandled,
    errors
  };
}

// Helper function to parse row data into lead object
function parseRowToLeadData(row, expectedColumns) {
  const leadData = {};
  
  expectedColumns.forEach((column, index) => {
    if (row[index] !== undefined && row[index] !== null && row[index] !== '') {
      leadData[column] = String(row[index]).trim();
    }
  });

  return leadData;
}

// Helper function to check for lead duplicates
async function checkLeadDuplicate(leadData, masterUserID) {
  try {
    const whereConditions = [];

    // Check by email
    if (leadData.email) {
      whereConditions.push({ email: leadData.email });
    }

    // Check by phone
    if (leadData.phone) {
      whereConditions.push({ phone: leadData.phone });
    }

    // Check by contact person and company combination
    if (leadData.contactPerson && leadData.company) {
      whereConditions.push({
        contactPerson: leadData.contactPerson,
        [Op.or]: [
          { company: leadData.company },
          { organization: leadData.company }
        ]
      });
    }

    if (whereConditions.length === 0) {
      return { isDuplicate: false };
    }

    const existingLead = await Lead.findOne({
      where: {
        [Op.and]: [
          { masterUserID: masterUserID },
          { [Op.or]: whereConditions }
        ]
      }
    });

    return {
      isDuplicate: !!existingLead,
      existingLead
    };

  } catch (error) {
    console.error('Error checking lead duplicate:', error);
    return { isDuplicate: false };
  }
}

// Helper function to update existing lead
async function updateExistingLead(existingLead, newData, transaction) {
  const updateData = {};

  // Update fields that have new values
  Object.keys(newData).forEach(key => {
    if (newData[key] && newData[key] !== '' && 
        key !== 'masterUserID' && key !== 'ownerId' && key !== 'createdBy') {
      updateData[key] = newData[key];
    }
  });

  // Add update metadata
  updateData.lastModifiedDate = new Date();
  updateData.importSource = 'Excel Import Update';

  await existingLead.update(updateData, { transaction });
}

// Email validation helper
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Phone validation helper
function isValidPhone(phone) {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

// Get Excel Import Template
exports.getExcelImportTemplate = async (req, res) => {
  try {
    // Create a sample Excel template for lead import
    const templateHeaders = [
      'Contact Person*',
      'Email',
      'Phone',
      'Company',
      'Title',
      'Proposal Value',
      'Source Channel',
      'Status',
      'Notes',
      'Organization',
      'Project Location',
      'Organization Country',
      'Service Type'
    ];

    const sampleData = [
      [
        'John Doe',
        'john.doe@example.com',
        '+1-555-0123',
        'Example Corp',
        'Business Development Lead',
        '50000',
        'Website',
        'New',
        'Interested in our enterprise solution',
        'Example Corp',
        'New York',
        'USA',
        'Consulting'
      ],
      [
        'Jane Smith',
        'jane.smith@demo.com',
        '+1-555-0124',
        'Demo Industries',
        'Product Inquiry',
        '25000',
        'Email Campaign',
        'Qualified',
        'Requested demo for team of 50',
        'Demo Industries',
        'California',
        'USA',
        'Software License'
      ]
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const wsData = [templateHeaders, ...sampleData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    const columnWidths = templateHeaders.map(() => ({ wch: 20 }));
    ws['!cols'] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Lead Import Template');

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=lead_import_template.xlsx');

    res.send(buffer);

  } catch (error) {
    console.error('Error generating Excel template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate Excel template',
      error: error.message
    });
  }
};
