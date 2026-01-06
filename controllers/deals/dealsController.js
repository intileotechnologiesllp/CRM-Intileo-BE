const Deal = require("../../models/deals/dealsModels");
const Lead = require("../../models/leads/leadsModel");
const Person = require("../../models/leads/leadPersonModel");
const Organization = require("../../models/leads/leadOrganizationModel");
const Activity = require("../../models/activity/activityModel");
const CustomField = require("../../models/customFieldModel");
const CustomFieldValue = require("../../models/customFieldValueModel"); 
const PROGRAMS = require("../../utils/programConstants");
const { Op } = require("sequelize");
const { fn, col, literal } = require("sequelize");
// const sequelize = require("../../config/db");
const DealDetails = require("../../models/deals/dealsDetailModel");
const DealStageHistory = require("../../models/deals/dealsStageHistoryModel");
const DealParticipant = require("../../models/deals/dealPartcipentsModel");
const MasterUser = require("../../models/master/masterUserModel");
const permissionSet = require("../../models/permissionsetModel");
const DealNote = require("../../models/deals/delasNoteModel");
const LeadNote = require("../../models/leads/leadNoteModel");
const Email = require("../../models/email/emailModel");
const Attachment = require("../../models/email/attachmentModel");
const LeadFilter = require("../../models/leads/leadFiltersModel");
const { convertRelativeDate } = require("../../utils/helper");
const DealColumnPreference = require("../../models/deals/dealColumnModel"); // Adjust path as needed
const { logAuditTrail } = require("../../utils/auditTrailLogger"); // Adjust path as needed
const historyLogger = require("../../utils/historyLogger").logHistory; // Import history logger
const { sendEmail } = require("../../utils/emailSend"); // Add email service import
const UserCredential = require("../../models/email/userCredentialModel"); // Add UserCredential model
const sequelize = require("../../config/db");
const { getProgramId } = require("../../utils/programCache");
const PipelineStage = require("../../models/deals/pipelineStageModel");
const Currency = require("../../models/admin/masters/currencyModel");
const DealFile = require("../../models/deals/dealFileModel");
const DealProduct = require("../../models/product/dealProductModel");
const Product = require("../../models/product/productModel");
const ProductVariation = require("../../models/product/productVariationModel");
const NotificationTriggers = require("../../services/notification/notificationTriggers"); // 🔔 Notification triggers
const multer = require('multer');
const path = require('path');
const GroupVisibility = require("../../models/admin/groupVisibilityModel");
const fs = require('fs').promises;
// Create a new deal with validation

