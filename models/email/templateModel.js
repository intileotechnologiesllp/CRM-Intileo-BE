const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db");

const Template = sequelize.define("Template", {
  templateID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false, // Template name is required
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: false, // Subject is required
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false, // Body is required
  },
  placeholders: {
    type: DataTypes.JSON, // Store placeholders as a JSON array
    allowNull: true,
  },
});

module.exports = Template;
