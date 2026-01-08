const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// jobTitle, useCrmBefore, companySize, industry, companyName, totalEmployees, focus
const StartupQuestion = sequelize.define("StartupQuestion", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  masterUserID: {
    type: DataTypes.INTEGER,
    allowNull: true,
    // references: { model: "masterusers", key: "masterUserID" },
    // onDelete: "CASCADE",
  },
  jobTitle: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  useCrmBefore: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  companySize: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  industry: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  companyName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  totalEmployees: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  focus: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

StartupQuestion.sync({ alter: false }); // Ensure the table is created
module.exports = StartupQuestion;
