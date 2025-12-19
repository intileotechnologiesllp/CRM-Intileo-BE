const { DataTypes } = require("sequelize");


const createReportFolderModel = (sequelizeInstance) => {
const ReportFolder = sequelizeInstance.define(
  "ReportFolder",
  {
    reportFolderId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: { type: DataTypes.STRING, allowNull: false },
    ownerId: { type: DataTypes.INTEGER, allowNull: false }, // userId
  },
  {
    tableName: "ReportFolders",
    timestamps: true,
  }
);
return ReportFolder
}

module.exports = createReportFolderModel;
