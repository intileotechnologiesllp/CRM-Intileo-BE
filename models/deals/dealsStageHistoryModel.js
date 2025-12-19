const { DataTypes } = require("sequelize");
const Deal = require("../../models/deals/dealsModels");

const createDealStageHistoryModel = (sequelizeInstance) => {
const DealStageHistory = sequelizeInstance.define("DealStageHistory", {
  dealsStageId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  dealId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "Deals",
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
return DealStageHistory
}

// Association
// DealStageHistory.belongsTo(Deal, { foreignKey: "dealId", as: "Deal" });

module.exports = createDealStageHistoryModel;