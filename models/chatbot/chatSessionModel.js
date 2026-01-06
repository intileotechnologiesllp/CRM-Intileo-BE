const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const Tenant = require("./tenantModel");

const ChatSession = sequelize.define(
  "ChatSession",
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
    chatwootConversationId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    botpressSessionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "closed", "handoff"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    tableName: "chat_sessions",
    timestamps: true,
    indexes: [
      { fields: ["tenantId"] },
      { fields: ["chatwootConversationId"] },
      { fields: ["botpressSessionId"] },
    ],
  }
);

ChatSession.belongsTo(Tenant, { foreignKey: "tenantId", as: "tenant" });
Tenant.hasMany(ChatSession, { foreignKey: "tenantId", as: "chatSessions" });

module.exports = ChatSession;
