const { DataTypes } = require("sequelize");
const sequelize = require("../../../config/db");

const OrganizationType = sequelize.define("OrganizationType", {
  organization_desc: {
    type: DataTypes.STRING,
    allowNull: false, // Ensure this field cannot be null
    validate: {
      notNull: {
        msg: "Organization description is required", // Custom error message
      },
      notEmpty: {
        msg: "Organization description cannot be empty", // Custom error message
      },
    },
  },
  creationDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  mode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = OrganizationType;
