const express = require('express');
const router = express.Router();

// Import controllers
const importController = require('../../controllers/import/importController');
const columnMappingController = require('../../controllers/import/columnMappingController');
const importExecutionController = require('../../controllers/import/importExecutionController');

// Import middleware (you may need to adjust these based on your auth system)
const { verifyToken } = require('../../middlewares/authMiddleware');
const validatePrivilege = require('../../middlewares/validatePrivilege');

// Apply authentication to all routes
router.use(verifyToken);
router.use(validatePrivilege(5, "create")); // Assuming import requires create privileges

// ===== FILE UPLOAD & ANALYSIS ROUTES =====

/**
 * @route POST /api/import/upload
 * @desc Upload file for import and analyze structure
 * @access Private
 * @body {file} file - Excel or CSV file
 * @body {string} entityType - Target entity type (lead, deal, person, organization, activity)
 */
router.post('/upload', importController.uploadFile);

/**
 * @route GET /api/import/status/:sessionId
 * @desc Get import status and progress
 * @access Private
 */
router.get('/status/:sessionId', importController.getImportStatus);

/**
 * @route GET /api/import/history
 * @desc Get user's import history
 * @access Private
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 10)
 * @query {string} status - Filter by status
 * @query {string} entityType - Filter by entity type
 */
router.get('/history', importController.getImportHistory);

/**
 * @route DELETE /api/import/cancel/:sessionId
 * @desc Cancel an ongoing import
 * @access Private
 */
router.delete('/cancel/:sessionId', importController.cancelImport);

/**
 * @route DELETE /api/import/delete/:sessionId
 * @desc Delete import session and cleanup files
 * @access Private
 */
router.delete('/delete/:sessionId', importController.deleteImport);

// ===== COLUMN MAPPING ROUTES =====

/**
 * @route GET /api/import/fields/:entityType
 * @desc Get available fields for mapping based on entity type
 * @access Private
 */
router.get('/fields/:entityType', columnMappingController.getAvailableFields);

/**
 * @route GET /api/import/suggestions/:sessionId
 * @desc Get suggested column mappings based on column names
 * @access Private
 */
router.get('/suggestions/:sessionId', columnMappingController.getSuggestedMappings);

/**
 * @route POST /api/import/mapping/:sessionId
 * @desc Save column mapping configuration
 * @access Private
 * @body {object} columnMapping - Column to field mapping configuration
 * @body {object} importOptions - Additional import options
 */
router.post('/mapping/:sessionId', columnMappingController.saveColumnMapping);

/**
 * @route POST /api/import/validate/:sessionId
 * @desc Validate data before import
 * @access Private
 */
router.post('/validate/:sessionId', columnMappingController.validateData);

// ===== IMPORT EXECUTION ROUTES =====

/**
 * @route POST /api/import/execute/:sessionId
 * @desc Start import execution
 * @access Private
 * @body {string} duplicateHandling - How to handle duplicates ('skip', 'update', 'create_new')
 * @body {number} batchSize - Number of records to process in each batch (default: 100)
 * @body {boolean} continueOnError - Whether to continue import on errors (default: true)
 */
router.post('/execute/:sessionId', importExecutionController.executeImport);

// ===== ERROR REPORTING ROUTES =====

/**
 * @route GET /api/import/errors/:sessionId
 * @desc Get detailed error information for an import session
 * @access Private
 */
router.get('/errors/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const masterUserID = req.adminId;
    const { page = 1, limit = 50 } = req.query;

    const ImportData = require('../../models/import/importDataModel');
    
    const importRecord = await ImportData.findOne({
      where: { sessionId, masterUserID }
    });

    if (!importRecord) {
      return res.status(404).json({
        success: false,
        message: 'Import session not found'
      });
    }

    const validationErrors = importRecord.validationErrors || [];
    const errorLog = importRecord.errorLog || [];
    
    // Combine and paginate errors
    const allErrors = [...validationErrors, ...errorLog];
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedErrors = allErrors.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      data: {
        sessionId,
        errors: paginatedErrors,
        totalErrors: allErrors.length,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(allErrors.length / parseInt(limit)),
          limit: parseInt(limit)
        },
        summary: {
          validationErrors: validationErrors.length,
          processingErrors: errorLog.length,
          totalRows: importRecord.totalRows,
          successfulImports: importRecord.successfulImports,
          failedImports: importRecord.failedImports
        }
      }
    });

  } catch (error) {
    console.error('Get import errors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get import errors',
      error: error.message
    });
  }
});

