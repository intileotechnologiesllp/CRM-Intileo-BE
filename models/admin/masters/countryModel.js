const { DataTypes } = require("sequelize");
const sequelize = require("../../../config/db");

const Country = sequelize.define("Country", {
  countryID: {
    type: DataTypes.INTEGER,
    primaryKey: true, // Set as primary key
    autoIncrement: true, // Auto-increment the ID
  },
  // country_desc: {
  //   type: DataTypes.STRING,
  //   allowNull: true, // Ensure this field cannot be null
  //   validate: {
  //     notNull: {
  //       msg: "country description is required", // Custom error message
  //     },
  //     notEmpty: {
  //       msg: "country description cannot be empty", // Custom error message
  //     },
  //   },
  // },
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
  countryName : {
    type: DataTypes.STRING,
    allowNull: false, // Ensure this field cannot be null
  },
  isoCode : {
    type: DataTypes.STRING,
    allowNull: false, // Ensure this field cannot be null
  },
});

module.exports = Country;
