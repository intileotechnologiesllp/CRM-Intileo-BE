const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const { workloadmanager } = require("googleapis/build/src/apis/workloadmanager");
const { people } = require("googleapis/build/src/apis/people");

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
  references: { model: "masterusers", key: "masterUserID" }
},
ownerId:{
  type: DataTypes.INTEGER,
  allowNull: true, // Owner ID of the organization
},
ownerName:{
  type: DataTypes.STRING,
  allowNull: true, // Owner Name of the organization
},
wonDeals:{
  type: DataTypes.INTEGER,
  allowNull: true, // Number of won deals
  defaultValue:0
},
lostDeals:{
  type: DataTypes.INTEGER,
  allowNull: true, // Number of lost deals
  defaultValue:0
},
openDeals:{
  type: DataTypes.INTEGER,
  allowNull: true, // Number of open deals
  defaultValue:0
},
peopleCount:{
  type: DataTypes.INTEGER,
  allowNull: true, // Number of people associated with the organization 
  defaultValue:0
},
lastActivityDate:{
  type: DataTypes.DATE,
  allowNull: true, // Date of the last activity
},
nextActivityDate:{
  type: DataTypes.DATE,
  allowNull: true, // Date of the next scheduled activity 
},
doneActivitiesCount:{
  type: DataTypes.INTEGER,
  allowNull: true, // Count of completed activities
  defaultValue:0
},
totalActivitiesCount:{
  type: DataTypes.INTEGER,
  allowNull: true, // Total count of activities
  defaultValue:0
},
activitiesTodoCount:{
  type: DataTypes.INTEGER,
  allowNull: true, // Count of activities to do
  defaultValue:0
},
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