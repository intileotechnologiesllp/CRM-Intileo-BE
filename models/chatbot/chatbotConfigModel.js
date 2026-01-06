const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const Tenant = require("./tenantModel");

const ChatbotConfig = sequelize.define(
  "ChatbotConfig",
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
    botName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    systemPrompt: { type: DataTypes.TEXT, allowNull: true },
    welcomeMessage: { type: DataTypes.TEXT, allowNull: true },
    language: { type: DataTypes.STRING, allowNull: true },
    businessHours: { type: DataTypes.JSON, allowNull: true },
    fallbackMessage: { type: DataTypes.TEXT, allowNull: true },
    enableHumanHandoff: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    allowedActions: { type: DataTypes.JSON, allowNull: true },
    escalationRules: { type: DataTypes.JSON, allowNull: true },
    botpressBotId: { type: DataTypes.STRING, allowNull: true },
    chatwootInboxId: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: "chatbot_configs",
    timestamps: true,
    indexes: [
      { fields: ["tenantId"] },
      { fields: ["chatwootInboxId"] },
    ],
  }
);

ChatbotConfig.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
Tenant.hasMany(ChatbotConfig, { foreignKey: "tenantId", as: "chatbotConfigs" });

module.exports = ChatbotConfig;
