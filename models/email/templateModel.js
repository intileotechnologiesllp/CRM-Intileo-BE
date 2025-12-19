const { DataTypes } = require("sequelize");


const createTemplateModel = (sequelizeInstance) => {
const Template = sequelizeInstance.define("Template", {
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
  content: {
    type: DataTypes.TEXT,
    allowNull: false, // Body is required
  },
  // placeholders: {
  //   type: DataTypes.JSON, // Store placeholders as a JSON array
  //   allowNull: true,
  // },
  isShared: {
    type: DataTypes.BOOLEAN,
    defaultValue: false, // Default to private
  },
  masterUserID:{
    type: DataTypes.INTEGER,
    allowNull: false, // Assuming this is required for user association
  }
},
 {
    tableName: "Templates",
    timestamps: true,
  }
);
return Template
}

module.exports = createTemplateModel;
