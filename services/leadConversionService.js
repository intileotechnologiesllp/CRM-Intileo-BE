const WebFormSubmission = require("../models/webForm/webFormSubmissionModel");
const WebForm = require("../models/webForm/webFormModel");
const WebFormField = require("../models/webForm/webFormFieldModel");
const Lead = require("../models/leads/leadsModel");
const Person = require("../models/leads/leadPersonModel");
const Organization = require("../models/leads/leadOrganizationModel");
const { Op } = require("sequelize");

/**
 * Convert form submission to lead
 * @param {number} submissionId
 * @param {object} form - WebForm instance
 */
exports.convertSubmissionToLead = async (submissionId, form) => {
  try {
    // Get submission
    const submission = await WebFormSubmission.findByPk(submissionId);
    if (!submission) {
      throw new Error("Submission not found");
    }

    // Parse form data
    const formData = JSON.parse(submission.formData);

    // Get form fields with mapping
    const fields = await WebFormField.findAll({
      where: { formId: form.formId },
    });

    // Prepare data objects
    const leadData = {
      masterUserID: form.autoAssignTo || form.masterUserID,
      ownerId: form.autoAssignTo || form.masterUserID,
      sourceChannel: form.leadSource || "Website Form",
      sourceOrigin: form.formName,
      sourceOriginID: form.formId,
      sourceUrl: submission.sourceUrl,
      status: "Open",
      seen: false,
      isQualified: false,
    };

    const personData = {
      masterUserID: form.masterUserID,
    };

    const organizationData = {
      masterUserID: form.masterUserID,
    };

    // Map form fields to database fields
    for (const field of fields) {
      const value = formData[field.fieldName];
      
      if (!value) continue;

      // Map to Lead
      if (field.mapToLeadField) {
        leadData[field.mapToLeadField] = value;
      }

      // Map to Person
      if (field.mapToPersonField) {
        personData[field.mapToPersonField] = value;
      }

      // Map to Organization
      if (field.mapToOrganizationField) {
        organizationData[field.mapToOrganizationField] = value;
      }

      // Common field mappings
      switch (field.fieldName.toLowerCase()) {
        case "email":
          personData.email = value;
          leadData.email = value;
          break;
        case "phone":
        case "phone_number":
        case "mobile":
          personData.phone = value;
          leadData.phone = value;
          break;
        case "first_name":
        case "firstname":
          personData.firstName = value;
          break;
        case "last_name":
        case "lastname":
          personData.lastName = value;
          break;
        case "name":
        case "full_name":
          const nameParts = value.split(" ");
          personData.firstName = nameParts[0];
          personData.lastName = nameParts.slice(1).join(" ");
          leadData.contactPerson = value;
          break;
        case "company":
        case "company_name":
        case "organization":
          organizationData.name = value;
          leadData.company = value;
          leadData.organization = value;
          break;
        case "job_title":
        case "title":
        case "position":
          personData.jobTitle = value;
          break;
        case "website":
        case "company_website":
          organizationData.website = value;
          break;
        case "address":
          organizationData.address = value;
          break;
        case "city":
          organizationData.city = value;
          break;
        case "country":
          organizationData.country = value;
          leadData.organizationCountry = value;
          break;
        case "message":
        case "description":
        case "comments":
          leadData.notes = value;
          break;
      }
    }

    // Add UTM parameters to lead
    if (submission.utmSource) {
      leadData.utmSource = submission.utmSource;
    }
    if (submission.utmMedium) {
      leadData.utmMedium = submission.utmMedium;
    }
    if (submission.utmCampaign) {
      leadData.utmCampaign = submission.utmCampaign;
    }

    // Add geolocation data
    if (submission.country) {
      leadData.country = submission.country;
    }
    if (submission.city) {
      leadData.city = submission.city;
    }

    let personId = null;
    let organizationId = null;

    // Check if person already exists (by email)
    if (personData.email) {
      const existingPerson = await Person.findOne({
        where: { email: personData.email },
      });

      if (existingPerson) {
        personId = existingPerson.personId;
        
        // Check for duplicate lead
        const duplicateLead = await Lead.findOne({
          where: {
            personId: personId,
            sourceOrigin: form.formName,
            createdAt: {
              [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
        });

        if (duplicateLead) {
          // Mark as duplicate
          await submission.update({
            status: "duplicate",
            leadId: duplicateLead.leadId,
            personId: personId,
          });

          return {
            success: true,
            isDuplicate: true,
            leadId: duplicateLead.leadId,
            message: "Duplicate lead detected",
          };
        }
      } else {
        // Create new person
        const newPerson = await Person.create(personData);
        personId = newPerson.personId;
      }
    }

    // Check if organization exists (by name)
    if (organizationData.name) {
      const existingOrg = await Organization.findOne({
        where: { name: organizationData.name },
      });

      if (existingOrg) {
        organizationId = existingOrg.leadOrganizationId;
      } else {
        // Create new organization
        const newOrg = await Organization.create(organizationData);
        organizationId = newOrg.leadOrganizationId;
      }
    }

    // Link person and organization
    if (personId && organizationId) {
      leadData.personId = personId;
      leadData.leadOrganizationId = organizationId;
      
      await Person.update(
        { leadOrganizationId: organizationId },
        { where: { personId } }
      );
    } else if (personId) {
      leadData.personId = personId;
    } else if (organizationId) {
      leadData.leadOrganizationId = organizationId;
    }

    // Set pipeline and stage if configured
    if (form.defaultPipelineId) {
      leadData.pipelineId = form.defaultPipelineId;
    }
    if (form.defaultStageId) {
      leadData.stageId = form.defaultStageId;
    }

    // Create lead
    const lead = await Lead.create(leadData);

    // Update submission with lead info
    await submission.update({
      status: "converted",
      leadId: lead.leadId,
      personId: personId,
      organizationId: organizationId,
      qualityScore: calculateQualityScore(formData, fields),
    });

    // Send notification email if configured
    if (form.enableNotifications && form.notifyEmail) {
      try {
        await sendNewLeadNotification(form, submission, lead);
      } catch (error) {
        console.error("Error sending notification email:", error);
      }
    }

    return {
      success: true,
      leadId: lead.leadId,
      personId,
      organizationId,
      message: "Lead created successfully",
    };
  } catch (error) {
    console.error("Error converting submission to lead:", error);
    
    // Update submission status to failed
    try {
      await WebFormSubmission.update(
        { status: "failed" },
        { where: { submissionId } }
      );
    } catch (updateError) {
      console.error("Error updating submission status:", updateError);
    }

    throw error;
  }
};

/**
 * Calculate lead quality score based on form data
 * @param {object} formData
 * @param {array} fields
 * @returns {number} Quality score (0-100)
 */
function calculateQualityScore(formData, fields) {
  let score = 0;
  const totalFields = fields.length;

  // Base score for completion
  const filledFields = Object.keys(formData).filter(
    (key) => formData[key] && formData[key].trim() !== ""
  ).length;
  score += (filledFields / totalFields) * 40;

  // Bonus for email
  if (formData.email) {
    score += 20;
  }

  // Bonus for phone
  if (formData.phone || formData.phone_number || formData.mobile) {
    score += 15;
  }

  // Bonus for company
  if (formData.company || formData.company_name || formData.organization) {
    score += 15;
  }

  // Bonus for detailed message
  if (formData.message && formData.message.length > 50) {
    score += 10;
  }

  return Math.min(Math.round(score), 100);
}

/**
 * Send email notification for new lead
 * @param {object} form
 * @param {object} submission
 * @param {object} lead
 */
async function sendNewLeadNotification(form, submission, lead) {
  // This would integrate with your email service
  // For now, just log the notification
  console.log("New lead notification:", {
    to: form.notifyEmail,
    formName: form.formName,
    leadId: lead.leadId,
    submissionId: submission.submissionId,
  });

  // TODO: Implement actual email sending using your email service
  // Example:
  // const emailService = require('./emailService');
  // await emailService.sendEmail({
  //   to: form.notifyEmail,
  //   subject: `New Lead from ${form.formName}`,
  //   template: 'new-lead',
  //   data: { form, submission, lead }
  // });
}

/**
 * Bulk convert pending submissions to leads
 * @param {number} formId
 */
exports.convertPendingSubmissions = async (formId) => {
  try {
    const form = await WebForm.findByPk(formId);
    if (!form) {
      throw new Error("Form not found");
    }

    const pendingSubmissions = await WebFormSubmission.findAll({
      where: { formId, status: "pending" },
      limit: 100, // Process in batches
    });

    const results = [];
    for (const submission of pendingSubmissions) {
      try {
        const result = await exports.convertSubmissionToLead(
          submission.submissionId,
          form
        );
        results.push({ submissionId: submission.submissionId, ...result });
      } catch (error) {
        console.error(
          `Error converting submission ${submission.submissionId}:`,
          error
        );
        results.push({
          submissionId: submission.submissionId,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      success: true,
      processed: results.length,
      results,
    };
  } catch (error) {
    console.error("Error converting pending submissions:", error);
    throw error;
  }
};

module.exports = exports;
