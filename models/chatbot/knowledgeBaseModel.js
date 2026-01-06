const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const Tenant = require("./tenantModel");

const KnowledgeBase = sequelize.define(
  "KnowledgeBase",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    question: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    answer: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    tags: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "knowledge_bases",
    timestamps: true,
    indexes: [{ fields: ["tenantId"] }],
  }
);

KnowledgeBase.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
Tenant.hasMany(KnowledgeBase, { foreignKey: "tenantId", as: "knowledgeBase" });

module.exports = KnowledgeBase;
