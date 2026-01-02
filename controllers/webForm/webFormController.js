const crypto = require("crypto");
const WebForm = require("../../models/webForm/webFormModel");
const WebFormField = require("../../models/webForm/webFormFieldModel");
const WebFormSubmission = require("../../models/webForm/webFormSubmissionModel");
const WebFormTracking = require("../../models/webForm/webFormTrackingModel");
const Lead = require("../../models/leads/leadsModel");
const Person = require("../../models/leads/leadPersonModel");
const Organization = require("../../models/leads/leadOrganizationModel");
const { Op } = require("sequelize");
const sequelize = require("../../config/db");
const embedCodeGenerator = require("../../utils/embedCodeGenerator");
const leadConversionService = require("../../services/leadConversionService");

/**
 * Generate unique key for form
 */
const generateUniqueKey = () => {
  return crypto.randomBytes(16).toString("hex");
};

/**
 * Create a new web form
 * @route POST /api/webforms
 */
exports.createForm = async (req, res) => {
  try {
    const {
      formName,
      formTitle,
      formDescription,
      primaryColor,
      buttonText,
      successMessage,
      redirectUrl,
      leadSource,
      autoAssignTo,
      defaultPipelineId,
      defaultStageId,
      allowedDomains,
      enableCaptcha,
      gdprCompliant,
      consentText,
      privacyPolicyUrl,
      notifyEmail,
      enableNotifications,
      organizationId,
      status = "draft",
    } = req.body;

    const uniqueKey = generateUniqueKey();
    const masterUserID = req.adminId;

    const form = await WebForm.create({
      formName,
      formTitle,
      formDescription,
      uniqueKey,
      status,
      primaryColor,
      buttonText,
      successMessage,
      redirectUrl,
      leadSource,
      autoAssignTo,
      defaultPipelineId,
      defaultStageId,
      masterUserID,
      organizationId,
      allowedDomains: allowedDomains ? JSON.stringify(allowedDomains) : null,
      enableCaptcha,
      gdprCompliant,
      consentText,
      privacyPolicyUrl,
      notifyEmail,
      enableNotifications,
    });

    // Generate embed code
    const embedCode = embedCodeGenerator.generateEmbedCode(form);
    await form.update({ embedCode });

    res.status(201).json({
      success: true,
      message: "Form created successfully",
      data: form,
    });
  } catch (error) {
    console.error("Error creating form:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create form",
      error: error.message,
    });
  }
};

/**
 * Get all forms for a user
 * @route GET /api/webforms
 */
