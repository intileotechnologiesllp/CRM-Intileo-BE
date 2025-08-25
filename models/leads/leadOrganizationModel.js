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
}
  // Add more fields as needed
}, {
  //tableName: "leadorganizations" // <-- Set your desired table name here
});

module.exports = LeadOrganization;