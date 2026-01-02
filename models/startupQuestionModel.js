const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// jobTitle, useCrmBefore, companySize, industry, companyName, totalEmployees, focus
const createStartupQuestionModel = (sequelizeInstance) => {
const StartupQuestion = sequelizeInstance.define("StartupQuestion", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  masterUserID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: "MasterUsers", key: "masterUserID" },
    onDelete: "CASCADE",
  },
  jobTitle: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  useCrmBefore: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  companySize: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  industry: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  companyName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  totalEmployees: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  focus: {
    type: DataTypes.STRING,
    allowNull: false,
  },
},
{
  tableName: "StartupQuestions",
  timestamps: true,
}
)
return StartupQuestion;
};

module.exports = createStartupQuestionModel;