/**
 * @route GET /api/import/download-errors/:sessionId
 * @desc Download error report file
 * @access Private
 */
router.get('/download-errors/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const masterUserID = req.adminId;

    const ImportData = require('../../models/import/importDataModel');
    const fs = require('fs');
    const path = require('path');
    
    const importRecord = await ImportData.findOne({
      where: { sessionId, masterUserID }
    });

    if (!importRecord) {
      return res.status(404).json({
        success: false,
        message: 'Import session not found'
      });
    }

    if (!importRecord.errorFilePath || !fs.existsSync(importRecord.errorFilePath)) {
      return res.status(404).json({
        success: false,
        message: 'Error report file not found'
      });
    }

    const fileName = `import_errors_${sessionId}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    const fileStream = fs.createReadStream(importRecord.errorFilePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Download error report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download error report',
      error: error.message
    });
  }
});

// ===== UTILITY ROUTES =====

/**
 * @route GET /api/import/templates/:entityType
 * @desc Download import template for entity type
 * @access Private
 */
router.get('/templates/:entityType', async (req, res) => {
  try {
    const { entityType } = req.params;
    
    // Validate entity type
    const validEntityTypes = ['lead', 'deal', 'person', 'organization', 'activity'];
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid entity type. Must be one of: ${validEntityTypes.join(', ')}`
      });
    }

    const XLSX = require('xlsx');
    const columnMappingController = require('../../controllers/import/columnMappingController');
    
    // Get available fields for the entity type
    req.params.entityType = entityType;
    req.adminId = req.adminId; // Ensure adminId is available
    
    // Get fields through the controller logic
    const fields = await require('../../controllers/import/columnMappingController').getEntityFields(entityType);
    
    // Create template with field headers
    const headers = fields
      .filter(field => !field.isCustomField) // Include only standard fields in template
      .map(field => field.label);
    
    // Add some sample data
    const sampleData = createSampleData(entityType, headers);
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheetData = [headers, ...sampleData];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    
    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Set headers and send file
    const fileName = `${entityType}_import_template.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);

  } catch (error) {
    console.error('Download template error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate template',
      error: error.message
    });
  }
});

/**
 * Helper function to create sample data for templates
 */
function createSampleData(entityType, headers) {
  const samples = {
    lead: [
      ['John Doe', 'john.doe@example.com', '+1-555-0123', 'Acme Corp', 'Manager', 'Website', 'New', '10000'],
      ['Jane Smith', 'jane.smith@example.com', '+1-555-0124', 'Tech Solutions', 'Director', 'Referral', 'Qualified', '25000']
    ],
    person: [
      ['Alice Johnson', 'alice@example.com', '+1-555-0125', 'Marketing Inc', 'CMO'],
      ['Bob Wilson', 'bob@example.com', '+1-555-0126', 'Sales Corp', 'VP Sales']
    ],
    deal: [
      ['Q4 Enterprise Deal', '50000', 'Proposal', 'Enterprise Pipeline', '2024-12-31'],
      ['Monthly Subscription', '2400', 'Negotiation', 'SaaS Pipeline', '2024-11-30']
    ],
    organization: [
      ['Tech Innovators Ltd', 'tech@innovators.com', '+1-555-0127', 'www.techinnovators.com'],
      ['Digital Solutions Inc', 'info@digitalsolutions.com', '+1-555-0128', 'www.digitalsolutions.com']
    ],
    activity: [
      ['Follow-up Call', 'Call', '2024-11-01', 'Call to discuss proposal'],
      ['Demo Meeting', 'Meeting', '2024-11-05', 'Product demonstration']
    ]
  };

  return samples[entityType] || [[]];
}

module.exports = router;