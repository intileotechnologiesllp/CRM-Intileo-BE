const { DataTypes } = require("sequelize");
// const MasterUser = require("../master/masterUserModel");

const createNotificationModel = (sequelizeInstance) => {
const Notification = sequelizeInstance.define(
  "Notification",
  {
    notificationId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "MasterUsers",
        key: "masterUserID",  // Fixed: Use correct primary key
      },
      comment: "User who receives this notification",
    },
    type: {
      type: DataTypes.ENUM(
        "deal_created",
        "deal_updated",
        "deal_won",
        "deal_lost",
        "deal_assigned",
        "deal_stage_changed",
        "lead_created",
        "lead_updated",
        "lead_assigned",
        "lead_converted",
        "activity_created",
        "activity_assigned",
        "activity_completed",
        "activity_due",
        "activity_overdue",
        "email_received",
        "email_sent",
        "email_replied",
        "contact_created",
        "contact_updated",
        "organization_created",
        "organization_updated",
        "mention",
        "comment",
        "task_assigned",
        "goal_achieved",
        "report_generated",
        "system"
      ),
      allowNull: false,
      comment: "Type of notification event",
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Notification title/heading",
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Notification message body",
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Whether notification has been read",
    },
    priority: {
      type: DataTypes.ENUM("low", "medium", "high", "urgent"),
      defaultValue: "medium",
      comment: "Notification priority level",
    },
    entityType: {
      type: DataTypes.ENUM(
        "deal",
        "lead",
        "activity",
        "email",
        "contact",
        "organization",
        "goal",
        "report",
        "system"
      ),
      allowNull: true,
      comment: "Related entity type",
    },
    entityId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Related entity ID (dealId, leadId, etc.)",
    },
    actionUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "URL to navigate when notification is clicked",
    },
    actionBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "MasterUsers",
        key: "masterUserID",  // Fixed: Use correct primary key
      },
      comment: "User who triggered this notification",
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Additional data (e.g., old value, new value, etc.)",
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Timestamp when notification was read",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Expiration timestamp for auto-deletion",
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Soft delete flag",
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "Notifications",
    timestamps: true,
    indexes: [
      {
        fields: ["userId", "isRead"],
        name: "idx_user_read",
      },
      {
        fields: ["userId", "createdAt"],
        name: "idx_user_created",
      },
      {
        fields: ["type"],
        name: "idx_type",
      },
      {
        fields: ["entityType", "entityId"],
        name: "idx_entity",
      },
    ],
  }
);
return Notification
}

// Associations
// Notification.belongsTo(MasterUser, {
//   foreignKey: "userId",
//   targetKey: "masterUserID",  // Specify the correct primary key in MasterUsers table
//   as: "recipient",
// });

// Notification.belongsTo(MasterUser, {
//   foreignKey: "actionBy",
//   targetKey: "masterUserID",  // Specify the correct primary key in MasterUsers table
//   as: "actor",
// });

module.exports = createNotificationModel;
