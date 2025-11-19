const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const CompanySettings = sequelize.define(
  "CompanySettings",
  {
    companySettingsId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    companyName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "My Company",
      validate: {
        notEmpty: {
          msg: "Company name cannot be empty",
        },
        len: {
          args: [1, 255],
          msg: "Company name must be between 1 and 255 characters",
        },
      },
    },
    companyDomain: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      validate: {
        isLowercase: {
          msg: "Company domain must be lowercase",
        },
        is: {
          args: /^[a-z0-9-]+$/,
          msg: "Company domain can only contain lowercase letters, numbers, and hyphens",
        },
        len: {
          args: [3, 63],
          msg: "Company domain must be between 3 and 63 characters",
        },
      },
      comment: "Used for Smart BCC address and web app URLs",
    },
    preferredMaintenanceTime: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
      comment: "JSON object with day-wise maintenance time slots. Example: {monday: ['00:00-03:00', '03:00-06:00'], tuesday: ['06:00-09:00']}",
      comment: "Preferred system maintenance time in UTC (HH:00 format)",
    },
    timezone: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "UTC",
      comment: "Company timezone (for reporting and scheduling)",
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "company_settings",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["companyDomain"],
        name: "company_domain_unique",
      },
    ],
  }
);

module.exports = CompanySettings;
