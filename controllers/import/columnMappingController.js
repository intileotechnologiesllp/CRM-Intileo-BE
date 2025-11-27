const ImportData = require('../../models/import/importDataModel');
const Lead = require('../../models/leads/leadsModel');
const Person = require('../../models/leads/leadPersonModel');
const Deal = require('../../models/deals/dealsModels');
const CustomField = require('../../models/customFieldModel');
const { logAuditTrail } = require('../../utils/auditTrailLogger');
const PROGRAMS = require('../../utils/programConstants');
const { Op } = require('sequelize');

/**
 * Get available fields for mapping based on entity type
 */
exports.getAvailableFields = async (req, res) => {
  try {
    const { entityType } = req.params;
    const { search, fieldType, isRequired, isCustomField } = req.query;
    const masterUserID = req.adminId;

    console.log('getAvailableFields called with entityType:', entityType);
    console.log('Search params:', { search, fieldType, isRequired, isCustomField });

    // Validate entity type
    const validEntityTypes = ['lead', 'deal', 'person', 'organization', 'activity'];
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid entity type. Must be one of: ${validEntityTypes.join(', ')}`
      });
    }

    let fields = await getEntityFields(entityType);
    
    console.log('Fields before filtering:', fields.length);

    // Apply search filter
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      fields = fields.filter(field => 
        field.value.toLowerCase().includes(searchTerm) ||
        field.label.toLowerCase().includes(searchTerm) ||
        field.description?.toLowerCase().includes(searchTerm)
      );
      console.log('Fields after search filter:', fields.length);
    }

    // Apply field type filter
    if (fieldType && fieldType.trim()) {
      fields = fields.filter(field => field.type === fieldType.trim());
      console.log('Fields after fieldType filter:', fields.length);
    }

    // Apply required filter
    if (isRequired !== undefined) {
      const requiredFilter = isRequired === 'true' || isRequired === true;
      fields = fields.filter(field => field.isRequired === requiredFilter);
      console.log('Fields after isRequired filter:', fields.length);
    }

    // Apply custom field filter
    if (isCustomField !== undefined) {
      const customFilter = isCustomField === 'true' || isCustomField === true;
      fields = fields.filter(field => field.isCustomField === customFilter);
      console.log('Fields after isCustomField filter:', fields.length);
    }
    
    console.log('Fields returned from getEntityFields:', fields.length);
    console.log('Standard fields:', fields.filter(f => !f.isCustomField).length);
    console.log('Custom fields:', fields.filter(f => f.isCustomField).length);

    res.status(200).json({
      success: true,
      data: {
        entityType,
        fields,
        totalFields: fields.length,
        standardFields: fields.filter(f => !f.isCustomField).length,
        customFields: fields.filter(f => f.isCustomField).length,
        filters: {
          search: search || null,
          fieldType: fieldType || null,
          isRequired: isRequired || null,
          isCustomField: isCustomField || null
        }
      }
    });

  } catch (error) {
    console.error('Get available fields error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available fields',
      error: error.message
    });
  }
};

/**
 * Save column mapping configuration
 * 
 * Expected columnMapping format for manual mapping:
 * {
 *   "0": {
 *     "field": "contactPerson",
 *     "entityType": "lead", 
 *     "fieldType": "text",
 *     "isCustomField": false,
 *     "isRequired": false,
 *     "label": "Contact Person",
 *     "transform": {
 *       "type": "uppercase" // optional transform rules
 *     }
 *   },
 *   "1": {
 *     "field": "custom_industry",
 *     "fieldId": "abc123", // Required for custom fields
 *     "entityType": "lead",
 *     "fieldType": "select", 
 *     "isCustomField": true,
 *     "isRequired": false,
 *     "label": "Industry Type",
 *     "options": ["Tech", "Finance", "Healthcare"],
 *     "transform": null
 *   },
 *   "2": null // Unmapped column
 * }
 */
exports.saveColumnMapping = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { columnMapping, importOptions = {} } = req.body;
    const masterUserID = req.adminId;

    // Validate inputs
    if (!columnMapping || typeof columnMapping !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Column mapping is required and must be an object'
      });
    }

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

    // Enhanced validation for column mapping with fieldId and entityType support
    const validationResult = await validateColumnMappingWithEntitySupport(columnMapping, importRecord.entityType);
    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Column mapping validation failed',
        errors: validationResult.errors
      });
    }

    // Process and normalize column mapping to include entityType and fieldId
    const normalizedColumnMapping = await normalizeColumnMapping(columnMapping, importRecord.entityType);

    // Update import record with mapping
    await importRecord.update({
      columnMapping: normalizedColumnMapping,
      importOptions,
      status: 'validating'
    });

    // Log audit trail
    await logAuditTrail(
      PROGRAMS.LEAD_MANAGEMENT,
      "IMPORT_MAPPING_SAVED",
      masterUserID,
      `Column mapping saved for import session ${sessionId}`,
      importRecord.importId
    );

    res.status(200).json({
      success: true,
      message: 'Column mapping saved successfully',
      data: {
        sessionId,
        columnMapping: normalizedColumnMapping,
        importOptions,
        status: 'validating'
      }
    });

  } catch (error) {
    console.error('Save column mapping error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save column mapping',
      error: error.message
    });
  }
};

/**
 * Get suggested mappings based on column names
 */
exports.getSuggestedMappings = async (req, res) => {
  try {
    const { sessionId } = req.params;
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

    // Get available fields for the entity type
    const availableFields = await getEntityFields(importRecord.entityType);
    const columnHeaders = importRecord.columnHeaders || [];

    // Generate suggested mappings
    const suggestedMappings = generateSuggestedMappings(columnHeaders, availableFields);

    res.status(200).json({
      success: true,
      data: {
        sessionId,
        entityType: importRecord.entityType,
        columnHeaders,
        availableFields,
        suggestedMappings,
        confidence: calculateMappingConfidence(suggestedMappings)
      }
    });

  } catch (error) {
    console.error('Get suggested mappings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get suggested mappings',
      error: error.message
    });
  }
};

/**
 * Validate data before import
 */
exports.validateData = async (req, res) => {
  try {
    const { sessionId } = req.params;
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

    if (!importRecord.columnMapping) {
      return res.status(400).json({
        success: false,
        message: 'Column mapping must be saved before validation'
      });
    }

    // Start validation process
    await importRecord.update({ status: 'validating', progress: 0 });

    // Perform data validation
    const validationResult = await performDataValidation(importRecord);

    // Update import record with validation results
    await importRecord.update({
      validRows: validationResult.validRows,
      invalidRows: validationResult.invalidRows,
      validationErrors: validationResult.errors,
      status: validationResult.hasErrors ? 'mapping' : 'validated',
      progress: 100
    });

    res.status(200).json({
      success: true,
      message: 'Data validation completed',
      data: {
        sessionId,
        totalRows: importRecord.totalRows,
        validRows: validationResult.validRows,
        invalidRows: validationResult.invalidRows,
        hasErrors: validationResult.hasErrors,
        errors: validationResult.errors.slice(0, 50), // Return first 50 errors for preview
        totalErrors: validationResult.errors.length,
        status: validationResult.hasErrors ? 'mapping' : 'validated'
      }
    });

  } catch (error) {
    console.error('Validate data error:', error);
    
    // Update import status to failed
    try {
      const importRecord = await ImportData.findOne({
        where: { sessionId: req.params.sessionId, masterUserID: req.adminId }
      });
      if (importRecord) {
        await importRecord.markAsFailed(`Validation failed: ${error.message}`);
      }
    } catch (updateError) {
      console.error('Failed to update import status:', updateError);
    }

    res.status(500).json({
      success: false,
      message: 'Data validation failed',
      error: error.message
    });
  }
};

/**
 * Helper function to get entity fields
 */
async function getEntityFields(entityType) {
  const fields = [];

  // Helper function to convert Sequelize data types to readable format
  const getFieldType = (sequelizeType) => {
    if (!sequelizeType) return 'text';
    
    const typeKey = sequelizeType.key || sequelizeType.constructor?.name || sequelizeType.toString();
    
    switch (typeKey) {
      case 'STRING':
      case 'TEXT':
        return 'text';
      case 'INTEGER':
      case 'BIGINT':
      case 'FLOAT':
      case 'DECIMAL':
      case 'DOUBLE':
        return 'number';
      case 'DATE':
      case 'DATEONLY':
        return 'date';
      case 'BOOLEAN':
        return 'boolean';
      case 'JSON':
      case 'JSONB':
        return 'json';
      case 'ENUM':
        return 'select';
      default:
        return 'text';
    }
  };

  // Helper function to format field labels
  const formatLabel = (fieldName) => {
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  try {
    console.log('Getting entity fields for:', entityType);
    
    // Define standard fields based on entity type
    let standardFields = [];
    
    switch (entityType) {
      case 'lead':
        standardFields = [
          { name: 'contactPerson', type: 'text', required: false, label: 'Contact Person' },
          { name: 'title', type: 'text', required: false, label: 'Title' },
          { name: 'email', type: 'text', required: false, label: 'Email' },
          { name: 'phone', type: 'text', required: false, label: 'Phone' },
          { name: 'company', type: 'text', required: false, label: 'Company' },
          { name: 'organization', type: 'text', required: false, label: 'Organization' },
          { name: 'valueLabels', type: 'text', required: false, label: 'Value Labels' },
          { name: 'status', type: 'select', required: false, label: 'Status' },
          { name: 'proposalValue', type: 'number', required: false, label: 'Proposal Value' },
          { name: 'expectedCloseDate', type: 'date', required: false, label: 'Expected Close Date' },
          { name: 'sourceChannel', type: 'text', required: false, label: 'Source Channel' },
          { name: 'serviceType', type: 'text', required: false, label: 'Service Type' },
          { name: 'scopeOfServiceType', type: 'text', required: false, label: 'Scope Of Service Type' },
          { name: 'projectLocation', type: 'text', required: false, label: 'Project Location' },
          { name: 'organizationCountry', type: 'text', required: false, label: 'Organization Country' },
          { name: 'proposalSentDate', type: 'date', required: false, label: 'Proposal Sent Date' },
          { name: 'esplProposalNo', type: 'text', required: false, label: 'ESPL Proposal No' },
          { name: 'ownerId', type: 'number', required: false, label: 'Owner ID' },
          { name: 'ownerName', type: 'text', required: false, label: 'Owner Name' }
        ];
        break;
      case 'person':
        standardFields = [
          { name: 'contactPerson', type: 'text', required: false, label: 'Contact Person' },
          { name: 'email', type: 'text', required: false, label: 'Email' },
          { name: 'phone', type: 'text', required: false, label: 'Phone' },
          { name: 'notes', type: 'text', required: false, label: 'Notes' },
          { name: 'postalAddress', type: 'text', required: false, label: 'Postal Address' },
          { name: 'birthday', type: 'date', required: false, label: 'Birthday' },
          { name: 'jobTitle', type: 'text', required: false, label: 'Job Title' },
          { name: 'personLabels', type: 'text', required: false, label: 'Person Labels' },
          { name: 'organization', type: 'text', required: false, label: 'Organization' },
          { name: 'ownerId', type: 'number', required: false, label: 'Owner ID' },
          { name: 'ownerName', type: 'text', required: false, label: 'Owner Name' },
          { name: 'emails', type: 'json', required: false, label: 'Emails (JSON)' },
          { name: 'phones', type: 'json', required: false, label: 'Phones (JSON)' },
          { name: 'wonDeals', type: 'number', required: false, label: 'Won Deals' },
          { name: 'lostDeals', type: 'number', required: false, label: 'Lost Deals' },
          { name: 'openDeals', type: 'number', required: false, label: 'Open Deals' },
          { name: 'peopleCount', type: 'number', required: false, label: 'People Count' },
          { name: 'lastActivityDate', type: 'date', required: false, label: 'Last Activity Date' },
          { name: 'nextActivityDate', type: 'date', required: false, label: 'Next Activity Date' },
          { name: 'doneActivitiesCount', type: 'number', required: false, label: 'Done Activities Count' },
          { name: 'totalActivitiesCount', type: 'number', required: false, label: 'Total Activities Count' },
          { name: 'activitiesTodoCount', type: 'number', required: false, label: 'Activities Todo Count' }
        ];
        break;
      case 'deal':
        standardFields = [
          { name: 'title', type: 'text', required: true, label: 'Title' },
          { name: 'value', type: 'number', required: false, label: 'Value' },
          { name: 'currency', type: 'text', required: false, label: 'Currency' },
          { name: 'contactPerson', type: 'text', required: false, label: 'Contact Person' },
          { name: 'organization', type: 'text', required: false, label: 'Organization' },
          { name: 'pipeline', type: 'text', required: false, label: 'Pipeline' },
          { name: 'pipelineStage', type: 'text', required: false, label: 'Pipeline Stage' },
          { name: 'pipelineId', type: 'number', required: false, label: 'Pipeline ID' },
          { name: 'stageId', type: 'number', required: false, label: 'Stage ID' },
          { name: 'label', type: 'text', required: false, label: 'Label' },
          { name: 'expectedCloseDate', type: 'date', required: false, label: 'Expected Close Date' },
          { name: 'sourceChannel', type: 'text', required: false, label: 'Source Channel' },
          { name: 'sourceChannelId', type: 'text', required: false, label: 'Source Channel ID' },
          { name: 'serviceType', type: 'text', required: false, label: 'Service Type' },
          { name: 'proposalValue', type: 'number', required: false, label: 'Proposal Value' },
          { name: 'proposalCurrency', type: 'text', required: false, label: 'Proposal Currency' },
          { name: 'esplProposalNo', type: 'text', required: false, label: 'ESPL Proposal No' },
          { name: 'projectLocation', type: 'text', required: false, label: 'Project Location' },
          { name: 'organizationCountry', type: 'text', required: false, label: 'Organization Country' },
          { name: 'proposalSentDate', type: 'date', required: false, label: 'Proposal Sent Date' },
          { name: 'phone', type: 'text', required: false, label: 'Phone' },
          { name: 'email', type: 'text', required: false, label: 'Email' },
          { name: 'ownerId', type: 'number', required: false, label: 'Owner ID' },
          { name: 'status', type: 'text', required: false, label: 'Status' },
          { name: 'source', type: 'text', required: false, label: 'Source' },
          { name: 'productName', type: 'text', required: false, label: 'Product Name' },
          { name: 'probability', type: 'number', required: false, label: 'Probability' },
          { name: 'weightedValue', type: 'number', required: false, label: 'Weighted Value' },
          { name: 'productQuantity', type: 'number', required: false, label: 'Product Quantity' },
          { name: 'productAmount', type: 'number', required: false, label: 'Product Amount' },
          { name: 'MRR', type: 'number', required: false, label: 'Monthly Recurring Revenue' },
          { name: 'ARR', type: 'number', required: false, label: 'Annual Recurring Revenue' },
          { name: 'ACV', type: 'number', required: false, label: 'Annual Contract Value' },
          { name: 'lostReason', type: 'text', required: false, label: 'Lost Reason' }
        ];
        break;
      case 'organization':
        standardFields = [
          { name: 'organizationName', type: 'text', required: true, label: 'Organization Name' },
          { name: 'website', type: 'text', required: false, label: 'Website' },
          { name: 'industry', type: 'text', required: false, label: 'Industry' },
          { name: 'address', type: 'text', required: false, label: 'Address' },
          { name: 'city', type: 'text', required: false, label: 'City' },
          { name: 'state', type: 'text', required: false, label: 'State' },
          { name: 'country', type: 'text', required: false, label: 'Country' },
          { name: 'postalCode', type: 'text', required: false, label: 'Postal Code' }
        ];
        break;
      case 'activity':
        standardFields = [
          { name: 'activityType', type: 'select', required: true, label: 'Activity Type' },
          { name: 'subject', type: 'text', required: true, label: 'Subject' },
          { name: 'description', type: 'text', required: false, label: 'Description' },
          { name: 'dueDate', type: 'date', required: false, label: 'Due Date' },
          { name: 'duration', type: 'number', required: false, label: 'Duration' },
          { name: 'ownerId', type: 'number', required: false, label: 'Owner ID' }
        ];
        break;
      default:
        standardFields = [];
    }

    console.log('Standard fields defined:', standardFields.length);

    // Add standard fields to the result
    standardFields.forEach(fieldDef => {
      fields.push({
        value: fieldDef.name,
        label: fieldDef.label,
        type: fieldDef.type,
        entity: entityType,
        entityType: entityType, // Add for consistency
        isCustomField: false,
        isRequired: fieldDef.required,
        description: null,
        fieldId: null // Standard fields don't have fieldId
      });
    });

    console.log('Fields after adding standard fields:', fields.length);

    // Get custom fields
    const customFields = await CustomField.findAll({
      where: {
        entityType: { [Op.in]: [entityType, 'both'] },
        isActive: true
      },
      attributes: ['fieldId', 'fieldName', 'fieldLabel', 'fieldType', 'isRequired', 'options']
    });

    console.log('Custom fields found:', customFields.length);

    // Process custom fields
    customFields.forEach(customField => {
      let fieldType = 'text';
      switch (customField.fieldType) {
        case 'text':
        case 'textarea':
          fieldType = 'text';
          break;
        case 'number':
        case 'monetary':
          fieldType = 'number';
          break;
        case 'date':
        case 'datetime':
          fieldType = 'date';
          break;
        case 'singleselect':
        case 'multiselect':
          fieldType = 'select';
          break;
        case 'boolean':
        case 'checkbox':
          fieldType = 'boolean';
          break;
        default:
          fieldType = 'text';
      }

      fields.push({
        value: customField.fieldName,
        label: customField.fieldLabel || formatLabel(customField.fieldName),
        type: fieldType,
        entity: entityType,
        entityType: entityType, // Add for consistency
        isCustomField: true,
        isRequired: customField.isRequired || false,
        fieldId: customField.fieldId, // Essential for custom fields
        options: customField.options,
        description: `Custom ${fieldType} field`
      });
    });

    console.log('Total fields after adding custom fields:', fields.length);

    // Sort fields: required first, then by label
    fields.sort((a, b) => {
      if (a.isRequired !== b.isRequired) {
        return a.isRequired ? -1 : 1;
      }
      return a.label.localeCompare(b.label);
    });

    console.log('Final fields count:', fields.length);
    console.log('Standard fields:', fields.filter(f => !f.isCustomField).length);
    console.log('Custom fields:', fields.filter(f => f.isCustomField).length);

    return fields;

  } catch (error) {
    console.error('Error getting entity fields:', error);
    return [];
  }
}

/**
 * Enhanced validation for column mapping with entity type and field ID support
 */
async function validateColumnMappingWithEntitySupport(columnMapping, entityType) {
  const errors = [];
  
  try {
    // Get available fields for validation
    const availableFields = await getEntityFields(entityType);
    const availableFieldsMap = new Map();
    
    // Create a map for quick lookup - handle both standard and custom fields
    availableFields.forEach(field => {
      const key = field.isCustomField ? `${field.value}_${field.fieldId}` : field.value;
      availableFieldsMap.set(key, field);
      // Also add by value only for backward compatibility
      availableFieldsMap.set(field.value, field);
    });
    
    // Check if columnMapping is an object
    if (typeof columnMapping !== 'object' || Array.isArray(columnMapping)) {
      errors.push('Column mapping must be an object');
      return { isValid: false, errors };
    }
    
    // Validate each mapping
    Object.entries(columnMapping).forEach(([columnIndex, fieldMapping]) => {
      if (!fieldMapping) return; // Skip unmapped columns
      
      // Validate field mapping structure
      if (typeof fieldMapping !== 'object') {
        errors.push(`Mapping for column ${columnIndex} must be an object`);
        return;
      }
      
      const { field, fieldId, entityType: mappedEntityType, transform } = fieldMapping;
      
      // Check if field is specified
      if (!field) {
        errors.push(`Field is required for column ${columnIndex}`);
        return;
      }
      
      // Validate entity type matches
      if (mappedEntityType && mappedEntityType !== entityType) {
        errors.push(`Entity type mismatch for column ${columnIndex}. Expected: ${entityType}, Got: ${mappedEntityType}`);
      }
      
      // Check if mapped field exists
      let fieldExists = false;
      let lookupKey = field;
      
      // For custom fields, use field + fieldId combination
      if (fieldId) {
        lookupKey = `${field}_${fieldId}`;
        fieldExists = availableFieldsMap.has(lookupKey);
        
        if (!fieldExists) {
          // Try just the field name for backward compatibility
          fieldExists = availableFieldsMap.has(field);
          if (fieldExists) {
            const foundField = availableFieldsMap.get(field);
            if (foundField.isCustomField && foundField.fieldId !== fieldId) {
              errors.push(`Custom field "${field}" with fieldId "${fieldId}" does not exist for entity type "${entityType}"`);
              fieldExists = false;
            }
          }
        }
      } else {
        fieldExists = availableFieldsMap.has(field);
      }
      
      if (!fieldExists) {
        errors.push(`Field "${field}" does not exist for entity type "${entityType}"`);
      }
      
      // Validate transform rules if provided
      if (transform) {
        if (typeof transform !== 'object') {
          errors.push(`Transform rules for column ${columnIndex} must be an object`);
        }
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
    
  } catch (error) {
    return {
      isValid: false,
      errors: [`Validation error: ${error.message}`]
    };
  }
}

/**
 * Normalize column mapping to include entityType and fieldId
 */
async function normalizeColumnMapping(columnMapping, entityType) {
  try {
    const availableFields = await getEntityFields(entityType);
    const fieldsMap = new Map();
    
    // Create lookup map
    availableFields.forEach(field => {
      fieldsMap.set(field.value, field);
    });
    
    const normalizedMapping = {};
    
    Object.entries(columnMapping).forEach(([columnIndex, fieldMapping]) => {
      if (!fieldMapping) {
        normalizedMapping[columnIndex] = null;
        return;
      }
      
      const { field, fieldId, transform, ...otherProps } = fieldMapping;
      const fieldInfo = fieldsMap.get(field);
      
      if (fieldInfo) {
        normalizedMapping[columnIndex] = {
          field: field,
          fieldId: fieldInfo.isCustomField ? (fieldId || fieldInfo.fieldId) : undefined,
          entityType: entityType,
          fieldType: fieldInfo.type,
          isCustomField: fieldInfo.isCustomField,
          isRequired: fieldInfo.isRequired,
          label: fieldInfo.label,
          transform: transform || null,
          ...otherProps
        };
      } else {
        // Keep original mapping if field not found (for validation to catch)
        normalizedMapping[columnIndex] = {
          ...fieldMapping,
          entityType: entityType
        };
      }
    });
    
    return normalizedMapping;
    
  } catch (error) {
    console.error('Error normalizing column mapping:', error);
    return columnMapping; // Return original on error
  }
}

/**
 * Validate column mapping configuration (legacy function - kept for backward compatibility)
 */
async function validateColumnMapping(columnMapping, entityType) {
  return validateColumnMappingWithEntitySupport(columnMapping, entityType);
}

/**
 * Generate suggested mappings based on column names with enhanced field information
 */
function generateSuggestedMappings(columnHeaders, availableFields) {
  const suggestions = {};
  
  // Create field lookup map
  const fieldsMap = new Map();
  availableFields.forEach(field => {
    fieldsMap.set(field.value.toLowerCase(), field);
    fieldsMap.set(field.label.toLowerCase(), field);
  });
  
  // Common field mappings
  const commonMappings = {
    // Lead fields
    'first name': 'firstName',
    'firstname': 'firstName', 
    'last name': 'lastName',
    'lastname': 'lastName',
    'full name': 'contactPerson',
    'name': 'contactPerson',
    'email': 'email',
    'email address': 'email',
    'phone': 'phone',
    'phone number': 'phone',
    'company': 'company',
    'organization': 'organization',
    'title': 'title',
    'job title': 'jobTitle',
    'lead source': 'sourceChannel',
    'source': 'sourceChannel',
    'status': 'status',
    'value': 'proposalValue',
    'lead value': 'proposalValue',
    'notes': 'notes',
    'description': 'notes',
    'website': 'website',
    'address': 'postalAddress',
    'city': 'city',
    'state': 'state',
    'country': 'organizationCountry',
    'zip': 'postalCode',
    'postal code': 'postalCode',
    
    // Person fields
    'person name': 'contactPerson',
    'contact person': 'contactPerson',
    
    // Deal fields
    'deal title': 'title',
    'deal name': 'title',
    'deal value': 'value',
    'amount': 'value',
    'stage': 'stageId',
    'pipeline': 'pipelineId',
    'probability': 'probability',
    'close date': 'expectedCloseDate',
    'expected close date': 'expectedCloseDate'
  };
  
  columnHeaders.forEach((column, index) => {
    const columnName = column.name.toLowerCase().trim();
    
    // Try exact match first
    const exactMatch = availableFields.find(field => 
      field.value.toLowerCase() === columnName || 
      field.label.toLowerCase() === columnName
    );
    
    if (exactMatch) {
      suggestions[index] = {
        field: exactMatch.value,
        fieldId: exactMatch.isCustomField ? exactMatch.fieldId : undefined,
        entityType: exactMatch.entityType,
        fieldType: exactMatch.type,
        isCustomField: exactMatch.isCustomField,
        isRequired: exactMatch.isRequired,
        label: exactMatch.label,
        confidence: 1.0,
        reason: 'Exact match',
        transform: null
      };
      return;
    }
    
    // Try common mappings
    if (commonMappings[columnName]) {
      const mappedFieldName = commonMappings[columnName];
      const mappedField = fieldsMap.get(mappedFieldName.toLowerCase());
      if (mappedField) {
        suggestions[index] = {
          field: mappedField.value,
          fieldId: mappedField.isCustomField ? mappedField.fieldId : undefined,
          entityType: mappedField.entityType,
          fieldType: mappedField.type,
          isCustomField: mappedField.isCustomField,
          isRequired: mappedField.isRequired,
          label: mappedField.label,
          confidence: 0.9,
          reason: 'Common mapping',
          transform: null
        };
        return;
      }
    }
    
    // Try partial match
    const partialMatch = availableFields.find(field =>
      field.value.toLowerCase().includes(columnName) ||
      field.label.toLowerCase().includes(columnName) ||
      columnName.includes(field.value.toLowerCase()) ||
      columnName.includes(field.label.toLowerCase())
    );
    
    if (partialMatch) {
      suggestions[index] = {
        field: partialMatch.value,
        fieldId: partialMatch.isCustomField ? partialMatch.fieldId : undefined,
        entityType: partialMatch.entityType,
        fieldType: partialMatch.type,
        isCustomField: partialMatch.isCustomField,
        isRequired: partialMatch.isRequired,
        label: partialMatch.label,
        confidence: 0.7,
        reason: 'Partial match',
        transform: null
      };
    }
  });
  
  return suggestions;
}

/**
 * Calculate overall mapping confidence
 */
function calculateMappingConfidence(suggestedMappings) {
  const mappings = Object.values(suggestedMappings);
  if (mappings.length === 0) return 0;
  
  const totalConfidence = mappings.reduce((sum, mapping) => sum + mapping.confidence, 0);
  return totalConfidence / mappings.length;
}

/**
 * Perform data validation on the import file
 */
async function performDataValidation(importRecord) {
  // This is a placeholder for actual validation logic
  // In a real implementation, you would:
  // 1. Read the file data
  // 2. Apply column mappings
  // 3. Validate each row according to field types and requirements
  // 4. Check for duplicates
  // 5. Return validation results
  
  return {
    validRows: importRecord.totalRows || 0,
    invalidRows: 0,
    hasErrors: false,
    errors: []
  };
}

/**
 * Helper function to get entity fields (exported for template generation)
 */
exports.getEntityFields = getEntityFields;

module.exports = exports;