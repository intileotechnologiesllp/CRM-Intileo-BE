const { DataTypes } = require("sequelize");


const createDepartmentModel = (sequelizeInstance) => {
const Department = sequelizeInstance.define("Department", {
  departmentId: {
    type: DataTypes.INTEGER,
    primaryKey: true, // Set as primary key
    autoIncrement: true, // Auto-increment the ID
  },
  department_desc: {
    type: DataTypes.STRING,
    allowNull: false, // Ensure this field cannot be null
    validate: {
      notNull: {
        msg: "Department description is required", // Custom error message
      },
      notEmpty: {
        msg: "Department description cannot be empty", // Custom error message
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
    tableName: "Departments",
    timestamps: true,
  }
);
return Department
}

module.exports = createDepartmentModel;
