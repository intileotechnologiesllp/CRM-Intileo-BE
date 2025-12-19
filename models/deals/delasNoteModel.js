const { DataTypes } = require("sequelize");
// const Deal = require("../../models/deals/dealsModels"); 
// const MasterUser = require("../../models/master/masterUserModel"); 

const createDealNoteModel = (sequelizeInstance) => {
const DealNote = sequelizeInstance.define("DealNote", {
  noteId: {
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
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "MasterUsers",
      key: "masterUserID"
    }
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  }
}, {
  tableName: "DealNotes",
  timestamps: true,
});
return DealNote
}
// Associations (optional)
// DealNote.belongsTo(Deal, { foreignKey: "dealId", as: "Deal" });
// DealNote.belongsTo(MasterUser, { foreignKey: "createdBy", as: "Author" });

module.exports = createDealNoteModel;