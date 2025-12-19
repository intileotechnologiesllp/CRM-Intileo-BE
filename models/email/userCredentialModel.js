const { DataTypes } = require("sequelize");


const createUserCredentialModel = (sequelizeInstance) => {
const UserCredential = sequelizeInstance.define("UserCredential", {
  masterUserID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true, // Ensure one credential per user
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  appPassword: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  syncStartDate: {
    type: DataTypes.STRING,
    allowNull: true, // Optional field
  },
  // syncStartType: {
  //   type: DataTypes.ENUM("days", "months", "years"), // Restrict values to 'days', 'months', or 'years'
  //   allowNull: true, // Optional field
  //   defaultValue: "days", // Default to 'days'
  // },
    syncFolders: {
    type: DataTypes.JSON, // Store folder names as a JSON array
    allowNull: true, // Optional field
    defaultValue: ["INBOX", "[Gmail]/Sent Mail", "[Gmail]/Drafts"], // Default folders to sync
  },
  syncAllFolders: {
    type: DataTypes.BOOLEAN, // Boolean flag for syncing all folders
    allowNull: false,
    defaultValue: true, // Default to false (sync specific folders)
  },
  isTrackOpenEmail:{
    type: DataTypes.BOOLEAN, // Boolean flag for tracking email opens
    allowNull: false,
    defaultValue: true,//fault to false (do not track)
  },
  isTrackClickEmail:{
    type: DataTypes.BOOLEAN, // Boolean flag for tracking email clicks
    allowNull: false,
    defaultValue: true//Default to false (do not track)
  },
  signature: {
  type: DataTypes.TEXT,
  allowNull: true,
},
signatureName: {
  type: DataTypes.STRING,
  allowNull: true,
},
signatureImage: {
  type: DataTypes.TEXT, // Store as a base64 string or image URL
  allowNull: true,
},
smartBcc: {
  type: DataTypes.STRING,
  allowNull: true,
},
  blockedEmail:{
    type: DataTypes.JSON, // Store blocked email addresses as a JSON array
    allowNull: true, // Optional field
    defaultValue: [], // Default to an empty array
  },
  provider: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "gmail", // Default to gmail
    validate: {
      isIn: [['gmail', 'outlook', 'yahoo', 'custom',"yandex"]], // Restrict to known providers
    },
  },  
    // Add these fields for custom provider support
  imapHost: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  imapPort: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  imapTLS: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  smtpHost: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  smtpPort: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  smtpSecure: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
},
 {
    tableName: "UserCredentials",
    timestamps: true,
  }
);
return UserCredential
}

module.exports = createUserCredentialModel;
