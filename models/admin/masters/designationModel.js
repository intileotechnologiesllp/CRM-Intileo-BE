const { DataTypes } = require("sequelize");
const sequelize = require("../../../config/db");

const Designation = sequelize.define("Designation", {
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
  mode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = Designation;
