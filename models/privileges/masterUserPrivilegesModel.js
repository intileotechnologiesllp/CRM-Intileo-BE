const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const Program = require("../../models/admin/masters/programModel"); // Import the Program model

const MasterUserPrivileges = sequelize.define("MasterUserPrivileges", {
  privilegeID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  masterUserID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "MasterUsers", // Table name for MasterUser
      key: "masterUserID",
    },
    onDelete: "CASCADE",
  },
  // programId: {
  //   type: DataTypes.INTEGER,
  //   allowNull: false, // Ensure this field cannot be null
  //   references: {
  //     model: "Programs", // Table name for Program
  //     key: "programId",
  //   },
  //   onDelete: "CASCADE", // Delete privileges if the associated program is deleted
  // },
  permissions: {
    type: DataTypes.JSON, // Store permissions as a JSON object
    allowNull: false,
    defaultValue: {}, // Default to an empty object
  },
  
  createdById: {
    type: DataTypes.INTEGER,
    allowNull: false, // Admin ID who assigned the permission
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false, // Role of the creator (e.g., "admin")
  },
  mode:{
    type: DataTypes.STRING,
    allowNull: true,
  }
});


// Define associations
// Program.hasOne(MasterUserPrivileges, {
//   foreignKey: "programId",
//   as: "privileges",
// });

// MasterUserPrivileges.belongsTo(Program, {
//   foreignKey: "programId",
//   as: "program",
// });

module.exports = MasterUserPrivileges;