exports.createDeal = async (req, res) => {
  const { DealParticipant, DealStageHistory, DealDetail, History, AuditTrail, Deal, Lead, LeadOrganization, LeadPerson, MasterUser, Email, CustomField, CustomFieldValue, PermissionSet, DealNote, LeadNote, LeadFilter,  DealColumn, UserCredential, PipelineStage, Currency, DealFile, DealProduct, Product, ProductVariation, GroupVisibility, Activity, LeadFile} = req.models;
  try {
  const dealProgramId = getProgramId("DEALS");
  // Declare ownerId at the top before any usage
  let ownerId = req.user?.id || req.adminId || req.body.ownerId;
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
      sourceOrgin,
      source,
      label,
      // Activity ID to link existing activity (similar to emailID)
      activityId,
      visibleGroup
      // Custom fields will be processed from remaining req.body fields
    } = req.body;
    // --- Enhanced validation similar to createLead ---
    // Validate required fields
    if (!contactPerson || !organization || !title || !email) {
      await logAuditTrail(
        AuditTrail,
        dealProgramId,
        "DEAL_CREATION",
        req.role,
        `Deal creation failed: contactPerson, organization, title, and email are required.`,
        req.adminId
      );
      return res.status(400).json({
        message: "contactPerson, organization, title, and email are required.",
      });
    }

    // Validate contactPerson
    if (typeof contactPerson !== "string" || !contactPerson.trim()) {
      await logAuditTrail(
        AuditTrail,
        dealProgramId,
        "DEAL_CREATION",
        req.role,
        `Deal creation failed: contactPerson must be a non-empty string.`,
        req.adminId
      );
      return res.status(400).json({
        message: "contactPerson must be a non-empty string.",
      });
    }

    // Validate organization
    if (typeof organization !== "string" || !organization.trim()) {
      await logAuditTrail(
        AuditTrail,
        dealProgramId,
        "DEAL_CREATION",
        req.role,
        `Deal creation failed: organization must be a non-empty string.`,
        req.adminId
      );
      return res.status(400).json({
        message: "organization must be a non-empty string.",
      });
    }

    // Validate title
    if (typeof title !== "string" || !title.trim()) {
      await logAuditTrail(
        AuditTrail,
        dealProgramId,
        "DEAL_CREATION",
        req.role,
        `Deal creation failed: title must be a non-empty string.`,
        req.adminId
      );
      return res.status(400).json({
        message: "title must be a non-empty string.",
      });
    }

    // Enhanced email validation (RFC 5322 compliant)
    if (email) {
      // Check for basic format and length limit (254 characters)
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      
      if (!emailRegex.test(email) || email.length > 254) {
        await logAuditTrail(
          AuditTrail,
          dealProgramId,
          "DEAL_CREATION",
          req.role,
          `Deal creation failed: Invalid email format.`,
          req.adminId
        );
        return res.status(400).json({
          message: "Invalid email format.",
        });
      }
    }

    // Phone number validation (only numerical values allowed)
    if (phone && phone.trim() !== "") {
      // Strict validation: only digits and optional plus sign at the beginning
      const phoneRegex = /^\+?\d{7,15}$/;
      
      if (!phoneRegex.test(phone.trim())) {
        await logAuditTrail(
          AuditTrail,
          dealProgramId,
          "DEAL_CREATION",
          req.role,
          `Deal creation failed: Phone number should contain only digits (7-15 digits) with optional + for country code. No spaces, dashes, or other characters allowed.`,
          req.adminId
        );
        return res.status(400).json({
          message: "Phone number should contain only digits (7-15 digits) with optional + for country code. No spaces, dashes, or other characters allowed.",
        });
      }
    }

    // Validate and sanitize proposalValue
    let sanitizedProposalValue = proposalValue;
    if (proposalValue === '' || proposalValue === null || proposalValue === undefined) {
      sanitizedProposalValue = null;
    } else if (proposalValue && proposalValue < 0) {
      await logAuditTrail(
        AuditTrail,
        dealProgramId,
        "DEAL_CREATION",
        req.role,
        `Deal creation failed: Proposal value must be positive.`,
        req.adminId
      );
      return res.status(400).json({
        message: "Proposal value must be positive.",
      });
    }

    // Validate and sanitize value
    let sanitizedValue = value;
    if (value === '' || value === null || value === undefined) {
      sanitizedValue = null;
    } else if (value && value < 0) {
      await logAuditTrail(
        AuditTrail,
        dealProgramId,
        "DEAL_CREATION",
        req.role,
        `Deal creation failed: Deal value must be positive.`,
        req.adminId
      );
      return res.status(400).json({
        message: "Deal value must be positive.",
      });
    }

    // Sanitize other numeric fields
    let sanitizedSourceChannelId = sourceChannelId;
    if (sourceChannelId === '' || sourceChannelId === undefined) {
      sanitizedSourceChannelId = null;
    }

    let sanitizedSourceOrgin = sourceOrgin;
    if (sourceOrgin === '' || sourceOrgin === undefined) {
      sanitizedSourceOrgin = null;
    }

    let sanitizedCurrency = currency;
    if (currency === '' || currency === undefined) {
      sanitizedCurrency = null;
    }

    let sanitizedProposalCurrency = proposalCurrency;
    if (proposalCurrency === '' || proposalCurrency === undefined) {
      sanitizedProposalCurrency = null;
    }

    // Sanitize date fields
    let sanitizedExpectedCloseDate = expectedCloseDate;
    if (expectedCloseDate === '' || expectedCloseDate === 'Invalid date' || expectedCloseDate === undefined || expectedCloseDate === null) {
      sanitizedExpectedCloseDate = null;
    } else if (expectedCloseDate && new Date(expectedCloseDate).toString() === 'Invalid Date') {
      sanitizedExpectedCloseDate = null;
    }

    let sanitizedProposalSentDate = proposalSentDate;
    if (proposalSentDate === '' || proposalSentDate === 'Invalid date' || proposalSentDate === undefined || proposalSentDate === null) {
      sanitizedProposalSentDate = null;
    } else if (proposalSentDate && new Date(proposalSentDate).toString() === 'Invalid Date') {
      sanitizedProposalSentDate = null;
    }
    // Find or create Person and Organization here...

    // 1. Set masterUserID at the top, before using it anywhere
    const masterUserID = req.adminId;
    // 1. Check if a matching lead exists

    let existingLead = null;

    // 2. If sourceOrgin is '2', require and use leadId
    let leadId = req.body.leadId;
    if (leadId === '') {
      leadId = null;
    }
    if (sanitizedSourceOrgin === "2" || sanitizedSourceOrgin === 2) {
      if (!leadId) {
        await logAuditTrail(
          AuditTrail,
          dealProgramId,
          "DEAL_CREATION",
          req.role,
          `Deal creation failed: leadId is required when sourceOrgin is 2.`,
          req.adminId
        );
        return res
          .status(400)
          .json({ message: "leadId is required when sourceOrgin is 2." });
      }
      existingLead = await Lead.findByPk(leadId);
      if (!existingLead) {
        await logAuditTrail(
          AuditTrail,
          dealProgramId,
          "DEAL_CREATION",
          req.role,
          `Deal creation failed: Lead with leadId ${leadId} not found.`,
          req.adminId
        );
        return res.status(404).json({ message: "Lead not found." });
      }
      ownerId = existingLead.ownerId; // assign, don't redeclare
      leadId = existingLead.leadId; // assign, don't redeclare
      // Optionally, update the lead after deal creation
    }
    // 1. Find or create Organization
    let org = null;
    if (organization) {
      org = await LeadOrganization.findOne({ where: { organization } });
      if (!org) {
        org = await LeadOrganization.create({
          organization,
          masterUserID, // make sure this is set
        });
      }
    }
    // 2. Find or create Person
    let person = null;
    if (contactPerson) {
      const masterUserID = req.adminId;

      person = await LeadPerson.findOne({ where: { email } });
      if (!person) {
        person = await LeadPerson.create({
          contactPerson,
          email,
          phone,
          leadOrganizationId: org ? org.leadOrganizationId : null,
          masterUserID,
        });
      }
    }
    // Create the lead
    console.log(person.personId, " before deal creation");
    // Before saving to DB
    if (sanitizedSourceOrgin === "2" || sanitizedSourceOrgin === 2) {
      if (!leadId) {
        await logAuditTrail(
          AuditTrail,
          dealProgramId,
          "DEAL_CREATION",
          req.role,
          `Deal creation failed: leadId is required when sourceOrgin is 2.`,
          req.adminId
        );
        return res
          .status(400)
          .json({ message: "leadId is required when sourceOrgin is 2." });
      }
      existingLead = await Lead.findByPk(leadId);
      if (!existingLead) {
        return res.status(404).json({ message: "Lead not found." });
      }
      // Prevent conversion if already converted to a deal
      if (existingLead.dealId) {
        await logAuditTrail(
          AuditTrail,
          dealProgramId,
          "DEAL_CREATION",
          req.role,
          `Deal creation failed: This lead is already converted to a deal.`,
          req.adminId
        );
        return res
          .status(400)
          .json({ message: "This lead is already converted to a deal." });
      }
      ownerId = existingLead.ownerId;
      leadId = existingLead.leadId;
    }
    const deal = await Deal.create({
      // contactPerson: person ? person.contactPerson : null,
      contactPerson: person ? person.contactPerson : contactPerson,
      organization: org ? org.organization : null,
      personId: person ? person.personId : null,
      leadOrganizationId: org ? org.leadOrganizationId : null,
      //       personId: person.personId,
      // leadOrganizationId: org.leadOrganizationId,
      leadId, // link to the lead if found
      title,
      value: sanitizedValue,
      currency: sanitizedCurrency,
      pipeline,
      pipelineStage,
      expectedCloseDate: sanitizedExpectedCloseDate,
      sourceChannel,
      sourceChannelId: sanitizedSourceChannelId,
      serviceType,
      proposalValue: sanitizedProposalValue,
      proposalCurrency: sanitizedProposalCurrency,
      esplProposalNo,
      projectLocation,
      organizationCountry,
      proposalSentDate: sanitizedProposalSentDate,
      sourceRequired,
      questionerShared,
      sectorialSector,
      sbuClass,
      phone,
      email,
      sourceOrgin: sanitizedSourceOrgin,
      masterUserID: req.adminId, // Ensure masterUserID is set from the request
      ownerId,
      status: "open", // Default status
      source,
      valueCurrency: req.body.valueCurrency || "INR",
      proposalValueCurrency: req.body.proposalValueCurrency || "INR",
      label,
      visibleGroup
      // Add personId, organizationId, etc. as needed
    });
    let responsiblePerson = null;
    if (sanitizedSourceOrgin === "2" || sanitizedSourceOrgin === 2) {
      // Use ownerId for responsible person
      const owner = await MasterUser.findOne({
        where: { masterUserID: ownerId },
      });
      responsiblePerson = owner ? owner.name : null;
    } else {
      // Use masterUserID for responsible person
      const user = await MasterUser.findOne({
        where: { masterUserID: req.adminId },
      });
      responsiblePerson = user ? user.name : null;
    }

    if ((sanitizedSourceOrgin === 0 || sanitizedSourceOrgin === "0") && req.body.emailID) {
      await Email.update(
        { dealId: deal.dealId },
        { where: { emailID: req.body.emailID } }
      );
    }

    // Link activity to deal if activityId is provided (similar to emailID linking)
    if (activityId) {
      try {
        console.log(`Linking activity ${activityId} to deal ${deal.dealId}`);
        const activityUpdateResult = await Activity.update(
          { dealId: deal.dealId },
          { where: { activityId: activityId } }
        );
        console.log(`Activity link result: ${activityUpdateResult[0]} rows updated`);

        if (activityUpdateResult[0] === 0) {
          console.warn(`No activity found with activityId: ${activityId}`);
        } else {
          // Log the activity linking in history
          await historyLogger(
            History,
            dealProgramId,
            "ACTIVITY_LINKING",
            req.adminId,
            activityId,
            req.adminId,
            `Activity ${activityId} linked to deal ${deal.dealId} by ${req.role}`,
            {
              dealId: deal.dealId,
              activityId: activityId,
            }
          );
        }
      } catch (activityError) {
        console.error("Error linking activity to deal:", activityError);
        // Don't fail the deal creation, just log the error
      }
    }

    await DealDetail.create({
      dealId: deal.dealId, // or deal.id depending on your PK
      responsiblePerson,
      ownerName: responsiblePerson, // or any other field you want to set
      // ...other dealDetails fields if needed
    });
    // Optionally, update the lead with the new dealId
    await DealStageHistory.create({
      dealId: deal.dealId,
      stageName: deal.pipelineStage,
      enteredAt: deal.createdAt, // or new Date()
    });
    if (person || org) {
      await DealParticipant.create({
        dealId: deal.dealId,
        personId: person ? person.personId : null,
        leadOrganizationId: org ? org.leadOrganizationId : null,
      });
    }

    if (existingLead) {
      await existingLead.update({ dealId: deal.dealId });
      
      // 🎯 AUTOMATIC DATA MIGRATION: Move all related data from Lead to Deal
      console.log(`🔄 [LEAD-TO-DEAL] Moving data from Lead ${existingLead.leadId} to Deal ${deal.dealId}`);
      
      try {
        // ✅ 1. Move Activities from Lead to Deal
        const activitiesUpdateResult = await Activity.update(
          { dealId: deal.dealId, leadId: null }, // Move to deal, clear lead reference
          { where: { leadId: existingLead.leadId } }
        );
        console.log(`✅ [ACTIVITIES] Moved ${activitiesUpdateResult[0]} activities from Lead ${existingLead.leadId} to Deal ${deal.dealId}`);
        
        // ✅ 2. Move Notes from Lead to Deal
        const leadNotes = await LeadNote.findAll({
          where: { leadId: existingLead.leadId }
        });
        
        // Create corresponding deal notes for each lead note
        let movedNotesCount = 0;
        for (const leadNote of leadNotes) {
          await DealNote.create({
            dealId: deal.dealId,
            masterUserID: leadNote.masterUserID,
            content: leadNote.content,
            createdBy: leadNote.createdBy,
            createdAt: leadNote.createdAt,
            updatedAt: leadNote.updatedAt
          });
          // Delete the original lead note
          await leadNote.destroy();
          movedNotesCount++;
        }
        console.log(`✅ [NOTES] Moved ${movedNotesCount} notes from Lead ${existingLead.leadId} to Deal ${deal.dealId}`);
        
        // ✅ 3. Move Files from Lead to Deal
        let movedFilesCount = 0;
        
        try {
          const leadFiles = await LeadFile.findAll({
            where: { leadId: existingLead.leadId }
          });
          
          // Create corresponding deal files for each lead file
          for (const leadFile of leadFiles) {
            await DealFile.create({
              dealId: deal.dealId,
              fileName: leadFile.fileName,
              filePath: leadFile.filePath,
              fileType: leadFile.fileType,
              fileSize: leadFile.fileSize,
              uploadedBy: leadFile.uploadedBy,
              masterUserID: leadFile.masterUserID,
              createdAt: leadFile.createdAt,
              updatedAt: leadFile.updatedAt
            });
            // Delete the original lead file record
            await leadFile.destroy();
            movedFilesCount++;
          }
          console.log(`✅ [FILES] Moved ${movedFilesCount} files from Lead ${existingLead.leadId} to Deal ${deal.dealId}`);
        } catch (fileError) {
          console.log(`⚠️ [FILES] LeadFile model not available or error moving files:`, fileError.message);
        }
        
        // ✅ 4. Move Emails from Lead to Deal (if any are directly linked)
        const emailsUpdateResult = await Email.update(
          { dealId: deal.dealId, leadId: null },
          { where: { leadId: existingLead.leadId } }
        );
        console.log(`✅ [EMAILS] Moved ${emailsUpdateResult[0]} emails from Lead ${existingLead.leadId} to Deal ${deal.dealId}`);
        
        // Log the successful data migration
        await historyLogger(
          History,
          dealProgramId,
          "LEAD_TO_DEAL_MIGRATION",
          deal.masterUserID,
          deal.dealId,
          req.adminId,
          `Lead ${existingLead.leadId} converted to Deal ${deal.dealId}. Moved: ${activitiesUpdateResult[0]} activities, ${movedNotesCount} notes, ${movedFilesCount} files, ${emailsUpdateResult[0]} emails`,
          {
            leadId: existingLead.leadId,
            dealId: deal.dealId,
            migratedData: {
              activities: activitiesUpdateResult[0],
              notes: movedNotesCount,
              files: movedFilesCount,
              emails: emailsUpdateResult[0]
            }
          }
        );
        
      } catch (migrationError) {
        console.error(`❌ [LEAD-TO-DEAL] Error during data migration:`, migrationError);
        // Don't fail the deal creation, just log the error
      }
    } else if (leadId) {
      // If leadId is provided but not from sourceOrgin 2, still update the Lead with dealId
      const leadToUpdate = await Lead.findByPk(leadId);
      if (leadToUpdate) {
        await leadToUpdate.update({ dealId: deal.dealId });
        
        // 🎯 Also migrate data for this case
        console.log(`🔄 [LEAD-TO-DEAL] Moving data from Lead ${leadId} to Deal ${deal.dealId} (non-sourceOrgin 2)`);
        
        try {
          // Move Activities
          const activitiesUpdateResult = await Activity.update(
            { dealId: deal.dealId, leadId: null },
            { where: { leadId: leadId } }
          );
          console.log(`✅ [ACTIVITIES] Moved ${activitiesUpdateResult[0]} activities from Lead ${leadId} to Deal ${deal.dealId}`);
          
          // Move Notes

          const leadNotes = await LeadNote.findAll({
            where: { leadId: leadId }
          });
          
          let movedNotesCount = 0;
          for (const leadNote of leadNotes) {
            await DealNote.create({
              dealId: deal.dealId,
              masterUserID: leadNote.masterUserID,
              content: leadNote.content,
              createdBy: leadNote.createdBy,
              createdAt: leadNote.createdAt,
              updatedAt: leadNote.updatedAt
            });
            await leadNote.destroy();
            movedNotesCount++;
          }
          console.log(`✅ [NOTES] Moved ${movedNotesCount} notes from Lead ${leadId} to Deal ${deal.dealId}`);
          
          // Move Files
          try {
            const leadFiles = await LeadFile.findAll({
              where: { leadId: leadId }
            });
            
            let movedFilesCount = 0;
            for (const leadFile of leadFiles) {
              await DealFile.create({
                dealId: deal.dealId,
                fileName: leadFile.fileName,
                filePath: leadFile.filePath,
                fileType: leadFile.fileType,
                fileSize: leadFile.fileSize,
                uploadedBy: leadFile.uploadedBy,
                masterUserID: leadFile.masterUserID,
                createdAt: leadFile.createdAt,
                updatedAt: leadFile.updatedAt
              });
              await leadFile.destroy();
              movedFilesCount++;
            }
            console.log(`✅ [FILES] Moved ${movedFilesCount} files from Lead ${leadId} to Deal ${deal.dealId}`);
          } catch (fileError) {
            console.log(`⚠️ [FILES] LeadFile model not available or error moving files:`, fileError.message);
          }
          
          // Move Emails
          const emailsUpdateResult = await Email.update(
            { dealId: deal.dealId, leadId: null },
            { where: { leadId: leadId } }
          );
          console.log(`✅ [EMAILS] Moved ${emailsUpdateResult[0]} emails from Lead ${leadId} to Deal ${deal.dealId}`);
          
        } catch (migrationError) {
          console.error(`❌ [LEAD-TO-DEAL] Error during data migration:`, migrationError);
        }
      }
    }

    // Handle custom fields - extract from req.body directly
    const savedCustomFields = {};

    // Define standard Deal model fields that should not be treated as custom fields
    // const standardDealFields = [
    //   'contactPerson', 'organization', 'title', 'value', 'currency', 'pipeline',
    //   'pipelineStage', 'expectedCloseDate', 'sourceChannel', 'sourceChannelId',
    //   'serviceType', 'proposalValue', 'proposalCurrency', 'esplProposalNo',
    //   'projectLocation', 'organizationCountry', 'proposalSentDate', 'sourceRequired',
    //   'questionerShared', 'sectorialSector', 'sbuClass', 'phone', 'email',
    //   'sourceOrgin', 'source', 'leadId', 'ownerId', 'emailID'
    // ];
    const standardDealFields = [
      "title",
      "ownerId",
      "sourceChannel",
      "sourceChannelID",
    ];

    // Extract potential custom fields from req.body
    const potentialCustomFields = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (
        !standardDealFields.includes(key) &&
        value !== null &&
        value !== undefined &&
        value !== ""
      ) {
        potentialCustomFields[key] = value;
      }
    }

    console.log("=== CUSTOM FIELDS DEBUG ===");
    console.log("Potential custom fields extracted:", potentialCustomFields);
    console.log("req.adminId:", req.adminId);
    console.log("deal.dealId:", deal ? deal.dealId : "Deal not created yet");

    // Check if CustomField and CustomFieldValue models are loaded
    console.log("CustomField model available:", typeof CustomField);
    console.log("CustomFieldValue model available:", typeof CustomFieldValue);

    if (Object.keys(potentialCustomFields).length > 0) {
      try {
        console.log(
          "Processing",
          Object.keys(potentialCustomFields).length,
          "potential custom fields"
        );

        for (const [fieldKey, value] of Object.entries(potentialCustomFields)) {
          console.log(`\n--- Processing field: ${fieldKey} = ${value} ---`);
          let customField;

          // Check if it's a fieldId (numeric) or fieldName (string)
          if (isNaN(fieldKey)) {
            // It's a fieldName - search by fieldName
            console.log("Searching by fieldName:", fieldKey);
            customField = await CustomField.findOne({
              where: {
                fieldName: fieldKey,
                entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support deal, both, and lead fields
                isActive: true,
                // [Op.or]: [
                //   { masterUserID: req.adminId },
                //   { fieldSource: "default" },
                //   { fieldSource: "system" },
                // ],
              },
            });
          } else {
            // It's a fieldId - search by fieldId
            console.log("Searching by fieldId:", parseInt(fieldKey));
            customField = await CustomField.findOne({
              where: {
                fieldId: parseInt(fieldKey),
                entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support deal, both, and lead fields
                isActive: true,
                // [Op.or]: [
                //   { masterUserID: req.adminId },
                //   { fieldSource: "default" },
                //   { fieldSource: "system" },
                // ],
              },
            });
          }

          console.log(
            "CustomField found:",
            customField
              ? {
                  fieldId: customField.fieldId,
                  fieldName: customField.fieldName,
                  fieldType: customField.fieldType,
                  entityType: customField.entityType,
                  isActive: customField.isActive,
                  masterUserID: customField.masterUserID,
                  fieldSource: customField.fieldSource,
                }
              : "NOT FOUND"
          );

          if (
            customField &&
            value !== null &&
            value !== undefined &&
            value !== ""
          ) {
            // Validate value based on field type
            let processedValue = value;

            if (
              customField.fieldType === "number" &&
              value !== null &&
              value !== ""
            ) {
              processedValue = parseFloat(value);
              if (isNaN(processedValue)) {
                console.warn(
                  `Invalid number value for field "${customField.fieldLabel}"`
                );
                continue;
              }
            }

            if (customField.fieldType === "email" && value) {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(value)) {
                console.warn(
                  `Invalid email format for field "${customField.fieldLabel}"`
                );
                continue;
              }
            }

            console.log("Creating CustomFieldValue:", {
              fieldId: customField.fieldId,
              entityId: deal.dealId,
              entityType: "deal",
              value:
                typeof processedValue === "object"
                  ? JSON.stringify(processedValue)
                  : String(processedValue),
              masterUserID: req.adminId,
            });

            await CustomFieldValue.create({
              fieldId: customField.fieldId,
              entityId: deal.dealId,
              entityType: "deal",
              value:
                typeof processedValue === "object"
                  ? JSON.stringify(processedValue)
                  : String(processedValue),
              masterUserID: req.adminId,
            });

            // Store the saved custom field for response using fieldName as key
            savedCustomFields[customField.fieldName] = {
              fieldName: customField.fieldName,
              fieldType: customField.fieldType,
              value: processedValue,
            };

            console.log(
              "✅ Custom field saved successfully:",
              customField.fieldName
            );
          } else if (!customField) {
            console.warn(`❌ Custom field not found for key: ${fieldKey}`);
          } else {
            console.warn(`❌ Invalid value for field ${fieldKey}:`, value);
          }
        }
        console.log(
          `🎉 Saved ${
            Object.keys(savedCustomFields).length
          } custom field values for deal ${deal.dealId}`
        );
      } catch (customFieldError) {
        console.error("❌ Error saving custom fields:", customFieldError);
        // Don't fail the deal creation, just log the error
      }
    } else {
      console.log("❌ No potential custom fields found in request body");
    }

    await historyLogger(
      History,
      dealProgramId,
      "DEAL_CREATION",
      deal.masterUserID,
      deal.dealId,
      null,
      `Deal is created by ${req.role}`,
      null
    );

    // 🔔 Send Notification - Deal Created
    try {
      // Get creator details for notification
      const creator = await MasterUser.findByPk(req.adminId, {
        attributes: ['masterUserID', 'name']
      });
      
      await NotificationTriggers.dealCreated(
        {
          dealId: deal.dealId,
          ownerId: deal.ownerId,
          dealTitle: deal.title,
          dealValue: deal.value,
          stage: deal.pipelineStage
        },
        {
          userId: req.adminId,
          name: creator ? creator.name : 'Unknown User'
        }
      );
    } catch (notifError) {
      console.error('Failed to send deal created notification:', notifError);
    }

    // Prepare response with both default and custom fields
    const dealResponse = {
      ...deal.toJSON(),
      customFields: savedCustomFields,
    };

    let migrationMessage = "";
    let leadToDealdConversion = false;
    
    // Check if this was a lead conversion
    if (existingLead || leadId) {
      leadToDealdConversion = true;
      const convertedLeadId = existingLead ? existingLead.leadId : leadId;
      migrationMessage = ` Lead ${convertedLeadId} converted to Deal with automatic data migration (Activities, Notes, Files, Emails).`;
    }

    const response = {
      message: activityId 
        ? "Deal created and linked to activity successfully" + migrationMessage
        : "Deal created successfully" + migrationMessage,
      deal: dealResponse,
      customFieldsSaved: Object.keys(savedCustomFields).length,
      leadConversion: {
        isLeadConversion: leadToDealdConversion,
        convertedFromLeadId: leadToDealdConversion ? (existingLead ? existingLead.leadId : leadId) : null,
        dataMigrated: leadToDealdConversion ? ["Activities", "Notes", "Files", "Emails"] : [],
        migrationNote: leadToDealdConversion ? "All related data automatically moved from Lead to Deal" : null
      }
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
    console.log("Error creating deal:", error);

    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getDeals = async (req, res) => {
  const { DealParticipant, DealStageHistory, DealDetail, History, AuditTrail, Deal, Lead, LeadOrganization, LeadPerson, MasterUser, Email, CustomField, CustomFieldValue, PermissionSet, DealNote, LeadNote, LeadFilter,  DealColumn, UserCredential, PipelineStage, Currency, DealFile, DealProduct, Product, ProductVariation, GroupVisibility, Activity, LeadFile} = req.models;
  const {
    page = 1,
    limit = 20,
    search,
    sortBy = "createdAt",
    order = "DESC",
    pipeline,
    pipelineStage,
    ownerId,
    masterUserID,
    isArchived,
    filterId,
    groupId
  } = req.query;

  const offset = (page - 1) * limit;

  try {
    // Build the base where clause
    let where = {};

    // Exclude deals that have been converted to leads
    where.isConvertedToLead = {
      [Op.or]: [
        { [Op.is]: null },
        { [Op.eq]: false }
      ]
    };

    // --- Handle column preferences ---
// --- Handle column preferences ---
const pref = await DealColumn.findOne();
let attributes = [];
let dealDetailsAttributes = [];

if (pref && pref.columns) {
  const columns =
    typeof pref.columns === "string"
      ? JSON.parse(pref.columns)
      : pref.columns;

  // Get all Deal and DealDetails fields
  const dealFields = Object.keys(Deal.rawAttributes);
  const dealDetailsFields = DealDetail
    ? Object.keys(DealDetail.rawAttributes)
    : [];

  // Filter checked columns by table
  const checkedColumns = columns.filter((col) => col.check);

  dealFields.forEach((field) => {
    const col = checkedColumns.find((c) => c.key === field);
    if (col) attributes.push(field);
  });

  dealDetailsFields.forEach((field) => {
    const col = checkedColumns.find((c) => c.key === field);
    if (col) dealDetailsAttributes.push(field);
  });

  // Always include dealId for relationships
  if (!attributes.includes("dealId")) {
    attributes.unshift("dealId");
  }
  // Always include status column from database
  if (!attributes.includes("status")) {
    attributes.push("status");
  }
  // Always include ownerId in the attributes, regardless of preferences
  if (!attributes.includes("ownerId")) {
    attributes.push("ownerId");
  }

  // If after all processing attributes is still empty, set default columns
  if (attributes.length === 0) {
    attributes = ["dealId", "title", "contactPerson", "organization", "value", "currency", "pipeline", "pipelineStage", "expectedCloseDate", "status", "ownerId", "createdAt"];
  }
  
  if (dealDetailsAttributes.length === 0) dealDetailsAttributes = undefined;
} else {
  // No preferences found or no columns - use default columns
  attributes = ["dealId", "title", "contactPerson", "organization", "value", "currency", "pipeline", "pipelineStage", "expectedCloseDate", "status", "ownerId", "createdAt"];
}

    // --- Handle dynamic filtering ---
    let include = [];
    let customFieldsConditions = { all: [], any: [] };

    if (filterId) {
      console.log("Processing filter with filterId:", filterId);

      // Fetch the saved filter
      const filter = await LeadFilter.findByPk(filterId);
      if (!filter) {
        return res.status(404).json({ 
          statusCode: 404,
          message: "Filter not found." 
        });
      }

      console.log("Found filter:", filter.filterName);

      const filterConfig =
        typeof filter.filterConfig === "string"
          ? JSON.parse(filter.filterConfig)
          : filter.filterConfig;

      console.log("Filter config:", JSON.stringify(filterConfig, null, 2));

      const { all = [], any = [] } = filterConfig;
      const dealFields = Object.keys(Deal.rawAttributes);
      const dealDetailsFields = Object.keys(DealDetail.rawAttributes);
      const dealProductFields = DealProduct ? Object.keys(DealProduct.rawAttributes) : [];
      const productFields = Product ? Object.keys(Product.rawAttributes) : [];

      let filterWhere = {};
      let dealDetailsWhere = {};
      let dealProductWhere = {};
      let productWhere = {};

      console.log("Available deal fields:", dealFields);
      console.log("Available dealDetails fields:", dealDetailsFields);
      console.log("Available dealProduct fields:", dealProductFields);
      console.log("Available product fields:", productFields);

      // Process 'all' conditions (AND logic)
      if (all.length > 0) {
        console.log("Processing 'all' conditions:", all);

        filterWhere[Op.and] = [];
        dealDetailsWhere[Op.and] = [];
        dealProductWhere[Op.and] = [];
        productWhere[Op.and] = [];

        all.forEach((cond) => {
          console.log("Processing condition:", cond);

          if (dealFields.includes(cond.field)) {
            console.log(`Field '${cond.field}' found in Deal fields`);
            filterWhere[Op.and].push(buildCondition(cond, Deal, DealProduct, DealDetail, Product));
          } else if (dealDetailsFields.includes(cond.field)) {
            console.log(`Field '${cond.field}' found in DealDetails fields`);
            dealDetailsWhere[Op.and].push(buildCondition(cond, Deal, DealProduct, DealDetail, Product));
          } else if (dealProductFields.includes(cond.field)) {
            console.log(`Field '${cond.field}' found in DealProduct fields`);
            dealProductWhere[Op.and].push(buildCondition(cond, Deal, DealProduct, DealDetail, Product));
          } else if (productFields.includes(cond.field)) {
            console.log(`Field '${cond.field}' found in Product fields`);
            productWhere[Op.and].push(buildCondition(cond, Deal, DealProduct, DealDetail, Product));
          } else {
            console.log(
              `Field '${cond.field}' NOT found in standard fields, treating as custom field`
            );
            // Handle custom fields
            customFieldsConditions.all.push(cond);
          }
        });

        if (filterWhere[Op.and].length === 0) delete filterWhere[Op.and];
        if (dealDetailsWhere[Op.and].length === 0)
          delete dealDetailsWhere[Op.and];
        if (dealProductWhere[Op.and].length === 0)
          delete dealProductWhere[Op.and];
        if (productWhere[Op.and].length === 0)
          delete productWhere[Op.and];
      }

      // Process 'any' conditions (OR logic)
      if (any.length > 0) {
        console.log("Processing 'any' conditions:", any);

        filterWhere[Op.or] = [];
        dealDetailsWhere[Op.or] = [];
        dealProductWhere[Op.or] = [];
        productWhere[Op.or] = [];

        any.forEach((cond) => {
          if (dealFields.includes(cond.field)) {
            filterWhere[Op.or].push(buildCondition(cond, Deal, DealProduct, DealDetail, Product));
          } else if (dealDetailsFields.includes(cond.field)) {
            dealDetailsWhere[Op.or].push(buildCondition(cond, Deal, DealProduct, DealDetail, Product));
          } else if (dealProductFields.includes(cond.field)) {
            dealProductWhere[Op.or].push(buildCondition(cond, Deal, DealProduct, DealDetail, Product));
          } else if (productFields.includes(cond.field)) {
            productWhere[Op.or].push(buildCondition(cond, Deal, DealProduct, DealDetail, Product));
          } else {
            // Handle custom fields
            customFieldsConditions.any.push(cond);
          }
        });

        if (filterWhere[Op.or].length === 0) delete filterWhere[Op.or];
        if (dealDetailsWhere[Op.or].length === 0)
          delete dealDetailsWhere[Op.or];
        if (dealProductWhere[Op.or].length === 0)
          delete dealProductWhere[Op.or];
        if (productWhere[Op.or].length === 0)
          delete productWhere[Op.or];
      }

      // Apply masterUserID filtering logic for filters
      if (req.role === "admin") {
        // Admin can filter by specific masterUserID or see all deals
        if (masterUserID && masterUserID !== "all") {
          if (filterWhere[Op.or]) {
            // If there's already an Op.or condition from filters, combine properly
            filterWhere[Op.and] = [
              { [Op.or]: filterWhere[Op.or] },
              {
                [Op.or]: [
                  { masterUserID: masterUserID },
                  { ownerId: masterUserID },
                ],
              },
            ];
            delete filterWhere[Op.or];
          } else {
            filterWhere[Op.or] = [
              { masterUserID: masterUserID },
              { ownerId: masterUserID },
            ];
          }
        }
      } else {
        // Non-admin users: filter by their own deals or specific user if provided
        const userId =
          masterUserID && masterUserID !== "all" ? masterUserID : req.adminId;

        if (filterWhere[Op.or]) {
          // If there's already an Op.or condition from filters, combine properly
          filterWhere[Op.and] = [
            { [Op.or]: filterWhere[Op.or] },
            { [Op.or]: [{ masterUserID: userId }, { ownerId: userId }] },
          ];
          delete filterWhere[Op.or];
        } else {
          filterWhere[Op.or] = [{ masterUserID: userId }, { ownerId: userId }];
        }
      }

      // Add DealDetails include with filtering
      if (Object.keys(dealDetailsWhere).length > 0) {
        include.push({
          model: DealDetail,
          as: "details",
          where: dealDetailsWhere,
          required: true,
          attributes: dealDetailsAttributes,
        });
      } else if (dealDetailsAttributes && dealDetailsAttributes.length > 0) {
        include.push({
          model: DealDetail,
          as: "details",
          required: false,
          attributes: dealDetailsAttributes,
        });
      }

      // Add DealProduct and Product includes with filtering
      // Check if WHERE objects have any conditions (including Symbol keys like Op.and, Op.or)
      const hasDealProductWhereConditions = Object.getOwnPropertySymbols(dealProductWhere).length > 0 || Object.keys(dealProductWhere).length > 0;
      const hasProductWhereConditions = Object.getOwnPropertySymbols(productWhere).length > 0 || Object.keys(productWhere).length > 0;
      
      console.log("🔍 [PRODUCT FILTER] hasDealProductWhereConditions:", hasDealProductWhereConditions);
      console.log("🔍 [PRODUCT FILTER] hasProductWhereConditions:", hasProductWhereConditions);
      console.log("🔍 [PRODUCT FILTER] dealProductWhere Symbol keys:", Object.getOwnPropertySymbols(dealProductWhere).map(s => s.toString()));
      console.log("🔍 [PRODUCT FILTER] productWhere Symbol keys:", Object.getOwnPropertySymbols(productWhere).map(s => s.toString()));
      if (hasProductWhereConditions) {
        const symbols = Object.getOwnPropertySymbols(productWhere);
        symbols.forEach(sym => {
          console.log("🔍 [PRODUCT FILTER] productWhere condition:", productWhere[sym]);
        });
      }
      
      if (hasDealProductWhereConditions || hasProductWhereConditions) {
        const dealProductInclude = {
          model: DealProduct,
          as: "dealProducts",
          required: true, // INNER JOIN when filtering
        };

        // Add DealProduct WHERE conditions if any (use flag instead of Object.keys for Symbol support)
        if (hasDealProductWhereConditions) {
          dealProductInclude.where = dealProductWhere;
          console.log("🔍 [PRODUCT FILTER] Added dealProduct WHERE clause");
        }

        // Add nested Product include if filtering on Product fields (use flag instead of Object.keys for Symbol support)
        if (hasProductWhereConditions) {
          dealProductInclude.include = [
            {
              model: Product,
              as: "product",
              where: productWhere,
              required: true,
            },
          ];
          console.log("🔍 [PRODUCT FILTER] Added nested Product WHERE clause with required: true");
        } else {
          // Include product data without filtering
          dealProductInclude.include = [
            {
              model: Product,
              as: "product",
              required: false,
            },
          ];
          console.log("🔍 [PRODUCT FILTER] Added nested Product without filtering (required: false)");
        }

        include.push(dealProductInclude);
        
        console.log("🔍 [PRODUCT FILTER] Added product filtering to include (note: Symbol keys don't show in JSON.stringify)");
      } else {
        console.log("🔍 [PRODUCT FILTER] ⚠️ No product filtering applied - both WHERE objects are empty!");
      }

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
            isActive: true,
          },
          attributes: [
            "fieldId",
            "fieldName",
            "entityType",
            "fieldSource",
            "isActive",
            "masterUserID",
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
            masterUserID: f.masterUserID,
          }))
        );

        const customFieldFilters = await buildCustomFieldFilters(
          customFieldsConditions,
          req.adminId,
          CustomField
        );
        console.log("Built custom field filters:", customFieldFilters);

        if (customFieldFilters.length > 0) {
          // Apply custom field filtering by finding deals that match the custom field conditions
          const matchingDealIds = await getDealIdsByCustomFieldFilters(
            customFieldFilters,
            req.adminId,
            CustomFieldValue,
            CustomField,
            Deal
          );

          console.log(
            "Matching deal IDs from custom field filtering:",
            matchingDealIds
          );

          if (matchingDealIds.length > 0) {
            // If we already have other conditions, combine them
            if (filterWhere[Op.and]) {
              filterWhere[Op.and].push({
                dealId: { [Op.in]: matchingDealIds },
              });
            } else if (filterWhere[Op.or]) {
              filterWhere[Op.and] = [
                { [Op.or]: filterWhere[Op.or] },
                { dealId: { [Op.in]: matchingDealIds } },
              ];
              delete filterWhere[Op.or];
            } else {
              filterWhere.dealId = { [Op.in]: matchingDealIds };
            }
          } else {
            // No deals match the custom field conditions, so return empty result
            console.log(
              "No matching deals found for custom field filters, setting empty result"
            );
            filterWhere.dealId = { [Op.in]: [] };
          }
        } else {
          // Custom field conditions exist but no valid filters were built (field not found)
          console.log(
            "Custom field conditions exist but no valid filters found, setting empty result"
          );
          filterWhere.dealId = { [Op.in]: [] };
        }
      }

      // Merge filterWhere with the base where clause (don't replace it)
      // This preserves filters like isConvertedToLead that were set earlier
      where = { ...where, ...filterWhere };
    } else {
      // --- Standard filtering without filterId ---
      // Handle masterUserID filtering based on role
      if (req.role !== "admin") {
        where[Op.or] = [
          { masterUserID: req.adminId },
          { ownerId: req.adminId },
        ];
      } else if (masterUserID && masterUserID !== "all") {
        where[Op.or] = [
          { masterUserID: masterUserID },
          { ownerId: masterUserID },
        ];
      }

      // Basic search functionality
      if (search) {
        where[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { contactPerson: { [Op.like]: `%${search}%` } },
          { organization: { [Op.like]: `%${search}%` } },
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

      // Add isArchived filter if provided
      if (typeof isArchived !== "undefined") {
        where.isArchived = isArchived === "true";
      }

      // Add default DealDetails include if not added by filtering
      if (dealDetailsAttributes && dealDetailsAttributes.length > 0) {
        include.push({
          model: DealDetail,
          as: "details",
          attributes: dealDetailsAttributes,
          required: false,
        });
      }
    }

    console.log("→ Final where clause:", JSON.stringify(where, null, 2));
    console.log("→ Final include:", JSON.stringify(include, null, 2));

    const { rows: deals, count: total } = await Deal.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [[sortBy, order.toUpperCase()]],
      attributes,
      include,
      subQuery: false, // Disable subquery to allow proper nested joins with product filtering
      distinct: true, // Count distinct deals to avoid duplicates from INNER JOINs
    });

    console.log("→ Query executed. Total records:", total);

    // FETCH CURRENCY DETAILS FOR ALL DEALS
    // Get all unique currency IDs from the deals
    const currencyIds = new Set();
    const proposalCurrencyIds = new Set();
    
    deals.forEach(deal => {
      if (deal.currency) currencyIds.add(deal.currency);
      if (deal.proposalCurrency) proposalCurrencyIds.add(deal.proposalCurrency);
    });

    // Fetch currency details
    const currencies = await Currency.findAll({
      where: {
        currencyId: {
          [Op.in]: [...currencyIds, ...proposalCurrencyIds].filter(Boolean)
        }
      },
      attributes: ['currencyId', 'currency_desc']
    });

    // Create a map for quick lookup
    const currencyMap = {};
    currencies.forEach(currency => {
      currencyMap[currency.currencyId] = currency.currency_desc;
    });

    // Fetch custom field values for all deals
    const dealIds = deals.map((deal) => deal.dealId);

    console.log("🔍 === CUSTOM FIELDS DEBUG START ===");
    console.log("→ Fetching custom fields for dealIds:", dealIds);
    console.log("→ Current user adminId:", req.adminId);
    console.log("→ Number of deals to process:", dealIds.length);

    // First, let's check if there are any custom field values for these deals
    const allCustomFieldValues = await CustomFieldValue.findAll({
      where: {
        entityType: "deal",
        entityId: dealIds,
      },
      attributes: [
        "fieldId",
        "entityId",
        "entityType",
        "value",
        "masterUserID",
      ],
    });

    console.log(
      "→ All custom field values for these deals:",
      allCustomFieldValues.length
    );
    allCustomFieldValues.forEach((value) => {
      console.log(
        `  - Deal ${value.entityId}: Field ${value.fieldId} = ${value.value} (MasterUserID: ${value.masterUserID})`
      );
    });



    const allCustomFields = await CustomField.findAll({
      where: {
        isActive: true,
        entityType: { [Op.in]: ["deal", "both", "lead"] },
        check: true, // Only include custom fields where check is true
      },
      attributes: [
        "fieldId",
        "fieldName",
        "fieldLabel",
        "fieldType",
        "entityType",
        "fieldSource",
        "masterUserID",
        "isActive",
        "isImportant",
        "check",
      ],
    });

    console.log(
      "→ Available custom fields with check=true:",
      allCustomFields.length
    );
    allCustomFields.forEach((field) => {
      console.log(
        `  - ${field.fieldName} (ID: ${field.fieldId}, EntityType: ${field.entityType}, Source: ${field.fieldSource}, MasterUserID: ${field.masterUserID}, check: ${field.check})`
      );
    });

    const customFieldValues = await CustomFieldValue.findAll({
      where: {
        entityType: "deal",
        entityId: dealIds,
      },
      include: [
        {
          model: CustomField,
          as: "CustomField",
          where: {
            isActive: true,
            entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support unified fields including lead
            check: true, // Only include custom fields where check is true
          },
          attributes: [
            "fieldId",
            "fieldName", 
            "fieldLabel",
            "fieldType",
            "isImportant",
            "entityType",
            "check"
          ],
          required: true,
        },
      ],
    });

    console.log("→ Found custom field values:", customFieldValues.length);
    
    // DEBUG: Log each custom field value found
    customFieldValues.forEach((value, index) => {
      console.log(`🔍 CustomFieldValue ${index + 1}:`, {
        entityId: value.entityId,
        fieldId: value.fieldId,
        value: value.value,
        fieldName: value.CustomField?.fieldName,
        fieldLabel: value.CustomField?.fieldLabel,
        fieldType: value.CustomField?.fieldType,
        isImportant: value.CustomField?.isImportant
      });
    });

    // Group custom field values by dealId
    const customFieldsByDeal = {};
    customFieldValues.forEach((value) => {
      if (!customFieldsByDeal[value.entityId]) {
        customFieldsByDeal[value.entityId] = {};
      }
      customFieldsByDeal[value.entityId][value.CustomField.fieldName] = {
        label: value.CustomField.fieldLabel,
        value: value.value,
        type: value.CustomField.fieldType,
        isImportant: value.CustomField.isImportant,
      };
    });

    console.log(
      "→ Grouped custom fields by deal:",
      Object.keys(customFieldsByDeal).length,
      "deals have custom fields"
    );

    // Debug each deal's custom fields
    Object.keys(customFieldsByDeal).forEach((dealId) => {
      console.log(
        `  - Deal ${dealId} has custom fields:`,
        Object.keys(customFieldsByDeal[dealId])
      );
    });

    // Attach custom fields and status to each deal
    // Build a map of all active custom fields (deal/both/lead, dealCheck: true)
    const allActiveCustomFields = {};
    allCustomFields.forEach((field) => {
      allActiveCustomFields[field.fieldName] = {
        label: field.fieldLabel,
        value: "",
        type: field.fieldType,
        isImportant: field.isImportant,
      };
    });
    
    console.log("🔍 All active custom fields template:", Object.keys(allActiveCustomFields));
    console.log("🔍 Deals with custom field data:", Object.keys(customFieldsByDeal));

    // Initialize activity data by deal (placeholder for future activity integration)
    const activityDataByDeal = {};
    // TODO: Fetch and populate activity data for each deal
    // For now, this prevents the ReferenceError and returns default values

    const dealsWithCustomFields = deals.map((deal) => {
      const dealObj = deal.toJSON();

      // Flatten dealDetails into the main deal object if present
      if (dealObj.details) {
        Object.assign(dealObj, dealObj.details);
        delete dealObj.details;
      }

      // Always include ownerId in the response
      if (typeof dealObj.ownerId === 'undefined' || dealObj.ownerId === null) {
        // Try to get from the original deal instance if not present
        dealObj.ownerId = deal.ownerId || null;
      }

      // For proposal currency - keep both ID and description
      if (dealObj.proposalCurrency) {
        dealObj.proposalCurrencyId = dealObj.proposalCurrency;
        dealObj.proposalCurrency = currencyMap[dealObj.proposalCurrency] || null;
      } else {
        dealObj.proposalCurrencyId = null;
        dealObj.proposalCurrency = null;
      }

      // For value currency - keep both ID and description
      if (dealObj.currency) {
        dealObj.currencyId = dealObj.currency;
        dealObj.currency = currencyMap[dealObj.currency] || null;
      } else {
        dealObj.currencyId = null;
        dealObj.currency = null;
      }

      // DEBUG: Log for the first deal being processed
      if (deal === deals[0]) {
        console.log(`🔍 Processing first deal ID: ${dealObj.dealId}`);
        console.log(`🔍 Custom fields available for deal ${dealObj.dealId}:`, customFieldsByDeal[dealObj.dealId]);
      }

      // Add custom fields directly to the deal object (not wrapped in customFields) - same as getLeads
      const customFieldsData = customFieldsByDeal[dealObj.dealId] || {};
      console.log(`🔍 Deal ${dealObj.dealId} - Custom fields data:`, customFieldsData);

      Object.entries(customFieldsData).forEach(([fieldName, fieldData]) => {
        dealObj[fieldName] = fieldData.value;
        console.log(`🔍 Deal ${dealObj.dealId} - Added custom field: ${fieldName} = ${fieldData.value}`);
      });

      // Merge all active custom fields with values for this deal (for backward compatibility)
      const customFieldsForDeal = { ...allActiveCustomFields };
      const valuesForDeal = customFieldsByDeal[dealObj.dealId] || {};
      Object.keys(valuesForDeal).forEach((fieldName) => {
        customFieldsForDeal[fieldName] = {
          ...customFieldsForDeal[fieldName],
          ...valuesForDeal[fieldName],
        };
      });
      // Keep the customFields property for backward compatibility (same as getLeads)
      dealObj.customFields = customFieldsForDeal;

      console.log(`🔍 Deal ${dealObj.dealId} - Final customFields object:`, dealObj.customFields);

      // Ensure status is present (from deal or details)
      if (!("status" in dealObj)) {
        dealObj.status = deal.status || null;
      }

      // Add conversion flag information for UI display
      dealObj.isConvertedToLead = dealObj.isConvertedToLead || false;
      dealObj.convertedToLeadAt = dealObj.convertedToLeadAt || null;
      dealObj.convertedToLeadBy = dealObj.convertedToLeadBy || null;

      // Add display flag for UI
      if (dealObj.isConvertedToLead) {
        dealObj.conversionFlag = {
          badge: 'CONVERTED TO LEAD',
          icon: '🔄',
          color: '#ff9800',
          tooltip: `Converted to lead on ${dealObj.convertedToLeadAt ? new Date(dealObj.convertedToLeadAt).toLocaleDateString() : 'Unknown date'}`
        };
      }

      // Add activity information to the deal
      const activityData = activityDataByDeal[dealObj.dealId] || {
        totalActivities: 0,
        upcomingActivities: 0,
        completedActivities: 0,
        nextActivityDate: null,
        nextActivityType: null,
        nextActivitySubject: null
      };
      
      dealObj.totalActivities = activityData.totalActivities;
      dealObj.upcomingActivities = activityData.upcomingActivities;
      dealObj.completedActivities = activityData.completedActivities;
      dealObj.nextActivityDate = activityData.nextActivityDate;
      dealObj.nextActivityType = activityData.nextActivityType;
      dealObj.nextActivitySubject = activityData.nextActivitySubject;

      return dealObj;
    });

    console.log("🔍 === CUSTOM FIELDS DEBUG END ===");
    console.log(`🔍 Processed ${dealsWithCustomFields.length} deals with custom fields`);
    
    // DEBUG: Show final result for first deal
    if (dealsWithCustomFields.length > 0) {
      const firstDeal = dealsWithCustomFields[0];
      console.log(`🔍 First deal final result - dealId: ${firstDeal.dealId}`);
      console.log(`🔍 First deal customFields keys:`, Object.keys(firstDeal.customFields));
      console.log(`🔍 First deal has direct custom field properties:`, 
        Object.keys(firstDeal).filter(key => 
          !['dealId', 'contactPerson', 'organization', 'title', 'value', 'currency', 'pipeline', 'pipelineStage', 'expectedCloseDate', 'sourceChannel', 'serviceType', 'proposalValue', 'proposalCurrency', 'esplProposalNo', 'projectLocation', 'organizationCountry', 'proposalSentDate', 'sourceRequired', 'questionerShared', 'sectorialSector', 'sbuClass', 'phone', 'email', 'sourceOrgin', 'status', 'source', 'createdAt', 'updatedAt', 'masterUserID', 'ownerId', 'isArchived', 'label', 'nextActivityDate', 'wonTime', 'lostTime', 'dealClosedOn', 'ownerName', 'scopeOfServiceType', 'proposalCurrencyId', 'currencyId', 'customFields'].includes(key)
        )
      );
    }

    // --- Deal summary calculation (like getDealSummary) ---
    // Use the filtered deals for summary
    const summaryDeals = dealsWithCustomFields;
    // If dealsWithCustomFields is empty, summary will be zeroed
    let totalValue = 0;
    let totalWeightedValue = 0;
    let totalDealCount = 0;
    const currencySummaryMap = {};

    // Fetch pipeline stage probabilities
    let stageProbabilities = {};
    try {
      const pipelineStages = await PipelineStage.findAll({
        attributes: ["stageName", "probability"],
        where: { isActive: true },
      });
      stageProbabilities = pipelineStages.reduce((acc, stage) => {
        acc[stage.stageName] = stage.probability || 0;
        return acc;
      }, {});
    } catch (e) {
      // fallback: all probabilities 0
    }

    summaryDeals.forEach((deal) => {
      const currencyId = deal.currencyId || deal.currency; // Use currencyId if available, otherwise fallback
      const currencyDesc = deal.currency || 'Unknown'; // Use the currency description
      const value = deal.value || 0;
      const pipelineStage = deal.pipelineStage;
      
      if (!currencySummaryMap[currencyDesc]) {
        currencySummaryMap[currencyDesc] = {
          totalValue: 0,
          weightedValue: 0,
          dealCount: 0,
          currencyId: currencyId
        };
      }
      currencySummaryMap[currencyDesc].totalValue += value;
      currencySummaryMap[currencyDesc].weightedValue +=
        (value * (stageProbabilities[pipelineStage] || 0)) / 100;
      currencySummaryMap[currencyDesc].dealCount += 1;
      totalValue += value;
      totalWeightedValue +=
        (value * (stageProbabilities[pipelineStage] || 0)) / 100;
      totalDealCount += 1;
    });

    const summary = Object.entries(currencySummaryMap).map(([currency, data]) => ({
      currency,
      currencyId: data.currencyId,
      totalValue: data.totalValue,
      weightedValue: data.weightedValue,
      dealCount: data.dealCount,
    }));
    summary.sort((a, b) => b.totalValue - a.totalValue);

    // const filterDeals = dealsWithCustomFields.filter(deal => deal?.visibilityGroupId == groupId);
    const findGroup = await GroupVisibility.findOne({
      where:{
        groupId: 1 //groupId
      }
    })

    
    let filterDeals = [];

    for(let i = 0; i < dealsWithCustomFields.length; i++){
      if(dealsWithCustomFields[i]?.visibleGroup == "owner"){
        if(filterDeals[i]?.ownerId == req.adminId){
          filterDeals.push(flatLeads[i]);
        }
      }else if(dealsWithCustomFields[i]?.visibleGroup == "visibilitygroup"){
        findGroup?.memberIds?.split(",").includes(req.adminId.toString()) && filterDeals.push(flatLeads[i]);
      }else{
        filterDeals.push(dealsWithCustomFields[i]);
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
      
    //   const filterDeals = dealsWithCustomFields.filter((idx)=> idx?.ownerId == req.adminId || idx?.visibilityGroupId == groupId ||  idx?.visibilityGroupId == findGroup?.parentGroupId || findParentGroup.memberIds?.split(",").includes(req.adminId.toString()));

    //   filterDeals = filterDeals;
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

    //   const filterFields = dealsWithCustomFields.filter((idx)=> idx?.ownerId == req.adminId || idx?.visibilityGroupId == findGroup?.parentGroupId || findParentGroup.memberIds?.split(",").includes(req.adminId.toString()));

    //   filterDeals = filterFields;
    // }else{
    //   filterDeals = dealsWithCustomFields;
    // }

    res.status(200).json({
      statusCode: 200,
      message: "Deals fetched successfully",
      totalDeals: total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      deals: dealsWithCustomFields,
      role: req.role,
      totalValue,
      totalWeightedValue,
      totalDealCount,
      summary,
    });
  } catch (error) {
    console.error("❌ Error fetching deals:", error);
    console.error("❌ Error stack:", error.stack);
    console.error("❌ Error message:", error.message);
    res.status(500).json({ 
      statusCode: 500,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// exports.getDeals = async (req, res) => {
//   const {
//     page = 1,
//     limit = 20,
//     search,
//     sortBy = "createdAt",
//     order = "DESC",
//     pipeline,
//     pipelineStage,
//     ownerId,
//     masterUserID,
//     isArchived,
//     filterId,
//   } = req.query;

//   const offset = (page - 1) * limit;

//   try {
//     // Build the base where clause
//     let where = {};

//     // --- Handle column preferences ---
//     const pref = await DealColumn.findOne();
//     let attributes = [];
//     let dealDetailsAttributes = [];

//     if (pref && pref.columns) {
//       const columns =
//         typeof pref.columns === "string"
//           ? JSON.parse(pref.columns)
//           : pref.columns;

//       // Get all Deal and DealDetails fields
//       const dealFields = Object.keys(Deal.rawAttributes);
//       const dealDetailsFields = DealDetails
//         ? Object.keys(DealDetail.rawAttributes)
//         : [];

//       // Filter checked columns by table
//       const checkedColumns = columns.filter((col) => col.check);

//       dealFields.forEach((field) => {
//         const col = checkedColumns.find((c) => c.key === field);
//         if (col) attributes.push(field);
//       });

//       dealDetailsFields.forEach((field) => {
//         const col = checkedColumns.find((c) => c.key === field);
//         if (col) dealDetailsAttributes.push(field);
//       });

//       // Always include dealId for relationships
//       if (!attributes.includes("dealId")) {
//         attributes.unshift("dealId");
//       }
//       // Always include status column from database
//       if (!attributes.includes("status")) {
//         attributes.push("status");
//       }

//       if (attributes.length === 0) attributes = undefined;
//       if (dealDetailsAttributes.length === 0) dealDetailsAttributes = undefined;
//     }

//     // --- Handle dynamic filtering ---
//     let include = [];
//     let customFieldsConditions = { all: [], any: [] };

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
//       const dealFields = Object.keys(Deal.rawAttributes);
//       const dealDetailsFields = Object.keys(DealDetail.rawAttributes);

//       let filterWhere = {};
//       let dealDetailsWhere = {};

//       console.log("Available deal fields:", dealFields);
//       console.log("Available dealDetails fields:", dealDetailsFields);

//       // Process 'all' conditions (AND logic)
//       if (all.length > 0) {
//         console.log("Processing 'all' conditions:", all);

//         filterWhere[Op.and] = [];
//         dealDetailsWhere[Op.and] = [];

//         all.forEach((cond) => {
//           console.log("Processing condition:", cond);

//           if (dealFields.includes(cond.field)) {
//             console.log(`Field '${cond.field}' found in Deal fields`);
//             filterWhere[Op.and].push(buildCondition(cond));
//           } else if (dealDetailsFields.includes(cond.field)) {
//             console.log(`Field '${cond.field}' found in DealDetails fields`);
//             dealDetailsWhere[Op.and].push(buildCondition(cond));
//           } else {
//             console.log(
//               `Field '${cond.field}' NOT found in standard fields, treating as custom field`
//             );
//             // Handle custom fields
//             customFieldsConditions.all.push(cond);
//           }
//         });

//         if (filterWhere[Op.and].length === 0) delete filterWhere[Op.and];
//         if (dealDetailsWhere[Op.and].length === 0)
//           delete dealDetailsWhere[Op.and];
//       }

//       // Process 'any' conditions (OR logic)
//       if (any.length > 0) {
//         console.log("Processing 'any' conditions:", any);

//         filterWhere[Op.or] = [];
//         dealDetailsWhere[Op.or] = [];

//         any.forEach((cond) => {
//           if (dealFields.includes(cond.field)) {
//             filterWhere[Op.or].push(buildCondition(cond));
//           } else if (dealDetailsFields.includes(cond.field)) {
//             dealDetailsWhere[Op.or].push(buildCondition(cond));
//           } else {
//             // Handle custom fields
//             customFieldsConditions.any.push(cond);
//           }
//         });

//         if (filterWhere[Op.or].length === 0) delete filterWhere[Op.or];
//         if (dealDetailsWhere[Op.or].length === 0)
//           delete dealDetailsWhere[Op.or];
//       }

//       // Apply masterUserID filtering logic for filters
//       if (req.role === "admin") {
//         // Admin can filter by specific masterUserID or see all deals
//         if (masterUserID && masterUserID !== "all") {
//           if (filterWhere[Op.or]) {
//             // If there's already an Op.or condition from filters, combine properly
//             filterWhere[Op.and] = [
//               { [Op.or]: filterWhere[Op.or] },
//               {
//                 [Op.or]: [
//                   { masterUserID: masterUserID },
//                   { ownerId: masterUserID },
//                 ],
//               },
//             ];
//             delete filterWhere[Op.or];
//           } else {
//             filterWhere[Op.or] = [
//               { masterUserID: masterUserID },
//               { ownerId: masterUserID },
//             ];
//           }
//         }
//       } else {
//         // Non-admin users: filter by their own deals or specific user if provided
//         const userId =
//           masterUserID && masterUserID !== "all" ? masterUserID : req.adminId;

//         if (filterWhere[Op.or]) {
//           // If there's already an Op.or condition from filters, combine properly
//           filterWhere[Op.and] = [
//             { [Op.or]: filterWhere[Op.or] },
//             { [Op.or]: [{ masterUserID: userId }, { ownerId: userId }] },
//           ];
//           delete filterWhere[Op.or];
//         } else {
//           filterWhere[Op.or] = [{ masterUserID: userId }, { ownerId: userId }];
//         }
//       }

//       // Add DealDetails include with filtering
//       if (Object.keys(dealDetailsWhere).length > 0) {
//         include.push({
//           model: DealDetails,
//           as: "details",
//           where: dealDetailsWhere,
//           required: true,
//           attributes: dealDetailsAttributes,
//         });
//       } else if (dealDetailsAttributes && dealDetailsAttributes.length > 0) {
//         include.push({
//           model: DealDetails,
//           as: "details",
//           required: false,
//           attributes: dealDetailsAttributes,
//         });
//       }

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
//             isActive: true,
//           },
//           attributes: [
//             "fieldId",
//             "fieldName",
//             "entityType",
//             "fieldSource",
//             "isActive",
//             "masterUserID",
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
//             masterUserID: f.masterUserID,
//           }))
//         );

//         const customFieldFilters = await buildCustomFieldFilters(
//           customFieldsConditions,
//           req.adminId
//         );
//         console.log("Built custom field filters:", customFieldFilters);

//         if (customFieldFilters.length > 0) {
//           // Apply custom field filtering by finding deals that match the custom field conditions
//           const matchingDealIds = await getDealIdsByCustomFieldFilters(
//             customFieldFilters,
//             req.adminId
//           );

//           console.log(
//             "Matching deal IDs from custom field filtering:",
//             matchingDealIds
//           );

//           if (matchingDealIds.length > 0) {
//             // If we already have other conditions, combine them
//             if (filterWhere[Op.and]) {
//               filterWhere[Op.and].push({
//                 dealId: { [Op.in]: matchingDealIds },
//               });
//             } else if (filterWhere[Op.or]) {
//               filterWhere[Op.and] = [
//                 { [Op.or]: filterWhere[Op.or] },
//                 { dealId: { [Op.in]: matchingDealIds } },
//               ];
//               delete filterWhere[Op.or];
//             } else {
//               filterWhere.dealId = { [Op.in]: matchingDealIds };
//             }
//           } else {
//             // No deals match the custom field conditions, so return empty result
//             console.log(
//               "No matching deals found for custom field filters, setting empty result"
//             );
//             filterWhere.dealId = { [Op.in]: [] };
//           }
//         } else {
//           // Custom field conditions exist but no valid filters were built (field not found)
//           console.log(
//             "Custom field conditions exist but no valid filters found, setting empty result"
//           );
//           filterWhere.dealId = { [Op.in]: [] };
//         }
//       }

//       where = filterWhere;
//     } else {
//       // --- Standard filtering without filterId ---
//       // Handle masterUserID filtering based on role
//       if (req.role !== "admin") {
//         where[Op.or] = [
//           { masterUserID: req.adminId },
//           { ownerId: req.adminId },
//         ];
//       } else if (masterUserID && masterUserID !== "all") {
//         where[Op.or] = [
//           { masterUserID: masterUserID },
//           { ownerId: masterUserID },
//         ];
//       }

//       // Basic search functionality
//       if (search) {
//         where[Op.or] = [
//           { title: { [Op.like]: `%${search}%` } },
//           { contactPerson: { [Op.like]: `%${search}%` } },
//           { organization: { [Op.like]: `%${search}%` } },
//         ];
//       }

//       // Filter by pipeline
//       if (pipeline) {
//         where.pipeline = pipeline;
//       }

//       // Filter by pipelineStage
//       if (pipelineStage) {
//         where.pipelineStage = pipelineStage;
//       }

//       // Filter by ownerId
//       if (ownerId) {
//         where.ownerId = ownerId;
//       }

//       // Add isArchived filter if provided
//       if (typeof isArchived !== "undefined") {
//         where.isArchived = isArchived === "true";
//       }

//       // Add default DealDetails include if not added by filtering
//       if (dealDetailsAttributes && dealDetailsAttributes.length > 0) {
//         include.push({
//           model: DealDetails,
//           as: "details",
//           attributes: dealDetailsAttributes,
//           required: false,
//         });
//       }
//     }

//     console.log("→ Final where clause:", JSON.stringify(where, null, 2));
//     console.log("→ Final include:", JSON.stringify(include, null, 2));

//     const { rows: deals, count: total } = await Deal.findAndCountAll({
//       where,
//       limit: parseInt(limit),
//       offset,
//       order: [[sortBy, order.toUpperCase()]],
//       attributes,
//       include,
//     });

//     console.log("→ Query executed. Total records:", total);

//     // FETCH CURRENCY DETAILS FOR ALL DEALS
//     // Get all unique currency IDs from the deals
//     const currencyIds = new Set();
//     const proposalCurrencyIds = new Set();
    
//     deals.forEach(deal => {
//       if (deal.currency) currencyIds.add(deal.currency);
//       if (deal.proposalCurrency) proposalCurrencyIds.add(deal.proposalCurrency);
//     });

//     // Fetch currency details
//     const currencies = await Currency.findAll({
//       where: {
//         currencyId: {
//           [Op.in]: [...currencyIds, ...proposalCurrencyIds].filter(Boolean)
//         }
//       },
//       attributes: ['currencyId', 'currency_desc']
//     });

//     // Create a map for quick lookup
//     const currencyMap = {};
//     currencies.forEach(currency => {
//       currencyMap[currency.currencyId] = currency.currency_desc;
//     });

//     // Fetch custom field values for all deals
//     const dealIds = deals.map((deal) => deal.dealId);

//     console.log("→ Fetching custom fields for dealIds:", dealIds);
//     console.log("→ Current user adminId:", req.adminId);

//     // First, let's check if there are any custom field values for these deals
//     const allCustomFieldValues = await CustomFieldValue.findAll({
//       where: {
//         entityType: "deal",
//         entityId: dealIds,
//       },
//       attributes: [
//         "fieldId",
//         "entityId",
//         "entityType",
//         "value",
//         "masterUserID",
//       ],
//     });

//     console.log(
//       "→ All custom field values for these deals:",
//       allCustomFieldValues.length
//     );
//     allCustomFieldValues.forEach((value) => {
//       console.log(
//         `  - Deal ${value.entityId}: Field ${value.fieldId} = ${value.value} (MasterUserID: ${value.masterUserID})`
//       );
//     });

//     // Now check custom fields that match our criteria and have dealCheck = true
//     const allCustomFields = await CustomField.findAll({
//       where: {
//         isActive: true,
//         entityType: { [Op.in]: ["deal", "both", "lead"] },
//         dealCheck: true, // Only include custom fields where dealCheck is true
//       },
//       attributes: [
//         "fieldId",
//         "fieldName",
//         "entityType",
//         "fieldSource",
//         "masterUserID",
//         "isActive",
//         "dealCheck",
//       ],
//     });

//     console.log(
//       "→ Available custom fields with dealCheck=true:",
//       allCustomFields.length
//     );
//     allCustomFields.forEach((field) => {
//       console.log(
//         `  - ${field.fieldName} (ID: ${field.fieldId}, EntityType: ${field.entityType}, Source: ${field.fieldSource}, MasterUserID: ${field.masterUserID}, dealCheck: ${field.dealCheck})`
//       );
//     });

//     const customFieldValues = await CustomFieldValue.findAll({
//       where: {
//         entityType: "deal",
//         entityId: dealIds,
//       },
//       include: [
//         {
//           model: CustomField,
//           as: "CustomField",
//           where: {
//             isActive: true,
//             entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support unified fields including lead
//             dealCheck: true, // Only include custom fields where dealCheck is true
//           },
//           required: true,
//         },
//       ],
//     });

//     console.log("→ Found custom field values:", customFieldValues.length);

//     // Group custom field values by dealId
//     const customFieldsByDeal = {};
//     customFieldValues.forEach((value) => {
//       if (!customFieldsByDeal[value.entityId]) {
//         customFieldsByDeal[value.entityId] = {};
//       }
//       customFieldsByDeal[value.entityId][value.CustomField.fieldName] = {
//         label: value.CustomField.fieldLabel,
//         value: value.value,
//         type: value.CustomField.fieldType,
//         isImportant: value.CustomField.isImportant,
//       };
//     });

//     console.log(
//       "→ Grouped custom fields by deal:",
//       Object.keys(customFieldsByDeal).length,
//       "deals have custom fields"
//     );

//     // Debug each deal's custom fields
//     Object.keys(customFieldsByDeal).forEach((dealId) => {
//       console.log(
//         `  - Deal ${dealId} has custom fields:`,
//         Object.keys(customFieldsByDeal[dealId])
//       );
//     });

//     // Attach custom fields and status to each deal
//     // Build a map of all active custom fields (deal/both/lead, dealCheck: true)
//     const allActiveCustomFields = {};
//     allCustomFields.forEach((field) => {
//       allActiveCustomFields[field.fieldName] = {
//         label: field.fieldLabel,
//         value: "",
//         type: field.fieldType,
//         isImportant: field.isImportant,
//       };
//     });

//     const dealsWithCustomFields = deals.map((deal) => {
//       const dealObj = deal.toJSON();

//       // Flatten dealDetails into the main deal object if present
//       if (dealObj.details) {
//         Object.assign(dealObj, dealObj.details);
//         delete dealObj.details;
//       }
      
//       if (
//         dealObj.proposalCurrency &&
//         currencies[dealObj.proposalCurrency]
//       ) {
//         dealObj.proposalCurrencyId = dealObj.proposalCurrency;
//         dealObj.proposalCurrency =
//           currencies[dealObj.proposalCurrency];
//       } else {
//         dealObj.proposalCurrencyId = null;
//         dealObj.proposalCurrency = null;
//       }

//       // For value currency
//       if (dealObj.currency && currencies[dealObj.currency]) {
//         dealObj.currencyId = dealObj.currency;
//         dealObj.currency = currencies[dealObj.currency];
//       } else {
//         dealObj.currencyId = null;
//         dealObj.currency = null;
//       }

//       // Merge all active custom fields with values for this deal
//       const customFieldsForDeal = { ...allActiveCustomFields };
//       const valuesForDeal = customFieldsByDeal[dealObj.dealId] || {};
//       Object.keys(valuesForDeal).forEach((fieldName) => {
//         customFieldsForDeal[fieldName] = {
//           ...customFieldsForDeal[fieldName],
//           ...valuesForDeal[fieldName],
//         };
//       });
//       dealObj.customFields = customFieldsForDeal;

//       // Ensure status is present (from deal or details)
//       if (!("status" in dealObj)) {
//         dealObj.status = deal.status || null;
//       }

//       return dealObj;
//     });

//     // --- Deal summary calculation (like getDealSummary) ---
//     // Use the filtered deals for summary
//     const summaryDeals = dealsWithCustomFields;
//     // If dealsWithCustomFields is empty, summary will be zeroed
//     let totalValue = 0;
//     let totalWeightedValue = 0;
//     let totalDealCount = 0;
//     const currencySummaryMap = {};

//     // Fetch pipeline stage probabilities
//     let stageProbabilities = {};
//     try {
//       const pipelineStages = await PipelineStage.findAll({
//         attributes: ["stageName", "probability"],
//         where: { isActive: true },
//       });
//       stageProbabilities = pipelineStages.reduce((acc, stage) => {
//         acc[stage.stageName] = stage.probability || 0;
//         return acc;
//       }, {});
//     } catch (e) {
//       // fallback: all probabilities 0
//     }

//     summaryDeals.forEach((deal) => {
//       const currencyId = deal.currency;
//       const currencyDesc = currencyMap[currencyId] || 'Unknown';
//       const value = deal.value || 0;
//       const pipelineStage = deal.pipelineStage;
      
//       if (!currencySummaryMap[currencyDesc]) {
//         currencySummaryMap[currencyDesc] = {
//           totalValue: 0,
//           weightedValue: 0,
//           dealCount: 0,
//           currencyId: currencyId
//         };
//       }
//       currencySummaryMap[currencyDesc].totalValue += value;
//       currencySummaryMap[currencyDesc].weightedValue +=
//         (value * (stageProbabilities[pipelineStage] || 0)) / 100;
//       currencySummaryMap[currencyDesc].dealCount += 1;
//       totalValue += value;
//       totalWeightedValue +=
//         (value * (stageProbabilities[pipelineStage] || 0)) / 100;
//       totalDealCount += 1;
//     });

//     const summary = Object.entries(currencySummaryMap).map(([currency, data]) => ({
//       currency,
//       currencyId: data.currencyId,
//       totalValue: data.totalValue,
//       weightedValue: data.weightedValue,
//       dealCount: data.dealCount,
//     }));
//     summary.sort((a, b) => b.totalValue - a.totalValue);

//     res.status(200).json({
//       message: "Deals fetched successfully",
//       totalDeals: total,
//       totalPages: Math.ceil(total / limit),
//       currentPage: parseInt(page),
//       deals: dealsWithCustomFields,
//       role: req.role,
//       totalValue,
//       totalWeightedValue,
//       totalDealCount,
//       summary,
//     });
//   } catch (error) {
//     console.error("Error fetching deals:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// exports.getDeals = async (req, res) => {
//   const {
//     page = 1,
//     limit = 20,
//     search,
//     sortBy = "createdAt",
//     order = "DESC",
//     pipeline,
//     pipelineStage,
//     ownerId,
//     masterUserID,
//     isArchived,
//     filterId,
//   } = req.query;

//   const offset = (page - 1) * limit;

//   try {
//     // Build the base where clause
//     let where = {};

//     // --- Handle column preferences ---
//     const pref = await DealColumn.findOne();
//     let attributes = [];
//     let dealDetailsAttributes = [];

//     if (pref && pref.columns) {
//       const columns =
//         typeof pref.columns === "string"
//           ? JSON.parse(pref.columns)
//           : pref.columns;

//       // Get all Deal and DealDetails fields
//       const dealFields = Object.keys(Deal.rawAttributes);
//       const dealDetailsFields = DealDetails
//         ? Object.keys(DealDetail.rawAttributes)
//         : [];

//       // Filter checked columns by table
//       const checkedColumns = columns.filter((col) => col.check);

//       dealFields.forEach((field) => {
//         const col = checkedColumns.find((c) => c.key === field);
//         if (col) attributes.push(field);
//       });

//       dealDetailsFields.forEach((field) => {
//         const col = checkedColumns.find((c) => c.key === field);
//         if (col) dealDetailsAttributes.push(field);
//       });

//       // Always include dealId for relationships
//       if (!attributes.includes("dealId")) {
//         attributes.unshift("dealId");
//       }
//       // Always include status column from database
//       if (!attributes.includes("status")) {
//         attributes.push("status");
//       }

//       if (attributes.length === 0) attributes = undefined;
//       if (dealDetailsAttributes.length === 0) dealDetailsAttributes = undefined;
//     }

//     // --- Handle dynamic filtering ---
//     let include = [];
//     let customFieldsConditions = { all: [], any: [] };

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
//       const dealFields = Object.keys(Deal.rawAttributes);
//       const dealDetailsFields = Object.keys(DealDetail.rawAttributes);

//       let filterWhere = {};
//       let dealDetailsWhere = {};

//       console.log("Available deal fields:", dealFields);
//       console.log("Available dealDetails fields:", dealDetailsFields);

//       // Process 'all' conditions (AND logic)
//       if (all.length > 0) {
//         console.log("Processing 'all' conditions:", all);

//         filterWhere[Op.and] = [];
//         dealDetailsWhere[Op.and] = [];

//         all.forEach((cond) => {
//           console.log("Processing condition:", cond);

//           if (dealFields.includes(cond.field)) {
//             console.log(`Field '${cond.field}' found in Deal fields`);
//             filterWhere[Op.and].push(buildCondition(cond));
//           } else if (dealDetailsFields.includes(cond.field)) {
//             console.log(`Field '${cond.field}' found in DealDetails fields`);
//             dealDetailsWhere[Op.and].push(buildCondition(cond));
//           } else {
//             console.log(
//               `Field '${cond.field}' NOT found in standard fields, treating as custom field`
//             );
//             // Handle custom fields
//             customFieldsConditions.all.push(cond);
//           }
//         });

//         if (filterWhere[Op.and].length === 0) delete filterWhere[Op.and];
//         if (dealDetailsWhere[Op.and].length === 0)
//           delete dealDetailsWhere[Op.and];
//       }

//       // Process 'any' conditions (OR logic)
//       if (any.length > 0) {
//         console.log("Processing 'any' conditions:", any);

//         filterWhere[Op.or] = [];
//         dealDetailsWhere[Op.or] = [];

//         any.forEach((cond) => {
//           if (dealFields.includes(cond.field)) {
//             filterWhere[Op.or].push(buildCondition(cond));
//           } else if (dealDetailsFields.includes(cond.field)) {
//             dealDetailsWhere[Op.or].push(buildCondition(cond));
//           } else {
//             // Handle custom fields
//             customFieldsConditions.any.push(cond);
//           }
//         });

//         if (filterWhere[Op.or].length === 0) delete filterWhere[Op.or];
//         if (dealDetailsWhere[Op.or].length === 0)
//           delete dealDetailsWhere[Op.or];
//       }

//       // Apply masterUserID filtering logic for filters
//       if (req.role === "admin") {
//         // Admin can filter by specific masterUserID or see all deals
//         if (masterUserID && masterUserID !== "all") {
//           if (filterWhere[Op.or]) {
//             // If there's already an Op.or condition from filters, combine properly
//             filterWhere[Op.and] = [
//               { [Op.or]: filterWhere[Op.or] },
//               {
//                 [Op.or]: [
//                   { masterUserID: masterUserID },
//                   { ownerId: masterUserID },
//                 ],
//               },
//             ];
//             delete filterWhere[Op.or];
//           } else {
//             filterWhere[Op.or] = [
//               { masterUserID: masterUserID },
//               { ownerId: masterUserID },
//             ];
//           }
//         }
//       } else {
//         // Non-admin users: filter by their own deals or specific user if provided
//         const userId =
//           masterUserID && masterUserID !== "all" ? masterUserID : req.adminId;

//         if (filterWhere[Op.or]) {
//           // If there's already an Op.or condition from filters, combine properly
//           filterWhere[Op.and] = [
//             { [Op.or]: filterWhere[Op.or] },
//             { [Op.or]: [{ masterUserID: userId }, { ownerId: userId }] },
//           ];
//           delete filterWhere[Op.or];
//         } else {
//           filterWhere[Op.or] = [{ masterUserID: userId }, { ownerId: userId }];
//         }
//       }

//       // Add DealDetails include with filtering
//       if (Object.keys(dealDetailsWhere).length > 0) {
//         include.push({
//           model: DealDetails,
//           as: "details",
//           where: dealDetailsWhere,
//           required: true,
//           attributes: dealDetailsAttributes,
//         });
//       } else if (dealDetailsAttributes && dealDetailsAttributes.length > 0) {
//         include.push({
//           model: DealDetails,
//           as: "details",
//           required: false,
//           attributes: dealDetailsAttributes,
//         });
//       }

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
//             isActive: true,
//             // [Op.or]: [
//             //   { masterUserID: req.adminId },
//             //   { fieldSource: "default" },
//             //   { fieldSource: "system" },
//             // ],
//           },
//           attributes: [
//             "fieldId",
//             "fieldName",
//             "entityType",
//             "fieldSource",
//             "isActive",
//             "masterUserID",
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
//             masterUserID: f.masterUserID,
//           }))
//         );

//         const customFieldFilters = await buildCustomFieldFilters(
//           customFieldsConditions,
//           req.adminId
//         );
//         console.log("Built custom field filters:", customFieldFilters);

//         if (customFieldFilters.length > 0) {
//           // Apply custom field filtering by finding deals that match the custom field conditions
//           const matchingDealIds = await getDealIdsByCustomFieldFilters(
//             customFieldFilters,
//             req.adminId
//           );

//           console.log(
//             "Matching deal IDs from custom field filtering:",
//             matchingDealIds
//           );

//           if (matchingDealIds.length > 0) {
//             // If we already have other conditions, combine them
//             if (filterWhere[Op.and]) {
//               filterWhere[Op.and].push({
//                 dealId: { [Op.in]: matchingDealIds },
//               });
//             } else if (filterWhere[Op.or]) {
//               filterWhere[Op.and] = [
//                 { [Op.or]: filterWhere[Op.or] },
//                 { dealId: { [Op.in]: matchingDealIds } },
//               ];
//               delete filterWhere[Op.or];
//             } else {
//               filterWhere.dealId = { [Op.in]: matchingDealIds };
//             }
//           } else {
//             // No deals match the custom field conditions, so return empty result
//             console.log(
//               "No matching deals found for custom field filters, setting empty result"
//             );
//             filterWhere.dealId = { [Op.in]: [] };
//           }
//         } else {
//           // Custom field conditions exist but no valid filters were built (field not found)
//           console.log(
//             "Custom field conditions exist but no valid filters found, setting empty result"
//           );
//           filterWhere.dealId = { [Op.in]: [] };
//         }
//       }

//       where = filterWhere;
//     } else {
//       // --- Standard filtering without filterId ---
//       // Handle masterUserID filtering based on role
//       if (req.role !== "admin") {
//         where[Op.or] = [
//           { masterUserID: req.adminId },
//           { ownerId: req.adminId },
//         ];
//       } else if (masterUserID && masterUserID !== "all") {
//         where[Op.or] = [
//           { masterUserID: masterUserID },
//           { ownerId: masterUserID },
//         ];
//       }

//       // Basic search functionality
//       if (search) {
//         where[Op.or] = [
//           { title: { [Op.like]: `%${search}%` } },
//           { contactPerson: { [Op.like]: `%${search}%` } },
//           { organization: { [Op.like]: `%${search}%` } },
//         ];
//       }

//       // Filter by pipeline
//       if (pipeline) {
//         where.pipeline = pipeline;
//       }

//       // Filter by pipelineStage
//       if (pipelineStage) {
//         where.pipelineStage = pipelineStage;
//       }

//       // Filter by ownerId
//       if (ownerId) {
//         where.ownerId = ownerId;
//       }

//       // Add isArchived filter if provided
//       if (typeof isArchived !== "undefined") {
//         where.isArchived = isArchived === "true";
//       }

//       // Add default DealDetails include if not added by filtering
//       if (dealDetailsAttributes && dealDetailsAttributes.length > 0) {
//         include.push({
//           model: DealDetails,
//           as: "details",
//           attributes: dealDetailsAttributes,
//           required: false,
//         });
//       }
//     }

//     console.log("→ Final where clause:", JSON.stringify(where, null, 2));
//     console.log("→ Final include:", JSON.stringify(include, null, 2));

//     const { rows: deals, count: total } = await Deal.findAndCountAll({
//       where,
//       limit: parseInt(limit),
//       offset,
//       order: [[sortBy, order.toUpperCase()]],
//       attributes,
//       include,
//     });

//     console.log("→ Query executed. Total records:", total);

//     // Fetch custom field values for all deals
//     const dealIds = deals.map((deal) => deal.dealId);

//     console.log("→ Fetching custom fields for dealIds:", dealIds);
//     console.log("→ Current user adminId:", req.adminId);

//     // First, let's check if there are any custom field values for these deals
//     const allCustomFieldValues = await CustomFieldValue.findAll({
//       where: {
//         entityType: "deal",
//         entityId: dealIds,
//       },
//       attributes: [
//         "fieldId",
//         "entityId",
//         "entityType",
//         "value",
//         "masterUserID",
//       ],
//     });

//     console.log(
//       "→ All custom field values for these deals:",
//       allCustomFieldValues.length
//     );
//     allCustomFieldValues.forEach((value) => {
//       console.log(
//         `  - Deal ${value.entityId}: Field ${value.fieldId} = ${value.value} (MasterUserID: ${value.masterUserID})`
//       );
//     });

//     // Now check custom fields that match our criteria and have dealCheck = true
//     const allCustomFields = await CustomField.findAll({
//       where: {
//         isActive: true,
//         entityType: { [Op.in]: ["deal", "both", "lead"] },
//         dealCheck: true, // Only include custom fields where dealCheck is true
//         // [Op.or]: [
//         //   { masterUserID: req.adminId },
//         //   { fieldSource: "default" },
//         //   { fieldSource: "system" },
//         // ],
//       },
//       attributes: [
//         "fieldId",
//         "fieldName",
//         "entityType",
//         "fieldSource",
//         "masterUserID",
//         "isActive",
//         "dealCheck",
//       ],
//     });

//     console.log(
//       "→ Available custom fields with dealCheck=true:",
//       allCustomFields.length
//     );
//     allCustomFields.forEach((field) => {
//       console.log(
//         `  - ${field.fieldName} (ID: ${field.fieldId}, EntityType: ${field.entityType}, Source: ${field.fieldSource}, MasterUserID: ${field.masterUserID}, dealCheck: ${field.dealCheck})`
//       );
//     });

//     const customFieldValues = await CustomFieldValue.findAll({
//       where: {
//         entityType: "deal",
//         entityId: dealIds,
//       },
//       include: [
//         {
//           model: CustomField,
//           as: "CustomField",
//           where: {
//             isActive: true,
//             entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support unified fields including lead
//             dealCheck: true, // Only include custom fields where dealCheck is true
//             // [Op.or]: [
//             //   { masterUserID: req.adminId },
//             //   { fieldSource: "default" },
//             //   { fieldSource: "system" },
//             // ],
//           },
//           required: true,
//         },
//       ],
//     });

//     console.log("→ Found custom field values:", customFieldValues.length);

//     console.log("→ Found custom field values:", customFieldValues.length);

//     // Group custom field values by dealId
//     const customFieldsByDeal = {};
//     customFieldValues.forEach((value) => {
//       if (!customFieldsByDeal[value.entityId]) {
//         customFieldsByDeal[value.entityId] = {};
//       }
//       customFieldsByDeal[value.entityId][value.CustomField.fieldName] = {
//         label: value.CustomField.fieldLabel,
//         value: value.value,
//         type: value.CustomField.fieldType,
//         isImportant: value.CustomField.isImportant,
//       };
//     });

//     console.log(
//       "→ Grouped custom fields by deal:",
//       Object.keys(customFieldsByDeal).length,
//       "deals have custom fields"
//     );

//     // Debug each deal's custom fields
//     Object.keys(customFieldsByDeal).forEach((dealId) => {
//       console.log(
//         `  - Deal ${dealId} has custom fields:`,
//         Object.keys(customFieldsByDeal[dealId])
//       );
//     });

//     // Attach custom fields and status to each deal
//     // Build a map of all active custom fields (deal/both/lead, dealCheck: true)
//     const allActiveCustomFields = {};
//     allCustomFields.forEach((field) => {
//       allActiveCustomFields[field.fieldName] = {
//         label: field.fieldLabel,
//         value: "",
//         type: field.fieldType,
//         isImportant: field.isImportant,
//       };
//     });

//     const dealsWithCustomFields = deals.map((deal) => {
//       const dealObj = deal.toJSON();

//       // Flatten dealDetails into the main deal object if present
//       if (dealObj.details) {
//         Object.assign(dealObj, dealObj.details);
//         delete dealObj.details;
//       }

//       // Merge all active custom fields with values for this deal
//       const customFieldsForDeal = { ...allActiveCustomFields };
//       const valuesForDeal = customFieldsByDeal[dealObj.dealId] || {};
//       Object.keys(valuesForDeal).forEach((fieldName) => {
//         customFieldsForDeal[fieldName] = {
//           ...customFieldsForDeal[fieldName],
//           ...valuesForDeal[fieldName],
//         };
//       });
//       dealObj.customFields = customFieldsForDeal;

//       // Ensure status is present (from deal or details)
//       if (!("status" in dealObj)) {
//         dealObj.status = deal.status || null;
//       }

//       return dealObj;
//     });

//     // --- Deal summary calculation (like getDealSummary) ---
//     // Use the filtered deals for summary
//     const summaryDeals = dealsWithCustomFields;
//     // If dealsWithCustomFields is empty, summary will be zeroed
//     let totalValue = 0;
//     let totalWeightedValue = 0;
//     let totalDealCount = 0;
//     const currencyMap = {};

//     // Fetch pipeline stage probabilities
//     let stageProbabilities = {};
//     try {
//       const pipelineStages = await PipelineStage.findAll({
//         attributes: ["stageName", "probability"],
//         where: { isActive: true },
//       });
//       stageProbabilities = pipelineStages.reduce((acc, stage) => {
//         acc[stage.stageName] = stage.probability || 0;
//         return acc;
//       }, {});
//     } catch (e) {
//       // fallback: all probabilities 0
//     }

//     summaryDeals.forEach((deal) => {
//       const currency = deal.currency;
//       const value = deal.value || 0;
//       const pipelineStage = deal.pipelineStage;
//       if (!currencyMap[currency]) {
//         currencyMap[currency] = {
//           totalValue: 0,
//           weightedValue: 0,
//           dealCount: 0,
//         };
//       }
//       currencyMap[currency].totalValue += value;
//       currencyMap[currency].weightedValue +=
//         (value * (stageProbabilities[pipelineStage] || 0)) / 100;
//       currencyMap[currency].dealCount += 1;
//       totalValue += value;
//       totalWeightedValue +=
//         (value * (stageProbabilities[pipelineStage] || 0)) / 100;
//       totalDealCount += 1;
//     });

//     const summary = Object.entries(currencyMap).map(([currency, data]) => ({
//       currency,
//       totalValue: data.totalValue,
//       weightedValue: data.weightedValue,
//       dealCount: data.dealCount,
//     }));
//     summary.sort((a, b) => b.totalValue - a.totalValue);

//     res.status(200).json({
//       message: "Deals fetched successfully",
//       totalDeals: total,
//       totalPages: Math.ceil(total / limit),
//       currentPage: parseInt(page),
//       deals: dealsWithCustomFields,
//       role: req.role,
//       totalValue,
//       totalWeightedValue,
//       totalDealCount,
//       summary,
//     });
//   } catch (error) {
//     console.error("Error fetching deals:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// Helper functions for custom field filtering
async function buildCustomFieldFilters(customFieldsConditions, masterUserID, CustomField) {
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
          entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support unified fields including lead
          isActive: true,
          dealCheck: true, // Only include custom fields where dealCheck is true
          // [Op.or]: [
          //   { masterUserID: masterUserID },
          //   { fieldSource: "default" },
          //   { fieldSource: "system" },
          // ],
        },
      });

      // If not found by fieldName, try by fieldId
      if (!customField) {
        customField = await CustomField.findOne({
          where: {
            fieldId: cond.field,
            entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support unified fields including lead
            isActive: true,
            dealCheck: true, // Only include custom fields where dealCheck is true
            // [Op.or]: [
            //   { masterUserID: masterUserID },
            //   { fieldSource: "default" },
            //   { fieldSource: "system" },
            // ],
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
          entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support unified fields including lead
          isActive: true,
          dealCheck: true, // Only include custom fields where dealCheck is true
          // [Op.or]: [
          //   { masterUserID: masterUserID },
          //   { fieldSource: "default" },
          //   { fieldSource: "system" },
          // ],
        },
      });

      // If not found by fieldName, try by fieldId
      if (!customField) {
        customField = await CustomField.findOne({
          where: {
            fieldId: cond.field,
            entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support unified fields including lead
            isActive: true,
            dealCheck: true, // Only include custom fields where dealCheck is true
            // [Op.or]: [
            //   { masterUserID: masterUserID },
            //   { fieldSource: "default" },
            //   { fieldSource: "system" },
            // ],
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

async function getDealIdsByCustomFieldFilters(
  customFieldFilters,
  masterUserID,
  CustomFieldValue,
  CustomField,
  Deal
) {
  if (customFieldFilters.length === 0) return [];

  const allFilters = customFieldFilters.filter((f) => f.logicType === "all");
  const anyFilters = customFieldFilters.filter((f) => f.logicType === "any");

  let dealIds = [];

  // Handle 'all' filters (AND logic) - all conditions must be met
  if (allFilters.length > 0) {
    let allConditionDealIds = null;

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

      // Search for custom field values - handle different entity types
      const customFieldValues = await CustomFieldValue.findAll({
        where: {
          fieldId: filter.fieldId,
          // Look for values in both deal and lead entity types since some fields might be unified
          entityType: { [Op.in]: ["deal", "lead"] },
          ...whereCondition,
        },
        attributes: ["entityId", "entityType", "value"],
      });

      console.log("Found custom field values:", customFieldValues.length);
      customFieldValues.forEach((cfv) => {
        console.log(
          `  - EntityType: ${cfv.entityType}, EntityId: ${cfv.entityId}, Value: ${cfv.value}`
        );
      });

      let currentDealIds = [];

      // Process each custom field value
      for (const cfv of customFieldValues) {
        if (cfv.entityType === "deal") {
          // Direct deal association
          currentDealIds.push(cfv.entityId);
        } else if (cfv.entityType === "lead") {
          // Lead association - need to find corresponding deal
          // Since leads can be converted to deals, we need to find deals that have this leadId
          try {
            const dealsFromLead = await Deal.findAll({
              where: { leadId: cfv.entityId },
              attributes: ["dealId"],
            });

            dealsFromLead.forEach((deal) => {
              currentDealIds.push(deal.dealId);
            });

            console.log(
              `  - Found ${dealsFromLead.length} deals from lead ${cfv.entityId}`
            );
          } catch (error) {
            console.error("Error finding deals from lead:", error);
          }
        }
      }

      // Remove duplicates
      currentDealIds = [...new Set(currentDealIds)];
      console.log("Current deal IDs for filter:", currentDealIds);

      if (allConditionDealIds === null) {
        allConditionDealIds = currentDealIds;
      } else {
        // Intersection - only keep deals that match all conditions
        allConditionDealIds = allConditionDealIds.filter((id) =>
          currentDealIds.includes(id)
        );
      }
    }

    dealIds = allConditionDealIds || [];
  }

  // Handle 'any' filters (OR logic) - any condition can be met
  if (anyFilters.length > 0) {
    let anyConditionDealIds = [];

    for (const filter of anyFilters) {
      const whereCondition = buildCustomFieldCondition(
        filter.condition,
        filter.fieldId
      );

      const customFieldValues = await CustomFieldValue.findAll({
        where: {
          fieldId: filter.fieldId,
          entityType: { [Op.in]: ["deal", "lead"] }, // Look for values in both deal and lead entity types
          ...whereCondition,
        },
        attributes: ["entityId", "entityType", "value"],
      });

      let currentDealIds = [];

      for (const cfv of customFieldValues) {
        if (cfv.entityType === "deal") {
          currentDealIds.push(cfv.entityId);
        } else if (cfv.entityType === "lead") {
          // Lead association - need to find corresponding deal
          try {
            const dealsFromLead = await Deal.findAll({
              where: { leadId: cfv.entityId },
              attributes: ["dealId"],
            });

            dealsFromLead.forEach((deal) => {
              currentDealIds.push(deal.dealId);
            });
          } catch (error) {
            console.error("Error finding deals from lead:", error);
          }
        }
      }

      currentDealIds = [...new Set(currentDealIds)];
      anyConditionDealIds = [...anyConditionDealIds, ...currentDealIds];
    }

    // Remove duplicates
    anyConditionDealIds = [...new Set(anyConditionDealIds)];

    if (dealIds.length > 0) {
      // If we have both 'all' and 'any' conditions, combine them with AND logic
      dealIds = dealIds.filter((id) => anyConditionDealIds.includes(id));
    } else {
      dealIds = anyConditionDealIds;
    }
  }

  console.log("Final deal IDs from custom field filtering:", dealIds);
  return dealIds;
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

// Operator label to backend key mapping
const operatorMap = {
  is: "eq",
  "is not": "ne",
  "is empty": "is empty",
  "is not empty": "is not empty",
  "is exactly or earlier than": "lte",
  "is earlier than": "lt",
  "is exactly or later than": "gte",
  "is later than": "gt",
  // New mappings for frontend operators
  "is before": "lt",
  "is after": "gt",
  "is exactly on or before": "lte",
  "is exactly on or after": "gte",
};

// Helper to build a single condition
function buildCondition(cond, Deal, DealProduct, DealDetail, Product) {
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
  const dealDateFields = Object.entries(Deal.rawAttributes)
    .filter(([_, attr]) => attr.type && attr.type.key === "DATE")
    .map(([key]) => key);

  const dealDetailsDateFields = Object.entries(DealDetail.rawAttributes)
    .filter(([_, attr]) => attr.type && attr.type.key === "DATE")
    .map(([key]) => key);

  const dealProductDateFields = DealProduct 
    ? Object.entries(DealProduct.rawAttributes)
        .filter(([_, attr]) => attr.type && attr.type.key === "DATE")
        .map(([key]) => key)
    : [];

  const productDateFields = Product 
    ? Object.entries(Product.rawAttributes)
        .filter(([_, attr]) => attr.type && attr.type.key === "DATE")
        .map(([key]) => key)
    : [];

  const allDateFields = [
    ...dealDateFields, 
    ...dealDetailsDateFields, 
    ...dealProductDateFields, 
    ...productDateFields
  ];

  if (allDateFields.includes(cond.field)) {
    // Support new date operators
    const dateStr = cond.value;
    if (!dateStr) return {};
    // For exact date (full day)
    if (cond.useExactDate || operator === "eq") {
      const start = new Date(dateStr + "T00:00:00");
      const end = new Date(dateStr + "T23:59:59.999");
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return {};
      return {
        [cond.field]: {
          [Op.between]: [start, end],
        },
      };
    }
    // is before: strictly less than start of day
    if (operator === "lt") {
      const start = new Date(dateStr + "T00:00:00");
      if (isNaN(start.getTime())) return {};
      return {
        [cond.field]: {
          [Op.lt]: start,
        },
      };
    }
    // is after: strictly greater than end of day
    if (operator === "gt") {
      const end = new Date(dateStr + "T23:59:59.999");
      if (isNaN(end.getTime())) return {};
      return {
        [cond.field]: {
          [Op.gt]: end,
        },
      };
    }
    // is exactly on or before: less than or equal to end of day
    if (operator === "lte") {
      const end = new Date(dateStr + "T23:59:59.999");
      if (isNaN(end.getTime())) return {};
      return {
        [cond.field]: {
          [Op.lte]: end,
        },
      };
    }
    // is exactly on or after: greater than or equal to start of day
    if (operator === "gte") {
      const start = new Date(dateStr + "T00:00:00");
      if (isNaN(start.getTime())) return {};
      return {
        [cond.field]: {
          [Op.gte]: start,
        },
      };
    }
    // Otherwise, use relative date conversion
    const dateRange = convertRelativeDate(cond.value);
    const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());

    if (
      dateRange &&
      isValidDate(dateRange.start) &&
      isValidDate(dateRange.end)
    ) {
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
  }

  // Handle "contains" for text fields
  if (operator === "like") {
    return { [cond.field]: { [Op.like]: `%${cond.value}%` } };
  }

  // Default condition
  return {
    [cond.field]: {
      [ops[operator] || Op.eq]: cond.value,
    },
  };
}

exports.changeDealOwner = async (req, res) => {
   const { DealParticipant, DealStageHistory, DealDetail, History, AuditTrail, Deal, Lead, LeadOrganization, LeadPerson, MasterUser, Email, CustomField, CustomFieldValue, PermissionSet, DealNote, LeadNote, LeadFilter,  DealColumn, UserCredential, PipelineStage, Currency, DealFile, DealProduct, Product, ProductVariation, GroupVisibility, Activity, LeadFile} = req.models;
  try {
    const { dealId } = req.params;
    const { newOwnerId } = req.body;

    // Validate input
    if (!newOwnerId) {
      return res.status(400).json({
        message: "newOwnerId is required in the request body",
      });
    }

    // Check if new owner exists
    const newOwner = await MasterUser.findByPk(newOwnerId);
    if (!newOwner) {
      return res.status(404).json({
        message: "New owner not found",
      });
    }

    // Find the deal
    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({
        message: "Deal not found",
      });
    }

    // ===== OWNERSHIP VALIDATION =====
    // Check if user is the creator of the deal (masterUserID)
    const isCreator = deal.masterUserID === req.adminId;
    
    if (!isCreator) {
      // User is not the creator - check if they have permission "2" (edit_owner)
      console.log("🔒 User is NOT the creator of this deal. Checking 'edit_owner' permission...");
      
      // Fetch user's permission set
      const user = await MasterUser.findByPk(req.adminId, {
        attributes: ['masterUserID', 'permissionSetId', 'globalPermissionSetId']
      });
      
      if (!user) {
        await logAuditTrail(
          AuditTrail,
          getProgramId("DEALS"),
          "DEAL_OWNER_CHANGE",
          req.role,
          `Deal owner change failed: User not found.`,
          req.adminId
        );
        return res.status(401).json({ message: "User not found." });
      }
      
      // Prioritize globalPermissionSetId over permissionSetId
      const permissionSetId = user.globalPermissionSetId || user.permissionSetId;
      
      console.log(`🔍 User ${req.adminId} info:`, {
        permissionSetId: user.permissionSetId,
        globalPermissionSetId: user.globalPermissionSetId,
        usingPermissionSet: permissionSetId
      });
      
      if (!permissionSetId) {
        await logAuditTrail(
          AuditTrail,
          getProgramId("DEALS"),
          "DEAL_OWNER_CHANGE",
          req.role,
          `Deal owner change failed: No permission set assigned. User ${req.adminId} tried to change owner of deal ${dealId} created by ${deal.masterUserID}`,
          req.adminId
        );
        return res.status(403).json({ 
          message: "You don't have permission to change the owner of deals you didn't create." 
        });
      }
      
      // Fetch permission set
      const userPermissionSet = await PermissionSet.findByPk(permissionSetId);
      
      console.log(`🔍 Permission Set ${permissionSetId} details:`, {
        permissionSetId: userPermissionSet?.permissionSetId,
        permissionName: userPermissionSet?.permissionName,
        permissions: userPermissionSet?.permissions
      });
      
      if (!userPermissionSet || !userPermissionSet.permissions) {
        await logAuditTrail(
          AuditTrail,
          getProgramId("DEALS"),
          "DEAL_OWNER_CHANGE",
          req.role,
          `Deal owner change failed: Permission set not found. User ${req.adminId} tried to change owner of deal ${dealId}`,
          req.adminId
        );
        return res.status(403).json({ 
          message: "Permission set not found." 
        });
      }
      
      // Parse permissions
      const permissions = typeof userPermissionSet.permissions === 'string' 
        ? JSON.parse(userPermissionSet.permissions) 
        : userPermissionSet.permissions;
      
      // Check if permission "2" (Edit deal owner) is granted
      const hasEditOwnerPermission = permissions["2"] === true;
      
      console.log("📋 User permissions:", permissions);
      console.log(`🔑 Permission "2" (edit_owner): ${hasEditOwnerPermission}`);
      
      if (!hasEditOwnerPermission) {
        await logAuditTrail(
          AuditTrail,
          getProgramId("DEALS"),
          "DEAL_OWNER_CHANGE",
          req.role,
          `Deal owner change failed: User ${req.adminId} tried to change owner of deal ${dealId} created by user ${deal.masterUserID} without 'edit_owner' permission.`,
          req.adminId
        );
        return res.status(403).json({ 
          message: "You don't have permission to change the owner of deals you didn't create. Only the deal creator can change ownership." 
        });
      }
      
      console.log("✅ User has 'edit_owner' permission - allowing ownership change");
    } else {
      console.log("✅ User is the creator of this deal - allowing ownership change");
    }
    // ===== END OWNERSHIP VALIDATION =====

    // Store old owner ID for logging
    const oldOwnerId = deal.ownerId;

    // Update the deal owner
    await deal.update({ ownerId: newOwnerId });

    // Log the ownership change
    await historyLogger(
      History,
      getProgramId("DEALS"),
      "DEAL_OWNER_CHANGE",
      req.adminId,
      dealId,
      null,
      `Deal ownership changed from ${oldOwnerId} to ${newOwnerId} by ${req.role}`,
      {
        oldOwnerId,
        newOwnerId,
        changedBy: req.adminId
      }
    );

    res.status(200).json({
      message: "Deal owner updated successfully",
      data: {
        dealId: parseInt(dealId),
        oldOwnerId: oldOwnerId,
        newOwnerId: parseInt(newOwnerId),
        changedBy: req.adminId
      }
    });

  } catch (error) {
    console.error("Error changing deal owner:", error);
    
    // Log the error
    await logAuditTrail(
      AuditTrail,
      getProgramId("DEALS"),
      "DEAL_OWNER_CHANGE_ERROR",
      req.role,
      `Error changing deal owner: ${error.message}`,
      req.adminId
    );

    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};

exports.updateDeal = async (req, res) => {
  const { DealParticipant, DealStageHistory, DealDetail, History, AuditTrail, Deal, Lead, LeadOrganization, LeadPerson, MasterUser, Email, CustomField, CustomFieldValue, PermissionSet, DealNote, LeadNote, LeadFilter,  DealColumn, UserCredential, PipelineStage, Currency, DealFile, DealProduct, Product, ProductVariation, GroupVisibility, Activity, LeadFile} = req.models;
  try {
    const { dealId } = req.params;

    // Debug: Log the complete request body
    console.log("=== UPDATE DEAL REQUEST DEBUG ===");
    console.log("dealId:", dealId);
    console.log("req.body:", JSON.stringify(req.body, null, 2));
    console.log("req.body type:", typeof req.body);
    console.log("req.body keys:", Object.keys(req.body));
    console.log("req.adminId:", req.adminId);
    console.log("req.role:", req.role);
    console.log("req.user:", req.user);

    const updateFields = { ...req.body };

    // Separate DealDetails fields
    const dealDetailsFields = {};
    if ("statusSummary" in updateFields)
      dealDetailsFields.statusSummary = updateFields.statusSummary;
    if ("responsiblePerson" in updateFields)
      dealDetailsFields.responsiblePerson = updateFields.responsiblePerson;
    if ("rfpReceivedDate" in updateFields)
      dealDetailsFields.rfpReceivedDate = updateFields.rfpReceivedDate;

    // Remove DealDetails fields from main update
    delete updateFields.statusSummary;
    delete updateFields.responsiblePerson;
    delete updateFields.rfpReceivedDate;

    // Update Deal
    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      await logAuditTrail(
        AuditTrail,
        getProgramId("DEALS"),
        "DEAL_UPDATE",
        req.role,
        `Deal update failed: Deal with ID ${dealId} not found.`,
        req.adminId
      );
      return res.status(404).json({ message: "Deal not found." });
    }

    // ===== OWNERSHIP VALIDATION =====
    // Check if user owns the deal or has permission to edit others' deals
    const isOwner = (deal.masterUserID === req.adminId || deal.ownerId === req.adminId);
    
    if (!isOwner) {
      // User doesn't own the deal - check if they have permission "1" (edit_others)
      console.log("🔒 User is NOT owner of this deal. Checking 'edit_others' permission...");
      
      // Fetch user's permission set
      const user = await MasterUser.findByPk(req.adminId, {
        attributes: ['masterUserID', 'permissionSetId', 'globalPermissionSetId']
      });
      
      if (!user) {
        await logAuditTrail(
          AuditTrail,
          getProgramId("DEALS"),
          "DEAL_UPDATE",
          req.role,
          `Deal update failed: User not found.`,
          req.adminId
        );
        return res.status(401).json({ message: "User not found." });
      }
      
      // Prioritize globalPermissionSetId over permissionSetId
      const permissionSetId = user.globalPermissionSetId || user.permissionSetId;
      
      console.log(`🔍 User ${req.adminId} info:`, {
        permissionSetId: user.permissionSetId,
        globalPermissionSetId: user.globalPermissionSetId,
        usingPermissionSet: permissionSetId
      });
      
      if (!permissionSetId) {
        await logAuditTrail(
          AuditTrail,
          getProgramId("DEALS"),
          "DEAL_UPDATE",
          req.role,
          `Deal update failed: No permission set assigned. User ${req.adminId} tried to edit deal ${dealId} owned by ${deal.ownerId}`,
          req.adminId
        );
        return res.status(403).json({ 
          message: "You don't have permission to edit deals owned by other users." 
        });
      }
      
      // Fetch permission set
      const userPermissionSet = await PermissionSet.findByPk(permissionSetId);
      
      console.log(`🔍 Permission Set ${permissionSetId} details:`, {
        permissionSetId: userPermissionSet?.permissionSetId,
        permissionName: userPermissionSet?.permissionName,
        permissions: userPermissionSet?.permissions
      });
      
      if (!userPermissionSet || !userPermissionSet.permissions) {
        await logAuditTrail(
          AuditTrail,
          getProgramId("DEALS"),
          "DEAL_UPDATE",
          req.role,
          `Deal update failed: Permission set not found. User ${req.adminId} tried to edit deal ${dealId}`,
          req.adminId
        );
        return res.status(403).json({ 
          message: "Permission set not found." 
        });
      }
      
      // Parse permissions
      const permissions = typeof userPermissionSet.permissions === 'string' 
        ? JSON.parse(userPermissionSet.permissions) 
        : userPermissionSet.permissions;
      
      // Check if permission "1" (Edit deals owned by other users) is granted
      const hasEditOthersPermission = permissions["1"] === true;
      
      console.log("📋 User permissions:", permissions);
      console.log(`🔑 Permission "1" (edit_others): ${hasEditOthersPermission}`);
      
      if (!hasEditOthersPermission) {
        await logAuditTrail(
          AuditTrail,
          getProgramId("DEALS"),
          "DEAL_UPDATE",
          req.role,
          `Deal update failed: User ${req.adminId} tried to edit deal ${dealId} owned by user ${deal.ownerId} without 'edit_others' permission.`,
          req.adminId
        );
        return res.status(403).json({ 
          message: "You don't have permission to edit deals owned by other users. Only the deal owner can edit this deal." 
        });
      }
      
      console.log("✅ User has 'edit_others' permission - allowing edit of other user's deal");
    } else {
      console.log("✅ User is owner of this deal - allowing edit");
    }
    // ===== END OWNERSHIP VALIDATION =====

    // Phone number validation (only numerical values allowed) - if phone is being updated
    if (updateFields.phone && updateFields.phone.trim() !== "") {
      // Strict validation: only digits and optional plus sign at the beginning
      const phoneRegex = /^\+?\d{7,15}$/;
      
      if (!phoneRegex.test(updateFields.phone.trim())) {
        await logAuditTrail(
          AuditTrail,
          getProgramId("DEALS"),
          "DEAL_UPDATE",
          req.role,
          `Deal update failed: Phone number should contain only digits (7-15 digits) with optional + for country code. No spaces, dashes, or other characters allowed.`,
          req.adminId
        );
        return res.status(400).json({
          message: "Phone number should contain only digits (7-15 digits) with optional + for country code. No spaces, dashes, or other characters allowed.",
        });
      }
    }

    // Enhanced email validation (if email is being updated)
    if (updateFields.email && updateFields.email.trim() !== "") {
      // Check for basic format and length limit (254 characters)
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      
      if (!emailRegex.test(updateFields.email) || updateFields.email.length > 254) {
        await logAuditTrail(
          AuditTrail,
          getProgramId("DEALS"),
          "DEAL_UPDATE",
          req.role,
          `Deal update failed: Invalid email format.`,
          req.adminId
        );
        return res.status(400).json({
          message: "Invalid email format.",
        });
      }
    }
    // Check if pipelineStage is changing
    // Only check for pipelineStage if it's in the request body
    if (
      updateFields.pipelineStage &&
      updateFields.pipelineStage !== deal.pipelineStage
    ) {
      await DealStageHistory.create({
        dealId: deal.dealId,
        stageName: updateFields.pipelineStage,
        enteredAt: new Date(),
      });
    }
    await deal.update({ ...updateFields });
    console.log("Deal updated:", deal.toJSON());
    
    // 🔔 Send Notifications - Deal Assignment, Won, Lost
    try {
      // Get updater details for notification
      const updater = await MasterUser.findByPk(req.adminId, {
        attributes: ['masterUserID', 'name']
      });
      
      const updaterInfo = {
        userId: req.adminId,
        name: updater ? updater.name : 'Unknown User'
      };
      
      // Check if ownerId changed (deal assigned)
      if (updateFields.ownerId && updateFields.ownerId !== deal.ownerId) {
        await NotificationTriggers.dealAssigned(
          {
            dealId: deal.dealId,
            dealTitle: deal.title,
            dealValue: deal.value
          },
          updateFields.ownerId,
          updaterInfo
        );
      }
      
      // Check if status changed to 'won'
      if (updateFields.status && updateFields.status === 'won' && deal.status !== 'won') {
        await NotificationTriggers.dealWon(
          {
            dealId: deal.dealId,
            ownerId: deal.ownerId,
            dealTitle: deal.title,
            dealValue: deal.value
          },
          updaterInfo
        );
      }
      
      // Check if status changed to 'lost'
      if (updateFields.status && updateFields.status === 'lost' && deal.status !== 'lost') {
        await NotificationTriggers.dealLost(
          {
            dealId: deal.dealId,
            ownerId: deal.ownerId,
            dealTitle: deal.title
          },
          updaterInfo,
          updateFields.lostReason || null
        );
      }
    } catch (notifError) {
      console.error('Failed to send deal notification:', notifError);
    }
    
    // Synchronize Deal updates to Person and Organization tables
    if (Object.keys(updateFields).length > 0) {
      // Synchronize to Person if Person exists and relevant fields were updated
      if (deal.personId) {
        const person = await LeadPerson.findByPk(deal.personId);
        if (person) {
          const personSyncData = {};
          const syncedPersonFields = [];
          
          // Map Deal fields to Person fields
          if (updateFields.contactPerson !== undefined && updateFields.contactPerson !== person.contactPerson) {
            personSyncData.contactPerson = updateFields.contactPerson;
            syncedPersonFields.push('contactPerson');
          }
          if (updateFields.email !== undefined && updateFields.email !== person.email) {
            personSyncData.email = updateFields.email;
            syncedPersonFields.push('email');
          }
          if (updateFields.phone !== undefined && updateFields.phone !== person.phone) {
            personSyncData.phone = updateFields.phone;
            syncedPersonFields.push('phone');
          }
          
          // Update Person if there are fields to sync
          if (Object.keys(personSyncData).length > 0) {
            await person.update(personSyncData);
            console.log(`Synced Deal to Person fields: ${syncedPersonFields.join(', ')}`, personSyncData);
          }
        }
      }
      
      // Synchronize to Organization if Organization exists and relevant fields were updated
      if (deal.leadOrganizationId) {
        const org = await LeadOrganization.findByPk(deal.leadOrganizationId);
        if (org) {
          const orgSyncData = {};
          const syncedOrgFields = [];
          
          // Map Deal fields to Organization fields
          if (updateFields.organization !== undefined && updateFields.organization !== org.organization) {
            orgSyncData.organization = updateFields.organization;
            syncedOrgFields.push('organization');
          }
          if (updateFields.email !== undefined && updateFields.email !== org.email) {
            orgSyncData.email = updateFields.email;
            syncedOrgFields.push('email');
          }
          if (updateFields.phone !== undefined && updateFields.phone !== org.phone) {
            orgSyncData.phone = updateFields.phone;
            syncedOrgFields.push('phone');
          }
          if (updateFields.address !== undefined && updateFields.address !== org.address) {
            orgSyncData.address = updateFields.address;
            syncedOrgFields.push('address');
          }
          
          // Update Organization if there are fields to sync
          if (Object.keys(orgSyncData).length > 0) {
            await org.update(orgSyncData);
            console.log(`Synced Deal to Organization fields: ${syncedOrgFields.join(', ')}`, orgSyncData);
          }
        }
      }
    }

    // Update or create DealDetails
    if (Object.keys(dealDetailsFields).length > 0) {
      let dealDetails = await DealDetail.findOne({ where: { dealId } });
      if (dealDetails) {
        await dealDetails.update(dealDetailsFields);
        console.log("DealDetails updated:", dealDetails.toJSON());
        
        // Synchronize relevant DealDetails fields to Deal table
        const dealSyncData = {};
        const syncedFields = [];
        
        // Map DealDetails fields to Deal fields (if any overlapping fields exist)
        // Note: Add specific field mappings based on your schema requirements
        // Example: if dealDetailsFields has fields that should sync to Deal table
        
        // Update Deal table if there are fields to sync
        if (Object.keys(dealSyncData).length > 0) {
          await deal.update(dealSyncData);
          console.log(`Synced DealDetails to Deal fields: ${syncedFields.join(', ')}`, dealSyncData);
        }
      } else {
        dealDetails = await DealDetail.create({ dealId, ...dealDetailsFields });
        console.log("DealDetails created:", dealDetails.toJSON());
        
        // Synchronize relevant DealDetails fields to Deal table for newly created DealDetails
        const dealSyncData = {};
        const syncedFields = [];
        
        // Map DealDetails fields to Deal fields (if any overlapping fields exist)
        // Note: Add specific field mappings based on your schema requirements
        
        // Update Deal table if there are fields to sync
        if (Object.keys(dealSyncData).length > 0) {
          await deal.update(dealSyncData);
          console.log(`Synced new DealDetails to Deal fields: ${syncedFields.join(', ')}`, dealSyncData);
        }
      }
    }

    // Update all fields of Person
    if (deal.personId) {
      const person = await LeadPerson.findByPk(deal.personId);
      if (person) {
        // Only update fields that exist in the Person model
        const personAttributes = Object.keys(LeadPerson.rawAttributes);
        const personUpdate = {};
        for (const key of personAttributes) {
          if (key in req.body) {
            personUpdate[key] = req.body[key];
          }
        }
        if (Object.keys(personUpdate).length > 0) {
          await person.update(personUpdate);
          console.log("Person updated:", person.toJSON());
          
          // Synchronize Person updates to Deal table
          const dealSyncData = {};
          const syncedFields = [];
          
          // Map Person fields to Deal fields
          if (personUpdate.contactPerson !== undefined && personUpdate.contactPerson !== deal.contactPerson) {
            dealSyncData.contactPerson = personUpdate.contactPerson;
            syncedFields.push('contactPerson');
          }
          if (personUpdate.email !== undefined && personUpdate.email !== deal.email) {
            dealSyncData.email = personUpdate.email;
            syncedFields.push('email');
          }
          if (personUpdate.phone !== undefined && personUpdate.phone !== deal.phone) {
            dealSyncData.phone = personUpdate.phone;
            syncedFields.push('phone');
          }
          
          // Update Deal table if there are fields to sync
          if (Object.keys(dealSyncData).length > 0) {
            await deal.update(dealSyncData);
            console.log(`Synced Person to Deal fields: ${syncedFields.join(', ')}`, dealSyncData);
          }
        }
      }
    }

    // Update all fields of Organization
    if (deal.leadOrganizationId) {
      const org = await LeadOrganization.findByPk(deal.leadOrganizationId);
      if (org) {
        // Only update fields that exist in the Organization model
        const orgAttributes = Object.keys(LeadOrganization.rawAttributes);
        const orgUpdate = {};
        for (const key of orgAttributes) {
          if (key in req.body) {
            orgUpdate[key] = req.body[key];
          }
        }
        if (Object.keys(orgUpdate).length > 0) {
          await org.update(orgUpdate);
          console.log("Organization updated:", org.toJSON());
          
          // Synchronize Organization updates to Deal table
          const dealSyncData = {};
          const syncedFields = [];
          
          // Map Organization fields to Deal fields
          if (orgUpdate.organization !== undefined && orgUpdate.organization !== deal.organization) {
            dealSyncData.organization = orgUpdate.organization;
            syncedFields.push('organization');
          }
          if (orgUpdate.email !== undefined && orgUpdate.email !== deal.email) {
            dealSyncData.email = orgUpdate.email;
            syncedFields.push('email');
          }
          if (orgUpdate.phone !== undefined && orgUpdate.phone !== deal.phone) {
            dealSyncData.phone = orgUpdate.phone;
            syncedFields.push('phone');
          }
          if (orgUpdate.address !== undefined && orgUpdate.address !== deal.address) {
            dealSyncData.address = orgUpdate.address;
            syncedFields.push('address');
          }
          
          // Update Deal table if there are fields to sync
          if (Object.keys(dealSyncData).length > 0) {
            await deal.update(dealSyncData);
            console.log(`Synced Organization to Deal fields: ${syncedFields.join(', ')}`, dealSyncData);
          }
        }
      }
    }

    // Handle custom fields update - Check for custom fields directly in req.body
    let updatedCustomFields = {};

    console.log("=== CUSTOM FIELDS UPDATE DEBUG ===");
    console.log("req.adminId:", req.adminId);
    console.log("dealId:", dealId);

    // First, let's check ALL custom fields in database
    const allCustomFields = await CustomField.findAll({
      attributes: ['fieldId', 'fieldName', 'entityType', 'isActive', 'dealCheck', 'fieldSource', 'masterUserID']
    });
    
    console.log("🔍 ALL CUSTOM FIELDS IN DATABASE:", allCustomFields.length);
    allCustomFields.forEach(field => {
      console.log(`  - ${field.fieldName} | entityType: ${field.entityType} | isActive: ${field.isActive} | dealCheck: ${field.dealCheck} | source: ${field.fieldSource}`);
    });

    // Check specifically for your field
    const targetField = allCustomFields.find(f => f.fieldName === 'espl_proposal_no');
    if (targetField) {
      console.log("🎯 FOUND TARGET FIELD 'espl_proposal_no':", {
        fieldId: targetField.fieldId,
        fieldName: targetField.fieldName,
        entityType: targetField.entityType,
        isActive: targetField.isActive,
        dealCheck: targetField.dealCheck,
        fieldSource: targetField.fieldSource,
        masterUserID: targetField.masterUserID
      });
    } else {
      console.log("❌ TARGET FIELD 'espl_proposal_no' NOT FOUND in database");
    }

    // Get all available custom fields (minimal restrictions)
    const availableCustomFields = await CustomField.findAll({
      where: {
        isActive: true,
        // No entityType restriction - all entity types allowed
        // No dealCheck restriction - all active custom fields can be updated
        // No masterUserID restriction - all users can update any custom field
      },
    });

    console.log(
      "Available custom fields with dealCheck=true:",
      availableCustomFields.map((f) => ({
        fieldId: f.fieldId,
        fieldName: f.fieldName,
        entityType: f.entityType,
        dealCheck: f.dealCheck,
        masterUserID: f.masterUserID,
        fieldSource: f.fieldSource
      }))
    );

    console.log("Request body keys:", Object.keys(req.body));
    console.log("Matching fields in request body:");
    
    // Check which request body keys match available custom fields
    Object.keys(req.body).forEach(bodyKey => {
      const matchingField = availableCustomFields.find(f => f.fieldName === bodyKey);
      if (matchingField) {
        console.log(`✅ MATCH FOUND: ${bodyKey} = ${req.body[bodyKey]} (fieldId: ${matchingField.fieldId})`);
      } else {
        console.log(`❌ NO MATCH: ${bodyKey} not found in custom fields`);
      }
    });

    if (availableCustomFields.length > 0) {
      try {
        // Check each available custom field to see if it's in the request body
        for (const customField of availableCustomFields) {
          const fieldName = customField.fieldName;

          // Check if this field is in the request body
          if (fieldName in req.body) {
            const value = req.body[fieldName];

            console.log(`\n--- Processing field: ${fieldName} = ${value} ---`);
            console.log("CustomField found:", {
              fieldId: customField.fieldId,
              fieldName: customField.fieldName,
              fieldType: customField.fieldType,
              entityType: customField.entityType,
              isActive: customField.isActive,
              masterUserID: customField.masterUserID,
              fieldSource: customField.fieldSource,
            });

            if (value !== null && value !== undefined) {
              // Validate value based on field type
              let processedValue = value;

              if (
                customField.fieldType === "number" &&
                value !== null &&
                value !== ""
              ) {
                processedValue = parseFloat(value);
                if (isNaN(processedValue)) {
                  console.warn(
                    `Invalid number value for field "${customField.fieldLabel}"`
                  );
                  continue;
                }
              }

              if (customField.fieldType === "email" && value) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                  console.warn(
                    `Invalid email format for field "${customField.fieldLabel}"`
                  );
                  continue;
                }
              }

              // Handle empty values (allow clearing fields)
              if (value === "" || value === null) {
                processedValue = null;
              }

              console.log("Processing custom field value:", {
                fieldId: customField.fieldId,
                fieldName: customField.fieldName,
                dealId: dealId,
                entityId: dealId, // dealId should match entityId
                processedValue: processedValue,
                originalValue: value,
              });

              // Find or create the field value - ensure dealId matches entityId
              let fieldValue = await CustomFieldValue.findOne({
                where: {
                  fieldId: customField.fieldId,
                  entityId: parseInt(dealId), // Ensure dealId is integer to match entityId
                  entityType: "deal",
                },
              });

              console.log(`🔍 Looking for existing CustomFieldValue: fieldId=${customField.fieldId}, entityId=${dealId}, entityType=deal`);
              console.log(`🔍 Found existing value:`, fieldValue ? {
                id: fieldValue.id,
                fieldId: fieldValue.fieldId,
                entityId: fieldValue.entityId,
                entityType: fieldValue.entityType,
                currentValue: fieldValue.value
              } : 'None');

              if (fieldValue) {
                // Update existing value
                if (processedValue === null || processedValue === "") {
                  // Delete the field value if it's being cleared
                  await fieldValue.destroy();
                  console.log(
                    `✅ Deleted custom field value for: ${customField.fieldName}`
                  );
                } else {
                  await fieldValue.update({
                    value:
                      typeof processedValue === "object"
                        ? JSON.stringify(processedValue)
                        : String(processedValue),
                  });
                  console.log(
                    `✅ Updated custom field value for: ${customField.fieldName}`
                  );
                }
              } else if (processedValue !== null && processedValue !== "") {
                // Create new value only if it's not empty
                const newFieldValue = await CustomFieldValue.create({
                  fieldId: customField.fieldId,
                  entityId: parseInt(dealId), // Ensure dealId is integer
                  entityType: "deal",
                  value:
                    typeof processedValue === "object"
                      ? JSON.stringify(processedValue)
                      : String(processedValue),
                  masterUserID: req.adminId,
                });
                console.log(
                  `✅ Created new custom field value for: ${customField.fieldName}`,
                  {
                    id: newFieldValue.id,
                    fieldId: newFieldValue.fieldId,
                    entityId: newFieldValue.entityId,
                    value: newFieldValue.value
                  }
                );
              }

              // Store the updated custom field for response
              updatedCustomFields[customField.fieldName] = {
                fieldName: customField.fieldName,
                fieldType: customField.fieldType,
                value: processedValue,
              };

              // Remove the custom field from updateFields to prevent it from being updated in the main Deal table
              delete updateFields[fieldName];
            } else {
              console.warn(`❌ Invalid value for field ${fieldName}:`, value);
            }
          }
        }

        console.log(
          `🎉 Updated ${
            Object.keys(updatedCustomFields).length
          } custom field values for deal ${dealId}`
        );
      } catch (customFieldError) {
        console.error("❌ Error updating custom fields:", customFieldError);
        // Don't fail the deal update, just log the error
      }
    } else {
      console.log("❌ No custom fields available for this user");
    }

    // After all updates and before sending the response:
    const updatedDeal = await Deal.findByPk(dealId, {
      include: [
        { model: DealDetail, as: "details" },
        { model: LeadPerson, as: "Person" },
        { model: LeadOrganization, as: "Organization" },
      ],
    });

    // Calculate pipeline stage days
    const stageHistory = await DealStageHistory.findAll({
      where: { dealId },
      order: [["enteredAt", "ASC"]],
    });

    const now = new Date();
    const pipelineStages = [];
    for (let i = 0; i < stageHistory.length; i++) {
      const stage = stageHistory[i];
      const nextStage = stageHistory[i + 1];
      const start = new Date(stage.enteredAt);
      const end = nextStage ? new Date(nextStage.enteredAt) : now;
      const days = Math.max(
        0,
        Math.floor((end - start) / (1000 * 60 * 60 * 24))
      );
      pipelineStages.push({
        stageName: stage.stageName,
        days,
      });
    }
    const pipelineOrder = [
      "Qualified",
      "Contact Made",
      "Proposal Made",
      "Negotiations Started",
    ];

    const stageDaysMap = new Map();
    for (const stage of pipelineStages) {
      if (!stageDaysMap.has(stage.stageName)) {
        stageDaysMap.set(stage.stageName, stage.days);
      } else {
        stageDaysMap.set(
          stage.stageName,
          stageDaysMap.get(stage.stageName) + stage.days
        );
      }
    }

    let currentStageName = pipelineStages.length
      ? pipelineStages[pipelineStages.length - 1].stageName
      : null;

    let pipelineStagesUnique = [];
    if (currentStageName && pipelineOrder.includes(currentStageName)) {
      const currentIdx = pipelineOrder.indexOf(currentStageName);
      pipelineStagesUnique = pipelineOrder
        .slice(0, currentIdx + 1)
        .map((stageName) => ({
          stageName,
          days: stageDaysMap.get(stageName) || 0,
        }));
    }

    //res.status(200).json({ message: "Deal, person, and organization updated successfully",deal });
    await historyLogger(
      History,
      getProgramId("DEALS"),
      "DEAL_UPDATE",
      req.adminId,
      deal.dealId,
      null,
      `Deal updated by ${req.role}`,
      null
    );

    // Prepare response with updated custom fields
    const dealResponse = {
      ...updatedDeal.toJSON(),
      customFields: updatedCustomFields,
    };

    res.status(200).json({
      message: "Deal, person, and organization updated successfully",
      deal: dealResponse,
      person: updatedDeal.Person ? [updatedDeal.Person] : [],
      organization: updatedDeal.Organization ? [updatedDeal.Organization] : [],
      pipelineStages: pipelineStagesUnique,
      currentStage: currentStageName,
      customFieldsUpdated: Object.keys(updatedCustomFields).length,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Internal server error" });
  }
};

// exports.getDealSummary = async (req, res) => {
//   try {
//     // 1. Per-currency summary
//     const currencySummary = await Deal.findAll({
//       attributes: [
//         "currency",
//         [fn("SUM", col("value")), "totalValue"],
//         // Replace with your actual weighted value logic if needed
//         [fn("SUM", col("value")), "weightedValue"],
//         [fn("COUNT", col("dealId")), "dealCount"]
//       ],
//       group: ["currency"]
//     });

//     // 2. Overall summary
//     const overall = await Deal.findAll({
//       attributes: [
//         [fn("SUM", col("value")), "totalValue"],
//         [fn("SUM", col("value")), "weightedValue"],
//         [fn("COUNT", col("dealId")), "dealCount"]
//       ]
//     });

//     res.status(200).json({
//       overall: overall[0],         // { totalValue, weightedValue, dealCount }
//       currencySummary              // array of per-currency summaries
//     });
//   } catch (error) {
//     console.log(error);

//     res.status(500).json({ message: "Internal server error" });
//   }
// };
exports.getDealSummary = async (req, res) => {
  const { DealParticipant, DealStageHistory, DealDetail, History, AuditTrail, Deal, Lead, LeadOrganization, LeadPerson, MasterUser, Email, CustomField, CustomFieldValue, PermissionSet, DealNote, LeadNote, LeadFilter,  DealColumn, UserCredential, PipelineStage, Currency, DealFile, DealProduct, Product, ProductVariation, GroupVisibility, Activity, LeadFile} = req.models;
  try {
    // Fetch all deals with value, currency, and pipelineStage, excluding converted deals
    const deals = await Deal.findAll({
      attributes: ["value", "currency", "pipelineStage"],
      where: {
        // Exclude deals that have been converted to leads
        isConvertedToLead: {
          [Op.or]: [
            { [Op.is]: null },
            { [Op.eq]: false }
          ]
        }
      },
      raw: true,
    });

    // Probabilities for each stage
    // Fetch dynamic probabilities from pipeline stages
    const pipelineStages = await PipelineStage.findAll({
      attributes: ["stageName", "probability"],
      where: { isActive: true },
    });

    const stageProbabilities = pipelineStages.reduce((acc, stage) => {
      acc[stage.stageName] = stage.probability || 0;
      return acc;
    }, {});

    // Group deals by currency
    const currencyMap = {};

    let totalValue = 0;
    let totalWeightedValue = 0;
    let totalDealCount = 0;

    deals.forEach((deal) => {
      const { currency, value, pipelineStage } = deal;
      if (!currencyMap[currency]) {
        currencyMap[currency] = {
          totalValue: 0,
          weightedValue: 0,
          dealCount: 0,
        };
      }
      currencyMap[currency].totalValue += value || 0;
      currencyMap[currency].weightedValue +=
        ((value || 0) * (stageProbabilities[pipelineStage] || 0)) / 100;
      currencyMap[currency].dealCount += 1;

      totalValue += value || 0;
      totalWeightedValue +=
        ((value || 0) * (stageProbabilities[pipelineStage] || 0)) / 100;
      totalDealCount += 1;
    });

    // Format result as array
    const summary = Object.entries(currencyMap).map(([currency, data]) => ({
      currency,
      totalValue: data.totalValue,
      weightedValue: data.weightedValue,
      dealCount: data.dealCount,
    }));

    // Optionally, sort by totalValue descending
    summary.sort((a, b) => b.totalValue - a.totalValue);

    res.status(200).json({
      totalValue,
      totalWeightedValue,
      totalDealCount,
      summary,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.archiveDeal = async (req, res) => {
  const { DealParticipant, DealStageHistory, DealDetail, History, AuditTrail, Deal, Lead, LeadOrganization, LeadPerson, MasterUser, Email, CustomField, CustomFieldValue, PermissionSet, DealNote, LeadNote, LeadFilter,  DealColumn, UserCredential, PipelineStage, Currency, DealFile, DealProduct, Product, ProductVariation, GroupVisibility, Activity, LeadFile} = req.models;
  try {
    const { dealId } = req.params;
    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }
    await deal.update({ isArchived: true });
    res.status(200).json({ message: "Deal archived successfully.", deal });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Internal server error" });
  }
};
exports.unarchiveDeal = async (req, res) => {
  const { DealParticipant, DealStageHistory, DealDetail, History, AuditTrail, Deal, Lead, LeadOrganization, LeadPerson, MasterUser, Email, CustomField, CustomFieldValue, PermissionSet, DealNote, LeadNote, LeadFilter,  DealColumn, UserCredential, PipelineStage, Currency, DealFile, DealProduct, Product, ProductVariation, GroupVisibility, Activity, LeadFile} = req.models;
  try {
    const { dealId } = req.params;
    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }
    await deal.update({ isArchived: false });
    res.status(200).json({ message: "Deal unarchived successfully.", deal });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getDealsByStage = async (req, res) => {
  const { DealParticipant, DealStageHistory, DealDetail, History, AuditTrail, Deal, Lead, LeadOrganization, LeadPerson, MasterUser, Email, CustomField, CustomFieldValue, PermissionSet, DealNote, LeadNote, LeadFilter,  DealColumn, UserCredential, PipelineStage, Currency, DealFile, DealProduct, Product, ProductVariation, GroupVisibility, Activity, LeadFile, Pipeline} = req.models;
  try {
    const { pipeline, pipelineId, includeActivities = false } = req.query;
    
    // 🔥 DYNAMIC STAGE FETCHING - Get stages from pipeline system
    let allStages = [];
    let stageMetadata = new Map(); // Store stage colors, order, etc.
    let pipelineInfo = null;

    console.log(`🚀 [getDealsByStage] Fetching dynamic stages for user: ${req.adminId}`);
    console.log(`📊 [getDealsByStage] Pipeline filters - pipeline: ${pipeline}, pipelineId: ${pipelineId}`);

    try {
      // Import pipeline models

      let pipelineWhere = {
        isActive: true
      };

      // Determine which pipeline to use
      if (pipelineId) {
        // Use specific pipeline ID
        pipelineWhere.pipelineId = parseInt(pipelineId);
        console.log(`🎯 [getDealsByStage] Using specific pipeline ID: ${pipelineId}`);
      } else if (pipeline) {
        // Use pipeline by name
        pipelineWhere.pipelineName = pipeline;
        console.log(`🎯 [getDealsByStage] Using pipeline by name: ${pipeline}`);
      } else {
        // Use user's default pipeline
        pipelineWhere.masterUserID = req.adminId;
        pipelineWhere.isDefault = true;
        console.log(`🎯 [getDealsByStage] Using user's default pipeline for user: ${req.adminId}`);
      }

      // Fetch the pipeline with its stages
      const selectedPipeline = await Pipeline.findOne({
        where: pipelineWhere,
        include: [
          {
            model: PipelineStage,
            as: "stages",
            where: { isActive: true },
            required: false,
            order: [["stageOrder", "ASC"]],
          },
        ],
      });

      if (selectedPipeline && selectedPipeline.stages && selectedPipeline.stages.length > 0) {
        // Use dynamic stages from pipeline
        allStages = selectedPipeline.stages.map((stage) => stage.stageName);
        pipelineInfo = {
          pipelineId: selectedPipeline.pipelineId,
          pipelineName: selectedPipeline.pipelineName,
          isDefault: selectedPipeline.isDefault
        };

        // Store stage metadata
        selectedPipeline.stages.forEach((stage) => {
          stageMetadata.set(stage.stageName, {
            stageId: stage.stageId,
            stageOrder: stage.stageOrder,
            color: stage.color,
            dealRottenDays: stage.dealRottenDays,
            probability: stage.probability,
            isActive: stage.isActive
          });
        });

        console.log(`✅ [getDealsByStage] Found pipeline "${selectedPipeline.pipelineName}" with ${allStages.length} stages:`, allStages);
      } else {
        // Fallback to system-wide stages if no pipeline found
        console.log(`⚠️ [getDealsByStage] No pipeline found, fetching all unique stages from deals`);
        
        const uniqueStages = await Deal.findAll({
          attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('pipelineStage')), 'pipelineStage']],
          where: {
            pipelineStage: { [Op.ne]: null },
            isConvertedToLead: {
              [Op.or]: [
                { [Op.is]: null },
                { [Op.eq]: false }
              ]
            }
          },
          raw: true
        });

        allStages = uniqueStages.map(stage => stage.pipelineStage).filter(Boolean);
        console.log(`📝 [getDealsByStage] Using unique stages from deals:`, allStages);
      }
    } catch (pipelineError) {
      console.error("❌ [getDealsByStage] Pipeline system error:", pipelineError.message);
      // Fallback to hardcoded stages
      allStages = [
        "Qualified",
        "Contact Made", 
        "Proposal Made",
        "Negotiations Started"
      ];
      console.log(`🔧 [getDealsByStage] Fallback to hardcoded stages:`, allStages);
    }

    // If still no stages found, use hardcoded fallback
    if (allStages.length === 0) {
      allStages = [
        "Qualified",
        "Contact Made",
        "Proposal Made", 
        "Negotiations Started"
      ];
      console.log(`🔧 [getDealsByStage] No stages found, using hardcoded fallback:`, allStages);
    }

    const result = [];
    let totalDeals = 0;

    // Build pipeline filter conditions for deals query
    const pipelineFilter = {};
    if (pipeline) {
      pipelineFilter.pipeline = pipeline;
    }
    if (pipelineId) {
      pipelineFilter.pipelineId = parseInt(pipelineId);
    }

    // Apply user filtering for non-admin users
    let baseWhere = {
      // Exclude deals that have been converted to leads
      isConvertedToLead: {
        [Op.or]: [
          { [Op.is]: null },
          { [Op.eq]: false }
        ]
      },
      ...pipelineFilter
    };

    if (req.role !== "admin") {
      baseWhere[Op.or] = [
        { masterUserID: req.adminId },
        { ownerId: req.adminId }
      ];
      console.log(`👤 [getDealsByStage] Non-admin user, filtering by masterUserID/ownerId: ${req.adminId}`);
    }

    // Build include array for associations
    const includeArray = [
      {
        model: LeadPerson,
        as: "Person",
        attributes: ["personId","email", "phone"],
        required: false,
      },
      {
        model: LeadOrganization,
        as: "Organization", 
        attributes: ["leadOrganizationId"],
        required: false,
      },
      {
        model: MasterUser,
        as: "Owner",
        attributes: ["masterUserID", "name", "email"],
        required: false,
      },
      {
        model: Activity,
        as: "Activities",
        attributes: [
          "activityId", 
          "type", 
          "subject", 
          "startDateTime", 
          "endDateTime", 
          "priority", 
          "status", 
          "isDone", 
          "dueDate",
          "notes",
          "contactPerson",
          "email"
        ],
        include: [
          {
            model: MasterUser,
            as: "assignedUser",
            attributes: ["masterUserID", "name", "email"],
            required: false,
          }
        ],
        required: false,
        order: [["startDateTime", "DESC"]]
      }
    ];

    // Process each stage
    for (const stage of allStages) {
      console.log(`🔍 [getDealsByStage] Processing stage: "${stage}"`);
      
      const whereCondition = {
        ...baseWhere,
        pipelineStage: stage
      };

      const deals = await Deal.findAll({
        where: whereCondition,
        include: includeArray,
        order: [["createdAt", "DESC"]],
      });

      const totalValue = deals.reduce(
        (sum, deal) => sum + (deal.value || 0),
        0
      );
      const dealCount = deals.length;
      totalDeals += dealCount;

      console.log(`📈 [getDealsByStage] Stage "${stage}": ${dealCount} deals, $${totalValue} total value`);

      // Get stage metadata
      const metadata = stageMetadata.get(stage) || {};

      // Format deals with activity summary and stage metadata
      const formattedDeals = deals.map(deal => {
        const dealData = deal.toJSON();
        
        // Add stage metadata to each deal
        dealData.stageMetadata = {
          stageOrder: metadata.stageOrder || null,
          stageColor: metadata.color || '#007BFF',
          dealRottenDays: metadata.dealRottenDays || null,
          probability: metadata.probability || 0
        };

        // Calculate days in current stage (if rotten days are configured)
        if (metadata.dealRottenDays) {
          const daysSinceCreated = Math.floor(
            (new Date() - new Date(deal.createdAt)) / (1000 * 60 * 60 * 24)
          );
          const isRotten = daysSinceCreated > metadata.dealRottenDays;
          
          dealData.stageDays = {
            daysSinceCreated,
            isRotten,
            dealRottenDays: metadata.dealRottenDays,
            daysOverdue: isRotten ? daysSinceCreated - metadata.dealRottenDays : 0,
            rottenStatus: isRotten ? "rotten" : "fresh"
          };
        }

        // Always add Activities array (empty if no activities)
        const activities = dealData.Activities || [];
        dealData.Activities = activities;
        
        // Add activity summary only if activities are requested
        if (includeActivities === 'true' || includeActivities === true) {
          dealData.activitySummary = {
            totalActivities: activities.length,
            completedActivities: activities.filter(a => a.isDone).length,
            pendingActivities: activities.filter(a => !a.isDone).length,
            nextActivity: activities.find(a => !a.isDone && new Date(a.startDateTime) > new Date()),
            lastActivity: activities.find(a => a.isDone),
            upcomingActivities: activities.filter(a => 
              !a.isDone && 
              new Date(a.startDateTime) > new Date() && 
              new Date(a.startDateTime) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
            ).length
          };
        }

        return dealData;
      });

      // Calculate stage statistics
      const rottenDealsCount = formattedDeals.filter(deal => deal.stageDays?.isRotten).length;

      result.push({
        stage,
        stageMetadata: {
          stageId: metadata.stageId || null,
          stageOrder: metadata.stageOrder || null,
          color: metadata.color || '#007BFF',
          dealRottenDays: metadata.dealRottenDays || null,
          probability: metadata.probability || 0,
          hasRottenDaysConfigured: !!metadata.dealRottenDays
        },
        totalValue,
        dealCount,
        rottenDealsCount,
        freshDealsCount: dealCount - rottenDealsCount,
        rottenPercentage: dealCount > 0 ? Math.round((rottenDealsCount / dealCount) * 100) : 0,
        deals: formattedDeals,
      });
    }

    console.log(`✅ [getDealsByStage] Processed ${allStages.length} stages, ${totalDeals} total deals`);

    // Add comprehensive response metadata
    const responseData = {
      totalDeals,
      stages: result,
      pipelineInfo: pipelineInfo || {
        pipelineId: null,
        pipelineName: pipeline || 'Unknown',
        isDefault: false,
        source: 'fallback'
      },
      filters: {
        pipeline: pipeline || null,
        pipelineId: pipelineId || null,
        includeActivities: includeActivities === 'true' || includeActivities === true,
        userRole: req.role,
        userFiltered: req.role !== "admin"
      },
      stagesInfo: {
        totalStages: allStages.length,
        dynamicStages: stageMetadata.size > 0,
        stageSource: stageMetadata.size > 0 ? 'pipeline_system' : 'fallback'
      }
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error("❌ [getDealsByStage] Error:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//this latest version of getDealsByStage function is used to get deals by stage with rotten days logic

// exports.getDealsByStage = async (req, res) => {
//   try {
//     // Get dynamic stages from pipeline system, fallback to hardcoded if needed
//     const Pipeline = require("../../models/deals/pipelineModel");
//     const PipelineStage = require("../../models/deals/pipelineStageModel");

//     let allStages = [
//       "Qualified",
//       "Contact Made",
//       "Proposal Made",
//       "Negotiations Started",
//     ];

//     // Apply user filtering for non-admin users
//     let baseWhere = {};
//     if (req.role !== "admin") {
//       baseWhere.masterUserID = req.adminId;
//     }

//     // Try to get stages from pipeline system with rotten days info
//     let stageRottenDaysMap = new Map();
//     try {
//       const masterUserID = req.adminId;
//       const defaultPipeline = await Pipeline.findOne({
//         where: {
//           masterUserID,
//           isDefault: true,
//           isActive: true,
//         },
//         include: [
//           {
//             model: PipelineStage,
//             as: "stages",
//             where: { isActive: true },
//             required: false,
//             order: [["stageOrder", "ASC"]],
//           },
//         ],
//       });

//       if (
//         defaultPipeline &&
//         defaultPipeline.stages &&
//         defaultPipeline.stages.length > 0
//       ) {
//         allStages = defaultPipeline.stages.map((stage) => stage.stageName);
//         // Create map of stage name to rotten days
//         defaultPipeline.stages.forEach((stage) => {
//           stageRottenDaysMap.set(stage.stageName, {
//             dealRottenDays: stage.dealRottenDays,
//             stageColor: stage.color,
//           });
//         });
//       }
//     } catch (pipelineError) {
//       console.log(
//         "Pipeline system not available, using hardcoded stages:",
//         pipelineError.message
//       );
//     }

//     const result = [];
//     let totalDeals = 0;

//     for (const stage of allStages) {
//       const deals = await Deal.findAll({
//         where: {
//           ...baseWhere,
//           pipelineStage: stage,
//         },
//         order: [["createdAt", "DESC"]],
//       });

//       // Process deals with rotten logic
//       const processedDeals = deals.map((deal) => {
//         const dealObj = deal.toJSON();
//         const stageInfo = stageRottenDaysMap.get(stage);

//         if (stageInfo && stageInfo.dealRottenDays) {
//           // Calculate days since deal entered this stage
//           const daysSinceCreated = Math.floor(
//             (new Date() - new Date(deal.createdAt)) / (1000 * 60 * 60 * 24)
//           );

//           const isRotten = daysSinceCreated > stageInfo.dealRottenDays;

//           // Add rotten deal indicators
//           dealObj.daysSinceCreated = daysSinceCreated;
//           dealObj.isRotten = isRotten;
//           dealObj.dealRottenDays = stageInfo.dealRottenDays;
//           dealObj.daysOverdue = isRotten
//             ? daysSinceCreated - stageInfo.dealRottenDays
//             : 0;

//           // Change color for rotten deals
//           dealObj.displayColor = isRotten ? "#FF4444" : stageInfo.stageColor; // Red for rotten
//           dealObj.rottenStatus = isRotten ? "rotten" : "fresh";
//         } else {
//           // No rotten days configured
//           dealObj.isRotten = false;
//           dealObj.rottenStatus = "fresh";
//           dealObj.displayColor = stageInfo?.stageColor || "#007BFF";
//         }

//         return dealObj;
//       });

//       // Calculate stage statistics including rotten deals
//       const rottenDealsCount = processedDeals.filter(
//         (deal) => deal.isRotten
//       ).length;
//       const totalValue = processedDeals.reduce(
//         (sum, deal) => sum + (deal.value || 0),
//         0
//       );
//       const dealCount = processedDeals.length;
//       totalDeals += dealCount;

//       // Get stage info for display
//       const stageInfo = stageRottenDaysMap.get(stage);

//       result.push({
//         stage,
//         totalValue,
//         dealCount,
//         rottenDealsCount,
//         freshDealsCount: dealCount - rottenDealsCount,
//         rottenPercentage:
//           dealCount > 0 ? Math.round((rottenDealsCount / dealCount) * 100) : 0,
//         deals: processedDeals,
//         stageInfo: {
//           dealRottenDays: stageInfo?.dealRottenDays || null,
//           stageColor: stageInfo?.stageColor || "#007BFF",
//           hasRottenDaysConfigured: !!stageInfo?.dealRottenDays,
//         },
//       });
//     }

//     res.status(200).json({
//       totalDeals,
//       stages: result,
//       rottenDealsInfo: {
//         description:
//           "Deals are marked as 'rotten' when they exceed the configured days for their stage",
//         colorCoding: {
//           fresh: "Original stage color",
//           rotten: "#FF4444 (Red)",
//         },
//       },
//     });
//   } catch (error) {
//     console.error("Error in getDealsByStage:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// this function is latest version of getDealsByStage

// exports.getDealsByStage = async (req, res) => {
//   try {
//     // Get dynamic stages from pipeline system, fallback to hardcoded if needed
//     const Pipeline = require("../../models/deals/pipelineModel");
//     const PipelineStage = require("../../models/deals/pipelineStageModel");

//     let allStages = [
//       "Qualified",
//       "Contact Made",
//       "Proposal Made",
//       "Negotiations Started",
//     ];

//     // Try to get stages from pipeline system
//     try {
//       const masterUserID = req.adminId;
//       const defaultPipeline = await Pipeline.findOne({
//         where: {
//           masterUserID,
//           isDefault: true,
//           isActive: true,
//         },
//         include: [
//           {
//             model: PipelineStage,
//             as: "stages",
//             where: { isActive: true },
//             required: false,
//             order: [["stageOrder", "ASC"]],
//           },
//         ],
//       });

//       if (
//         defaultPipeline &&
//         defaultPipeline.stages &&
//         defaultPipeline.stages.length > 0
//       ) {
//         allStages = defaultPipeline.stages.map((stage) => stage.stageName);
//       }
//     } catch (pipelineError) {
//       console.log(
//         "Pipeline system not available, using hardcoded stages:",
//         pipelineError.message
//       );
//     }

//     const result = [];
//     let totalDeals = 0;

//     // Apply user filtering for non-admin users
//     let baseWhere = {};
//     if (req.role !== "admin") {
//       baseWhere.masterUserID = req.adminId;
//     }

//     for (const stage of allStages) {
//       const deals = await Deal.findAll({
//         where: {
//           ...baseWhere,
//           pipelineStage: stage,
//         },
//         order: [["createdAt", "DESC"]],
//       });

//       const totalValue = deals.reduce(
//         (sum, deal) => sum + (deal.value || 0),
//         0
//       );
//       const dealCount = deals.length;
//       totalDeals += dealCount;

//       result.push({
//         stage,
//         totalValue,
//         dealCount,
//         deals,
//       });
//     }

//     res.status(200).json({
//       totalDeals,
//       stages: result,
//     });
//   } catch (error) {
//     console.error("Error in getDealsByStage:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// ...existing code...
exports.getDealDetail = async (req, res) => {
  const { DealParticipant, DealStageHistory, DealDetail, History, AuditTrail, Deal, Lead, LeadOrganization, LeadPerson, MasterUser, Email, CustomField, CustomFieldValue, PermissionSet, DealNote, LeadNote, LeadFilter,  DealColumn, UserCredential, PipelineStage, Currency, DealFile, DealProduct, Product, ProductVariation, GroupVisibility, Activity, LeadFile, Pipeline} = req.models;
  try {
    const { dealId } = req.params;

    // Email optimization parameters
    const { emailPage = 1, emailLimit = 10 } = req.query;
    const emailOffset = (parseInt(emailPage) - 1) * parseInt(emailLimit);
    const MAX_EMAIL_LIMIT = 50;
    const safeEmailLimit = Math.min(parseInt(emailLimit), MAX_EMAIL_LIMIT);

    const deal = await Deal.findByPk(dealId, {
      include: [
        { model: DealDetail, as: "details" },
        { model: LeadPerson, as: "Person" },
        { model: LeadOrganization, as: "Organization" },
      ],
    });

    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }

    const ownerId = deal.ownerId;
    const owner = await MasterUser.findOne({ 
       where: { masterUserID: ownerId } 
    });

    // Enhanced Pipeline Stage Processing like Pipedrive
    const stageHistory = await DealStageHistory.findAll({
      where: { dealId },
      order: [["enteredAt", "ASC"]],
    });

    const now = new Date();
    const dealCreatedAt = new Date(deal.createdAt);

    // Define your complete pipeline order (customize as needed)
    const pipelineOrder = [
      "Qualified",
      "Contact Made",
      "Proposal Made",
      "Negotiations Started",
      "Won",
      "Lost",
    ];

    // Initialize pipeline stages with comprehensive tracking
    let pipelineStagesDetail = [];
    let currentStageName = deal.pipelineStage || "Qualified";
    let totalDealDays = Math.floor(
      (now - dealCreatedAt) / (1000 * 60 * 60 * 24)
    );

    // Process stage history to calculate time spent in each stage
    if (stageHistory.length > 0) {
      // Calculate time spent in each historical stage
      for (let i = 0; i < stageHistory.length; i++) {
        const stage = stageHistory[i];
        const nextStage = stageHistory[i + 1];
        const stageStart = new Date(stage.enteredAt);
        const stageEnd = nextStage ? new Date(nextStage.enteredAt) : now;

        // Calculate days spent in this stage
        const daysInStage = Math.max(
          0,
          Math.floor((stageEnd - stageStart) / (1000 * 60 * 60 * 24))
        );

        // Calculate hours and minutes for more precision
        const totalMinutes = Math.floor((stageEnd - stageStart) / (1000 * 60));
        const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
        const minutes = totalMinutes % 60;

        pipelineStagesDetail.push({
          stageName: stage.stageName,
          enteredAt: stage.enteredAt,
          exitedAt: nextStage ? nextStage.enteredAt : null,
          days: daysInStage,
          hours: hours,
          minutes: minutes,
          totalMinutes: totalMinutes,
          isActive: !nextStage, // Current stage if no next stage
          stageOrder: pipelineOrder.indexOf(stage.stageName),
        });
      }

      // Update current stage name from the last history entry
      currentStageName = stageHistory[stageHistory.length - 1].stageName;
    } else {
      // If no stage history, deal is still in initial stage
      const daysInCurrentStage = Math.floor(
        (now - dealCreatedAt) / (1000 * 60 * 60 * 24)
      );
      const totalMinutes = Math.floor((now - dealCreatedAt) / (1000 * 60));
      const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
      const minutes = totalMinutes % 60;

      pipelineStagesDetail.push({
        stageName: currentStageName,
        enteredAt: deal.createdAt,
        exitedAt: null,
        days: daysInCurrentStage,
        hours: hours,
        minutes: minutes,
        totalMinutes: totalMinutes,
        isActive: true,
        stageOrder: pipelineOrder.indexOf(currentStageName),
      });
    }

    // Create aggregated stages map for duplicate stage handling
    const stageDaysMap = new Map();
    const stageDetailsMap = new Map();

    pipelineStagesDetail.forEach((stage) => {
      if (!stageDaysMap.has(stage.stageName)) {
        stageDaysMap.set(stage.stageName, stage.days);
        stageDetailsMap.set(stage.stageName, {
          ...stage,
          totalDays: stage.days,
          visits: 1,
          firstEntry: stage.enteredAt,
          lastEntry: stage.enteredAt,
        });
      } else {
        // Handle multiple visits to the same stage
        const existingDays = stageDaysMap.get(stage.stageName);
        const existingDetails = stageDetailsMap.get(stage.stageName);

        stageDaysMap.set(stage.stageName, existingDays + stage.days);
        stageDetailsMap.set(stage.stageName, {
          ...existingDetails,
          totalDays: existingDays + stage.days,
          visits: existingDetails.visits + 1,
          lastEntry: stage.enteredAt,
          isActive: stage.isActive || existingDetails.isActive,
        });
      }
    });

    // Create pipeline stages for frontend (Pipedrive-like structure)
    const currentStageIndex = pipelineOrder.indexOf(currentStageName);

    const pipelineStagesUnique = pipelineOrder.map((stageName, index) => {
      const stageData = stageDetailsMap.get(stageName);
      const days = stageDaysMap.get(stageName) || 0;

      // Determine if this stage should be shown based on current stage
      const shouldShow = index <= currentStageIndex;

      // For stages that haven't been visited but are before current stage,
      // show them as completed with 0 days
      const hasBeenVisited = stageDetailsMap.has(stageName);
      const isBeforeCurrentStage = index < currentStageIndex;
      const isCurrentStage = index === currentStageIndex;

      return {
        stageName,
        days,
        hours: stageData?.hours || 0,
        minutes: stageData?.minutes || 0,
        totalMinutes: stageData?.totalMinutes || 0,
        isActive: stageData?.isActive || false,
        isCurrent: isCurrentStage,
        isPassed: isBeforeCurrentStage || (hasBeenVisited && !isCurrentStage),
        isFuture: index > currentStageIndex,
        visits: stageData?.visits || 0,
        firstEntry: stageData?.firstEntry || null,
        lastEntry: stageData?.lastEntry || null,
        stageOrder: index,
        hasBeenVisited,
        shouldShow,
        // Add percentage of total time spent
        percentage:
          totalDealDays > 0 ? Math.round((days / totalDealDays) * 100) : 0,
      };
    });

    // Add pipeline insights (like Pipedrive)
    const visitedStages = pipelineStagesUnique.filter((s) => s.hasBeenVisited);

    const pipelineInsights = {
      totalDealAge: totalDealDays,
      currentStage: currentStageName,
      currentStageIndex: currentStageIndex,
      currentStageDays:
        pipelineStagesUnique.find((s) => s.isCurrent)?.days || 0,
      stagesCompleted: pipelineStagesUnique.filter((s) => s.isPassed).length,
      stagesVisited: visitedStages.length,
      totalStages: pipelineOrder.length,
      progressPercentage: Math.round(
        ((currentStageIndex + 1) / pipelineOrder.length) * 100
      ),
      stageChanges: pipelineStagesDetail.length,
      averageDaysPerStage:
        visitedStages.length > 0
          ? Math.round(totalDealDays / visitedStages.length)
          : 0,
      // Add stage completion timeline
      stageTimeline: pipelineStagesUnique.map((stage) => ({
        stageName: stage.stageName,
        status: stage.isCurrent
          ? "current"
          : stage.isPassed
          ? "completed"
          : "future",
        days: stage.days,
        percentage: stage.percentage,
      })),
    };

    // Calculate avgTimeToWon for all won deals
    const wonDeals = await Deal.findAll({ where: { status: "won" } });
    let avgTimeToWon = 0;
    if (wonDeals.length) {
      const totalDays = wonDeals.reduce((sum, d) => {
        if (d.wonDate && d.createdAt) {
          const days = Math.floor(
            (d.wonDate - d.createdAt) / (1000 * 60 * 60 * 24)
          );
          return sum + days;
        }
        return sum;
      }, 0);
      avgTimeToWon = Math.round(totalDays / wonDeals.length);
    }

    // Overview calculations
    const createdAt = deal.createdAt;
    const dealAgeDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
    const dealAge = dealAgeDays < 1 ? "< 1 day" : `${dealAgeDays} days`;
    // inactiveDays and inactiveFromDate will be calculated after activities are processed

    // Send all person data
    const personArr = deal.Person
      ? [deal.Person.toJSON ? deal.Person.toJSON() : deal.Person]
      : [];

    // Send all organization data
    const orgArr = deal.Organization
      ? [
          deal.Organization.toJSON
            ? deal.Organization.toJSON()
            : deal.Organization,
        ]
      : [];

    // Flat deal object (as before)
    const dealObj = {
      dealId: deal.dealId,
      title: deal.title,
      value: deal.value,
      valueCurrency: deal.valueCurrency || deal.currency, // Use newer field first, fallback to legacy
      pipeline: deal.pipeline,
      ownerId: deal.ownerId,
      pipelineStage: deal.pipelineStage,
      status: deal.status || "open",
      createdAt: deal.createdAt,
      expectedCloseDate: deal.expectedCloseDate,
      serviceType: deal.serviceType,
      proposalValue: deal.proposalValue,
      proposalValueCurrency: deal.proposalValueCurrency || deal.proposalCurrency, // Use newer field first, fallback to legacy
      esplProposalNo: deal.esplProposalNo,
      projectLocation: deal.projectLocation,
      organizationCountry: deal.organizationCountry,
      proposalSentDate: deal.proposalSentDate,
      sourceOrgin: deal.sourceOrgin,
      sourceChannel: deal.sourceChannel,
      sourceChannelId: deal.sourceChannelId,
      statusSummary: deal.details?.statusSummary,
      responsiblePerson: deal.details?.responsiblePerson,
      rfpReceivedDate: deal.details?.rfpReceivedDate,
      wonTime: deal.details?.wonTime,
      lostTime: deal.details?.lostTime,
      lostReason: deal.details?.lostReason,
      // ...other deal fields
    };

        // FETCH CURRENCY DETAILS
        let valueCurrencyDetails = null;
        let proposalValueCurrencyDetails = null;
    
        // Check for value currency (prioritize newer field, fallback to older field)
        const valueCurrencyCode = deal.valueCurrency || deal.currency;
        if (valueCurrencyCode) {
          valueCurrencyDetails = await Currency.findOne({
            where: { currency_desc: valueCurrencyCode },
            attributes: ['currencyId', 'currency_desc']
          });
        }
    
        // Check for proposal currency (prioritize newer field, fallback to older field)
        const proposalCurrencyCode = deal.proposalValueCurrency || deal.proposalCurrency;
        if (proposalCurrencyCode) {
          proposalValueCurrencyDetails = await Currency.findOne({
            where: { currency_desc: proposalCurrencyCode },
            attributes: ['currencyId', 'currency_desc']
          });
        }

    // Fetch participants for this deal
    const participants = await DealParticipant.findAll({
      where: { dealId },
      include: [
        {
          model: LeadPerson,
          as: "Person",
          attributes: ["personId", "contactPerson", "email"],
        },
        {
          model: LeadOrganization,
          as: "Organization",
          attributes: ["leadOrganizationId", "organization", "masterUserID"],
        },
      ],
    });

    const participantArr = await Promise.all(
      participants.map(async (p) => {
        const person = p.Person;
        const organization = p.Organization;

        let closedDeals = 0,
          openDeals = 0,
          ownerName = null;

        if (person) {
          closedDeals = await Deal.count({
            where: { personId: person.personId, status: "won" },
          });
          openDeals = await Deal.count({
            where: { personId: person.personId, status: "open" },
          });
          console.log(
            "Person found:",
            person.contactPerson,
            "Closed Deals:",
            closedDeals,
            "Open Deals:",
            openDeals
          );

          // Use ownerId or masterUserID from organization
          console.log(organization.masterUserID, " organization masterUserID");
          console.log(organization, " organization");

          let ownerIdToUse = organization
            ? organization.ownerId || organization.masterUserID
            : null;
          console.log(ownerIdToUse, " ownerIdToUse");

          if (ownerIdToUse) {
            const owner = await MasterUser.findOne({
              where: { masterUserID: ownerIdToUse },
            });
            ownerName = owner ? owner.name : null;
          }
        }

        return {
          name: person ? person.contactPerson : null,
          organization: organization ? organization.organization : null,
          email: person ? person.email : null,
          phone: person ? person.phone : null,
          closedDeals,
          openDeals,
          owner: ownerName,
        };
      })
    );

    // Optimized email fetching with pagination and visibility filtering
    console.log(`📧 [getDealDetail] Fetching emails for deal ${dealId} with visibility filtering`);
    
    // Get current user's email for visibility filtering
    let currentUserEmail = null;
    try {
      const userCredential = await UserCredential.findOne({
        where: { masterUserID: req.adminId },
        attributes: ['email']
      });
      currentUserEmail = userCredential?.email;
      console.log(`👤 [getDealDetail] Current user email: ${currentUserEmail}`);
    } catch (error) {
      console.error('Error fetching user credential:', error);
    }

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

    // NEW APPROACH: Fetch emails through person/organization relationships instead of direct dealId
    console.log(`🔍 [getDealDetail] Finding emails through person/organization relationships for deal: ${dealId}`);
    
    // Collect all email addresses associated with this deal
    const dealEmailAddresses = new Set();
    
    // Add deal's direct email
    if (deal.email) {
      dealEmailAddresses.add(deal.email.toLowerCase());
      console.log(`📧 [getDealDetail] Added deal email: ${deal.email}`);
    }
    
    // Add person emails (from participants and direct person)
    if (deal.Person && deal.Person.email) {
      dealEmailAddresses.add(deal.Person.email.toLowerCase());
      console.log(`📧 [getDealDetail] Added deal person email: ${deal.Person.email}`);
    }
    
    // Add organization email
    if (deal.Organization && deal.Organization.email) {
      dealEmailAddresses.add(deal.Organization.email.toLowerCase());
      console.log(`📧 [getDealDetail] Added deal organization email: ${deal.Organization.email}`);
    }
    
    // Add participant emails
    participants.forEach(participant => {
      if (participant.Person && participant.Person.email) {
        dealEmailAddresses.add(participant.Person.email.toLowerCase());
        console.log(`📧 [getDealDetail] Added participant email: ${participant.Person.email}`);
      }
    });
    
    console.log(`📧 [getDealDetail] Total email addresses to search: ${dealEmailAddresses.size}`);
    
    // Fetch emails based on these email addresses (relationship-based approach)
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
          "visibility",
          "userEmail"
        ],
        order: [["createdAt", "DESC"]],
        limit: safeEmailLimit,
        offset: emailOffset,
      });
    }
    
    console.log(`📧 [getDealDetail] Found ${emailsByRelationship.length} emails through relationship-based approach`);
    
    // Use relationship-based emails
    const allEmails = emailsByRelationship;

    // Log visibility statistics
    const visibilityStats = allEmails.reduce((stats, email) => {
      const visibility = email.visibility || 'legacy';
      stats[visibility] = (stats[visibility] || 0) + 1;
      return stats;
    }, {});
    console.log(`📊 [getDealDetail] Email visibility stats:`, visibilityStats);

    // Limit final email results and add optimization metadata
    const limitedEmails = allEmails.slice(0, safeEmailLimit);

    // Enrich emails with connected person, organization, leads, and deals
    console.log(`🔗 [getDealDetail] Enriching ${limitedEmails.length} emails with connected entities`);
    
    let enrichedEmails = limitedEmails;
    if (limitedEmails.length > 0) {
      // Extract all unique email addresses from sender and recipient fields
      const emailAddresses = new Set();
      
      limitedEmails.forEach(email => {
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
        if (email.cc) {
          // Handle CC recipients
          const ccRecipients = email.cc.split(/[,;]/).map(r => r.trim().toLowerCase());
          ccRecipients.forEach(recipient => {
            if (recipient && recipient.includes('@')) {
              emailAddresses.add(recipient);
            }
          });
        }
        if (email.bcc) {
          // Handle BCC recipients
          const bccRecipients = email.bcc.split(/[,;]/).map(r => r.trim().toLowerCase());
          bccRecipients.forEach(recipient => {
            if (recipient && recipient.includes('@')) {
              emailAddresses.add(recipient);
            }
          });
        }
      });
      
      const uniqueEmailAddresses = Array.from(emailAddresses);
      console.log(`📧 [getDealDetail] Found ${uniqueEmailAddresses.length} unique email addresses to lookup`);
      
      // Bulk fetch all related entities for these email addresses
      const [connectedPersons, connectedOrganizations, connectedLeads, connectedDeals] = await Promise.all([
        // Find persons by email
        LeadPerson.findAll({
          where: {
            email: { [Op.in]: uniqueEmailAddresses }
          },
          attributes: ['personId', 'contactPerson', 'email', 'phone', 'jobTitle', 'leadOrganizationId'],
          raw: true
        }),
        
        // Find organizations by email (if organizations have email field)
        LeadOrganization.findAll({
          where: {
            ...(LeadOrganization.rawAttributes.email ? { email: { [Op.in]: uniqueEmailAddresses } } : {})
          },
          attributes: ['leadOrganizationId', 'organization','address'],
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
      connectedDeals.forEach(dealItem => {
        if (dealItem.email) {
          const emailKey = dealItem.email.toLowerCase();
          if (!dealEmailMap.has(emailKey)) {
            dealEmailMap.set(emailKey, []);
          }
          dealEmailMap.get(emailKey).push(dealItem);
        }
      });
      
      console.log(`🔍 [getDealDetail] Email mapping results - Persons: ${connectedPersons.length}, Organizations: ${connectedOrganizations.length}, Leads: ${connectedLeads.length}, Deals: ${connectedDeals.length}`);
      
      // Enrich each email with connected entities
      enrichedEmails = limitedEmails.map(email => {
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
        
        // Check CC emails
        if (emailObj.cc) {
          const ccRecipients = emailObj.cc.split(/[,;]/).map(r => r.trim());
          ccRecipients.forEach(recipient => {
            if (recipient && recipient.includes('@')) {
              addConnectedEntities(recipient);
            }
          });
        }
        
        // Check BCC emails
        if (emailObj.bcc) {
          const bccRecipients = emailObj.bcc.split(/[,;]/).map(r => r.trim());
          bccRecipients.forEach(recipient => {
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
        emailObj.connectedDeals = emailObj.connectedDeals.filter((dealItem, index, self) => 
          index === self.findIndex(d => d.dealId === dealItem.dealId)
        );
        
        return emailObj;
      });
      
      // Log enrichment statistics
      const enrichmentStats = {
        totalEmails: enrichedEmails.length,
        emailsWithPersons: enrichedEmails.filter(e => e.connectedPersons.length > 0).length,
        emailsWithOrganizations: enrichedEmails.filter(e => e.connectedOrganizations.length > 0).length,
        emailsWithLeads: enrichedEmails.filter(e => e.connectedLeads.length > 0).length,
        emailsWithDeals: enrichedEmails.filter(e => e.connectedDeals.length > 0).length
      };
      console.log(`📊 [getDealDetail] Email enrichment stats:`, enrichmentStats);
    }

    // Process emails for optimization
    const optimizedEmails = enrichedEmails.map((email) => {
      const emailData = email.toJSON ? email.toJSON() : email;

      // Truncate email body if present (for memory optimization)
      if (emailData.body) {
        emailData.body =
          emailData.body.length > 1000
            ? emailData.body.substring(0, 1000) + "... [truncated]"
            : emailData.body;
      }

      return emailData;
    });

    // Fetch deal files directly uploaded to this deal
    let files = [];
    
    const dealFiles = await DealFile.findAll({
      where: { dealId },
      attributes: [
        "fileId",
        "dealId", 
        "fileName",
        "fileSize",
        "fileCategory",
        "filePath",
        "uploadedBy",
        "downloadCount",
        "createdAt",
        "updatedAt"
      ],
      order: [["createdAt", "DESC"]],
      limit: 20 // Limit deal files to prevent large responses
    });

    // Add deal files to the files array with uploader names
    if (dealFiles.length > 0) {
      // Get unique uploader IDs to fetch user names in bulk
      const uploaderIds = [...new Set(dealFiles.map(f => f.uploadedBy).filter(id => id))];
      
      // Fetch all uploader users in one query
      const uploaderUsers = await MasterUser.findAll({
        where: {
          masterUserID: { [Op.in]: uploaderIds }
        },
        attributes: ["masterUserID", "name"],
        raw: true
      });
      
      // Create a map for quick lookup
      const uploaderMap = new Map();
      uploaderUsers.forEach(user => {
        uploaderMap.set(user.masterUserID, user.name);
      });

      // Format deal files
      files = dealFiles.map((file) => ({
        fileId: file.fileId,
        dealId: file.dealId,
        filename: file.fileName,
        fileSize: file.fileSize,
        fileCategory: file.fileCategory,
        filePath: file.filePath,
        uploadedBy: file.uploadedBy,
        uploaderName: uploaderMap.get(file.uploadedBy) || 'Unknown',
        downloadCount: file.downloadCount || 0,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        fileType: 'deal_file'
      }));
    }

    // Fetch notes for this deal
    let notes = await DealNote.findAll({
      where: { dealId },
      limit: 20,
      order: [["createdAt", "DESC"]],
    });
    let leadNotes = [];
    if (deal.leadId) {
      leadNotes = await LeadNote.findAll({
        where: { leadId: deal.leadId },
        limit: 20,
        order: [["createdAt", "DESC"]],
      });
    }
    if (leadNotes.length > 0) {
      const noteMap = new Map();
      notes.forEach((n) => noteMap.set(n.noteId || n.id, n));
      leadNotes.forEach((n) => noteMap.set(n.noteId || n.id, n));
      notes = Array.from(noteMap.values());
    }

    // Add creator names to notes
    if (notes.length > 0) {
      // Get unique creator IDs from notes
      const creatorIds = [...new Set(notes.map(n => n.createdBy).filter(id => id))];
      
      // Fetch all creator users in one query
      const creatorUsers = await MasterUser.findAll({
        where: {
          masterUserID: { [Op.in]: creatorIds }
        },
        attributes: ["masterUserID", "name"],
        raw: true
      });
      
      // Create a map for quick lookup
      const creatorMap = new Map();
      creatorUsers.forEach(user => {
        creatorMap.set(user.masterUserID, user.name);
      });
      
      // Add creatorName to each note
      notes = notes.map(note => {
        const noteData = note.toJSON ? note.toJSON() : note;
        noteData.creatorName = creatorMap.get(note.createdBy) || null;
        return noteData;
      });
    }

    // Fetch activities for this deal and its linked lead (if any)
    // Fetch activities for this deal and its linked lead (if any) using Activity model
    let activities = await Activity.findAll({
      where: {
        [Op.or]: [
          { dealId },
          deal.leadId ? { leadId: deal.leadId } : null,
        ].filter(Boolean),
      },
      limit: 40, // fetch more to cover both
      order: [["startDateTime", "DESC"]],
    });
    
    // Deduplicate activities by activityId or id and add assignedToName
    if (activities.length > 0) {
      const actMap = new Map();
      
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
      activities.forEach((a) => {
        const activityData = a.toJSON();
        // Add assignedToName using the user map
        activityData.assignedToName = userMap.get(a.assignedTo) || null;
        actMap.set(a.activityId || a.id, activityData);
      });
      
      activities = Array.from(actMap.values());
    }

    // Calculate inactive days and inactive from date based on last activity
    let inactiveDays = 0;
    let inactiveFromDate = null;
    
    if (activities.length > 0) {
      // Find the most recent activity (activities are already sorted by startDateTime DESC)
      const lastActivity = activities[0];
      if (lastActivity && lastActivity.startDateTime) {
        const lastActivityDate = new Date(lastActivity.startDateTime);
        const daysSinceLastActivity = Math.floor((now - lastActivityDate) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastActivity > 0) {
          inactiveDays = daysSinceLastActivity;
          inactiveFromDate = lastActivityDate.toISOString();
        }
      }
    } else {
      // If no activities, inactive since deal creation
      const daysSinceCreation = Math.floor((now - new Date(deal.createdAt)) / (1000 * 60 * 60 * 24));
      inactiveDays = daysSinceCreation;
      inactiveFromDate = deal.createdAt;
    }

    // ====== ACTIVITY TYPE ANALYTICS (Like Pipedrive) ======
    console.log(`📊 [getDealDetail] Analyzing activity types for deal ${dealId}`);
    
    let activityTypeAnalytics = {
      totalActivities: 0,
      activityTypes: {},
      mostFrequentTypes: [],
      topActivityType: {},
      activityTypeDistribution: {},
      recentActivityTypes: {},
      activityTrends: {
        description: "Most frequent activity types related to this deal",
        methodology: "Counts all activities linked to this deal and ranks them by type"
      }
    };

    if (activities.length > 0) {
      // Count activities by type
      const activityTypeCounts = {};
      const activityTypeDetails = {};
      const recentActivityTypes = {}; // Last 30 days
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      activities.forEach(activity => {
        const activityType = activity.activityType || activity.type || 'Other';
        const activityDate = new Date(activity.startDateTime || activity.createdAt);
        
        // Overall counts
        if (!activityTypeCounts[activityType]) {
          activityTypeCounts[activityType] = 0;
          activityTypeDetails[activityType] = {
            count: 0,
            latestActivity: null,
            oldestActivity: null,
            avgDaysApart: 0,
            activities: []
          };
        }
        
        activityTypeCounts[activityType]++;
        activityTypeDetails[activityType].count++;
        activityTypeDetails[activityType].activities.push({
          activityId: activity.activityId || activity.id,
          title: activity.title || activity.subject,
          date: activityDate,
          assignedTo: activity.assignedToName
        });
        
        // Update latest/oldest dates
        if (!activityTypeDetails[activityType].latestActivity || 
            activityDate > new Date(activityTypeDetails[activityType].latestActivity)) {
          activityTypeDetails[activityType].latestActivity = activityDate;
        }
        
        if (!activityTypeDetails[activityType].oldestActivity || 
            activityDate < new Date(activityTypeDetails[activityType].oldestActivity)) {
          activityTypeDetails[activityType].oldestActivity = activityDate;
        }
        
        // Recent activities (last 30 days)
        if (activityDate >= thirtyDaysAgo) {
          if (!recentActivityTypes[activityType]) {
            recentActivityTypes[activityType] = 0;
          }
          recentActivityTypes[activityType]++;
        }
      });

      // Calculate average days apart for each activity type
      Object.keys(activityTypeDetails).forEach(activityType => {
        const details = activityTypeDetails[activityType];
        if (details.count > 1 && details.latestActivity && details.oldestActivity) {
          const daysDiff = Math.floor(
            (new Date(details.latestActivity) - new Date(details.oldestActivity)) / (1000 * 60 * 60 * 24)
          );
          details.avgDaysApart = Math.round(daysDiff / (details.count - 1));
        }
      });

      // Sort activity types by frequency (most frequent first)
      const sortedActivityTypes = Object.entries(activityTypeCounts)
        .sort(([,a], [,b]) => b - a)
        .map(([type, count], index) => {
          const details = activityTypeDetails[type];
          const percentage = Math.round((count / activities.length) * 100);
          
          return {
            rank: index + 1,
            activityType: type,
            count: count,
            percentage: percentage,
            latestActivity: details.latestActivity,
            oldestActivity: details.oldestActivity,
            avgDaysApart: details.avgDaysApart,
            recentCount: recentActivityTypes[type] || 0,
            isTopType: index < 3, // Top 3 types
            activities: details.activities.slice(0, 5) // Show last 5 activities of this type
          };
        });

      // Create distribution object for easy frontend consumption
      const distribution = {};
      sortedActivityTypes.forEach(item => {
        distribution[item.activityType] = {
          count: item.count,
          percentage: item.percentage,
          rank: item.rank
        };
      });

      activityTypeAnalytics = {
        totalActivities: activities.length,
        activityTypes: activityTypeCounts,
        mostFrequentTypes: sortedActivityTypes,
        topActivityType: sortedActivityTypes[0] || {},
        activityTypeDistribution: distribution,
        recentActivityTypes: recentActivityTypes,
        diversityScore: Object.keys(activityTypeCounts).length, // Number of different activity types
        insights: {
          mostActiveType: sortedActivityTypes[0]?.activityType || 'None',
          totalTypes: Object.keys(activityTypeCounts).length,
          recentActivityCount: Object.values(recentActivityTypes).reduce((sum, count) => sum + count, 0),
          averageActivitiesPerType: sortedActivityTypes.length > 0 
            ? Math.round(activities.length / sortedActivityTypes.length) 
            : 0,
          dominantTypePercentage: sortedActivityTypes[0]?.percentage || 0
        },
        activityTrends: {
          description: "Most frequent activity types related to this deal",
          methodology: "Counts all activities linked to this deal and ranks them by type",
          periodAnalyzed: "All activities + Recent 30 days",
          totalActivitiesAnalyzed: activities.length
        }
      };

      console.log(`📈 [getDealDetail] Activity type analytics: ${Object.keys(activityTypeCounts).length} types, top type: ${sortedActivityTypes[0]?.activityType} (${sortedActivityTypes[0]?.count} activities)`);
    } else {
      console.log(`📊 [getDealDetail] No activities found for analytics`);
    }

    // ====== MOST ACTIVE USERS ANALYTICS (Like Pipedrive) ======
    console.log(`👥 [getDealDetail] Analyzing most active users for deal ${dealId}`);
    
    let mostActiveUsersAnalytics = {
      totalUsers: 0,
      userActivityCounts: {},
      mostActiveUsers: [],
      userActivityDistribution: {},
      recentUserActivity: {},
      userInsights: {
        description: "Users (team members) who performed activities most frequently in this deal",
        methodology: "Counts activities by user and ranks them by frequency"
      }
    };

    if (activities.length > 0) {
      // Count activities by user
      const userActivityCounts = {};
      const userActivityDetails = {};
      const recentUserActivity = {}; // Last 30 days
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      activities.forEach(activity => {
        // Get user info - use assignedTo ID and name
        const userId = activity.assignedTo;
        const userName = activity.assignedToName || 'Unknown User';
        const userKey = userId ? `${userId}` : 'unassigned';
        const activityDate = new Date(activity.startDateTime || activity.createdAt);
        const activityType = activity.activityType || activity.type || 'Other';
        
        // Initialize user tracking
        if (!userActivityCounts[userKey]) {
          userActivityCounts[userKey] = 0;
          userActivityDetails[userKey] = {
            userId: userId,
            userName: userName,
            count: 0,
            activityTypes: {},
            latestActivity: null,
            oldestActivity: null,
            activities: [],
            isActive: false // Will be set to true if user has recent activities
          };
        }
        
        // Increment counts
        userActivityCounts[userKey]++;
        userActivityDetails[userKey].count++;
        
        // Track activity types per user
        if (!userActivityDetails[userKey].activityTypes[activityType]) {
          userActivityDetails[userKey].activityTypes[activityType] = 0;
        }
        userActivityDetails[userKey].activityTypes[activityType]++;
        
        // Add activity to user's list
        userActivityDetails[userKey].activities.push({
          activityId: activity.activityId || activity.id,
          title: activity.title || activity.subject,
          type: activityType,
          date: activityDate
        });
        
        // Update latest/oldest dates
        if (!userActivityDetails[userKey].latestActivity || 
            activityDate > new Date(userActivityDetails[userKey].latestActivity)) {
          userActivityDetails[userKey].latestActivity = activityDate;
        }
        
        if (!userActivityDetails[userKey].oldestActivity || 
            activityDate < new Date(userActivityDetails[userKey].oldestActivity)) {
          userActivityDetails[userKey].oldestActivity = activityDate;
        }
        
        // Recent activities (last 30 days)
        if (activityDate >= thirtyDaysAgo) {
          if (!recentUserActivity[userKey]) {
            recentUserActivity[userKey] = 0;
          }
          recentUserActivity[userKey]++;
          userActivityDetails[userKey].isActive = true;
        }
      });

      // Sort users by activity count (most active first)
      const sortedActiveUsers = Object.entries(userActivityCounts)
        .sort(([,a], [,b]) => b - a)
        .map(([userKey, count], index) => {
          const details = userActivityDetails[userKey];
          const percentage = Math.round((count / activities.length) * 100);
          
          // Get top activity types for this user
          const userTopActivityTypes = Object.entries(details.activityTypes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([type, typeCount]) => ({
              type,
              count: typeCount,
              percentage: Math.round((typeCount / count) * 100)
            }));
          
          return {
            rank: index + 1,
            userId: details.userId,
            userName: details.userName,
            totalActivities: count,
            percentage: percentage,
            recentActivities: recentUserActivity[userKey] || 0,
            latestActivity: details.latestActivity,
            oldestActivity: details.oldestActivity,
            isActive: details.isActive,
            topActivityTypes: userTopActivityTypes,
            activityTypeCount: Object.keys(details.activityTypes).length,
            recentActivities: details.activities
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .slice(0, 5), // Show 5 most recent activities
            engagement: {
              level: percentage >= 40 ? 'High' : percentage >= 20 ? 'Medium' : 'Low',
              consistency: details.isActive ? 'Active' : 'Inactive',
              specialization: userTopActivityTypes[0]?.type || 'Mixed'
            }
          };
        });

      // Create distribution object for easy frontend consumption
      const userDistribution = {};
      sortedActiveUsers.forEach(user => {
        userDistribution[user.userId || 'unassigned'] = {
          userName: user.userName,
          count: user.totalActivities,
          percentage: user.percentage,
          rank: user.rank,
          engagement: user.engagement
        };
      });

      // Calculate user engagement insights
      const activeUsers = sortedActiveUsers.filter(user => user.isActive);
      const highEngagementUsers = sortedActiveUsers.filter(user => user.engagement.level === 'High');
      const totalUniqueUsers = sortedActiveUsers.length;

      mostActiveUsersAnalytics = {
        totalUsers: totalUniqueUsers,
        userActivityCounts: userActivityCounts,
        mostActiveUsers: sortedActiveUsers,
        userActivityDistribution: userDistribution,
        recentUserActivity: recentUserActivity,
        topUser: sortedActiveUsers[0] || null,
        activeUsersCount: activeUsers.length,
        highEngagementUsersCount: highEngagementUsers.length,
        insights: {
          mostActiveUser: sortedActiveUsers[0]?.userName || 'None',
          totalUniqueUsers: totalUniqueUsers,
          activeUsersLast30Days: activeUsers.length,
          highEngagementUsers: highEngagementUsers.length,
          averageActivitiesPerUser: totalUniqueUsers > 0 
            ? Math.round(activities.length / totalUniqueUsers) 
            : 0,
          topUserPercentage: sortedActiveUsers[0]?.percentage || 0,
          engagementDistribution: {
            high: highEngagementUsers.length,
            medium: sortedActiveUsers.filter(u => u.engagement.level === 'Medium').length,
            low: sortedActiveUsers.filter(u => u.engagement.level === 'Low').length
          }
        },
        userInsights: {
          description: "Users (team members) who performed activities most frequently in this deal",
          methodology: "Counts activities by user and ranks them by frequency",
          periodAnalyzed: "All activities + Recent 30 days",
          totalActivitiesAnalyzed: activities.length,
          userEngagementLevels: {
            high: "40%+ of deal activities",
            medium: "20-39% of deal activities", 
            low: "Under 20% of deal activities"
          }
        }
      };

      console.log(`👥 [getDealDetail] User activity analytics: ${totalUniqueUsers} users, top user: ${sortedActiveUsers[0]?.userName} (${sortedActiveUsers[0]?.totalActivities} activities)`);
    } else {
      console.log(`👥 [getDealDetail] No activities found for user analytics`);
    }

    // ====== FETCH DEAL PRODUCTS ======
    console.log(`📦 [getDealDetail] Fetching products for deal ${dealId}`);
    
    const dealProducts = await DealProduct.findAll({
      where: { dealId },
      include: [
        {
          model: Product,
          as: "product",
          attributes: [
            "productId",
            "name",
            "code",
            "description",
            "category",
            "unit",
            "imageUrl",
            "isActive",
            "hasVariations",
            "prices",
            "cost",
            "costCurrency"
          ]
        },
        {
          model: ProductVariation,
          as: "variation",
          required: false,
          attributes: [
            "variationId",
            "name",
            "sku",
            "description",
            "attributes",
            "prices",
            "cost",
            "isActive"
          ]
        }
      ],
      order: [["sortOrder", "ASC"], ["createdAt", "ASC"]]
    });

    console.log(`📦 [getDealDetail] Found ${dealProducts.length} products for deal ${dealId}`);

    // Calculate product summary and revenue metrics
    let productSummary = {
      totalProducts: dealProducts.length,
      subtotal: 0,
      totalDiscount: 0,
      totalTax: 0,
      grandTotal: 0,
      revenueMetrics: {
        monthlyRecurringRevenue: 0,
        annualRecurringRevenue: 0,
        annualContractValue: 0,
        totalContractValue: 0
      },
      billingFrequencyBreakdown: {},
      productsByCategory: {},
      averageProductValue: 0
    };

    if (dealProducts.length > 0) {
      // Calculate financial totals
      dealProducts.forEach(dp => {
        const subtotal = parseFloat(dp.subtotal || 0);
        const discount = parseFloat(dp.discountAmount || 0);
        const tax = parseFloat(dp.taxAmount || 0);
        const total = parseFloat(dp.total || 0);
        const quantity = parseFloat(dp.quantity || 1);
        const billingFrequency = dp.billingFrequency || 'one-time';
        
        productSummary.subtotal += subtotal;
        productSummary.totalDiscount += discount;
        productSummary.totalTax += tax;
        productSummary.grandTotal += total;

        // Revenue metrics based on billing frequency
        if (billingFrequency === 'monthly') {
          productSummary.revenueMetrics.monthlyRecurringRevenue += total;
          productSummary.revenueMetrics.annualRecurringRevenue += total * 12;
        } else if (billingFrequency === 'quarterly') {
          productSummary.revenueMetrics.monthlyRecurringRevenue += total / 3;
          productSummary.revenueMetrics.annualRecurringRevenue += total * 4;
        } else if (billingFrequency === 'yearly') {
          productSummary.revenueMetrics.monthlyRecurringRevenue += total / 12;
          productSummary.revenueMetrics.annualRecurringRevenue += total;
        } else {
          // One-time
          productSummary.revenueMetrics.totalContractValue += total;
        }

        // Billing frequency breakdown
        if (!productSummary.billingFrequencyBreakdown[billingFrequency]) {
          productSummary.billingFrequencyBreakdown[billingFrequency] = {
            count: 0,
            total: 0
          };
        }
        productSummary.billingFrequencyBreakdown[billingFrequency].count++;
        productSummary.billingFrequencyBreakdown[billingFrequency].total += total;

        // Products by category
        const category = dp.product?.category || 'Uncategorized';
        if (!productSummary.productsByCategory[category]) {
          productSummary.productsByCategory[category] = {
            count: 0,
            total: 0
          };
        }
        productSummary.productsByCategory[category].count++;
        productSummary.productsByCategory[category].total += total;
      });

      // Calculate ACV and TCV
      productSummary.revenueMetrics.annualContractValue = 
        productSummary.revenueMetrics.annualRecurringRevenue + 
        (productSummary.revenueMetrics.totalContractValue / (deal.contractDuration || 1));
      
      productSummary.revenueMetrics.totalContractValue = 
        (productSummary.revenueMetrics.annualRecurringRevenue * (deal.contractDuration || 1)) + 
        productSummary.revenueMetrics.totalContractValue;

      // Average product value
      productSummary.averageProductValue = 
        productSummary.totalProducts > 0 
          ? productSummary.grandTotal / productSummary.totalProducts 
          : 0;

      // Round all monetary values to 2 decimal places
      productSummary.subtotal = Math.round(productSummary.subtotal * 100) / 100;
      productSummary.totalDiscount = Math.round(productSummary.totalDiscount * 100) / 100;
      productSummary.totalTax = Math.round(productSummary.totalTax * 100) / 100;
      productSummary.grandTotal = Math.round(productSummary.grandTotal * 100) / 100;
      productSummary.averageProductValue = Math.round(productSummary.averageProductValue * 100) / 100;
      productSummary.revenueMetrics.monthlyRecurringRevenue = Math.round(productSummary.revenueMetrics.monthlyRecurringRevenue * 100) / 100;
      productSummary.revenueMetrics.annualRecurringRevenue = Math.round(productSummary.revenueMetrics.annualRecurringRevenue * 100) / 100;
      productSummary.revenueMetrics.annualContractValue = Math.round(productSummary.revenueMetrics.annualContractValue * 100) / 100;
      productSummary.revenueMetrics.totalContractValue = Math.round(productSummary.revenueMetrics.totalContractValue * 100) / 100;

      console.log(`💰 [getDealDetail] Product summary: ${productSummary.totalProducts} products, Grand Total: ${productSummary.grandTotal}, MRR: ${productSummary.revenueMetrics.monthlyRecurringRevenue}`);
    }

    // Fetch custom field values for this deal
    const customFieldValues = await CustomFieldValue.findAll({
      where: {
        entityId: dealId.toString(),
        entityType: "deal",
        masterUserID: req.adminId,
      },
      include: [
        {
          model: CustomField,
          as: "CustomField",
          where: { isActive: true },
          required: true,
        },
      ],
      order: [
        [{ model: CustomField, as: "CustomField" }, "category", "ASC"],
        [{ model: CustomField, as: "CustomField" }, "fieldGroup", "ASC"],
        [{ model: CustomField, as: "CustomField" }, "displayOrder", "ASC"],
      ],
    });

    // Format custom fields
    const formattedCustomFields = {};
    const fieldsByCategory = {};
    const fieldsByGroup = {};

    customFieldValues.forEach((value) => {
      const field = value.CustomField;
      const category = field.category || "Details";
      const fieldGroup = field.fieldGroup || "Default";

      formattedCustomFields[field.fieldId] = {
        fieldId: field.fieldId,
        fieldName: field.fieldName,
        fieldLabel: field.fieldLabel,
        fieldType: field.fieldType,
        value: value.value,
        options: field.options,
        isRequired: field.isRequired,
        isImportant: field.isImportant,
        category: category,
        fieldGroup: fieldGroup,
      };

      if (!fieldsByCategory[category]) {
        fieldsByCategory[category] = [];
      }
      fieldsByCategory[category].push(formattedCustomFields[field.fieldId]);

      if (!fieldsByGroup[fieldGroup]) {
        fieldsByGroup[fieldGroup] = [];
      }
      fieldsByGroup[fieldGroup].push(formattedCustomFields[field.fieldId]);
    });

    console.log(
      `Deal detail: ${optimizedEmails.length} emails, ${files.length} files, ${notes.length} notes, ${activities.length} activities`
    );
    console.log(
      `Pipeline: ${currentStageName} (${pipelineInsights.currentStageDays} days), Total: ${pipelineInsights.totalDealAge} days, Progress: ${pipelineInsights.progressPercentage}%`
    );
    console.log(
      `Stages:`,
      pipelineStagesUnique.map((s) => `${s.stageName}:${s.days}d`).join(", ")
    );

    res.status(200).json({
      deal: dealObj,
      currencyDetails: {
        valueCurrency: valueCurrencyDetails ? {
          currencyId: valueCurrencyDetails.currencyId,
          currency_desc: valueCurrencyDetails.currency_desc
        } : null,
        proposalValueCurrency: proposalValueCurrencyDetails ? {
          currencyId: proposalValueCurrencyDetails.currencyId,
          currency_desc: proposalValueCurrencyDetails.currency_desc
        } : null
      },
      person: personArr,
      organization: orgArr,
      pipelineStages: pipelineStagesUnique, // Enhanced pipeline stages like Pipedrive (but maintains frontend compatibility)
      currentStage: currentStageName,
      overview: {
        dealAge: `${totalDealDays} days`,
        avgTimeToWon,
        inactiveDays,
        inactiveFromDate,
        createdAt,
        totalDealDays,
      },
      participants: participantArr,
      emails: optimizedEmails,
      notes,
      activities,
      files,
      products: dealProducts,
      productSummary: productSummary,
      customFields: {
        values: formattedCustomFields,
        fieldsByCategory,
        fieldsByGroup,
      },
      // Activity Type Analytics (Like Pipedrive)
      activityAnalytics: activityTypeAnalytics,
      // Most Active Users Analytics (Like Pipedrive)
      userActivityAnalytics: mostActiveUsersAnalytics,
      // Add metadata for debugging and pagination (maintaining response structure)
      _emailMetadata: {
        totalEmails: allEmails.length,
        returnedEmails: optimizedEmails.length,
        emailPage: parseInt(emailPage),
        emailLimit: safeEmailLimit,
        hasMoreEmails: false, // Since we're using relationship-based approach
        truncatedBodies: optimizedEmails.some(
          (e) => e.body && e.body.includes("[truncated]")
        ),
        // Email entity enrichment information
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
        // Email fetching approach
        fetchingMethod: {
          approach: "relationship-based",
          description: "Emails are fetched through person/organization relationships rather than direct dealId associations",
          emailSources: {
            dealEmail: deal.email || null,
            personEmails: deal.Person?.email ? [deal.Person.email] : [],
            organizationEmails: deal.Organization?.email ? [deal.Organization.email] : [],
            participantEmails: participants.filter(p => p.Person?.email).map(p => p.Person.email)
          },
          totalEmailAddresses: dealEmailAddresses.size,
          searchedAddresses: Array.from(dealEmailAddresses)
        },
        // Email visibility information
        visibilityFiltering: {
          currentUserEmail: currentUserEmail,
          visibilityStats: visibilityStats,
          filterApplied: !!currentUserEmail,
          description: currentUserEmail 
            ? "Emails filtered by visibility - showing shared emails and private emails owned by current user"
            : "User email not found - showing only shared emails and legacy emails"
        }
      },
      // Files metadata for deal files only
      _filesMetadata: {
        totalFiles: files.length,
        dealFiles: files.length,
        fileTypes: {
          deal_file: "Files directly uploaded to this deal"
        },
        fileSources: {
          description: "Files are directly uploaded to this deal (email attachments excluded)",
          dealFilesLimit: 20
        },
        fileCategories: files.reduce((acc, file) => {
          if (file.fileCategory) {
            acc[file.fileCategory] = (acc[file.fileCategory] || 0) + 1;
          }
          return acc;
        }, {}),
        fileStats: {
          totalSize: files.reduce((sum, file) => sum + (file.fileSize || 0), 0),
          avgFileSize: files.length > 0 
            ? Math.round(files.reduce((sum, file) => sum + (file.fileSize || 0), 0) / files.length)
            : 0,
          oldestFile: files.length > 0 
            ? new Date(Math.min(...files.map(f => new Date(f.createdAt).getTime()))).toISOString()
            : null,
          newestFile: files.length > 0 
            ? new Date(Math.max(...files.map(f => new Date(f.createdAt).getTime()))).toISOString()
            : null
        }
      },
      // Enhanced pipeline data (optional for frontend to use)
      _pipelineMetadata: {
        pipelineStagesDetail: pipelineStagesDetail, // Detailed stage history
        pipelineInsights: pipelineInsights, // Pipeline analytics
        stageTimeline: pipelineInsights.stageTimeline, // Stage completion timeline
      },
      owner : {
        ownerName : owner.name,
        ownerId : owner.masterUserID
      },
      // Deal conversion information for modal display
      conversionInfo: {
        isConvertedToLead: deal.isConvertedToLead || false,
        convertedToLeadAt: deal.convertedToLeadAt || null,
        convertedToLeadBy: deal.convertedToLeadBy || null,
        conversionStatus: deal.isConvertedToLead ? 'converted' : 'original',
        displayFlag: deal.isConvertedToLead ? {
          status: 'This deal was converted back to a lead',
          icon: '🔄',
          color: '#ff9800',
          badge: 'CONVERTED TO LEAD',
          timestamp: deal.convertedToLeadAt
        } : null
      }
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Internal server error" });
  }
};

// exports.deleteDeal = async (req, res) => {
//   try {
//     const { dealId } = req.params;
//     const deal = await Deal.findByPk(dealId);

//     if (!deal) {
//       return res.status(404).json({ message: "Deal not found." });
//     }

//     await deal.destroy();

//     res.status(200).json({ message: "Deal deleted successfully." });
//   } catch (error) {
//     console.log(error);

//     res.status(500).json({ message: "Internal server error" });
//   }
// };

exports.deleteDeal = async (req, res) => {
  const { DealParticipant, DealStageHistory, DealDetail, History, AuditTrail, Deal, Lead, LeadOrganization, LeadPerson, MasterUser, Email, CustomField, CustomFieldValue, PermissionSet, DealNote, LeadNote, LeadFilter,  DealColumn, UserCredential, PipelineStage, Currency, DealFile, DealProduct, Product, ProductVariation, GroupVisibility, Activity, LeadFile} = req.models;
  const { dealId } = req.params;
  const masterUserID = req.adminId;
  const role = req.role;
  const entityType = "deal";

   // Get the client connection from request (attached by middleware)
  const clientConnection = req.clientConnection;
  
  if (!clientConnection) {
    return res.status(500).json({
      message: "No database connection available. Please login again.",
    });
  }

  try {
    // Build the where condition based on role
    const whereCondition = { dealId };
    
    // Only include masterUserID if role is not admin
    if (role !== 'admin') {
      whereCondition.masterUserID = masterUserID;
    }

    // Check if deal exists
    const deal = await Deal.findOne({
      where: whereCondition,
    });

    if (!deal) {
      return res.status(404).json({
        message: "Deal not found.",
      });
    }

    // Start a transaction
    const transaction = await clientConnection.transaction();

    try {
      // Build where condition for custom field values deletion
      const customFieldWhereCondition = {
        entityId: dealId.toString(),
        entityType,
      };
      
      // Only include masterUserID if role is not admin
      if (role !== 'admin') {
        customFieldWhereCondition.masterUserID = masterUserID;
      }

      // Delete all custom field values
      await CustomFieldValue.destroy({
        where: customFieldWhereCondition,
        transaction,
      });

      // Delete deal stage histories
      const dealStageHistoryWhereCondition = { dealId };
      
      await DealStageHistory.destroy({
        where: dealStageHistoryWhereCondition,
        transaction,
      });

       // Delete deal details
      const dealDetailsWhereCondition = { dealId };
      
      await DealDetail.destroy({
        where: dealDetailsWhereCondition,
        transaction,
      });

      await DealNote.destroy({
         where: { dealId },
        transaction,
      });

      await DealParticipant.destroy({
         where: { dealId },
        transaction,
      });

      // Delete the deal
      await deal.destroy({ transaction });

      // Commit the transaction
      await transaction.commit();


      res.status(200).json({
        message: "Deal deleted successfully.",
        dealId: dealId,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error deleting deal:", error);
    res.status(500).json({
      message: "Failed to delete deal.",
      error: error.message,
    });
  }
};

exports.linkParticipant = async (req, res) => {
  const { DealParticipant, } = req.models;
  try {
    const { dealId } = req.params;
    const { personId } = req.body;

    // Require at least personId
    if (!dealId || !personId) {
      return res
        .status(400)
        .json({ message: "dealId and personId are required." });
    }

    // Optionally, check if participant already linked
    const exists = await DealParticipant.findOne({
      where: { dealId, personId },
    });
    if (exists) {
      return res
        .status(409)
        .json({ message: "Participant already linked to this deal." });
    }

    const participant = await DealParticipant.create({
      dealId,
      personId,
    });

    res
      .status(201)
      .json({ message: "Participant linked successfully.", participant });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.createNote = async (req, res) => {
  const { DealNote, } = req.models;
  try {
    const { dealId } = req.params;
    const { content } = req.body;
    const createdBy = req.user?.masterUserID || req.adminId; // Adjust as per your auth

    if (!content) {
      return res.status(400).json({ message: "Note content is required." });
    }

    const note = await DealNote.create({
      dealId,
      content,
      createdBy,
    });

    res.status(201).json({ message: "Note created successfully.", note });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getNotes = async (req, res) => {
  const { DealNote, } = req.models;
  try {
    const { dealId } = req.params;
    const notes = await DealNote.findAll({
      where: { dealId },
      order: [["createdAt", "DESC"]],
    });
    res.status(200).json({ notes });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.saveAllDealFieldsWithCheck = async (req, res) => {
  const { DealColumn, DealDetail, Deal } = req.models;
  // Get all field names from Deal and DealDetails models
  const dealFields = Object.keys(Deal.rawAttributes);
  const dealDetailsFields = DealDetail
    ? Object.keys(DealDetail.rawAttributes)
    : [];
  const allFieldNames = Array.from(
    new Set([...dealFields, ...dealDetailsFields])
  );

  // Exclude fields that are likely IDs (case-insensitive, ends with 'id' or is 'id')
  const filteredFieldNames = allFieldNames.filter(
    (field) => !/^id$/i.test(field) && !/id$/i.test(field)
  );

  // Accept array of { value, check } from req.body
  const { checkedFields } = req.body || {};

  // Build columns array to save: always include all fields, set check from checkedFields if provided
  let columnsToSave = filteredFieldNames.map((field) => {
    let check = false;
    if (Array.isArray(checkedFields)) {
      const found = checkedFields.find((item) => item.value === field);
      check = found ? !!found.check : false;
    }
    return { key: field, check };
  });

  try {
    let pref = await DealColumn.findOne();
    if (!pref) {
      // Create the record if it doesn't exist
      pref = await DealColumn.create({ columns: columnsToSave });
    } else {
      // Update the existing record
      pref.columns = columnsToSave;
      await pref.save();
    }
    res
      .status(200)
      .json({ message: "All deal columns saved", columns: pref.columns });
  } catch (error) {
    console.log("Error saving all deal columns:", error);
    res.status(500).json({ message: "Error saving all deal columns" });
  }
};
exports.getDealFields = async (req, res) => {
  const { DealColumn, CustomField, Deal } = req.models;
  try {
    // Get deal column preferences
    const pref = await DealColumn.findOne({ where: {} });

    let columns = [];
    if (pref) {
      // Parse columns if it's a string
      columns =
        typeof pref.columns === "string"
          ? JSON.parse(pref.columns)
          : pref.columns;
    }

    // Define labels for deal fields
    const dealFieldLabels = {
      // Basic Deal Information
      dealId: "Deal ID",
      title: "Deal Title",
      value: "Deal Value",
      currency: "Currency",
      valueCurrency: "Value Currency",
      proposalValue: "Proposal Value",
      proposalCurrency: "Proposal Currency",
      proposalValueCurrency: "Proposal Value Currency",
      
      // Pipeline & Status
      pipeline: "Pipeline",
      pipelineStage: "Pipeline Stage",
      status: "Deal Status",
      probability: "Probability",
      
      // Dates
      createdAt: "Created Date",
      updatedAt: "Last Updated",
      expectedCloseDate: "Expected Close Date",
      proposalSentDate: "Proposal Sent Date",
      rfpReceivedDate: "RFP Received Date",
      wonTime: "Won Date",
      lostTime: "Lost Date",
      dealClosedOn: "Deal Closed Date",
      closeTime: "Close Time",
      archiveTime: "Archive Time",
      nextActivityDate: "Next Activity Date",
      nextActivityTime: "Next Activity Time",
      addTime: "Add Time",
      updateTime: "Update Time",
      stageChangeTime: "Stage Change Time",
      lastActivityDate: "Last Activity Date",
      
      // Ownership & Visibility
      ownerId: "Owner ID",
      ownerName: "Owner Name",
      masterUserID: "Creator",
      visibleTo: "Visible To",
      assignedTo: "Assigned To",
      responsiblePerson: "Responsible Person",
      
      // Service & Project Details
      serviceType: "Service Type",
      scopeOfServiceType: "Scope of Service Type",
      projectLocation: "Project Location",
      organizationCountry: "Organization Country",
      stateAndCountryProjectLocation: "State & Country Project Location",
      
      // References & External IDs
      esplProposalNo: "ESPL Proposal No",
      leadId: "Lead ID",
      personId: "Person ID",
      organizationId: "Organization ID",
      sourceOrgin: "Source Origin",
      sourceChannel: "Source Channel",
      sourceChannelId: "Source Channel ID",
      
      // Activities
      nextActivityId: "Next Activity ID",
      lastActivityId: "Last Activity ID",
      
      // Status & Tracking
      statusSummary: "Status Summary",
      lostReason: "Lost Reason",
      label: "Label",
      active: "Active",
      deleted: "Deleted",
      isArchived: "Archived",
      
      // Display Options
      orgHidden: "Organization Hidden",
      personHidden: "Person Hidden",
      
      // Additional Fields
      ccEmail: "CC Email",
      bccEmail: "BCC Email",
      description: "Description",
      notes: "Notes",
      tags: "Tags",
      priority: "Priority",
      dealSource: "Deal Source",
      competitorInfo: "Competitor Info",
      budgetRange: "Budget Range",
      decisionMaker: "Decision Maker",
      timeline: "Timeline"
    };

    // Parse filterConfig and add labels for each column
    columns = columns.map((col) => {
      if (col.filterConfig) {
        col.filterConfig =
          typeof col.filterConfig === "string"
            ? JSON.parse(col.filterConfig)
            : col.filterConfig;
      }
      
      // Add label if not already present
      if (!col.label && dealFieldLabels[col.key]) {
        col.label = dealFieldLabels[col.key];
      }
      
      // Fallback: generate label from key if no predefined label exists
      if (!col.label) {
        col.label = col.key
          .replace(/([A-Z])/g, " $1") // Add space before capital letters
          .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
          .replace(/Id/g, "ID") // Replace "Id" with "ID"
          .replace(/Url/g, "URL") // Replace "Url" with "URL"
          .replace(/Api/g, "API"); // Replace "Api" with "API"
      }
      
      return col;
    });

    // Fetch custom fields for deals (only if user is authenticated)
    let customFields = [];
    if (req.adminId) {
      try {
        customFields = await CustomField.findAll({
          where: {
            entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support unified fields
            isActive: true,
            // [Op.or]: [
            //   { masterUserID: req.adminId },
            //   { fieldSource: "default" },
            //   { fieldSource: "system" },
            // ],
          },
          attributes: [
            "fieldId",
            "fieldName",
            "fieldLabel",
            "fieldType",
            "isRequired",
            "isImportant",
            "fieldSource",
            "entityType",
            "check",
            "dealCheck", // Add dealCheck field
          ],
          order: [["fieldName", "ASC"]],
        });
      } catch (customFieldError) {
        console.error("Error fetching custom fields:", customFieldError);
        // Continue without custom fields if there's an error
      }
    } else {
      console.warn("No adminId found in request - skipping custom fields");
    }

    // Format custom fields for column preferences
    const customFieldColumns = customFields.map((field) => ({
      key: field.fieldName,
      label: field.fieldLabel,
      type: field.fieldType,
      isCustomField: true,
      fieldId: field.fieldId,
      isRequired: field.isRequired,
      isImportant: field.isImportant,
      fieldSource: field.fieldSource,
      entityType: field.entityType,
      check: field.check || false, // Include check field for leads
      dealCheck: field.dealCheck || false, // Include dealCheck field for deals
    }));

    // Check if custom fields already exist in preferences and sync their dealCheck status
    customFieldColumns.forEach((customCol) => {
      const existingCol = columns.find((col) => col.key === customCol.key);
      if (existingCol) {
        // Keep the dealCheck value from database, don't override it
        // existingCol.check is for leads, customCol.dealCheck is for deals
        existingCol.dealCheck = customCol.dealCheck;
      }
    });

    // Merge regular columns with custom field columns
    const allColumns = [...columns, ...customFieldColumns];

    // Remove duplicates (custom fields might already be in preferences)
    const uniqueColumns = [];
    const seenKeys = new Set();

    allColumns.forEach((col) => {
      if (!seenKeys.has(col.key)) {
        seenKeys.add(col.key);
        
        // Ensure all columns have proper structure with labels
        const enhancedCol = {
          ...col,
          // Ensure label exists
          label: col.label || col.key
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, str => str.toUpperCase())
            .replace(/Id/g, "ID")
            .replace(/Url/g, "URL")
            .replace(/Api/g, "API"),
          // Add additional metadata for better frontend handling
          isStandardField: !col.isCustomField,
          fieldCategory: col.isCustomField ? 'custom' : 'standard',
          displayOrder: col.displayOrder || 999,
          isVisible: col.check !== undefined ? col.check : true,
          isDealVisible: col.dealCheck !== undefined ? col.dealCheck : true
        };
        
        uniqueColumns.push(enhancedCol);
      }
    });

    // Sort columns for better organization
    const sortedColumns = uniqueColumns.sort((a, b) => {
      // Custom fields at the end
      if (a.isCustomField !== b.isCustomField) {
        return a.isCustomField ? 1 : -1;
      }
      // Sort by display order, then by label
      if (a.displayOrder !== b.displayOrder) {
        return (a.displayOrder || 999) - (b.displayOrder || 999);
      }
      return (a.label || '').localeCompare(b.label || '');
    });

    // Create categorized columns for better UI organization
    const categorizedColumns = {
      basic: sortedColumns.filter(col => 
        ['dealId', 'title', 'value', 'currency', 'status', 'pipeline', 'pipelineStage'].includes(col.key)
      ),
      dates: sortedColumns.filter(col => 
        ['createdAt', 'updatedAt', 'expectedCloseDate', 'proposalSentDate', 'wonTime', 'lostTime'].includes(col.key)
      ),
      financial: sortedColumns.filter(col => 
        ['value', 'proposalValue', 'currency', 'valueCurrency', 'proposalValueCurrency'].includes(col.key)
      ),
      ownership: sortedColumns.filter(col => 
        ['ownerId', 'masterUserID', 'assignedTo', 'responsiblePerson', 'visibleTo'].includes(col.key)
      ),
      project: sortedColumns.filter(col => 
        ['serviceType', 'projectLocation', 'organizationCountry', 'esplProposalNo'].includes(col.key)
      ),
      custom: sortedColumns.filter(col => col.isCustomField),
      other: sortedColumns.filter(col => 
        !['dealId', 'title', 'value', 'currency', 'status', 'pipeline', 'pipelineStage',
          'createdAt', 'updatedAt', 'expectedCloseDate', 'proposalSentDate', 'wonTime', 'lostTime',
          'value', 'proposalValue', 'currency', 'valueCurrency', 'proposalValueCurrency',
          'ownerId', 'masterUserID', 'assignedTo', 'responsiblePerson', 'visibleTo',
          'serviceType', 'projectLocation', 'organizationCountry', 'esplProposalNo'].includes(col.key) 
        && !col.isCustomField
      )
    };

    res.status(200).json({
      success: true,
      columns: sortedColumns,
      categorizedColumns,
      metadata: {
        customFieldsCount: customFields.length,
        totalColumns: sortedColumns.length,
        regularColumns: columns.length,
        standardFieldsCount: sortedColumns.filter(col => !col.isCustomField).length,
        visibleColumns: sortedColumns.filter(col => col.isDealVisible).length,
        categories: {
          basic: categorizedColumns.basic.length,
          dates: categorizedColumns.dates.length,
          financial: categorizedColumns.financial.length,
          ownership: categorizedColumns.ownership.length,
          project: categorizedColumns.project.length,
          custom: categorizedColumns.custom.length,
          other: categorizedColumns.other.length
        }
      },
      // Backward compatibility
      customFieldsCount: customFields.length,
      totalColumns: sortedColumns.length,
      regularColumns: columns.length,
    });
  } catch (error) {
    console.error("Error fetching deal fields:", error);
    res.status(500).json({ message: "Error fetching deal fields" });
  }
};
exports.updateDealColumnChecks = async (req, res) => {
  // Expecting: { columns: [ { key: "columnName", check: true/false, dealCheck: true/false }, ... ] }
  const { DealColumn, CustomField, Deal } = req.models;
  const { columns } = req.body;

  if (!Array.isArray(columns)) {
    return res.status(400).json({ message: "Columns array is required." });
  }

  try {
    console.log("=== UPDATE DEAL COLUMN CHECKS DEBUG ===");
    console.log("Incoming columns:", JSON.stringify(columns, null, 2));
    console.log("adminId:", req.adminId);

    // Find the global DealColumn record
    let pref = await DealColumn.findOne();
    if (!pref) {
      return res.status(404).json({ message: "Preferences not found." });
    }

    // Parse columns if stored as string
    let prefColumns =
      typeof pref.columns === "string"
        ? JSON.parse(pref.columns)
        : pref.columns;

    // Get custom fields to validate incoming custom field columns
    let customFields = [];
    if (req.adminId) {
      try {
        customFields = await CustomField.findAll({
          where: {
            entityType: { [Op.in]: ["deal", "both", "lead"] }, // Support unified fields
            isActive: true,
            // [Op.or]: [
            //   { masterUserID: req.adminId },
            //   { fieldSource: "default" },
            //   { fieldSource: "system" },
            // ],
          },
          attributes: [
            "fieldId",
            "fieldName",
            "fieldLabel",
            "fieldType",
            "isRequired",
            "isImportant",
            "fieldSource",
            "entityType",
            "check",
            "dealCheck", // Add dealCheck field
          ],
        });
      } catch (customFieldError) {
        console.error("Error fetching custom fields:", customFieldError);
      }
    }

    console.log("Found custom fields:", customFields.length);
    console.log(
      "Custom field names:",
      customFields.map((f) => f.fieldName)
    );

    // Create a map of custom field names for quick lookup
    const customFieldMap = {};
    customFields.forEach((field) => {
      customFieldMap[field.fieldName] = {
        fieldId: field.fieldId,
        fieldLabel: field.fieldLabel,
        fieldType: field.fieldType,
        isRequired: field.isRequired,
        isImportant: field.isImportant,
        fieldSource: field.fieldSource,
        entityType: field.entityType,
      };
    });

    console.log("Custom field map keys:", Object.keys(customFieldMap));

    // Update check and dealCheck status for existing columns
    prefColumns = prefColumns.map((col) => {
      const found = columns.find((c) => c.key === col.key);
      if (found) {
        return {
          ...col,
          check: found.check !== undefined ? !!found.check : col.check,
          dealCheck:
            found.dealCheck !== undefined ? !!found.dealCheck : col.dealCheck,
        };
      }
      return col;
    });

    // Handle new custom field columns that don't exist in preferences yet
    const existingKeys = new Set(prefColumns.map((col) => col.key));

    columns.forEach((incomingCol) => {
      // If this column doesn't exist in preferences but is a custom field, add it
      if (
        !existingKeys.has(incomingCol.key) &&
        customFieldMap[incomingCol.key]
      ) {
        const customFieldInfo = customFieldMap[incomingCol.key];
        prefColumns.push({
          key: incomingCol.key,
          label: customFieldInfo.fieldLabel,
          type: customFieldInfo.fieldType,
          isCustomField: true,
          fieldId: customFieldInfo.fieldId,
          isRequired: customFieldInfo.isRequired,
          isImportant: customFieldInfo.isImportant,
          fieldSource: customFieldInfo.fieldSource,
          entityType: customFieldInfo.entityType,
          check: incomingCol.check !== undefined ? !!incomingCol.check : false,
          dealCheck:
            incomingCol.dealCheck !== undefined
              ? !!incomingCol.dealCheck
              : false,
        });
      }
    });

    // Update check and dealCheck fields in CustomField table for custom fields
    // 'check' field is for leads, 'dealCheck' field is for deals
    const customFieldUpdates = [];

    console.log("Processing custom field updates...");
    columns.forEach((incomingCol) => {
      console.log(`Processing column: ${incomingCol.key}`);

      if (customFieldMap[incomingCol.key]) {
        console.log(`Found custom field mapping for: ${incomingCol.key}`);

        const customField = customFields.find(
          (f) => f.fieldName === incomingCol.key
        );

        if (customField) {
          console.log(
            `Found custom field in database: ${customField.fieldName}, current check: ${customField.check}, current dealCheck: ${customField.dealCheck}`
          );

          const updates = {};

          // Update check field if provided (for leads)
          if (
            incomingCol.check !== undefined &&
            customField.check !== !!incomingCol.check
          ) {
            updates.check = !!incomingCol.check;
            console.log(`Will update check field to: ${updates.check}`);
          }

          // Update dealCheck field if provided (for deals)
          if (
            incomingCol.dealCheck !== undefined &&
            customField.dealCheck !== !!incomingCol.dealCheck
          ) {
            updates.dealCheck = !!incomingCol.dealCheck;
            console.log(`Will update dealCheck field to: ${updates.dealCheck}`);
          }

          // Only add to updates if there are changes
          if (Object.keys(updates).length > 0) {
            customFieldUpdates.push({
              fieldId: customField.fieldId,
              updates: updates,
            });
            console.log(
              `Added update for fieldId: ${customField.fieldId}`,
              updates
            );
          } else {
            console.log(`No changes needed for field: ${incomingCol.key}`);
          }
        } else {
          console.log(
            `Custom field not found in database for: ${incomingCol.key}`
          );
        }
      } else {
        console.log(`No custom field mapping found for: ${incomingCol.key}`);
      }
    });

    console.log(
      "Total custom field updates to process:",
      customFieldUpdates.length
    );

    // Perform bulk update of CustomField check and dealCheck values
    // 'check' field affects leads, 'dealCheck' field affects deals
    if (customFieldUpdates.length > 0) {
      console.log("Executing custom field updates...");

      for (const update of customFieldUpdates) {
        console.log(`Updating fieldId ${update.fieldId} with:`, update.updates);

        // First, let's check what record we're trying to update
        const existingRecord = await CustomField.findOne({
          where: { fieldId: update.fieldId },
          attributes: [
            "fieldId",
            "fieldName",
            "masterUserID",
            "fieldSource",
            "check",
            "dealCheck",
          ],
        });

        console.log(
          `Current record for fieldId ${update.fieldId}:`,
          existingRecord ? existingRecord.toJSON() : "NOT FOUND"
        );

        const result = await CustomField.update(update.updates, {
          where: {
            fieldId: update.fieldId,
            // Make the WHERE clause more flexible - either the user owns it OR it's a default/system field
            // [Op.or]: [
            //   { masterUserID: req.adminId },
            //   { fieldSource: "default" },
            //   { fieldSource: "system" },
            //   { fieldSource: "custom" }, // Add custom fields that might belong to this user
            // ],
          },
        });

        console.log(`Update result for fieldId ${update.fieldId}:`, result);

        // If no rows were updated, try a more relaxed update
        if (result[0] === 0) {
          console.log(
            `No rows updated with restrictive WHERE clause, trying more relaxed update...`
          );

          const relaxedResult = await CustomField.update(update.updates, {
            where: {
              fieldId: update.fieldId,
              // Only check fieldId - less restrictive
            },
          });

          console.log(
            `Relaxed update result for fieldId ${update.fieldId}:`,
            relaxedResult
          );
        }
      }

      console.log(
        `Updated ${customFieldUpdates.length} custom field check/dealCheck values`
      );
    } else {
      console.log("No custom field updates to process");
    }

    // Save updated preferences
    pref.columns = prefColumns;
    await pref.save();

    res.status(200).json({
      message: "Deal columns updated",
      columns: pref.columns,
      customFieldsUpdated: customFieldUpdates.length,
      totalColumns: prefColumns.length,
      updatedFields: {
        checkUpdates: customFieldUpdates.filter(
          (u) => u.updates.check !== undefined
        ).length,
        dealCheckUpdates: customFieldUpdates.filter(
          (u) => u.updates.dealCheck !== undefined
        ).length,
      },
    });
  } catch (error) {
    console.error("Error updating deal columns:", error);
    res.status(500).json({ message: "Error updating columns" });
  }
};

exports.markDealAsWon = async (req, res) => {
  const { DealColumn, CustomField, Deal, DealDetail, DealStageHistory, LeadOrganization, ActivitySetting } = req.models;
  try {
    const { dealId } = req.params;
    const masterUserID = req.masterUserID || req.adminId;

    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }

    // Update status to 'won'
    await deal.update({ status: "won" });

    // Update DealDetails: wonTime and dealClosedOn
    const now = new Date();
    let dealDetails = await DealDetail.findOne({ where: { dealId } });
    if (dealDetails) {
      await dealDetails.update({
        wonTime: now,
        dealClosedOn: now,
      });
    } else {
      await DealDetail.create({
        dealId,
        wonTime: now,
        dealClosedOn: now,
      });
    }

    // Add a new entry to DealStageHistory
    await DealStageHistory.create({
      dealId,
      stageName: deal.pipelineStage, // keep current stage
      enteredAt: now,
      note: "Marked as won",
    });

    // --- Update wonDeals count for connected leadOrganizationId ---
    if (deal.leadOrganizationId) {
      const org = await LeadOrganization.findByPk(deal.leadOrganizationId);
      if (org) {
        // Count all deals for this organization with status 'won'
        const wonDealsCount = await Deal.count({
          where: {
            leadOrganizationId: deal.leadOrganizationId,
            status: "won",
          },
        });
        await org.update({ wonDeals: wonDealsCount });
      }
    }

    // --- Fetch Deal Won Activity Settings ---
    let dealWonPopupSettings = {
      showDealWonPopup: true,
      dealWonActivityType: 'Task',
      dealWonFollowUpTime: 'in 3 months',
      allowUserDisableDealWon: true,
    };

    try {
      const settings = await ActivitySetting.findOne({ 
        // where: { masterUserID } 
      });
      
      if (settings) {
        // Use saved settings
        dealWonPopupSettings = {
          showDealWonPopup: settings.showDealWonPopup !== undefined ? settings.showDealWonPopup : true,
          dealWonActivityType: settings.dealWonActivityType || 'Task',
          dealWonFollowUpTime: settings.dealWonFollowUpTime || 'in 3 months',
          allowUserDisableDealWon: settings.allowUserDisableDealWon !== undefined ? settings.allowUserDisableDealWon : true,
        };
      }
    } catch (settingsError) {
      console.log('Error fetching deal won activity settings:', settingsError.message);
      // Continue with default settings
    }

    res.status(200).json({
      message: "Deal marked as won",
      deal,
      dealWonPopupSettings,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.checkDealQuestionSharedStatus = async (req, res) => {
  const { CustomFieldValue, DealColumn, CustomField, Deal, DealDetail, DealStageHistory, LeadOrganization, ActivitySetting } = req.models;
  try {
    const { dealId } = req.params;
    const adminId = req.adminId;
    // Fetch the questionShared custom field value for this deal
    const questionSharedCustomField = await CustomFieldValue.findOne({
      where: {
        entityId: dealId.toString(),
        entityType: "deal",
        // masterUserID: adminId,
      },
      include: [
        {
          model: CustomField,
          as: "CustomField",
          where: {
            isActive: true,
            fieldName: "questioner_shared?"
          },
          required: true,
        },
      ],
    });
    const customFieldQuestionSharedValue = questionSharedCustomField ? questionSharedCustomField.value : null;
    console.log(`[CHECK_QUESTION_SHARED] Custom field questionShared value for deal ${dealId}: ${customFieldQuestionSharedValue}`);
res.status(200).json({
      message: "Question shared status retrieved successfully.",
      questionShared: customFieldQuestionSharedValue
    });
  } catch (error) {
    console.log(error);
 res.status(500).json({ message: "Internal server error" });
  }   
};


exports.markDealAsLost = async (req, res) => {
  const { CustomFieldValue, DealColumn, CustomField, Deal, DealDetail, DealStageHistory, LeadOrganization, ActivitySetting, UserCredential, MasterUser } = req.models;
  try {
    const { dealId } = req.params;
    const { lostReason, questionShared, skipQuestionCheck = false } = req.body; // Accept lostReason, questionShared, and skipQuestionCheck
    const adminId = req.adminId;

    console.log(`[MARK_LOST] Processing deal ${dealId} - skipQuestionCheck: ${skipQuestionCheck}, questionShared: ${questionShared}`);

    // Fetch deal with associated person to get email - no permission restrictions
    const deal = await Deal.findOne({
      where: { dealId },
      include: [
        {
          model: LeadPerson,
          as: "Person",
          attributes: ["contactPerson", "email"],
        },
      ],
    });
    
    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }

    // Check if deal is already lost
    if (deal.status === 'lost') {
      return res.status(400).json({ message: "Deal is already marked as lost." });
    }

    console.log(`[MARK_LOST] Deal found: ${deal.title}`);

    // Step 1: Check if questionShared custom field is already saved and valid
    // Fetch the questionShared custom field value for this deal
    const questionSharedCustomField = await CustomFieldValue.findOne({
      where: {
        entityId: dealId.toString(),
        entityType: "deal",
        // masterUserID: adminId,
      },
      include: [
        {
          model: CustomField,
          as: "CustomField",
          where: { 
            isActive: true,
            fieldName: "questioner_shared?" // Look for custom field named "questionShared"
          },
          required: true,
        },
      ],
    });

    const customFieldQuestionSharedValue = questionSharedCustomField ? questionSharedCustomField.value : null;
    console.log(`[MARK_LOST] Custom field questionShared value: ${customFieldQuestionSharedValue}`);

    const isQuestionSharedSaved = customFieldQuestionSharedValue !== null && 
                                  customFieldQuestionSharedValue !== undefined && 
                                  customFieldQuestionSharedValue !== '';

    // If skipQuestionCheck is true, we're coming from the second call after questionShared was saved
    if (!skipQuestionCheck && !isQuestionSharedSaved) {
      console.log(`[MARK_LOST] Question shared custom field not saved for deal ${dealId}, requesting save first`);
      return res.status(428).json({ 
        message: "Question shared status is required before marking deal as lost.",
        requiresQuestionShared: true,
        dealId: dealId,
        dealTitle: deal.title,
        currentQuestionSharedStatus: customFieldQuestionSharedValue || null,
        action: "save_question_shared_first",
        fieldType: "custom_field"
      });
    }

    // Step 2: If questionShared is provided in this request, update the custom field first
    if (questionShared !== undefined && questionShared !== null) {
      console.log(`[MARK_LOST] Updating questionShared custom field to: ${questionShared}`);
      
      // Find or create the custom field definition first
      const questionSharedField = await CustomField.findOne({
        where: {
          fieldName: "questioner_shared?",
          entityType: "deal",
          // masterUserID: adminId,
          isActive: true
        }
      });

      if (!questionSharedField) {
        return res.status(400).json({
          message: "questionShared custom field not found. Please create the custom field first.",
          fieldName: "questionShared",
          entityType: "deal"
        });
      }

      // Update or create the custom field value
      if (questionSharedCustomField) {
        // Update existing value
        await questionSharedCustomField.update({ value: questionShared.toString() });
      } else {
        // Create new value
        await CustomFieldValue.create({
          entityId: dealId.toString(),
          entityType: "deal",
          masterUserID: adminId,
          fieldId: questionSharedField.fieldId,
          value: questionShared.toString()
        });
      }
      
      // If this was just to save questionShared and we're not ready to mark as lost yet
      if (!skipQuestionCheck) {
        return res.status(200).json({
          message: "Question shared status updated successfully. You can now proceed to mark the deal as lost.",
          dealId: dealId,
          questionSharedUpdated: true,
          newQuestionSharedStatus: questionShared.toString(),
          readyForLostReason: true,
          fieldType: "custom_field"
        });
      }
    }

    // Step 3: Proceed with marking deal as lost
    console.log(`[MARK_LOST] Proceeding to mark deal ${dealId} as lost`);

    await deal.update({ status: "lost" });

    // Update DealDetails: lostTime and lostReason
    const now = new Date();
    let dealDetails = await DealDetail.findOne({ where: { dealId } });
    if (dealDetails) {
      await dealDetails.update({
        lostTime: now,
        lostReason: lostReason || dealDetails.lostReason,
      });
    } else {
      await DealDetail.create({
        dealId,
        lostTime: now,
        lostReason: lostReason || null,
      });
    }

    // Add a new entry to DealStageHistory
    await DealStageHistory.create({
      dealId,
      stageName: deal.pipelineStage, // keep current stage
      enteredAt: now,
      note: "Marked as lost",
    });

    // Step 4: Conditional email sending based on questionShared custom field status
    // Re-fetch the custom field value in case it was just updated
    const updatedQuestionSharedCustomField = await CustomFieldValue.findOne({
      where: {
        entityId: dealId.toString(),
        entityType: "deal",
        // masterUserID: adminId, // Removed to allow global custom field access
      },
      include: [
        {
          model: CustomField,
          as: "CustomField",
          where: { 
            isActive: true,
            fieldName: "questioner_shared?"
          },
          required: true,
        },
      ],
    });

    const finalQuestionSharedValue = updatedQuestionSharedCustomField ? updatedQuestionSharedCustomField.value : null;

    let emailSent = false;
    let emailStatus = {
      hasContactEmail: !!(deal.Person && deal.Person.email),
      hasAdminEmail: false,
      hasCredentials: false,
      hasAppPassword: false,
      questionSharedStatus: finalQuestionSharedValue,
      emailSendingEnabled: false,
      fieldType: "custom_field"
    };

    // Only proceed with email if questionShared is 'yes' or 'true'
    const shouldSendEmail = finalQuestionSharedValue && 
                           (finalQuestionSharedValue.toLowerCase() === 'yes' || 
                            finalQuestionSharedValue.toLowerCase() === 'true' || 
                            finalQuestionSharedValue === true);

    console.log(`[MARK_LOST] Should send email: ${shouldSendEmail} (questionShared custom field: ${finalQuestionSharedValue})`);

    if (shouldSendEmail) {
      // Get admin email for sending feedback request
      const adminUser = await MasterUser.findOne({ 
        where: { masterUserID: adminId },
        attributes: ['email']
      });

      emailStatus.hasAdminEmail = !!(adminUser && adminUser.email);

      // Check if admin user has email credentials configured for sending emails
      let userCredential = null;
      if (adminUser && adminUser.email) {
        userCredential = await UserCredential.findOne({ 
          where: { email: adminUser.email },
          attributes: ['email', 'smtpHost', 'smtpPort', 'appPassword']
        });
      }

      emailStatus.hasCredentials = !!userCredential;
      emailStatus.hasAppPassword = !!(userCredential && userCredential.appPassword);
      emailStatus.emailSendingEnabled = shouldSendEmail;

      // Send feedback request email if all conditions are met
      if (deal.Person && deal.Person.email && adminUser && adminUser.email && userCredential && userCredential.appPassword) {
        const personFirstName = deal.Person.contactPerson || "Valued Client";
        
        const emailSubject = "Request for Feedback on Recent Contract Bid";
        
        const emailBody = `Dear ${personFirstName},

We hope you're well. We recently received the notification that our bid for the contract was unsuccessful. Could you kindly provide feedback on our proposal? Your insights are valuable for us.

Please share your feedback using this link: https://forms.gle/9NYTeVogMHaGeNdj9

Thank you for your consideration.

Best Regards,
Earthood Team`;

        try {
          await sendEmail(adminUser.email, {
            from: adminUser.email,
            to: deal.Person.email,
            subject: emailSubject,
            text: emailBody,
          });
          emailSent = true;
          console.log(`[MARK_LOST] ✅ Feedback request email sent to ${deal.Person.email} for lost deal ${dealId}`);
        } catch (emailError) {
          console.error(`[MARK_LOST] ❌ Failed to send feedback email for deal ${dealId}:`, emailError);
          // Continue with the response even if email fails
        }
      } else {
        // Log specific reasons why email wasn't sent
        if (!deal.Person || !deal.Person.email) {
          console.log(`[MARK_LOST] No contact person email found for deal ${dealId}, skipping feedback email`);
        }
        if (!adminUser || !adminUser.email) {
          console.log(`[MARK_LOST] No admin email found for user ${adminId}, skipping feedback email`);
        }
        if (!userCredential) {
          console.log(`[MARK_LOST] No email credentials found for admin email ${adminUser?.email}, skipping feedback email`);
        }
        if (userCredential && !userCredential.appPassword) {
          console.log(`[MARK_LOST] No app password configured for admin email ${adminUser?.email}, skipping feedback email`);
        }
      }
    } else {
      console.log(`[MARK_LOST] Email not sent because questionShared custom field is '${finalQuestionSharedValue}' (not 'yes')`);
      emailStatus.emailSendingEnabled = false;
    }

    res.status(200).json({ 
      message: "Deal marked as lost", 
      deal: {
        dealId: deal.dealId,
        title: deal.title,
        status: "lost",
        questionSharedCustomField: finalQuestionSharedValue
      },
      emailSent: emailSent,
      emailStatus: emailStatus,
      lostReason: lostReason || null,
      questionSharedBasedEmail: {
        questionSharedStatus: finalQuestionSharedValue,
        emailTriggered: shouldSendEmail,
        emailDelivered: emailSent,
        rule: "Email is only sent when questionShared custom field is 'yes' or 'true'",
        fieldType: "custom_field"
      }
    });
  } catch (error) {
    console.error("[MARK_LOST] Error in markDealAsLost:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update questionShared custom field status for a deal
exports.updateQuestionShared = async (req, res) => {
  try {
    const { dealId } = req.params;
    const { questionShared } = req.body;
    const adminId = req.adminId;
    const { CustomFieldValue, DealColumn, CustomField, Deal, DealDetail, DealStageHistory, LeadOrganization, ActivitySetting, UserCredential } = req.models;

    console.log(`[UPDATE_QUESTION] Updating questionShared custom field for deal ${dealId} to: ${questionShared}`);

    // Validate input
    if (questionShared === undefined || questionShared === null) {
      return res.status(400).json({ 
        message: "questionShared value is required",
        validValues: ["yes", "no", "true", "false"],
        fieldType: "custom_field"
      });
    }

    // Find the deal
    const deal = await Deal.findOne({
      where: { dealId },
      attributes: ['dealId', 'title', 'status', 'masterUserID']
    });

    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }

    // // Check permissions (non-admin users can only update their own deals)
    // if (req.role !== 'admin' && deal.masterUserID !== adminId) {
    //   return res.status(403).json({ 
    //     message: "Access denied. You can only update deals you own." 
    //   });
    // }

    console.log(`[UPDATE_QUESTION] Deal found: ${deal.title}`);

    // Find the questionShared custom field definition
    const questionSharedField = await CustomField.findOne({
      where: {
        fieldName: "questioner_shared?",
        entityType: "lead",
        // masterUserID: adminId,
        isActive: true
      }
    });

    if (!questionSharedField) {
      return res.status(400).json({
        message: "questionShared custom field not found. Please create the custom field first.",
        fieldName: "questionShared",
        entityType: "deal",
        fieldType: "custom_field"
      });
    }

    // Find existing custom field value
    const existingCustomFieldValue = await CustomFieldValue.findOne({
      where: {
        entityId: dealId.toString(),
        entityType: "deal",
        // masterUserID: adminId,
        fieldId: questionSharedField.fieldId
      }
    });

    let previousValue = null;
    if (existingCustomFieldValue) {
      // Update existing value
      previousValue = existingCustomFieldValue.value;
      await existingCustomFieldValue.update({ value: questionShared.toString() });
    } else {
      // Create new value
      await CustomFieldValue.create({
        entityId: dealId.toString(),
        entityType: "deal",
        masterUserID: adminId,
        fieldId: questionSharedField.fieldId,
        value: questionShared.toString()
      });
    }

    console.log(`[UPDATE_QUESTION] ✅ Successfully updated questionShared custom field for deal ${dealId}`);

    res.status(200).json({
      message: "Question shared custom field status updated successfully",
      dealId: dealId,
      dealTitle: deal.title,
      previousQuestionShared: previousValue,
      newQuestionShared: questionShared.toString(),
      canProceedToMarkLost: true,
      emailWillBeSent: questionShared.toString().toLowerCase() === 'yes' || questionShared.toString().toLowerCase() === 'true',
      fieldType: "custom_field",
      customField: {
        fieldId: questionSharedField.fieldId,
        fieldName: questionSharedField.fieldName,
        fieldLabel: questionSharedField.fieldLabel
      }
    });

  } catch (error) {
    console.error("[UPDATE_QUESTION] Error updating questionShared custom field:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      fieldType: "custom_field"
    });
  }
};

exports.markDealAsOpen = async (req, res) => {
  const { CustomFieldValue, DealColumn, CustomField, Deal, DealDetail, DealStageHistory, LeadOrganization, ActivitySetting, UserCredential } = req.models;
  try {
    const { dealId } = req.params;
    const initialStage = "Qualified"; // Set your initial pipeline stage here

    const deal = await Deal.findByPk(dealId);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found." });
    }

    // Update deal status and reset pipelineStage
    await deal.update({ status: "open", pipelineStage: initialStage });

    // Reset closure fields in DealDetails
    let dealDetails = await DealDetail.findOne({ where: { dealId } });
    if (dealDetails) {
      await dealDetails.update({
        wonTime: null,
        lostTime: null,
        dealClosedOn: null,
        lostReason: null,
      });
    }

    // Add a new entry to DealStageHistory to track reopening
    await DealStageHistory.create({
      dealId,
      stageName: initialStage,
      enteredAt: new Date(),
    });

    res.status(200).json({ message: "Deal marked as open", deal });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getDealFieldsForFilter = async (req, res) => {
  const { CustomFieldValue, DealColumn, CustomField, Deal, DealDetail, DealStageHistory, LeadOrganization, ActivitySetting, UserCredential } = req.models;
  try {
    console.log('🔍 [getDealFieldsForFilter] ===== API CALL START =====');
    console.log('🔍 [getDealFieldsForFilter] Request headers:', {
      'x-admin-id': req.headers['x-admin-id'],
      'authorization': req.headers['authorization'] ? 'Present' : 'Missing'
    });
    console.log('🔍 [getDealFieldsForFilter] req.adminId:', req.adminId);
    console.log('🔍 [getDealFieldsForFilter] req.role:', req.role);
    console.log('🔍 [getDealFieldsForFilter] req.user:', req.user ? 'Present' : 'Missing');
    
    // Get all field names from Deal model dynamically
    const dealFields = Object.keys(Deal.rawAttributes);
    console.log('🔍 [getDealFieldsForFilter] Deal model fields count:', dealFields.length);
    console.log('🔍 [getDealFieldsForFilter] First 5 deal fields:', dealFields.slice(0, 5));
    
    // Define field type mapping for Deal model fields
    const fieldTypeMapping = {
      INTEGER: 'number',
      BIGINT: 'number',
      DECIMAL: 'number',
      FLOAT: 'number',
      DOUBLE: 'number',
      STRING: 'text',
      TEXT: 'text',
      DATE: 'date',
      DATEONLY: 'date',
      BOOLEAN: 'boolean',
      JSON: 'json',
      JSONB: 'json',
      ENUM: 'select'
    };

    // Generate fields from Deal model
    const modelFields = dealFields.map(fieldName => {
      const attribute = Deal.rawAttributes[fieldName];
      const dataType = attribute?.type?.constructor?.name || 'STRING';
      const mappedType = fieldTypeMapping[dataType] || 'text';
      
      // Generate label from field name
      const label = fieldName
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();

      return {
        value: fieldName,
        label: label,
        type: mappedType,
        entity: 'deal',
        isCustomField: false
      };
    });

    console.log('🔍 [getDealFieldsForFilter] Model fields generated:', modelFields.length);

    // Fetch ALL custom fields for deals (no user restriction)
    let customFields = [];
    
    console.log('🔍 [getDealFieldsForFilter] ===== CUSTOM FIELDS SECTION =====');
    console.log('🔍 [getDealFieldsForFilter] Fetching ALL custom fields for deal entity (no user filter)');
    console.log('🔍 [getDealFieldsForFilter] CustomField model:', typeof CustomField);
    console.log('🔍 [getDealFieldsForFilter] Op object:', typeof Op);
    
    try {
      // Fetch ALL custom fields for deal and both entity types (no masterUserID filter)
      console.log('🔍 [getDealFieldsForFilter] Fetching deal-specific custom fields...');
      
      customFields = await CustomField.findAll({
        where: {
          [Op.and]: [
            { isActive: true },
            {
              [Op.or]: [
                { entityType: 'deal' },
                { entityType: 'both' }
              ]
            }
          ]
        },
        order: [
          ['category', 'ASC'],
          ['fieldGroup', 'ASC'],
          ['displayOrder', 'ASC'],
          ['fieldLabel', 'ASC']
        ]
      });
      
      console.log('🔍 [getDealFieldsForFilter] Deal-specific query executed successfully');
      console.log('🔍 [getDealFieldsForFilter] Custom fields found (deal/both):', customFields.length);
      
      if (customFields.length > 0) {
        customFields.forEach((field, index) => {
          console.log(`🔍 [getDealFieldsForFilter]   ${index + 1}. ${field.fieldName} (${field.entityType}, UserID: ${field.masterUserID}) - ${field.fieldLabel}`);
        });
      } else {
        console.log('🔍 [getDealFieldsForFilter] No deal-specific custom fields found');
        
        // Debug: Check all entity types in the system
        const allFields = await CustomField.findAll({
          where: { isActive: true },
          attributes: ['entityType'],
          group: ['entityType']
        });
        console.log('🔍 [getDealFieldsForFilter] Available entity types in system:', allFields.map(f => f.entityType));
      }
      
    } catch (customFieldError) {
      console.error("🔍 [getDealFieldsForFilter] Error fetching custom fields:", customFieldError);
      console.error("🔍 [getDealFieldsForFilter] Error stack:", customFieldError.stack);
      customFields = [];
    }

    console.log('🔍 [getDealFieldsForFilter] ===== FORMATTING SECTION =====');

    // Format custom fields
    const customFieldsFormatted = customFields.map(field => ({
      value: field.fieldName,
      label: field.fieldLabel,
      type: field.fieldType,
      entity: 'deal',
      isCustomField: true,
      fieldId: field.fieldId,
      category: field.category,
      fieldGroup: field.fieldGroup,
      isRequired: field.isRequired,
      isImportant: field.isImportant,
      options: field.options
    }));

    console.log('🔍 [getDealFieldsForFilter] Custom fields formatted:', customFieldsFormatted.length);

    // Combine model fields and custom fields
    const allFields = [...modelFields, ...customFieldsFormatted];
    console.log('🔍 [getDealFieldsForFilter] All fields combined:', allFields.length);

    // Remove duplicates and sort
    const uniqueFields = [];
    const seenValues = new Set();

    allFields.forEach(field => {
      if (!seenValues.has(field.value)) {
        seenValues.add(field.value);
        uniqueFields.push(field);
      }
    });

    // Sort fields: basic fields first, then custom fields
    const sortedFields = uniqueFields.sort((a, b) => {
      if (a.isCustomField !== b.isCustomField) {
        return a.isCustomField ? 1 : -1;
      }
      return a.label.localeCompare(b.label);
    });

    console.log('🔍 [getDealFieldsForFilter] ===== FINAL RESULTS =====');
    console.log('🔍 [getDealFieldsForFilter] Final sorted fields:', sortedFields.length);
    console.log('🔍 [getDealFieldsForFilter] Standard fields:', sortedFields.filter(f => !f.isCustomField).length);
    console.log('🔍 [getDealFieldsForFilter] Custom fields in response:', sortedFields.filter(f => f.isCustomField).length);

    const response = {
      fields: sortedFields,
      totalFields: sortedFields.length,
      standardFields: modelFields.length,
      customFields: customFields.length,
      metadata: {
        entityType: 'deal',
        dynamicallyGenerated: true,
        includesCustomFields: customFields.length > 0,
        debugInfo: {
          adminId: 'Not required - fetching all custom fields',
          originalCustomFieldsCount: customFields.length,
          formattedCustomFieldsCount: customFieldsFormatted.length,
          finalCustomFieldsInResponse: sortedFields.filter(f => f.isCustomField).length
        }
      }
    };
    
    console.log('🔍 [getDealFieldsForFilter] Response summary:', {
      totalFields: response.totalFields,
      standardFields: response.standardFields,
      customFields: response.customFields,
      metadata: response.metadata
    });

    console.log('🔍 [getDealFieldsForFilter] ===== API CALL END =====');
    res.status(200).json(response);
  } catch (error) {
    console.error("🔍 [getDealFieldsForFilter] FATAL ERROR:", error);
    console.error("🔍 [getDealFieldsForFilter] Error stack:", error.stack);
    res.status(500).json({ 
      message: "Internal server error",
      error: error.message 
    });
  }
};

// Bulk edit deals functionality
exports.bulkEditDeals = async (req, res) => {
  const { CustomFieldValue, DealColumn, CustomField, Deal, DealDetail, DealStageHistory, LeadOrganization, ActivitySetting, UserCredential, LeadPerson, MasterUser, AuditTrail, History } = req.models;
  const { dealIds, updateData } = req.body;

  // Validate input
  if (!dealIds || !Array.isArray(dealIds) || dealIds.length === 0) {
    return res.status(400).json({
      message: "dealIds must be a non-empty array",
    });
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    return res.status(400).json({
      message: "updateData must contain at least one field to update",
    });
  }

  // Check for potential duplicate issues when updating multiple deals with same values
  if (dealIds.length > 1) {
    const duplicateChecks = [];

    // Check title uniqueness if updating title
    if (updateData.title) {
      const existingTitleCount = await Deal.count({
        where: {
          title: updateData.title,
          dealId: { [Op.notIn]: dealIds },
        },
      });

      if (existingTitleCount > 0) {
        duplicateChecks.push({
          field: "title",
          value: updateData.title,
          message: "Title already exists for another deal",
        });
      }
    }

    // Check other unique fields if they exist (add more as needed)
    if (updateData.esplProposalNo) {
      const existingProposalCount = await Deal.count({
        where: {
          esplProposalNo: updateData.esplProposalNo,
          dealId: { [Op.notIn]: dealIds },
        },
      });

      if (existingProposalCount > 0) {
        duplicateChecks.push({
          field: "esplProposalNo",
          value: updateData.esplProposalNo,
          message: "ESPL Proposal Number already exists for another deal",
        });
      }
    }

    // If we found duplicate issues, return error
    if (duplicateChecks.length > 0) {
      return res.status(400).json({
        message:
          "Cannot update multiple deals due to duplicate value constraints",
        duplicateIssues: duplicateChecks,
        suggestion:
          "Please ensure unique values for fields that require uniqueness, or update deals individually",
      });
    }
  }

  console.log("Bulk edit deals request:", { dealIds, updateData });

  try {
    // Check access permissions
    if (!["admin", "general", "master"].includes(req.role)) {
      await logAuditTrail(
        AuditTrail,
        getProgramId("DEALS"),
        "BULK_DEAL_UPDATE",
        null,
        "Access denied. You do not have permission to bulk edit deals.",
        req.adminId
      );
      return res.status(403).json({
        message:
          "Access denied. You do not have permission to bulk edit deals.",
      });
    }

    // Get all columns for different models
    const dealFields = Object.keys(Deal.rawAttributes);
    const dealDetailsFields = Object.keys(DealDetail.rawAttributes);
    const personFields = Object.keys(LeadPerson.rawAttributes);
    const organizationFields = Object.keys(LeadOrganization.rawAttributes);

    // Split the update data by model
    const dealData = {};
    const dealDetailsData = {};
    const personData = {};
    const organizationData = {};
    const customFields = {};

    for (const key in updateData) {
      if (dealFields.includes(key)) {
        dealData[key] = updateData[key];
      } else if (personFields.includes(key)) {
        personData[key] = updateData[key];
      } else if (organizationFields.includes(key)) {
        organizationData[key] = updateData[key];
      } else if (dealDetailsFields.includes(key)) {
        dealDetailsData[key] = updateData[key];
      } else {
        // Treat as custom field
        customFields[key] = updateData[key];
      }
    }

    console.log("Processed update data:", {
      dealData,
      dealDetailsData,
      personData,
      organizationData,
      customFields,
    });

    // Find deals to update
    let whereClause = { dealId: { [Op.in]: dealIds } };

    // Apply role-based filtering
    if (req.role !== "admin") {
      whereClause[Op.or] = [
        { masterUserID: req.adminId },
        { ownerId: req.adminId },
      ];
    }

    const dealsToUpdate = await Deal.findAll({
      where: whereClause,
      include: [
        {
          model: DealDetail,
          as: "details",
          required: false,
        },
        {
          model: LeadPerson,
          as: "Person",
          required: false,
        },
        {
          model: LeadOrganization,
          as: "Organization",
          required: false,
        },
      ],
    });

    if (dealsToUpdate.length === 0) {
      return res.status(404).json({
        message:
          "No deals found to update or you don't have permission to edit them",
      });
    }

    console.log(`Found ${dealsToUpdate.length} deals to update`);

    const updateResults = {
      successful: [],
      failed: [],
      skipped: [],
    };

    // Process each deal
    for (const deal of dealsToUpdate) {
      try {
        console.log(`Processing deal ${deal.dealId}`);

        // Track if owner is being changed
        let ownerChanged = false;
        let newOwner = null;
        if (updateData.ownerId && updateData.ownerId !== deal.ownerId) {
          ownerChanged = true;
          newOwner = await MasterUser.findByPk(updateData.ownerId);
        }

        // Check if pipelineStage is changing and create stage history
        if (
          dealData.pipelineStage &&
          dealData.pipelineStage !== deal.pipelineStage
        ) {
          await DealStageHistory.create({
            dealId: deal.dealId,
            stageName: dealData.pipelineStage,
            enteredAt: new Date(),
          });
        }

        // Update Deal table
        if (Object.keys(dealData).length > 0) {
          try {
            await deal.update(dealData);
            console.log(`Updated deal ${deal.dealId} with:`, dealData);
          } catch (updateError) {
            // Handle specific database constraint errors
            if (
              updateError.name === "SequelizeUniqueConstraintError" ||
              updateError.original?.code === "ER_DUP_ENTRY"
            ) {
              let constraintField = "unknown";
              let duplicateValue = "unknown";

              // Extract field name and value from error message
              if (updateError.original?.sqlMessage) {
                const match = updateError.original.sqlMessage.match(
                  /Duplicate entry '(.+?)' for key '(.+?)'/
                );
                if (match) {
                  duplicateValue = match[1];
                  constraintField = match[2];
                }
              }

              throw new Error(
                `Duplicate ${constraintField}: '${duplicateValue}' already exists. Please use a unique value.`
              );
            }

            // Handle other constraint violations
            if (updateError.name === "SequelizeValidationError") {
              const validationErrors = updateError.errors
                .map((err) => err.message)
                .join(", ");
              throw new Error(`Validation error: ${validationErrors}`);
            }

            if (updateError.name === "SequelizeForeignKeyConstraintError") {
              throw new Error(
                `Foreign key constraint error: Invalid reference to related data.`
              );
            }

            // Re-throw original error if not a known constraint error
            throw updateError;
          }
        }

        // Update DealDetails table
        if (Object.keys(dealDetailsData).length > 0) {
          try {
            let dealDetails = await DealDetail.findOne({
              where: { dealId: deal.dealId },
            });

            if (dealDetails) {
              await dealDetails.update(dealDetailsData);
            } else {
              await DealDetail.create({
                dealId: deal.dealId,
                ...dealDetailsData,
              });
            }
            console.log(
              `Updated deal details for ${deal.dealId}:`,
              dealDetailsData
            );
          } catch (detailsError) {
            // Handle specific database constraint errors for DealDetails
            if (
              detailsError.name === "SequelizeUniqueConstraintError" ||
              detailsError.original?.code === "ER_DUP_ENTRY"
            ) {
              let constraintField = "unknown";
              let duplicateValue = "unknown";

              if (detailsError.original?.sqlMessage) {
                const match = detailsError.original.sqlMessage.match(
                  /Duplicate entry '(.+?)' for key '(.+?)'/
                );
                if (match) {
                  duplicateValue = match[1];
                  constraintField = match[2];
                }
              }

              throw new Error(
                `Duplicate ${constraintField} in deal details: '${duplicateValue}' already exists.`
              );
            }

            if (detailsError.name === "SequelizeValidationError") {
              const validationErrors = detailsError.errors
                .map((err) => err.message)
                .join(", ");
              throw new Error(
                `Deal details validation error: ${validationErrors}`
              );
            }

            throw detailsError;
          }
        }

        // Update Person table
        if (Object.keys(personData).length > 0 && deal.personId) {
          try {
            const person = await LeadPerson.findByPk(deal.personId);
            if (person) {
              await person.update(personData);
              console.log(`Updated person ${deal.personId}:`, personData);
            }
          } catch (personError) {
            if (
              personError.name === "SequelizeUniqueConstraintError" ||
              personError.original?.code === "ER_DUP_ENTRY"
            ) {
              let constraintField = "unknown";
              let duplicateValue = "unknown";

              if (personError.original?.sqlMessage) {
                const match = personError.original.sqlMessage.match(
                  /Duplicate entry '(.+?)' for key '(.+?)'/
                );
                if (match) {
                  duplicateValue = match[1];
                  constraintField = match[2];
                }
              }

              throw new Error(
                `Duplicate ${constraintField} in person data: '${duplicateValue}' already exists.`
              );
            }

            throw personError;
          }
        }

        // Update Organization table
        if (
          Object.keys(organizationData).length > 0 &&
          deal.leadOrganizationId
        ) {
          try {
            const organization = await LeadOrganization.findByPk(
              deal.leadOrganizationId
            );
            if (organization) {
              await organization.update(organizationData);
              console.log(
                `Updated organization ${deal.leadOrganizationId}:`,
                organizationData
              );
            }
          } catch (orgError) {
            if (
              orgError.name === "SequelizeUniqueConstraintError" ||
              orgError.original?.code === "ER_DUP_ENTRY"
            ) {
              let constraintField = "unknown";
              let duplicateValue = "unknown";

              if (orgError.original?.sqlMessage) {
                const match = orgError.original.sqlMessage.match(
                  /Duplicate entry '(.+?)' for key '(.+?)'/
                );
                if (match) {
                  duplicateValue = match[1];
                  constraintField = match[2];
                }
              }

              throw new Error(
                `Duplicate ${constraintField} in organization data: '${duplicateValue}' already exists.`
              );
            }

            throw orgError;
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
                  entityType: { [Op.in]: ["deal", "both", "lead"] },
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
                    entityType: { [Op.in]: ["deal", "both", "lead"] },
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
                    entityId: deal.dealId,
                    entityType: "deal",
                  },
                });

                if (existingValue) {
                  await existingValue.update({ value: value });
                } else {
                  await CustomFieldValue.create({
                    fieldId: customField.fieldId,
                    entityId: deal.dealId,
                    entityType: "deal",
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
                `Error updating custom field ${fieldKey} for deal ${deal.dealId}:`,
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
                subject: "You have been assigned a new deal",
                text: `Hello ${newOwner.name},\n\nYou have been assigned a new deal: "${deal.title}" by ${assigner.name}.\n\nPlease check your CRM dashboard for details.`,
              });
            }
          } catch (emailError) {
            console.error(
              `Error sending email notification for deal ${deal.dealId}:`,
              emailError
            );
          }
        }

        // Log audit trail for successful update
        await historyLogger(
          History,
          getProgramId("DEALS"),
          "BULK_DEAL_UPDATE",
          req.adminId,
          deal.dealId,
          null,
          `Deal bulk updated by ${req.role}`,
          { updateData }
        );

        updateResults.successful.push({
          dealId: deal.dealId,
          title: deal.title,
          value: deal.value,
          pipelineStage: deal.pipelineStage,
          customFields: savedCustomFields,
        });
      } catch (dealError) {
        console.error(`Error updating deal ${deal.dealId}:`, dealError);

        // Create more detailed error message
        let errorMessage = dealError.message;
        let errorType = "general";

        if (
          dealError.name === "SequelizeUniqueConstraintError" ||
          dealError.original?.code === "ER_DUP_ENTRY"
        ) {
          errorType = "duplicate";
        } else if (dealError.name === "SequelizeValidationError") {
          errorType = "validation";
        } else if (dealError.name === "SequelizeForeignKeyConstraintError") {
          errorType = "foreign_key";
        }

        await logAuditTrail(
          AuditTrail,
          getProgramId("DEALS"),
          "BULK_DEAL_UPDATE",
          req.adminId,
          `Error updating deal ${deal.dealId}: ${errorMessage}`,
          req.adminId
        );

        updateResults.failed.push({
          dealId: deal.dealId,
          title: deal.title || `Deal ${deal.dealId}`,
          error: errorMessage,
          errorType: errorType,
          errorCode: dealError.original?.code || dealError.name,
        });
      }
    }

    // Check for deals that were requested but not found
    const foundDealIds = dealsToUpdate.map((deal) => deal.dealId);
    const notFoundDealIds = dealIds.filter((id) => !foundDealIds.includes(id));

    notFoundDealIds.forEach((dealId) => {
      updateResults.skipped.push({
        dealId: dealId,
        reason: "Deal not found or no permission to edit",
      });
    });

    console.log("Bulk update results:", updateResults);

    res.status(200).json({
      message: "Bulk edit operation completed",
      results: updateResults,
      summary: {
        total: dealIds.length,
        successful: updateResults.successful.length,
        failed: updateResults.failed.length,
        skipped: updateResults.skipped.length,
        hasErrors: updateResults.failed.length > 0,
        errorBreakdown: {
          duplicateErrors: updateResults.failed.filter(
            (f) => f.errorType === "duplicate"
          ).length,
          validationErrors: updateResults.failed.filter(
            (f) => f.errorType === "validation"
          ).length,
          foreignKeyErrors: updateResults.failed.filter(
            (f) => f.errorType === "foreign_key"
          ).length,
          generalErrors: updateResults.failed.filter(
            (f) => f.errorType === "general"
          ).length,
        },
      },
      recommendations:
        updateResults.failed.length > 0
          ? [
              "Check for duplicate values in fields that require uniqueness",
              "Ensure all required fields are provided",
              "Verify that referenced IDs exist in the system",
              "Consider updating deals individually if bulk update continues to fail",
            ]
          : null,
    });
  } catch (error) {
    console.error("Error in bulk edit deals:", error);

    await logAuditTrail(
      AuditTrail,
      getProgramId("DEALS"),
      "BULK_DEAL_UPDATE",
      null,
      "Error in bulk edit deals: " + error.message,
      req.adminId
    );

    res.status(500).json({
      message: "Internal server error during bulk edit",
      error: error.message,
    });
  }
};

// ================ DUPLICATE DEAL FUNCTIONALITY ================

/**
 * Duplicate an existing deal with all its custom field values
 * POST /api/deals/duplicate/:dealId
 */
exports.duplicateDeal = async (req, res) => {
  const { CustomFieldValue, DealColumn, CustomField, Deal, DealDetail, DealStageHistory, LeadOrganization, ActivitySetting, UserCredential, LeadPerson, MasterUser, AuditTrail, History, Pipeline, PipelineStage } = req.models;
  const { dealId } = req.params;
  const masterUserID = req.adminId;
  const entityType = "deal";

  if (!dealId) {
    return res.status(400).json({
      message: "Deal ID is required.",
    });
  }

  try {
    console.log(`[DUPLICATE] Starting duplication of deal ${dealId} for user ${masterUserID} with role ${req.role}`);
    
    // Debug: Check if deal exists at all
    const dealExists = await Deal.findOne({
      where: { dealId: dealId },
      attributes: ['dealId', 'title', 'masterUserID']
    });
    
    if (!dealExists) {
      console.log(`[DUPLICATE] ❌ Deal ${dealId} does not exist in database`);
      return res.status(404).json({
        message: `Deal with ID ${dealId} not found.`,
      });
    }
    
    console.log(`[DUPLICATE] 🔍 Deal ${dealId} exists: "${dealExists.title}" (Owner: ${dealExists.masterUserID})`);

    // Start a transaction
    const transaction = await clientConnection.transaction();

    try {
      // 1. Get the original deal with admin permission check and pipeline data
      let whereCondition = { dealId: dealId };
      
      // If user is not admin, restrict to their own deals only
      if (req.role !== 'admin') {
        whereCondition.masterUserID = masterUserID;
      }
      
      const originalDeal = await Deal.findOne({
        where: whereCondition,
        include: [
          {
            model: Pipeline,
            as: "pipelineData",
            attributes: ["pipelineId", "pipelineName", "description", "color", "isDefault"],
            required: false
          },
          {
            model: PipelineStage,
            as: "stageData",
            attributes: ["stageId", "stageName", "stageOrder", "probability", "dealRottenDays", "color"],
            required: false
          }
        ],
        transaction
      });

      if (!originalDeal) {
        await transaction.rollback();
        return res.status(404).json({
          message: "Deal not found or you don't have permission to access it.",
        });
      }

      console.log(`[DUPLICATE] Original deal found: ${originalDeal.title} (Owner: ${originalDeal.masterUserID}, Requester: ${masterUserID}, Role: ${req.role})`);
      
      // Log admin access if applicable
      if (req.role === 'admin' && originalDeal.masterUserID !== masterUserID) {
        console.log(`[DUPLICATE] Admin ${masterUserID} duplicating deal owned by user ${originalDeal.masterUserID}`);
      }

      console.log(`[DUPLICATE] Original deal found: ${originalDeal.title}`);

      // 2. Prepare data for the new deal (exclude unique fields)
      const originalData = originalDeal.toJSON();
      const {
        dealId: _dealId,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        ...duplicateData
      } = originalData;

      // 3. Generate unique title with "Copy of" prefix
      let newTitle = `Copy of ${originalDeal.title}`;
      
      // Check if a deal with this title already exists and add counter if needed
      let counter = 1;
      let titleExists = await Deal.findOne({
        where: { title: newTitle, masterUserID },
        transaction
      });

      while (titleExists) {
        counter++;
        newTitle = `Copy of ${originalDeal.title} (${counter})`;
        titleExists = await Deal.findOne({
          where: { title: newTitle, masterUserID },
          transaction
        });
      }

      duplicateData.title = newTitle;
      duplicateData.masterUserID = masterUserID;

      console.log(`[DUPLICATE] New deal title: ${newTitle}`);
      console.log(`[DUPLICATE] Pipeline: ${duplicateData.pipeline || 'None'} (ID: ${duplicateData.pipelineId || 'None'})`);
      console.log(`[DUPLICATE] Stage: ${duplicateData.pipelineStage || 'None'} (ID: ${duplicateData.stageId || 'None'})`);

      // 4. Create the duplicate deal
      const newDeal = await Deal.create(duplicateData, { transaction });
      console.log(`[DUPLICATE] New deal created with ID: ${newDeal.dealId}`);

      // 5. Get all custom field values from the original deal
      const originalCustomFieldValues = await CustomFieldValue.findAll({
        where: {
          entityId: dealId.toString(),
          entityType: entityType,
          masterUserID: masterUserID,
        },
        include: [
          {
            model: CustomField,
            as: "CustomField",
            attributes: ["fieldName", "fieldLabel", "fieldType"],
          },
        ],
        transaction
      });

      console.log(`[DUPLICATE] Found ${originalCustomFieldValues.length} custom field values to copy`);

      // 6. Duplicate all custom field values
      const duplicatedCustomFieldValues = [];
      
      for (const originalValue of originalCustomFieldValues) {
        const duplicatedValue = await CustomFieldValue.create({
          fieldId: originalValue.fieldId,
          entityId: newDeal.dealId.toString(),
          entityType: entityType,
          value: originalValue.value,
          masterUserID: masterUserID,
        }, { transaction });

        duplicatedCustomFieldValues.push({
          fieldId: duplicatedValue.fieldId,
          fieldName: originalValue.CustomField?.fieldName || 'unknown',
          fieldLabel: originalValue.CustomField?.fieldLabel || 'Unknown Field',
          fieldType: originalValue.CustomField?.fieldType || 'text',
          value: duplicatedValue.value,
        });
      }

      console.log(`[DUPLICATE] Successfully duplicated ${duplicatedCustomFieldValues.length} custom field values`);

      // Note: We don't copy DealStageHistory as it's historical data
      // The new deal should start fresh in its current stage without copying the stage progression history
      // If needed, a new DealStageHistory entry will be created when the deal moves through stages

      // 7. Log audit trail (if available)
      try {
        const { logAuditTrail } = require("../../utils/auditTrailLogger");
        const PROGRAMS = require("../../utils/programConstants");
        
        await logAuditTrail(
          AuditTrail,
          masterUserID,
          PROGRAMS.DEAL_MANAGEMENT || "DEAL_MANAGEMENT",
          `Duplicated deal: "${originalDeal.title}" → "${newTitle}"`,
          "create",
          "Deal",
          newDeal.dealId.toString(),
          null,
          transaction
        );
      } catch (auditError) {
        console.log(`[DUPLICATE] Audit logging not available: ${auditError.message}`);
      }

      // 8. Log history (if available)
      try {
        const historyLogger = require("../../utils/historyLogger").logHistory;
        
        await historyLogger(
          History,
          "Deal",
          "create",
          newDeal.dealId,
          masterUserID,
          `Deal duplicated from "${originalDeal.title}"`,
          null,
          duplicateData,
          transaction
        );
      } catch (historyError) {
        console.log(`[DUPLICATE] History logging not available: ${historyError.message}`);
      }

      // Commit the transaction
      await transaction.commit();

      console.log(`[DUPLICATE] ✅ Successfully duplicated deal ${dealId} → ${newDeal.dealId}`);

      // 9. Prepare pipeline and stage information for response
      const pipelineInfo = originalDeal.pipelineData ? {
        pipelineId: originalDeal.pipelineData.pipelineId,
        pipelineName: originalDeal.pipelineData.pipelineName,
        description: originalDeal.pipelineData.description,
        color: originalDeal.pipelineData.color,
        isDefault: originalDeal.pipelineData.isDefault
      } : null;

      const stageInfo = originalDeal.stageData ? {
        stageId: originalDeal.stageData.stageId,
        stageName: originalDeal.stageData.stageName,
        stageOrder: originalDeal.stageData.stageOrder,
        probability: originalDeal.stageData.probability,
        dealRottenDays: originalDeal.stageData.dealRottenDays,
        color: originalDeal.stageData.color
      } : null;

      // 10. Return the new deal with its custom field values and pipeline data
      res.status(201).json({
        message: `Deal "${originalDeal.title}" duplicated successfully as "${newTitle}"`,
        originalDeal: {
          dealId: originalDeal.dealId,
          title: originalDeal.title,
          pipeline: originalDeal.pipeline,
          pipelineStage: originalDeal.pipelineStage,
          pipelineId: originalDeal.pipelineId,
          stageId: originalDeal.stageId
        },
        newDeal: {
          dealId: newDeal.dealId,
          title: newDeal.title,
          value: newDeal.value,
          currency: newDeal.currency,
          pipeline: newDeal.pipeline,
          pipelineStage: newDeal.pipelineStage,
          pipelineId: newDeal.pipelineId,
          stageId: newDeal.stageId,
          expectedCloseDate: newDeal.expectedCloseDate,
          status: newDeal.status,
          createdAt: newDeal.createdAt,
        },
        pipelineData: pipelineInfo,
        stageData: stageInfo,
        duplicatedFields: duplicatedCustomFieldValues,
        summary: {
          totalCustomFields: duplicatedCustomFieldValues.length,
          duplicationTime: new Date().toISOString(),
          pipelineIncluded: !!pipelineInfo,
          stageIncluded: !!stageInfo,
          pipelineDetails: pipelineInfo ? {
            name: pipelineInfo.pipelineName,
            isDefault: pipelineInfo.isDefault
          } : "No pipeline associated",
          stageDetails: stageInfo ? {
            name: stageInfo.stageName,
            order: stageInfo.stageOrder,
            probability: `${stageInfo.probability}%`
          } : "No stage associated"
        },
      });

    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error(`[DUPLICATE] ❌ Error duplicating deal ${dealId}:`, error);
    res.status(500).json({
      message: "Failed to duplicate deal.",
      error: error.message,
      dealId: dealId,
    });
  }
};

/**
 * Batch duplicate multiple deals
 * POST /api/deals/duplicate-batch
 */
exports.duplicateDealsInBatch = async (req, res) => {
  const { CustomFieldValue, DealColumn, CustomField, Deal, DealDetail, DealStageHistory, LeadOrganization, ActivitySetting, UserCredential, LeadPerson, MasterUser, AuditTrail, History, Pipeline, PipelineStage } = req.models;
  const { dealIds } = req.body;
  const masterUserID = req.adminId;

  if (!dealIds || !Array.isArray(dealIds) || dealIds.length === 0) {
    return res.status(400).json({
      message: "Array of deal IDs is required.",
      example: { dealIds: [1, 2, 3] }
    });
  }

  if (dealIds.length > 10) {
    return res.status(400).json({
      message: "Maximum 10 deals can be duplicated at once.",
    });
  }

  try {
    console.log(`[BATCH-DUPLICATE] Starting batch duplication of ${dealIds.length} deals for user ${masterUserID}`);

    const results = {
      successful: [],
      failed: [],
      summary: {
        total: dealIds.length,
        successCount: 0,
        failCount: 0,
      }
    };

    // Process each deal individually to avoid transaction conflicts
    for (const dealId of dealIds) {
      try {
        // Create a mock request/response for the single duplicate function
        const mockReq = { params: { dealId }, adminId: masterUserID, role: req.role };
        let duplicateResult = null;
        
        const mockRes = {
          status: (code) => ({
            json: (data) => {
              duplicateResult = { statusCode: code, data };
              return mockRes;
            }
          })
        };

        // Call the single duplicate function
        await exports.duplicateDeal(mockReq, mockRes);

        if (duplicateResult && duplicateResult.statusCode === 201) {
          results.successful.push({
            originalDealId: dealId,
            newDeal: duplicateResult.data.newDeal,
            customFieldsCount: duplicateResult.data.duplicatedFields.length,
          });
          results.summary.successCount++;
        } else {
          results.failed.push({
            dealId: dealId,
            error: duplicateResult?.data?.message || "Unknown error",
          });
          results.summary.failCount++;
        }

      } catch (dealError) {
        console.error(`[BATCH-DUPLICATE] Error duplicating deal ${dealId}:`, dealError.message);
        results.failed.push({
          dealId: dealId,
          error: dealError.message,
        });
        results.summary.failCount++;
      }
    }

    console.log(`[BATCH-DUPLICATE] ✅ Batch duplication completed: ${results.summary.successCount} successful, ${results.summary.failCount} failed`);

    const statusCode = results.summary.successCount > 0 ? 200 : 400;
    
    res.status(statusCode).json({
      message: `Batch duplication completed. ${results.summary.successCount} deals duplicated successfully, ${results.summary.failCount} failed.`,
      results: results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error(`[BATCH-DUPLICATE] ❌ Batch duplication error:`, error);
    res.status(500).json({
      message: "Failed to duplicate deals in batch.",
      error: error.message,
    });
  }
};

// Bulk disconnect deals from leads
exports.bulkConvertDealsToLeads = async (req, res) => {
  const { CustomFieldValue, DealColumn, CustomField, Deal, DealDetail, DealStageHistory, LeadOrganization, ActivitySetting, UserCredential, LeadPerson, MasterUser, AuditTrail, History, Pipeline, PipelineStage, Lead } = req.models;

  // Get the client connection from request (attached by middleware)
  const clientConnection = req.clientConnection;
  
  if (!clientConnection) {
    return res.status(500).json({
      message: "No database connection available. Please login again.",
    });
  }

  let transaction;
  
  try {
    const { dealIds } = req.body;
    const userId = req.user?.id || req.adminId;
    
    // Validation
    if (!dealIds || !Array.isArray(dealIds) || dealIds.length === 0) {
      return res.status(400).json({
        message: "dealIds array is required and cannot be empty",
        success: false
      });
    }

    if (dealIds.length > 100) {
      return res.status(400).json({
        message: "Maximum 100 deals can be disconnected at once",
        success: false
      });
    }

    console.log(`[BULK-DISCONNECT] 🔄 Starting bulk disconnection for ${dealIds.length} deals by user ${userId}`);

    // Start database transaction
    transaction = await clientConnection.transaction();

    const results = {
      summary: {
        totalRequested: dealIds.length,
        successCount: 0,
        failCount: 0,
        skippedCount: 0
      },
      success: [],
      failed: [],
      skipped: []
    };

    // Process each deal
    for (const dealId of dealIds) {
      try {
        console.log(`[BULK-DISCONNECT] 📊 Processing deal ${dealId}`);

        // 1. Fetch the deal
        const deal = await Deal.findOne({
          where: { dealId },
          transaction
        });

        if (!deal) {
          console.log(`[BULK-DISCONNECT] ⚠️ Deal ${dealId} not found`);
          results.failed.push({
            dealId,
            error: 'Deal not found'
          });
          results.summary.failCount++;
          continue;
        }

        // 2. Check if deal has an associated lead
        if (deal.leadId) {
          console.log(`[BULK-DISCONNECT] 🔄 Deal ${dealId} is linked to lead ${deal.leadId}, disconnecting...`);
          
          // Remove dealId from the lead record
          await Lead.update(
            { dealId: null },
            { 
              where: { leadId: deal.leadId },
              transaction 
            }
          );
          
          // Store the original leadId for response
          const originalLeadId = deal.leadId;
          
          // Remove leadId from the deal record and set conversion flags
          await deal.update({
            leadId: null,
            isConvertedToLead: true,
            convertedToLeadAt: new Date(),
            convertedToLeadBy: userId
          }, { transaction });
          
          console.log(`[BULK-DISCONNECT] ✅ Successfully disconnected deal ${dealId} from lead ${originalLeadId} and marked as converted to lead`);

          // Log audit trail
          try {
            await logAuditTrail({
              AuditTrail,
              action: "DEAL_DISCONNECTED_FROM_LEAD",
              entity: "Deal",
              entityId: dealId,
              changes: {
                previousLeadId: originalLeadId,
                disconnectedBy: userId,
                isConvertedToLead: true,
                convertedToLeadAt: new Date()
              },
              userId: userId,
              ipAddress: req.ip,
              userAgent: req.get("User-Agent")
            });
          } catch (auditError) {
            console.log(`[BULK-DISCONNECT] Audit logging failed: ${auditError.message}`);
          }

          // Log history
          try {
            await historyLogger(History, "Deal", dealId, "disconnected from lead and converted to lead", {
              previousLeadId: originalLeadId,
              disconnectedBy: userId,
              isConvertedToLead: true,
              convertedToLeadAt: new Date()
            }, userId);
          } catch (historyError) {
            console.log(`[BULK-DISCONNECT] History logging failed: ${historyError.message}`);
          }

          results.success.push({
            dealId,
            previousLeadId: originalLeadId,
            action: 'disconnected',
            isConvertedToLead: true,
            convertedToLeadAt: new Date(),
            convertedToLeadBy: userId
          });
          results.summary.successCount++;

        } else {
          console.log(`[BULK-DISCONNECT] ⚠️ Deal ${dealId} is not linked to any lead, skipping`);
          results.skipped.push({
            dealId,
            reason: 'Deal is not linked to any lead'
          });
          results.summary.skippedCount++;
        }

      } catch (dealError) {
        console.error(`[BULK-DISCONNECT] ❌ Failed to disconnect deal ${dealId}:`, dealError);
        results.failed.push({
          dealId,
          error: dealError.message
        });
        results.summary.failCount++;
      }
    }

    // Commit transaction
    await transaction.commit();

    console.log(`[BULK-DISCONNECT] ✅ Bulk conversion completed: ${results.summary.successCount} successful, ${results.summary.failCount} failed, ${results.summary.skippedCount} skipped`);

    const statusCode = results.summary.successCount > 0 ? 200 : 400;
    
    res.status(statusCode).json({
      message: `Bulk conversion completed. ${results.summary.successCount} deals converted to leads successfully, ${results.summary.failCount} failed, ${results.summary.skippedCount} skipped.`,
      success: true,
      results: results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    // Rollback transaction on error
    if (transaction) {
      await transaction.rollback();
    }
    
    console.error(`[BULK-DISCONNECT] ❌ Bulk conversion error:`, error);
    res.status(500).json({
      message: "Failed to convert deals to leads in bulk.",
      success: false,
      error: error.message,
    });
  }
};

// Reset conversion flag for a deal (for testing/admin purposes)
exports.resetDealConversionFlag = async (req, res) => {
  const { CustomFieldValue, DealColumn, CustomField, Deal, DealDetail, DealStageHistory, LeadOrganization, ActivitySetting, UserCredential, LeadPerson, MasterUser, AuditTrail, History, Pipeline, PipelineStage, Lead } = req.models;
  try {
    const { dealId } = req.params;
    const userId = req.adminId;

    // Validate dealId
    if (!dealId) {
      return res.status(400).json({
        message: "Deal ID is required",
        success: false
      });
    }

    // Find the deal
    const deal = await Deal.findByPk(dealId);
    
    if (!deal) {
      return res.status(404).json({
        message: "Deal not found",
        success: false
      });
    }

    // Reset conversion flags
    await deal.update({
      isConvertedToLead: false,
      convertedToLeadAt: null,
      convertedToLeadBy: null
    });

    // Log the action
    try {
      await historyLogger(History, "Deal", dealId, "conversion flag reset", {
        resetBy: userId,
        resetAt: new Date()
      }, userId);
    } catch (historyError) {
      console.log(`History logging failed: ${historyError.message}`);
    }

    res.status(200).json({
      message: "Deal conversion flag reset successfully",
      success: true,
      dealId: dealId,
      resetAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error resetting deal conversion flag:", error);
    res.status(500).json({
      message: "Failed to reset deal conversion flag",
      success: false,
      error: error.message
    });
  }
};

// Bulk delete deals
exports.bulkDeleteDeals = async (req, res) => {
  const { CustomFieldValue, DealColumn, CustomField, Deal, DealDetail, DealStageHistory, LeadOrganization, ActivitySetting, UserCredential, LeadPerson, MasterUser, AuditTrail, History, Pipeline, PipelineStage, Lead, DealNote, DealParticipant, Email, Activity } = req.models;
  const { dealIds } = req.body;

  // Validate input
  if (!dealIds || !Array.isArray(dealIds) || dealIds.length === 0) {
    return res.status(400).json({
      message: "dealIds must be a non-empty array",
    });
  }

  console.log("Bulk delete request for deals:", dealIds);

  try {
    // Check access permissions
    if (!["admin", "general", "master"].includes(req.role)) {
      await logAuditTrail(
        AuditTrail,
        PROGRAMS.DEAL_MANAGEMENT,
        "BULK_DEAL_DELETE",
        null,
        "Access denied. You do not have permission to bulk delete deals.",
        req.adminId
      );
      return res.status(403).json({
        message:
          "Access denied. You do not have permission to bulk delete deals.",
      });
    }

    // Find deals to delete
    let whereClause = { dealId: { [Op.in]: dealIds } };

    // Apply role-based filtering
    if (req.role !== "admin") {
      whereClause[Op.or] = [
        { masterUserID: req.adminId },
        { ownerId: req.adminId },
      ];
    }

    const dealsToDelete = await Deal.findAll({
      where: whereClause,
      attributes: [
        "dealId",
        "title",
        "contactPerson",
        "organization",
        "value",
        "masterUserID",
      ],
    });

    if (dealsToDelete.length === 0) {
      return res.status(404).json({
        message:
          "No deals found to delete or you don't have permission to delete them",
      });
    }

    console.log(`Found ${dealsToDelete.length} deals to delete`);

    const deleteResults = {
      successful: [],
      failed: [],
      skipped: [],
    };

    // Process each deal for deletion
    for (const deal of dealsToDelete) {
      try {
        console.log(`Deleting deal ${deal.dealId}`);

        // Delete related data first
        // Delete custom field values
        await CustomFieldValue.destroy({
          where: {
            entityId: deal.dealId,
            entityType: "deal",
          },
        });

        // Delete deal notes
        await DealNote.destroy({
          where: { dealId: deal.dealId },
        });

        // Delete deal stage history
        await DealStageHistory.destroy({
          where: { dealId: deal.dealId },
        });

        // Delete deal participants
        await DealParticipant.destroy({
          where: { dealId: deal.dealId },
        });

        // Delete deal details
        await DealDetail.destroy({
          where: { dealId: deal.dealId },
        });

        // Update emails to remove dealId association
        await Email.update(
          { dealId: null },
          { where: { dealId: deal.dealId } }
        );

        // Update activities to remove dealId association
        await Activity.update(
          { dealId: null },
          { where: { dealId: deal.dealId } }
        );

        // Delete the deal
        await Deal.destroy({
          where: { dealId: deal.dealId },
        });

        // Log audit trail for successful deletion
        await historyLogger(
          History,
          PROGRAMS.DEAL_MANAGEMENT,
          "BULK_DEAL_DELETE",
          req.adminId,
          deal.dealId,
          null,
          `Deal bulk deleted by ${req.role}`,
          { dealTitle: deal.title }
        );

        deleteResults.successful.push({
          dealId: deal.dealId,
          title: deal.title,
          contactPerson: deal.contactPerson,
          organization: deal.organization,
          value: deal.value,
        });
      } catch (dealError) {
        console.error(`Error deleting deal ${deal.dealId}:`, dealError);

        await logAuditTrail(
          AuditTrail,
          PROGRAMS.DEAL_MANAGEMENT,
          "BULK_DEAL_DELETE",
          req.adminId,
          `Error deleting deal ${deal.dealId}: ${dealError.message}`,
          req.adminId
        );

        deleteResults.failed.push({
          dealId: deal.dealId,
          title: deal.title,
          error: dealError.message,
        });
      }
    }

    // Check for deals that were requested but not found
    const foundDealIds = dealsToDelete.map((deal) => deal.dealId);
    const notFoundDealIds = dealIds.filter((id) => !foundDealIds.includes(id));

    notFoundDealIds.forEach((dealId) => {
      deleteResults.skipped.push({
        dealId: dealId,
        reason: "Deal not found or no permission to delete",
      });
    });

    console.log("Bulk delete results:", deleteResults);

    res.status(200).json({
      message: "Bulk delete operation completed",
      results: deleteResults,
      summary: {
        total: dealIds.length,
        successful: deleteResults.successful.length,
        failed: deleteResults.failed.length,
        skipped: deleteResults.skipped.length,
      },
    });
  } catch (error) {
    console.error("Error in bulk delete deals:", error);

    await logAuditTrail(
      AuditTrail,
      PROGRAMS.DEAL_MANAGEMENT,
      "BULK_DEAL_DELETE",
      null,
      "Error in bulk delete deals: " + error.message,
      req.adminId
    );

    res.status(500).json({
      message: "Internal server error during bulk delete",
      error: error.message,
    });
  }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/deals');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `deal-${req.params.dealId}-${uniqueSuffix}${extension}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow most common file types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/bmp',
      'image/webp',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed',
      'application/json',
      'video/mp4',
      'video/avi',
      'video/quicktime',
      'audio/mp3',
      'audio/wav'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  }
});

/**
 * Upload file(s) to a deal
 */
exports.uploadDealFiles = async (req, res) => {
   const { DealFile, CustomFieldValue, DealColumn, CustomField, Deal, DealDetail, DealStageHistory, LeadOrganization, ActivitySetting, UserCredential, LeadPerson, MasterUser, AuditTrail, History, Pipeline, PipelineStage, Lead, DealNote, DealParticipant, Email, Activity } = req.models;
  try {
    const { dealId } = req.params;
    const masterUserID = req.adminId;
    const uploadedBy = req.user?.id || req.adminId;

    // Check if deal exists and user has access
    const deal = await Deal.findOne({
      where: { dealId}
    });

    if (!deal) {
      return res.status(404).json({
        success: false,
        message: 'Deal not found'
      });
    }

    // Ensure upload directory exists
    const uploadPath = path.join(__dirname, '../../uploads/deals');
    try {
      await fs.access(uploadPath);
    } catch (error) {
      await fs.mkdir(uploadPath, { recursive: true });
    }

    // Handle file upload
    upload.array('files', 10)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: 'File upload failed',
          error: err.message
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      const uploadedFiles = [];

      // Process each uploaded file
      for (const file of req.files) {
        const fileCategory = getFileCategory(file.mimetype);
        const fileExtension = path.extname(file.originalname).toLowerCase();

        const dealFile = await DealFile.create({
          dealId,
          fileName: file.originalname,
          fileDisplayName: req.body.displayName || file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
          fileExtension,
          fileCategory,
          description: req.body.description || null,
          tags: req.body.tags ? JSON.parse(req.body.tags) : null,
          isPublic: req.body.isPublic === 'true',
          uploadedBy,
          masterUserID
        });

        uploadedFiles.push({
          fileId: dealFile.fileId,
          fileName: dealFile.fileName,
          fileSize: dealFile.fileSize,
          fileCategory: dealFile.fileCategory,
          uploadedAt: dealFile.createdAt
        });
      }

      // Log audit trail
      await logAuditTrail(
        PROGRAMS.DEAL_MANAGEMENT,
        "DEAL_FILES_UPLOADED",
        uploadedBy,
        `${uploadedFiles.length} file(s) uploaded to deal ${dealId}`,
        dealId
      );

      res.status(201).json({
        success: true,
        message: `${uploadedFiles.length} file(s) uploaded successfully`,
        data: {
          dealId,
          files: uploadedFiles
        }
      });
    });

  } catch (error) {
    console.error('Upload deal files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload files',
      error: error.message
    });
  }
};

/**
 * Get all files for a deal
 */
exports.getDealFiles = async (req, res) => {
  const { DealFile, CustomFieldValue, DealColumn, CustomField, Deal, DealDetail, DealStageHistory, LeadOrganization, ActivitySetting, UserCredential, LeadPerson, MasterUser, AuditTrail, History, Pipeline, PipelineStage, Lead, DealNote, DealParticipant, Email, Activity } = req.models;
  try {
    const { dealId } = req.params;
    const masterUserID = req.adminId;
    const { category, search, sortBy = 'createdAt', sortOrder = 'DESC', page = 1, limit = 50 } = req.query;

    // Check if deal exists and user has access
    const deal = await Deal.findOne({
      where: { dealId}
    });

    if (!deal) {
      return res.status(404).json({
        success: false,
        message: 'Deal not found'
      });
    }

    // Build where conditions
    const whereConditions = {
      dealId,
      masterUserID,
      isActive: true
    };

    if (category) {
      whereConditions.fileCategory = category;
    }

    if (search) {
      whereConditions[Op.or] = [
        { fileName: { [Op.iLike]: `%${search}%` } },
        { fileDisplayName: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Get files with pagination
    const offset = (page - 1) * limit;
    const { count, rows: files } = await DealFile.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: MasterUser,
          as: 'uploader',
          attributes: ['masterUserID', 'email']
        }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Format file data
    const formattedFiles = files.map(file => ({
      fileId: file.fileId,
      fileName: file.fileName,
      fileDisplayName: file.fileDisplayName,
      fileSize: file.fileSize,
      fileSizeFormatted: formatFileSize(file.fileSize),
      mimeType: file.mimeType,
      fileExtension: file.fileExtension,
      fileCategory: file.fileCategory,
      description: file.description,
      tags: file.tags,
      isPublic: file.isPublic,
      version: file.version,
      downloadCount: file.downloadCount,
      lastAccessedAt: file.lastAccessedAt,
      uploadedBy: file.uploader ? {
        id: file.uploader.masterUserID,
        // name: `${file.uploader.firstName} ${file.uploader.lastName}`,
        email: file.uploader.email
      } : null,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt
    }));

    // Get file statistics
    const stats = await DealFile.findAll({
      where: { dealId, masterUserID, isActive: true },
      attributes: [
        'fileCategory',
        [fn('COUNT', col('fileId')), 'count'],
        [fn('SUM', col('fileSize')), 'totalSize']
      ],
      group: ['fileCategory'],
      raw: true
    });

    res.status(200).json({
      success: true,
      message: 'Deal files retrieved successfully',
      data: {
        dealId,
        files: formattedFiles,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalFiles: count,
          hasNext: (page * limit) < count,
          hasPrev: page > 1
        },
        statistics: {
          totalFiles: count,
          totalSize: files.reduce((sum, file) => sum + file.fileSize, 0),
          categoryBreakdown: stats.reduce((acc, stat) => {
            acc[stat.fileCategory] = {
              count: parseInt(stat.count),
              size: parseInt(stat.totalSize || 0)
            };
            return acc;
          }, {})
        }
      }
    });

  } catch (error) {
    console.error('Get deal files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve deal files',
      error: error.message
    });
  }
};

/**
 * Download a specific file
 */
exports.downloadDealFile = async (req, res) => {
  const { DealFile, CustomFieldValue, DealColumn, CustomField, Deal, DealDetail, DealStageHistory, LeadOrganization, ActivitySetting, UserCredential, LeadPerson, MasterUser, AuditTrail, History, Pipeline, PipelineStage, Lead, DealNote, DealParticipant, Email, Activity } = req.models;
  try {
    const { dealId, fileId } = req.params;
    const masterUserID = req.adminId;

    // Find the file
    const dealFile = await DealFile.findOne({
      where: { fileId, dealId, masterUserID, isActive: true }
    });

    if (!dealFile) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check if file exists on disk
    try {
      await fs.access(dealFile.filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Update download count and last accessed time
    await dealFile.update({
      downloadCount: dealFile.downloadCount + 1,
      lastAccessedAt: new Date()
    });

    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${dealFile.fileName}"`);
    res.setHeader('Content-Type', dealFile.mimeType);

    // Send file
    res.sendFile(path.resolve(dealFile.filePath));

    // Log audit trail
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.DEAL_MANAGEMENT,
      "DEAL_FILE_DOWNLOADED",
      req.user?.id || req.adminId,
      `File ${dealFile.fileName} downloaded from deal ${dealId}`,
      dealId
    );

  } catch (error) {
    console.error('Download deal file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file',
      error: error.message
    });
  }
};

/**
 * Delete a file
 */
exports.deleteDealFile = async (req, res) => {
  const { DealFile, CustomFieldValue, DealColumn, CustomField, Deal, DealDetail, DealStageHistory, LeadOrganization, ActivitySetting, UserCredential, LeadPerson, MasterUser, AuditTrail, History, Pipeline, PipelineStage, Lead, DealNote, DealParticipant, Email, Activity } = req.models;
  try {
    const { dealId, fileId } = req.params;
    const masterUserID = req.adminId;

    // Find the file
    const dealFile = await DealFile.findOne({
      where: { fileId, dealId, isActive: true }
    });

    if (!dealFile) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Soft delete the file
    await dealFile.update({ isActive: false });

    // Optionally delete physical file (uncomment if you want hard delete)
    // try {
    //   await fs.unlink(dealFile.filePath);
    // } catch (error) {
    //   console.warn('Could not delete physical file:', error.message);
    // }

    // Log audit trail
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.DEAL_MANAGEMENT,
      "DEAL_FILE_DELETED",
      req.user?.id || req.adminId,
      `File ${dealFile.fileName} deleted from deal ${dealId}`,
      dealId
    );

    res.status(200).json({
      success: true,
      message: 'File deleted successfully',
      data: {
        fileId: dealFile.fileId,
        fileName: dealFile.fileName
      }
    });

  } catch (error) {
    console.error('Delete deal file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error.message
    });
  }
};

/**
 * Update file metadata
 */
exports.updateDealFile = async (req, res) => {
  const { DealFile, CustomFieldValue, DealColumn, CustomField, Deal, DealDetail, DealStageHistory, LeadOrganization, ActivitySetting, UserCredential, LeadPerson, MasterUser, AuditTrail, History, Pipeline, PipelineStage, Lead, DealNote, DealParticipant, Email, Activity } = req.models;
  try {
    const { dealId, fileId } = req.params;
    const { fileDisplayName, description, tags, isPublic } = req.body;
    const masterUserID = req.adminId;

    // Find the file
    const dealFile = await DealFile.findOne({
      where: { fileId, dealId, isActive: true }
    });

    if (!dealFile) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Update file metadata
    const updateData = {};
    if (fileDisplayName) updateData.fileDisplayName = fileDisplayName;
    if (description !== undefined) updateData.description = description;
    if (tags) updateData.tags = Array.isArray(tags) ? tags : JSON.parse(tags);
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    await dealFile.update(updateData);

    // Log audit trail
    await logAuditTrail(
      AuditTrail,
      PROGRAMS.DEAL_MANAGEMENT,
      "DEAL_FILE_UPDATED",
      req.user?.id || req.adminId,
      `File ${dealFile.fileName} metadata updated in deal ${dealId}`,
      dealId
    );

    res.status(200).json({
      success: true,
      message: 'File updated successfully',
      data: {
        fileId: dealFile.fileId,
        fileName: dealFile.fileName,
        fileDisplayName: dealFile.fileDisplayName,
        description: dealFile.description,
        tags: dealFile.tags,
        isPublic: dealFile.isPublic
      }
    });

  } catch (error) {
    console.error('Update deal file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update file',
      error: error.message
    });
  }
};

/**
 * Helper function to determine file category based on MIME type
 */
function getFileCategory(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf')) return 'document';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType.includes('csv')) return 'spreadsheet';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'presentation';
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return 'archive';
  return 'other';
}

/**
 * Helper function to format file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
