// const { DataTypes } = require("sequelize");
// const sequelize = require("../../config/db");

// const LeadOrganization = sequelize.define("LeadOrganization", {
//   organizationId: {
//     type: DataTypes.INTEGER,
//     primaryKey: true,
//     autoIncrement: true,
//   },
//   organization: {
//     type: DataTypes.STRING,
//     allowNull: false, // Organization name
//   },
//   organizationLabels: {
//     type: DataTypes.STRING,
//     allowNull: true, // You can use comma-separated values or JSON if needed
//   },
//   address: {
//     type: DataTypes.STRING,
//     allowNull: true,
//   },
//   visibleTo: {
//     type: DataTypes.STRING,
//     allowNull: true, // Comma-separated user IDs or roles
//   },
//   // Add more fields as needed
// });

// module.exports = LeadOrganization;