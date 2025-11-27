const multer = require('multer');
const XLSX = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ImportData = require('../../models/import/importDataModel');
const { logAuditTrail } = require('../../utils/auditTrailLogger');
const PROGRAMS = require('../../utils/programConstants');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/imports');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and UUID
    const timestamp = Date.now();
    const uniqueSuffix = uuidv4().substring(0, 8);
    const ext = path.extname(file.originalname);
    const filename = `import_${timestamp}_${uniqueSuffix}${ext}`;
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedMimeTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  const allowedExtensions = ['.csv', '.xls', '.xlsx'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only CSV, XLS, and XLSX files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: fileFilter
});

/**
 * Upload and analyze file for import
 */
exports.uploadFile = [
  upload.single('file'),
  async (req, res) => {
    try {
      const { entityType = 'lead' } = req.body;
      const masterUserID = req.adminId;
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      // Validate entity type
      const validEntityTypes = ['lead', 'deal', 'person', 'organization', 'activity'];
      if (!validEntityTypes.includes(entityType)) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: `Invalid entity type. Must be one of: ${validEntityTypes.join(', ')}`
        });
      }

      // Generate session ID
      const sessionId = uuidv4();
      
      // Determine file type
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      let fileType;
      switch (fileExtension) {
        case '.csv':
          fileType = 'csv';
          break;
        case '.xlsx':
          fileType = 'xlsx';
          break;
        case '.xls':
          fileType = 'xls';
          break;
        default:
          fileType = 'csv'; // fallback
      }

      // Create import record
      const importRecord = await ImportData.create({
        masterUserID,
        sessionId,
        originalFileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        fileType,
        entityType,
        status: 'analyzing'
      });

      // Analyze file and extract data
      let analysisResult;
      try {
        analysisResult = await analyzeFile(req.file.path, fileType);
        
        // Update import record with analysis results
        await importRecord.update({
          columnHeaders: analysisResult.headers,
          previewData: analysisResult.previewData,
          totalRows: analysisResult.totalRows,
          status: 'mapping'
        });

        // Log audit trail
        await logAuditTrail(
          PROGRAMS.LEAD_MANAGEMENT,
          "IMPORT_FILE_UPLOADED",
          masterUserID,
          `File "${req.file.originalname}" uploaded for ${entityType} import. Session: ${sessionId}`,
          importRecord.importId
        );

        res.status(200).json({
          success: true,
          message: 'File uploaded and analyzed successfully',
          data: {
            sessionId,
            importId: importRecord.importId,
            originalFileName: req.file.originalname,
            fileType,
            entityType,
            totalRows: analysisResult.totalRows,
            columnHeaders: analysisResult.headers,
            previewData: analysisResult.previewData,
            status: 'mapping'
          }
        });

      } catch (analysisError) {
        console.error('File analysis error:', analysisError);
        
        // Update import record with error
        await importRecord.markAsFailed(`File analysis failed: ${analysisError.message}`);
        
        // Clean up file
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(400).json({
          success: false,
          message: 'File analysis failed',
          error: analysisError.message
        });
      }

    } catch (error) {
      console.error('Upload error:', error);
      
      // Clean up file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({
        success: false,
        message: 'File upload failed',
        error: error.message
      });
    }
  }
];

/**
 * Analyze uploaded file and extract headers and preview data
 */
