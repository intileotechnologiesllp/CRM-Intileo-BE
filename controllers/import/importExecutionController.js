const XLSX = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const ImportData = require('../../models/import/importDataModel');
const Lead = require('../../models/leads/leadsModel');
const Person = require('../../models/leads/leadPersonModel');
const Deal = require('../../models/deals/dealsModels');
const CustomFieldValue = require('../../models/customFieldValueModel');
const { logAuditTrail } = require('../../utils/auditTrailLogger');
const PROGRAMS = require('../../utils/programConstants');
const { Op } = require('sequelize');
const sequelize = require('../../config/db');

/**
 * Start import execution
 */
exports.executeImport = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { 
      duplicateHandling = 'skip', // 'skip', 'update', 'create_new'
      batchSize = 100,
      continueOnError = true 
    } = req.body;
    const masterUserID = req.adminId;

    // Find import session
    const importRecord = await ImportData.findOne({
      where: { sessionId, masterUserID }
    });

    if (!importRecord) {
      return res.status(404).json({
        success: false,
        message: 'Import session not found'
      });
    }

    // Validate import is ready for execution
    if (!importRecord.columnMapping) {
      return res.status(400).json({
        success: false,
        message: 'Column mapping must be saved before import'
      });
    }

    if (!['mapping', 'validated'].includes(importRecord.status)) {
      return res.status(400).json({
        success: false,
        message: 'Import is not ready for execution'
      });
    }

    // Update import status to importing
    await importRecord.update({
      status: 'importing',
      startedAt: new Date(),
      progress: 0,
      processedRows: 0,
      successfulImports: 0,
      failedImports: 0,
      duplicatesSkipped: 0,
      importOptions: {
        ...importRecord.importOptions,
        duplicateHandling,
        batchSize,
        continueOnError
      }
    });

    // Start import process (run in background)
    processImportInBackground(importRecord, {
      duplicateHandling,
      batchSize,
      continueOnError
    }).catch(error => {
      console.error('Background import process failed:', error);
      importRecord.markAsFailed(`Import execution failed: ${error.message}`);
    });

    // Log audit trail
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "IMPORT_EXECUTION_STARTED",
      masterUserID,
      `Import execution started for session ${sessionId}`,
      importRecord.importId
    );

    res.status(200).json({
      success: true,
      message: 'Import execution started',
      data: {
        sessionId,
        status: 'importing',
        message: 'Import is now running in the background. Use the status endpoint to monitor progress.'
      }
    });

  } catch (error) {
    console.error('Execute import error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start import execution',
      error: error.message
    });
  }
};

/**
 * Process import in background
 */
