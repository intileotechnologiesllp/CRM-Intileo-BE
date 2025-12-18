const { DataTypes } = require("sequelize");


const createGroupMembershipModel = (sequelizeInstance) => {
const GroupMembership = sequelizeInstance.define(
  "GroupMembership",
  {
    membershipId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "GroupVisibilities",
        key: "groupId",
      },
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "MasterUsers",
        key: "masterUserID",
      },
    },
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "MasterUsers",
        key: "masterUserID",
      },
    },
    assignedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "MasterUsers",
        key: "masterUserID",
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    joinedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "GroupMemberships",
    timestamps: true,
    indexes: [
      {
        fields: ["groupId"],
      },
      {
        fields: ["userId"],
      },
      {
        fields: ["masterUserID"],
      },
      {
        unique: true,
        fields: ["groupId", "userId"],
        name: "unique_group_user_membership",
      },
    ],
  }
);
return GroupMembership
}

module.exports = createGroupMembershipModel;
