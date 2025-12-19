const { DataTypes } = require("sequelize");


const createAttachmentModel = (sequelizeInstance) => {
const Attachment = sequelizeInstance.define("Attachment", {
  attachmentID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  emailID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "Emails", 
      key: "emailID",
    },
    onDelete: "CASCADE", 
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  contentType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  size: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  filePath: {
    type: DataTypes.STRING, // Path to the file in the storage system
    allowNull: true,
  },
  masterUserID: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
},
 {
    tableName: "Attachments",
    timestamps: true,
  }
);
return Attachment
}

module.exports = createAttachmentModel;
