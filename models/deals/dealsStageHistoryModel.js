const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const Deal = require("../../models/deals/dealsModels");

const DealStageHistory = sequelize.define("DealStageHistory", {
  dealsStageId: {
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
  stageName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  enteredAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  }
}, {
  tableName: "DealStageHistories",
  timestamps: false,
});

// Association
DealStageHistory.belongsTo(Deal, { foreignKey: "dealId", as: "Deal" });

module.exports = DealStageHistory;