async function processImportInBackground(importRecord, options) {
  const { duplicateHandling, batchSize, continueOnError } = options;
  let transaction;

  try {
    // Read and parse file data
    const fileData = await readImportFile(importRecord.filePath, importRecord.fileType);
    
    // Get total rows
    const totalRows = fileData.length;
    await importRecord.update({ totalRows });

    // Process data in batches
    let processedRows = 0;
    let successfulImports = 0;
    let failedImports = 0;
    let duplicatesSkipped = 0;
    const errors = [];

    for (let i = 0; i < fileData.length; i += batchSize) {
      const batch = fileData.slice(i, i + batchSize);
      
      // Start transaction for this batch
      transaction = await sequelize.transaction();

      try {
        const batchResult = await processBatch(batch, importRecord, duplicateHandling, transaction);
        
        // Update counters
        processedRows += batch.length;
        successfulImports += batchResult.successful;
        failedImports += batchResult.failed;
        duplicatesSkipped += batchResult.duplicatesSkipped;
        errors.push(...batchResult.errors);

        // Commit transaction
        await transaction.commit();
        transaction = null;

        // Update progress
        const progress = (processedRows / totalRows) * 100;
        await importRecord.update({
          processedRows,
          successfulImports,
          failedImports,
          duplicatesSkipped,
          progress: Math.round(progress),
          errorLog: errors.slice(-100) // Keep last 100 errors
        });

        // Small delay to prevent overwhelming the database
        if (i + batchSize < fileData.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (batchError) {
        // Rollback transaction
        if (transaction) {
          await transaction.rollback();
          transaction = null;
        }

        console.error(`Batch ${i}-${i + batchSize} failed:`, batchError);
        
        if (!continueOnError) {
          throw new Error(`Batch processing failed: ${batchError.message}`);
        }

        // Add batch error to log
        errors.push({
          rowRange: `${i + 1}-${i + batch.length}`,
          error: `Batch processing failed: ${batchError.message}`,
          timestamp: new Date()
        });

        failedImports += batch.length;
        processedRows += batch.length;
      }
    }

    // Mark import as completed
    await importRecord.markAsCompleted({
      processedRows: totalRows,
      successfulImports,
      failedImports,
      duplicatesSkipped,
      errorLog: errors
    });

    // Generate error report if there are errors
    if (errors.length > 0) {
      await generateErrorReport(importRecord, errors);
    }

    console.log(`Import ${importRecord.sessionId} completed successfully`);

  } catch (error) {
    // Rollback any pending transaction
    if (transaction) {
      await transaction.rollback();
    }

    console.error('Import process failed:', error);
    await importRecord.markAsFailed(error.message);
  }
}

/**
 * Process a batch of records
 */
async function processBatch(batch, importRecord, duplicateHandling, transaction) {
  let successful = 0;
  let failed = 0;
  let duplicatesSkipped = 0;
  const errors = [];
  const columnMapping = importRecord.columnMapping;

  for (let rowIndex = 0; rowIndex < batch.length; rowIndex++) {
    const rowData = batch[rowIndex];
    
    try {
      // Transform row data according to column mapping
      const transformedData = transformRowData(rowData, columnMapping);
      
      // Validate required fields
      const validationError = validateRequiredFields(transformedData, importRecord.entityType);
      if (validationError) {
        errors.push({
          row: rowIndex + 1,
          error: validationError,
          data: transformedData,
          timestamp: new Date()
        });
        failed++;
        continue;
      }

      // Check for duplicates
      const duplicateCheck = await checkForDuplicates(transformedData, importRecord.entityType);
      
      if (duplicateCheck.isDuplicate) {
        if (duplicateHandling === 'skip') {
          duplicatesSkipped++;
          continue;
        } else if (duplicateHandling === 'update') {
          await updateExistingRecord(duplicateCheck.record, transformedData, importRecord.entityType, transaction);
          successful++;
          continue;
        }
        // For 'create_new', we continue with normal creation
      }

      // Create new record
      await createRecord(transformedData, importRecord.entityType, importRecord.masterUserID, transaction);
      successful++;

    } catch (recordError) {
      console.error(`Error processing row ${rowIndex + 1}:`, recordError);
      errors.push({
        row: rowIndex + 1,
        error: recordError.message,
        data: rowData,
        timestamp: new Date()
      });
      failed++;
    }
  }

  return {
    successful,
    failed,
    duplicatesSkipped,
    errors
  };
}

/**
 * Read import file and return data array
 */
async function readImportFile(filePath, fileType) {
  return new Promise((resolve, reject) => {
    try {
      if (fileType === 'csv') {
        readCsvFile(filePath, resolve, reject);
      } else if (fileType === 'xlsx' || fileType === 'xls') {
        readExcelFile(filePath, resolve, reject);
      } else {
        reject(new Error('Unsupported file type'));
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Read CSV file
 */
function readCsvFile(filePath, resolve, reject) {
  const results = [];
  let isFirstRow = true;
  let headers = [];

  fs.createReadStream(filePath)
    .pipe(csv({ headers: false }))
    .on('data', (data) => {
      if (isFirstRow) {
        headers = Object.values(data);
        isFirstRow = false;
      } else {
        results.push(Object.values(data));
      }
    })
    .on('end', () => {
      resolve(results);
    })
    .on('error', (error) => {
      reject(error);
    });
}

/**
 * Read Excel file
 */
function readExcelFile(filePath, resolve, reject) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) {
      reject(new Error('The Excel file appears to be empty'));
      return;
    }

    // Remove header row and return data
    const dataRows = jsonData.slice(1);
    resolve(dataRows);

  } catch (error) {
    reject(error);
  }
}

/**
 * Transform row data according to column mapping
 */
function transformRowData(rowData, columnMapping) {
  const transformedData = {};

  Object.entries(columnMapping).forEach(([columnIndex, fieldMapping]) => {
    if (!fieldMapping || !fieldMapping.field) return;

    const cellValue = rowData[parseInt(columnIndex)];
    let transformedValue = cellValue;

    // Apply transformations if specified
    if (fieldMapping.transform) {
      transformedValue = applyTransformations(cellValue, fieldMapping.transform);
    }

    transformedData[fieldMapping.field] = transformedValue;
  });

  return transformedData;
}

/**
 * Apply data transformations
 */
function applyTransformations(value, transformRules) {
  let transformedValue = value;

  if (transformRules.trim) {
    transformedValue = String(transformedValue).trim();
  }

  if (transformRules.toLowerCase) {
    transformedValue = String(transformedValue).toLowerCase();
  }

  if (transformRules.uppercase) {
    transformedValue = String(transformedValue).toUpperCase();
  }

  if (transformRules.replaceEmpty && (!transformedValue || transformedValue === '')) {
    transformedValue = transformRules.replaceEmpty;
  }

  if (transformRules.dateFormat) {
    // Apply date format transformation
    transformedValue = transformDate(transformedValue, transformRules.dateFormat);
  }

  return transformedValue;
}

/**
 * Transform date values
 */
function transformDate(value, format) {
  if (!value) return null;
  
  try {
    // Simple date transformation - in production, use a library like moment.js
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    return null;
  }
}

/**
 * Validate required fields
 */
function validateRequiredFields(data, entityType) {
  // Define required fields for each entity type
  const requiredFields = {
    lead: ['contactPerson'], // At minimum, leads need a contact person
    person: ['contactPerson'],
    deal: ['dealTitle'],
    organization: ['organizationName'],
    activity: ['activityTitle']
  };

  const required = requiredFields[entityType] || [];
  
  for (const field of required) {
    if (!data[field] || data[field] === '') {
      return `Required field '${field}' is missing or empty`;
    }
  }

  return null;
}

/**
 * Check for duplicate records
 */
async function checkForDuplicates(data, entityType) {
  try {
    let Model;
    let duplicateCheckFields = [];

    switch (entityType) {
      case 'lead':
        Model = Lead;
        duplicateCheckFields = ['emailAddress', 'phoneNumber'];
        break;
      case 'person':
        Model = Person;
        duplicateCheckFields = ['emailAddress', 'phoneNumber'];
        break;
      case 'deal':
        Model = Deal;
        duplicateCheckFields = ['dealTitle'];
        break;
      default:
        return { isDuplicate: false };
    }

    // Build where clause for duplicate check
    const whereConditions = [];
    
    duplicateCheckFields.forEach(field => {
      if (data[field]) {
        whereConditions.push({ [field]: data[field] });
      }
    });

    if (whereConditions.length === 0) {
      return { isDuplicate: false };
    }

    // Check for existing record
    const existingRecord = await Model.findOne({
      where: { [Op.or]: whereConditions }
    });

    return {
      isDuplicate: !!existingRecord,
      record: existingRecord
    };

  } catch (error) {
    console.error('Error checking for duplicates:', error);
    return { isDuplicate: false };
  }
}

/**
 * Update existing record
 */
async function updateExistingRecord(record, data, entityType, transaction) {
  try {
    await record.update(data, { transaction });
    
    // Handle custom fields if present
    await updateCustomFields(record, data, entityType, transaction);
    
  } catch (error) {
    throw new Error(`Failed to update existing record: ${error.message}`);
  }
}

/**
 * Create new record
 */
async function createRecord(data, entityType, masterUserID, transaction) {
  try {
    let Model;
    let recordData = { ...data };

    switch (entityType) {
      case 'lead':
        Model = Lead;
        recordData.masterUserID = masterUserID;
        break;
      case 'person':
        Model = Person;
        recordData.masterUserID = masterUserID;
        break;
      case 'deal':
        Model = Deal;
        recordData.masterUserID = masterUserID;
        break;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }

    // Separate custom fields from standard fields
    const { customFields, standardFields } = separateFields(recordData, entityType);

    // Create record with standard fields
    const newRecord = await Model.create(standardFields, { transaction });

    // Handle custom fields
    if (Object.keys(customFields).length > 0) {
      await createCustomFields(newRecord, customFields, entityType, transaction);
    }

    return newRecord;

  } catch (error) {
    throw new Error(`Failed to create record: ${error.message}`);
  }
}

/**
 * Separate custom fields from standard fields
 */
function separateFields(data, entityType) {
  // This is a simplified version - in production, you'd check against actual model attributes
  const standardFields = {};
  const customFields = {};

  Object.entries(data).forEach(([key, value]) => {
    // Simple check - if key starts with 'custom_' or contains specific patterns
    if (key.startsWith('custom_') || key.includes('customField')) {
      customFields[key] = value;
    } else {
      standardFields[key] = value;
    }
  });

  return { standardFields, customFields };
}

/**
 * Create custom field values
 */
async function createCustomFields(record, customFields, entityType, transaction) {
  // Implementation would depend on your custom fields structure
  // This is a placeholder for the actual custom fields creation logic
  console.log('Creating custom fields for record:', record.id, customFields);
}

/**
 * Update custom field values
 */
async function updateCustomFields(record, data, entityType, transaction) {
  // Implementation would depend on your custom fields structure
  // This is a placeholder for the actual custom fields update logic
  console.log('Updating custom fields for record:', record.id, data);
}

/**
 * Generate error report file
 */
async function generateErrorReport(importRecord, errors) {
  try {
    const reportDir = path.join(__dirname, '../../uploads/error_reports');
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFileName = `import_errors_${importRecord.sessionId}_${timestamp}.csv`;
    const reportPath = path.join(reportDir, reportFileName);

    // Create CSV content
    const csvHeader = 'Row,Error,Timestamp,Data\n';
    const csvRows = errors.map(error => {
      const dataStr = error.data ? JSON.stringify(error.data).replace(/"/g, '""') : '';
      return `${error.row},"${error.error}","${error.timestamp}","${dataStr}"`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Write file
    fs.writeFileSync(reportPath, csvContent);

    // Update import record with error file path
    await importRecord.update({ errorFilePath: reportPath });

    console.log(`Error report generated: ${reportPath}`);

  } catch (error) {
    console.error('Failed to generate error report:', error);
  }
}

module.exports = exports;