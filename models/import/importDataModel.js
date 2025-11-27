const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const ImportData = sequelize.define('ImportData', {
  importId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  // Session & User Info
  masterUserID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'ID of the user who initiated the import'
  },
  sessionId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: 'Unique session identifier for tracking'
  },
  
  // File Information
  originalFileName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Original name of the uploaded file'
  },
  filePath: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'Path where the uploaded file is stored'
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Size of the file in bytes'
  },
  fileType: {
    type: DataTypes.ENUM('csv', 'xlsx', 'xls'),
    allowNull: false,
    comment: 'Type of the uploaded file'
  },
  
  // Import Configuration
  entityType: {
    type: DataTypes.ENUM('lead', 'deal', 'person', 'organization', 'activity'),
    allowNull: false,
    comment: 'Target entity type for the import'
  },
  columnMapping: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'JSON object mapping spreadsheet columns to CRM fields'
  },
  importOptions: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional import options like duplicate handling, validation rules'
  },
  
  // Data Statistics
  totalRows: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Total number of rows in the file (excluding header)'
  },
  validRows: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Number of rows that passed validation'
  },
  invalidRows: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Number of rows that failed validation'
  },
  
  // Import Progress & Status
  status: {
    type: DataTypes.ENUM(
      'uploaded',      // File uploaded successfully
      'analyzing',     // Analyzing file structure
      'mapping',       // Column mapping in progress
      'validating',    // Data validation in progress
      'importing',     // Import process running
      'completed',     // Import completed successfully
      'failed',        // Import failed
      'cancelled'      // Import cancelled by user
    ),
    allowNull: false,
    defaultValue: 'uploaded',
    comment: 'Current status of the import process'
  },
  progress: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0.00,
    comment: 'Import progress percentage (0-100)'
  },
  
  // Processing Results
  processedRows: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Number of rows processed so far'
  },
  successfulImports: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Number of records successfully imported'
  },
  failedImports: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Number of records that failed to import'
  },
  duplicatesSkipped: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Number of duplicate records skipped'
  },
  
  // Error & Validation Info
  errorLog: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'JSON array of error messages and details'
  },
  validationErrors: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'JSON array of validation errors by row'
  },
  errorFilePath: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Path to generated error report file'
  },
  
  // Import Timing
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the import process started'
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the import process completed'
  },
  
  // Preview Data
  previewData: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Sample rows for preview during mapping'
  },
  columnHeaders: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Array of column headers from the spreadsheet'
  }
}, {
  tableName: 'import_data',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    {
      name: 'idx_import_session',
      fields: ['sessionId']
    },
    {
      name: 'idx_import_user_status',
      fields: ['masterUserID', 'status']
    },
    {
      name: 'idx_import_status',
      fields: ['status']
    },
    {
      name: 'idx_import_entity_type',
      fields: ['entityType']
    },
    {
      name: 'idx_import_created_at',
      fields: ['createdAt']
    }
  ]
});

// Instance methods for common operations
ImportData.prototype.updateProgress = function(progress, additionalData = {}) {
  const updateData = { progress, ...additionalData };
  return this.update(updateData);
};

ImportData.prototype.addError = function(error) {
  const currentErrors = this.errorLog || [];
  currentErrors.push({
    timestamp: new Date(),
    error: error
  });
  return this.update({ errorLog: currentErrors });
};

ImportData.prototype.addValidationErrors = function(rowErrors) {
  const currentValidationErrors = this.validationErrors || [];
  currentValidationErrors.push(...rowErrors);
  return this.update({ validationErrors: currentValidationErrors });
};

ImportData.prototype.markAsCompleted = function(results = {}) {
  return this.update({
    status: 'completed',
    completedAt: new Date(),
    progress: 100.00,
    ...results
  });
};

ImportData.prototype.markAsFailed = function(error) {
  return this.update({
    status: 'failed',
    completedAt: new Date(),
    errorLog: this.errorLog ? [...this.errorLog, { timestamp: new Date(), error }] : [{ timestamp: new Date(), error }]
  });
};

// Class methods for querying
ImportData.getBySession = function(sessionId) {
  return this.findOne({ where: { sessionId } });
};

ImportData.getByUser = function(masterUserID, limit = 10) {
  return this.findAll({
    where: { masterUserID },
    order: [['createdAt', 'DESC']],
    limit
  });
};

ImportData.getActiveImports = function(masterUserID = null) {
  const whereClause = {
    status: ['uploading', 'analyzing', 'mapping', 'validating', 'importing']
  };
  
  if (masterUserID) {
    whereClause.masterUserID = masterUserID;
  }
  
  return this.findAll({
    where: whereClause,
    order: [['createdAt', 'DESC']]
  });
};

module.exports = ImportData;