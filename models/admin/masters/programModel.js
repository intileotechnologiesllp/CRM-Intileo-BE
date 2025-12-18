const { DataTypes } = require("sequelize");


const createProgramModel = (sequelizeInstance) => {
const Program = sequelizeInstance.define("Program", {
  programId: {
    type: DataTypes.INTEGER,
    primaryKey: true, // Set as primary key
    autoIncrement: true, // Auto-increment the ID
    // references: {
    //   model: "MasterUserPrivileges", // Table name for MasterUser
    //   key: "programId",
    // },
    // onDelete: "CASCADE",
  },
  program_desc: {
    type: DataTypes.STRING,
    allowNull: false, // Ensure this field cannot be null
    validate: {
      notNull: {
        msg: "program description is required", // Custom error message
      },
      notEmpty: {
        msg: "program description cannot be empty", // Custom error message
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
    tableName: "Programs",
    timestamps: true,
  }
);
return Program
}


module.exports = createProgramModel;
