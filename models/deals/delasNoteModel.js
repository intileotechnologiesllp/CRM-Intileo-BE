const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const Deal = require("../../models/deals/dealsModels"); // Adjust path as needed
const MasterUser = require("../../models/master/masterUserModel"); // Adjust path as needed

const DealNote = sequelize.define("DealNote", {
  noteId: {
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
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: MasterUser,
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

// Associations (optional)
DealNote.belongsTo(Deal, { foreignKey: "dealId", as: "Deal" });
DealNote.belongsTo(MasterUser, { foreignKey: "createdBy", as: "Author" });

module.exports = DealNote;