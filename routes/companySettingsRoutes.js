const express = require("express");
const router = express.Router();
const companySettingsController = require("../controllers/company/companySettingsController");
const { verifyToken } = require("../middlewares/authMiddleware");

// Apply authentication middleware to all routes
router.use(verifyToken);

/**
 * @route   GET /api/company-settings
 * @desc    Get company settings
 * @access  Private (Admin recommended)
 */
router.get("/", companySettingsController.getCompanySettings);

/**
 * @route   PUT /api/company-settings
 * @desc    Update company settings
 * @access  Private (Admin recommended)
 */
router.put("/", companySettingsController.updateCompanySettings);

/**
 * @route   GET /api/company-settings/maintenance-times
 * @desc    Get maintenance time options for dropdown
 * @access  Private
 */
router.get("/maintenance-times", companySettingsController.getMaintenanceTimeOptions);

/**
 * @route   POST /api/company-settings/check-domain
 * @desc    Check if company domain is available
 * @access  Private
 */
router.post("/check-domain", companySettingsController.checkDomainAvailability);

module.exports = router;
