const XLSX = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const ImportData = require('../../models/import/importDataModel');
const Lead = require('../../models/leads/leadsModel');
const Person = require('../../models/leads/leadPersonModel');
const Deal = require('../../models/deals/dealsModels');
const Organization = require('../../models/leads/leadOrganizationModel'); // Add Organization model
const Activity = require('../../models/activity/activityModel'); // Add Activity model
const LeadDetails = require('../../models/leads/leadDetailsModel'); // Add LeadDetails model
const DealDetails = require('../../models/deals/dealsDetailModel'); // Add DealDetails model
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
 * Finish Import - Process multi-entity import based on column mapping
 */
exports.finishImport = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { 
      duplicateHandling = 'skip',
      batchSize = 100,
      continueOnError = true,
      processInBackground = true 
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
        message: 'Column mapping must be saved before finishing import'
      });
    }

    if (!['mapping', 'validated'].includes(importRecord.status)) {
      return res.status(400).json({
        success: false,
        message: 'Import is not ready for execution. Current status: ' + importRecord.status
      });
    }

    // Analyze column mapping to determine entity types
    const entityTypes = analyzeColumnMappingEntities(importRecord.columnMapping);
    
    if (entityTypes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid entity mappings found in column configuration'
      });
    }

    console.log('Multi-entity import detected:', entityTypes);

    // Update import status
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
        continueOnError,
        entityTypes,
        isMultiEntity: true
      }
    });

    if (processInBackground) {
      // Start multi-entity import process in background
      processMultiEntityImportInBackground(importRecord, {
        duplicateHandling,
        batchSize,
        continueOnError,
        entityTypes
      }).catch(error => {
        console.error('Background multi-entity import process failed:', error);
        importRecord.markAsFailed(`Multi-entity import execution failed: ${error.message}`);
      });

      // Log audit trail
      await logAuditTrail(
        PROGRAMS.LEAD_MANAGEMENT,
        "MULTI_ENTITY_IMPORT_STARTED",
        masterUserID,
        `Multi-entity import started for session ${sessionId}. Entity types: ${entityTypes.join(', ')}`,
        importRecord.importId
      );

      res.status(200).json({
        success: true,
        message: 'Multi-entity import execution started',
        data: {
          sessionId,
          status: 'importing',
          entityTypes,
          message: 'Multi-entity import is now running in the background. Use the status endpoint to monitor progress.'
        }
      });
    } else {
      // Process synchronously (for smaller datasets)
      const result = await processMultiEntityImportInBackground(importRecord, {
        duplicateHandling,
        batchSize,
        continueOnError,
        entityTypes
      });

      res.status(200).json({
        success: true,
        message: 'Multi-entity import completed',
        data: {
          sessionId,
          entityTypes,
          result
        }
      });
    }

  } catch (error) {
    console.error('Finish import error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to finish import execution',
      error: error.message
    });
  }
};

/**
 * Analyze column mapping to determine entity types
 */
function analyzeColumnMappingEntities(columnMapping) {
  const entityTypes = new Set();
  
  Object.values(columnMapping).forEach(fieldMapping => {
    if (fieldMapping && fieldMapping.entityType) {
      entityTypes.add(fieldMapping.entityType);
    }
  });
  
  return Array.from(entityTypes);
}

/**
 * Process multi-entity import in background
 */
