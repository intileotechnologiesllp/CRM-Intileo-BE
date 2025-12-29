const CompanySettings = require("../../models/company/companySettingsModel");

/**
 * Get company settings
 * @route GET /api/company-settings
 * @access Private (Admin only recommended)
 */
exports.getCompanySettings = async (req, res) => {
  const { CompanySetting } = req.models;
  try {
    // Get the first (and should be only) company settings record
    let settings = await CompanySetting.findOne();

    // If no settings exist, create default settings
    if (!settings) {
      settings = await CompanySetting.create({
        companyName: "My Company",
        companyDomain: null,
        preferredMaintenanceTime: null,
        timezone: "UTC",
      });
    }

    res.status(200).json({
      success: true,
      message: "Company settings retrieved successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error fetching company settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve company settings",
      error: error.message,
    });
  }
};

/**
 * Update company settings
 * @route PUT /api/company-settings
 * @access Private (Admin only recommended)
 */
exports.updateCompanySettings = async (req, res) => {
  const { CompanySetting } = req.models;
  try {
    const { companyName, companyDomain, preferredMaintenanceTime, timezone } =
      req.body;

    // Validate required fields
    if (!companyName || companyName.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Company name is required",
      });
    }

    // Validate company domain format if provided
    if (companyDomain) {
      const domainRegex = /^[a-z0-9-]+$/;
      if (!domainRegex.test(companyDomain)) {
        return res.status(400).json({
          success: false,
          message:
            "Company domain can only contain lowercase letters, numbers, and hyphens",
        });
      }

      if (companyDomain.length < 3 || companyDomain.length > 63) {
        return res.status(400).json({
          success: false,
          message: "Company domain must be between 3 and 63 characters",
        });
      }
    }

    // Get existing settings or create new
    let settings = await CompanySetting.findOne();

    if (!settings) {
      // Create new settings if none exist
      settings = await CompanySetting.create({
        companyName: companyName.trim(),
        companyDomain: companyDomain ? companyDomain.toLowerCase().trim() : null,
        preferredMaintenanceTime: preferredMaintenanceTime || null,
        timezone: timezone || "UTC",
      });

      return res.status(201).json({
        success: true,
        message: "Company settings created successfully",
        data: settings,
      });
    }

    // Update existing settings
    const updateData = {
      companyName: companyName.trim(),
    };

    if (companyDomain !== undefined) {
      updateData.companyDomain = companyDomain
        ? companyDomain.toLowerCase().trim()
        : null;
    }

    if (preferredMaintenanceTime !== undefined) {
      updateData.preferredMaintenanceTime = preferredMaintenanceTime || null;
    }

    if (timezone !== undefined) {
      updateData.timezone = timezone || "UTC";
    }

    await settings.update(updateData);

    res.status(200).json({
      success: true,
      message: "Company settings updated successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error updating company settings:", error);

    // Handle unique constraint violation for company domain
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        message: "This company domain is already in use",
      });
    }

    // Handle validation errors
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors.map((e) => ({
          field: e.path,
          message: e.message,
        })),
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update company settings",
      error: error.message,
    });
  }
};

/**
 * Get maintenance time options (for dropdown)
 * @route GET /api/company-settings/maintenance-times
 * @access Private
 */
exports.getMaintenanceTimeOptions = async (req, res) => {
  try {
    const timeSlots = [
      { value: "00:00-03:00", label: "00:00-03:00" },
      { value: "03:00-06:00", label: "03:00-06:00" },
      { value: "06:00-09:00", label: "06:00-09:00" },
      { value: "09:00-12:00", label: "09:00-12:00" },
      { value: "12:00-15:00", label: "12:00-15:00" },
      { value: "15:00-18:00", label: "15:00-18:00" },
      { value: "18:00-21:00", label: "18:00-21:00" },
      { value: "21:00-24:00", label: "21:00-24:00" },
    ];

    const days = [
      { key: "monday", label: "Monday" },
      { key: "tuesday", label: "Tuesday" },
      { key: "wednesday", label: "Wednesday" },
      { key: "thursday", label: "Thursday" },
      { key: "friday", label: "Friday" },
      { key: "saturday", label: "Saturday" },
      { key: "sunday", label: "Sunday" },
    ];

    res.status(200).json({
      success: true,
      data: {
        days,
        timeSlots,
      },
    });
  } catch (error) {
    console.error("Error fetching maintenance time options:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve maintenance time options",
      error: error.message,
    });
  }
};

/**
 * Check if company domain is available
 * @route POST /api/company-settings/check-domain
 * @access Private
 */
exports.checkDomainAvailability = async (req, res) => {
  const { CompanySetting } = req.models;
  try {
    const { companyDomain } = req.body;

    if (!companyDomain || companyDomain.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Company domain is required",
      });
    }

    const domain = companyDomain.toLowerCase().trim();

    // Check format
    const domainRegex = /^[a-z0-9-]+$/;
    if (!domainRegex.test(domain)) {
      return res.status(400).json({
        success: false,
        available: false,
        message:
          "Company domain can only contain lowercase letters, numbers, and hyphens",
      });
    }

    // Check if domain exists
    const existingSettings = await CompanySetting.findOne({
      where: { companyDomain: domain },
    });

    // Get current settings to check if it's the same company
    const currentSettings = await CompanySetting.findOne();

    const isAvailable =
      !existingSettings ||
      (currentSettings &&
        currentSettings.companyDomain === domain);

    res.status(200).json({
      success: true,
      available: isAvailable,
      message: isAvailable
        ? "Domain is available"
        : "Domain is already in use",
    });
  } catch (error) {
    console.error("Error checking domain availability:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check domain availability",
      error: error.message,
    });
  }
};