async function analyzeFile(filePath, fileType) {
  return new Promise((resolve, reject) => {
    try {
      if (fileType === 'csv') {
        analyzeCsvFile(filePath, resolve, reject);
      } else if (fileType === 'xlsx' || fileType === 'xls') {
        analyzeExcelFile(filePath, resolve, reject);
      } else {
        reject(new Error('Unsupported file type'));
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Analyze CSV file
 */
function analyzeCsvFile(filePath, resolve, reject) {
  const results = [];
  let headers = [];
  let totalRows = 0;
  let isFirstRow = true;

  fs.createReadStream(filePath)
    .pipe(csv({ headers: false }))
    .on('data', (data) => {
      if (isFirstRow) {
        // First row contains headers
        headers = Object.values(data);
        isFirstRow = false;
      } else {
        // Data rows
        results.push(Object.values(data));
        totalRows++;
        
        // Limit preview data to first 5 rows
        if (results.length > 5) {
          return;
        }
      }
    })
    .on('end', () => {
      resolve({
        headers: headers.map((header, index) => ({ 
          index, 
          name: header || `Column ${index + 1}`,
          originalName: header 
        })),
        previewData: results.slice(0, 5),
        totalRows: totalRows
      });
    })
    .on('error', (error) => {
      reject(error);
    });
}

/**
 * Analyze Excel file
 */
function analyzeExcelFile(filePath, resolve, reject) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) {
      reject(new Error('The Excel file appears to be empty'));
      return;
    }

    // Extract headers (first row)
    const headers = jsonData[0] || [];
    
    // Extract preview data (next 5 rows)
    const previewData = jsonData.slice(1, 6);
    
    // Calculate total rows (excluding header)
    const totalRows = Math.max(0, jsonData.length - 1);

    resolve({
      headers: headers.map((header, index) => ({ 
        index, 
        name: header || `Column ${index + 1}`,
        originalName: header 
      })),
      previewData: previewData,
      totalRows: totalRows
    });

  } catch (error) {
    reject(error);
  }
}

/**
 * Get import status and progress
 */
exports.getImportStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const masterUserID = req.adminId;

    const importRecord = await ImportData.findOne({
      where: { sessionId, masterUserID }
    });

    if (!importRecord) {
      return res.status(404).json({
        success: false,
        message: 'Import session not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        importId: importRecord.importId,
        sessionId: importRecord.sessionId,
        originalFileName: importRecord.originalFileName,
        fileType: importRecord.fileType,
        entityType: importRecord.entityType,
        status: importRecord.status,
        progress: importRecord.progress,
        totalRows: importRecord.totalRows,
        validRows: importRecord.validRows,
        invalidRows: importRecord.invalidRows,
        processedRows: importRecord.processedRows,
        successfulImports: importRecord.successfulImports,
        failedImports: importRecord.failedImports,
        duplicatesSkipped: importRecord.duplicatesSkipped,
        columnHeaders: importRecord.columnHeaders,
        previewData: importRecord.previewData,
        columnMapping: importRecord.columnMapping,
        errorLog: importRecord.errorLog,
        validationErrors: importRecord.validationErrors,
        startedAt: importRecord.startedAt,
        completedAt: importRecord.completedAt,
        createdAt: importRecord.createdAt,
        updatedAt: importRecord.updatedAt
      }
    });

  } catch (error) {
    console.error('Get import status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get import status',
      error: error.message
    });
  }
};

/**
 * Get user's import history
 */
exports.getImportHistory = async (req, res) => {
  try {
    const masterUserID = req.adminId;
    const { page = 1, limit = 10, status, entityType } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const whereClause = { masterUserID };
    
    if (status) {
      whereClause.status = status;
    }
    
    if (entityType) {
      whereClause.entityType = entityType;
    }

    const { rows: imports, count: totalCount } = await ImportData.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset,
      attributes: [
        'importId', 'sessionId', 'originalFileName', 'fileType', 'entityType',
        'status', 'progress', 'totalRows', 'successfulImports', 'failedImports',
        'duplicatesSkipped', 'startedAt', 'completedAt', 'createdAt'
      ]
    });

    res.status(200).json({
      success: true,
      data: imports,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get import history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get import history',
      error: error.message
    });
  }
};

/**
 * Cancel an ongoing import
 */
exports.cancelImport = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const masterUserID = req.adminId;

    const importRecord = await ImportData.findOne({
      where: { sessionId, masterUserID }
    });

    if (!importRecord) {
      return res.status(404).json({
        success: false,
        message: 'Import session not found'
      });
    }

    // Check if import can be cancelled
    const cancellableStatuses = ['uploaded', 'analyzing', 'mapping', 'validating', 'importing'];
    if (!cancellableStatuses.includes(importRecord.status)) {
      return res.status(400).json({
        success: false,
        message: 'Import cannot be cancelled in current status'
      });
    }

    // Update status to cancelled
    await importRecord.update({
      status: 'cancelled',
      completedAt: new Date()
    });

    // Log audit trail
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "IMPORT_CANCELLED",
      masterUserID,
      `Import session ${sessionId} cancelled by user`,
      importRecord.importId
    );

    res.status(200).json({
      success: true,
      message: 'Import cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel import error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel import',
      error: error.message
    });
  }
};

/**
 * Delete import session and cleanup files
 */
exports.deleteImport = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const masterUserID = req.adminId;

    const importRecord = await ImportData.findOne({
      where: { sessionId, masterUserID }
    });

    if (!importRecord) {
      return res.status(404).json({
        success: false,
        message: 'Import session not found'
      });
    }

    // Clean up files
    if (importRecord.filePath && fs.existsSync(importRecord.filePath)) {
      fs.unlinkSync(importRecord.filePath);
    }
    
    if (importRecord.errorFilePath && fs.existsSync(importRecord.errorFilePath)) {
      fs.unlinkSync(importRecord.errorFilePath);
    }

    // Delete record
    await importRecord.destroy();

    // Log audit trail
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "IMPORT_DELETED",
      masterUserID,
      `Import session ${sessionId} deleted`,
      importRecord.importId
    );

    res.status(200).json({
      success: true,
      message: 'Import session deleted successfully'
    });

  } catch (error) {
    console.error('Delete import error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete import session',
      error: error.message
    });
  }
};

module.exports = exports;