async function processMultiEntityImportInBackground(importRecord, options) {
  const { duplicateHandling, batchSize, continueOnError, entityTypes } = options;

  // Get the client connection from request (attached by middleware)
  const clientConnection = req.clientConnection;
  
  if (!clientConnection) {
    return res.status(500).json({
      message: "No database connection available. Please login again.",
    });
  }

  let transaction;

  try {
    console.log(`Starting multi-entity import for entities: ${entityTypes.join(', ')}`);
    
    // Read and parse file data
    const fileData = await readImportFile(importRecord.filePath, importRecord.fileType);
    
    // Get total rows
    const totalRows = fileData.length;
    await importRecord.update({ totalRows });

    // Process data in batches with multi-entity support
    let processedRows = 0;
    let successfulImports = 0;
    let failedImports = 0;
    let duplicatesSkipped = 0;
    const errors = [];
    const entityStats = {};

    // Initialize entity statistics
    entityTypes.forEach(entityType => {
      entityStats[entityType] = {
        successful: 0,
        failed: 0,
        duplicatesSkipped: 0
      };
    });

    for (let i = 0; i < fileData.length; i += batchSize) {
      const batch = fileData.slice(i, i + batchSize);
      
      // Start transaction for this batch
      transaction = await clientConnection.transaction();

      try {
        const batchResult = await processBatch(batch, importRecord, duplicateHandling, transaction);
        
        // Update counters
        processedRows += batch.length;
        successfulImports += batchResult.successful;
        failedImports += batchResult.failed;
        duplicatesSkipped += batchResult.duplicatesSkipped;
        errors.push(...batchResult.errors);

        // Update entity-specific statistics
        batchResult.errors.forEach(error => {
          if (error.entity && entityStats[error.entity]) {
            entityStats[error.entity].failed++;
          }
        });

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
          errorLog: errors.slice(-100), // Keep last 100 errors
          entityStats
        });

        console.log(`Processed batch ${i + 1}-${i + batch.length}, Progress: ${Math.round(progress)}%`);

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

        console.error(`Multi-entity batch ${i}-${i + batchSize} failed:`, batchError);
        
        if (!continueOnError) {
          throw new Error(`Multi-entity batch processing failed: ${batchError.message}`);
        }

        // Add batch error to log
        errors.push({
          rowRange: `${i + 1}-${i + batch.length}`,
          error: `Multi-entity batch processing failed: ${batchError.message}`,
          entityTypes,
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
      errorLog: errors,
      entityStats,
      entityTypes
    });

    // Generate error report if there are errors
    if (errors.length > 0) {
      await generateErrorReport(importRecord, errors);
    }

    // Log completion
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "MULTI_ENTITY_IMPORT_COMPLETED",
      importRecord.masterUserID,
      `Multi-entity import completed for session ${importRecord.sessionId}. Entities: ${entityTypes.join(', ')}, Processed: ${totalRows}, Success: ${successfulImports}, Failed: ${failedImports}`,
      importRecord.importId
    );

    console.log(`Multi-entity import ${importRecord.sessionId} completed successfully`);
    console.log('Entity Statistics:', entityStats);

    return {
      totalRows,
      successfulImports,
      failedImports,
      duplicatesSkipped,
      entityTypes,
      entityStats,
      errors: errors.length
    };

  } catch (error) {
    // Rollback any pending transaction
    if (transaction) {
      await transaction.rollback();
    }

    console.error('Multi-entity import process failed:', error);
    await importRecord.markAsFailed(error.message);
    throw error;
  }
}

/**
 * Process import in background
 */
