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
    const masterUserID = req.adminId;

    // Validate entity type
    const validEntityTypes = ['lead', 'deal', 'person', 'organization', 'activity'];
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid entity type. Must be one of: ${validEntityTypes.join(', ')}`
      });
    }

    const fields = await getEntityFields(entityType);

    res.status(200).json({
      success: true,
      data: {
        entityType,
        fields,
        totalFields: fields.length,
        standardFields: fields.filter(f => !f.isCustomField).length,
        customFields: fields.filter(f => f.isCustomField).length
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

    // Validate column mapping
    const validationResult = await validateColumnMapping(columnMapping, importRecord.entityType);
    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Column mapping validation failed',
        errors: validationResult.errors
      });
    }

    // Update import record with mapping
    await importRecord.update({
      columnMapping,
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
        columnMapping,
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
    if (!sequelizeType || !sequelizeType.key) return 'text';
    
    switch (sequelizeType.key) {
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
    // Get model based on entity type
    let Model;
    switch (entityType) {
      case 'lead':
        Model = Lead;
        break;
      case 'person':
        Model = Person;
        break;
      case 'deal':
        Model = Deal;
        break;
      // Add other entity types as needed
      default:
        Model = Lead; // Default to Lead
    }

    // Get standard fields from model
    if (Model && Model.rawAttributes) {
      Object.entries(Model.rawAttributes).forEach(([fieldName, fieldConfig]) => {
        // Skip system fields
        if (['createdAt', 'updatedAt', 'id'].includes(fieldName)) return;
        
        const fieldType = getFieldType(fieldConfig.type);
        const label = formatLabel(fieldName);
        
        fields.push({
          value: fieldName,
          label: label,
          type: fieldType,
          entity: entityType,
          isCustomField: false,
          isRequired: fieldConfig.allowNull === false,
          description: fieldConfig.comment || null
        });
      });
    }

    // Get custom fields
    const customFields = await CustomField.findAll({
      where: {
        entityType: { [Op.in]: [entityType, 'both'] },
        isActive: true
      },
      attributes: ['fieldId', 'fieldName', 'fieldLabel', 'fieldType', 'isRequired', 'fieldOptions']
    });

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
        isCustomField: true,
        isRequired: customField.isRequired || false,
        fieldId: customField.fieldId,
        options: customField.fieldOptions
      });
    });

    // Sort fields: required first, then by label
    fields.sort((a, b) => {
      if (a.isRequired !== b.isRequired) {
        return a.isRequired ? -1 : 1;
      }
      return a.label.localeCompare(b.label);
    });

    return fields;

  } catch (error) {
    console.error('Error getting entity fields:', error);
    return [];
  }
}

/**
 * Validate column mapping configuration
 */
async function validateColumnMapping(columnMapping, entityType) {
  const errors = [];
  
  try {
    // Get available fields for validation
    const availableFields = await getEntityFields(entityType);
    const availableFieldValues = availableFields.map(f => f.value);
    
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
      
      const { field, transform } = fieldMapping;
      
      // Check if mapped field exists
      if (!availableFieldValues.includes(field)) {
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
 * Generate suggested mappings based on column names
 */
function generateSuggestedMappings(columnHeaders, availableFields) {
  const suggestions = {};
  
  // Common field mappings
  const commonMappings = {
    // Lead fields
    'first name': 'firstName',
    'firstname': 'firstName',
    'last name': 'lastName',
    'lastname': 'lastName',
    'full name': 'contactPerson',
    'name': 'contactPerson',
    'email': 'emailAddress',
    'email address': 'emailAddress',
    'phone': 'phoneNumber',
    'phone number': 'phoneNumber',
    'company': 'organizationName',
    'organization': 'organizationName',
    'title': 'jobTitle',
    'job title': 'jobTitle',
    'lead source': 'leadSource',
    'source': 'leadSource',
    'status': 'status',
    'value': 'leadValue',
    'lead value': 'leadValue',
    'notes': 'notes',
    'description': 'notes',
    'website': 'website',
    'address': 'address',
    'city': 'city',
    'state': 'state',
    'country': 'country',
    'zip': 'postalCode',
    'postal code': 'postalCode',
    
    // Person fields
    'person name': 'contactPerson',
    'contact person': 'contactPerson',
    
    // Deal fields
    'deal title': 'dealTitle',
    'deal name': 'dealTitle',
    'deal value': 'dealValue',
    'amount': 'dealValue',
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
        confidence: 1.0,
        reason: 'Exact match'
      };
      return;
    }
    
    // Try common mappings
    if (commonMappings[columnName]) {
      const mappedField = availableFields.find(field => field.value === commonMappings[columnName]);
      if (mappedField) {
        suggestions[index] = {
          field: mappedField.value,
          confidence: 0.9,
          reason: 'Common mapping'
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
        confidence: 0.7,
        reason: 'Partial match'
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