exports.getAllForms = async (req, res) => {
  try {
    const masterUserID = req.adminId;
    const { status, search, page = 1, limit = 10 } = req.query;

    const where = { masterUserID };
    
    if (status) {
      where.status = status;
    }

    if (search) {
      where[Op.or] = [
        { formName: { [Op.like]: `%${search}%` } },
        { formTitle: { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows: forms } = await WebForm.findAndCountAll({
      where,
      include: [
        {
          model: WebFormField,
          as: "fields",
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.status(200).json({
      success: true,
      data: {
        forms,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching forms:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch forms",
      error: error.message,
    });
  }
};

/**
 * Get single form by ID
 * @route GET /api/webforms/:formId
 */
exports.getFormById = async (req, res) => {
  try {
    const { formId } = req.params;
    const masterUserID = req.adminId;

    const form = await WebForm.findOne({
      where: { formId },
      include: [
        {
          model: WebFormField,
          as: "fields",
          order: [["fieldOrder", "ASC"]],
        },
      ],
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    res.status(200).json({
      success: true,
      data: form,
    });
  } catch (error) {
    console.error("Error fetching form:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch form",
      error: error.message,
    });
  }
};

/**
 * Update form
 * @route PUT /api/webforms/:formId
 */
exports.updateForm = async (req, res) => {
  try {
    const { formId } = req.params;
    const masterUserID = req.adminId;

    const form = await WebForm.findOne({
      where: { formId, masterUserID },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    const updateData = { ...req.body };
    
    if (updateData.allowedDomains) {
      updateData.allowedDomains = JSON.stringify(updateData.allowedDomains);
    }

    await form.update(updateData);

    // Regenerate embed code if needed
    if (req.body.primaryColor || req.body.buttonText) {
      const embedCode = embedCodeGenerator.generateEmbedCode(form);
      await form.update({ embedCode });
    }

    res.status(200).json({
      success: true,
      message: "Form updated successfully",
      data: form,
    });
  } catch (error) {
    console.error("Error updating form:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update form",
      error: error.message,
    });
  }
};

/**
 * Delete form
 * @route DELETE /api/webforms/:formId
 */
exports.deleteForm = async (req, res) => {
  try {
    const { formId } = req.params;
    const masterUserID = req.adminId;

    const form = await WebForm.findOne({
      where: { formId, masterUserID },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    await form.destroy();

    res.status(200).json({
      success: true,
      message: "Form deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting form:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete form",
      error: error.message,
    });
  }
};

/**
 * Add field to form
 * @route POST /api/webforms/:formId/fields
 */
exports.addField = async (req, res) => {
  try {
    const { formId } = req.params;
    const masterUserID = req.adminId;

    // Verify form ownership
    const form = await WebForm.findOne({
      where: { formId, masterUserID },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    const fieldData = {
      formId,
      ...req.body,
    };

    if (fieldData.options && typeof fieldData.options === "object") {
      fieldData.options = JSON.stringify(fieldData.options);
    }

    const field = await WebFormField.create(fieldData);

    res.status(201).json({
      success: true,
      message: "Field added successfully",
      data: field,
    });
  } catch (error) {
    console.error("Error adding field:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add field",
      error: error.message,
    });
  }
};

/**
 * Update field
 * @route PUT /api/webforms/:formId/fields/:fieldId
 */
exports.updateField = async (req, res) => {
  try {
    const { formId, fieldId } = req.params;
    const masterUserID = req.adminId;

    // Verify form ownership
    const form = await WebForm.findOne({
      where: { formId, masterUserID },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    const field = await WebFormField.findOne({
      where: { fieldId, formId },
    });

    if (!field) {
      return res.status(404).json({
        success: false,
        message: "Field not found",
      });
    }

    const updateData = { ...req.body };
    
    if (updateData.options && typeof updateData.options === "object") {
      updateData.options = JSON.stringify(updateData.options);
    }

    await field.update(updateData);

    res.status(200).json({
      success: true,
      message: "Field updated successfully",
      data: field,
    });
  } catch (error) {
    console.error("Error updating field:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update field",
      error: error.message,
    });
  }
};

/**
 * Delete field
 * @route DELETE /api/webforms/:formId/fields/:fieldId
 */
exports.deleteField = async (req, res) => {
  try {
    const { formId, fieldId } = req.params;
    const masterUserID = req.adminId;

    // Verify form ownership
    const form = await WebForm.findOne({
      where: { formId, masterUserID },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    const field = await WebFormField.findOne({
      where: { fieldId, formId },
    });

    if (!field) {
      return res.status(404).json({
        success: false,
        message: "Field not found",
      });
    }

    await field.destroy();

    res.status(200).json({
      success: true,
      message: "Field deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting field:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete field",
      error: error.message,
    });
  }
};

/**
 * Reorder fields (drag and drop)
 * @route PUT /api/webforms/:formId/fields/reorder
 */
exports.reorderFields = async (req, res) => {
  try {
    const { formId } = req.params;
    const { fieldOrders } = req.body; // [{ fieldId: 1, fieldOrder: 0 }, ...]
    const masterUserID = req.adminId;

    // Verify form ownership
    const form = await WebForm.findOne({
      where: { formId, masterUserID },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    // Update field orders
    for (const item of fieldOrders) {
      await WebFormField.update(
        { fieldOrder: item.fieldOrder },
        { where: { fieldId: item.fieldId, formId } }
      );
    }

    res.status(200).json({
      success: true,
      message: "Fields reordered successfully",
    });
  } catch (error) {
    console.error("Error reordering fields:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reorder fields",
      error: error.message,
    });
  }
};

/**
 * Get form submissions
 * @route GET /api/webforms/:formId/submissions
 */
exports.getSubmissions = async (req, res) => {
  try {
    const { formId } = req.params;
    const masterUserID = req.adminId;
    const { 
      status, 
      isRead, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 20 
    } = req.query;

    // Verify form ownership
    const form = await WebForm.findOne({
      where: { formId, masterUserID },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    const where = { formId };

    if (status) {
      where.status = status;
    }

    if (isRead !== undefined) {
      where.isRead = isRead === "true";
    }

    if (startDate && endDate) {
      where.submittedAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const offset = (page - 1) * limit;

    const { count, rows: submissions } = await WebFormSubmission.findAndCountAll({
      where,
      order: [["submittedAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Parse formData JSON for each submission
    const submissionsWithData = submissions.map(sub => {
      const subData = sub.toJSON();
      subData.formData = JSON.parse(subData.formData);
      return subData;
    });

    res.status(200).json({
      success: true,
      data: {
        submissions: submissionsWithData,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching submissions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch submissions",
      error: error.message,
    });
  }
};

/**
 * Get form analytics
 * @route GET /api/webforms/:formId/analytics
 */
exports.getFormAnalytics = async (req, res) => {
  try {
    const { formId } = req.params;
    const masterUserID = req.adminId;
    const { startDate, endDate } = req.query;

    // Verify form ownership
    const form = await WebForm.findOne({
      where: { formId, masterUserID },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.eventTimestamp = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    // Get tracking stats
    const totalViews = await WebFormTracking.count({
      where: { formId, eventType: "view", ...dateFilter },
    });

    const totalStarts = await WebFormTracking.count({
      where: { formId, eventType: "start", ...dateFilter },
    });

    const totalSubmissions = await WebFormSubmission.count({
      where: { 
        formId, 
        ...(startDate && endDate ? {
          submittedAt: {
            [Op.between]: [new Date(startDate), new Date(endDate)],
          }
        } : {})
      },
    });

    const conversionRate = totalViews > 0 ? (totalSubmissions / totalViews) * 100 : 0;
    const startRate = totalViews > 0 ? (totalStarts / totalViews) * 100 : 0;

    // Get submissions by status
    const submissionsByStatus = await WebFormSubmission.findAll({
      where: { 
        formId,
        ...(startDate && endDate ? {
          submittedAt: {
            [Op.between]: [new Date(startDate), new Date(endDate)],
          }
        } : {})
      },
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("submissionId")), "count"],
      ],
      group: ["status"],
    });

    // Average time to submit
    const avgTimeToSubmit = await WebFormTracking.findOne({
      where: { 
        formId, 
        eventType: "submit_success", 
        timeToSubmit: { [Op.ne]: null },
        ...dateFilter
      },
      attributes: [
        [sequelize.fn("AVG", sequelize.col("timeToSubmit")), "avgTime"],
      ],
    });

    res.status(200).json({
      success: true,
      data: {
        totalViews,
        totalStarts,
        totalSubmissions,
        conversionRate: conversionRate.toFixed(2),
        startRate: startRate.toFixed(2),
        submissionsByStatus,
        averageTimeToSubmit: avgTimeToSubmit?.dataValues?.avgTime || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch analytics",
      error: error.message,
    });
  }
};

/**
 * Duplicate form
 * @route POST /api/webforms/:formId/duplicate
 */
exports.duplicateForm = async (req, res) => {
  try {
    const { formId } = req.params;
    const masterUserID = req.adminId;

    // Get original form with fields
    const originalForm = await WebForm.findOne({
      where: { formId, masterUserID },
      include: [{ model: WebFormField, as: "fields" }],
    });

    if (!originalForm) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    const uniqueKey = generateUniqueKey();
    
    // Create new form
    const newFormData = originalForm.toJSON();
    delete newFormData.formId;
    delete newFormData.createdAt;
    delete newFormData.updatedAt;
    
    newFormData.formName = `${originalForm.formName} (Copy)`;
    newFormData.uniqueKey = uniqueKey;
    newFormData.status = "draft";
    newFormData.totalSubmissions = 0;
    newFormData.totalViews = 0;
    newFormData.conversionRate = 0;

    const newForm = await WebForm.create(newFormData);

    // Duplicate fields
    if (originalForm.fields && originalForm.fields.length > 0) {
      for (const field of originalForm.fields) {
        const fieldData = field.toJSON();
        delete fieldData.fieldId;
        delete fieldData.createdAt;
        delete fieldData.updatedAt;
        fieldData.formId = newForm.formId;
        
        await WebFormField.create(fieldData);
      }
    }

    // Generate embed code
    const embedCode = embedCodeGenerator.generateEmbedCode(newForm);
    await newForm.update({ embedCode });

    res.status(201).json({
      success: true,
      message: "Form duplicated successfully",
      data: newForm,
    });
  } catch (error) {
    console.error("Error duplicating form:", error);
    res.status(500).json({
      success: false,
      message: "Failed to duplicate form",
      error: error.message,
    });
  }
};
