const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const Deal = require("../../models/deals/dealsModels");

const DealDetails = sequelize.define("DealDetails", {
  dealDetailsId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  dealId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Deal,
      key: "dealId"
    }
  },
  statusSummary: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  responsiblePerson: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  rfpReceivedDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Add future fields here as needed
}, {
  tableName: "DealDetails",
  timestamps: true,
});

// Associations
DealDetails.belongsTo(Deal, { foreignKey: "dealId", as: "Deal" });
Deal.hasOne(DealDetails, { foreignKey: "dealId", as: "details" });

module.exports = DealDetails;