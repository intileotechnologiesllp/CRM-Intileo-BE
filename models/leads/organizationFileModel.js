const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const Organization = require("../leads/leadOrganizationModel");
const MasterUser = require("../master/masterUserModel");

const OrganizationFile = sequelize.define("OrganizationFile", {
  fileId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  leadOrganizationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Organization,
      key: "leadOrganizationId",
    },
    onDelete: "CASCADE",
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: "Original name of the uploaded file",
  },
  fileDisplayName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Display name for the file (can be renamed by user)",
  },
  filePath: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: "Path to the file in storage system",
  },
  fileSize: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: "File size in bytes",
  },
  mimeType: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: "MIME type of the file",
  },
  fileExtension: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "File extension (.pdf, .docx, etc.)",
  },
  fileCategory: {
    type: DataTypes.ENUM,
    values: ['document', 'image', 'video', 'audio', 'spreadsheet', 'presentation', 'archive', 'contract', 'brochure', 'other'],
    defaultValue: 'document',
    comment: "Category of the file for better organization",
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "Optional description or notes about the file",
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: "Array of tags for file organization",
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: "Whether the file is visible to all team members",
  },
  uploadedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: MasterUser,
      key: "masterUserID",
    },
    comment: "User who uploaded the file",
  },
  lastAccessedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: "Last time the file was accessed/downloaded",
  },
  downloadCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "Number of times the file has been downloaded",
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: "File version number for version control",
  },
  previousVersionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: "OrganizationFiles",
      key: "fileId",
    },
    comment: "Reference to previous version of the file",
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: "Whether the file is active (not deleted)",
  },
  masterUserID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: "Organization/tenant ID",
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "OrganizationFiles",
  timestamps: true,
  indexes: [
    {
      fields: ['leadOrganizationId']
    },
    {
      fields: ['uploadedBy']
    },
    {
      fields: ['fileCategory']
    },
    {
      fields: ['masterUserID']
    },
    {
      fields: ['isActive']
    }
  ]
});

// Define associations
OrganizationFile.belongsTo(Organization, { foreignKey: 'leadOrganizationId', as: 'organization' });
OrganizationFile.belongsTo(MasterUser, { foreignKey: 'uploadedBy', as: 'uploader' });

module.exports = OrganizationFile;