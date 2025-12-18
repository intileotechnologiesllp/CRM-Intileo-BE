const { DataTypes } = require("sequelize");


const createOrganizationModel = (sequelizeInstance) => {
const Organization = sequelizeInstance.define("Organization", {
  organizationId: {
    type: DataTypes.INTEGER,
    primaryKey: true, // Set as primary key
    autoIncrement: true, // Auto-increment the ID
  },
  organization_desc: {
    type: DataTypes.STRING,
    allowNull: false, // Ensure this field cannot be null
    validate: {
      notNull: {
        msg: "organization description is required", // Custom error message
      },
      notEmpty: {
        msg: "organization description cannot be empty", // Custom error message
      },
    },
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  createdById: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  mode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  creationDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW, // Set default value to the current timestamp
  },
},
  {
    tableName: "Organizations",
    timestamps: true,
  }
);
return Organization
}

module.exports = createOrganizationModel;
