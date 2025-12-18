const { DataTypes } = require("sequelize");

const createDesignationModel = (sequelizeInstance) => {
const Designation = sequelizeInstance.define("Designation", {
  designationId: {
    type: DataTypes.INTEGER,
    primaryKey: true, // Set as primary key
    autoIncrement: true, // Auto-increment the ID
  },
  designation_desc: {
    type: DataTypes.STRING,
    allowNull: false, // Ensure this field cannot be null
    validate: {
      notNull: {
        msg: "Designation description is required", // Custom error message
      },
      notEmpty: {
        msg: "Designation description cannot be empty", // Custom error message
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
    tableName: "Designations",
    timestamps: true,
  }
);
return Designation
}

module.exports = createDesignationModel;
