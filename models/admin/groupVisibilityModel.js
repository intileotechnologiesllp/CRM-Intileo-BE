const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");
const { pipeline } = require("nodemailer/lib/xoauth2");
const { Organization } = require("..");

const GroupVisibility = sequelize.define(
  "GroupVisibility",
  {
    groupId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    groupName: {
      type: DataTypes.STRING(70),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    pipeline: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    lead: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    deal: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    person: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    Organization: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    group: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "MasterUsers",
        key: "masterUserID",
      },
    },
  },
);

module.exports = GroupVisibility;
