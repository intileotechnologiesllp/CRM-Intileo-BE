// const { DataTypes } = require("sequelize");
// const sequelize = require("../../config/db");
// const Lead = require("./leadsModel");
// const Person = require("../../models/leads/leadPersonModel"); // Adjust the path as needed

// const LeadDetails = sequelize.define("LeadDetails", {
//   leadDetailsId: {
//     type: DataTypes.INTEGER,
//     primaryKey: true,
//     autoIncrement: true,
//   },
//   leadId: {
//     type: DataTypes.INTEGER,
//     allowNull: false,
//     references: {
//       model: Lead,
//       key: "leadId",
//     },
//     onDelete: "CASCADE", // Delete LeadDetails if the associated Lead is deleted
//   },
//   //   personId: {
//   //   type: DataTypes.INTEGER,
//   //   references: {
//   //     model: Person,
//   //     key: "personId"
//   //   },
//   //   allowNull: true,
//   // },
//   RFP_receivedDate: {
//     type: DataTypes.DATE,
//     allowNull: true,
//   },
//   statusSummary: {
//     type: DataTypes.STRING,
//     allowNull: true,
//   },
//   responsibleId: {
//     type: DataTypes.INTEGER,
//     allowNull: true,
//   },
//   responsiblePerson: {
//     type: DataTypes.STRING,
//     allowNull: true,
//   },
//   organizationName: {
//     type: DataTypes.STRING,
//     allowNull: true,
//   },
//   source: {
//     type: DataTypes.STRING,
//     allowNull: true,
//   },
//   // transferOwnerShip: {
//   //   type: DataTypes.BOOLEAN,
//   //   defaultValue: false,
//   // },
//   sourceOrgin: {
//     type: DataTypes.STRING,
//     allowNull: true,
//   },
//   personName: {
//     type: DataTypes.STRING,
//     allowNull: true,
//   },
//   notes: {
//     type: DataTypes.TEXT,
//     allowNull: true,
//   },
//   // postalAddress: {
//   //   type: DataTypes.STRING,
//   //   allowNull: true,
//   // },
//   // birthday: {
//   //   type: DataTypes.DATE,
//   //   allowNull: true,
//   // },
//   // jobTitle: {
//   //   type: DataTypes.STRING,
//   //   allowNull: true,
//   // },
//   sourceOrigin:{
//     type: DataTypes.STRING,
//     allowNull: true,
//   },
//   sourceOriginID: {
//     type: DataTypes.STRING,
//     allowNull: true,
//   },
//   currency:{
//     type: DataTypes.STRING,
//     allowNull: true, // Currency for the lead
//   },
//   nextActivityDate: {
//     type: DataTypes.DATE,
//     allowNull: true, // Date for the next activity
//   },
//   nextActivityStatus: {
//     type: DataTypes.STRING,
//     allowNull: true, // Status of the next activity
//   },


// });
// // In your model setup file
// // Lead.belongsTo(Person, { foreignKey: "personId" });
// // Person.hasMany(Lead, { foreignKey: "personId" });

// module.exports = LeadDetails;


//...............................changes.........................
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const Lead = require("./leadsModel");

const LeadDetails = sequelize.define("LeadDetails", {
  leadDetailsId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  leadId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Lead,
      key: "leadId",
    },
    onDelete: "CASCADE", // Delete LeadDetails if the associated Lead is deleted
  },
  RFP_receivedDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  statusSummary: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  responsibleId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  responsiblePerson: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  organizationName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  source: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // transferOwnerShip: {
  //   type: DataTypes.STRING,
  //   allowNull: true
  // },
  sourceOrgin: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  personName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  postalAddress: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  birthday: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  jobTitle: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // sourceOrigin:{
  //   type: DataTypes.STRING,
  //   allowNull: true,
  // },
  sourceOriginID: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  currency:{
    type: DataTypes.STRING,
    allowNull: true, // Currency for the lead
  },
  nextActivityDate: {
    type: DataTypes.DATE,
    allowNull: true, // Date for the next activity
  },
  nextActivityStatus: {
    type: DataTypes.STRING,
    allowNull: true, // Status of the next activity
  },
  address:{
    type: DataTypes.STRING,
    allowNull: true, // Address for the lead
  }


});

module.exports = LeadDetails;