async function processImportInBackground(importRecord, options) {
  const { duplicateHandling, batchSize, continueOnError } = options;

  // Get the client connection from request (attached by middleware)
  const clientConnection = req.clientConnection;
  
  if (!clientConnection) {
    return res.status(500).json({
      message: "No database connection available. Please login again.",
    });
  }

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
      transaction = await clientConnection.transaction();

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
 * Process a batch of records with multi-entity support
 */
async function processBatch(batch, importRecord, duplicateHandling, transaction) {
  let successful = 0;
  let failed = 0;
  let duplicatesSkipped = 0;
  const errors = [];
  const columnMapping = importRecord.columnMapping;

  // Group column mappings by entity type
  const entityMappings = groupColumnMappingsByEntity(columnMapping);
  console.log('Entity mappings found:', Object.keys(entityMappings));

  for (let rowIndex = 0; rowIndex < batch.length; rowIndex++) {
    const rowData = batch[rowIndex];
    
    try {
      // Process each entity type found in the column mapping
      const rowResults = await processRowForMultipleEntities(
        rowData, 
        entityMappings, 
        importRecord, 
        duplicateHandling, 
        transaction,
        rowIndex + 1
      );

      successful += rowResults.successful;
      failed += rowResults.failed;
      duplicatesSkipped += rowResults.duplicatesSkipped;
      errors.push(...rowResults.errors);

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
 * Group column mappings by entity type
 */
function groupColumnMappingsByEntity(columnMapping) {
  const entityMappings = {};
  
  Object.entries(columnMapping).forEach(([columnIndex, fieldMapping]) => {
    if (!fieldMapping || !fieldMapping.entityType) return;
    
    const entityType = fieldMapping.entityType;
    if (!entityMappings[entityType]) {
      entityMappings[entityType] = {};
    }
    
    entityMappings[entityType][columnIndex] = fieldMapping;
  });
  
  return entityMappings;
}

/**
 * Process a single row for multiple entity types
 */
async function processRowForMultipleEntities(rowData, entityMappings, importRecord, duplicateHandling, transaction, rowNumber) {
  let successful = 0;
  let failed = 0;
  let duplicatesSkipped = 0;
  const errors = [];
  const createdEntities = {}; // Store created entities for relationship linking

  // Process each entity type in order (persons first, then organizations, then leads/deals, finally activities)
  const entityOrder = ['person', 'organization', 'lead', 'deal', 'activity'];
  
  for (const entityType of entityOrder) {
    if (!entityMappings[entityType]) continue;
    
    try {
      console.log(`Processing ${entityType} for row ${rowNumber}`);
      
      // Transform row data for this entity type
      const transformedData = transformRowDataForEntity(rowData, entityMappings[entityType]);
      
      // Skip if no meaningful data for this entity
      if (isEmptyEntityData(transformedData, entityType)) {
        console.log(`Skipping ${entityType} - no meaningful data in row ${rowNumber}`);
        continue;
      }
      
      // Validate required fields for this entity type
      const validationError = validateRequiredFields(transformedData, entityType);
      if (validationError) {
        errors.push({
          row: rowNumber,
          entity: entityType,
          error: validationError,
          data: transformedData,
          timestamp: new Date()
        });
        failed++;
        continue;
      }

      // Check for duplicates
      const duplicateCheck = await checkForDuplicates(transformedData, entityType, importRecord.masterUserID);
      
      if (duplicateCheck.isDuplicate) {
        if (duplicateHandling === 'skip') {
          duplicatesSkipped++;
          continue;
        } else if (duplicateHandling === 'update') {
          const updatedRecord = await updateExistingRecord(
            duplicateCheck.record, 
            transformedData, 
            entityType, 
            transaction
          );
          createdEntities[entityType] = updatedRecord;
          successful++;
          continue;
        }
        // For 'create_new', we continue with normal creation
      }

      // Create new record with relationship linking
      const newRecord = await createRecordWithRelationships(
        transformedData, 
        entityType, 
        importRecord.masterUserID, 
        transaction,
        createdEntities
      );
      
      // Store created entity for potential relationship linking
      createdEntities[entityType] = newRecord;
      successful++;

    } catch (entityError) {
      console.error(`Error processing ${entityType} for row ${rowNumber}:`, entityError);
      errors.push({
        row: rowNumber,
        entity: entityType,
        error: entityError.message,
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
 * Transform row data for specific entity type
 */
function transformRowDataForEntity(rowData, entityMapping) {
  const transformedData = {};

  Object.entries(entityMapping).forEach(([columnIndex, fieldMapping]) => {
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
 * Check if entity data is empty or meaningless
 */
function isEmptyEntityData(data, entityType) {
  const requiredFields = {
    lead: ['contactPerson'],
    person: ['contactPerson'],
    deal: ['title'],
    organization: ['organizationName'],
    activity: ['subject', 'activityType']
  };

  const required = requiredFields[entityType] || [];
  
  // Check if at least one required field has meaningful data
  return !required.some(field => data[field] && String(data[field]).trim() !== '');
}

/**
 * Create record with relationship linking support
 */
async function createRecordWithRelationships(data, entityType, masterUserID, transaction, createdEntities) {
  try {
    let Model;
    let recordData = { ...data };

    // Set common system fields
    recordData.masterUserID = masterUserID;
    recordData.ownerId = masterUserID;
    recordData.createdBy = masterUserID;

    switch (entityType) {
      case 'lead':
        Model = Lead;
        recordData = await prepareLinkDataForLead(recordData, createdEntities);
        break;
      case 'person':
        Model = Person;
        recordData = await prepareLinkDataForPerson(recordData, createdEntities);
        break;
      case 'deal':
        Model = Deal;
        recordData = await prepareLinkDataForDeal(recordData, createdEntities);
        break;
      case 'organization':
        Model = Organization;
        recordData = await prepareLinkDataForOrganization(recordData, createdEntities);
        break;
      case 'activity':
        Model = Activity;
        recordData = await prepareLinkDataForActivity(recordData, createdEntities);
        break;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }

    // Separate custom fields from standard fields
    const { customFields, standardFields } = separateFields(recordData, entityType);

    // Create record with standard fields
    const newRecord = await Model.create(standardFields, { transaction });

    // Handle custom fields if any
    if (Object.keys(customFields).length > 0) {
      await createCustomFields(newRecord, customFields, entityType, transaction);
    }

    // Create related detail records if needed
    await createEntityDetails(newRecord, data, entityType, masterUserID, transaction);

    console.log(`Created ${entityType} record with ID:`, newRecord[getPrimaryKeyField(entityType)]);
    return newRecord;

  } catch (error) {
    throw new Error(`Failed to create ${entityType} record: ${error.message}`);
  }
}

/**
 * Prepare lead data with relationship links
 */
async function prepareLinkDataForLead(data, createdEntities) {
  const leadData = { ...data };
  
  // Link to person if created
  if (createdEntities.person) {
    leadData.personId = createdEntities.person.personId;
  }
  
  // Link to organization if created
  if (createdEntities.organization) {
    leadData.leadOrganizationId = createdEntities.organization.organizationId;
    leadData.organization = createdEntities.organization.organizationName;
  }
  
  // Set default values
  leadData.proposalValueCurrency = leadData.proposalValueCurrency || 'INR';
  leadData.status = leadData.status || 'New';
  leadData.sourceChannel = leadData.sourceChannel || 'Import';
  leadData.isArchived = false;
  
  return leadData;
}

/**
 * Prepare person data with relationship links
 */
async function prepareLinkDataForPerson(data, createdEntities) {
  const personData = { ...data };
  
  // Link to organization if created
  if (createdEntities.organization) {
    personData.organizationId = createdEntities.organization.organizationId;
    personData.organization = createdEntities.organization.organizationName;
  }
  
  return personData;
}

/**
 * Prepare deal data with relationship links
 */
async function prepareLinkDataForDeal(data, createdEntities) {
  const dealData = { ...data };
  
  // Link to person if created
  if (createdEntities.person) {
    dealData.personId = createdEntities.person.personId;
    dealData.contactPerson = createdEntities.person.contactPerson;
    dealData.email = createdEntities.person.email;
    dealData.phone = createdEntities.person.phone;
  }
  
  // Link to organization if created
  if (createdEntities.organization) {
    dealData.organizationId = createdEntities.organization.organizationId;
    dealData.organization = createdEntities.organization.organizationName;
  }
  
  // Link to lead if created
  if (createdEntities.lead) {
    dealData.leadId = createdEntities.lead.leadId;
  }
  
  // Set default values
  dealData.currency = dealData.currency || 'INR';
  dealData.status = dealData.status || 'Open';
  dealData.stage = dealData.stage || 'New Deal';
  dealData.pipeline = dealData.pipeline || 'Default Pipeline';
  dealData.pipelineStage = dealData.pipelineStage || dealData.stage;
  dealData.probability = dealData.probability || 50;
  dealData.isArchived = false;
  
  return dealData;
}

/**
 * Prepare organization data
 */
async function prepareLinkDataForOrganization(data, createdEntities) {
  const orgData = { ...data };
  
  // Set default values
  orgData.isActive = true;
  
  return orgData;
}

/**
 * Prepare activity data with relationship links
 */
async function prepareLinkDataForActivity(data, createdEntities) {
  const activityData = { ...data };
  
  // Link to person if created
  if (createdEntities.person) {
    activityData.personId = createdEntities.person.personId;
  }
  
  // Link to deal if created
  if (createdEntities.deal) {
    activityData.dealId = createdEntities.deal.dealId;
  }
  
  // Link to lead if created
  if (createdEntities.lead) {
    activityData.leadId = createdEntities.lead.leadId;
  }
  
  // Link to organization if created
  if (createdEntities.organization) {
    activityData.organizationId = createdEntities.organization.organizationId;
  }
  
  // Set default values
  activityData.done = false;
  activityData.status = activityData.status || 'Open';
  activityData.activityType = activityData.activityType || 'General';
  
  if (!activityData.dueDate && !activityData.dueTime) {
    // Set default due date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    activityData.dueDate = tomorrow;
  }
  
  return activityData;
}

/**
 * Create entity-specific detail records
 */
async function createEntityDetails(record, originalData, entityType, masterUserID, transaction) {
  try {
    switch (entityType) {
      case 'lead':
        if (originalData.notes || originalData.sourceChannel) {
          await LeadDetails.create({
            leadId: record.leadId,
            description: originalData.notes,
            sourceChannel: originalData.sourceChannel,
            createdBy: masterUserID,
            masterUserID: masterUserID
          }, { transaction });
        }
        break;
        
      case 'deal':
        if (originalData.notes || originalData.sourceChannel) {
          await DealDetails.create({
            dealId: record.dealId,
            responsiblePerson: record.contactPerson,
            sourceOrgin: originalData.sourceChannel,
            currency: record.currency || 'INR',
            masterUserID: masterUserID
          }, { transaction });
        }
        break;
        
      // Add more detail creation logic for other entities as needed
    }
  } catch (error) {
    console.warn(`Failed to create details for ${entityType}:`, error.message);
    // Don't fail the main record creation
  }
}

/**
 * Get primary key field name for entity type
 */
function getPrimaryKeyField(entityType) {
  const primaryKeys = {
    lead: 'leadId',
    person: 'personId',
    deal: 'dealId',
    organization: 'organizationId',
    activity: 'activityId'
  };
  
  return primaryKeys[entityType] || 'id';
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
 * Validate required fields for each entity type
 */
function validateRequiredFields(data, entityType) {
  // Define required fields for each entity type
  const requiredFields = {
    lead: ['contactPerson'],
    person: ['contactPerson'],
    deal: ['title'],
    organization: ['organizationName'],
    activity: ['subject']
  };

  const required = requiredFields[entityType] || [];
  
  for (const field of required) {
    if (!data[field] || String(data[field]).trim() === '') {
      return `Required field '${field}' is missing or empty for ${entityType}`;
    }
  }

  return null;
}

/**
 * Check for duplicate records with enhanced entity support
 */
async function checkForDuplicates(data, entityType, masterUserID) {
  try {
    let Model;
    let duplicateCheckFields = [];
    let whereClause = {};

    switch (entityType) {
      case 'lead':
        Model = Lead;
        duplicateCheckFields = ['email', 'phone', 'contactPerson'];
        break;
      case 'person':
        Model = Person;
        duplicateCheckFields = ['email', 'phone', 'contactPerson'];
        break;
      case 'deal':
        Model = Deal;
        duplicateCheckFields = ['title', 'contactPerson'];
        break;
      case 'organization':
        Model = Organization;
        duplicateCheckFields = ['organizationName', 'website'];
        break;
      case 'activity':
        Model = Activity;
        duplicateCheckFields = ['subject', 'activityType'];
        break;
      default:
        return { isDuplicate: false };
    }

    // Build where clause for duplicate check
    const whereConditions = [];
    
    duplicateCheckFields.forEach(field => {
      if (data[field] && String(data[field]).trim() !== '') {
        whereConditions.push({ [field]: data[field] });
      }
    });

    if (whereConditions.length === 0) {
      return { isDuplicate: false };
    }

    // Add masterUserID to scope duplicates to the current user
    whereClause = {
      [Op.and]: [
        { masterUserID: masterUserID },
        { [Op.or]: whereConditions }
      ]
    };

    // Special handling for different entity types
    if (entityType === 'organization') {
      // For organizations, also check if not archived
      whereClause[Op.and].push({ isActive: true });
    } else if (entityType === 'activity') {
      // For activities, only check recent activities (not done ones from long ago)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      whereClause[Op.and].push({ 
        [Op.or]: [
          { done: false },
          { createdAt: { [Op.gte]: thirtyDaysAgo } }
        ]
      });
    }

    // Check for existing record
    const existingRecord = await Model.findOne({
      where: whereClause
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
    // Filter out system fields that shouldn't be updated
    const updateData = { ...data };
    delete updateData.masterUserID;
    delete updateData.ownerId;
    delete updateData.createdBy;
    delete updateData.createdAt;
    
    // Add update timestamp
    updateData.updatedAt = new Date();
    
    await record.update(updateData, { transaction });
    
    // Handle custom fields if present
    await updateCustomFields(record, data, entityType, transaction);
    
    return record; // Return the updated record
    
  } catch (error) {
    throw new Error(`Failed to update existing ${entityType} record: ${error.message}`);
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