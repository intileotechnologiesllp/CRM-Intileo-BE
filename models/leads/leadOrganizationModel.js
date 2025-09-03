const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const LeadOrganization = sequelize.define("LeadOrganization", {
  leadOrganizationId: {
    type: DataTypes.INTEGER,
    primaryKey: true, 
    autoIncrement: true,
  },
  organization: {
    type: DataTypes.STRING,
    allowNull: false, // Organization name
  },
  organizationLabels: {
    type: DataTypes.STRING,
    allowNull: true, // You can use comma-separated values or JSON if needed
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  visibleTo: {
    type: DataTypes.STRING,
    allowNull: true, // Comma-separated user IDs or roles
  },
  masterUserID: {
  type: DataTypes.INTEGER,
  allowNull: false, // or true if you want to allow nulls
},
ownerId:{
  type: DataTypes.INTEGER,
  allowNull: true, // Owner ID of the organization
},
// active:{
//   type: DataTypes.INTEGER,
//   allowNull: false,
//   defaultValue: 1
// },
// deletedAt: {
//     type: DataTypes.DATE,
//     allowNull: true,
// },
// visibilityGroupId: {
//     type: DataTypes.INTEGER,
//     allowNull: true,
//     references: {
//       model: "GroupVisibility",
//       key: "groupId",
//     },
//     comment: "Reference to the owner's visibility group",
//   },
  // Add more fields as needed
}, {
  //tableName: "leadorganizations" // <-- Set your desired table name here
});

module.exports = LeadOrganization;